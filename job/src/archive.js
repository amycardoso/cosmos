// "Dez anos": the music page's long view, from the whole Spotify history (the extended
// export plus everything the job caught since). Only these summaries reach the site,
// never the plays themselves.
import { local } from './time.js';

const DAY = 86400000;
const BURST = 21 * DAY; // a comet's head: the busiest three weeks of a track

export function archive(history, skips, span) {
  if (!history.length) return null;
  // Local dates and hours are worked out once; Intl is the slow part.
  const plays = history.map((p) => ({ ...p, l: local(p.at) }));
  const firstYear = +plays[0].l.date.slice(0, 4);
  const years = [];
  for (let y = firstYear; y <= span.year; y++) years.push(y);
  const yi = (p) => +p.l.date.slice(0, 4) - firstYear;
  const hours = (ms) => Math.round((ms / 3600000) * 10) / 10;

  const byArtist = new Map();
  const byTrack = new Map();
  const yearMs = years.map(() => 0);
  for (const p of plays) {
    const a = p.artists[0];
    const ar = byArtist.get(a) || { name: a, ms: 0, years: years.map(() => 0), first: p.l.date };
    ar.ms += p.ms;
    ar.years[yi(p)] += p.ms;
    byArtist.set(a, ar);
    const key = p.id || `${p.title}\u0000${a}`;
    const t = byTrack.get(key) || { title: p.title, artist: a, plays: [] };
    t.plays.push(p);
    byTrack.set(key, t);
    yearMs[yi(p)] += p.ms;
  }

  // Orbits: the artists of all time, plus each year's top two so every era shows.
  const artists = [...byArtist.values()].sort((a, b) => b.ms - a.ms);
  const chosen = new Set(artists.slice(0, 14));
  years.forEach((_, i) => artists.filter((a) => a.years[i] > 0).sort((a, b) => b.years[i] - a.years[i]).slice(0, 2).forEach((a) => chosen.add(a)));
  const orbits = [...chosen]
    .sort((a, b) => a.first.localeCompare(b.first))
    .map((a) => ({ name: a.name, hours: Math.round(a.ms / 3600000), years: a.years.map(hours), first: a.first }));

  // Comets: tracks whose busiest three weeks hold most of their plays.
  const comets = [];
  for (const t of byTrack.values()) {
    const n = t.plays.length;
    if (n < 25) continue;
    let best = 0, from = 0;
    for (let i = 0, j = 0; i < n; i++) {
      while (t.plays[i].at - t.plays[j].at > BURST) j++;
      if (i - j + 1 > best) { best = i - j + 1; from = j; }
    }
    if (best < 20 || best / n < 0.6) continue;
    comets.push({
      title: t.title, artist: t.artist, burst: best, plays: n,
      start: t.plays[from].l.date, end: t.plays[from + best - 1].l.date,
      days: [...new Set(t.plays.map((p) => p.l.date))],
    });
  }
  comets.sort((a, b) => b.burst - a.burst).splice(12);

  // On this day: for every calendar day, each year's minutes and its most played track.
  const strings = [], index = new Map();
  const str = (s) => { if (!index.has(s)) { index.set(s, strings.length); strings.push(s); } return index.get(s); };
  const cells = new Map();
  for (const p of plays) {
    const k = `${p.l.date.slice(5)} ${p.l.date.slice(0, 4)}`;
    const c = cells.get(k) || { ms: 0, tracks: new Map() };
    c.ms += p.ms;
    const tk = `${p.title}\u0000${p.artists[0]}`;
    c.tracks.set(tk, (c.tracks.get(tk) || 0) + 1);
    cells.set(k, c);
  }
  const days = {};
  for (const [k, c] of cells) {
    const [md, y] = k.split(' ');
    const [tk, n] = [...c.tracks].sort((a, b) => b[1] - a[1])[0];
    const [title, artist] = tk.split('\u0000');
    (days[md] ||= {})[y] = [Math.round(c.ms / 60000), str(title), str(artist), n];
  }

  // First listens of the most played tracks of all time.
  const first = [...byTrack.values()]
    .sort((a, b) => b.plays.length - a.plays.length)
    .slice(0, 30)
    .map((t) => ({
      title: t.title, artist: t.artist, plays: t.plays.length,
      hours: hours(t.plays.reduce((s, p) => s + p.ms, 0)),
      first: t.plays[0].l.date, hour: `${t.plays[0].l.hour}h${String(t.plays[0].l.minute).padStart(2, '0')}`,
    }));

  return {
    since: plays[0].l.date,
    years,
    yearHours: yearMs.map((ms) => Math.round(ms / 3600000)),
    totals: { plays: plays.length, tracks: byTrack.size, artists: byArtist.size, hours: Math.round(yearMs.reduce((a, b) => a + b, 0) / 3600000) },
    orbits,
    comets,
    days: { strings, days },
    first,
    skips: skips || null,
  };
}

// Skips only exist in the export (the API reports finished plays), so the import counts
// them once and the page shows them as of the export's last day. Rows are the export's
// own: every start of a track, however short.
export function skipSummary(rows) {
  const tracks = rows.filter((r) => r.master_metadata_track_name && r.spotify_track_uri);
  if (!tracks.length) return null;
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => [0, 0]));
  const years = {};
  const byTrack = new Map();
  let last = 0;
  for (const r of tracks) {
    const at = Date.parse(r.ts);
    const l = local(at);
    const cut = r.ms_played < 30000 ? 1 : 0;
    grid[l.dow][l.hour][0] += cut;
    grid[l.dow][l.hour][1]++;
    const y = (years[l.date.slice(0, 4)] ||= [0, 0]);
    y[0] += cut;
    y[1]++;
    const t = byTrack.get(r.spotify_track_uri) || { title: r.master_metadata_track_name, artist: r.master_metadata_album_artist_name || '', cut: 0, starts: 0 };
    t.cut += cut;
    t.starts++;
    byTrack.set(r.spotify_track_uri, t);
    last = Math.max(last, at);
  }
  const often = [...byTrack.values()].filter((t) => t.starts >= 60).map((t) => ({ ...t, rate: t.cut / t.starts }));
  const pick = (list) => list.slice(0, 5).map(({ title, artist, cut, starts }) => ({ title, artist, cut, starts }));
  return {
    until: local(last).date,
    grid,
    years,
    mostSkipped: pick(often.slice().sort((a, b) => b.rate - a.rate)),
    neverSkipped: pick(often.slice().sort((a, b) => a.rate - b.rate || b.starts - a.starts)),
  };
}
