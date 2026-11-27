import { useEffect, useRef, useState } from 'react';
import { Power, CalendarClock, TimerReset, Lock, Unlock, Wind, SlidersHorizontal, Moon, Sparkles } from 'lucide-react';
import type { CommandResult, PurifierDevice, PurifierProvider } from '../providers/types';

/**
 * Qubo control panel styled after the supplied reference image.
 * All readings, available modes and supported controls still come from the
 * real provider/device state; this component only changes presentation.
 */

type Band = { key: 'good' | 'moderate' | 'poor' | 'unknown'; label: string; color: string; glow: string };

function bandFor(pm25: number | null): Band {
  if (pm25 == null) return { key: 'unknown', label: 'No reading', color: '#5c7890', glow: 'rgba(92,120,144,.25)' };
  if (pm25 <= 50) return { key: 'good', label: 'Good', color: '#4fe39a', glow: 'rgba(79,227,154,.35)' };
  if (pm25 <= 100) return { key: 'moderate', label: 'Moderate', color: '#f0c250', glow: 'rgba(240,194,80,.35)' };
  return { key: 'poor', label: 'Poor', color: '#f26a55', glow: 'rgba(242,106,85,.35)' };
}

function useAnimatedNumber(target: number | null, duration = 750): number | null {
  const [shown, setShown] = useState<number | null>(target);
  const fromRef = useRef<number | null>(target);
  const rafRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (target == null) { setShown(null); fromRef.current = null; return; }
    const from = fromRef.current ?? target;
    if (from === target) { setShown(target); return; }
    const start = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (target - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else { fromRef.current = target; setShown(target); }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return shown;
}

type Feedback = { kind: 'ok' | 'warn' | 'err'; text: string } | null;
function toFeedback(r: CommandResult, what: string): Feedback {
  if (r.error) return { kind: 'err', text: `Command failed: ${r.error}` };
  if (r.confirmed) return { kind: 'ok', text: `Confirmed: ${what}.` };
  if (r.accepted) return { kind: 'warn', text: 'Accepted, waiting for Qubo to confirm the new state.' };
  return { kind: 'err', text: 'Command was not accepted.' };
}

const RADIUS = 92;
const CIRC = 2 * Math.PI * RADIUS;
const PM25_SCALE_MAX = 300;

function ModeIcon({ id }: { id: string }) {
  const value = id.toLowerCase();
  if (value.includes('auto')) return <span className="qModeLetter">A</span>;
  if (value.includes('sleep')) return <Moon size={24} />;
  if (value.includes('q-sense') || value.includes('qsense') || value.includes('ai')) return <Sparkles size={23} />;
  if (value.includes('manual')) return <SlidersHorizontal size={23} />;
  return <Wind size={22} />;
}

export function QuboPanel({ device: d, provider, onBack }: { device: PurifierDevice; provider: PurifierProvider; onBack?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [fb, setFb] = useState<Feedback>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const offline = d.connectivity === 'offline';
  const pm25 = d.state.pm25;
  const shownPm25 = useAnimatedNumber(pm25);
  const band = bandFor(pm25);
  const pct = pm25 == null ? 0 : Math.max(0, Math.min(100, (pm25 / PM25_SCALE_MAX) * 100));
  const offset = CIRC - (pct / 100) * CIRC;
  const modes = d.state.fanModesAvailable;
  const modeIdx = Math.max(0, modes.findIndex((m) => m.id === d.state.fanMode));
  const levels = d.state.fanSpeedLevelsAvailable.length ? d.state.fanSpeedLevelsAvailable : [1, 2, 3];
  const levelIdx = Math.max(0, levels.findIndex((l) => l === d.state.fanSpeedLevel));
  const powerOn = d.state.power === true;

  const run = async (key: string, fn: () => Promise<CommandResult>, what: string) => {
    setBusy(key); setFb(null);
    try { setFb(toFeedback(await fn(), what)); }
    catch (e) { setFb({ kind: 'err', text: `Command failed: ${String(e)}` }); }
    finally { setBusy(null); }
  };

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  return (
    <div className={'qpanel band-' + band.key}>
      <div className="qpanelGlow" aria-hidden />

      <div className="qpanelTop">
        <div className="qTitleRow">
          <button className="qBack" aria-label="Back" onClick={() => onBack?.()}><span>‹</span></button>
          <div>
            <span className="qEyebrow">QUBO · {d.model ?? 'AIR PURIFIER'}</span>
            <h2 className="qName">My Air Purifier</h2>
            <div className="qDeviceName">{d.name}</div>
          </div>
        </div>
        <span className={'qConn ' + (offline ? 'off' : 'on')}><i />{offline ? 'Offline' : d.connectivity === 'partially_online' ? 'Partially online' : 'Online'}</span>
      </div>

      <div className="qRingWrap">
        <svg viewBox="0 0 220 220" className="qRing">
          <circle cx="110" cy="110" r={RADIUS} className="qRingTrack" />
          <circle
            cx="110" cy="110" r={RADIUS} className="qRingValue"
            style={{ stroke: band.color, strokeDasharray: CIRC, strokeDashoffset: pm25 == null ? CIRC : offset, filter: `drop-shadow(0 0 10px ${band.glow})` }}
          />
        </svg>
        <div className="qRingCenter">
          <span className="qPmLabel">PM 2.5</span>
          <strong>{shownPm25 ?? '—'}</strong>
          <span className={'qBandPill band-' + band.key}>{band.label}</span>
        </div>
      </div>

      <div className="qModeRow">
        <button
          className={'qModeBtn qPowerMode' + (powerOn ? ' active' : '') + (pressed === 'power' ? ' pressed' : '')}
          disabled={!d.controls.power || offline || busy === 'power'}
          onPointerDown={() => setPressed('power')}
          onPointerUp={() => setPressed(null)}
          onPointerLeave={() => setPressed(null)}
          onClick={() => run('power', () => provider.setPower(d.id, !powerOn), powerOn ? 'turned off' : 'turned on')}
        >
          <span className="qModeIcon"><Power size={23} /></span>
          <span>{powerOn ? 'On' : 'Switch Off'}</span>
        </button>

        {modes.map((m, i) => (
          <button key={m.id}
            className={'qModeBtn' + (i === modeIdx ? ' active' : '')}
            disabled={offline || busy === 'mode'}
            onClick={() => run('mode', () => provider.setFanMode(d.id, m.id), `mode set to ${m.label}`)}
          >
            <span className="qModeIcon"><ModeIcon id={m.id} /></span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {d.controls.fanSpeedLevel && (
        <div className="qSpeedRow">
          <span className="qSpeedLabel"><Wind size={14} /> Fan speed</span>
          <div className="qSeg qSegSmall" style={{ ['--n' as string]: levels.length }}>
            <div className="qSegThumb" style={{ transform: `translateX(${levelIdx * 100}%)`, width: `${100 / levels.length}%` }} />
            {levels.map((lvl, i) => (
              <button key={lvl} className={'qSegBtn' + (i === levelIdx ? ' sel' : '')} disabled={offline || busy === 'speed'}
                onClick={() => run('speed', () => provider.setFanSpeedLevel(d.id, lvl), `fan speed level ${lvl}`)}>
                {lvl}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="qBottomBar">
        <button className="qBarBtn disabled" onClick={() => showToast('Schedule is not exposed by Qubo’s cloud API in this app.')}>
          <CalendarClock size={19} /><span>Schedule</span>
        </button>
        <button className="qBarBtn disabled" onClick={() => showToast('Timer is not exposed by Qubo’s cloud API in this app.')}>
          <TimerReset size={19} /><span>Timer</span>
        </button>
        <button
          className={'qBarBtn' + (d.state.childLockOn ? ' active' : '') + (!d.controls.childLock ? ' disabled' : '')}
          disabled={!d.controls.childLock || offline || busy === 'lock'}
          onClick={() => d.controls.childLock
            ? run('lock', () => provider.setChildLock(d.id, !d.state.childLockOn), d.state.childLockOn ? 'child lock disabled' : 'child lock enabled')
            : showToast('Child lock is not reported by this device.')}
        >
          {d.state.childLockOn ? <Lock size={19} /> : <Unlock size={19} />}
          <span>Child Lock</span>
        </button>
      </div>

      {(toast || fb || busy) && (
        <div className="qToastWrap">
          {busy && <div className="qToast info">Waiting for Qubo…</div>}
          {!busy && fb && <div className={'qToast ' + fb.kind}>{fb.text}</div>}
          {!busy && !fb && toast && <div className="qToast info">{toast}</div>}
        </div>
      )}
    </div>
  );
}
