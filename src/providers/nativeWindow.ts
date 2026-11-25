/** Single shared declaration of the Android JS bridge surface (`window.MyAirNative`).
 * Keep every native method MyAir calls listed here, so the type is consistent everywhere.
 * Google Home and Qubo are two independent channels (google* / qubo*) — see NativeBridge.kt. */
export interface NativeApi {
  // Google Home channel
  getSnapshot(): string;
  requestPermissions(): void;
  refresh(): void;
  command(requestId: string, json: string): void;
  // Qubo channel
  quboGetSnapshot(): string;
  quboRefresh(): void;
  quboCommand(requestId: string, json: string): void;
  quboSignIn(requestId: string, email: string, password: string): void;
  quboSignOut(): void;
  // Add Remote (infrared)
  hasInfraredHardware(): boolean;
  supportedIrFrequencies(): string;
  transmitIr(requestId: string, json: string): void;
}
declare global {
  interface Window {
    MyAirNative?: NativeApi;
    __myairOnSnapshot?: (json: string) => void;
    __myairOnCommand?: (requestId: string, json: string) => void;
    __myairOnQuboSnapshot?: (json: string) => void;
    __myairOnQuboCommand?: (requestId: string, json: string) => void;
    __myairOnQuboAuth?: (requestId: string, json: string) => void;
    __myairOnIrResult?: (requestId: string, json: string) => void;
  }
}
