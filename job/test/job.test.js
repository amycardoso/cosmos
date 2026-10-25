import { test } from 'node:test';
import assert from 'node:assert/strict';
import { local, dayIndex, localIso } from '../src/time.js';
import { yearSpan, minutesPerDay, clock, inPeriod } from '../src/aggregate.js';
import { reading } from '../src/koreader.js';
import { toPlay, mergeHistory, music, fromExport, withExport } from '../src/spotify.js';
import { normEntry, screens } from '../src/bingers.js';
import { archive, skipSummary } from '../src/archive.js';
import { compose, fit } from '../src/build.js';
import { statisticsDb, play } from './fixtures.js';

const NOW = Date.parse('2026-10-20T01:30:00Z'); // 19 Oct, 22h30 in São Paulo
const span = yearSpan(NOW);

test('days and hours are counted in São Paulo time', () => {
  assert.deepEqual(local(Date.parse('2026-10-20T01:30:00Z')), { date: '2026-10-19', hour: 22, minute: 30, dow: 1 });
  assert.equal(span.year, 2026);
  assert.equal(span.days, dayIndex('2026-10-19', 2026) + 1);
  assert.equal(localIso(NOW), '2026-10-19T22:30:00-03:00');
});

test('minutes land on the right day and the clock peaks at 1', () => {
  const s = [{ start: Date.parse('2026-01-02T01:00:00Z'), minutes: 30 }]; // 1 Jan, 22h local
  assert.equal(minutesPerDay(s, span)[0], 30);
  const c = clock(s);
  assert.equal(c[4][22], 1); // Thursday, 22h
});

test('reading: books, status, progress, library and fingerprints', async () => {
  const r = reading(await statisticsDb(), span, NOW);
  const byTitle = Object.fromEntries(r.books.map((b) => [b.title, b]));
  assert.deepEqual(Object.keys(byTitle).sort(), ['A Hora da Estrela', 'Piranesi']); // Rayuela was last year
  assert.equal(byTitle['A Hora da Estrela'].status, 'lendo');
  assert.equal(byTitle['A Hora da Estrela'].progress, 0.63);
  assert.equal(byTitle['A Hora da Estrela'].lang, 'pt');
  assert.equal(byTitle['Piranesi'].status, 'lido');
  assert.equal(byTitle['Piranesi'].finished, '2026-03-10');
  assert.equal(r.readingDays.length, span.days);
  assert.equal(r.readingDays[dayIndex('2026-10-16', 2026)], 30); // 22h on the 16th local
  assert.equal(r.library.find((b) => b.title === 'Rayuela').status, 'on_hold');
  const f = r.fingerprints.find((x) => x.title === 'Piranesi');
  assert.equal(f.mins.length, 10);
  assert.ok(f.mins[2] > f.mins[5], 'lingered around pages 20-29');
  assert.deepEqual(f.reread, [2, 2]);
  assert.equal(r.readingClocks.week[5][22], 1); // Friday 22h is the busiest this week
});

test('music: history merges without duplicates, and the views skip older years', () => {
  const a = [play('2026-10-19T12:00:00Z', 'Baby', 'Gal Costa'), play('2026-10-19T12:04:00Z', 'Trem Azul', 'Lô Borges')].map(toPlay);
  const old = toPlay(play('2024-12-31T12:00:00Z', 'Old', 'X'));
  const h = mergeHistory([old, a[0]], a);
  assert.equal(h.length, 3);
  const m = music(h, null, span);
  assert.equal(m.historySince, old.at);
  assert.equal(m.recentTrack.title, 'Trem Azul');
  assert.equal(m.periods.week.topTracks.length, 2);
  assert.equal(m.periods.year.artists[0].hours, 0.1);
  assert.equal(m.listeningDays[dayIndex('2026-10-19', 2026)], 8);
  assert.equal(m.listeningSince, dayIndex('2026-10-19', 2026));
});

test('music: the extended history export replaces what the job kept until it was made', () => {
  const row = (ts, title, ms = 200000, extra = {}) => ({ ts, ms_played: ms, master_metadata_track_name: title, master_metadata_album_artist_name: 'Gal Costa', master_metadata_album_album_name: 'Gal', spotify_track_uri: `spotify:track:Gal Costa-${title}`, ...extra });
  const rows = [
    row('2026-10-18T12:00:00Z', 'Baby'),
    row('2026-10-18T12:05:00Z', 'Skipped', 4000),
    row('2026-10-18T12:06:00Z', null, 900000, { episode_name: 'A podcast' }),
    row('2026-10-19T12:00:00Z', 'Divino'),
  ];
  const imported = rows.map(fromExport).filter(Boolean);
  assert.deepEqual(imported.map((p) => [p.id, p.ms, p.artists[0]]), [['Gal Costa-Baby', 200000, 'Gal Costa'], ['Gal Costa-Divino', 200000, 'Gal Costa']]);
  // The job caught the last exported play too, a fraction of a second later, and one after the export.
  const kept = [toPlay(play('2026-10-19T12:00:00.420Z', 'Divino', 'Gal Costa')), toPlay(play('2026-10-19T12:04:00Z', 'Trem Azul', 'Lô Borges'))];
  const h = withExport(kept, imported);
  assert.deepEqual(h.map((p) => p.title), ['Baby', 'Divino', 'Trem Azul']);
  // A track first seen in the export borrows its art from a later API play.
  const m = music(mergeHistory(h, [toPlay(play('2026-10-19T13:00:00Z', 'Baby', 'Gal Costa'))]), null, span);
  const baby = m.periods.year.topTracks.find((t) => t.title === 'Baby');
  assert.equal(baby.plays, 2);
  assert.equal(baby.image, 'https://i.scdn.co/a');
});

test('archive: orbits, a comet, on this day and first listens across the years', () => {
  const at = (iso) => Date.parse(iso);
  const p = (iso, title, artist, min = 4) => ({ at: at(iso), id: `${artist}-${title}`, title, artists: [artist], album: '', ms: min * 60000 });
  const history = [p('2024-03-01T15:00:00Z', 'Old', 'Gal Costa'), p('2025-10-19T15:00:00Z', 'Baby', 'Gal Costa', 60)];
  // An obsession: 30 plays in ten days of 2025, and 2 more a year later.
  for (let k = 0; k < 30; k++) history.push(p(new Date(at('2025-05-01T15:00:00Z') + k * 8 * 3600000).toISOString(), 'Trem Azul', 'Lô Borges'));
  history.push(p('2026-05-01T15:00:00Z', 'Trem Azul', 'Lô Borges'), p('2026-05-02T15:00:00Z', 'Trem Azul', 'Lô Borges'));
  history.sort((a, b) => a.at - b.at);
  const a = archive(history, null, span);
  assert.deepEqual(a.years, [2024, 2025, 2026]);
  assert.equal(a.since, '2024-03-01');
  assert.deepEqual(a.orbits.find((o) => o.name === 'Gal Costa').years, [0.1, 1, 0]);
  assert.equal(a.comets.length, 1);
  assert.equal(a.comets[0].burst, 30);
  assert.equal(a.comets[0].start, '2025-05-01');
  const day = a.days.days['10-19']['2025'];
  assert.deepEqual([day[0], a.days.strings[day[1]]], [60, 'Baby']);
  assert.equal(a.first[0].title, 'Trem Azul');
  assert.equal(a.first[0].first, '2025-05-01');
  assert.equal(a.first[0].hour, '12h00'); // São Paulo time
  assert.equal(archive([], null, span), null);
});

test('archive: skips are counted from every start in the export', () => {
  const row = (ts, ms, uri = 'spotify:track:a') => ({ ts, ms_played: ms, master_metadata_track_name: 'A', master_metadata_album_artist_name: 'X', spotify_track_uri: uri });
  const s = skipSummary([row('2025-01-06T15:00:00Z', 5000), row('2025-01-06T15:10:00Z', 200000), row('2026-01-05T15:00:00Z', 2000), { ts: '2026-01-05T16:00:00Z', ms_played: 1000, episode_name: 'A podcast' }]);
  assert.deepEqual(s.years, { 2025: [1, 2], 2026: [1, 1] });
  assert.deepEqual(s.grid[1][12], [2, 3]); // Mondays, 12h in São Paulo
  assert.equal(s.until, '2026-01-05');
});

test('screens: hours, shows in progress, films, feelings and queue', () => {
  const entries = [
    { id: 'e1', title_id: 's1', season: 3, episode: 6, watched: true, plays: 1, last_watched_at: '2026-10-18T23:00:00Z', feelings: ['touched'] },
    { id: 'e2', title_id: 's1', season: 3, episode: 7, watched: true, plays: 1, last_watched_at: '2026-10-19T23:30:00Z' },
    { id: 'm1', title_id: 'f1', kind: 'movie', watched: true, plays: 1, last_watched_at: '2026-09-01T23:00:00Z', rating: 5, feelings: ['thrilled'] },
  ].map(normEntry);
  const mirror = { cursor: 'c', entries: Object.fromEntries(entries.map((e) => [e.id, e])), titles: { f1: { id: 'f1', name: 'Perfect Days', minutes: 124 } } };
  const library = [
    { id: 's1', name: 'The Bear', kind: 'show', status: 'watch_next', minutes: 30 },
    { id: 's2', name: 'Ruptura', kind: 'show', status: 'collecting_dust', minutes: 50 },
    { id: 'f1', name: 'Perfect Days', kind: 'movie', status: 'watched', minutes: 124 },
  ];
  const seasons = { s1: { season: 3, episodes: Array.from({ length: 10 }, (_, i) => ({ episode: i + 1, watched: i < 7, feelings: i === 6 ? ['tense'] : [] })) } };
  const s = screens({ mirror, library, seasons }, span);
  const bear = s.shows.find((x) => x.title === 'The Bear');
  assert.deepEqual([bear.watched, bear.episodes, bear.next, bear.hours], [7, 10, 'T3 E8', 1]);
  assert.equal(s.shows.find((x) => x.kind === 'filme').hours, 2.1);
  assert.deepEqual(s.periods.year.feelings, { touched: 1, tense: 1, thrilled: 1 });
  assert.deepEqual(s.periods.week.feelings, { touched: 1, tense: 1 });
  assert.equal(s.watchlist.collecting_dust, 1);
  assert.equal(s.watchingDays[dayIndex('2026-10-19', 2026)], 30);
});

test('compose pads cached day arrays and survives a missing source', () => {
  assert.deepEqual(fit([1, 2], 4), [1, 2, 0, 0]);
  const d = compose({ read: { data: { readingDays: [5] }, status: 'failed', at: 1 }, listen: { data: null, status: 'missing' }, watch: { data: null, status: 'missing' } }, span, NOW);
  assert.equal(d.readingDays.length, span.days);
  assert.equal(d.listeningDays.length, span.days);
  assert.deepEqual(d.periods.week.artists, []);
  assert.equal(d.recentTrack, null);
  assert.equal(d.synthetic, false);
  assert.deepEqual(d.connections, { stars: [], links: [], soundtracks: {} });
  assert.ok(!JSON.stringify(d).includes('timeline'), 'raw timelines never reach the site');
});

test('compose keeps populated source timelines private', () => {
  const d = compose({
    read: { data: { timeline: [{ title: 'Duna', sittings: [[NOW - 3600000, NOW]] }] }, status: 'ok', at: NOW },
    listen: { data: { timeline: [[NOW - 60000, 1800000, 'Björk']], historySince: NOW - 7200000 }, status: 'ok', at: NOW },
    watch: { data: { timeline: [[NOW - 60000, 50, 'Shōgun', 'episode']] }, status: 'ok', at: NOW },
  }, span, NOW);
  assert.ok(d.connections.soundtracks.Duna, 'the links are computed');
  const json = JSON.stringify(d);
  assert.ok(!json.includes('timeline') && !json.includes('sittings') && !json.includes('historySince'), 'raw timelines never reach the site');
});

test('periods reach back across the new year, the year stays this year', () => {
  const span = yearSpan(Date.parse('2026-01-03T15:00:00Z'));
  const dec30 = Date.parse('2025-12-30T15:00:00Z');
  assert.equal(inPeriod(dec30, span, 7), true);
  assert.equal(inPeriod(dec30, span, null), false);
  assert.equal(inPeriod(Date.parse('2025-11-30T15:00:00Z'), span, 30), false);
  assert.equal(inPeriod(Date.parse('2026-01-03T15:00:00Z'), span, 7), true);
});

test('local ISO times keep minutes in her timezone', () => {
  assert.equal(localIso(Date.parse('2026-10-20T01:45:00Z')), '2026-10-19T22:45:00-03:00');
});

test('bingers entries as the API sends them: one per episode, kind from entity_kind', () => {
  const raw = (id, at) => ({ entity_kind: 'episode', entity_id: id, title_id: 's1', watched: true, plays: 1, first_watched_at: at, last_watched_at: at, rating: null, feeling: null, deleted: false });
  const entries = [raw('ep6', '2026-10-18T23:00:00Z'), raw('ep7', '2026-10-19T23:30:00Z'),
    { entity_kind: 'movie', entity_id: 'f1', title_id: 'f1', watched: true, plays: 1, last_watched_at: '2026-09-01T23:00:00Z', rating: 4, feeling: 'amused', deleted: false }].map(normEntry);
  assert.deepEqual(entries.map((e) => [e.id, e.kind]), [['episode:ep6', 'episode'], ['episode:ep7', 'episode'], ['movie:f1', 'movie']]);
  assert.deepEqual(entries[2].feelings, ['amused']);
  const mirror = { entries: Object.fromEntries(entries.map((e) => [e.id, e])), titles: {} };
  const library = [{ id: 's1', name: 'The Bear', kind: 'show', status: 'watch_next', minutes: 30 }, { id: 'f1', name: 'Perfect Days', kind: 'movie', status: 'watched', minutes: 124 }];
  const seasons = { s1: { season: 3, episodes: Array.from({ length: 10 }, (_, i) => ({ id: `ep${i + 1}`, season: 3, episode: i + 1, watched: i < 7, feelings: i === 6 ? ['tense'] : [] })) } };
  const s = screens({ mirror, library, seasons }, span);
  assert.deepEqual(s.shows.map((x) => [x.title, x.kind]), [['The Bear', 'série'], ['Perfect Days', 'filme']]);
  assert.equal(s.shows[0].next, 'T3 E8');
  assert.deepEqual(s.periods.year.feelings, { tense: 1, amused: 1 });
});

test('covers: one lookup per book, cached misses wait before trying again', async () => {
  const { covers, coverKey } = await import('../src/covers.js');
  const books = [{ title: 'Piranesi', author: 'Susanna Clarke' }, { title: 'Piranesi', author: 'Susanna Clarke' }, { title: 'Sem capa', author: '' }];
  const asked = [];
  const find = async (b) => (asked.push(b.title), { url: null, failed: false });
  const first = await covers(books, {}, NOW, find);
  assert.deepEqual(asked, ['Piranesi', 'Sem capa']);
  assert.deepEqual(Object.keys(first.images), []);
  await covers(books, first.cache, NOW + 86400000, find);
  assert.equal(asked.length, 2); // still inside the retry window
  await covers(books, first.cache, NOW + 15 * 86400000, find);
  assert.equal(asked.length, 4);
  assert.equal(coverKey(books[0]), 'piranesi|susanna clarke');
  // A miss from an older lookup is tried again at once; one where a catalogue errored is not kept.
  const old = { [coverKey(books[0])]: { url: null, at: NOW } };
  const again = await covers([books[0]], old, NOW, async () => ({ url: null, failed: true }));
  assert.deepEqual(again.cache, {});
});

test('covers: titles and authors as KOReader stores them', async () => {
  const { cleanTitle, mainTitle, cleanAuthor } = await import('../src/covers.js');
  assert.equal(cleanTitle('Torto Arado (Portuguese Edition)'), 'Torto Arado');
  assert.equal(mainTitle('Duna: Edição especial [ebook]'), 'Duna');
  assert.equal(mainTitle('O Avesso da Pele - Coleção X'), 'O Avesso da Pele');
  assert.equal(cleanAuthor('Lispector, Clarice'), 'Clarice Lispector');
  assert.equal(cleanAuthor('Neil Gaiman\nTerry Pratchett'), 'Neil Gaiman');
});

test('skoob: adds this year\'s finished books KOReader does not know', async () => {
  const { normSkoob, withSkoob } = await import('../src/skoob.js');
  const skoob = normSkoob([
    { title: 'Piranesi', author: ' Susanna Clarke ', pages: 272, finished_at: '2026-03-12T03:00:00Z', cover_filename: 'https://skoob.s3.amazonaws.com/livros/1/p.jpg' },
    { title: 'Torto Arado', author: 'Itamar Vieira Junior', pages: 264, finished_at: '2026-01-20T02:00:00Z' },
    { title: 'Velho', author: 'X', pages: 100, finished_at: '2025-12-01T12:00:00Z' },
    { title: 'Sem data', author: 'Y', pages: 50, finished_at: null },
    { title: 'Data ruim', author: 'Z', pages: 50, finished_at: 'ontem' },
    { title: 'Torto arado', author: 'Itamar Vieira Junior', pages: 264, finished_at: '2026-01-20T02:00:00Z' },
  ]);
  assert.equal(skoob.length, 4);
  assert.equal(skoob[0].author, 'Susanna Clarke');
  assert.equal(skoob[0].cover, 'https://skoob.s3.amazonaws.com/livros/1/p.jpg');
  assert.equal(skoob[1].cover, null);
  const read = { books: [{ title: 'Piranesi: edição especial', status: 'lido' }], library: [], fingerprints: [] };
  const out = withSkoob(read, skoob, span);
  assert.deepEqual(out.books.map((b) => b.title), ['Piranesi: edição especial', 'Torto Arado']);
  assert.equal(out.books[1].finished, '2026-01-19'); // finished_at is UTC; the day is hers
});

test('bingers feelings: lists, single words and JSON strings', async () => {
  const { feelingList } = await import('../src/bingers.js');
  assert.deepEqual(feelingList('["touched","thrilled"]'), ['touched', 'thrilled']);
  assert.deepEqual(feelingList('shocked'), ['shocked']);
  assert.deepEqual(feelingList(['amused', '["scared"]']), ['amused', 'scared']);
  assert.deepEqual(feelingList(null), []);
});

test('connections: what played during each book, silence, and shows in the same weeks', async () => {
  const { connections, sittings } = await import('../src/connections.js');
  const t = (iso) => Date.parse(iso);
  // Two page turns two minutes apart are one sitting; one an hour later is another.
  const s = sittings([{ start: t('2026-10-10T01:00:00Z'), seconds: 600 }, { start: t('2026-10-10T01:12:00Z'), seconds: 600 }, { start: t('2026-10-10T03:00:00Z'), seconds: 600 }]);
  assert.deepEqual(s, [[t('2026-10-10T01:00:00Z'), t('2026-10-10T01:22:00Z')], [t('2026-10-10T03:00:00Z'), t('2026-10-10T03:10:00Z')]]);
  const c = connections({
    books: [
      { title: 'Duna', sittings: [[t('2026-10-10T01:00:00Z'), t('2026-10-10T02:00:00Z')], [t('2026-10-12T01:00:00Z'), t('2026-10-12T01:30:00Z')]] },
      { title: 'Antigo', sittings: [[t('2026-01-05T01:00:00Z'), t('2026-01-05T02:00:00Z')]] },
    ],
    plays: [
      [t('2026-10-10T01:20:00Z'), 20 * 60000, 'Björk'], // 01:00 to 01:20, all during the book
      [t('2026-10-10T02:10:00Z'), 20 * 60000, 'Radiohead'], // 01:50 to 02:10, half of it
      [t('2026-10-11T12:00:00Z'), 60 * 60000, 'Björk'], // not while reading
    ],
    watched: [[t('2026-10-11T00:00:00Z'), 50, 'Shōgun', 'episode'], [t('2026-03-01T00:00:00Z'), 50, 'Dark', 'episode']],
    since: t('2026-10-01T00:00:00Z'),
  }, span);
  const d = c.soundtracks.Duna;
  assert.equal(d.covered, 90);
  assert.equal(d.music, 30);
  assert.deepEqual(d.artists, [{ name: 'Björk', minutes: 20 }, { name: 'Radiohead', minutes: 10 }]);
  // Read before the music history began: nothing can be said about its soundtrack.
  assert.equal(c.soundtracks.Antigo.covered, 0);
  const pairs = c.links.map((l) => `${l.a} ${l.b} ${l.how}`).sort();
  assert.deepEqual(pairs, ['book:Duna artist:Björk during', 'book:Duna artist:Radiohead during', 'book:Duna show:Shōgun weeks']);
  assert.equal(c.stars.find((x) => x.id === 'artist:Björk').hours, 1.3); // all the time with her this year
});

test('skoob: the same book under another title, a broken charset, or a cover from Skoob', async () => {
  const { sameRead, withSkoob } = await import('../src/skoob.js');
  const narnia = { title: 'As Crônicas de Nárnia - Coleção de Luxo: O Leão, a Feiticeira e o Guarda-Roupa', author: 'C. S. Lewis', finished: '2026-02-10' };
  assert.ok(sameRead(narnia, { title: 'O Le�o, a Feiticeira e o Guarda-Roupa (As Cr�nicas de N�rnia #1)', author: 'C. S. Lewis', finished: '2026-02-10' }));
  const choc = { title: 'Chocolate quente às quintas-feiras', author: 'Michiko Aoyama', finished: '2026-05-02' };
  assert.ok(sameRead(choc, { title: 'Chocolate Quente �s Quintas-Feiras', author: 'Michiko Aoyama', finished: '2026-05-03' }));
  // Another book by the same author months apart stays apart.
  assert.ok(!sameRead(choc, { title: 'A Biblioteca dos Sonhos Secretos', author: 'Michiko Aoyama', finished: '2026-08-20' }));
  assert.ok(!sameRead(choc, { title: 'A Biblioteca dos Sonhos Secretos', author: 'Michiko Aoyama', finished: '2026-05-03' }));
  assert.ok(!sameRead({ title: 'Harry Potter 1', author: 'J.K. Rowling' }, { title: 'Harry Potter 2', author: 'J.K. Rowling' }));
  const read = { books: [{ ...choc, status: 'lido' }], library: [], fingerprints: [] };
  const out = withSkoob(read, [{ title: 'Chocolate Quente �s Quintas-Feiras', author: 'Michiko Aoyama', pages: 160, finished: '2026-05-03', cover: 'https://example.org/c.jpg' }], span);
  assert.equal(out.books.length, 1);
  assert.equal(out.books[0].coverUrl, 'https://example.org/c.jpg');
});

test('screens: a backlog ticked off at once is not hours of that day', async () => {
  const { backfill } = await import('../src/bingers.js');
  const t0 = Date.parse('2026-09-08T15:00:00Z');
  const bulk = Array.from({ length: 30 }, (_, i) => ({ start: t0 + i * 2000, minutes: 45 }));
  // Three episodes marked together after watching them stay: a short burst.
  const evening = Array.from({ length: 3 }, (_, i) => ({ start: t0 + 86400000 + i * 60000, minutes: 45 }));
  const binge = Array.from({ length: 10 }, (_, i) => ({ start: t0 + 2 * 86400000 + i * 46 * 60000, minutes: 45 }));
  const epic = [{ start: t0 + 3 * 86400000, minutes: 420 }];
  const marked = backfill([...bulk, ...evening, ...binge, ...epic]);
  assert.equal(marked.size, 30);
  assert.ok(bulk.every((s) => marked.has(s)));
});

test('covers: Skoob\'s cover skips the lookup', async () => {
  const { covers } = await import('../src/covers.js');
  let asked = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, headers: new Map([['content-type', 'image/jpeg']]), arrayBuffer: async () => new ArrayBuffer(2000) });
  try {
    const out = await covers([{ title: 'A', author: 'B', coverUrl: 'https://example.org/a.jpg' }], {}, 1, async () => (asked++, { url: null, failed: false }));
    assert.equal(asked, 0);
    assert.equal(out.cache['a|b'].url, 'https://example.org/a.jpg');
    assert.ok(out.images['a|b']);
    // A broken Skoob address keeps the cover that already worked.
    globalThis.fetch = async (url) => (url.includes('skoob') ? { ok: false, headers: new Map() } : { ok: true, headers: new Map([['content-type', 'image/jpeg']]), arrayBuffer: async () => new ArrayBuffer(2000) });
    const kept = await covers([{ title: 'A', author: 'B', coverUrl: 'https://skoob.example/x.jpg' }], { 'a|b': { url: 'https://example.org/a.jpg', at: 1, v: 2 } }, 2);
    assert.equal(kept.cache['a|b'].url, 'https://example.org/a.jpg');
    assert.ok(kept.images['a|b']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('music: a play counts from when it began, not when it ended', () => {
  // Ended at 00:02 in São Paulo after four minutes: it began the day before, at 23:58.
  const p = { at: Date.parse('2026-03-11T03:02:00Z'), id: 'x', title: 'T', artists: ['A'], album: '', ms: 4 * 60000 };
  const out = music([p], null, span);
  const day = dayIndex('2026-03-10', span.year);
  assert.equal(out.listeningDays[day], 4);
  assert.equal(out.listeningDays[day + 1], 0);
  assert.equal(out.listeningSince, day);
});

test('connections: an artist heard for a few seconds is not part of the soundtrack', async () => {
  const { connections } = await import('../src/connections.js');
  const t = (iso) => Date.parse(iso);
  const c = connections({
    books: [{ title: 'Duna', sittings: [[t('2026-10-10T01:00:00Z'), t('2026-10-10T02:00:00Z')]] }],
    plays: [[t('2026-10-10T01:00:10Z'), 3 * 60000, 'Björk']], // only its last ten seconds fall in the sitting
    since: t('2026-01-01T00:00:00Z'),
  }, span);
  assert.deepEqual(c.soundtracks.Duna.artists, []);
});
