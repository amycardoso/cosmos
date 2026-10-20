// Small synthetic inputs shaped like the real sources.
import initSqlJs from 'sql.js';

// A KOReader statistics database with three books, in KOReader's own schema.
export async function statisticsDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`CREATE TABLE book (id integer PRIMARY KEY autoincrement, title text, authors text, notes integer,
    last_open integer, highlights integer, pages integer, series text, language text, md5 text,
    total_read_time integer, total_read_pages integer)`);
  db.run(`CREATE TABLE page_stat_data (id_book integer, page integer NOT NULL DEFAULT 0, start_time integer NOT NULL DEFAULT 0,
    duration integer NOT NULL DEFAULT 0, total_pages integer NOT NULL DEFAULT 0, UNIQUE (id_book, page, start_time))`);
  const add = db.prepare('INSERT INTO book (id, title, authors, pages, language, highlights) VALUES (?, ?, ?, ?, ?, ?)');
  add.run([1, 'A Hora da Estrela', 'Clarice Lispector', 88, 'pt-BR', 4]);
  add.run([2, 'Piranesi', 'Susanna Clarke', 100, 'en', 0]);
  add.run([3, 'Rayuela', 'Julio Cortázar', 600, 'es', 0]);
  add.free();
  const page = db.prepare('INSERT INTO page_stat_data VALUES (?, ?, ?, ?, ?)');
  const at = (iso) => Math.floor(Date.parse(iso) / 1000);
  // Book 1: read to page 55 of 88 on two evenings in October, 22h in São Paulo (01h UTC next day).
  for (let p = 1; p <= 30; p++) page.run([1, p, at('2026-10-17T01:00:00Z') + p * 60, 60, 88]);
  for (let p = 31; p <= 55; p++) page.run([1, p, at('2026-10-19T01:00:00Z') + p * 60, 60, 88]);
  // Book 2: finished in March, read under a 50-page layout (rescaled to 100), lingering at 20-29,
  // and coming back to pages 21-30 after reaching the end.
  for (let p = 1; p <= 50; p++) page.run([2, p, at('2026-03-10T12:00:00Z') + p * 120, p >= 10 && p <= 14 ? 600 : 120, 50]);
  for (let p = 11; p <= 15; p++) page.run([2, p, at('2026-03-20T12:00:00Z') + p * 120, 90, 50]);
  // Book 3: opened last year only.
  page.run([3, 1, at('2025-05-01T12:00:00Z'), 300, 600]);
  page.free();
  return db;
}

export const play = (iso, title, artist, minutes = 4) => ({
  played_at: iso,
  track: { id: `${artist}-${title}`, name: title, duration_ms: minutes * 60000, artists: [{ name: artist }], album: { name: 'Álbum', images: [{ url: 'https://i.scdn.co/a', width: 64 }] } },
});
