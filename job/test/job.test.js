import { test } from 'node:test';
import assert from 'node:assert/strict';
import { local, dayIndex, localIso } from '../src/time.js';
import { yearSpan, minutesPerDay, clock, inPeriod } from '../src/aggregate.js';
import { reading } from '../src/koreader.js';
import { toPlay, mergeHistory, music } from '../src/spotify.js';
import { normEntry, screens } from '../src/bingers.js';
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

test('music: history merges without duplicates and keeps two years', () => {
  const a = [play('2026-10-19T12:00:00Z', 'Baby', 'Gal Costa'), play('2026-10-19T12:04:00Z', 'Trem Azul', 'Lô Borges')].map(toPlay);
  const old = toPlay(play('2024-12-31T12:00:00Z', 'Old', 'X'));
  const h = mergeHistory([old, a[0]], a, span);
  assert.equal(h.length, 2);
  const m = music(h, null, span);
  assert.equal(m.recentTrack.title, 'Trem Azul');
  assert.equal(m.periods.week.topTracks.length, 2);
  assert.equal(m.periods.year.artists[0].hours, 0.1);
  assert.equal(m.listeningDays[dayIndex('2026-10-19', 2026)], 8);
  assert.equal(m.listeningSince, dayIndex('2026-10-19', 2026));
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
