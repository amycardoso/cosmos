// Reading, from KOReader's statistics.sqlite3 (the file its cloud sync puts on WebDAV).
// Same logic as the Reading Atlas cards: time per day, an hours grid, the library,
// and per-page fingerprints.
import initSqlJs from 'sql.js';
import { local } from './time.js';
import { minutesPerDay, clocks, inPeriod, round1 } from './aggregate.js';

const FINISHED = 0.97; // share of pages reached that counts as finished
const READING_DAYS = 30; // opened within this many days: still "reading"
const STRETCH = 10; // pages per fingerprint mark

export async function fetchStatistics(env) {
  const res = await fetch(env.WEBDAV_URL, {
    headers: { Authorization: 'Basic ' + Buffer.from(`${env.WEBDAV_USER}:${env.WEBDAV_PASSWORD}`).toString('base64') },
  });
  if (!res.ok) throw new Error(`WebDAV answered ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function openStatistics(bytes) {
  const SQL = await initSqlJs();
  return new SQL.Database(bytes);
}

function rows(db, sql) {
  const st = db.prepare(sql);
  const out = [];
  while (st.step()) out.push(st.getAsObject());
  st.free();
  return out;
}

// Normalised language code: "pt-BR" -> "pt".
const lang = (l) => {
  const code = (l || '').toLowerCase().split(/[-_]/)[0];
  return !code || code === 'n/a' || code === 'und' ? 'outro' : code;
};

// Two files of one book often differ in accents, case or subtitle; compare the main title only.
export const sameBook = (title) => (title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s[-–:]\s|:\s/)[0].replace(/[^a-z0-9]+/g, ' ').trim();

export function reading(db, span, nowMs) {
  const books = new Map(rows(db, 'SELECT id, title, authors, pages, language, highlights FROM book').map((b) => [b.id, { ...b, stats: [] }]));
  // page_stat_data keeps the page count each page was read under; rescale to the book's current count.
  for (const r of rows(db, 'SELECT id_book, page, start_time, duration, total_pages FROM page_stat_data ORDER BY start_time')) {
    const b = books.get(r.id_book);
    if (!b || !r.duration) continue;
    const pages = b.pages || r.total_pages || 0;
    const page = r.total_pages && pages ? Math.max(1, Math.round((r.page * pages) / r.total_pages)) : r.page;
    b.stats.push({ page, start: r.start_time * 1000, seconds: r.duration });
  }

  // Two files of the same book (another edition or a re-download) count as one book.
  // Same main title, and the authors share a name (or one file has none), so two books that only share a title stay apart.
  const names = (a) => new Set(sameBook((a || '').split('\n')[0]).split(' ').filter((w) => w.length > 2));
  const sameAuthor = (x, y) => { const a = names(x.authors); const b = names(y.authors); return !a.size || !b.size || [...a].some((w) => b.has(w)); };
  const merged = new Map();
  for (const b of books.values()) {
    const key = sameBook(b.title);
    const into = (merged.get(key) || []).find((x) => sameAuthor(x, b));
    if (!into) { merged.set(key, [...(merged.get(key) || []), b]); continue; }
    const pages = Math.max(into.pages || 0, b.pages || 0);
    const scale = (book) => book.stats.map((st) => (book.pages && pages ? { ...st, page: Math.max(1, Math.round((st.page * pages) / book.pages)) } : st));
    into.stats = scale(into).concat(scale(b)).sort((x, y) => x.start - y.start);
    into.pages = pages || into.pages;
    into.highlights = (into.highlights || 0) + (b.highlights || 0);
  }

  const sessions = [];
  const list = [];
  for (const b of [...merged.values()].flat()) {
    if (!b.stats.length) continue;
    for (const s of b.stats) sessions.push({ start: s.start, minutes: s.seconds / 60, book: b.id });
    const maxPage = Math.max(...b.stats.map((s) => s.page));
    const progress = b.pages ? Math.min(1, maxPage / b.pages) : 0;
    const last = b.stats[b.stats.length - 1].start;
    const finished = progress >= FINISHED;
    const status = finished ? 'lido' : nowMs - last <= READING_DAYS * 86400000 ? 'lendo' : 'pausado';
    const yearSeconds = b.stats.filter((s) => inPeriod(s.start, span, null)).reduce((a, s) => a + s.seconds, 0);
    list.push({
      id: b.id,
      title: b.title || 'Sem título',
      author: (b.authors || '').split('\n')[0],
      pages: b.pages || maxPage,
      lang: lang(b.language),
      highlights: b.highlights || 0,
      hours: round1(yearSeconds / 3600),
      totalHours: round1(b.stats.reduce((a, s) => a + s.seconds, 0) / 3600),
      status,
      progress: Math.round(progress * 100) / 100,
      lastRead: last,
      finished: finished ? local(b.stats.find((s) => s.page / b.pages >= FINISHED).start).date : null,
      stats: b.stats,
    });
  }

  // Books of the year: anything read this year, newest activity first.
  const year = list.filter((b) => b.hours > 0).sort((a, b) => b.lastRead - a.lastRead);
  const c = clocks(sessions, span);

  return {
    readingDays: minutesPerDay(sessions, span),
    readingClocks: c,
    books: year.map(({ stats, id, lastRead, totalHours, ...b }) => b),
    // The stats database only knows books that were opened, so there is no "unread" here.
    library: list.map((b) => ({ title: b.title, lang: b.lang, status: b.status === 'lido' ? 'finished' : b.status === 'lendo' ? 'reading' : 'on_hold' })),
    fingerprints: year.slice(0, 6).map(fingerprint),
  };
}

// Minutes per ten-page stretch, plus the longest run of stretches she came back to
// after having read well past them.
export function fingerprint(b) {
  const n = Math.max(1, Math.ceil(b.pages / STRETCH));
  const mins = new Array(n).fill(null);
  const reread = new Array(n).fill(false);
  let furthest = 0;
  const firstSeen = new Map();
  for (const s of b.stats) {
    const i = Math.min(n - 1, Math.floor((s.page - 1) / STRETCH));
    mins[i] = (mins[i] || 0) + s.seconds / 60;
    const day = local(s.start).date;
    if (!firstSeen.has(i)) firstSeen.set(i, day);
    else if (furthest >= s.page + 2 * STRETCH && firstSeen.get(i) !== day) reread[i] = true;
    furthest = Math.max(furthest, s.page);
  }
  let best = null;
  for (let i = 0; i < n; i++) {
    if (!reread[i]) continue;
    let j = i;
    while (j + 1 < n && reread[j + 1]) j++;
    if (!best || j - i > best[1] - best[0]) best = [i, j];
    i = j;
  }
  return {
    title: b.title,
    author: b.author,
    pages: b.pages,
    hours: b.totalHours,
    status: b.status,
    progress: b.progress,
    mins: mins.map((m) => (m == null ? null : Math.round(m))),
    reread: best,
  };
}

