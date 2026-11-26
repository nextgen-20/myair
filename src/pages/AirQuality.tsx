import { useEffect, useMemo, useState } from 'react';
import { Activity, MapPin, RefreshCw, Wind } from 'lucide-react';
import type { PurifierDevice } from '../providers/types';

type Point = { time: string; indoor: number | null; outdoor: number | null; outdoorPm25: number | null };
const KEY = 'myair-aq-history-v1';

function indoorAqi(pm25: number | null): number | null {
  if (pm25 == null || !Number.isFinite(pm25)) return null;
  const v = Math.max(0, pm25);
  const b = [[0,12,0,50],[12.1,35.4,51,100],[35.5,55.4,101,150],[55.5,150.4,151,200],[150.5,250.4,201,300],[250.5,350.4,301,400],[350.5,500.4,401,500]];
  for (const [lo,hi,ilo,ihi] of b) if (v >= lo && v <= hi) return Math.round(((ihi-ilo)/(hi-lo))*(v-lo)+ilo);
  return v > 500.4 ? 500 : null;
}
function band(aqi: number | null) {
  if (aqi == null) return { label:'No data', cls:'unknown' };
  if (aqi <= 50) return { label:'Good', cls:'good' };
  if (aqi <= 100) return { label:'Moderate', cls:'moderate' };
  if (aqi <= 150) return { label:'Unhealthy for sensitive groups', cls:'usg' };
  if (aqi <= 200) return { label:'Unhealthy', cls:'unhealthy' };
  if (aqi <= 300) return { label:'Very unhealthy', cls:'very' };
  return { label:'Hazardous', cls:'hazard' };
}
function loadHistory(): Point[] { try { return JSON.parse(localStorage.getItem(KEY) || '[]') as Point[]; } catch { return []; } }
function saveHistory(points: Point[]) { localStorage.setItem(KEY, JSON.stringify(points.slice(-720))); }
function fmtTime(s: string) { return new Date(s).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }); }

export function AirQuality({ device }: { device?: PurifierDevice }) {
  const [location, setLocation] = useState<{lat:number;lon:number}|null>(null);
  const [locationLabel, setLocationLabel] = useState('Your location');
  const [outdoor, setOutdoor] = useState<Point[]>([]);
  const [history, setHistory] = useState<Point[]>(loadHistory);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<'today'|'7d'|'30d'>('today');
  const [error, setError] = useState<string|null>(null);

  const locate = () => {
    setError(null);
    if (!navigator.geolocation) { setError('Location is not available on this device.'); return; }
    navigator.geolocation.getCurrentPosition(
      p => { setLocation({lat:p.coords.latitude,lon:p.coords.longitude}); setLocationLabel('Current location'); },
      e => setError(e.message || 'Location permission was not granted.'),
      { enableHighAccuracy:false, timeout:10000, maximumAge:15*60*1000 }
    );
  };
  useEffect(() => { locate(); }, []);

  const fetchOutdoor = async () => {
    if (!location) return;
    setLoading(true); setError(null);
    try {
      const u = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
      u.searchParams.set('latitude', String(location.lat));
      u.searchParams.set('longitude', String(location.lon));
      u.searchParams.set('hourly', 'us_aqi,us_aqi_pm2_5,pm2_5');
      u.searchParams.set('past_days', range === 'today' ? '1' : range === '7d' ? '7' : '30');
      u.searchParams.set('forecast_days', '1');
      u.searchParams.set('timezone', 'auto');
      const r = await fetch(u.toString());
      if (!r.ok) throw new Error('Outdoor air-quality request failed.');
      const j = await r.json();
      const times: string[] = j.hourly?.time ?? [];
      const aq: number[] = j.hourly?.us_aqi ?? [];
      const pm: number[] = j.hourly?.pm2_5 ?? [];
      const rows = times.map((time,i)=>({time, indoor:null, outdoor:aq[i] ?? null, outdoorPm25:pm[i] ?? null}));
      setOutdoor(rows);
      const now = Date.now();
      const current = rows.filter(x => Math.abs(new Date(x.time).getTime()-now) < 90*60*1000).sort((a,b)=>Math.abs(new Date(a.time).getTime()-now)-Math.abs(new Date(b.time).getTime()-now))[0] ?? rows[rows.length-1];
      if (current && device?.state.pm25 != null) {
        const sample = {time: current.time, indoor: indoorAqi(device.state.pm25), outdoor: current.outdoor, outdoorPm25: current.outdoorPm25};
        const next = [...loadHistory().filter(x => Math.abs(new Date(x.time).getTime()-new Date(sample.time).getTime()) > 20*60*1000), sample];
        saveHistory(next); setHistory(next);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load outdoor air quality.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (location) fetchOutdoor(); }, [location, range]);

  const currentOutdoor = outdoor.length ? [...outdoor].sort((a,b)=>Math.abs(new Date(a.time).getTime()-Date.now())-Math.abs(new Date(b.time).getTime()-Date.now()))[0] : null;
  const indoor = indoorAqi(device?.state.pm25 ?? null);
  const currentOutdoorAqi = currentOutdoor?.outdoor ?? null;
  const points = useMemo(() => {
    const map = new Map(history.map(x=>[x.time,x]));
    return outdoor.map(x=>({...x, indoor: map.get(x.time)?.indoor ?? (Math.abs(new Date(x.time).getTime()-Date.now()) < 90*60*1000 ? indoor : null)}));
  }, [outdoor, history, indoor]);

  const shown = points.filter(p => p.indoor != null || p.outdoor != null);
  const max = Math.max(100, ...shown.map(p=>Math.max(p.indoor??0,p.outdoor??0)));
  const w=900,h=310,pad=38;
  const xy=(v:number,i:number)=>({x:pad+(shown.length<=1?0:i/(shown.length-1))*(w-pad*2),y:h-pad-(v/max)*(h-pad*2)});
  const path=(key:'indoor'|'outdoor')=>shown.map((p,i)=>p[key]==null?null:xy(p[key]!,i)).filter(Boolean).map((p,i)=>(i?'L':'M')+' '+p!.x.toFixed(1)+' '+p!.y.toFixed(1)).join(' ');
  const avg=(key:'indoor'|'outdoor')=>{const a=shown.map(x=>x[key]).filter((v):v is number=>v!=null);return a.length?Math.round(a.reduce((s,v)=>s+v,0)/a.length):null};
  const indoorAvg=avg('indoor'), outdoorAvg=avg('outdoor');
  const delta=indoorAvg!=null&&outdoorAvg!=null?outdoorAvg-indoorAvg:null;

  return <section className="aqPage">
    <div className="sectionHead">
      <div><span className="label">AIR QUALITY</span><h2>Indoor vs Outdoor</h2><p className="aqSub"><MapPin size={13}/> {locationLabel}</p></div>
      <div className="aqActions"><button className="ghost" onClick={locate}><MapPin size={15}/> Location</button><button className="ghost" onClick={fetchOutdoor} disabled={!location||loading}><RefreshCw size={15} className={loading?'spin':''}/> Refresh</button></div>
    </div>
    {error && <div className="notice warnBox"><strong>Outdoor data unavailable</strong><span>{error}</span></div>}
    <div className="aqCards">
      <div className="aqMetric card"><span>INDOOR · PM2.5 AQI</span><strong>{indoor ?? '—'}</strong><em className={'aqPill '+band(indoor).cls}>{band(indoor).label}</em><small>{device?.state.pm25 != null ? device.state.pm25+' µg/m³ from '+device.name : 'Waiting for purifier PM2.5 reading'}</small></div>
      <div className="aqMetric card"><span>OUTDOOR · US AQI</span><strong>{currentOutdoorAqi ?? '—'}</strong><em className={'aqPill '+band(currentOutdoorAqi).cls}>{band(currentOutdoorAqi).label}</em><small>{currentOutdoor?.outdoorPm25 != null ? currentOutdoor.outdoorPm25.toFixed(1)+' µg/m³ · Open-Meteo' : 'Waiting for outdoor data'}</small></div>
      <div className="aqMetric card"><span>INDOOR ADVANTAGE</span><strong>{delta == null ? '—' : delta > 0 ? '+'+delta : delta}</strong><em>{delta == null ? 'Need both datasets' : delta > 0 ? 'AQI points cleaner indoors' : 'Outdoor is currently cleaner'}</em><small>Calculated from collected readings; not a manufacturer claim.</small></div>
    </div>
    <div className="card aqChartCard">
      <div className="aqChartHead"><div><span className="label">AQI TREND</span><h3>{range==='today'?'Today':range==='7d'?'Last 7 days':'Last 30 days'}</h3></div><div className="aqLegend"><span><i className="indoorDot"/>Indoor</span><span><i className="outdoorDot"/>Outdoor</span></div></div>
      <div className="rangeTabs">{(['today','7d','30d'] as const).map(r=><button key={r} className={range===r?'sel':''} onClick={()=>setRange(r)}>{r==='today'?'Today':r==='7d'?'7 Days':'30 Days'}</button>)}</div>
      {shown.length ? <div className="aqGraph"><svg viewBox={'0 0 '+w+' '+h} preserveAspectRatio="none" role="img" aria-label="Indoor and outdoor AQI graph">
        {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={pad} x2={w-pad} y1={h-pad-t*(h-pad*2)} y2={h-pad-t*(h-pad*2)} className="gridLine"/><text x="5" y={h-pad-t*(h-pad*2)+4} className="axisText">{Math.round(max*t)}</text></g>)}
        <path d={path('outdoor')} className="aqPath outdoor"/><path d={path('indoor')} className="aqPath indoor"/>
      </svg><div className="aqXAxis"><span>{fmtTime(shown[0].time)}</span><span>{fmtTime(shown[Math.floor(shown.length/2)].time)}</span><span>{fmtTime(shown[shown.length-1].time)}</span></div></div>
      : <div className="aqEmpty"><Activity size={24}/><h3>Collecting air-quality history</h3><p>Real readings will appear here as MyAir receives purifier data and outdoor data.</p></div>}
    </div>
    <div className="aqStats">
      <div className="card aqStat"><span>INDOOR AVERAGE</span><b>{indoorAvg ?? '—'}</b><small>Collected period</small></div>
      <div className="card aqStat"><span>OUTDOOR AVERAGE</span><b>{outdoorAvg ?? '—'}</b><small>Open-Meteo US AQI</small></div>
      <div className="card aqStat"><span>BEST INDOOR</span><b>{shown.map(x=>x.indoor).filter((v):v is number=>v!=null).length?Math.min(...shown.map(x=>x.indoor).filter((v):v is number=>v!=null)):'—'}</b><small>Lowest recorded AQI</small></div>
      <div className="card aqStat"><span>WORST OUTDOOR</span><b>{shown.map(x=>x.outdoor).filter((v):v is number=>v!=null).length?Math.max(...shown.map(x=>x.outdoor).filter((v):v is number=>v!=null)):'—'}</b><small>Highest recorded AQI</small></div>
    </div>
    <div className="aqNote"><Wind size={15}/><span>Outdoor air-quality data is supplied by Open-Meteo/CAMS. Indoor AQI is a PM2.5-based estimate so it can be compared on the same scale; it is not an official 24-hour regulatory AQI.</span></div>
  </section>;
}
