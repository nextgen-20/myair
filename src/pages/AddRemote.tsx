import { useEffect, useState, type ChangeEvent } from 'react';
import { Radio, AlertTriangle } from 'lucide-react';
import { isIrAvailable, isNativeShell, transmitNec, transmitRaw } from '../providers/ir';

/**
 * Real Consumer IR transmit, kept entirely separate from purifier control (different hardware,
 * different provider, different device category). See android/.../ir/IrRemoteController.kt for
 * exactly what this can and cannot do — notably: no brand code database is bundled (none could be
 * sourced honestly), so this only sends codes you provide yourself.
 */
export function AddRemote() {
  const [native, setNative] = useState(isNativeShell());
  const [ir, setIr] = useState(isIrAvailable());
  useEffect(() => { setNative(isNativeShell()); setIr(isIrAvailable()); }, []);

  if (!native) {
    return (
      <section>
        <div className="notice warnBox"><div><strong>Not running in the MyAir Android app</strong> — infrared transmission requires Android's ConsumerIrManager, which only exists on an Android device.</div></div>
      </section>
    );
  }
  if (!ir) {
    return (
      <section>
        <div className="empty compact">
          <AlertTriangle size={24} />
          <h3>This phone has no IR blaster</h3>
          <p>Android reports no consumer-infrared hardware (`FEATURE_CONSUMER_IR`) on this device. MyAir will not show remote controls it cannot actually send — most phones since ~2017 removed this hardware.</p>
        </div>
      </section>
    );
  }
  return (
    <section>
      <div className="sectionHead"><div><span className="label">INFRARED</span><h2>Add Remote</h2></div></div>
      <div className="card settings">
        <p className="lead">This phone has an IR blaster. MyAir can transmit real infrared signals, but it does not ship a database of TV/AC/purifier remote codes — none could be sourced without reverse-engineering a vendor's remote, which this app won't do. Use this screen with codes you already know (from a universal remote's documentation, a LIRC config file, or your own capture).</p>
        <NecSender />
        <RawSender />
      </div>
    </section>
  );
}

function NecSender() {
  const [address, setAddress] = useState(0);
  const [command, setCommand] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true); setResult(null);
    const r = await transmitNec(address, command);
    setResult(r.sent ? `Sent (NEC, ${r.frequencyHz} Hz, ${r.patternLength} pulses).` : `Failed: ${r.error}`);
    setBusy(false);
  };
  return (
    <div className="irBlock">
      <h3><Radio size={16} /> NEC protocol</h3>
      <p className="lead small">NEC is a public, documented IR protocol (not brand-specific). Enter the address/command byte pair for a code you already have.</p>
      <div className="irRow">
        <label>Address (0–255)<input type="number" min={0} max={255} value={address} onChange={(e: ChangeEvent<HTMLInputElement>) => setAddress(Number(e.target.value))} /></label>
        <label>Command (0–255)<input type="number" min={0} max={255} value={command} onChange={(e: ChangeEvent<HTMLInputElement>) => setCommand(Number(e.target.value))} /></label>
        <button className="primary" disabled={busy} onClick={send}>Send</button>
      </div>
      {result && <div className={'fb ' + (result.startsWith('Sent') ? 'ok' : 'err')}>{result}</div>}
    </div>
  );
}

function RawSender() {
  const [freq, setFreq] = useState(38000);
  const [patternText, setPatternText] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const pattern: number[] = patternText.split(/[,\s]+/).filter(Boolean).map(Number);
    if (pattern.some((n: number) => !Number.isFinite(n) || n <= 0)) { setResult('Failed: pattern must be comma/space-separated positive microsecond durations.'); return; }
    setBusy(true); setResult(null);
    const r = await transmitRaw(freq, pattern);
    setResult(r.sent ? `Sent (raw, ${r.frequencyHz} Hz, ${r.patternLength} pulses).` : `Failed: ${r.error}`);
    setBusy(false);
  };
  return (
    <div className="irBlock">
      <h3><Radio size={16} /> Raw pattern</h3>
      <p className="lead small">For any protocol: paste an on/off microsecond pattern you already have (e.g. from a LIRC config or your own capture).</p>
      <label>Carrier frequency (Hz)<input type="number" value={freq} onChange={(e: ChangeEvent<HTMLInputElement>) => setFreq(Number(e.target.value))} /></label>
      <textarea rows={3} placeholder="9000,4500,560,560,560,1690,..." value={patternText} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPatternText(e.target.value)} />
      <button className="primary" disabled={busy} onClick={send}>Send</button>
      {result && <div className={'fb ' + (result.startsWith('Sent') ? 'ok' : 'err')}>{result}</div>}
    </div>
  );
}
