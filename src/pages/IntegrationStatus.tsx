import type { ProviderSnapshot, PurifierProvider } from '../providers/types';
import { PhaseBanner } from '../components/PhaseBanner';
import { connectivityLabel, formatTime } from '../providers/format';

function ProviderBlock({ snapshot, provider }: { snapshot: ProviderSnapshot; provider: PurifierProvider }) {
  return (
    <>
      <div className="sectionHead">
        <div><span className="label">PROVIDER</span><h2>{snapshot.provider}</h2></div>
        <button className="ghost" onClick={() => provider.refresh()} disabled={snapshot.phase === 'unsupported-platform'}>Refresh from {snapshot.provider}</button>
      </div>
      <div className="card settings">
        <div className="kv"><span>Provider state</span><b>{snapshot.phase}</b></div>
        <div className="kv"><span>Devices returned</span><b>{snapshot.devices.length}</b></div>
        {snapshot.message && <div className="kv"><span>Message</span><b>{snapshot.message}</b></div>}
      </div>
      {snapshot.devices.length === 0 && snapshot.phase === 'ready' && (
        <div className="empty compact"><h3>Access granted, but no devices were returned</h3><p>{snapshot.provider} returned no devices for the account/structure you authorized.</p></div>
      )}
      {snapshot.devices.map((d) => (
        <div className="card settings stat" key={d.id}>
          <h3>{d.name}{d.model ? ` (${d.model})` : ''}</h3>
          <div className="kv"><span>Provider</span><b>{snapshot.provider}</b></div>
          <div className="kv"><span>Device name</span><b>{d.name}</b></div>
          <div className="kv"><span>Model</span><b>{d.model ?? 'Not reported'}</b></div>
          <div className="kv"><span>Room</span><b>{d.room ?? 'Not reported'}</b></div>
          <div className="kv"><span>Online / offline</span><b>{connectivityLabel(d.connectivity)}</b></div>
          <div className="kv"><span>Support</span><b>{d.supported ? 'Supported air purifier' : `Unsupported — ${d.unsupportedReason ?? 'unknown reason'}`}</b></div>
          <div className="kv"><span>Supported traits/services</span><b>{d.traits.length ? d.traits.join(', ') : 'None reported'}</b></div>
          <div className="kv"><span>Controls MyAir enables</span><b>{[
            d.controls.power && 'Power',
            d.controls.fanMode && 'Fan mode',
            d.controls.fanPercent && 'Fan speed %',
            d.controls.fanSpeedLevel && 'Fan speed level',
            d.controls.childLock && 'Child lock',
          ].filter(Boolean).join(', ') || 'None'}</b></div>
          <div className="kv"><span>Last confirmed state</span><b>
            {d.lastConfirmedAt == null ? 'Never read' : (
              `${formatTime(d.lastConfirmedAt)} — power: ${d.state.power ?? 'n/a'}, fan mode: ${d.state.fanMode ?? 'n/a'}, ` +
              `fan %: ${d.state.fanPercent ?? 'n/a'}, fan level: ${d.state.fanSpeedLevel ?? 'n/a'}, ` +
              `PM2.5: ${d.state.pm25 ?? 'n/a'}, filter life: ${d.state.filterLifePercent != null ? `${d.state.filterLifePercent}%` : 'n/a'}, ` +
              `child lock: ${d.state.childLockOn ?? 'n/a'}`
            )}
          </b></div>
        </div>
      ))}
    </>
  );
}

export function IntegrationStatus({ snapshot, provider, secondSnapshot, secondProvider }: {
  snapshot: ProviderSnapshot; provider: PurifierProvider;
  secondSnapshot?: ProviderSnapshot; secondProvider?: PurifierProvider;
}) {
  return (
    <section>
      <PhaseBanner snapshot={snapshot} provider={provider} />
      <ProviderBlock snapshot={snapshot} provider={provider} />
      {secondSnapshot && secondProvider && <ProviderBlock snapshot={secondSnapshot} provider={secondProvider} />}
    </section>
  );
}
