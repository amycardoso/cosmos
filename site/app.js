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
    const t = STREAMS.map((s) => fmtMin(sum(s.days, r)));
    $('[data-lede]').innerHTML = `<b class="r">${t[0]}</b> lendo, <b class="m">${t[1]}</b> ouvindo e <b class="s">${t[2]}</b> de séries e filmes.`;

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
    $('[data-readout]').textContent = 'Passe o dedo ou o mouse pelas faixas para ver cada dia.';
    renderLines(r);
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
      svg.append(el('svg:rect', { x: x - o, y: y - o, width: w + 2 * o, height: h + 2 * o, rx: 3 * k, fill: 'none', stroke: '#EDF1FA', 'stroke-width': 1.25 * k, 'pointer-events': 'none' }));
    }
    // Cells fill in from left to right when the period changes.
    if (!REDUCED) {
      const rects = [...svg.querySelectorAll('rect[data-i]')];
      rects.forEach((rc, k) => rc.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 520, delay: Math.round((+rc.getAttribute('x') / svg.viewBox.baseVal.width) * 360), easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    }
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${s.name}: ${fmtMin(total)} no período, dia a dia.`);
    const show = (e) => {
      const i = e.target.getAttribute && e.target.getAttribute('data-i');
      if (i === null || i === '' || i === undefined) return;
      const v = s.days[+i];
      $('[data-readout]').textContent = `${fmtDay(+i)} · ${s.name.toLowerCase()}: ${v ? fmtMin(v) : 'nada'}`;
    };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
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

  // ---------- Hour x weekday ----------
  function renderClock(key, grid, peakSel, verb) {
    const host = $(`[data-clock="${key}"]`);
    host.textContent = '';
    const ramp = RAMP(COLORS[key]);
    const clean = grid.map((row) => row.map((v) => (v < 0.1 ? 0 : v)));
    const qs = quartiles(clean.flat());
    // On phones the grid is drawn tighter so its labels render at 12px or more.
    const small = window.matchMedia('(max-width: 640px)').matches;
    const cell = small ? 11 : 14, gap = small ? 2 : 3, left = small ? 34 : 40, top = small ? 18 : 22;
    const svg = el('svg:svg', { viewBox: `0 0 ${left + 24 * (cell + gap)} ${top + 7 * (cell + gap)}`, role: 'img' });
    const fs = small ? 'font-size:13px' : '';
    [0, 6, 12, 18].forEach((h) => svg.append(el('svg:text', { x: left + h * (cell + gap), y: 12, text: `${h}h`, style: fs })));
    let best = [0, 0, 0];
    clean.forEach((row, d) => {
      svg.append(el('svg:text', { x: 0, y: top + d * (cell + gap) + cell - 2, text: DOW[d], style: fs }));
      row.forEach((v, h) => {
        if (v > best[2] && v > 0) best = [d, h, v];
        svg.append(el('svg:rect', { x: left + h * (cell + gap), y: top + d * (cell + gap), width: cell, height: cell, rx: 2, fill: ramp[level(v, qs)] }, [el('svg:title', { text: `${DOW[d]}, ${h}h` })]));
      });
    });
    const peak = best[2] > 0 ? `Mais forte ${DOW_LONG[best[0]]}, por volta das ${best[1]}h.` : 'Nada no período.';
    svg.setAttribute('aria-label', `Horas da semana em que ${verb}. ${peak}`);
    host.append(svg);
    $(peakSel).textContent = peak;
  }

  // ---------- Reading ----------
  // Width of a label in the shelf's 12px text face, to wrap long titles instead of cutting them.
  const measure = (() => {
    const ctx = document.createElement('canvas').getContext('2d');
    return (t) => {
      ctx.font = `12px ${getComputedStyle(document.body).getPropertyValue('--text') || 'sans-serif'}`;
      return ctx.measureText(t).width;
    };
  })();
  function wrap(text, max) {
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next) > max) { lines.push(line); line = word; } else line = next;
    }
    return lines.concat(line ? [line] : []);
  }

  function renderShelf() {
    const host = $('[data-shelf]');
    host.textContent = '';
    const done = D.books.filter((b) => b.status === 'lido').sort((a, b) => a.finished.localeCompare(b.finished));
    const open = D.books.filter((b) => b.status !== 'lido');
    if (!D.books.length) return emptyNote(host, 'Nenhum livro aberto este ano ainda.');
    const maxP = Math.max(1, ...D.books.map((b) => b.pages || 0));
    // Every title stands whole above its spine. A long one wraps onto a second or third
    // rotated line, and the room above the spines grows to the longest label.
    const LABEL = 150, LINE = 14, SPINE = 140, gapB = 4, apart = 40;
    const labels = new Map(D.books.map((b) => [b, wrap(b.title, LABEL)]));
    const labelH = Math.max(...D.books.map((b) => Math.max(...labels.get(b).map(measure)))) + 10;
    const base = labelH + SPINE;
    const natural = (b) => Math.max(labels.get(b).length * LINE + 6, 20 + b.hours * 1.6);
    const h = (b) => 30 + (b.pages / maxP) * (SPINE - 30);
    // Stretch the spines to fill the figure's width, so the shelf never sits squeezed in a corner.
    const gaps = (D.books.length - 1) * gapB + (done.length && open.length ? apart : 0);
    const sum = D.books.reduce((a, b) => a + natural(b), 0);
    const avail = host.clientWidth || 560;
    const k = Math.max(1, Math.min(2.4, (avail - gaps) / sum));
    const w = (b) => natural(b) * k;
    const width = Math.max(220, sum * k + gaps);
    const svg = el('svg:svg', { viewBox: `0 0 ${width} ${base + 26}`, width, role: 'img', 'aria-label': `${done.length} livros terminados e ${open.length} abertos.` });
    let x = 0;
    const spine = (b, fill, frac) => {
      const bw = w(b), bh = h(b);
      const g = el('svg:g');
      g.append(el('svg:title', { text: `${b.title}, ${b.author}. ${b.pages} páginas, ${num(b.hours, 1)} h${frac < 1 ? `, ${Math.round(frac * 100)}%` : ''}` }));
      if (frac < 1) g.append(el('svg:rect', { x, y: base - bh, width: bw, height: bh, rx: 2, fill: 'none', stroke: fill, 'stroke-opacity': 0.55 }));
      g.append(el('svg:rect', { x, y: base - bh * frac, width: bw, height: bh * frac, rx: 2, fill }));
      const lines = labels.get(b);
      const ty = base - bh - 6;
      lines.forEach((line, i) => {
        const tx = x + bw / 2 + 4 + (i - (lines.length - 1) / 2) * LINE;
        g.append(el('svg:text', { x: tx, y: ty, transform: `rotate(-90 ${tx} ${ty})`, text: line }));
      });
      svg.append(g);
      x += bw + gapB;
    };
    done.forEach((b, i) => spine(b, mix(COLORS.read, '#ffffff', (i % 2) * 0.18), 1));
    // Open books stand at the right end, under their caption.
    x = width - open.reduce((acc, b) => acc + w(b) + gapB, 0) + gapB;
    open.forEach((b) => spine(b, b.status === 'pausado' ? COLORS.pole : COLORS.read, b.progress));
    svg.append(el('svg:line', { x1: 0, x2: width, y1: base + 1, y2: base + 1, stroke: 'rgba(237,241,250,.25)' }));
    svg.append(el('svg:text', { x: 0, y: base + 20, text: 'terminados' }));
    svg.append(el('svg:text', { x: width, y: base + 20, 'text-anchor': 'end', text: 'abertos' }));
    host.append(svg);
  }

  function renderPrints() {
    const host = $('[data-prints]');
    if (!D.fingerprints.length) emptyNote(host, 'Nenhum livro aberto este ano ainda.');
    D.fingerprints.forEach((f) => {
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
      host.append(el('li', {}, [
        cover(f),
        el('b', { text: f.title }),
        el('span', { class: 'meta', text: `${num(f.hours, 1)} h · ${f.pages} p.` }),
        svg,
        el('span', { class: 'note', text: `demorei nas p. ${hot * 10 + 1}–${hot * 10 + 10} (${peak} min)${where}${rr}` }),
      ]));
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
    host.style.setProperty('--rows', Math.ceil(list.length / 2));
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
      const eps = el('span', { class: 'eps', 'aria-hidden': 'true' });
      for (let i = 0; i < s.episodes; i++) eps.append(el('i', { class: i < s.watched ? 'on' : i === s.watched && s.status !== 'stopped' ? 'next' : '' }));
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
      host.append(el('li', { html: `<span>${names[k]}</span><span class="bar" style="width:${(v / max) * 100}%"></span><span class="v">${v}</span>` })));
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
    const P = D.periods[p];
    renderClock('read', P.readingClock, '[data-read-peak]', 'leio');
    renderClock('music', P.listeningClock, '[data-music-peak]', 'ouço');
    renderClock('screen', P.watchingClock, '[data-screen-peak]', 'assisto');
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
  setPeriod(window.matchMedia('(max-width: 640px)').matches ? 'month' : 'year');
})();
