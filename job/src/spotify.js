// Music, from the Spotify Web API. Spotify only remembers the last 50 plays,
// so every run adds the new ones to a history the job keeps in its own store.
import { minutesPerDay, clocks, inPeriod, PERIOD_DAYS, round1 } from './aggregate.js';
import { local, dayIndex } from './time.js';

const API = 'https://api.spotify.com/v1';

export async function token(env) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: env.SPOTIFY_REFRESH_TOKEN }),
  });
  if (!res.ok) throw new Error(`Spotify token answered ${res.status}`);
  return (await res.json()).access_token;
}

async function get(path, access) {
  const res = await fetch(API + path, { headers: { Authorization: `Bearer ${access}` } });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`Spotify ${path.split('?')[0]} answered ${res.status}`);
  return res.json();
}

// One stored play: small on purpose, the history grows all year.
export function toPlay(item) {
  const t = item.track;
  return {
    at: Date.parse(item.played_at),
    id: t.id,
    title: t.name,
    artists: t.artists.map((a) => a.name),
    album: t.album?.name || '',
    image: smallest(t.album?.images),
    ms: t.duration_ms,
  };
}

const smallest = (images) => (images && images.length ? [...images].sort((a, b) => (a.width || 0) - (b.width || 0)).find((i) => (i.width || 0) >= 64)?.url || images[0].url : null);

// Merge new plays into the stored history, without duplicates, keeping this year and last.
export function mergeHistory(history, plays, span) {
  const seen = new Set(history.map((p) => p.at));
  const merged = history.concat(plays.filter((p) => !seen.has(p.at))).sort((a, b) => a.at - b.at);
  const from = Date.UTC(span.year - 1, 0, 1);
  return merged.filter((p) => p.at >= from);
}

export async function fetchSpotify(env, history, span) {
  const access = await token(env);
  const last = history.length ? history[history.length - 1].at : 0;
  const recent = await get(`/me/player/recently-played?limit=50${last ? `&after=${last}` : ''}`, access);
  const plays = (recent?.items || []).filter((i) => i.track).map(toPlay);
  const now = await get('/me/player/currently-playing', access).catch(() => null);
  return { history: mergeHistory(history, plays, span), nowPlaying: now?.item && now.is_playing ? now.item : null };
}

export function music(history, nowPlaying, span) {
  const sessions = history.map((p) => ({ start: p.at, minutes: p.ms / 60000, play: p }));
  const thisYear = history.filter((p) => inPeriod(p.at, span, null));
  const periodPlays = (n) => history.filter((p) => inPeriod(p.at, span, n));
  const latest = history[history.length - 1];
  const recent = nowPlaying
    ? { title: nowPlaying.name, artist: nowPlaying.artists.map((a) => a.name).join(', '), album: nowPlaying.album?.name || '', image: smallest(nowPlaying.album?.images), playing: true }
    : latest
      ? { title: latest.title, artist: latest.artists.join(', '), album: latest.album, image: latest.image, playedAt: latest.at }
      : null;
  const firstDay = thisYear.length ? dayIndex(local(thisYear[0].at).date, span.year) : null;

  return {
    listeningDays: minutesPerDay(sessions, span),
    listeningClocks: clocks(sessions, span),
    // The history starts on the first day the job ran; before that there is nothing to count.
    listeningSince: firstDay,
    recentTrack: recent,
    // For the connections only: [ended at, ms, first artist]. The site never receives it.
    timeline: thisYear.map((p) => [p.at, p.ms, p.artists[0]]),
    historySince: history.length ? history[0].at : null,
    periods: {
      year: lists(thisYear),
      month: lists(periodPlays(PERIOD_DAYS.month)),
      week: lists(periodPlays(PERIOD_DAYS.week)),
    },
  };
}

function lists(plays) {
  const tracks = new Map();
  const artists = new Map();
  for (const p of plays) {
    const key = p.id || p.title;
    const t = tracks.get(key) || { title: p.title, artist: p.artists[0], image: p.image, plays: 0 };
    t.plays++;
    tracks.set(key, t);
    // Time goes to the first credited artist, as Spotify's own summaries do.
    const a = p.artists[0];
    artists.set(a, (artists.get(a) || 0) + p.ms);
  }
  return {
    topTracks: [...tracks.values()].sort((a, b) => b.plays - a.plays).slice(0, 5),
    artists: [...artists.entries()].map(([name, ms]) => ({ name, hours: round1(ms / 3600000) })).sort((a, b) => b.hours - a.hours).slice(0, 12),
  };
}
