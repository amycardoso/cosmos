// Series and films, from the Bingers REST API (https://api.bingers.app/v1).
// The job mirrors /v1/entries with its change cursor, so after the first full read
// each run only asks for what changed.
//
// Field names follow the developer guide; where the guide does not spell a field out,
// the readers below accept the likely spellings. `npm run probe` prints the real keys.
import { minutesPerDay, clocks, inPeriod, PERIOD_DAYS, round1 } from './aggregate.js';
import { local, dayIndex } from './time.js';

const API = 'https://api.bingers.app/v1';
const EPISODE_MINUTES = 45; // used only when Bingers sends no runtime
const MOVIE_MINUTES = 110;
const BACKFILL_MINUTES = 360; // a burst of check-ins longer than this was marked after the fact
const MARATHON = 3; // episodes of one show in one day
const PACE_ROWS = 12;

// Retry-After is either seconds or an HTTP date; wait 5 s when it is missing, never over a minute.
function retryAfter(value) {
  const secs = Number(value);
  const ms = value && Number.isFinite(secs) ? secs * 1000 : value ? Date.parse(value) - Date.now() : NaN;
  return Math.min(60000, Math.max(0, Number.isFinite(ms) ? ms : 5000));
}

export async function get(path, env) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(API + path, { headers: { Authorization: `Bearer ${env.BINGERS_TOKEN}`, Accept: 'application/json' } });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, retryAfter(res.headers.get('retry-after'))));
      continue;
    }
    if (!res.ok) throw new Error(`Bingers ${path.split('?')[0]} answered ${res.status}`);
    return res.json();
  }
  throw new Error(`Bingers ${path.split('?')[0]} kept answering 429`);
}

const first = (...v) => v.find((x) => x !== undefined && x !== null);
const listIn = (page) => first(page.data, page.items, page.entries, page.results, Array.isArray(page) ? page : null) || [];

// Feelings come as a list, a single word, or a list serialised as a JSON string ('["touched","amused"]').
export function feelingList(v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.flatMap(feelingList);
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try {
      return feelingList(JSON.parse(v));
    } catch {
      return [];
    }
  }
  return [String(v).trim().toLowerCase()];
}

// An entry is one episode or one movie. The real API names it by entity_kind and
// entity_id and carries no season or episode number; those come from the episodes read.
export function normEntry(e) {
  const titleId = first(e.title_id, e.title?.id, typeof e.title === 'string' ? e.title : undefined, e.show_id, e.movie_id);
  const episode = first(e.episode, e.episode_number, e.number);
  const kind = /episode/i.test(String(first(e.entity_kind, e.kind, e.type, ''))) || episode != null ? 'episode' : 'movie';
  const entityId = first(e.entity_id, e.episode_id, e.id);
  return {
    id: entityId != null ? `${kind}:${entityId}` : `${titleId}:${e.season}:${episode}`,
    entityId: entityId == null ? null : String(entityId),
    titleId: titleId == null ? null : String(titleId),
    kind,
    season: first(e.season, e.season_number, null),
    episode: episode ?? null,
    watchedAt: Date.parse(first(e.last_watched_at, e.watched_at, e.first_watched_at, '')) || null,
    plays: first(e.plays, e.watched ? 1 : 0),
    watched: first(e.watched, (e.plays || 0) > 0),
    rating: first(e.rating, e.my_rating, null),
    feelings: feelingList(first(e.feelings, e.my_feelings, e.feeling)),
    minutes: first(e.runtime_minutes, e.runtime, null),
    deleted: Boolean(first(e.deleted, e.tombstone, e.deleted_at, false)),
  };
}

export function normTitle(id, t) {
  return {
    id: String(first(t.id, id)),
    name: first(t.name, t.title, 'Sem título'),
    kind: first(t.kind, t.type, null),
    year: first(t.year, null),
    minutes: first(t.runtime_minutes, t.runtime, null),
  };
}

// Pulls every change since the stored cursor into the mirror { cursor, entries, titles }.
// Bump when normEntry changes how entries are keyed or normalised, so the mirror is read again from the start.
const MIRROR_VERSION = 3;

export async function syncEntries(env, mirror) {
  if (mirror?.version !== MIRROR_VERSION) mirror = null;
  const m = { version: MIRROR_VERSION, cursor: mirror?.cursor || null, entries: { ...(mirror?.entries || {}) }, titles: { ...(mirror?.titles || {}) } };
  for (let guard = 0; guard < 200; guard++) {
    const q = new URLSearchParams({ include: 'titles' });
    if (m.cursor) q.set('cursor', m.cursor);
    const page = await get(`/entries?${q}`, env);
    for (const raw of listIn(page)) {
      const e = normEntry(raw);
      if (e.deleted) delete m.entries[e.id];
      else m.entries[e.id] = e;
    }
    for (const [id, t] of Object.entries(page.titles || {})) m.titles[id] = normTitle(id, t);
    const next = page.next_cursor;
    const more = first(page.has_more, listIn(page).length > 0);
    if (!next || next === m.cursor) break;
    m.cursor = next;
    if (!more) break;
  }
  return m;
}

// Every followed title with her status on it, paged.
export async function library(env) {
  const out = [];
  let cursor = null;
  for (let guard = 0; guard < 50; guard++) {
    const q = new URLSearchParams({ filter: 'all', limit: '200' });
    if (cursor) q.set('cursor', cursor);
    const page = await get(`/library?${q}`, env);
    out.push(...listIn(page));
    cursor = page.next_cursor;
    if (!cursor) break;
  }
  return out.map((t) => ({
    id: String(first(t.id, t.title_id)),
    name: first(t.name, t.title, 'Sem título'),
    kind: first(t.kind, t.type, null),
    status: first(t.status, t.my_status, null),
    minutes: first(t.runtime_minutes, t.runtime, null),
    genres: t.genres || [],
  }));
}

// Every episode of a show with her state on each, for the season she is in and per-episode feelings.
export async function episodes(env, titleId) {
  const page = await get(`/titles/${encodeURIComponent(titleId)}/episodes`, env);
  const list = first(page.episodes, listIn(page).length ? listIn(page) : null, (page.seasons || []).flatMap((s) => (s.episodes || []).map((e) => ({ season: s.number ?? s.season, ...e }))));
  return (list || []).map((e) => ({
    id: e.id == null ? null : String(e.id),
    season: first(e.season, e.season_number, null),
    episode: first(e.episode, e.number, e.episode_number),
    watched: Boolean(first(e.watched, e.my_watched, (e.plays || 0) > 0, false)),
    feelings: feelingList(first(e.feelings, e.my_feelings, e.feeling)),
  }));
}

const SHOW_STATUSES = ['watch_next', 'collecting_dust', 'caught_up', 'stopped'];
const QUEUE = ['watch_next', 'collecting_dust', 'caught_up', 'completed', 'stopped'];

export async function fetchBingers(env, mirror) {
  const synced = await syncEntries(env, mirror);
  const lib = await library(env);
  const watched = Object.values(synced.entries).filter((e) => e.watched && e.watchedAt);
  // Shows in progress, most recently watched first, with the season she is in.
  const lastByTitle = new Map();
  for (const e of watched) {
    if (e.kind !== 'episode') continue;
    const cur = lastByTitle.get(e.titleId);
    if (!cur || e.watchedAt > cur.watchedAt) lastByTitle.set(e.titleId, e);
  }
  const active = lib
    .filter((t) => SHOW_STATUSES.includes(t.status) && lastByTitle.has(t.id))
    .sort((a, b) => lastByTitle.get(b.id).watchedAt - lastByTitle.get(a.id).watchedAt)
    .slice(0, 6);
  const watchedIds = new Set(watched.map((e) => e.entityId));
  const seasons = {};
  for (const t of active) {
    // The episodes read carries no watched state; the entries feed does.
    const eps = (await episodes(env, t.id).catch(() => [])).map((e) => ({ ...e, watched: e.watched || watchedIds.has(e.id) }));
    const last = lastByTitle.get(t.id);
    // The season of the last episode she watched; failing that, the latest season with a watched episode.
    const s = first(last.season, eps.find((e) => e.id === last.entityId)?.season, Math.max(...eps.filter((e) => e.watched).map((e) => e.season ?? -1)));
    if (s == null || s < 0) continue;
    seasons[t.id] = { season: s, episodes: eps.filter((e) => e.season === s) };
  }
  return { mirror: synced, library: lib, seasons };
}

// Entries checked in faster than they could be watched (the next one less than half its
// runtime after the last) form a burst. A long burst is a backlog marked all at once, like a
// whole series ticked off in a minute: real hours for the show, but not hours of that day.
export function backfill(sessions) {
  const out = new Set();
  const sorted = [...sessions].sort((a, b) => a.start - b.start);
  let burst = [];
  const close = () => {
    // A single long film is not a burst.
    if (burst.length > 1 && burst.reduce((a, s) => a + s.minutes, 0) > BACKFILL_MINUTES) for (const s of burst) out.add(s);
  };
  for (const s of sorted) {
    const last = burst[burst.length - 1];
    if (last && s.start - last.start < (s.minutes * 60000) / 2) burst.push(s);
    else {
      close();
      burst = [s];
    }
  }
  close();
  return out;
}

// Marathons and pace, from the episodes she lived this year (backlogs ticked off at once left out).
// perDay counts episodes per day; a marathon is a day with MARATHON or more of one show.
// Each show's pace is its days with episodes, from the first to the last this year.
export function rhythm(lived, span, { nameOf, statusOf, seasons = {} }) {
  const perDay = new Array(span.days).fill(0);
  const byShowDay = new Map();
  for (const s of lived) {
    if (s.entry.kind !== 'episode') continue;
    const i = dayIndex(local(s.start).date, span.year);
    if (i < 0 || i >= span.days) continue;
    perDay[i]++;
    const days = byShowDay.get(s.entry.titleId) || new Map();
    days.set(i, (days.get(i) || 0) + 1);
    byShowDay.set(s.entry.titleId, days);
  }
  const best = new Map();
  for (const [id, days] of byShowDay) {
    for (const [i, n] of days) if (n >= MARATHON && !(best.get(i)?.[1] >= n)) best.set(i, [i, n, nameOf(id)]);
  }
  const marathons = [...best.values()].sort((a, b) => a[0] - b[0]);
  const pace = [...byShowDay]
    .map(([id, days]) => {
      const list = [...days].sort((a, b) => a[0] - b[0]);
      const first = list[0][0], last = list[list.length - 1][0];
      const s = seasons[id];
      const left = s ? s.episodes.filter((e) => e.episode > 0 && !e.watched).length : null;
      return { title: nameOf(id), status: statusOf(id), first, last, episodes: list.reduce((a, [, n]) => a + n, 0), days: list, season: s?.season ?? null, left };
    })
    .filter((p) => p.episodes > 1)
    .sort((a, b) => b.last - a.last)
    .slice(0, PACE_ROWS);
  return { perDay, marathons, pace };
}

export function screens({ mirror, library: lib, seasons }, span) {
  const titles = mirror.titles;
  const byId = new Map(lib.map((t) => [t.id, t]));
  const minutesOf = (e) => first(e.minutes, byId.get(e.titleId)?.minutes, titles[e.titleId]?.minutes, e.kind === 'movie' ? MOVIE_MINUTES : EPISODE_MINUTES);
  const nameOf = (id) => first(byId.get(id)?.name, titles[id]?.name, 'Sem título');
  const watched = Object.values(mirror.entries).filter((e) => e.watched && e.watchedAt);
  const sessions = watched.map((e) => ({ start: e.watchedAt, minutes: minutesOf(e), entry: e }));

  const feelings = (n) => {
    const out = {};
    for (const s of sessions) if (inPeriod(s.start, span, n)) for (const f of s.entry.feelings || []) out[f] = (out[f] || 0) + 1;
    return out;
  };
  // Episode feelings that only the per-season read carries.
  for (const [id, s] of Object.entries(seasons)) {
    for (const ep of s.episodes) {
      const e = watched.find((x) => x.titleId === id && (ep.id ? x.entityId === ep.id : x.season === s.season && x.episode === ep.episode));
      if (e && !(e.feelings || []).length && ep.feelings?.length) e.feelings = ep.feelings;
    }
  }

  const yearSessions = sessions.filter((s) => inPeriod(s.start, span, null));
  const marked = backfill(sessions);
  const lived = sessions.filter((s) => !marked.has(s));
  const hoursByTitle = new Map();
  for (const s of yearSessions) hoursByTitle.set(s.entry.titleId, (hoursByTitle.get(s.entry.titleId) || 0) + s.minutes / 60);

  const shows = Object.entries(seasons).map(([id, s]) => {
    const t = byId.get(id);
    const eps = s.episodes.filter((e) => e.episode > 0).sort((a, b) => a.episode - b.episode);
    const done = eps.filter((e) => e.watched).length;
    const next = eps.find((e) => !e.watched);
    return {
      title: nameOf(id), kind: 'série', status: t?.status, hours: round1(hoursByTitle.get(id) || 0),
      season: s.season, watched: done, episodes: eps.length, next: next ? `T${s.season} E${next.episode}` : null,
    };
  });
  const films = yearSessions
    .filter((s) => s.entry.kind === 'movie')
    .sort((a, b) => b.start - a.start)
    .map((s) => ({ title: nameOf(s.entry.titleId), kind: 'filme', hours: round1(s.minutes / 60), status: 'watched', rating: s.entry.rating }));

  const watchlist = Object.fromEntries(QUEUE.map((k) => [k, lib.filter((t) => t.status === k).length]));
  const { perDay, marathons, pace } = rhythm(lived, span, { nameOf, statusOf: (id) => byId.get(id)?.status ?? null, seasons });

  return {
    watchingDays: minutesPerDay(lived, span),
    watchingClocks: clocks(lived, span),
    shows: shows.concat(films),
    watchlist,
    episodesPerDay: perDay,
    marathons,
    pace,
    // For the connections only: [watched at, minutes, title, kind]. The site never receives it.
    timeline: yearSessions.filter((s) => !marked.has(s)).map((s) => [s.start, Math.round(s.minutes), nameOf(s.entry.titleId), s.entry.kind]),
    periods: { year: { feelings: feelings(null) }, month: { feelings: feelings(PERIOD_DAYS.month) }, week: { feelings: feelings(PERIOD_DAYS.week) } },
  };
}
