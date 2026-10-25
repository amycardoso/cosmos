// Book covers. The statistics database has none, so each book is looked up by title and
// author on Open Library (Google Books as a fallback). The image is downloaded at build
// time and served from the site itself, behind Access, so the browser calls no one else.
import { createHash } from 'node:crypto';

const RETRY_DAYS = 14; // how long a book with no cover found waits before another lookup
const VERSION = 2; // misses cached by an older lookup are tried again at once
const norm = (s) => (s || '').trim().toLowerCase();

export const coverKey = (b) => `${norm(b.title)}|${norm(b.author)}`;
// File names are hashes, so the published paths say nothing about the books.
const fileName = (key, type) => `covers/${createHash('sha256').update(key).digest('hex').slice(0, 16)}.${type.includes('png') ? 'png' : 'jpg'}`;

async function json(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'cosmos personal dashboard' } });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res.json();
}

// E-book file titles carry extras the catalogues don't know: "(Portuguese Edition)",
// "[ebook]", a subtitle, a series after a dash. Authors may be "Surname, Name" or several lines.
export function cleanTitle(t) {
  return (t || '').replace(/[([][^)\]]*[)\]]/g, ' ').replace(/\s+/g, ' ').trim();
}
export const mainTitle = (t) => cleanTitle(t).split(/\s[-–—|]\s|:\s/)[0].trim();
export function cleanAuthor(a) {
  const first = (a || '').split(/\n|;|&| e | and /)[0].trim();
  const m = first.match(/^([^,]+),\s*(.+)$/);
  return (m ? `${m[2]} ${m[1]}` : first).replace(/\s+/g, ' ').trim();
}

// Tries the catalogues from the most to the least precise query, ending with Open Library's
// free-text search, which also matches a book under its original title. `failed` says Open
// Library errored, so a miss isn't final; Google's daily quota runs out on shared runners
// too often for its errors to count.
export async function lookup(b) {
  const author = cleanAuthor(b.author);
  const titles = [...new Set([cleanTitle(b.title), mainTitle(b.title)].filter(Boolean))];
  let failed = false;
  const ask = (url, counts) => json(url).catch(() => ((failed ||= counts), null));
  const tries = [];
  for (const title of titles) {
    if (author) tries.push(['ol', { title, author }]);
    tries.push(['ol', { title }], ['gb', `intitle:${title}${author ? ` inauthor:${author}` : ''}`]);
  }
  for (const title of titles) if (author) tries.push(['ol', { q: `${title} ${author}` }]);
  for (const [where, q] of tries) {
    if (where === 'ol') {
      const ol = await ask(`https://openlibrary.org/search.json?${new URLSearchParams({ ...q, limit: '1', fields: 'cover_i' })}`, true);
      const id = ol?.docs?.[0]?.cover_i;
      if (id) return { url: `https://covers.openlibrary.org/b/id/${id}-L.jpg`, failed: false };
    } else {
      const gb = await ask(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&printType=books`, false);
      const thumb = gb?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
      if (thumb) return { url: thumb.replace(/^http:/, 'https:').replace('&edge=curl', ''), failed: false };
    }
  }
  return { url: null, failed };
}

// books: [{ title, author, coverUrl? }]; a coverUrl (Skoob's edition) skips the lookup.
// cache: { key: { url, at } } from the last run.
// Returns the new cache and the downloaded images, { key: { file, bytes } }.
export async function covers(books, cache = {}, now = Date.now(), find = lookup) {
  const next = {};
  const images = {};
  for (const b of books) {
    const key = coverKey(b);
    if (next[key]) continue;
    let hit = b.coverUrl ? { url: b.coverUrl, at: now, v: VERSION } : cache[key];
    if (!hit || (!hit.url && (hit.v !== VERSION || now - hit.at > RETRY_DAYS * 86400000))) {
      const found = await find(b);
      // A miss because a catalogue errored is not remembered, so the next run asks again.
      hit = found.url || !found.failed ? { url: found.url, at: now, v: VERSION } : null;
    }
    if (!hit) continue;
    next[key] = hit;
    if (!hit.url) continue;
    const res = await fetch(hit.url).catch(() => null);
    const type = res?.headers.get('content-type') || '';
    if (!res?.ok || !type.startsWith('image/')) continue;
    const bytes = Buffer.from(await res.arrayBuffer());
    // Open Library answers a missing size with a tiny blank image; treat that as no cover.
    if (bytes.length < 1000) continue;
    images[key] = { file: fileName(key, type), bytes };
  }
  return { cache: next, images };
}
