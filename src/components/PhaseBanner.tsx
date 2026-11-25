import type { ProviderSnapshot, PurifierProvider } from '../providers/types';

/** Shows loading / permission-denied / error / unsupported-platform states. Renders nothing when ready. */
export function PhaseBanner({ snapshot, provider }: { snapshot: ProviderSnapshot; provider: PurifierProvider }) {
  const { phase, message, provider: name } = snapshot;
  if (phase === 'ready') return null;
  const title: Record<string, string> = {
    'unsupported-platform': 'Not running in the MyAir Android app',
    loading: `Loading from ${name}…`,
    'needs-permission': `${name} access not granted yet`,
    'permission-denied': 'Permission denied or cancelled',
    error: `${name} error`,
  };
  return (
    <div className={'notice' + (phase === 'loading' ? '' : ' warnBox')} role="status">
      <div><strong>{title[phase]}</strong>{message ? ` — ${message}` : ''}</div>
      {(phase === 'needs-permission' || phase === 'permission-denied') && (
        <button className="ghost" onClick={() => provider.requestPermissions()}>Grant access</button>
      )}
      {phase === 'error' && <button className="ghost" onClick={() => provider.refresh()}>Retry</button>}
    </div>
  );
}
