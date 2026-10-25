// Cosmos, music page: "Dez anos", the long view from window.COSMOS_ARCHIVE.
(function () {
  const A = window.COSMOS_ARCHIVE;
  const host = document.querySelector('[data-archive]');
  if (!host) return;
  const $ = (s) => document.querySelector(s);
  if (!A) {
    host.replaceChildren();
    host.append(Object.assign(document.createElement('p'), { className: 'empty', textContent: 'O histórico completo aparece depois que o export do Spotify for importado.' }));
    return;
  }
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
  // Titles and names come from Spotify: escape before any innerHTML.
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const num = (x, dp = 0) => x.toLocaleString('pt-BR', { maximumFractionDigits: dp, minimumFractionDigits: 0 });
  const pct = (x) => `${Math.round(x * 100)}%`;
  const MON = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const fmtDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; };
  const short = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const Y = A.years, first = Y[0], last = Y[Y.length - 1];

  const peak = A.yearHours.indexOf(Math.max(...A.yearHours));
  $('[data-archive-line]').textContent = `Desde ${fmtDate(A.since)}: ${num(A.totals.hours)} horas, ${num(A.totals.plays)} músicas ouvidas, ${num(A.totals.tracks)} faixas de ${num(A.totals.artists)} artistas. O ano mais cheio foi ${Y[peak]}, com ${num(A.yearHours[peak])} horas.`;

  // One time axis for the comets and the first listens: from the first year to the end of this one.
  const T0 = Date.UTC(first, 0, 1), T1 = Date.UTC(last + 1, 0, 1);
  const tx = (iso, x0, x1) => x0 + ((Date.parse(iso) - T0) / (T1 - T0)) * (x1 - x0);
  function yearAxis(svg, x0, x1, y, bottom) {
    Y.forEach((yr) => {
      const x = tx(`${yr}-01-01`, x0, x1);
      svg.append(el('svg:line', { x1: x, x2: x, y1: y + 6, y2: bottom, class: 'grid' }));
      svg.append(el('svg:text', { x: x + 4, y, class: 'ax', text: yr }));
    });
  }

  // ---------- Orbits ----------
  (function orbits() {
    const svg = $('[data-orbits]');
    const rows = A.orbits;
    const W = 1000, L = 200, R = 16, top = 26, rowH = 44, H = top + rows.length * rowH;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('aria-label', `Horas por ano com ${rows.length} artistas, de ${first} a ${last}.`);
    const max = Math.max(...rows.flatMap((r) => r.years));
    const xs = Y.map((_, i) => L + 16 + (i * (W - L - R - 32)) / Math.max(1, Y.length - 1));
    Y.forEach((yr, i) => {
      svg.append(el('svg:text', { x: xs[i], y: 12, class: 'ax', 'text-anchor': 'middle', text: yr }));
      svg.append(el('svg:line', { x1: xs[i], x2: xs[i], y1: 20, y2: H, class: 'grid' }));
    });
    const readout = $('[data-orbits-readout]');
    const rest = 'Passe pelos cinturões para ver as horas de cada ano.';
    readout.textContent = rest;
    const belts = [];
    rows.forEach((r, k) => {
      const cy = top + k * rowH + rowH / 2;
      const half = r.years.map((h) => Math.max(0.6, (h / max) * (rowH / 2 - 3)));
      // A smooth belt through the yearly widths, mirrored on its centre line.
      const curve = (p) => p.map(([x, y], i) => (i ? `C${(p[i - 1][0] + x) / 2},${p[i - 1][1]} ${(p[i - 1][0] + x) / 2},${y} ${x},${y}` : `M${x},${y}`)).join('');
      const upper = curve(xs.map((x, i) => [x, cy - half[i]]));
      const lower = curve(xs.map((x, i) => [x, cy + half[i]]).reverse()).replace(/^M/, 'L');
      const best = r.years.indexOf(Math.max(...r.years));
      const g = el('svg:g', { class: 'belt', tabindex: 0 });
      g.append(el('svg:rect', { x: 0, y: cy - rowH / 2, width: W, height: rowH, fill: 'transparent' }));
      g.append(el('svg:path', { d: `${upper}${lower}Z` }));
      g.append(el('svg:text', { x: 0, y: cy - 2, class: 'name', text: short(r.name, 24) }));
      g.append(el('svg:text', { x: 0, y: cy + 14, class: 'ax', text: `${num(r.hours)} h · pico em ${Y[best]}` }));
      const show = () => {
        belts.forEach((b) => b.classList.toggle('dim', b !== g));
        readout.innerHTML = `<b>${esc(r.name)}</b> · ${r.years.map((h, i) => (h ? `${Y[i]} ${num(h, 1)} h` : null)).filter(Boolean).join(' · ')}`;
      };
      g.addEventListener('pointerenter', show);
      g.addEventListener('focus', show);
      belts.push(g);
      svg.append(g);
    });
    const clear = () => { belts.forEach((b) => b.classList.remove('dim')); readout.textContent = rest; };
    svg.addEventListener('pointerleave', clear);
    svg.addEventListener('focusout', (e) => !svg.contains(e.relatedTarget) && clear());
  })();

  // ---------- Genres ----------
  // Each family is a belt, light zones and dark belts in turn, from the music cyan to the
  // planet's deep blue spot; the text on each takes the opposite side.
  (function genres() {
    const figs = document.querySelectorAll('[data-genres-fig]');
    const G = A.genres;
    if (!G || !G.families.length) { figs.forEach((f) => (f.hidden = true)); return; }
    // With only a few artists known, the shares would be those few artists' alone: until half
    // the hours have a genre, the first figure says how far along it is and draws nothing.
    const covered = G.known / Math.max(1, A.totals.hours);
    if (covered < 0.5) {
      figs[1].hidden = true;
      figs[0].querySelectorAll('.wide, .readout').forEach((n) => (n.hidden = true));
      figs[0].append(el('p', { class: 'empty', text: `Os gêneros estão chegando do MusicBrainz: já sei o de ${pct(covered)} das horas. O gráfico aparece quando passar da metade.` }));
      return;
    }
    const fams = G.families;
    const BELTS = ['#BFE6F7', '#3948CF', '#84CDEE', '#5A6BE0', '#DDEFF8', '#2B379E', '#9FD8F0', '#7886E6', '#5FB4DB', '#232C80', '#C9D3F5'];
    const color = (i) => BELTS[i % BELTS.length];
    const ink = (i) => (i % 2 ? '#EDF1FA' : '#08080C');
    const svgs = [$('[data-atmosphere]'), $('[data-genre-clock]')];
    const parts = [];
    const focus = (i) => {
      svgs.forEach((svg) => svg.classList.toggle('dimmed', i != null));
      parts.forEach((p) => p.el.classList.toggle('on', p.i === i));
    };
    const share = (key, c) => { const t = fams.reduce((a, f) => a + f[key][c], 0); return (i) => (t ? fams[i][key][c] / t : 0); };

    // The atmosphere of each year: shares stacked and smoothed between years.
    (function atmosphere() {
      const svg = svgs[0];
      const W = 1000, H = 420, top = 24;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const xs = Y.map((_, c) => (c * W) / Math.max(1, Y.length - 1));
      const shares = Y.map((_, c) => share('years', c));
      let base = Y.map(() => top);
      const curve = (p) => p.map(([x, y], k) => (k ? `C${(p[k - 1][0] + x) / 2},${p[k - 1][1]} ${(p[k - 1][0] + x) / 2},${y} ${x},${y}` : `M${x},${y}`)).join('');
      const labels = [];
      fams.forEach((f, i) => {
        const upper = base, lower = base.map((b, c) => b + shares[c](i) * (H - top));
        base = lower;
        const el2 = el('svg:path', { d: curve(xs.map((x, c) => [x, upper[c]])) + curve(xs.map((x, c) => [x, lower[c]]).reverse()).replace(/^M/, 'L') + 'Z', fill: color(i), class: 'part' });
        el2.addEventListener('pointerenter', () => {
          focus(i);
          $('[data-atmosphere-readout]').innerHTML = `<b>${esc(f.name)}</b> · ${Y.map((y, c) => `${y} ${pct(shares[c](i))}`).join(' · ')}`;
        });
        parts.push({ el: el2, i });
        svg.append(el2);
        // The name sits inside the belt at its widest year, when it fits.
        const h = lower.map((b, c) => b - upper[c]);
        const c = h.indexOf(Math.max(...h.slice(1, -1)));
        if (h[c] >= 16) labels.push(el('svg:text', { x: xs[c], y: (upper[c] + lower[c]) / 2 + 4, 'text-anchor': 'middle', class: 'belt-name', style: `fill:${ink(i)}`, text: f.name }));
      });
      svg.append(...labels);
      Y.forEach((y, c) => svg.append(el('svg:text', { x: xs[c], y: 14, class: 'ax', 'text-anchor': c === 0 ? 'start' : c === Y.length - 1 ? 'end' : 'middle', text: y })));
      svg.setAttribute('aria-label', fams.map((f) => `${f.name}: ${num(f.hours)} h`).join(', '));
      const rest = 'Passe por uma faixa para ver a fatia de cada ano.';
      $('[data-atmosphere-readout]').textContent = rest;
      svg.addEventListener('pointerleave', () => { focus(null); $('[data-atmosphere-readout]').textContent = rest; });
    })();

    // The genre clock: one stacked column per hour of the day.
    (function clock() {
      const svg = svgs[1];
      const W = 1000, H = 290, top = 4, bottom = 262, gap = 4, cw = (W - gap * 23) / 24;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const readout = $('[data-genre-clock-readout]');
      for (let h = 0; h < 24; h++) {
        const sh = share('clock', h), x = h * (cw + gap);
        let y = top;
        fams.forEach((f, i) => {
          const hh = sh(i) * (bottom - top);
          const r = el('svg:rect', { x, y, width: cw, height: Math.max(0, hh - 1), rx: 1.5, fill: color(i), class: 'part' });
          r.addEventListener('pointerenter', () => {
            focus(i);
            const lead = fams.map((g, k) => [g.name, sh(k)]).sort((a, b) => b[1] - a[1]).slice(0, 3);
            readout.innerHTML = `<b>${h}h</b> · ${lead.map(([n, v]) => `${esc(n)} ${pct(v)}`).join(' · ')}`;
          });
          parts.push({ el: r, i });
          svg.append(r);
          y += hh;
        });
        if (h % 3 === 0) svg.append(el('svg:text', { x: x + cw / 2, y: H - 6, class: 'ax', 'text-anchor': 'middle', text: `${h}h` }));
      }
      svg.setAttribute('aria-label', 'A fatia de cada gênero em cada hora do dia.');
      const rest = 'Passe por uma hora para ver o que toca nela.';
      readout.textContent = rest;
      svg.addEventListener('pointerleave', () => { focus(null); readout.textContent = rest; });
    })();

    const key = $('[data-genre-key]');
    fams.forEach((f, i) => {
      const li = el('li', { html: `<i style="background:${color(i)}"></i><span>${esc(f.name)}<small>${f.artists.map(esc).join(', ')}</small></span><em>${num(f.hours)} h</em>` });
      li.addEventListener('pointerenter', () => focus(i));
      li.addEventListener('pointerleave', () => focus(null));
      key.append(li);
    });
    $('[data-genres-note]').textContent = `Gêneros do MusicBrainz, marcados pela comunidade em cada artista. Já sei o gênero de ${pct(covered)} das horas; a cada deploy mais artistas entram.`;
  })();

  // ---------- Comets ----------
  (function comets() {
    const svg = $('[data-comets]');
    const rows = A.comets;
    if (!rows.length) return svg.replaceWith(el('p', { class: 'empty', text: 'Nenhuma música virou obsessão ainda.' }));
    const W = 1000, L = 220, R = 175, top = 26, rowH = 40, H = top + rows.length * rowH;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('aria-label', rows.map((c) => `${c.title}, ${c.burst} vezes em três semanas a partir de ${fmtDate(c.start)}`).join('; '));
    yearAxis(svg, L, W - R, 12, H);
    rows.forEach((c, k) => {
      const cy = top + k * rowH + rowH / 2;
      svg.append(el('svg:text', { x: 0, y: cy - 2, class: 'name', text: short(c.title, 28) }));
      svg.append(el('svg:text', { x: 0, y: cy + 14, class: 'ax', text: short(c.artist, 32) }));
      for (const d of c.days) if (d < c.start || d > c.end) svg.append(el('svg:circle', { cx: tx(d, L, W - R), cy, r: 1.8, class: 'tail' }));
      const x0 = tx(c.start, L, W - R), x1 = tx(c.end, L, W - R);
      svg.append(el('svg:rect', { x: x0 - 5, y: cy - 5, width: Math.max(10, x1 - x0 + 10), height: 10, rx: 5, class: 'head' }));
      const [y, m] = c.start.split('-');
      svg.append(el('svg:text', { x: W - R + 18, y: cy - 2, class: 'name', text: `${c.burst} vezes` }));
      svg.append(el('svg:text', { x: W - R + 18, y: cy + 14, class: 'ax', text: `em 3 semanas, ${MON[m - 1]} ${y}` }));
    });
  })();

  // ---------- Restlessness ----------
  (function restless() {
    const S = A.skips;
    const fig = $('[data-restless]').closest('figure');
    if (!S) {
      $('[data-skips-line]').textContent = 'Os pulos só vêm no export do Spotify.';
      [fig, $('[data-patience]').closest('figure'), $('[data-skipped]').closest('figure'), $('[data-loyal]').closest('figure')].forEach((f) => (f.hidden = true));
      return;
    }
    const years = Object.entries(S.years).sort();
    const total = years.reduce((a, [, [c, n]]) => [a[0] + c, a[1] + n], [0, 0]);
    const rate = ([c, n]) => (n ? c / n : 0);
    const [y0, v0] = years[0], [y1, v1] = years.length > 1 ? years[years.length - 2] : years[0];
    $('[data-skips-line]').textContent = `Cortei ${pct(rate(total))} das músicas que comecei antes dos 30 segundos. Em ${y0} eu pulava ${pct(rate(v0))}; em ${y1}, ${pct(rate(v1))}. Contado até ${fmtDate(S.until)}, o último dia do export.`;

    // Weekday by hour, Monday first, on a ramp of her own quartiles.
    const DOW = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
    const rows = [1, 2, 3, 4, 5, 6, 0].map((d) => S.grid[d]);
    const rates = rows.flat().filter(([, n]) => n >= 40).map(rate).sort((a, b) => a - b);
    const q = [0.25, 0.5, 0.75].map((p) => rates[Math.floor(p * (rates.length - 1))]);
    const steps = ['r1', 'r2', 'r3', 'r4'];
    const grid = $('[data-restless]');
    grid.setAttribute('aria-label', 'Quanto eu pulo em cada hora da semana.');
    grid.append(el('span'));
    for (let h = 0; h < 24; h++) grid.append(el('span', { class: 'hr', text: h % 3 ? '' : `${h}h` }));
    const readout = $('[data-restless-readout]');
    readout.textContent = 'Passe pela grade para ver uma hora da semana.';
    rows.forEach((row, d) => {
      grid.append(el('span', { text: DOW[d] }));
      row.forEach((cell, h) => {
        const quiet = cell[1] < 40;
        const r = rate(cell);
        const i = el('i', { class: quiet ? '' : steps[q.filter((t) => r > t).length], tabindex: -1 });
        const say = () => (readout.innerHTML = quiet ? `${DOW[d]}, ${h}h: quase nunca ouço música` : `<b>${DOW[d]}, ${h}h</b> · pulo ${pct(r)} de ${num(cell[1])} músicas começadas`);
        i.addEventListener('pointerenter', say);
        grid.append(i);
      });
    });
    const key = $('[data-restless-key]');
    key.append(el('li', { html: `<i class="r0"></i>quase sem música` }), el('li', { html: `<i class="r1"></i><i class="r2"></i><i class="r3"></i><i class="r4"></i>de quem menos a quem mais pula` }));

    // Year by year.
    const svg = $('[data-patience]');
    const W = 420, H = 220, B = 22, top = 20, bw = W / years.length;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('aria-label', years.map(([y, v]) => `${y}: ${pct(rate(v))}`).join(', '));
    const max = Math.max(...years.map(([, v]) => rate(v)));
    years.forEach(([y, v], i) => {
      const h = (rate(v) / max) * (H - B - top), x = i * bw;
      svg.append(el('svg:rect', { x: x + 3, y: H - B - h, width: bw - 6, height: h, rx: 3, class: y === S.until.slice(0, 4) ? 'bar part' : 'bar' }));
      svg.append(el('svg:text', { x: x + bw / 2, y: H - B - h - 6, class: 'ax', 'text-anchor': 'middle', text: pct(rate(v)) }));
      svg.append(el('svg:text', { x: x + bw / 2, y: H - 4, class: 'ax', 'text-anchor': 'middle', text: `’${y.slice(2)}` }));
    });

    const li = (t, right) => el('li', { html: `<span>${esc(t.title)}<small>${esc(t.artist)}</small></span><em>${right}</em>` });
    S.mostSkipped.forEach((t) => $('[data-skipped]').append(li(t, `pulei ${t.cut} de ${t.starts}`)));
    S.neverSkipped.forEach((t) => $('[data-loyal]').append(li(t, `até o fim em ${t.starts - t.cut} de ${t.starts}`)));
  })();

  // ---------- On this day ----------
  (function onThisDay() {
    const host = $('[data-onday]');
    const label = $('[data-onday-label]');
    const { strings, days } = A.days;
    const now = new Date();
    let cur = new Date(Date.UTC(2000, now.getMonth(), now.getDate())); // a leap year, so 29 Feb exists
    const today = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const draw = () => {
      const md = `${String(cur.getUTCMonth() + 1).padStart(2, '0')}-${String(cur.getUTCDate()).padStart(2, '0')}`;
      label.textContent = `${cur.getUTCDate()} de ${MONTHS[cur.getUTCMonth()]}`;
      const day = days[md] || {};
      const max = Math.max(60, ...Object.values(day).map((v) => v[0]));
      host.replaceChildren();
      Y.forEach((y) => {
        const v = day[y];
        const bar = el('span', { class: 'bar' });
        if (v) bar.append(el('i', { style: `width:${(v[0] / max) * 100}%` }));
        const what = v
          ? `${esc(strings[v[1]])}<small>${esc(strings[v[2]])} · ${v[0]} min no dia</small>`
          : y === first && md < A.since.slice(5) ? 'antes do histórico começar' : y === last && md > today ? 'ainda não chegou' : 'silêncio';
        host.append(el('div', { class: v ? 'yr' : 'yr yr--empty' }, [el('b', { text: y }), bar, el('span', { class: 't', html: what })]));
      });
    };
    const step = (n) => { cur = new Date(cur.getTime() + n * 86400000); cur.setUTCFullYear(2000); draw(); };
    document.querySelectorAll('[data-day-step]').forEach((b) => b.addEventListener('click', () => step(+b.dataset.dayStep)));
    $('[data-day-today]').addEventListener('click', () => { cur = new Date(Date.UTC(2000, now.getMonth(), now.getDate())); draw(); });
    draw();
  })();

  // ---------- First listens ----------
  (function firsts() {
    const svg = $('[data-firsts]');
    const rows = A.first;
    if (!rows.length) return;
    const W = 1000, H = 400, L = 40, R = 30, top = 26, B = 16;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('aria-label', rows.slice(0, 10).map((r) => `${r.title}, primeira vez em ${fmtDate(r.first)}, ${r.plays} vezes`).join('; '));
    const step = rows[0].plays > 400 ? 100 : rows[0].plays > 100 ? 50 : 10;
    const pmin = Math.floor(rows[rows.length - 1].plays / step) * step, pmax = Math.ceil(rows[0].plays / step) * step;
    const y = (p) => top + 10 + (1 - (p - pmin) / Math.max(1, pmax - pmin)) * (H - top - B - 20);
    yearAxis(svg, L, W - R, 12, H - B);
    for (let p = pmin + step; p <= pmax; p += step) {
      svg.append(el('svg:line', { x1: L, x2: W - R, y1: y(p), y2: y(p), class: 'grid' }));
      svg.append(el('svg:text', { x: 0, y: y(p) + 4, class: 'ax', text: p }));
    }
    const hmax = Math.max(...rows.map((r) => r.hours));
    const readout = $('[data-firsts-readout]');
    const rest = 'Passe pelas estrelas para ver quando cada uma chegou.';
    readout.textContent = rest;
    // Names for the four biggest and for the ones that arrived after the first year, where there is room.
    const named = new Set(rows.filter((r, i) => i < 4 || (r.first.slice(0, 4) > String(first) && i < 15)));
    rows.forEach((r) => {
      const cx = tx(r.first, L, W - R), cy = y(r.plays), rad = 3 + (r.hours / hmax) * 9;
      const g = el('svg:g', { class: 'star', tabindex: 0 });
      g.append(el('svg:circle', { cx, cy, r: rad + 6, fill: 'transparent' }));
      g.append(el('svg:circle', { cx, cy, r: rad }));
      if (named.has(r)) g.append(el('svg:text', { x: cx + rad + 6, y: cy + 4, text: short(r.title, 26) }));
      const say = () => (readout.innerHTML = `<b>${esc(r.title)}</b>, ${esc(r.artist)} · primeira vez em ${fmtDate(r.first)} às ${r.hour}; tocou ${num(r.plays)} vezes, ${num(r.hours, 1)} h.`);
      g.addEventListener('pointerenter', say);
      g.addEventListener('focus', say);
      svg.append(g);
    });
    svg.addEventListener('pointerleave', () => (readout.textContent = rest));
    $('[data-firsts-note]').textContent = `O histórico começa em ${fmtDate(A.since)}: o que eu já ouvia antes aparece como se tivesse chegado ali.`;
  })();
})();
