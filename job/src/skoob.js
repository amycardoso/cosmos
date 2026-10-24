// Books read before KOReader, from the "Lidos" shelf on Skoob. Skoob has no public API
// and its own API needs her logged-in session, so the job never calls it: the shelf is
// imported by hand from her computer (skoob-import.js) into the state store, and each
// build adds this year's finished books that KOReader doesn't already know.
import { local } from './time.js';
import { sameBook as simple } from './koreader.js';

export function normSkoob(items) {
  return items
    .filter((b) => b.title && Number.isFinite(Date.parse(b.finished_at)))
    .map((b) => ({ title: b.title, author: b.author || '', pages: Number(b.pages) || 0, finished: local(Date.parse(b.finished_at)).date }));
}

// read: the reading source's output. Returns it with Skoob's books of the year added.
export function withSkoob(read, skoob, span) {
  if (!read || !Array.isArray(skoob) || !skoob.length) return read;
  const known = new Set(read.books.map((b) => simple(b.title)));
  const extra = skoob
    // Adding each title as it is taken also drops repeats from overlapping shelf pages.
    .filter((b) => b.finished.startsWith(`${span.year}-`) && !known.has(simple(b.title)) && known.add(simple(b.title)))
    .map((b) => ({ title: b.title, author: b.author, pages: b.pages, lang: 'outro', highlights: 0, hours: 0, status: 'lido', progress: 1, finished: b.finished, source: 'skoob' }));
  return { ...read, books: read.books.concat(extra) };
}
