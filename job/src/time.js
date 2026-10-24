// Calendar helpers. Every day and hour is counted in her own timezone,
// not in the runner's UTC, so a 23h reading session stays on the right day.

export const TZ = process.env.COSMOS_TZ || 'America/Sao_Paulo';

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
});
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// { date: 'YYYY-MM-DD', hour: 0..23, dow: 0..6 (0 = Sunday) } for a timestamp in ms.
export function local(ms) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute), dow: WD[p.weekday] };
}

// Index of a local date inside the year (Jan 1 = 0).
export function dayIndex(date, year) {
  const [y, m, d] = date.split('-').map(Number);
  if (y !== year) return -1;
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(year, 0, 1)) / 86400000);
}

// ISO timestamp with her UTC offset, e.g. 2026-10-19T22:40:00-03:00.
export function localIso(ms) {
  const l = local(ms);
  const min = l.minute;
  const asUtc = Date.UTC(...l.date.split('-').map((v, i) => (i === 1 ? v - 1 : +v)), l.hour, min);
  const off = Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000);
  const sign = off < 0 ? '-' : '+';
  const a = Math.abs(off);
  return `${l.date}T${String(l.hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}
