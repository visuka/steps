export type Units = 'metric' | 'imperial';

const KM_PER_MILE = 1.609344;
const LB_PER_KG = 2.2046226;
const ML_PER_FL_OZ = 29.5735;

export function formatSteps(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function formatDistance(meters: number, units: Units): string {
  const km = meters / 1000;
  return units === 'metric' ? `${km.toFixed(2)} km` : `${(km / KM_PER_MILE).toFixed(2)} mi`;
}

export function formatWeight(kg: number, units: Units): string {
  return units === 'metric' ? `${kg.toFixed(1)} kg` : `${(kg * LB_PER_KG).toFixed(1)} lb`;
}

export function formatWater(ml: number, units: Units): string {
  return units === 'metric' ? `${Math.round(ml)} ml` : `${Math.round(ml / ML_PER_FL_OZ)} fl oz`;
}

/** Converts what the user typed into the stored metric value. */
export function weightToKg(value: number, units: Units): number {
  return units === 'metric' ? value : value / LB_PER_KG;
}

export function waterToMl(value: number, units: Units): number {
  return units === 'metric' ? value : value * ML_PER_FL_OZ;
}

export function heightToCm(value: number, units: Units): number {
  return units === 'metric' ? value : value * 2.54;
}

export function cmToHeight(cm: number, units: Units): number {
  return units === 'metric' ? Math.round(cm) : Math.round(cm / 2.54);
}

export function heightUnit(units: Units): string {
  return units === 'metric' ? 'cm' : 'in';
}

export function kgToWeight(kg: number, units: Units): number {
  return Math.round((units === 'metric' ? kg : kg * LB_PER_KG) * 10) / 10;
}

export function weightUnit(units: Units): string {
  return units === 'metric' ? 'kg' : 'lb';
}

export function waterUnit(units: Units): string {
  return units === 'metric' ? 'ml' : 'fl oz';
}

export function minutesAgo(ts: number, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - ts) / 60_000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return `${h} h ago`;
}

/** "42 min", "1 h 05 min". */
export function formatDuration(seconds: number): string {
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/** "12:34" for a running clock. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Minutes per km or mile, e.g. "11:20 /km"; "—" before there's a pace to show. */
export function formatPace(secPerKm: number | null, units: Units): string {
  if (secPerKm === null || !Number.isFinite(secPerKm)) return '—';
  const sec = Math.round(units === 'metric' ? secPerKm : secPerKm * KM_PER_MILE);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} /${units === 'metric' ? 'km' : 'mi'}`;
}

export function formatTemp(celsius: number, units: Units): string {
  return units === 'metric' ? `${Math.round(celsius)}°C` : `${Math.round((celsius * 9) / 5 + 32)}°F`;
}
