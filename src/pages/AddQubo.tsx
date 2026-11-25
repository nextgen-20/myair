import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ShieldCheck, LogOut, Wind } from 'lucide-react';
import type { ProviderSnapshot } from '../providers/types';
import type { QuboPurifierProvider } from '../providers/qubo/nativeQuboProvider';
import { PhaseBanner } from '../components/PhaseBanner';
import { Controls } from '../components/Controls';
import { connectivityLabel } from '../providers/format';

/**
 * Add Device -> Qubo -> Qubo Login -> Discover Devices -> Select -> Purifier Dashboard.
 * Qubo has no OAuth/permission-screen flow like Google Home — it is a plain account
 * sign-in against Qubo's own cloud API (see QuboProvider.kt / docs/QUBO_PROTOCOL.md).
 */
export function AddQubo({ snapshot, provider }: { snapshot: ProviderSnapshot; provider: QuboPurifierProvider }) {
  const native = snapshot.phase !== 'unsupported-platform';
  const signedIn = snapshot.phase === 'ready' || (snapshot.phase === 'loading' && snapshot.devices.length > 0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await provider.signIn(email, password);
      if (!r.accepted) setErr(r.error ?? 'Sign-in was not accepted by Qubo.');
      else setPassword('');
    } catch (ex) { setErr(String(ex)); }
    finally { setBusy(false); }
  };

  if (!native) {
    return (
      <section>
        <div className="card settings">
          <span className="label">QUBO</span>
          <h2>Not available here</h2>
          <p className="lead">The Qubo provider only runs inside the MyAir Android app, where it can reach Qubo's cloud API and store your session securely.</p>
        </div>
      </section>
    );
  }

  if (!signedIn) {
    return (
      <section>
        <PhaseBanner snapshot={snapshot} provider={provider} />
        <div className="card settings">
          <span className="label">ADD DEVICE · QUBO</span>
          <h2>Sign in with your Qubo account</h2>
          <p className="lead">MyAir sends your email and password directly to Qubo's own cloud API over TLS, the same way the official Qubo app does. MyAir never sees or stores your password — only the access/refresh tokens Qubo issues back, kept in Android's encrypted storage.</p>
          <p className="lead small"><strong>This discovers purifiers already set up on your Qubo account.</strong> It does not set up a brand-new, factory/unconfigured purifier — first-time Wi-Fi pairing for a new device is not implemented here; use the official Qubo app for that, then come back here to control it.</p>
          <form onSubmit={submit} className="formGrid">
            <label>Email<input type="email" required value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} autoComplete="username" /></label>
            <label>Password<input type="password" required value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} autoComplete="current-password" /></label>
            <button className="primary" type="submit" disabled={busy}><ShieldCheck size={17} /> {busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          {err && <div className="fb err">{err}</div>}
          <p className="lead small">This app is independent and not affiliated with, endorsed by, or provided by Qubo / Hero Electronix. See Settings for what has and hasn't been verified against real hardware.</p>
        </div>
      </section>
    );
  }

  if (snapshot.devices.length === 0) {
    return (
      <section>
        <PhaseBanner snapshot={snapshot} provider={provider} />
        <div className="empty compact">
          <Wind size={25} />
          <h3>Signed in — no devices found</h3>
          <p>Your Qubo account has no discoverable devices, or none reported a model yet. Try refreshing from Integration status, or check the device in the Qubo app first.</p>
          <button className="ghost" onClick={() => provider.signOut()}><LogOut size={16} /> Sign out</button>
        </div>
      </section>
    );
  }

  const chosen = snapshot.devices.find((d) => d.id === selected) ?? null;

  return (
    <section>
      <PhaseBanner snapshot={snapshot} provider={provider} />
      <div className="sectionHead">
        <div><span className="label">DISCOVERED FROM YOUR QUBO ACCOUNT</span><h2>Select a purifier</h2></div>
        <button className="ghost" onClick={() => provider.signOut()}><LogOut size={16} /> Sign out</button>
      </div>
      {snapshot.devices.map((d) => (
        <div className={'device card clickable' + (selected === d.id ? ' sel' : '')} key={d.id} onClick={() => setSelected(d.id)}>
          <div className="deviceIcon"><Wind /></div>
          <div className="deviceInfo">
            <h3>{d.name}{d.model ? ` (${d.model})` : ''}</h3>
            <p>{d.supported ? 'Air purifier' : `Not supported${d.unsupportedReason ? ` — ${d.unsupportedReason}` : ''}`}</p>
          </div>
          <span className={'status ' + (d.connectivity === 'offline' ? 'bad' : '')}><i /> {connectivityLabel(d.connectivity)}</span>
        </div>
      ))}
      {chosen && chosen.supported && (
        <>
          <div className="sectionHead"><div><span className="label">CONNECTED</span><h2>{chosen.name}</h2></div></div>
          <Controls device={chosen} provider={provider} />
        </>
      )}
      {chosen && !chosen.supported && (
        <div className="empty compact"><h3>This device isn't supported</h3><p>{chosen.unsupportedReason ?? 'MyAir only controls Qubo air purifiers reporting an HPH model.'}</p></div>
      )}
    </section>
  );
}
