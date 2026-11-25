# web-preview (sandbox-only helper, not the real build)

This folder exists only because the sandbox this was built in has no network access to the
npm registry, so `npm install`/`npm run build` (the real build — see the project's own
`package.json`/`vite.config.ts`) could not run here at all.

`loader.js` + `index.html` fetch the real, unmodified files under `../src/` at runtime and
transpile them in the browser with the TypeScript compiler's own browser bundle
(`typescript.js`, the `tsc`/`ts.transpileModule` entry point — not included in this zip to
keep it small; copy it from `node_modules/typescript/lib/typescript.js` once you've run
`npm install`, or any copy of TypeScript 5.x's `typescript.js`), so the actual project source
runs without a bundling step.

**In a normal environment with network access, ignore this folder** and just run:
```
npm install
npm run build   # produces dist/, which Android's Gradle syncWebAssets task packages
```

This was used to produce a one-off hosted preview (a Claude Artifact) when real `npm install`
wasn't possible, and to give Android's `syncWebAssets` Gradle task something to copy from
`../dist` so the one network-dependent build step (the Android Gradle Plugin itself) could be
isolated and tested on its own. It is not a replacement for the real Vite build.
