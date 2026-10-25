// Where the three streams meet: what played while she read each book, and which
// shows shared their weeks with a book. Built from the timelines the three sources
// leave in their output; the site only receives the computed links.
import { local, dayIndex } from './time.js';

const SESSION_GAP = 5 * 60000; // page turns closer than this are one sitting
const MIN_TOGETHER = 10; // minutes of an artist during a book before it counts as a link
const ARTISTS_PER_BOOK = 3;
const SHOWS_PER_BOOK = 2;
const WEEK_READ = 30; // minutes in a week before a book counts as being read that week

// Reading stats as sittings: [startMs, endMs] for each run of page turns.
export function sittings(stats) {
  const out = [];
  for (const s of [...stats].sort((a, b) => a.start - b.start)) {
    const end = s.start + s.seconds * 1000;
    const last = out[out.length - 1];
    if (last && s.start <= last[1] + SESSION_GAP) last[1] = Math.max(last[1], end);
    else out.push([s.start, end]);
  }
  return out;
}

const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const week = (ms, year) => Math.floor(dayIndex(local(ms).date, year) / 7);

// books: [{ title, hours, sittings: [[start, end]] }]
// plays: [[endMs, ms, artist]] (Spotify's played_at is when the track ended)
// watched: [[startMs, minutes, title, kind]]
// since: first play in the music history, so time read before it is not called silence.
export function connections({ books = [], plays = [], watched = [], since = null }, span) {
  const sorted = [...plays].sort((a, b) => a[0] - b[0]);
  const soundtracks = {};
  const stars = new Map();
  const links = [];
  const star = (kind, name, hours) => {
    const key = `${kind}:${name}`;
    if (!stars.has(key)) stars.set(key, { id: key, kind, name, hours: 0 });
    stars.get(key).hours += hours;
    return key;
  };

  for (const b of books) {
    const read = b.sittings.reduce((a, [s, e]) => a + (e - s), 0) / 60000;
    if (!read) continue;
    // Only the part of the book read while the music history existed can be weighed.
    const heard = b.sittings.filter(([, e]) => since != null && e >= since);
    const covered = heard.reduce((a, [s, e]) => a + (e - Math.max(s, since)), 0) / 60000;
    const byArtist = new Map();
    let i = 0;
    for (const [start, e] of heard) {
      const s = Math.max(start, since); // minutes before the history began are not weighed
      while (i < sorted.length && sorted[i][0] < s) i++;
      // A play ending inside or just after the sitting may have started before it.
      for (let j = i; j < sorted.length && sorted[j][0] - sorted[j][1] < e; j++) {
        const [end, ms, artist] = sorted[j];
        const m = overlap(s, e, end - ms, end) / 60000;
        if (m > 0) byArtist.set(artist, (byArtist.get(artist) || 0) + m);
      }
    }
    const music = [...byArtist.values()].reduce((a, m) => a + m, 0);
    const artists = [...byArtist.entries()].map(([name, m]) => ({ name, minutes: Math.round(m) })).sort((a, b) => b.minutes - a.minutes);
    soundtracks[b.title] = {
      covered: Math.round(covered),
      music: Math.round(Math.min(music, covered)),
      artists: artists.slice(0, ARTISTS_PER_BOOK),
    };
    const top = artists.filter((a) => a.minutes >= MIN_TOGETHER).slice(0, ARTISTS_PER_BOOK);
    if (!top.length) continue;
    // Sittings bridge short pauses, so the book's own hours size its star.
    const bk = star('book', b.title, b.hours ?? read / 60);
    for (const a of top) links.push({ a: bk, b: star('artist', a.name, a.minutes / 60), minutes: a.minutes, how: 'during' });
  }

  // Weeks each book and each show were active, for the "same weeks" links.
  const showWeeks = new Map();
  const showHours = new Map();
  for (const [start, minutes, title, kind] of watched) {
    const w = week(start, span.year);
    if (w < 0) continue;
    const key = `${kind === 'movie' ? 'film' : 'show'}:${title}`;
    if (!showWeeks.has(key)) showWeeks.set(key, new Set());
    showWeeks.get(key).add(w);
    showHours.set(key, (showHours.get(key) || 0) + minutes / 60);
  }
  for (const b of books) {
    const perWeek = new Map();
    for (const [s, e] of b.sittings) {
      const w = week(s, span.year);
      if (w >= 0) perWeek.set(w, (perWeek.get(w) || 0) + (e - s) / 60000);
    }
    const weeks = new Set([...perWeek].filter(([, m]) => m >= WEEK_READ).map(([w]) => w));
    if (!weeks.size) continue;
    // A show watched all year would touch every book; ask that most of the shorter one overlaps.
    const near = [...showWeeks]
      .map(([key, ws]) => ({ key, shared: [...ws].filter((w) => weeks.has(w)).length, size: Math.min(ws.size, weeks.size) }))
      .filter((x) => x.shared >= 1 && x.shared / x.size >= 0.5)
      .sort((x, y) => y.shared - x.shared)
      .slice(0, SHOWS_PER_BOOK);
    if (!near.length) continue;
    const read = b.sittings.reduce((a, [s, e]) => a + (e - s), 0) / 3600000;
    const bk = stars.has(`book:${b.title}`) ? `book:${b.title}` : star('book', b.title, b.hours ?? read);
    for (const x of near) {
      const [kind, ...rest] = x.key.split(':');
      const id = `${kind}:${rest.join(':')}`;
      if (!stars.has(id)) stars.set(id, { id, kind, name: rest.join(':'), hours: showHours.get(x.key) });
      links.push({ a: bk, b: id, weeks: x.shared, how: 'weeks' });
    }
  }

  // An artist's star is as big as all the time with them this year, not only the time while reading.
  const listened = new Map();
  for (const [end, ms, artist] of sorted) if (week(end, span.year) >= 0) listened.set(artist, (listened.get(artist) || 0) + ms / 3600000);
  for (const s of stars.values()) if (s.kind === 'artist') s.hours = listened.get(s.name) || s.hours;

  const round = (h) => Math.round(h * 10) / 10;
  return {
    stars: [...stars.values()].map((s) => ({ ...s, hours: round(s.hours) })),
    links,
    soundtracks,
  };
}
