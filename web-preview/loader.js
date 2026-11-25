/**
 * Zero-build loader for the browser preview. This project builds for real with
 * `npm install && npm run build` (Vite) — that's what the Android APK packages and what any
 * normal dev environment should use. This loader exists only because THIS sandbox has no
 * network access to the npm registry, so `npm install` cannot run here at all.
 *
 * It fetches the real, unmodified TypeScript/TSX source files (same ones used by the app and
 * the Android build) and transpiles them in-browser with the TypeScript compiler's own browser
 * bundle (ts.transpileModule — the same compiler `tsc` uses, just running client-side), then
 * runs them through a tiny CommonJS shim so relative imports resolve. 'react' /
 * 'react-dom/client' resolve to the real React/ReactDOM UMD builds loaded above. 'lucide-react'
 * resolves to a placeholder icon set (generic glyphs) since the real icon package needs a
 * bundler to fetch reliably here — this is cosmetic only and touches no app logic, state, or
 * provider code.
 */
(function () {
  var knownFiles = [
    'main.tsx',
    'pages/Setup.tsx',
    'pages/IntegrationStatus.tsx',
    'pages/AddRemote.tsx',
    'pages/AddQubo.tsx',
    'components/Controls.tsx',
    'components/PhaseBanner.tsx',
    'providers/types.ts',
    'providers/nativeWindow.ts',
    'providers/nativeProvider.ts',
    'providers/useProvider.ts',
    'providers/ir.ts',
    'providers/format.ts',
    'providers/qubo/nativeQuboProvider.ts',
    'providers/qubo/useQuboProvider.ts',
    'providers/qubo/status.ts',
  ];

  var sourceCache = {};
  var modules = {};

  function makeIconStub() {
    function makeIcon(name) {
      function Icon(props) {
        props = props || {};
        var size = props.size || 18;
        return window.React.createElement(
          'svg',
          { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, style: props.style, 'data-icon': name },
          window.React.createElement('circle', { cx: 12, cy: 12, r: 9 }),
        );
      }
      Icon.displayName = name;
      return Icon;
    }
    var cache = {};
    return new Proxy({}, {
      get: function (_target, name) {
        if (typeof name !== 'string') return undefined;
        if (!cache[name]) cache[name] = makeIcon(name);
        return cache[name];
      },
    });
  }

  var builtins = {
    react: function () { return window.React; },
    'react-dom/client': function () { return window.ReactDOM; },
    'lucide-react': function () { return makeIconStub(); },
  };

  function normalize(fromDir, spec) {
    if (spec.indexOf('.css') === spec.length - 4) return { css: true };
    var parts = (fromDir ? fromDir.split('/') : []).concat(spec.split('/'));
    var stack = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p === '' || p === '.') continue;
      if (p === '..') stack.pop(); else stack.push(p);
    }
    var base = stack.join('/');
    var candidates = [base, base + '.tsx', base + '.ts'];
    for (var j = 0; j < candidates.length; j++) {
      if (knownFiles.indexOf(candidates[j]) !== -1) return { css: false, path: candidates[j] };
    }
    return null;
  }

  function requireModule(spec, fromDir) {
    if (builtins[spec]) return builtins[spec]();
    var resolved = normalize(fromDir, spec);
    if (!resolved) throw new Error('Cannot resolve "' + spec + '" from "' + fromDir + '"');
    if (resolved.css) return {};
    return loadModule(resolved.path);
  }

  function loadModule(path) {
    if (modules[path]) return modules[path].exports;
    var mod = { exports: {} };
    modules[path] = mod;
    var code = sourceCache[path];
    if (code === undefined) throw new Error('Source not preloaded: ' + path);
    var transformed = window.ts.transpileModule(code, {
      fileName: path,
      compilerOptions: {
        jsx: window.ts.JsxEmit.React,
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment',
        module: window.ts.ModuleKind.CommonJS,
        target: window.ts.ScriptTarget.ES2019,
        esModuleInterop: true,
      },
    }).outputText;
    var dir = path.indexOf('/') === -1 ? '' : path.slice(0, path.lastIndexOf('/'));
    var localRequire = function (s) { return requireModule(s, dir); };
    var fn = new Function('module', 'exports', 'require', transformed);
    fn(mod, mod.exports, localRequire);
    return mod.exports;
  }

  var root = document.getElementById('root');
  Promise.all(
    knownFiles.map(function (p) {
      return fetch('src/' + p).then(function (r) {
        if (!r.ok) throw new Error('Could not fetch src/' + p + ' (HTTP ' + r.status + ')');
        return r.text();
      }).then(function (t) { sourceCache[p] = t; });
    }),
  ).then(function () {
    loadModule('main.tsx');
  }).catch(function (err) {
    console.error(err);
    root.innerHTML = '<pre style="color:#f3a1a1;background:#1a0e10;padding:20px;white-space:pre-wrap;font-family:monospace">' +
      'Preview failed to load:\n' + (err && err.stack ? err.stack : String(err)) + '</pre>';
  });
})();
