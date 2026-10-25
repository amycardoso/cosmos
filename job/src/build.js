// Builds the private site: reads the three sources, writes dist/ with the real data
// in dist/data/cosmos.js, ready for `wrangler pages deploy dist`.
//
// Logs say only which source worked; they never print data. In a public repository
// the Actions logs are public too.
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { yearSpan } from './aggregate.js';
import { localIso } from './time.js';
import { store } from './state.js';
import { fetchStatistics, openStatistics, reading } from './koreader.js';
import { fetchSpotify, music } from './spotify.js';
import { fetchBingers, screens } from './bingers.js';
import { covers, coverKey } from './covers.js';
import { withSkoob } from './skoob.js';
import { connections } from './connections.js';

const env = process.env;
const has = (...keys) => keys.every((k) => env[k]);

// Day arrays from a cached run are a day or more short; pad them to today.
export function fit(arr, days) {
  if (!Array.isArray(arr)) return new Array(days).fill(0);
  return arr.length >= days ? arr.slice(0, days) : arr.concat(new Array(days - arr.length).fill(0));
}

async function source(name, ready, run, state, span) {
  const cached = await state.get(`out-${name}`);
  const usable = cached && cached.year === span.year ? cached : null;
  if (!ready) {
    console.log(`${name}: no credentials${usable ? ', using the last good read' : ''}`);
    return { data: usable?.data || null, status: 'missing', at: usable?.at || null };
  }
  try {
    const data = await run();
    const at = Date.now();
    await state.put(`out-${name}`, { year: span.year, at, data });
    console.log(`${name}: ok`);
    return { data, status: 'ok', at };
  } catch (err) {
    console.log(`${name}: failed (${err.message})${usable ? ', using the last good read' : ''}`);
    return { data: usable?.data || null, status: 'failed', at: usable?.at || null };
  }
}

export function compose({ read, listen, watch }, span, now) {
  const r = read.data || {};
  const m = listen.data || {};
  const s = watch.data || {};
  const empty = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const period = (p) => ({
    readingClock: r.readingClocks?.[p] || empty,
    listeningClock: m.listeningClocks?.[p] || empty,
    watchingClock: s.watchingClocks?.[p] || empty,
    topTracks: m.periods?.[p]?.topTracks || [],
    artists: m.periods?.[p]?.artists || [],
    feelings: s.periods?.[p]?.feelings || {},
  });
  const periods = { year: period('year'), month: period('month'), week: period('week') };
  return {
    synthetic: false,
    year: span.year,
    updatedAt: localIso(now),
    sources: {
      reading: { status: read.status, at: read.at },
      music: { status: listen.status, at: listen.at, since: m.listeningSince ?? null },
      screens: { status: watch.status, at: watch.at },
    },
    readingDays: fit(r.readingDays, span.days),
    listeningDays: fit(m.listeningDays, span.days),
    watchingDays: fit(s.watchingDays, span.days),
    readingClock: periods.year.readingClock,
    listeningClock: periods.year.listeningClock,
    watchingClock: periods.year.watchingClock,
    books: r.books || [],
    library: r.library || [],
    fingerprints: r.fingerprints || [],
    recentTrack: m.recentTrack || null,
    topTracks: periods.year.topTracks,
    artists: periods.year.artists,
    shows: s.shows || [],
    feelings: periods.year.feelings,
    watchlist: s.watchlist || {},
    connections: connections({ books: r.timeline, plays: m.timeline, watched: s.timeline, since: m.historySince ?? null }, span),
    periods,
  };
}

export async function main() {
  const now = Date.now();
  const span = yearSpan(now);
  const state = store(env);

  const read = await source('reading', has('WEBDAV_URL', 'WEBDAV_USER', 'WEBDAV_PASSWORD'), async () => {
    const db = await openStatistics(await fetchStatistics(env));
    return reading(db, span, now);
  }, state, span);

  const listen = await source('music', has('SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REFRESH_TOKEN'), async () => {
    const { history, nowPlaying } = await fetchSpotify(env, (await state.get('spotify-history')) || [], span);
    await state.put('spotify-history', history);
    return music(history, nowPlaying, span);
  }, state, span);

  const watch = await source('screens', has('BINGERS_TOKEN'), async () => {
    const fetched = await fetchBingers(env, await state.get('bingers-mirror'));
    await state.put('bingers-mirror', fetched.mirror);
    return screens(fetched, span);
  }, state, span);

  // Books finished this year before KOReader, imported from Skoob by hand.
  if (read.data) read.data = withSkoob(read.data, await state.get('skoob-read'), span);

  const data = compose({ read, listen, watch }, span, now);
  await rm('dist', { recursive: true, force: true });
  await cp('site', 'dist', { recursive: true });
  await mkdir('dist/data', { recursive: true });

  // Covers are a nicety: when the lookup fails the books keep their plain spines.
  if (data.books.length) {
    try {
      const found = await covers(data.books, (await state.get('covers')) || {}, now);
      await state.put('covers', found.cache);
      await mkdir('dist/covers', { recursive: true });
      for (const { file, bytes } of Object.values(found.images)) await writeFile(`dist/${file}`, bytes);
      for (const b of [...data.books, ...data.fingerprints]) b.cover = found.images[coverKey(b)]?.file || null;
      console.log(`covers: ${Object.keys(found.images).length} of ${data.books.length}`);
    } catch (err) {
      console.log(`covers: failed (${err.message})`);
    }
  }
  // The page shows the copies served from the site, never a catalogue's address.
  for (const b of data.books) delete b.coverUrl;
  await writeFile('dist/data/cosmos.js', `window.COSMOS_DATA = ${JSON.stringify(data)};\n`);
  console.log('dist/ ready');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.log(`build failed: ${err.message}`);
    process.exit(1);
  });
}
