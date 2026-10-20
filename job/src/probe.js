// Prints the shape of what each source returns (key names and types, never values),
// to check the readers against the real APIs. Safe for public logs.
import { fetchStatistics, openStatistics } from './koreader.js';
import { token } from './spotify.js';
import { get } from './bingers.js';

const env = process.env;

function shape(x, depth = 0) {
  if (Array.isArray(x)) return x.length ? [shape(x[0], depth + 1)] : [];
  if (x && typeof x === 'object') {
    if (depth > 3) return '{…}';
    const entries = Object.entries(x);
    // Maps keyed by ids (like the titles map) show one entry, with the id hidden.
    if (entries.length && entries.every(([k]) => /^[0-9a-f-]{8,}$|^\d+$/i.test(k))) return { '<id>': shape(entries[0][1], depth + 1) };
    return Object.fromEntries(entries.map(([k, v]) => [k, shape(v, depth + 1)]));
  }
  return x === null ? 'null' : typeof x;
}
const show = (name, x) => console.log(`${name}: ${JSON.stringify(shape(x), null, 1)}`);

async function tryRun(name, fn) {
  try {
    await fn();
  } catch (err) {
    console.log(`${name}: ${err.message}`);
  }
}

await tryRun('koreader', async () => {
  if (!env.WEBDAV_URL) return console.log('koreader: no credentials');
  const db = await openStatistics(await fetchStatistics(env));
  for (const t of ['book', 'page_stat_data']) console.log(`koreader ${t}: ${db.exec(`PRAGMA table_info(${t})`)[0].values.map((v) => v[1]).join(', ')}`);
});

await tryRun('spotify', async () => {
  if (!env.SPOTIFY_REFRESH_TOKEN) return console.log('spotify: no credentials');
  const access = await token(env);
  const res = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', { headers: { Authorization: `Bearer ${access}` } });
  show('spotify recently-played', await res.json());
});

await tryRun('bingers', async () => {
  if (!env.BINGERS_TOKEN) return console.log('bingers: no credentials');
  show('bingers entries', await get('/entries?include=titles', env));
  show('bingers library', await get('/library?filter=all&limit=1', env));
  show('bingers watchlist', await get('/watchlist', env));
});
