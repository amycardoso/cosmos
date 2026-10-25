// Looks up the genres of many artists at once, from her own computer: MusicBrainz turns
// away GitHub's shared runners after a few requests, so the build alone would take weeks.
// Reads the history and the current genres as `wrangler kv key get` saves them (gzipped)
// and writes the genres gzipped for `wrangler kv key put artist-genres`.
//   node job/src/genres-seed.js <out.json.gz> <history.json.gz> <current-genres.json.gz> [artists]
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import { fetchGenres, family } from './genres.js';

const [out, historyFile, currentFile, count = '600'] = process.argv.slice(2);
if (!out || !historyFile || !currentFile) {
  console.log('usage: node job/src/genres-seed.js <out.json.gz> <history.json.gz> <current-genres.json.gz> [artists]');
  process.exit(1);
}
// A key that isn't in KV yet comes back as a missing, empty or plain-text file: start from
// nothing. Gzip that doesn't decode is a broken download, so stop before writing over KV.
const gz = async (f) => {
  const raw = await readFile(f).catch((err) => {
    if (err.code === 'ENOENT') return Buffer.alloc(0);
    throw err;
  });
  if (raw[0] !== 0x1f || raw[1] !== 0x8b) return null;
  return JSON.parse(gunzipSync(raw).toString('utf8'));
};
const history = (await gz(historyFile)) || [];
const ms = new Map();
for (const p of history) ms.set(p.artists[0], (ms.get(p.artists[0]) || 0) + p.ms);
const ranked = [...ms].sort((a, b) => b[1] - a[1]);
const artists = ranked.slice(0, +count).map(([a]) => a);
const found = await fetchGenres(artists, (await gz(currentFile)) || {}, Date.now(), artists.length);
await writeFile(out, gzipSync(JSON.stringify(found.cache)));
// How much of the listening now has a genre family: the page draws genres from half up.
const total = ranked.reduce((a, [, m]) => a + m, 0);
const known = ranked.reduce((a, [name, m]) => a + (family(found.cache[name]?.g) ? m : 0), 0);
console.log(`${found.looked} artists looked up, ${found.left} left; ${total ? Math.round((known / total) * 100) : 0}% of the hours have a genre; written to ${out}`);
