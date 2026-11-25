import type { CommandResult, ProviderSnapshot, PurifierProvider, Unsubscribe } from './types';
import type { NativeApi } from './nativeWindow';
import './nativeWindow'; // brings window.MyAirNative into scope

/**
 * Talks to the Android shell (MainActivity), which owns the Google Home Home APIs client.
 * The shell exposes `window.MyAirNative` (JS interface) and calls `window.__myairOnSnapshot(json)`
 * whenever the Home APIs state changes.
 */

const PROVIDER = 'Google Home (Home APIs)';
const UNSUPPORTED: ProviderSnapshot = {
  provider: PROVIDER,
  phase: 'unsupported-platform',
  message:
    'Google Home Home APIs only work inside the MyAir Android app. This page is running in a regular browser, so no devices can be discovered or controlled.',
  devices: [],
};

export function isNativeAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.MyAirNative;
}

export function createProvider(): PurifierProvider {
  if (!isNativeAvailable()) return new UnavailableProvider();
  return new NativeBridgeProvider(window.MyAirNative!);
}

class UnavailableProvider implements PurifierProvider {
  getSnapshot() { return UNSUPPORTED; }
  subscribe(): Unsubscribe { return () => {}; }
  async requestPermissions() {}
  async refresh() {}
  private fail(): CommandResult { return { accepted: false, confirmed: false, error: UNSUPPORTED.message }; }
  async setPower() { return this.fail(); }
  async setFanMode() { return this.fail(); }
  async setFanPercent() { return this.fail(); }
  async setFanSpeedLevel() { return this.fail(); }
  async setChildLock() { return this.fail(); }
}

class NativeBridgeProvider implements PurifierProvider {
  private snap: ProviderSnapshot;
  private listeners = new Set<(s: ProviderSnapshot) => void>();
  private pending = new Map<string, (r: CommandResult) => void>();
  private seq = 0;

  constructor(private native: NativeApi) {
    this.snap = this.parse(native.getSnapshot());
    window.__myairOnSnapshot = (json) => this.set(this.parse(json));
    window.__myairOnCommand = (id, json) => {
      const done = this.pending.get(id);
      if (!done) return;
      this.pending.delete(id);
      try { done(JSON.parse(json) as CommandResult); }
      catch { done({ accepted: false, confirmed: false, error: 'Unreadable response from Android layer.' }); }
    };
  }

  private parse(json: string): ProviderSnapshot {
    try { return JSON.parse(json) as ProviderSnapshot; }
    catch {
      return { provider: PROVIDER, phase: 'error', message: 'Unreadable response from Android layer.', devices: [] };
    }
  }
  private set(s: ProviderSnapshot) { this.snap = s; this.listeners.forEach((l) => l(s)); }

  getSnapshot() { return this.snap; }
  subscribe(l: (s: ProviderSnapshot) => void): Unsubscribe { this.listeners.add(l); return () => this.listeners.delete(l); }
  async requestPermissions() { this.native.requestPermissions(); }
  async refresh() { this.native.refresh(); }

  private send(payload: object): Promise<CommandResult> {
    const id = `c${++this.seq}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) resolve({ accepted: false, confirmed: false, error: 'No response from the Home API (timed out). State is unknown.' });
      }, 20000);
      this.pending.set(id, (r) => { clearTimeout(timer); resolve(r); });
      this.native.command(id, JSON.stringify(payload));
    });
  }
  setPower(deviceId: string, on: boolean) { return this.send({ type: 'power', deviceId, on }); }
  setFanMode(deviceId: string, modeId: string) { return this.send({ type: 'fanMode', deviceId, modeId }); }
  setFanPercent(deviceId: string, percent: number) { return this.send({ type: 'fanPercent', deviceId, percent }); }
  async setFanSpeedLevel(): Promise<CommandResult> { return { accepted: false, confirmed: false, error: 'Not supported by Google Home in this app.' }; }
  async setChildLock(): Promise<CommandResult> { return { accepted: false, confirmed: false, error: 'Not supported by Google Home in this app.' }; }
}
