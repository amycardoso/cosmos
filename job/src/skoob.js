// Books read before KOReader, from the "Lidos" shelf on Skoob. Skoob has no public API
// and its own API needs her logged-in session, so the job never calls it: the shelf is
// imported by hand from her computer (skoob-import.js) into the state store, and each
// build adds this year's finished books that KOReader doesn't already know.
import { local } from './time.js';
import { sameBook as simple } from './koreader.js';

export function normSkoob(items) {
  return items
    .filter((b) => b.title && Number.isFinite(Date.parse(b.finished_at)))
    .map((b) => ({ title: b.title.trim(), author: (b.author || '').trim(), pages: Number(b.pages) || 0, finished: local(Date.parse(b.finished_at)).date, cover: b.cover || null }));
}

// Words that can identify a book: accents off, short words out, and any word holding a
// replacement character (an import decoded with the wrong charset) left out of the comparison.
const words = (t) => new Set((t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .split(/[^a-z0-9\ufffd]+/).filter((w) => w.length > 2 && !w.includes('\ufffd')));
const days = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;

// The same book often carries different titles on the two shelves ("As Crônicas de Nárnia - Coleção
// de Luxo: O Leão, a Feiticeira…" on the e-reader, "O Leão, a Feiticeira… (As Crônicas de Nárnia #1)"
// on Skoob). It is the same book when the main titles match, when nearly all of Skoob's title words
// are in the other one, or when the same author's book was finished within a few days.
export function sameRead(k, s) {
  if (simple(k.title) === simple(s.title)) return true;
  const kw = words(k.title), sw = [...words(s.title)];
  if (sw.length >= 2 && sw.filter((w) => kw.has(w)).length / sw.length >= 0.75) return true;
  const ka = words(k.author), sa = [...words(s.author)];
  return Boolean(k.finished && s.finished && days(k.finished, s.finished) <= 3 && sa.some((w) => ka.has(w)));
}

// read: the reading source's output. Returns it with Skoob's books of the year added.
export function withSkoob(read, skoob, span) {
  if (!read || !Array.isArray(skoob) || !skoob.length) return read;
  const taken = [...read.books];
  const extra = [];
  for (const b of skoob) {
    if (!b.finished.startsWith(`${span.year}-`)) continue;
    // Checking against what was already taken also drops repeats from overlapping shelf pages.
    const twin = taken.find((k) => sameRead(k, b));
    if (twin) {
      if (b.cover) twin.coverUrl ??= b.cover; // Skoob knows the Brazilian edition's cover
      continue;
    }
    const book = { title: b.title, author: b.author, pages: b.pages, lang: 'outro', highlights: 0, hours: 0, status: 'lido', progress: 1, finished: b.finished, source: 'skoob', coverUrl: b.cover || null };
    taken.push(book);
    extra.push(book);
  }
  return { ...read, books: read.books.concat(extra) };
}
