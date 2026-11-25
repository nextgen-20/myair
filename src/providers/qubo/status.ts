/**
 * Qubo is now a real, implemented provider (see QuboProvider.kt and docs/QUBO_PROTOCOL.md) —
 * this file no longer says "not available." It records provenance/verification-status text
 * shown in Settings → Integrations → Qubo, so the UI never implies more certainty than is true.
 */
export interface QuboProvenance {
  summary: string;
  implementedFrom: string[];
  confirmedByHardwareTests: string[];
  notVerifiedByMyAir: string[];
  sources: { label: string; url: string }[];
}

export const QUBO_PROVENANCE: QuboProvenance = {
  summary:
    'MyAir signs in with your own Qubo account and talks to Qubo’s real cloud API — ' +
    'the same one the official app uses. No DNS redirection, no TLS interception, no credential ' +
    'extraction. The endpoint/field details come from reading a third-party, MIT-licensed, ' +
    'independent protocol client (qubopy), reimplemented natively here — not copied, and not ' +
    'yet tested by MyAir against a physical device.',
  implementedFrom: [
    'selvakk2k/qubopy (MIT) — login, token refresh, device discovery, shadow read/write endpoints and field names',
    'dtechterminal/qubo-local-control — consulted for MQTT topic naming context only; its local-broker/DNS approach is not used',
  ],
  confirmedByHardwareTests: [
    "qubopy's README credits a contributor's real test of REST shadow read/write on a Qubo Q400",
    "qubopy's README credits a separate contributor's real test of an MQTT telemetry command on a Qubo Q200",
  ],
  notVerifiedByMyAir: [
    'Sign-in, discovery and shadow read/write have not been run against any physical Qubo device by this implementation',
    'The R250 (HPH06) specifically has not been confirmed to work — any HPH-prefixed model discovered is supported the same way, but none has been hardware-tested here',
    'Real-time MQTT telemetry is not implemented in this version; PM2.5 may go stale the same way it would in the official app without a refresh prompt',
  ],
  sources: [
    { label: 'qubopy (MIT license)', url: 'https://github.com/selvakk2k/qubopy' },
    { label: 'qubo-local-control (MIT license, protocol reference only)', url: 'https://github.com/dtechterminal/qubo-local-control' },
    { label: 'MyAir’s own protocol notes', url: '#' },
  ],
};
