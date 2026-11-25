/**
 * Bridge to the Android ConsumerIrManager wrapper. See android IrRemoteController.kt for the
 * real scope/limits: transmit-only, no built-in brand code database, NEC protocol only for now.
 */
import './nativeWindow'; // brings window.MyAirNative / window.__myairOnIrResult into scope

export interface IrTransmitResult { sent: boolean; frequencyHz?: number; patternLength?: number; error?: string }

let seq = 0;
const pending = new Map<string, (r: IrTransmitResult) => void>();
if (typeof window !== 'undefined') {
  window.__myairOnIrResult = (id, json) => {
    const done = pending.get(id);
    if (!done) return;
    pending.delete(id);
    try { done(JSON.parse(json)); } catch { done({ sent: false, error: 'Unreadable response from Android layer.' }); }
  };
}

export function isIrAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.MyAirNative && !!window.MyAirNative.hasInfraredHardware();
}
export function isNativeShell(): boolean {
  return typeof window !== 'undefined' && !!window.MyAirNative;
}
export function supportedFrequencies(): number[] {
  if (!isNativeShell()) return [];
  try { return JSON.parse(window.MyAirNative!.supportedIrFrequencies()); } catch { return []; }
}

function send(payload: object): Promise<IrTransmitResult> {
  if (!isNativeShell()) return Promise.resolve({ sent: false, error: 'Not running in the MyAir Android app.' });
  const id = `ir${++seq}`;
  return new Promise((resolve) => {
    const t = setTimeout(() => { if (pending.delete(id)) resolve({ sent: false, error: 'Timed out waiting for the IR transmitter.' }); }, 5000);
    pending.set(id, (r) => { clearTimeout(t); resolve(r); });
    window.MyAirNative!.transmitIr(id, JSON.stringify(payload));
  });
}

export const transmitNec = (address: number, command: number) => send({ mode: 'nec', address, command });
export const transmitRaw = (frequencyHz: number, pattern: number[]) => send({ mode: 'raw', frequencyHz, pattern });
