// Synthetic sample data, shaped like what the scheduled job will produce.
// Replace with the job's output; nothing here is real listening or reading history.
(function () {
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const r = rng(2026);

  // Minutes read per day, Jan 1 to Oct 19, 2026.
  const start = Date.UTC(2026, 0, 1);
  const today = Date.UTC(2026, 9, 19);
  const readingDays = [];
  for (let t = start; t <= today; t += 86400000) {
    const dow = new Date(t).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    let m = r() < 0.18 ? 0 : Math.round((weekend ? 55 : 30) + r() * (weekend ? 120 : 80));
    if (r() < 0.04) m += 90;
    readingDays.push(m);
  }
  // Keep the year's total close to the books listed below (about 80 hours so far).
  const scale = (80 * 60) / readingDays.reduce((a, b) => a + b, 0);
  for (let i = 0; i < readingDays.length; i++) readingDays[i] = Math.round(readingDays[i] * scale);

  // Reading by weekday (0 = Sunday) and hour: share of time, 0..1.
  const readingClock = [];
  for (let d = 0; d < 7; d++) {
    const row = [];
    for (let h = 0; h < 24; h++) {
      const night = Math.exp(-Math.pow((h - 22) / 1.6, 2));
      const morning = d === 0 || d === 6 ? 0.75 * Math.exp(-Math.pow((h - 9.5) / 1.4, 2)) : 0;
      const lunch = d > 0 && d < 6 ? 0.25 * Math.exp(-Math.pow((h - 12.5) / 0.6, 2)) : 0;
      row.push(Math.min(1, night + morning + lunch + r() * 0.06));
    }
    readingClock.push(row);
  }

  // Listening by hour of day, share 0..1.
  const listeningHours = Array.from({ length: 24 }, (_, h) =>
    Math.min(1, 0.08 + 0.7 * Math.exp(-Math.pow((h - 9) / 2.2, 2)) + 0.9 * Math.exp(-Math.pow((h - 15) / 3, 2)) + 0.4 * Math.exp(-Math.pow((h - 21) / 1.5, 2)) + r() * 0.05)
  );

  window.COSMOS_DATA = {
    synthetic: true,
    year: 2026,
    updatedAt: '2026-10-19T22:40:00-03:00',
    readingDays,
    readingClock,
    listeningHours,
    books: [
      { title: 'Torto Arado', pages: 264, author: 'Itamar Vieira Junior', hours: 14.2, status: 'lido', progress: 1 },
      { title: 'Tudo é Rio', pages: 208, author: 'Carla Madeira', hours: 9.1, status: 'lido', progress: 1 },
      { title: 'Duna', pages: 688, author: 'Frank Herbert', hours: 22.5, status: 'lido', progress: 1 },
      { title: 'O Avesso da Pele', pages: 192, author: 'Jeferson Tenório', hours: 8.4, status: 'lido', progress: 1 },
      { title: 'Projeto Hail Mary', pages: 400, author: 'Andy Weir', hours: 12.8, status: 'lido', progress: 1 },
      { title: 'A Hora da Estrela', pages: 88, author: 'Clarice Lispector', hours: 3.6, status: 'lendo', progress: 0.62 },
      { title: 'Os Despossuídos', pages: 384, author: 'Ursula K. Le Guin', hours: 6.1, status: 'pausado', progress: 0.38 },
    ],
    artists: [
      { name: 'Milton Nascimento', hours: 61 },
      { name: 'Gal Costa', hours: 38 },
      { name: 'Caetano Veloso', hours: 33 },
      { name: 'Liniker', hours: 29 },
      { name: 'Björk', hours: 24 },
      { name: 'Marisa Monte', hours: 21 },
      { name: 'Lô Borges', hours: 18 },
      { name: 'Radiohead', hours: 16 },
      { name: 'Elis Regina', hours: 14 },
      { name: 'Jorge Ben Jor', hours: 11 },
      { name: 'Rosalía', hours: 9 },
      { name: 'Tim Maia', hours: 7 },
    ],
    recentTrack: { title: 'Clube da Esquina nº 2', artist: 'Milton Nascimento', album: 'Clube da Esquina', playedAt: '2026-10-19T22:01:00-03:00' },
    topTracks: [
      { title: 'Clube da Esquina nº 2', artist: 'Milton Nascimento', plays: 48 },
      { title: 'Baby', artist: 'Gal Costa', plays: 37 },
      { title: 'Psiu', artist: 'Liniker', plays: 31 },
      { title: 'Jóga', artist: 'Björk', plays: 26 },
      { title: 'Trem Azul', artist: 'Lô Borges', plays: 22 },
    ],
    shows: [
      { title: 'The Bear', kind: 'série', hours: 19, status: 'watch_next', season: 3, watched: 7, episodes: 10, next: 'T3 E8' },
      { title: 'Ruptura', kind: 'série', hours: 15, status: 'collecting_dust', season: 2, watched: 4, episodes: 10, next: 'T2 E5' },
      { title: 'Shōgun', kind: 'série', hours: 11, status: 'completed', season: 1, watched: 10, episodes: 10 },
      { title: 'Arcane', kind: 'série', hours: 13, status: 'caught_up', season: 2, watched: 9, episodes: 9 },
      { title: 'Ainda Estou Aqui', kind: 'filme', hours: 2.3, status: 'watched' },
      { title: 'Perfect Days', kind: 'filme', hours: 2.1, status: 'watched' },
      { title: 'Duna: Parte Dois', kind: 'filme', hours: 2.8, status: 'watched' },
      { title: 'Dark', kind: 'série', hours: 8, status: 'stopped', season: 2, watched: 3, episodes: 8 },
    ],
    feelings: { touched: 14, thrilled: 11, tense: 9, amused: 8, shocked: 6, confused: 4, scared: 2, bored: 1 },
  };
})();

// Second pass: the rest of what the job will produce (music and screen rhythm,
// the library, per-page fingerprints). Also synthetic.
(function () {
  const D = window.COSMOS_DATA;
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const r = rng(717);
  const n = D.readingDays.length;
  const start = Date.UTC(2026, 0, 1);

  // Minutes listened and watched per day.
  D.listeningDays = [];
  D.watchingDays = [];
  for (let i = 0; i < n; i++) {
    const dow = new Date(start + i * 86400000).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    D.listeningDays.push(r() < 0.06 ? 0 : Math.round((weekend ? 40 : 75) + r() * 70));
    let w = r() < (weekend ? 0.25 : 0.55) ? 0 : Math.round(25 + r() * (weekend ? 110 : 50));
    // A few binge stretches.
    if ((i > 60 && i < 68) || (i > 175 && i < 181) || (i > 270 && i < 276)) w += 90 + Math.round(r() * 60);
    D.watchingDays.push(w);
  }
  const fit = (arr, hours) => {
    const k = (hours * 60) / arr.reduce((a, b) => a + b, 0);
    for (let i = 0; i < arr.length; i++) arr[i] = Math.round(arr[i] * k);
  };
  fit(D.listeningDays, 281);
  fit(D.watchingDays, 73);

  const clock = (fn) => Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => Math.max(0, Math.min(1, fn(d, h) + r() * 0.05))));
  const g = (h, c, w) => Math.exp(-Math.pow((h - c) / w, 2));
  D.listeningClock = clock((d, h) => (d === 0 || d === 6 ? 0.5 * g(h, 11, 2.5) + 0.4 * g(h, 17, 2) : 0.75 * g(h, 9, 1.6) + 0.9 * g(h, 15, 2.6)) + 0.35 * g(h, 21, 1.2));
  D.watchingClock = clock((d, h) => (d === 5 || d === 6 ? 0.9 * g(h, 21.5, 1.8) + (d === 6 ? 0.5 * g(h, 16, 1.8) : 0) : d === 0 ? 0.7 * g(h, 19, 2) : 0.55 * g(h, 20.5, 1)));

  D.books.forEach((b, i) => {
    b.lang = ['pt', 'pt', 'en', 'pt', 'en', 'pt', 'en'][i];
    b.finished = ['2026-02-08', '2026-03-15', '2026-06-02', '2026-07-01', '2026-09-12', null, null][i];
  });

  // The whole library, for the map. Status: finished, reading, on_hold, unread.
  D.library = [
    ...D.books.map((b) => ({ title: b.title, lang: b.lang, status: b.status === 'lido' ? 'finished' : b.status === 'lendo' ? 'reading' : 'on_hold' })),
    { title: 'Grande Sertão: Veredas', lang: 'pt', status: 'on_hold' },
    { title: 'Memórias Póstumas de Brás Cubas', lang: 'pt', status: 'finished' },
    { title: 'A Paixão segundo G.H.', lang: 'pt', status: 'unread' },
    { title: 'Água Viva', lang: 'pt', status: 'unread' },
    { title: 'Becos da Memória', lang: 'pt', status: 'unread' },
    { title: 'Cidade de Deus', lang: 'pt', status: 'finished' },
    { title: 'Klara and the Sun', lang: 'en', status: 'finished' },
    { title: 'Piranesi', lang: 'en', status: 'finished' },
    { title: 'The Left Hand of Darkness', lang: 'en', status: 'unread' },
    { title: 'Station Eleven', lang: 'en', status: 'unread' },
    { title: 'Ficciones', lang: 'es', status: 'finished' },
    { title: 'Cien años de soledad', lang: 'es', status: 'reading' },
    { title: 'Rayuela', lang: 'es', status: 'unread' },
    { title: 'Le Petit Prince', lang: 'fr', status: 'finished' },
  ];

  // Per-book fingerprint: minutes spent on each 10-page stretch, and re-read stretches.
  D.fingerprints = D.books.slice(0, 6).map((b, bi) => {
    const rr = rng(100 + bi);
    const total = Math.ceil(b.pages / 10);
    const upto = Math.ceil(total * b.progress);
    const hot = Math.floor(rr() * upto * 0.8) + 2;
    const stretches = Array.from({ length: total }, (_, i) => {
      if (i >= upto) return null;
      return 4 + rr() * 14 + 40 * Math.exp(-Math.pow((i - hot) / 2.5, 2));
    });
    const k = (b.hours * 60) / stretches.reduce((a, v) => a + (v || 0), 0);
    const mins = stretches.map((v) => (v == null ? null : Math.round(v * k)));
    const reread = rr() < 0.5 && upto > 10 ? [Math.floor(upto * 0.6), Math.floor(upto * 0.6) + 1] : null;
    return { title: b.title, pages: b.pages, hours: b.hours, status: b.status, progress: b.progress, mins, reread };
  });

  D.watchlist = { watch_next: 6, collecting_dust: 11, caught_up: 4, completed: 23, stopped: 5 };
})();

// Third pass: what changes with the period control. The job will compute these
// from the same raw history; here they are reshuffles of the year's values.
(function () {
  const D = window.COSMOS_DATA;
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const r = rng(4242);
  // Shorter periods: sparser clocks, since a week has fewer sessions.
  const thin = (grid, keep) => grid.map((row) => row.map((v) => (r() < keep ? v * (0.6 + r() * 0.6) : 0)));
  const cut = (list, k, key) => list
    .map((x) => { const v = x[key] * k * (0.5 + r()); return { ...x, [key]: key === 'hours' ? Math.max(0.2, Math.round(v * 10) / 10) : Math.max(1, Math.round(v)) }; })
    .sort((a, b) => b[key] - a[key]);
  const feel = (k) => Object.fromEntries(Object.entries(D.feelings).map(([f, v]) => [f, Math.round(v * k * (0.4 + r() * 1.2))]).filter(([, v]) => v > 0));
  D.periods = {
    year: {
      readingClock: D.readingClock, listeningClock: D.listeningClock, watchingClock: D.watchingClock,
      topTracks: D.topTracks, artists: D.artists, feelings: D.feelings,
    },
    month: {
      readingClock: thin(D.readingClock, 0.7), listeningClock: thin(D.listeningClock, 0.8), watchingClock: thin(D.watchingClock, 0.6),
      topTracks: cut(D.topTracks, 0.12, 'plays'), artists: cut(D.artists, 0.1, 'hours').slice(0, 10), feelings: feel(0.2),
    },
    week: {
      readingClock: thin(D.readingClock, 0.3), listeningClock: thin(D.listeningClock, 0.4), watchingClock: thin(D.watchingClock, 0.25),
      topTracks: cut(D.topTracks, 0.07, 'plays'), artists: cut(D.artists, 0.03, 'hours').slice(0, 6), feelings: feel(0.06),
    },
  };
})();

// Fourth pass: connections, as the job computes them from overlapping timestamps.
// Also synthetic.
(function () {
  const D = window.COSMOS_DATA;
  const hours = (kind, name) => {
    if (kind === 'book') return D.books.find((b) => b.title === name).hours;
    if (kind === 'artist') return (D.artists.find((a) => a.name === name) || { hours: 5 }).hours;
    return D.shows.find((s) => s.title === name).hours;
  };
  const during = [
    ['Torto Arado', 'Milton Nascimento', 260], ['Torto Arado', 'Gal Costa', 120],
    ['Tudo é Rio', 'Marisa Monte', 140], ['Tudo é Rio', 'Liniker', 90],
    ['Duna', 'Björk', 360], ['Duna', 'Radiohead', 180], ['Duna', 'Lô Borges', 40],
    ['O Avesso da Pele', 'Liniker', 110], ['O Avesso da Pele', 'Caetano Veloso', 80],
    ['Projeto Hail Mary', 'Radiohead', 150], ['Projeto Hail Mary', 'Caetano Veloso', 60], ['Projeto Hail Mary', 'Jorge Ben Jor', 30],
    ['A Hora da Estrela', 'Elis Regina', 70], ['A Hora da Estrela', 'Gal Costa', 40],
    ['Os Despossuídos', 'Björk', 90], ['Os Despossuídos', 'Lô Borges', 60],
  ];
  const weeks = [
    ['Torto Arado', 'film', 'Ainda Estou Aqui', 1], ['Duna', 'film', 'Duna: Parte Dois', 2], ['Duna', 'show', 'Arcane', 3],
    ['Projeto Hail Mary', 'show', 'Ruptura', 2], ['A Hora da Estrela', 'film', 'Perfect Days', 1], ['A Hora da Estrela', 'show', 'The Bear', 2],
    ['Os Despossuídos', 'show', 'Dark', 2],
  ];
  const stars = new Map();
  const star = (kind, name) => {
    const id = `${kind}:${name}`;
    if (!stars.has(id)) stars.set(id, { id, kind, name, hours: hours(kind, name) });
    return id;
  };
  const links = during.map(([b, a, minutes]) => ({ a: star('book', b), b: star('artist', a), minutes, how: 'during' }))
    .concat(weeks.map(([b, kind, s, n]) => ({ a: star('book', b), b: star(kind, s), weeks: n, how: 'weeks' })));
  const soundtracks = {};
  D.books.forEach((b) => {
    const mine = during.filter(([t]) => t === b.title).map(([, name, minutes]) => ({ name, minutes }));
    const music = mine.reduce((a, x) => a + x.minutes, 0);
    soundtracks[b.title] = { covered: Math.round(b.hours * 60), music, artists: mine };
  });
  D.connections = { stars: [...stars.values()], links, soundtracks };
})();

// Fifth pass: marathons and the pace of each show, as the job computes them from episode
// check-ins. Synthetic, written by hand so each kind of pace shows.
(function () {
  const D = window.COSMOS_DATA;
  const days = D.watchingDays.length;
  const day = (m, d) => Math.round((Date.UTC(D.year, m - 1, d) - Date.UTC(D.year, 0, 1)) / 86400000);
  const runs = (from, counts) => counts.map((n, k) => [from + k, n]).filter(([, n]) => n > 0);
  const weekly = (from, n) => Array.from({ length: n }, (_, k) => [from + k * 7, 1]);
  const shows = [
    { title: 'Dark', status: 'stopped', season: 2, left: 5, days: runs(day(1, 4), [3, 5, 0, 0, 0, 3, 4]).concat(runs(day(1, 24), [2, 0, 2])) },
    { title: 'Shōgun', status: 'completed', season: 1, left: 0, days: runs(day(3, 13), [1, 5, 0, 3, 0, 0, 1]) },
    { title: 'Ruptura', status: 'collecting_dust', season: 2, left: 6, days: weekly(day(5, 2), 4) },
    { title: 'Arcane', status: 'caught_up', season: 2, left: 0, days: runs(day(8, 15), [3, 6]) },
    { title: 'The Bear', status: 'watch_next', season: 3, left: 3, days: weekly(day(9, 1), 5).concat([[day(10, 13), 2]]) },
  ];
  D.episodesPerDay = new Array(days).fill(0);
  for (let i = 0; i < days; i++) if ((i * 37) % 11 < 3) D.episodesPerDay[i] = 1;
  const best = new Map();
  for (const s of shows) for (const [i, n] of s.days) {
    D.episodesPerDay[i] += n;
    if (n >= 3 && !(best.get(i)?.[1] >= n)) best.set(i, [i, n, s.title]);
  }
  D.marathons = [...best.values()].sort((a, b) => a[0] - b[0]);
  D.pace = shows
    .map((s) => ({ ...s, first: s.days[0][0], last: s.days[s.days.length - 1][0], episodes: s.days.reduce((a, [, n]) => a + n, 0) }))
    .sort((a, b) => b.last - a.last);
})();
