import { useEffect, useMemo, useState } from 'react';
import { createProvider } from './nativeProvider';
import type { ProviderSnapshot, PurifierProvider } from './types';

export function useProvider(): { provider: PurifierProvider; snapshot: ProviderSnapshot } {
  const provider = useMemo(() => createProvider(), []);
  const [snapshot, setSnapshot] = useState(provider.getSnapshot());
  useEffect(() => provider.subscribe(setSnapshot), [provider]);
  return { provider, snapshot };
}
