import { ShieldCheck } from 'lucide-react';
import type { ProviderSnapshot, PurifierProvider } from '../providers/types';
import { PhaseBanner } from '../components/PhaseBanner';

export function Setup({ snapshot, provider }: { snapshot: ProviderSnapshot; provider: PurifierProvider }) {
  const native = snapshot.phase !== 'unsupported-platform';
  return (
    <section>
      <PhaseBanner snapshot={snapshot} provider={provider} />
      <div className="card settings">
        <span className="label">GOOGLE HOME SETUP</span>
        <h2>What you are authorizing</h2>
        <p className="lead">MyAir will open Google's own permission screen. Nothing is shared until you approve it there.</p>
        <ol className="steps">
          <li><strong>Sign in with a Google Account</strong> that owns or has access to your Google Home. While MyAir is an unverified test app, that account must be listed as a <em>test user</em> on the OAuth consent screen of the Google Cloud project.</li>
          <li><strong>Choose one home (“structure”).</strong> Google grants access per structure, and the app can hold access to only one structure at a time.</li>
          <li><strong>Choose which devices to share.</strong> MyAir can read and control only the devices Google shows you on that screen.</li>
          <li><strong>What MyAir does with access:</strong> reads device names, rooms, online/offline status and the state of the traits each purifier exposes; and sends power/fan commands only when you press a control.</li>
          <li><strong>What MyAir does not do:</strong> it does not use cloud-to-cloud linking, does not talk to any manufacturer API, and does not store device state — everything is read live.</li>
        </ol>
        <p className="lead small">You can revoke access any time in the Google Home app or your Google Account’s third-party access settings.</p>
        <button className="primary" disabled={!native || snapshot.phase === 'loading'} onClick={() => provider.requestPermissions()}>
          <ShieldCheck size={17} /> {snapshot.phase === 'ready' ? 'Re-run Google permission flow' : 'Continue to Google Home permissions'}
        </button>
        {!native && <p className="lead small">This button is disabled because you are not in the Android app.</p>}
      </div>
    </section>
  );
}
