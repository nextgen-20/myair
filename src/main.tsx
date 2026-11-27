import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AirVent, Activity, Workflow, Cloud, Home, Plus, Settings, ShieldCheck, Wind, Gauge, ChevronRight, ListChecks, Radio } from 'lucide-react';
import './style.css';
import { useProvider } from './providers/useProvider';
import type { ProviderSnapshot, PurifierProvider, PurifierDevice } from './providers/types';
import { Setup } from './pages/Setup';
import { IntegrationStatus } from './pages/IntegrationStatus';
import { AddRemote } from './pages/AddRemote';
import { AddQubo } from './pages/AddQubo';
import { AirQuality } from './pages/AirQuality';
import { PhaseBanner } from './components/PhaseBanner';
import { Controls } from './components/Controls';
import { QuboPanel } from './components/QuboPanel';
import { connectivityLabel } from './providers/format';
import { QUBO_PROVENANCE } from './providers/qubo/status';
import { useQuboProvider } from './providers/qubo/useQuboProvider';

const nav = [
  ['Dashboard', Home], ['Air Quality', Activity], ['Automations', Workflow], ['Devices', AirVent], ['History', Activity],
  ['Integrations', Cloud], ['Integration status', ListChecks], ['Add Remote', Radio], ['Settings', Settings],
] as const;

/** One device tagged with the specific provider instance that owns it, so Controls can
 * dispatch commands to the right one even when Google Home and Qubo devices are mixed together. */
interface TaggedDevice { device: PurifierDevice; provider: PurifierProvider; sourceLabel: string }

function App() {
  const google = useProvider();
  const qubo = useQuboProvider();
  const [page, setPage] = useState('Dashboard');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('myair-theme') !== 'light');
  useEffect(() => { document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'; localStorage.setItem('myair-theme', darkMode ? 'dark' : 'light'); }, [darkMode]);
  const add = () => setPage('Add Qubo');

  const tagged: TaggedDevice[] = [
    ...google.snapshot.devices.map((device) => ({ device, provider: google.provider, sourceLabel: 'Google Home' })),
    ...qubo.snapshot.devices.map((device) => ({ device, provider: qubo.provider, sourceLabel: 'Qubo' })),
  ];

  return (
    <div className="app">
      <aside>
        <div className="brand"><img className="brandLogo" src="/myair-logo.svg" alt="MyAir" /><span>MyAir</span></div>
        <nav>{nav.map(([n, I]) => (
          <button className={page === n ? 'active' : ''} onClick={() => setPage(n)} key={n}><I size={18} /><span>{n}</span></button>
        ))}</nav>
        <div className="sideFoot"><ShieldCheck size={16} /><span>Local-first control</span></div>
      </aside>
      <main>
        <header>
          <div><div className="eyebrow">AIR INTELLIGENCE</div><h1>{page}</h1></div>
          <div className="actions">
            <button className="themeToggle" aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setDarkMode(v => !v)}>{darkMode ? "☀" : "☾"} <span>{darkMode ? "Light" : "Dark"}</span></button><button className="ghost" onClick={() => setPage('Integration status')}>Connection status</button>
            <button className="primary" onClick={add}><Plus size={17} /> Add device</button>
          </div>
        </header>
        <div className="pageFade" key={page}>
          {page === 'Dashboard' && <Dashboard tagged={tagged} google={google.snapshot} qubo={qubo.snapshot} googleProvider={google.provider} add={add} setPage={setPage} />}
          {page === 'Air Quality' && <AirQuality device={tagged.find((t) => t.device.supported)?.device} />}
          {page === 'Devices' && <Devices tagged={tagged} add={add} />}
          {page === 'Integrations' && <Integrations google={google.snapshot} qubo={qubo.snapshot} setPage={setPage} />}
          {page === 'Setup' && <Setup snapshot={google.snapshot} provider={google.provider} />}
          {page === 'Add Qubo' && <AddQubo snapshot={qubo.snapshot} provider={qubo.provider} />}
          {page === 'Integration status' && <IntegrationStatus snapshot={google.snapshot} provider={google.provider} secondSnapshot={qubo.snapshot} secondProvider={qubo.provider} />}
          {page === 'Add Remote' && <AddRemote />}
          {page === 'Automations' && <Automations tagged={tagged} />}
          {page === 'History' && <History />}
          {page === 'Settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}

function Dashboard({ tagged, google, qubo, googleProvider, add, setPage }: {
  tagged: TaggedDevice[]; google: ProviderSnapshot; qubo: ProviderSnapshot; googleProvider: PurifierProvider; add: () => void; setPage: (p: string) => void;
}) {
  const supported = tagged.filter((t) => t.device.supported);
  const t = supported[0];
  if (!t) {
    return (
      <section className="welcomePage">
        <div className="welcomeGlow" />
        <div className="welcomeContent">
          <div className="welcomeTop">
            <div className="welcomeBrand"><div className="welcomeLogoWrap"><img className="welcomeLogo" src="/myair-logo.svg" alt="MyAir" /></div><div><strong>MyAir</strong><span>SMART AIR</span></div></div>
            <span className="welcomeStatus"><i /> READY</span>
          </div>
          <div className="welcomeHero">
            <span className="welcomeKicker">YOUR AIR. ONE PLACE.</span>
            <h2>Cleaner air,<br /><em>made simple.</em></h2>
            <p className="welcomeLead">Connect your purifier and see its real air quality, power and controls in one clean dashboard.</p>
            <button className="welcomeAdd" onClick={add}><Plus size={19} /> Add Purifier</button>
          </div>
          <div className="welcomePreview">
            <div className="previewRing"><div><strong>—</strong><span>PM2.5</span></div></div>
            <div className="previewCopy"><span>LIVE AIR QUALITY</span><strong>Waiting for purifier</strong><p>No readings are shown until a real device is connected.</p></div>
          </div>
          <div className="welcomeConnections">
            <button className="connectionCard" onClick={() => setPage('Add Qubo')}>
              <div className="connectionIcon qubo"><Wind size={20} /></div>
              <div><span className="connectionEyebrow">RECOMMENDED</span><strong>Connect Qubo</strong><span>Sign in to discover a purifier already configured in the Qubo app.</span></div>
              <ChevronRight size={17} />
            </button>
            <button className="connectionCard" onClick={() => setPage('Integrations')}>
              <div className="connectionIcon home"><Home size={20} /></div>
              <div><span className="connectionEyebrow">OPTIONAL</span><strong>Google Home</strong><span>Use Google Home as another supported connection.</span></div>
              <ChevronRight size={17} />
            </button>
          </div>
          <p className="welcomeNote">First time with Qubo? Configure the purifier in the official Qubo app first, then sign in here.</p>
        </div>
      </section>
    );
  }
  const d = t.device;
  const online = d.connectivity === 'online' || d.connectivity === 'partially_online';
  const isQubo = t.sourceLabel === 'Qubo';
  return (
    <section>
      <PhaseBanner snapshot={google} provider={googleProvider} />
      {isQubo ? (
        <QuboPanel device={d} provider={t.provider} />
      ) : (
        <div className="heroGrid">
          <div className="card air">
            <div className="cardTop">
              <div><span className="label">{d.room ?? t.sourceLabel}{d.model ? ` · ${d.model}` : ''}</span><h2>{d.name}</h2></div>
              <span className={'status ' + (online ? '' : 'bad')}><i /> {connectivityLabel(d.connectivity)}</span>
            </div>
            <div className="gauge" style={d.state.fanPercent != null ? ({ background: `conic-gradient(var(--cyan) 0 ${d.state.fanPercent}%,#153550 ${d.state.fanPercent}% 100%)` }) : undefined}>
              <div>
                <strong>{d.state.fanPercent ?? d.state.fanSpeedLevel ?? '—'}</strong>
                <span>{d.state.fanPercent != null ? '% FAN SPEED' : d.state.fanSpeedLevel != null ? 'FAN SPEED LEVEL' : 'FAN SPEED NOT EXPOSED'}</span>
              </div>
            </div>
            <div className="quality">
              {d.state.power === true ? 'Running' : d.state.power === false ? 'Off' : 'Power state not reported'}
              {' · '}{d.state.pm25 != null ? `PM2.5 ${d.state.pm25} µg/m³` : 'PM2.5 not exposed by this device'}
              {d.state.filterLifePercent != null && ` · Filter ${d.state.filterLifePercent}%`}
            </div>
          </div>
          <Controls device={d} provider={t.provider} />
        </div>
      )}
      <div className="card brain">
        <div className="brainIcon"><Gauge size={20} /></div>
        <div>
          <span className="label">MYAIR BRAIN</span>
          <h3>Automation engine ready</h3>
          <p>Rules will only run on real events from connected providers. No synthetic readings are used.</p>
        </div>
        <ChevronRight />
      </div>
    </section>
  );
}

function Devices({ tagged, add }: { tagged: TaggedDevice[]; add: () => void }) {
  return (
    <section>
      <div className="sectionHead">
        <div><span className="label">CONNECTED HARDWARE</span><h2>Devices</h2></div>
        <button className="primary" onClick={add}><Plus size={17} /> Add device</button>
      </div>
      {tagged.length === 0 ? (
        <div className="empty compact"><AirVent size={24} /><h3>No devices</h3><p>Connect Google Home or your Qubo account to discover purifiers.</p></div>
      ) : tagged.map(({ device: d, sourceLabel }) => (
        <div className="device card" key={`${sourceLabel}:${d.id}`}>
          <div className="deviceIcon"><AirVent /></div>
          <div className="deviceInfo">
            <h3>{d.name}{d.model ? ` (${d.model})` : ''}</h3>
            <p>{sourceLabel} · {d.room ?? 'Room not reported'} · {d.supported ? 'Air purifier' : 'Unsupported device'}</p>
            {!d.supported && d.unsupportedReason && <p className="warn">{d.unsupportedReason}</p>}
          </div>
          <span className={'status ' + (d.connectivity === 'offline' ? 'bad' : '')}><i /> {connectivityLabel(d.connectivity)}</span>
        </div>
      ))}
    </section>
  );
}

function Integrations({ google, qubo, setPage }: { google: ProviderSnapshot; qubo: ProviderSnapshot; setPage: (p: string) => void }) {
  const googleReady = google.phase === 'ready';
  const quboReady = qubo.phase === 'ready';
  return (
    <section>
      <div className="sectionHead"><div><span className="label">SUPPORTED BRIDGES</span><h2>Integrations</h2></div></div>
      <div className="integration card">
        <div className="intIcon"><Home /></div>
        <div>
          <h3>Google Home</h3>
          <p>Uses the official Google Home Home APIs (Android) to discover and control purifiers in your Google Home account.</p>
          <span className={'pill' + (googleReady ? '' : ' muted')}>{googleReady ? 'PERMISSION GRANTED' : 'SETUP REQUIRED'}</span>
        </div>
        <button className="primary" onClick={() => setPage(googleReady ? 'Integration status' : 'Setup')}>{googleReady ? 'View status' : 'Set up'}</button>
      </div>
      <div className="integration card">
        <div className="intIcon"><Wind /></div>
        <div>
          <h3>Qubo</h3>
          <p>Signs in with your own Qubo account over Qubo's real cloud API. Implemented from a verified community protocol description — not yet hardware-tested by MyAir. See Settings for details.</p>
          <span className={'pill' + (quboReady ? '' : ' muted')}>{quboReady ? 'SIGNED IN' : 'SIGN-IN REQUIRED'}</span>
        </div>
        <button className="primary" onClick={() => setPage('Add Qubo')}>{quboReady ? 'Manage' : 'Sign in'}</button>
      </div>
      <div className="integration card">
        <div className="intIcon"><Radio /></div>
        <div>
          <h3>Add Remote (infrared)</h3>
          <p>Sends real infrared signals on phones with an IR blaster. Separate feature from purifier control — not a Qubo integration.</p>
          <span className="pill muted">NO BUILT-IN CODE DATABASE</span>
        </div>
        <button className="primary" onClick={() => setPage('Add Remote')}>Open</button>
      </div>
    </section>
  );
}

function Automations({ tagged }: { tagged: TaggedDevice[] }) {
  const has = tagged.some((t) => t.device.supported);
  return (
    <section>
      <div className="sectionHead"><div><span className="label">AUTOMATION ENGINE</span><h2>Rules</h2></div><button className="primary" disabled={!has}><Plus size={17} /> New rule</button></div>
      <div className="empty compact"><Workflow size={25} /><h3>{has ? 'No rules yet' : 'Connect a device first'}</h3><p>{has ? 'Rule creation is not implemented yet.' : 'Automations cannot run until MyAir has a real device event source.'}</p></div>
    </section>
  );
}
function History() {
  return <section><div className="empty compact"><Activity size={25} /><h3>No sensor history</h3><p>History will appear after a real connected device sends readings. MyAir does not generate placeholder measurements.</p></div></section>;
}
function SettingsPage() {
  return (
    <section>
      <div className="card settings"><h2>MyAir settings</h2>
        <div className="setting"><div><h3>Demo data</h3><p>Disabled permanently in this build. Device readings come only from connected providers.</p></div><span className="off">OFF</span></div>
        <div className="setting"><div><h3>Device cache</h3><p>MyAir does not cache device state. Everything shown is read live from connected providers.</p></div><ShieldCheck /></div>
      </div>
      <div className="card settings stat">
        <h2>Integrations → Qubo → About</h2>
        <p className="lead">This is an independent app. It is not affiliated with, endorsed by, or provided by Qubo / Hero Electronix.</p>
        <p className="lead">{QUBO_PROVENANCE.summary}</p>
        <div className="label" style={{ marginTop: 14 }}>IMPLEMENTED FROM</div>
        <ul className="steps">{QUBO_PROVENANCE.implementedFrom.map((c) => <li key={c}>{c}</li>)}</ul>
        <div className="label">CONFIRMED BY HARDWARE TESTS (by community contributors, not MyAir)</div>
        <ul className="steps">{QUBO_PROVENANCE.confirmedByHardwareTests.map((c) => <li key={c}>{c}</li>)}</ul>
        <div className="label">NOT VERIFIED BY MYAIR</div>
        <ul className="steps">{QUBO_PROVENANCE.notVerifiedByMyAir.map((c) => <li key={c}>{c}</li>)}</ul>
        <div className="label">OPEN-SOURCE REFERENCES</div>
        <ul className="steps">{QUBO_PROVENANCE.sources.map((s) => <li key={s.url}><a className="srcLink" href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}</ul>
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
