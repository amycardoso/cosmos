// Shared shapes the site reads: a minutes-per-day array for the year so far,
// and a weekday x hour grid for each period.
import { local, dayIndex } from './time.js';

export const PERIOD_DAYS = { week: 7, month: 30 };

// The year so far: Jan 1 up to and including today.
export function yearSpan(nowMs) {
  const today = local(nowMs);
  const year = Number(today.date.slice(0, 4));
  return { year, today: today.date, days: dayIndex(today.date, year) + 1 };
}

// Any year: the year so far when it is the current one, otherwise the whole of it, Jan 1 to
// Dec 31. A past span ends (`end`, ms) at the turn of the year; the current one ends now.
export function spanOf(year, nowMs) {
  const cur = yearSpan(nowMs);
  if (year === cur.year) return cur;
  return { year, today: `${year}-12-31`, days: dayIndex(`${year}-12-31`, year) + 1, past: true, end: Date.UTC(year + 1, 0, 1) };
}

// Every year from the one holding firstMs up to the current one, newest first.
export function yearsSince(firstMs, span) {
  const first = Number.isFinite(firstMs) && firstMs > 0 ? Math.max(2000, Number(local(firstMs).date.slice(0, 4))) : span.year;
  const out = [];
  for (let y = span.year; y >= Math.min(first, span.year); y--) out.push(y);
  return out;
}

// sessions: [{ start: ms, minutes }]. Returns minutes per day of the year so far.
export function minutesPerDay(sessions, span) {
  const out = new Array(span.days).fill(0);
  for (const s of sessions) {
    const i = dayIndex(local(s.start).date, span.year);
    if (i >= 0 && i < span.days) out[i] += s.minutes;
  }
  return out.map((m) => Math.round(m));
}

// Whether a session falls inside the last n days up to today (or anywhere this year
// when n is null). The last n days can reach back into last year in early January.
export function inPeriod(startMs, span, n) {
  const date = local(startMs).date;
  if (n == null) {
    const i = dayIndex(date, span.year);
    return i >= 0 && i < span.days;
  }
  const back = Math.round((Date.parse(span.today) - Date.parse(date)) / 86400000);
  return back >= 0 && back < n;
}

// Weekday x hour grid, scaled so the busiest cell is 1.
export function clock(sessions) {
  const g = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const s of sessions) {
    const l = local(s.start);
    g[l.dow][l.hour] += s.minutes;
  }
  const max = Math.max(0, ...g.flat());
  return g.map((row) => row.map((v) => (max ? Math.round((v / max) * 1000) / 1000 : 0)));
}

// One clock per period.
export function clocks(sessions, span) {
  return {
    year: clock(sessions.filter((s) => inPeriod(s.start, span, null))),
    month: clock(sessions.filter((s) => inPeriod(s.start, span, PERIOD_DAYS.month))),
    week: clock(sessions.filter((s) => inPeriod(s.start, span, PERIOD_DAYS.week))),
  };
}

export const round1 = (x) => Math.round(x * 10) / 10;
