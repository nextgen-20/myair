/**
 * Provider boundary. The MyAir UI depends ONLY on these types — never on Google APIs.
 * Every value here is either read from the provider or null/unknown. Nothing is synthesised.
 */
export type Connectivity = 'online' | 'offline' | 'partially_online' | 'unknown';

export type ProviderPhase =
  | 'unsupported-platform' // not running inside the Android app, so no Home APIs access exists
  | 'loading'
  | 'needs-permission'     // user has not granted access yet
  | 'permission-denied'    // user cancelled / denied / OAuth not configured
  | 'ready'                // permission granted and the device list was read from Home APIs
  | 'error';               // SDK / Play services / API error

export interface FanModeOption { id: string; label: string }

export interface PurifierState {
  /** null = the device does not expose this, or it has not been read. */
  power: boolean | null;
  fanMode: string | null;
  fanPercent: number | null;
  fanModesAvailable: FanModeOption[];
  /** µg/m³. null unless the device actually exposes a PM2.5-reporting trait. */
  pm25: number | null;
  /** null unless the device actually reports remaining filter life. */
  filterLifePercent: number | null;
  /** Discrete fan-speed-level control (e.g. Qubo's 1/2/3), distinct from the percent slider above. */
  fanSpeedLevel: number | null;
  fanSpeedLevelsAvailable: number[];
  childLockOn: boolean | null;
}

export interface PurifierDevice {
  id: string;
  name: string;
  room: string | null;
  /** null unless the provider actually reports a model/SKU string (e.g. "HPH06"). */
  model: string | null;
  connectivity: Connectivity;
  /** false => device type/model is not one this provider supports, or lacks a required trait */
  supported: boolean;
  unsupportedReason: string | null;
  /** Traits/services the device actually exposes (names as reported by the provider). */
  traits: string[];
  /** Which controls this device exposes. UI enables a control only if true. */
  controls: { power: boolean; fanMode: boolean; fanPercent: boolean; fanSpeedLevel: boolean; childLock: boolean };
  state: PurifierState;
  /** epoch ms of the last successful READ from the provider; null if never read. */
  lastConfirmedAt: number | null;
}

export interface ProviderSnapshot {
  provider: string;
  phase: ProviderPhase;
  message: string | null;
  devices: PurifierDevice[];
}

export interface CommandResult {
  /** The Home API accepted the command without error. */
  accepted: boolean;
  /** A read-back from the Home API showed the requested state. Only then may the UI say "successful". */
  confirmed: boolean;
  error: string | null;
}

export type Unsubscribe = () => void;

export interface PurifierProvider {
  getSnapshot(): ProviderSnapshot;
  subscribe(listener: (s: ProviderSnapshot) => void): Unsubscribe;
  /** Launches the provider's permission flow. */
  requestPermissions(): Promise<void>;
  refresh(): Promise<void>;
  setPower(deviceId: string, on: boolean): Promise<CommandResult>;
  setFanMode(deviceId: string, modeId: string): Promise<CommandResult>;
  setFanPercent(deviceId: string, percent: number): Promise<CommandResult>;
  setFanSpeedLevel(deviceId: string, level: number): Promise<CommandResult>;
  setChildLock(deviceId: string, enabled: boolean): Promise<CommandResult>;
}

/** Implemented only by providers that sign in with account credentials (currently Qubo). */
export interface CredentialAuthProvider {
  signIn(identifier: string, password: string): Promise<CommandResult>;
  signOut(): Promise<void>;
}
