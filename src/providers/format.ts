import type { Connectivity } from './types';
export function connectivityLabel(c: Connectivity): string {
  switch (c) {
    case 'online': return 'Online';
    case 'partially_online': return 'Online (partial)';
    case 'offline': return 'Offline';
    default: return 'Status unknown';
  }
}
export function formatTime(ms: number | null): string {
  return ms == null ? 'Never read' : new Date(ms).toLocaleString();
}
