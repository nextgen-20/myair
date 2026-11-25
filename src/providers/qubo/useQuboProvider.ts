import { useEffect, useMemo, useState } from 'react';
import { createQuboProvider, type QuboPurifierProvider } from './nativeQuboProvider';
import type { ProviderSnapshot } from '../types';

export function useQuboProvider(): { provider: QuboPurifierProvider; snapshot: ProviderSnapshot } {
  const provider = useMemo(() => createQuboProvider(), []);
  const [snapshot, setSnapshot] = useState(provider.getSnapshot());
  useEffect(() => provider.subscribe(setSnapshot), [provider]);
  return { provider, snapshot };
}
