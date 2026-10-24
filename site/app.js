// Cosmos: renders window.COSMOS_DATA into the page. No framework, no network.
(function () {
  const D = window.COSMOS_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, kids = []) => {
    const n = tag.startsWith('svg:') ? document.createElementNS(NS, tag.slice(4)) : document.createElement(tag);
    for (const k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    kids.forEach((c) => c && n.append(c));
    return n;
  };

  // Titles and names come from outside (KOReader, Spotify, Bingers): escape before any innerHTML.
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const emptyNote = (host, text) => host.append(el('p', { class: 'empty', text }));

  const COLORS = { read: '#F2A8C7', music: '#84CDEE', screen: '#B5A2EC', deep: '#111019', pole: '#A86A4E', spot: '#3948CF' };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
  const RAMP = (c) => [COLORS.deep, mix(COLORS.deep, c, 0.3), mix(COLORS.deep, c, 0.52), mix(COLORS.deep, c, 0.76), c];

  // Five steps by quartile of your own non-zero history, like Atlas year.
  function quartiles(values) {
    const v = values.filter((x) => x > 0).sort((a, b) => a - b);
    if (!v.length) return [Infinity, Infinity, Infinity];
    const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
    return [q(0.25), q(0.5), q(0.75)];
  }
  const level = (x, qs) => (x <= 0 ? 0 : x <= qs[0] ? 1 : x <= qs[1] ? 2 : x <= qs[2] ? 3 : 4);

  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MON = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const DOW_LONG = ['aos domingos', 'às segundas', 'às terças', 'às quartas', 'às quintas', 'às sextas', 'aos sábados'];
  const START = Date.UTC(D.year, 0, 1);
  const N = D.readingDays.length; // days so far; the last one is today
  const dayDate = (i) => new Date(START + i * 86400000);
  const fmtDay = (i) => { const d = dayDate(i); return `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
  const num = (x, dp = 0) => x.toLocaleString('pt-BR', { maximumFractionDigits: dp, minimumFractionDigits: 0 });
  function fmtMin(m) {
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return h >= 20 || !r ? `${h} h` : `${h} h ${r} min`;
  }

  const STREAMS = [
    { key: 'read', name: 'Leitura', verb: 'lendo', days: D.readingDays },
    { key: 'music', name: 'Música', verb: 'ouvindo', days: D.listeningDays },
    { key: 'screen', name: 'Telas', verb: 'de séries e filmes', days: D.watchingDays },
  ];
  STREAMS.forEach((s) => (s.qs = quartiles(s.days)));

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PERIODS = { week: 7, month: 30, year: N };
  let period = 'year';
  const range = () => [N - PERIODS[period], N];
  const sum = (a, [from, to]) => a.slice(from, to).reduce((x, y) => x + y, 0);

  // ---------- Overview ----------
  function renderOverview() {
    const r = range();
    const today = dayDate(N - 1);
    $('[data-title]').innerHTML =
      period === 'year' ? `${D.year} <span>até ${today.getUTCDate()} de ${MONTHS[today.getUTCMonth()]}</span>`
      : period === 'month' ? 'Últimos 30 dias' : 'Últimos 7 dias';
    const lede = $('[data-lede]');
    if (!lede.children.length) lede.innerHTML = '<b class="r"></b> lendo, <b class="m"></b> ouvindo e <b class="s"></b> de séries e filmes.';
    STREAMS.forEach((s, k) => countTo(lede.children[k], sum(s.days, r)));

    const months = $('[data-months]');
    months.textContent = '';
    STREAMS.forEach((s) => renderBand(s, r));
    if (period === 'year') {
      const offset = dayDate(0).getUTCDay();
      for (let m = 0; m < 12; m++) {
        const i = Math.round((Date.UTC(D.year, m, 1) - START) / 86400000);
        months.append(el('span', { text: MON[m], style: `left:${(Math.floor((i + offset) / 7) / 53) * 100}%` }));
      }
    } else {
      months.append(el('span', { text: fmtDay(r[0]), style: 'left:0' }), el('span', { text: 'hoje', style: 'right:0' }));
    }
    $('[data-readout]').textContent = 'Passe o dedo ou o mouse pelas faixas para ver os três hábitos de cada dia.';
    hit = null;
    renderLines(r);
  }

  // Totals count from where they were to the new value, so a period change reads as a change.
  function countTo(node, to) {
    const from = +(node.dataset.v || 0);
    node.dataset.v = to;
    if (REDUCED || from === to) { node.textContent = fmtMin(to); return; }
    const t0 = performance.now();
    const step = (t) => {
      if (+node.dataset.v !== to) return; // a newer count took over
      const p = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - p, 4);
      node.textContent = fmtMin(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // One day in focus lights up in all three belts, and the readout gives all three numbers.
  let hit = null;
  function highlightDay(i) {
    if (i === hit) return;
    hit = i;
    STREAMS.forEach((s) => {
      s.svg?.querySelector('rect.hit')?.classList.remove('hit');
      s.svg?.querySelector(`[data-i="${i}"]`)?.classList.add('hit');
    });
    const v = (s) => (s.days[i] ? fmtMin(s.days[i]) : 'nada');
    $('[data-readout]').innerHTML = `<b>${fmtDay(i)}</b> · ${STREAMS.map((s) => `<span class="${s.key}">${s.name.toLowerCase()} ${v(s)}</span>`).join(' · ')}`;
  }

  function renderBand(s, [from, to]) {
    const host = $(`[data-band="${s.key}"]`);
    host.textContent = '';
    const ramp = RAMP(COLORS[s.key]);
    const total = sum(s.days, [from, to]);
    host.append(el('p', { class: 'band__label', html: `<b>${s.name}</b><small>${fmtMin(total)}</small>` }));
    const cell = 12, gap = 3;
    let svg;
    if (period === 'year') {
      const offset = dayDate(0).getUTCDay();
      const daysInYear = (Date.UTC(D.year + 1, 0, 1) - START) / 86400000;
      svg = el('svg:svg', { viewBox: `0 0 ${53 * (cell + gap) - gap} ${7 * (cell + gap) - gap}` });
      for (let i = 0; i < daysInYear; i++) {
        const c = Math.floor((i + offset) / 7), row = (i + offset) % 7;
        const future = i >= N;
        svg.append(el('svg:rect', {
          x: c * (cell + gap), y: row * (cell + gap), width: cell, height: cell, rx: 2,
          fill: future ? 'none' : ramp[level(s.days[i], s.qs)],
          stroke: future ? 'rgba(237,241,250,.08)' : 'none',
          'data-i': future ? '' : i,
        }));
      }
    } else {
      // A week is seven wide tiles; a month is a strip of square days.
      const n = to - from, cw = period === 'week' ? 100 : 18, ch = period === 'week' ? 26 : 18;
      svg = el('svg:svg', { viewBox: `0 0 ${n * (cw + gap) - gap} ${ch}` });
      for (let k = 0; k < n; k++) {
        const i = from + k;
        svg.append(el('svg:rect', { x: k * (cw + gap), y: 0, width: cw, height: ch, rx: 3, fill: ramp[level(s.days[i], s.qs)], 'data-i': i }));
      }
    }
    // Today carries the planet's spot: deep blue inside a pale ring, as on the planet.
    const today = svg.querySelector(`[data-i="${N - 1}"]`);
    if (today) {
      const k = svg.viewBox.baseVal.width / ($('[data-readout]').clientWidth || 600); // units per screen px
      today.setAttribute('stroke', COLORS.spot);
      today.setAttribute('stroke-width', 2.5 * k);
      const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((a) => +today.getAttribute(a));
      const o = 2.5 * k;
      svg.append(el('svg:rect', { class: 'today-ring', x: x - o, y: y - o, width: w + 2 * o, height: h + 2 * o, rx: 3 * k, fill: 'none', stroke: '#EDF1FA', 'stroke-width': 1.25 * k, 'pointer-events': 'none' }));
    }
    // Cells fill in from left to right when the period changes.
    if (!REDUCED) {
      const rects = [...svg.querySelectorAll('rect[data-i]')];
      // Like the day moving across the planet, each belt a beat behind the one above.
      const row = STREAMS.indexOf(s);
      rects.forEach((rc) => rc.animate([{ opacity: 0.15 }, { opacity: 1 }], { duration: 560, delay: Math.round((+rc.getAttribute('x') / svg.viewBox.baseVal.width) * 520) + row * 80, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    }
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${s.name}: ${fmtMin(total)} no período, dia a dia.`);
    const show = (e) => {
      const i = e.target.getAttribute && e.target.getAttribute('data-i');
      if (i === null || i === '' || i === undefined) return;
      highlightDay(+i);
    };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    s.svg = svg;
    host.append(svg);
  }

  // A book cover served from the site itself, or a plain spine-coloured tile when none was found.
  const cover = (b) => (b.cover
    ? el('img', { class: 'cover', src: b.cover, alt: '', loading: 'lazy', decoding: 'async' })
    : el('span', { class: 'cover cover--none', 'aria-hidden': 'true' }));

  function renderNow() {
    const reading = D.books.find((b) => b.status === 'lendo');
    const next = D.shows.find((x) => x.status === 'watch_next' && x.next);
    const t = D.recentTrack;
    const li = (c, html) => el('li', { html: `<i class="sw" style="background:${c}" aria-hidden="true"></i>${html}` });
    const host = $('[data-now]');
    if (reading) {
      const row = li(COLORS.read, `Lendo <em>${esc(reading.title)}</em><small>${esc(reading.author)} · ${Math.round(reading.progress * 100)}%</small><span class="meter" style="color:${COLORS.read}"><span style="width:${reading.progress * 100}%"></span></span>`);
      // With a cover, the line sits beside it.
      if (reading.cover) {
        const text = el('div');
        text.append(...row.childNodes);
        row.classList.add('with-cover');
        row.append(cover(reading), text);
      }
      host.append(row);
    }
    if (t) {
      const when = t.playing ? 'Tocando agora' : `Tocou às ${clockTime(t.playedAt)}`;
      host.append(li(COLORS.music, `${when}: <em>${esc(t.title)}</em><small>${esc(t.artist)}${t.album ? ', ' + esc(t.album) : ''}</small>`));
    }
    if (next) host.append(li(COLORS.screen, `Próximo: ${esc(next.next)} de <em>${esc(next.title)}</em><small>${next.watched} de ${next.episodes} episódios da temporada</small><span class="meter" style="color:${COLORS.screen}"><span style="width:${(next.watched / Math.max(1, next.episodes)) * 100}%"></span></span>`));
  }

  // "22h01" from an ISO string or a timestamp, in the viewer's own clock.
  function clockTime(v) {
    const d = new Date(v);
    return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function renderLines(r) {
    const label = period === 'year' ? 'em ' + D.year : period === 'month' ? 'nos últimos 30 dias' : 'nos últimos 7 dias';
    const done = D.books.filter((b) => b.status === 'lido').length;
    const films = D.shows.filter((x) => x.kind === 'filme').length;
    $('[data-read-line]').textContent = `${fmtMin(sum(D.readingDays, r))} ${label}. ${plural(done, 'livro terminado', 'livros terminados')} no ano.`;
    const topArtist = D.periods[period].artists[0];
    const since = D.sources?.music?.since;
    const counted = since > 0 && r[0] < since ? ` (contando desde ${fmtDay(since)})` : '';
    $('[data-music-line]').textContent = `${fmtMin(sum(D.listeningDays, r))} ${label}${counted}.${topArtist ? ` Quem mais tocou: ${topArtist.name}.` : ''}`;
    $('[data-screen-line]').textContent = `${fmtMin(sum(D.watchingDays, r))} ${label}. ${plural(films, 'filme', 'filmes')} no ano.`;
  }

  // ---------- Hour x weekday, the three habits together ----------
  // Each hour of the week is a cell split in three stripes: reading, music, screens,
  // each on its own quartile ramp. Picking one stream draws it alone, in whole cells.
  let dayShow = 'all';
  const LEVEL_WORDS = ['nada', 'pouco', 'às vezes', 'muito', 'o mais forte'];
  function renderDay(sweep = true) {
    const host = $('[data-day]');
    host.textContent = '';
    const P = D.periods[period];
    const grids = { read: P.readingClock, music: P.listeningClock, screen: P.watchingClock };
    const levels = {};
    STREAMS.forEach((s) => {
      const clean = grids[s.key].map((row) => row.map((v) => (v < 0.1 ? 0 : v)));
      const qs = quartiles(clean.flat());
      levels[s.key] = clean.map((row) => row.map((v) => level(v, qs)));
    });
    const small = window.matchMedia('(max-width: 640px)').matches;
    const cw = small ? 12 : 27, ch = small ? 14 : 18, gap = small ? 2 : 4, left = small ? 30 : 40, top = 22;
    const svg = el('svg:svg', { viewBox: `0 0 ${left + 24 * (cw + gap)} ${top + 7 * (ch + gap)}`, role: 'img' });
    const fs = small ? 'font-size:11px' : '';
    [0, 6, 12, 18].forEach((h) => svg.append(el('svg:text', { x: left + h * (cw + gap), y: 12, text: `${h}h`, style: fs })));
    const shown = dayShow === 'all' ? STREAMS : STREAMS.filter((s) => s.key === dayShow);
    const sw = (cw - (shown.length - 1)) / shown.length;
    for (let d = 0; d < 7; d++) {
      svg.append(el('svg:text', { x: 0, y: top + d * (ch + gap) + ch - 3, text: DOW[d], style: fs }));
      for (let h = 0; h < 24; h++) {
        const g = el('svg:g', { 'data-d': d, 'data-h': h });
        shown.forEach((s, k) => g.append(el('svg:rect', { x: left + h * (cw + gap) + k * (sw + 1), y: top + d * (ch + gap), width: sw, height: ch, rx: 1.5, fill: RAMP(COLORS[s.key])[levels[s.key][d][h]] })));
        // A transparent cover over the whole cell takes the pointer.
        g.append(el('svg:rect', { class: 'cell', x: left + h * (cw + gap) - gap / 2, y: top + d * (ch + gap) - gap / 2, width: cw + gap, height: ch + gap, fill: 'transparent' }));
        if (sweep && !REDUCED) g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: h * 22 + d * 6, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
        svg.append(g);
      }
    }
    const readout = $('[data-day-readout]');
    readout.textContent = 'Passe pela grade para ver uma hora da semana.';
    const show = (e) => {
      const g = e.target.closest && e.target.closest('g[data-d]');
      if (!g) return;
      const d = +g.dataset.d, h = +g.dataset.h;
      svg.querySelector('.hit')?.classList.remove('hit');
      g.classList.add('hit');
      readout.innerHTML = `<b>${DOW[d]}, ${h}h</b> · ${STREAMS.map((s) => `<span class="${s.key}">${s.name.toLowerCase()}: ${LEVEL_WORDS[levels[s.key][d][h]]}</span>`).join(' · ')}`;
    };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    host.append(svg);

    // One peak sentence per stream, under the grid.
    const verbs = { read: 'Leio', music: 'Ouço', screen: 'Assisto' };
    const peaks = [];
    STREAMS.forEach((s) => {
      let best = [0, 0, 0];
      grids[s.key].forEach((row, d) => row.forEach((v, h) => { if (v >= 0.1 && v > best[2]) best = [d, h, v]; }));
      const line = best[2] > 0 ? `${verbs[s.key]} mais ${DOW_LONG[best[0]]}, por volta das ${best[1]}h.` : `${s.name}: nada no período.`;
      $(`[data-${s.key}-peak]`).textContent = line;
      peaks.push(line);
    });
    svg.setAttribute('aria-label', `As horas da semana dos três hábitos. ${peaks.join(' ')}`);
  }
  const picks = [...document.querySelectorAll('[data-show]')];
  function setDayShow(v) {
    dayShow = v;
    picks.forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.show === v)); b.tabIndex = b.dataset.show === v ? 0 : -1; });
    renderDay(false);
  }
  picks.forEach((b, i) => {
    b.addEventListener('click', () => setDayShow(b.dataset.show));
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const nb = picks[(i + d + picks.length) % picks.length];
      nb.focus();
      setDayShow(nb.dataset.show);
    });
  });

  // ---------- Connections ----------
  const KIND = { book: 'read', artist: 'music', show: 'screen', film: 'screen' };
  function renderSky() {
    const host = $('[data-sky]');
    host.textContent = '';
    const C = D.connections || { stars: [], links: [] };
    const readout = $('[data-sky-readout]');
    const books = C.stars.filter((x) => x.kind === 'book').length;
    $('[data-links-line]').textContent = C.links.length
      ? `${plural(books, 'livro ligado', 'livros ligados')} a ${plural(C.stars.length - books, 'artista, série ou filme', 'artistas, séries e filmes')}.`
      : '';
    if (!C.links.length) {
      const since = D.sources?.music?.since;
      readout.textContent = '';
      return emptyNote(host, `As estrelas aparecem quando houver música tocando durante a leitura${since > 0 ? `; o histórico de música começa em ${fmtDay(since)}` : ''}.`);
    }
    // A small force layout, run once before drawing so the sky is still when it appears.
    const narrow = (host.clientWidth || 900) < 640;
    const W = narrow ? 420 : 1000, H = narrow ? 620 : 540;
    const stars = C.stars.map((x, i) => ({ ...x, i, r: Math.min(20, 3.5 + Math.sqrt(x.hours || 0) * 1.8) }));
    const byId = new Map(stars.map((x) => [x.id, x]));
    const links = C.links.map((l) => ({ ...l, a: byId.get(l.a), b: byId.get(l.b) })).filter((l) => l.a && l.b);
    const rnd = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
    const home = { book: [0.35, 0.5], artist: [0.6, 0.4], show: [0.65, 0.65], film: [0.65, 0.65] };
    stars.forEach((x) => { x.x = (home[x.kind][0] + (rnd() - 0.5) * 0.4) * W; x.y = (home[x.kind][1] + (rnd() - 0.5) * 0.5) * H; });
    for (let it = 0; it < 500; it++) {
      const k = 1 - it / 500;
      for (const a of stars) for (const b of stars) {
        if (a === b) continue;
        const dx = a.x - b.x, dy = a.y - b.y, d2 = Math.max(60, dx * dx + dy * dy);
        a.x += (dx * 52 / d2) * k; a.y += (dy * 52 / d2) * k;
      }
      for (const l of links) {
        const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, d = Math.hypot(dx, dy) || 1;
        const f = (d - 110) * 0.012 * k;
        l.a.x += (dx / d) * f; l.a.y += (dy / d) * f; l.b.x -= (dx / d) * f; l.b.y -= (dy / d) * f;
      }
      for (const x of stars) { x.x += (W / 2 - x.x) * 0.004; x.y += (H / 2 - x.y) * 0.006; }
    }
    // Stretch to fill the sky, keeping room for labels on the right.
    const xs = stars.map((x) => x.x), ys = stars.map((x) => x.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const padR = narrow ? 120 : 170;
    stars.forEach((x) => { x.x = 24 + ((x.x - x0) / (x1 - x0 || 1)) * (W - 24 - padR); x.y = 28 + ((x.y - y0) / (y1 - y0 || 1)) * (H - 56); });
    // Then nudge stars apart until no name runs into another star or name.
    const box = (x) => [x.x - x.r - 2, x.y - Math.max(x.r, 9) - 2, x.x + x.r + 8 + x.name.length * 7, x.y + Math.max(x.r, 9) + 2];
    for (let it = 0; it < 300; it++) {
      let moved = false;
      for (const a of stars) for (const b of stars) {
        if (a.i >= b.i) continue;
        const [ax0, ay0, ax1, ay1] = box(a), [bx0, by0, bx1, by1] = box(b);
        const ox = Math.min(ax1, bx1) - Math.max(ax0, bx0), oy = Math.min(ay1, by1) - Math.max(ay0, by0);
        if (ox <= 0 || oy <= 0) continue;
        // Names run sideways, so moving up or down frees them fastest.
        const dir = a.y <= b.y ? -1 : 1, step = Math.min(oy, 12) / 2 + 0.5;
        a.y += dir * step; b.y -= dir * step;
        moved = true;
      }
      stars.forEach((x) => (x.y = Math.max(16, Math.min(H - 16, x.y))));
      if (!moved) break;
    }

    const svg = el('svg:svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': 'Constelação dos livros, artistas e séries que dividiram o meu tempo' });
    const eg = el('svg:g'), ng = el('svg:g');
    svg.append(eg, ng);
    links.forEach((l) => {
      l.el = el('svg:line', { class: `edge${l.how === 'weeks' ? ' edge--weeks' : ''}`, x1: l.a.x, y1: l.a.y, x2: l.b.x, y2: l.b.y, 'stroke-width': l.how === 'during' ? Math.min(4, 0.8 + l.minutes / 110) : 1 });
      eg.append(l.el);
    });
    stars.forEach((x) => {
      const g = el('svg:g', { class: 'star', tabindex: 0, role: 'button', 'aria-label': `${x.name}, ${num(x.hours, 1)} h` });
      g.append(el('svg:circle', { cx: x.x, cy: x.y, r: x.r + 8, fill: 'transparent' }));
      g.append(el('svg:circle', { cx: x.x, cy: x.y, r: x.r, fill: COLORS[KIND[x.kind]] }));
      g.append(el('svg:text', { x: x.x + x.r + 6, y: x.y + 4, text: x.name }));
      x.g = g;
      ng.append(g);
      const pick = () => focusStar(x);
      g.addEventListener('pointerenter', pick);
      g.addEventListener('click', pick);
      g.addEventListener('focus', pick);
    });
    svg.addEventListener('pointerleave', () => focusStar(null));
    host.append(svg);

    function focusStar(x) {
      svg.classList.toggle('focus', !!x);
      if (!x) { readout.textContent = 'Toque numa estrela para ver a constelação dela.'; return; }
      const mine = links.filter((l) => l.a === x || l.b === x);
      const near = new Set([x, ...mine.map((l) => (l.a === x ? l.b : l.a))]);
      stars.forEach((y) => y.g.classList.toggle('dim', !near.has(y)));
      links.forEach((l) => l.el.classList.toggle('on', mine.includes(l)));
      const other = (l) => (l.a === x ? l.b : l.a);
      const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} e ${a[a.length - 1]}` : a[0]);
      const heard = mine.filter((l) => l.how === 'during').sort((a, b) => b.minutes - a.minutes);
      const weeks = mine.filter((l) => l.how === 'weeks');
      let line;
      if (x.kind === 'book') {
        const parts = [];
        if (heard.length) parts.push(`ouvi ${list(heard.map((l) => `${esc(other(l).name)} (${fmtMin(l.minutes)})`))}`);
        if (weeks.length) parts.push(`nas mesmas semanas vi ${list(weeks.map((l) => `<em>${esc(other(l).name)}</em>`))}`);
        line = `Enquanto lia <em>${esc(x.name)}</em>, ${parts.join('; ')}.`;
      } else if (x.kind === 'artist') {
        line = `${esc(x.name)} tocou enquanto eu lia ${list(heard.map((l) => `<em>${esc(other(l).name)}</em> (${fmtMin(l.minutes)})`))}.`;
      } else {
        line = `<em>${esc(x.name)}</em> dividiu as semanas com ${list(weeks.map((l) => `<em>${esc(other(l).name)}</em>`))}.`;
      }
      readout.innerHTML = `${line}<small>${num(x.hours, 1)} h no ano</small>`;
    }
    focusStar(null);
    host._enter = () => {
      if (REDUCED) return;
      links.forEach((l, k) => {
        const len = Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y);
        l.el.animate([{ strokeDasharray: `0 ${len}` }, { strokeDasharray: `${len} 0` }], { duration: 900, delay: 300 + k * 35, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
      });
      stars.forEach((x, k) => x.g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: k * 22, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    };
  }

  // ---------- Reading ----------
  // The year's shelf, face out like bookshelf.koplugin: every book stands by its cover,
  // its height by pages. Finished books in the order she finished them, then the open ones.
  // Rows wrap onto more shelves as the year fills up.
  function renderShelf() {
    const host = $('[data-shelf]');
    host.textContent = '';
    if (!D.books.length) return emptyNote(host, 'Nenhum livro aberto este ano ainda.');
    const done = D.books.filter((b) => b.status === 'lido').sort((a, b) => (a.finished || '').localeCompare(b.finished || ''));
    const open = D.books.filter((b) => b.status !== 'lido');
    const maxP = Math.max(1, ...D.books.map((b) => b.pages || 0));
    const small = window.matchMedia('(max-width: 640px)').matches;
    const [lo, hi] = small ? [72, 112] : [96, 150];
    const height = (b) => Math.round(lo + ((b.pages || maxP / 2) / maxP) * (hi - lo));
    const book = (b) => {
      const h = height(b), frac = b.status === 'lido' ? 1 : b.progress || 0;
      const info = `${b.title}${b.author ? `, ${b.author}` : ''}. ${b.pages ? `${b.pages} páginas` : ''}${b.hours ? `, ${num(b.hours, 1)} h` : ''}${frac < 1 ? `, ${Math.round(frac * 100)}%` : ''}`;
      const face = b.cover
        ? el('img', { src: b.cover, alt: '', loading: 'lazy', decoding: 'async' })
        : el('span', { class: 'book__none', text: b.title });
      const item = el('li', { class: `book${b.status === 'pausado' ? ' book--paused' : ''}`, style: `--h:${h}px`, title: info }, [face]);
      // An open book is lit up to the page she reached; the rest of the cover waits in shadow.
      if (frac < 1) item.append(el('span', { class: 'book__left', style: `height:${(1 - frac) * 100}%` }));
      item.append(el('span', { class: 'vh', text: info }));
      return item;
    };
    // Lay the books out in rows that fit the figure, each row on its own shelf.
    const avail = host.clientWidth || 560, gap = small ? 8 : 10, apart = 28;
    const items = done.map((b) => [b, false]).concat(open.map((b, k) => [b, k === 0 && done.length > 0]));
    const rows = [[]];
    let x = 0;
    items.forEach(([b, first]) => {
      const w = Math.round((height(b) * 2) / 3) + (first ? apart : 0);
      if (x && x + w > avail) { rows.push([]); x = 0; }
      rows[rows.length - 1].push([b, first && x > 0]);
      x += w + gap;
    });
    const shelf = el('div', { class: 'shelf__case', role: 'list', 'aria-label': `${plural(done.length, 'livro terminado', 'livros terminados')} e ${plural(open.length, 'aberto', 'abertos')}.` });
    rows.forEach((row) => {
      const ul = el('ul', { class: 'shelf__row', role: 'presentation' });
      row.forEach(([b, first]) => {
        const it = book(b);
        it.setAttribute('role', 'listitem');
        if (first) it.classList.add('book--first-open');
        ul.append(it);
      });
      shelf.append(ul);
    });
    host.append(shelf);
    if (open.length && done.length) host.append(el('p', { class: 'shelf__key', html: '<span>terminados, na ordem em que terminei</span><span>abertos: acesos até onde cheguei</span>' }));
  }
  // Books rise onto the shelf the first time it comes into view.
  $('[data-shelf]')._enter = () => {
    if (REDUCED) return;
    $('[data-shelf]').querySelectorAll('.book').forEach((b, k) => b.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: k * 45, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
  };

  // What played while she read a book, as a bar: one stretch per artist, the rest in silence.
  function soundtrack(f) {
    const st = D.connections?.soundtracks?.[f.title];
    if (!st || st.covered < 10) return [el('span', { class: 'ost__note', text: 'trilha: sem histórico de música para este livro ainda' })];
    const shades = [COLORS.music, mix(COLORS.music, COLORS.deep, 0.35), mix(COLORS.music, COLORS.deep, 0.6)];
    const bar = el('span', { class: 'ost', 'aria-hidden': 'true' });
    st.artists.forEach((a, k) => bar.append(el('i', { style: `width:${(a.minutes / st.covered) * 100}%;background:${shades[k]}` })));
    const quiet = Math.max(0, Math.round((1 - st.music / st.covered) * 100));
    const part = f.hours * 60 > st.covered * 1.1 ? ` (nas ${fmtMin(st.covered)} lidas desde que o histórico de música começou)` : '';
    const who = st.artists.map((a) => `${a.name} ${fmtMin(a.minutes)}`).join(' · ');
    return [bar, el('span', { class: 'ost__note', text: `trilha: ${who ? who + ' · ' : ''}${quiet}% em silêncio${part}` })];
  }

  const PRINTS_SHOWN = 3;
  function renderPrints() {
    const host = $('[data-prints]');
    if (!D.fingerprints.length) emptyNote(host, 'Nenhum livro aberto este ano ainda.');
    D.fingerprints.forEach((f, idx) => {
      const n = f.mins.length;
      const read = f.mins.filter((m) => m != null);
      if (!read.length) return;
      const peak = Math.max(...read);
      const hot = f.mins.indexOf(peak);
      const max = Math.max(1, peak); // only for the colour scale
      const svg = el('svg:svg', { viewBox: `0 0 ${n} 22`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
      svg.append(el('svg:rect', { x: 0, y: 7.5, width: n, height: 1, fill: 'rgba(237,241,250,.12)' }));
      f.mins.forEach((m, i) => {
        if (m == null) return;
        svg.append(el('svg:rect', { x: i, y: 0, width: 1.04, height: 16, fill: mix(COLORS.deep, COLORS.read, 0.18 + 0.82 * Math.pow(m / max, 0.8)) }));
      });
      if (f.reread) svg.append(el('svg:rect', { x: f.reread[0], y: 18.5, width: f.reread[1] - f.reread[0] + 1, height: 3.5, fill: COLORS.pole }));
      const where = f.status === 'lido' ? '' : f.status === 'lendo' ? ` · lendo, p. ${Math.round(f.pages * f.progress)}` : ` · parei na p. ${Math.round(f.pages * f.progress)}`;
      const rr = f.reread ? ` · reli as p. ${f.reread[0] * 10 + 1}–${(f.reread[1] + 1) * 10}` : '';
      const li = el('li', {}, [
        cover(f),
        el('b', { text: f.title }),
        el('span', { class: 'meta', text: `${num(f.hours, 1)} h · ${f.pages} p.` }),
        svg,
        el('span', { class: 'note', text: `demorei nas p. ${hot * 10 + 1}–${hot * 10 + 10} (${peak} min)${where}${rr}` }),
        ...soundtrack(f),
      ]);
      li.hidden = host.children.length >= PRINTS_SHOWN;
      host.append(li);
    });
    // The rest wait behind a button, so the reading section stays short.
    const more = $('[data-prints-more]');
    const rest = [...host.children].filter((li) => li.hidden);
    if (!rest.length) return;
    const label = () => (more.getAttribute('aria-expanded') === 'true' ? 'Mostrar menos' : `Ver ${rest.length === 1 ? 'o outro livro' : `os outros ${rest.length} livros`}`);
    more.hidden = false;
    more.setAttribute('aria-expanded', 'false');
    more.textContent = label();
    more.addEventListener('click', () => {
      const open = more.getAttribute('aria-expanded') !== 'true';
      rest.forEach((li) => (li.hidden = !open));
      more.setAttribute('aria-expanded', String(open));
      more.textContent = label();
    });
  }

  function renderMap() {
    const names = { pt: 'Português', en: 'Inglês', es: 'Espanhol', fr: 'Francês', it: 'Italiano', de: 'Alemão', outro: 'Sem idioma' };
    const order = ['finished', 'reading', 'on_hold', 'unread'];
    const groups = {};
    D.library.forEach((b) => (groups[b.lang] = groups[b.lang] || []).push(b));
    // Groups too small to name fold into "Outros", as in Atlas map.
    const named = [], others = [];
    Object.entries(groups).sort((a, b) => b[1].length - a[1].length).forEach(([k, v]) => (v.length >= 3 || Object.keys(groups).length <= 3 ? named.push([names[k] || k, v]) : others.push(...v)));
    if (others.length) named.push(['Outros', others]);
    const host = $('[data-map]');
    named.forEach(([name, books]) => {
      const cells = el('div', { class: 'map__cells' });
      books.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)).forEach((b) => cells.append(el('i', { class: `st-${b.status}`, title: b.title })));
      host.append(el('div', { class: 'map__group' }, [el('h4', { text: `${name} · ${books.length}` }), cells]));
    });
    const fin = D.library.filter((b) => b.status === 'finished').length;
    $('[data-map-line]').textContent = `${plural(D.library.length, 'livro', 'livros')}, ${plural(fin, 'terminado', 'terminados')}, ${plural(Object.keys(groups).length, 'idioma', 'idiomas')}.`;
    const key = $('[data-map-key]');
    [['finished', 'terminado'], ['reading', 'lendo'], ['on_hold', 'pausado'], ['unread', 'não lido']].filter(([k]) => D.library.some((b) => b.status === k)).forEach(([k, l]) => key.append(el('li', { html: `<i class="st-${k}"></i>${l}` })));
  }

  // ---------- Music ----------
  function renderTracks() {
    const host = $('[data-tracks]');
    host.textContent = '';
    if (!D.periods[period].topTracks.length) emptyNote(host, 'Nada tocado no período.');
    D.periods[period].topTracks.forEach((t, i) => host.append(el('li', { html: `<span class="n">${i + 1}</span><span>${esc(t.title)}<small>${esc(t.artist)}</small></span><span class="plays">${t.plays}×</span>` })));
  }

  function renderArtists() {
    const host = $('[data-artists]');
    host.textContent = '';
    const list = D.periods[period].artists.slice(0, 10);
    if (!list.length) return emptyNote(host, 'Nada tocado no período.');
    const max = list[0].hours || 1;
    list.forEach((a, i) => host.append(el('li', {
      html: `<span class="n">${i + 1}</span><span class="name">${esc(a.name)}</span><span class="bar" style="width:${(a.hours / max) * 100}%"></span><span class="v">${num(a.hours, a.hours < 10 ? 1 : 0)} h</span>`,
    })));
  }

  // ---------- Screens ----------
  function renderShows() {
    const host = $('[data-shows]');
    const label = { watch_next: (s) => (s.next ? `próximo: ${s.next}` : 'temporada vista'), collecting_dust: () => 'pegando poeira', caught_up: () => 'em dia', stopped: () => 'desisti' };
    const open = D.shows.filter((s) => label[s.status]);
    if (!open.length) emptyNote(host, 'Nenhuma série em andamento.');
    open.forEach((s) => {
      // One mark per episode; a long season (an anime with hundreds) gets a filled bar instead, which still fits.
      const long = s.episodes > 40;
      const eps = el('span', { class: long ? 'eps eps--bar' : 'eps', 'aria-hidden': 'true' });
      if (long) eps.append(el('i', { class: 'on', style: `width:${(s.watched / s.episodes) * 100}%` }));
      else for (let i = 0; i < s.episodes; i++) eps.append(el('i', { class: i < s.watched ? 'on' : i === s.watched && s.status !== 'stopped' ? 'next' : '' }));
      host.append(el('li', { class: s.status === 'stopped' ? 'stopped' : '' }, [
        el('span', { html: `<em>${esc(s.title)}</em>` }),
        el('span', { class: 'meta', text: `T${s.season} · ${s.watched}/${s.episodes} · ${label[s.status](s)}` }),
        eps,
      ]));
    });
  }

  function renderFeelings() {
    const names = { touched: 'comoção', thrilled: 'empolgação', tense: 'tensão', amused: 'diversão', shocked: 'choque', confused: 'confusão', scared: 'medo', bored: 'tédio' };
    const host = $('[data-feelings]');
    host.textContent = '';
    const f = D.periods[period].feelings;
    if (!Object.keys(f).length) return emptyNote(host, 'Nenhum sentimento marcado no período.');
    const max = Math.max(...Object.values(f));
    Object.entries(f).sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
      host.append(el('li', { html: `<span>${esc(names[k] || k)}</span><span class="bar" style="width:${(v / max) * 100}%"></span><span class="v">${v}</span>` })));
  }

  function renderFilms() {
    const host = $('[data-films]');
    if (!D.shows.some((s) => s.kind === 'filme')) emptyNote(host, 'Nenhum filme este ano ainda.');
    D.shows.filter((s) => s.kind === 'filme').forEach((f) => host.append(el('li', { html: `<em>${esc(f.title)}</em><span>${fmtMin(Math.round(f.hours * 60))}</span>` })));
    const q = $('[data-queue]');
    const names = { watch_next: 'para ver a seguir', collecting_dust: 'pegando poeira', caught_up: 'em dia', completed: 'terminadas', stopped: 'abandonadas' };
    Object.entries(D.watchlist).forEach(([k, v]) => q.append(el('li', { html: `<b>${v}</b>${names[k]}` })));
  }

  function renderFoot() {
    const [d, t] = D.updatedAt.split('T');
    const [, m, day] = d.split('-').map(Number);
    const src = D.sources;
    const stale = src ? Object.entries({ reading: 'leitura', music: 'música', screens: 'séries e filmes' }).filter(([k]) => src[k] && src[k].status !== 'ok').map(([, v]) => v) : [];
    $('[data-sources]').textContent = D.synthetic
      ? 'Dados de exemplo, no formato que o job gera.'
      : stale.length ? `Sem atualização desta vez: ${stale.join(', ')}. Mostrando a última leitura que deu certo.` : '';
    $('[data-updated]').textContent = `Atualizado em ${day} de ${MONTHS[m - 1]}, ${t.slice(0, 5).replace(':', 'h')}.`;
  }

  // ---------- Period control ----------
  const buttons = [...document.querySelectorAll('[data-period]')];
  function setPeriod(p) {
    period = p;
    buttons.forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.period === p)); b.tabIndex = b.dataset.period === p ? 0 : -1; });
    renderOverview();
    renderDay();
    renderTracks();
    renderArtists();
    renderFeelings();
  }
  buttons.forEach((b, i) => {
    b.addEventListener('click', () => setPeriod(b.dataset.period));
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const nb = buttons[(i + d + buttons.length) % buttons.length];
      nb.focus();
      setPeriod(nb.dataset.period);
    });
  });

  renderNow();
  renderSky();
  renderShelf();
  // The shelf fills its figure, so draw it again when the figure changes width.
  if ('ResizeObserver' in window) {
    let last = 0;
    new ResizeObserver(([entry]) => {
      const wNow = Math.round(entry.contentRect.width);
      if (wNow !== last) { last = wNow; renderShelf(); }
    }).observe($('[data-shelf]'));
  }
  renderPrints();
  renderMap();
  renderShows();
  renderFilms();
  renderFoot();
  // Small screens open on the month: a whole year of days is too fine to read there.
  picks.forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.show === dayShow)); b.tabIndex = b.dataset.show === dayShow ? 0 : -1; });
  setPeriod(window.matchMedia('(max-width: 640px)').matches ? 'month' : 'year');

  // ---------- Motion and wayfinding ----------
  // Figures below the fold rise in as they reach the screen; the ones already in view stay put.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      e.target.classList.remove('pre');
      e.target.querySelectorAll('[data-sky], [data-shelf]').forEach((n) => n._enter && n._enter());
    }), { rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('.fig').forEach((fig) => {
      if (!REDUCED && fig.getBoundingClientRect().top > window.innerHeight) fig.classList.add('pre');
      io.observe(fig);
    });

    // The menu marks the section on screen.
    const links = new Map([...document.querySelectorAll('.sections a')].map((a) => [a.hash.slice(1), a]));
    const spy = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a, id) => (id === e.target.id ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
    }), { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((_, id) => document.getElementById(id) && spy.observe(document.getElementById(id)));
  }
})();
