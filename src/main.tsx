import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AirVent, Activity, Workflow, Cloud, Home, Plus, Settings, ShieldCheck, Wind, Gauge, ChevronRight, ChevronLeft, ListChecks, Radio, Bell, Clock3, Building2, Lightbulb, SlidersHorizontal, Filter, Zap } from 'lucide-react';
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
import { AirIllustration, NoDeviceIcon } from './components/AirIllustration';
import { connectivityLabel } from './providers/format';
import { QUBO_PROVENANCE } from './providers/qubo/status';
import { useQuboProvider } from './providers/qubo/useQuboProvider';

/** The 3 primary destinations shown in the bottom tab bar, matching the reference
 * screenshot exactly. Every other page is still fully implemented and reachable
 * from Settings -> "More" (or an in-context link), it's just not in the tab bar. */
const bottomTabs = [
  ['Dashboard', 'Home', Home], ['Add Remote', 'Add Remote', Radio], ['History', 'History', Activity],
] as const;

const moreLinks = [
  ['Air Quality', Activity, 'Indoor vs outdoor AQI and PM2.5 history'],
  ['Devices', AirVent, 'All discovered devices across every provider'],
  ['Rooms', Building2, 'Connected purifiers grouped by room'],
  ['Alerts', Bell, 'Notifications based on real device events'],
  ['Automations', Workflow, 'Routines that react to real device events'],
  ['Integrations', Cloud, 'Qubo and Google Home connection status'],
  ['Integration status', ListChecks, 'Detailed provider/connection diagnostics'],
] as const;

/** One device tagged with the specific provider instance that owns it, so Controls can
 * dispatch commands to the right one even when Google Home and Qubo devices are mixed together. */
interface TaggedDevice { device: PurifierDevice; provider: PurifierProvider; sourceLabel: string }

function App() {
  const google = useProvider();
  const qubo = useQuboProvider();
  const [page, setPage] = useState('Dashboard');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('myair-theme') === 'dark');
  useEffect(() => { document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'; localStorage.setItem('myair-theme', darkMode ? 'dark' : 'light'); }, [darkMode]);
  const add = () => setPage('Add Qubo');

  const tagged: TaggedDevice[] = [
    ...google.snapshot.devices.map((device) => ({ device, provider: google.provider, sourceLabel: 'Google Home' })),
    ...qubo.snapshot.devices.map((device) => ({ device, provider: qubo.provider, sourceLabel: 'Qubo' })),
  ];

  const isHome = page === 'Dashboard';
  return (
    <div className="phoneApp">
      <header className="topBar">
        {isHome ? (
          <>
            <div className="brand"><img className="brandLogo" src="./myair-logo.svg" alt="MyAir" /><span><b>My</b>Air</span></div>
            <button className="gearBtn" aria-label="Settings" onClick={() => setPage('Settings')}><Settings size={19} /></button>
          </>
        ) : (
          <>
            <button className="backBtn" aria-label="Back to Home" onClick={() => setPage('Dashboard')}><ChevronLeft size={20} /></button>
            <span className="topBarTitle">{page}</span>
            <button className="themeToggle" aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setDarkMode(v => !v)}>{darkMode ? "☀" : "☾"}</button>
          </>
        )}
      </header>
      <main className="phoneMain">
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
          {page === 'Alerts' && <Alerts tagged={tagged} />}
          {page === 'Rooms' && <Rooms tagged={tagged} />}
          {page === 'History' && <History />}
          {page === 'Settings' && <SettingsPage setPage={setPage} />}
        </div>
      </main>
      <nav className="bottomTabs">
        {bottomTabs.map(([key, label, I]) => (
          <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}>
            <I size={21} /><span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Dashboard({ tagged, google, qubo, googleProvider, add, setPage }: {
  tagged: TaggedDevice[]; google: ProviderSnapshot; qubo: ProviderSnapshot; googleProvider: PurifierProvider; add: () => void; setPage: (p: string) => void;
}) {
  const supported = tagged.filter((t) => t.device.supported);
  const t = supported[0];
  if (!t) {
    const googleUnavailable = google.phase === 'error' || google.phase === 'unsupported-platform';
    return (
      <section className="welcomePage">
        <div className="welcomeHero">
          <h2>Your air,<br /><em>under control.</em></h2>
          <p className="welcomeTagline">Clean &bull; Healthy &bull; Fresh</p>
          <AirIllustration />
        </div>
        <div className="noDeviceCard">
          <div className="noDeviceIconWrap"><NoDeviceIcon /></div>
          <h3>No purifier connected</h3>
          <p>Add your Qubo purifier to get started</p>
          <button className="welcomeAdd" onClick={add}><Plus size={19} /> Add Purifier</button>
        </div>
        <h4 className="connectHeading">Connect with</h4>
        <div className="welcomeConnections">
          <button className="connectionCard" onClick={() => setPage('Add Qubo')}>
            <div className="connectionIcon qubo">Qubo</div>
            <div><strong>Qubo</strong><span>Sign in and discover your purifier</span></div>
            <ChevronRight size={17} />
          </button>
          {googleUnavailable ? (
            <button className="connectionCard disabled" disabled title={google.message ?? 'Google Home is set aside in this build.'}>
              <div className="connectionIcon home"><Home size={18} /></div>
              <div><strong>Google Home</strong><span>Coming soon</span></div>
            </button>
          ) : (
            <button className="connectionCard" onClick={() => setPage('Setup')}>
              <div className="connectionIcon home"><Home size={18} /></div>
              <div><strong>Google Home</strong><span>Connect your Google Home account</span></div>
              <ChevronRight size={17} />
            </button>
          )}
        </div>
        <div className="infoBanner">
          <span className="infoDot">i</span>
          <div><strong>Already configured your purifier in Qubo?</strong><p>Sign in to the same Qubo account and MyAir will find it.</p></div>
        </div>
      </section>
    );
  }
  const d = t.device;
  const online = d.connectivity === 'online' || d.connectivity === 'partially_online';
  const isQubo = t.sourceLabel === 'Qubo';
  return (
    <section>
      {/* Only show a provider's own banner when it owns the device on screen — showing
          Google Home's permanent "unavailable in this build" error above a connected
          Qubo purifier was confusing and pushed the whole panel down for no reason. */}
      {!isQubo && <PhaseBanner snapshot={google} provider={googleProvider} />}
      {isQubo ? (
        <QuboPanel device={d} provider={t.provider} onBack={() => setPage('Devices')} />
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

function FeatureHeader({ eyebrow, title, description, icon: Icon }: { eyebrow: string; title: string; description: string; icon: React.ComponentType<{ size?: number }> }) {
  return <div className="featureHeader"><div className="featureIcon"><Icon size={21} /></div><div><span className="label">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div></div>;
}
function Alerts({ tagged }: { tagged: TaggedDevice[] }) {
  const connected = tagged.some((t) => t.device.supported);
  const rules = [['Poor air quality','Notify when PM2.5 enters the Poor range',Bell],['Purifier offline','Notify when a connected purifier loses connection',Zap],['Filter attention','Notify when reported filter life needs attention',Filter]] as const;
  return <section><FeatureHeader eyebrow="SMART ALERTS" title="Stay ahead of your air" description="Set notifications around real readings and real device state. Nothing is generated when a purifier is disconnected." icon={Bell} /><div className="featureGrid"><div className="card featureHeroCard"><span className="label">ALERT CENTER</span><h3>{connected?'Ready for real device events':'Connect a purifier first'}</h3><p>{connected?'Your alerts can react to the connected purifier’s reported air quality and connectivity.':'Once a Qubo purifier is connected, MyAir can use its reported state for alerts.'}</p><div className={'featureStatus '+(connected?'ready':'waiting')}><i /> {connected?'DEVICE CONNECTED':'WAITING FOR DEVICE'}</div></div><div className="card featureList">{rules.map(([name,copy,Icon])=><div className="featureRow" key={name}><div className="featureRowIcon"><Icon size={18}/></div><div><strong>{name}</strong><span>{copy}</span></div><span className="switch"><i /></span></div>)}</div></div><div className="card setupCard"><SlidersHorizontal size={18}/><div><strong>Alert settings</strong><span>Thresholds, quiet hours and notification preferences will use values reported by the connected device.</span></div><ChevronRight size={17}/></div></section>;
}
function Rooms({ tagged }: { tagged: TaggedDevice[] }) {
  const supported=tagged.filter(t=>t.device.supported);
  return <section><FeatureHeader eyebrow="HOME OVERVIEW" title="Rooms" description="See every connected purifier by room and keep a quick view of the air in your home." icon={Building2} />{supported.length===0?<div className="empty compact"><Building2 size={25}/><h3>No rooms yet</h3><p>Add a real Qubo purifier and its reported room will appear here. MyAir will not invent room names or readings.</p></div>:<div className="roomGrid">{supported.map(({device:d,sourceLabel})=><div className="card roomCard" key={d.id}><div className="roomTop"><div className="roomIcon"><AirVent size={20}/></div><span className="status"><i /> {d.connectivity}</span></div><span className="label">{d.room??'ROOM NOT REPORTED'}</span><h3>{d.name}</h3><div className="roomMetric">{d.state.pm25!=null?<><strong>{d.state.pm25}</strong><span>µg/m³ PM2.5</span></>:<><strong>—</strong><span>PM2.5 not reported</span></>}</div><div className="roomMeta">{sourceLabel}{d.model? ` · ${d.model}`:''}</div></div>)}</div>}</section>;
}
function Automations({ tagged }: { tagged: TaggedDevice[] }) {
  const has=tagged.some(t=>t.device.supported);
  const routines=[['Sleep routine','Set a quieter overnight mode when supported by the device',Clock3],['High pollution','React to a real PM2.5 threshold from the purifier',Wind],['Morning air','Create a morning routine around your connected purifier',Zap]] as const;
  return <section><FeatureHeader eyebrow="AUTOMATION ENGINE" title="Routines" description="Create simple air routines around real purifier capabilities. Execution stays disabled until each capability is wired." icon={Workflow}/><div className="routineGrid">{routines.map(([name,copy,Icon])=><div className="card routineCard" key={name}><div className="routineIcon"><Icon size={20}/></div><span className="label">ROUTINE</span><h3>{name}</h3><p>{copy}</p><button className="ghost" disabled={!has}><Plus size={15}/> Configure</button></div>)}</div><div className="card automationNote"><Lightbulb size={19}/><div><strong>Ready for real automation</strong><span>MyAir will only execute a routine when the provider exposes the required control or reading.</span></div></div></section>;
}
function History() {
  return <section><FeatureHeader eyebrow="AIR HISTORY" title="Your air over time" description="A timeline for real PM2.5 readings, purifier activity and indoor/outdoor comparison." icon={Activity}/><div className="historyTabs"><button className="active">Today</button><button>7 days</button><button>30 days</button></div><div className="card chartCard"><div className="chartTop"><div><span className="label">PM2.5 TREND</span><h3>Waiting for sensor history</h3></div><span className="pill muted">NO DATA</span></div><div className="chartEmpty"><Activity size={22}/><span>Real readings will be plotted here after MyAir receives them.</span></div></div><div className="metricGrid"><div className="card miniMetric"><span>BEST PERIOD</span><strong>—</strong><small>No recorded readings</small></div><div className="card miniMetric"><span>WORST PERIOD</span><strong>—</strong><small>No recorded readings</small></div><div className="card miniMetric"><span>PURIFIER IMPACT</span><strong>—</strong><small>Requires enough real history</small></div></div></section>;
}
function SettingsPage({ setPage }: { setPage: (p: string) => void }) {
  return (
    <section>
      <h4 className="connectHeading" style={{ marginTop: 6 }}>More</h4>
      <div className="moreGrid">
        {moreLinks.map(([label, I, desc]) => (
          <button key={label} className="moreLink" onClick={() => setPage(label)}>
            <div className="moreIcon"><I size={19} /></div>
            <div><strong>{label}</strong><span>{desc}</span></div>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
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
