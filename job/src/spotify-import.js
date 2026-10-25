// Folds Spotify's Extended Streaming History export into the history the build keeps,
// and writes it gzipped for `wrangler kv key put spotify-history`. The current value
// comes from `wrangler kv key get spotify-history` (gzipped, as the build stores it).
// It also counts the skips, which only the export knows, for `spotify-skips`.
// Run on her own computer only: the export holds her whole listening history.
//   node job/src/spotify-import.js <history.json.gz> <skips.json.gz> <current.json.gz> <export folder or .json ...>
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { fromExport, withExport } from './spotify.js';
import { skipSummary } from './archive.js';

const [out, skipsOut, current, ...inputs] = process.argv.slice(2);
if (!out || !skipsOut || !current || !inputs.length) {
  console.log('usage: node job/src/spotify-import.js <history.json.gz> <skips.json.gz> <current.json.gz> <export folder or .json ...>');
  process.exit(1);
}
// Only the audio files: the video ones are podcast episodes.
const files = [];
for (const i of inputs) {
  if ((await stat(i)).isDirectory()) files.push(...(await readdir(i)).filter((f) => /^Streaming_History_Audio_.*\.json$/.test(f)).map((f) => join(i, f)));
  else files.push(i);
}
const rows = [];
for (const f of files) rows.push(...JSON.parse(await readFile(f, 'utf8')));
const imported = rows.map(fromExport).filter(Boolean);
if (!imported.length) {
  console.log('no plays found in the export; nothing written');
  process.exit(1);
}
const bytes = await readFile(current);
const history = bytes.length ? JSON.parse(gunzipSync(bytes).toString('utf8')) : [];
const merged = withExport(history, imported);
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
await writeFile(out, gzipSync(JSON.stringify(merged)));
const skips = skipSummary(rows);
await writeFile(skipsOut, gzipSync(JSON.stringify(skips)));
console.log(`${files.length} files, ${imported.length} plays from ${day(merged[0].at)}; kept ${merged.length - imported.length} of ${history.length} newer plays from the job; ${merged.length} written to ${out}; skips until ${skips.until} written to ${skipsOut}`);
