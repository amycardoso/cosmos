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
      { title: 'Torto Arado', author: 'Itamar Vieira Junior', hours: 14.2, status: 'lido', progress: 1 },
      { title: 'Tudo é Rio', author: 'Carla Madeira', hours: 9.1, status: 'lido', progress: 1 },
      { title: 'Duna', author: 'Frank Herbert', hours: 22.5, status: 'lido', progress: 1 },
      { title: 'O Avesso da Pele', author: 'Jeferson Tenório', hours: 8.4, status: 'lido', progress: 1 },
      { title: 'Projeto Hail Mary', author: 'Andy Weir', hours: 12.8, status: 'lido', progress: 1 },
      { title: 'A Hora da Estrela', author: 'Clarice Lispector', hours: 3.6, status: 'lendo', progress: 0.62 },
      { title: 'Os Despossuídos', author: 'Ursula K. Le Guin', hours: 6.1, status: 'pausado', progress: 0.38 },
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
