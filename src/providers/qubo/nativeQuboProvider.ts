import type { CommandResult, CredentialAuthProvider, ProviderSnapshot, PurifierProvider, Unsubscribe } from '../types';
import type { NativeApi } from '../nativeWindow';
import '../nativeWindow';

/**
 * Talks to the Android shell's Qubo channel (QuboProvider.kt via NativeBridge.kt's qubo* methods).
 * Entirely separate bridge channel from Google Home — see docs/QUBO_PROTOCOL.md for what this
 * provider actually does and how it was verified.
 */
const PROVIDER = 'Qubo (community cloud protocol)';
const UNSUPPORTED: ProviderSnapshot = {
  provider: PROVIDER,
  phase: 'unsupported-platform',
  message: 'The Qubo provider only works inside the MyAir Android app.',
  devices: [],
};

export type QuboPurifierProvider = PurifierProvider & CredentialAuthProvider;

export function isNativeAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.MyAirNative;
}

export function createQuboProvider(): QuboPurifierProvider {
  if (!isNativeAvailable()) return new UnavailableQuboProvider();
  return new NativeQuboProvider(window.MyAirNative!);
}

class UnavailableQuboProvider implements QuboPurifierProvider {
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
  async signIn() { return this.fail(); }
  async signOut() {}
}

class NativeQuboProvider implements QuboPurifierProvider {
  private snap: ProviderSnapshot;
  private listeners = new Set<(s: ProviderSnapshot) => void>();
  private pendingCommand = new Map<string, (r: CommandResult) => void>();
  private pendingAuth = new Map<string, (r: CommandResult) => void>();
  private seq = 0;

  constructor(private native: NativeApi) {
    this.snap = this.parse(native.quboGetSnapshot());
    window.__myairOnQuboSnapshot = (json) => this.set(this.parse(json));
    window.__myairOnQuboCommand = (id, json) => this.resolve(this.pendingCommand, id, json);
    window.__myairOnQuboAuth = (id, json) => this.resolve(this.pendingAuth, id, json);
  }

  private resolve(map: Map<string, (r: CommandResult) => void>, id: string, json: string) {
    const done = map.get(id);
    if (!done) return;
    map.delete(id);
    try { done(JSON.parse(json) as CommandResult); }
    catch { done({ accepted: false, confirmed: false, error: 'Unreadable response from Android layer.' }); }
  }

  private parse(json: string): ProviderSnapshot {
    try { return JSON.parse(json) as ProviderSnapshot; }
    catch { return { provider: PROVIDER, phase: 'error', message: 'Unreadable response from Android layer.', devices: [] }; }
  }
  private set(s: ProviderSnapshot) { this.snap = s; this.listeners.forEach((l) => l(s)); }

  getSnapshot() { return this.snap; }
  subscribe(l: (s: ProviderSnapshot) => void): Unsubscribe { this.listeners.add(l); return () => this.listeners.delete(l); }
  async requestPermissions() { this.native.quboRefresh(); }
  async refresh() { this.native.quboRefresh(); }

  async signIn(email: string, password: string): Promise<CommandResult> {
    const id = `auth${++this.seq}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => { if (this.pendingAuth.delete(id)) resolve({ accepted: false, confirmed: false, error: 'Timed out waiting for Qubo.' }); }, 20000);
      this.pendingAuth.set(id, (r) => { clearTimeout(timer); resolve(r); });
      this.native.quboSignIn(id, email, password);
    });
  }
  async signOut() { this.native.quboSignOut(); }

  private send(payload: object): Promise<CommandResult> {
    const id = `c${++this.seq}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => { if (this.pendingCommand.delete(id)) resolve({ accepted: false, confirmed: false, error: 'No response from Qubo (timed out). State is unknown.' }); }, 20000);
      this.pendingCommand.set(id, (r) => { clearTimeout(timer); resolve(r); });
      this.native.quboCommand(id, JSON.stringify(payload));
    });
  }
  setPower(deviceId: string, on: boolean) { return this.send({ type: 'power', deviceId, on }); }
  setFanMode(deviceId: string, modeId: string) { return this.send({ type: 'fanMode', deviceId, modeId }); }
  async setFanPercent(): Promise<CommandResult> { return { accepted: false, confirmed: false, error: 'Qubo purifiers use discrete fan speed levels (1-3), not a percent control.' }; }
  setFanSpeedLevel(deviceId: string, level: number) { return this.send({ type: 'fanSpeedLevel', deviceId, level }); }
  setChildLock(deviceId: string, enabled: boolean) { return this.send({ type: 'childLock', deviceId, enabled }); }
}
