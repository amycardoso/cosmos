// Book covers. The statistics database has none, so each book is looked up by title and
// author on Open Library (Google Books as a fallback). The image is downloaded at build
// time and served from the site itself, behind Access, so the browser calls no one else.
import { createHash } from 'node:crypto';

const RETRY_DAYS = 14; // how long a book with no cover found waits before another lookup
const norm = (s) => (s || '').trim().toLowerCase();

export const coverKey = (b) => `${norm(b.title)}|${norm(b.author)}`;
// File names are hashes, so the published paths say nothing about the books.
const fileName = (key, type) => `covers/${createHash('sha256').update(key).digest('hex').slice(0, 16)}.${type.includes('png') ? 'png' : 'jpg'}`;

async function json(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'cosmos personal dashboard' } });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res.json();
}

export async function lookup(b) {
  const q = new URLSearchParams({ title: b.title, limit: '1', fields: 'cover_i' });
  if (b.author) q.set('author', b.author);
  const ol = await json(`https://openlibrary.org/search.json?${q}`).catch(() => null);
  const id = ol?.docs?.[0]?.cover_i;
  if (id) return `https://covers.openlibrary.org/b/id/${id}-M.jpg`;
  const g = `intitle:${b.title}${b.author ? ` inauthor:${b.author}` : ''}`;
  const gb = await json(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(g)}&maxResults=1`).catch(() => null);
  const thumb = gb?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
  return thumb ? thumb.replace(/^http:/, 'https:') : null;
}

// books: [{ title, author }]. cache: { key: { url, at } } from the last run.
// Returns the new cache and the downloaded images, { key: { file, bytes } }.
export async function covers(books, cache = {}, now = Date.now(), find = lookup) {
  const next = {};
  const images = {};
  for (const b of books) {
    const key = coverKey(b);
    if (next[key]) continue;
    let hit = cache[key];
    if (!hit || (!hit.url && now - hit.at > RETRY_DAYS * 86400000)) hit = { url: await find(b), at: now };
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
