// Turns pages of Skoob's "Lidos" shelf, saved as JSON from her logged-in browser, into
// the list the build reads, and writes it gzipped for `wrangler kv key put skoob-read`.
// Run on her own computer only: the files hold her reading history.
//   node job/src/skoob-import.js skoob-read.json.gz page1.json [page2.json ...]
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { normSkoob } from './skoob.js';

const [out, ...pages] = process.argv.slice(2);
if (!out || !pages.length) {
  console.log('usage: node job/src/skoob-import.js <out.json.gz> <page.json> [...]');
  process.exit(1);
}
// Pages saved from some browsers come out as Windows-1252, and reading those as UTF-8
// turns every accent into U+FFFD. Try UTF-8 strictly and fall back.
const text = (bytes) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
};
const items = [];
for (const p of pages) items.push(...(JSON.parse(text(await readFile(p))).items || []));
const books = normSkoob(items);
await writeFile(out, gzipSync(JSON.stringify(books)));
console.log(`${books.length} books with a finish date written to ${out}`);
