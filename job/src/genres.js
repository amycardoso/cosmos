// Genres for the music page. Spotify no longer fills in most artists' genres, so they come
// from MusicBrainz, whose community tags each artist with genres. MusicBrainz asks for one
// request a second, so each build looks up a few more artists, most listened first, and
// keeps the answers in the store.

const MB = 'https://musicbrainz.org/ws/2';
const UA = 'cosmos/1.0 (https://github.com/amycardoso/cosmos)';
const STALE = 180 * 86400000; // genres change slowly; look again twice a year
const MISS = 30 * 86400000; // an artist MusicBrainz didn't know may be added later
const PACE = 1500; // a little slower than the one request a second MusicBrainz allows

// Her ten families, each from the genres that lead to it. The first rule a genre matches
// wins, so the specific ones come before the broad ones (post-rock before rock).
export const FAMILIES = [
  ['Trilhas sonoras', /soundtrack|film score|video game music|score|musical theatre/],
  ['Clássico e neoclássico', /classical|neoclassical|minimalism|baroque(?! pop)|romantic|opera|\bpiano\b(?! rock)|chamber music|contemporary classical/],
  ['Música brasileira', /\bmpb\b|brazil|samba|bossa nova|sertanejo|axé|pagode|forró|funk carioca|tropicália|choro/],
  ['Pós-rock e ambiente', /post-rock|ambient|drone|shoegaze|downtempo|trip hop|nu jazz|lo-fi|chillout|new age|instrumental/],
  ['Hip-hop', /hip hop|rap|trap|grime|boom bap/],
  ['Eletrônica', /electro(?!pop)|electronic|house|techno|trance|edm|dubstep|drum and bass|dance(?!-pop)|synthwave|big room/],
  ['Rock clássico', /classic rock|grunge|hard rock|metal|progressive rock|psychedelic rock|punk|art rock|blues rock|glam rock|funk rock/],
  ['Indie e folk', /indie|folk|singer-songwriter|dream pop|chamber pop|americana|lo-fi indie|baroque pop/],
  ['Rock alternativo', /alternative rock|pop rock|britpop|post-britpop|piano rock|emo|rock/],
  ['Pop', /pop|r&b|soul|disco|contemporary r&b/],
];

export function family(genres) {
  for (const g of genres || []) {
    const name = g.toLowerCase();
    const hit = FAMILIES.find(([, re]) => re.test(name));
    if (hit) return hit[0];
  }
  return null;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry-After is either seconds or a date; null when it's missing, unreadable or past.
export function retryAfter(value, now = Date.now()) {
  if (!value) return null;
  const ms = /^\d+$/.test(value.trim()) ? +value * 1000 : Date.parse(value) - now;
  return ms > 0 ? ms : null;
}

// MusicBrainz answers 503 when a shared address (a GitHub runner's, say) asks too often:
// wait as long as it says, or a little longer each time, before giving up.
async function mb(path, pause = wait) {
  for (let k = 0; ; k++) {
    const res = await fetch(MB + path, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.status === 503 && k < 3) {
      await pause(retryAfter(res.headers.get('retry-after')) ?? 2 ** k * 3000);
      continue;
    }
    if (res.status === 503) throw new Error('MusicBrainz is rate limiting');
    if (!res.ok) throw new Error(`MusicBrainz answered ${res.status}`);
    return res.json();
  }
}

const norm = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

// One artist's genres, most voted first, or [] when MusicBrainz has no confident match.
export async function lookupArtist(name, get = mb, pause = wait) {
  const found = await get(`/artist?query=${encodeURIComponent(`artist:"${name.replace(/"/g, '')}"`)}&limit=5&fmt=json`);
  const match = (found.artists || []).find((a) => a.score >= 90 && norm(a.name) === norm(name));
  if (!match) return [];
  await pause(PACE);
  const full = await get(`/artist/${match.id}?inc=genres&fmt=json`);
  return (full.genres || []).sort((a, b) => b.count - a.count).slice(0, 5).map((g) => g.name);
}

// Looks up to `budget` artists that have no fresh answer yet, in the order given, and
// returns the updated cache: { artist: { g: [genres], at } }. A failure stops this run's
// lookups and keeps what it learned so far; the next build carries on.
export async function fetchGenres(artists, cache, now, budget = 50, lookup = lookupArtist, pause = wait) {
  const out = { ...(cache || {}) };
  const due = artists.filter((a) => {
    const c = out[a];
    return !c || now - c.at > (c.g.length ? STALE : MISS);
  });
  let looked = 0;
  for (const a of due.slice(0, budget)) {
    try {
      out[a] = { g: await lookup(a), at: now };
      looked++;
    } catch (err) {
      console.log(`genres: stopped after ${looked} (${err.message})`);
      break;
    }
    await pause(PACE);
  }
  return { cache: out, looked, left: Math.max(0, due.length - looked) };
}
