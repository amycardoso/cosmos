// Code, from the GitHub GraphQL API: only her creative rhythm, never productivity.
// The job keeps when she committed (day and hour) and in which of her own projects;
// it never keeps commit messages, code, or counts of commits, pull requests or stars.
//
// Projects are the repositories she owns, plus those of the organisations named in
// COSMOS_GITHUB_ORGS (her own, like reformasimples). Other organisations (work) are left
// out, and any repository named in COSMOS_GITHUB_HIDE (comma separated) is too.
// A fine-grained token reaches one owner only, so the organisations are read with
// COSMOS_GITHUB_ORG_TOKEN when it is set.
import { clocks } from './aggregate.js';
import { local, dayIndex } from './time.js';

const API = 'https://api.github.com/graphql';
const PAGE = 100;

export async function gql(env, query, variables) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.COSMOS_GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'cosmos-job' },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 502 || res.status === 503) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const body = await res.json();
    if (body.errors?.length) throw new Error(`GitHub: ${body.errors[0].type || 'query error'}`);
    return body.data;
  }
  throw new Error('GitHub kept failing');
}

const VIEWER = `query { viewer { id login contributionsCollection { contributionYears } } }`;

const REPOS = `query($from: DateTime!, $to: DateTime!) { viewer { contributionsCollection(from: $from, to: $to) {
  commitContributionsByRepository(maxRepositories: 100) { repository {
    name owner { login } primaryLanguage { name } defaultBranchRef { name }
  } }
} } }`;

const HISTORY = `query($owner: String!, $name: String!, $author: ID!, $since: GitTimestamp!, $until: GitTimestamp!, $after: String) {
  repository(owner: $owner, name: $name) { defaultBranchRef { target { ... on Commit {
    history(first: ${PAGE}, after: $after, since: $since, until: $until, author: { id: $author }) {
      pageInfo { hasNextPage endCursor } nodes { authoredDate }
    }
  } } } }
}`;

const list = (v) => String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
export const orgs = (env) => [...new Set(list(env.COSMOS_GITHUB_ORGS))].sort();
// What a cached year was read under: a change in either list reads the years again.
export const settings = (env) => `${[...hidden(env)].sort().join(',')}|${orgs(env).join(',')}`;
export const hidden = (env) => new Set(String(env.COSMOS_GITHUB_HIDE || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));

// One year as raw material: each of her projects with the hours she committed in, each hour
// once (rounded down), so neither exact times nor a count of commits is ever kept.
// `complete` is false when a repository couldn't be read, so the year is read again next run.
// GitHub caps a contributions window at a year, so the window is the UTC year; a commit
// late on 31 December in São Paulo is still found through its repository's history.
async function readYear(env, owners, who, year, nowMs) {
  const to = new Date(Math.min(nowMs, Date.UTC(year, 11, 31, 23, 59, 59))).toISOString();
  const data = await gql(env, REPOS, { from: new Date(Date.UTC(year, 0, 1)).toISOString(), to });
  const hide = hidden(env);
  const repos = data.viewer.contributionsCollection.commitContributionsByRepository
    .map((c) => c.repository)
    .filter((r) => owners.has(r.owner.login.toLowerCase()) && r.defaultBranchRef && !hide.has(r.name.toLowerCase()));
  // Local year bounds, with a day's margin either side; the views keep only this year's local days.
  const since = new Date(Date.UTC(year, 0, 1) - 86400000).toISOString();
  const until = new Date(Math.min(nowMs, Date.UTC(year + 1, 0, 2))).toISOString();
  const out = [];
  let complete = true;
  for (const r of repos) {
    const times = [];
    let after = null;
    // A repository the token can't read is left out, not the whole year.
    try {
      do {
        const h = (await gql(env, HISTORY, { owner: r.owner.login, name: r.name, author: who.id, since, until, after }))
          .repository?.defaultBranchRef?.target?.history;
        if (!h) break;
        for (const n of h.nodes) {
          // Start of her local hour (not the UTC one, which is off for half-hour zones).
          const t = Math.floor(Date.parse(n.authoredDate) / 60000) * 60000;
          times.push(t - local(t).minute * 60000);
        }
        after = h.pageInfo.hasNextPage ? h.pageInfo.endCursor : null;
      } while (after);
    } catch {
      complete = false;
      continue;
    }
    if (times.length) out.push({ name: r.name, lang: r.primaryLanguage?.name || null, times: [...new Set(times)].sort((a, b) => a - b) });
  }
  return { repos: out, complete };
}

// Past years don't change, so each is read once and kept; the current year is read every run.
// cache: { [year]: { at, hide, repos } }. Returns { years: { [year]: repos }, cache }.
// A year read under another COSMOS_GITHUB_HIDE is read again, so an unhidden project comes back.
export async function fetchGitHub(env, cache = {}, nowMs = Date.now()) {
  const who = (await gql(env, VIEWER)).viewer;
  const hide = hidden(env);
  const hideKey = settings(env);
  // Her own repositories with her token; her organisations with theirs, when there is one.
  const passes = [{ env, owners: new Set([who.login.toLowerCase()]) }];
  if (orgs(env).length) passes.push({ env: { ...env, COSMOS_GITHUB_TOKEN: env.COSMOS_GITHUB_ORG_TOKEN || env.COSMOS_GITHUB_TOKEN }, owners: new Set(orgs(env)) });
  const readAll = async (y) => {
    const out = { repos: [], complete: true };
    for (const p of passes) {
      try {
        const r = await readYear(p.env, p.owners, who, y, nowMs);
        out.repos.push(...r.repos);
        out.complete &&= r.complete;
      } catch (err) {
        if (p.env === env) throw err; // her own token failing fails the source, as before
        console.log(`code: organisations not read (${err.message})`);
        out.complete = false;
      }
    }
    return out;
  };
  const current = Number(local(nowMs).date.slice(0, 4));
  const years = {};
  const next = {};
  for (const y of who.contributionsCollection.contributionYears) {
    const done = cache[y] && cache[y].at > Date.UTC(y + 1, 0, 2) && y < current && (cache[y].hide || '') === hideKey;
    const read = done ? { repos: cache[y].repos, complete: true } : await readAll(y);
    // A year with a repository that failed to read is kept for now but never counted as done.
    next[y] = { at: done ? cache[y].at : read.complete ? nowMs : 0, hide: hideKey, repos: read.repos };
    years[y] = read.repos;
  }
  for (const y in years) years[y] = years[y].filter((r) => !hide.has(r.name.toLowerCase()));
  return { years, cache: next };
}

// The year a raw year belongs to may hold a few commits from the days either side.
// years: { [year]: repos } for every year read. Returns the view of one year.
export function code(years, span) {
  const repos = new Map();
  const slot = (t) => { const l = local(t); return `${l.date} ${l.hour}`; };
  // The clocks see every hour, so a last month or week can reach back across the new year.
  const all = new Map();
  for (const list of Object.values(years)) {
    for (const r of list) {
      for (const t of r.times) if (!all.has(slot(t))) all.set(slot(t), t);
      const keep = r.times.filter((t) => {
        const i = dayIndex(local(t).date, span.year);
        return i >= 0 && i < span.days;
      });
      if (!keep.length) continue;
      const have = repos.get(r.name) || { name: r.name, lang: r.lang, times: [] };
      have.times.push(...keep);
      repos.set(r.name, have);
    }
  }
  // An hour with a commit counts once, whatever the number of commits in it.
  const slots = new Map(); // 'YYYY-MM-DD h' -> start ms
  const projects = [];
  const timeline = []; // [hour start, project], for the connections only; the site never receives it
  let recent = null;
  for (const r of repos.values()) {
    const days = new Set();
    for (const t of new Set(r.times)) {
      timeline.push([t, r.name]);
      days.add(dayIndex(local(t).date, span.year));
      const key = slot(t);
      if (!slots.has(key)) slots.set(key, t);
      if (!recent || t > recent.at) recent = { name: r.name, lang: r.lang, at: t };
    }
    projects.push({ name: r.name, lang: r.lang, days: [...days].sort((a, b) => a - b) });
  }
  projects.sort((a, b) => b.days.length - a.days.length || b.days[b.days.length - 1] - a.days[a.days.length - 1] || a.name.localeCompare(b.name));

  const codingDays = new Array(span.days).fill(0);
  for (const key of slots.keys()) codingDays[dayIndex(key.split(' ')[0], span.year)] += 1;
  const sessions = [...all.values()].map((t) => ({ start: t, minutes: 1 }));

  // Each project's language, weighed by the days she spent in it.
  const weight = new Map();
  for (const p of projects) if (p.lang) weight.set(p.lang, (weight.get(p.lang) || 0) + p.days.length);
  const languages = [...weight].sort((a, b) => b[1] - a[1]).map(([name, days]) => ({ name, days }));

  return {
    codingDays,
    codingClocks: clocks(sessions, span),
    projects,
    languages,
    recent: span.past || !recent ? null : { ...recent, at: new Date(recent.at).toISOString() },
    timeline: timeline.sort((a, b) => a[0] - b[0]),
  };
}
