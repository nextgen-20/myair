import { useState, type ChangeEvent } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { CommandResult, PurifierDevice, PurifierProvider } from '../providers/types';

type Feedback = { kind: 'ok' | 'warn' | 'err'; text: string } | null;

function toFeedback(r: CommandResult, what: string, providerLabel: string): Feedback {
  if (r.error) return { kind: 'err', text: `Command failed: ${r.error}` };
  if (r.confirmed) return { kind: 'ok', text: `Confirmed by ${providerLabel}: ${what}.` };
  if (r.accepted) return { kind: 'warn', text: `${providerLabel} accepted the command, but the new state has not been confirmed yet. Shown state is unchanged.` };
  return { kind: 'err', text: 'Command was not accepted.' };
}

/** Renders ONLY the controls the device actually exposes. */
export function Controls({ device: d, provider }: { device: PurifierDevice; provider: PurifierProvider }) {
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<Feedback>(null);
  const [pct, setPct] = useState<number | null>(null);
  const offline = d.connectivity === 'offline';
  const providerLabel = provider.getSnapshot().provider;
  const none = !d.controls.power && !d.controls.fanMode && !d.controls.fanPercent && !d.controls.fanSpeedLevel && !d.controls.childLock;

  const run = async (fn: () => Promise<CommandResult>, what: string) => {
    setBusy(true); setFb(null);
    try { setFb(toFeedback(await fn(), what, providerLabel)); }
    catch (e) { setFb({ kind: 'err', text: `Command failed: ${String(e)}` }); }
    finally { setBusy(false); }
  };

  return (
    <div className="card control">
      <div className="label">Device controls</div>
      {none ? (
        <div className="locked"><SlidersHorizontal size={17} /><span>This device does not expose any control MyAir supports.</span></div>
      ) : (
        <>
          <div className="controlRow">
            {d.controls.power && (
              <button disabled={busy || offline} onClick={() => run(() => provider.setPower(d.id, d.state.power !== true), d.state.power ? 'turned off' : 'turned on')}>
                {d.state.power === true ? 'Turn off' : d.state.power === false ? 'Turn on' : 'Toggle power'}
              </button>
            )}
            {d.controls.fanMode && d.state.fanModesAvailable.map((m) => (
              <button key={m.id} className={d.state.fanMode === m.id ? 'sel' : ''} disabled={busy || offline}
                onClick={() => run(() => provider.setFanMode(d.id, m.id), `fan mode ${m.label}`)}>{m.label}</button>
            ))}
          </div>
          {d.controls.fanPercent && (
            <div className="slider">
              <label>Fan speed: {pct ?? d.state.fanPercent ?? '—'}%</label>
              <input type="range" min={1} max={100} value={pct ?? d.state.fanPercent ?? 1} disabled={busy || offline}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPct(Number(e.target.value))}
                onMouseUp={() => pct != null && run(() => provider.setFanPercent(d.id, pct), `fan speed ${pct}%`).then(() => setPct(null))}
                onTouchEnd={() => pct != null && run(() => provider.setFanPercent(d.id, pct), `fan speed ${pct}%`).then(() => setPct(null))} />
            </div>
          )}
          {d.controls.fanSpeedLevel && (
            <div className="controlRow">
              <span className="label" style={{ alignSelf: 'center', marginRight: 6 }}>Fan speed level:</span>
              {(d.state.fanSpeedLevelsAvailable.length ? d.state.fanSpeedLevelsAvailable : [1, 2, 3]).map((lvl) => (
                <button key={lvl} className={d.state.fanSpeedLevel === lvl ? 'sel' : ''} disabled={busy || offline}
                  onClick={() => run(() => provider.setFanSpeedLevel(d.id, lvl), `fan speed level ${lvl}`)}>{lvl}</button>
              ))}
            </div>
          )}
          {d.controls.childLock && (
            <div className="controlRow">
              <button disabled={busy || offline} onClick={() => run(() => provider.setChildLock(d.id, d.state.childLockOn !== true), d.state.childLockOn ? 'child lock disabled' : 'child lock enabled')}>
                {d.state.childLockOn === true ? 'Disable child lock' : d.state.childLockOn === false ? 'Enable child lock' : 'Toggle child lock'}
              </button>
            </div>
          )}
        </>
      )}
      {offline && <div className="locked"><SlidersHorizontal size={17} /><span>Device is offline according to {providerLabel}. Controls are disabled.</span></div>}
      {busy && <div className="fb">Waiting for {providerLabel}…</div>}
      {fb && <div className={'fb ' + fb.kind}>{fb.text}</div>}
    </div>
  );
}
