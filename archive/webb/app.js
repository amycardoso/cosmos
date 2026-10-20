(function () {
  'use strict';
  const D = window.COSMOS_DATA;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const C = { read: '#E3A75F', music: '#93AECB', screen: '#EC8F6F', band: '#F2E6D6' };
  const $ = (s) => document.querySelector(s);
  let uid = 0;

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
  const fmtH = (h) => {
    const m = Math.round(h * 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;
  };
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  // A star the way Webb draws it: a soft core and six diffraction spikes (plus two faint horizontals).
  function webbStar(size, color, opts) {
    const o = Object.assign({ spikes: true, core: 0.16, glow: 0.5 }, opts);
    const id = `g${uid++}`;
    const h = size / 2;
    const spike = (angle, len, width, alpha) => {
      const a = (angle * Math.PI) / 180;
      const dx = Math.cos(a), dy = Math.sin(a), px = -dy * width, py = dx * width;
      const x2 = h + dx * len, y2 = h + dy * len, x3 = h - dx * len, y3 = h - dy * len;
      return `<polygon points="${x3},${y3} ${h + px},${h + py} ${x2},${y2} ${h - px},${h - py}" fill="${color}" opacity="${alpha}"/>`;
    };
    let spikes = '';
    if (o.spikes) {
      const L = h * 0.98, W = Math.max(0.6, size * 0.012);
      spikes = [90, 30, 150].map((a) => spike(a, L, W, 0.85)).join('') + spike(0, L * 0.55, W * 0.7, 0.45);
    }
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><defs><radialGradient id="${id}"><stop offset="0" stop-color="#FFF6EA"/><stop offset="${o.core}" stop-color="${color}" stop-opacity="1"/><stop offset="${o.core + 0.18}" stop-color="${color}" stop-opacity="${o.glow * 0.45}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>${spikes}<circle cx="${h}" cy="${h}" r="${h * 0.62}" fill="url(#${id})"/></svg>`;
  }

  // ---------- Field ----------
  function buildField() {
    const books = D.books.map((b) => ({ kind: 'read', name: b.title, meta: `${b.author} · ${fmtH(b.hours)}`, label: `livro, ${fmtH(b.hours)}`, h: b.hours }));
    const artists = D.artists.slice(0, 10).map((a) => ({ kind: 'music', name: a.name, meta: `${a.hours} horas ouvindo`, label: `artista, ${a.hours} horas`, h: a.hours }));
    const shows = D.shows.map((s) => ({ kind: 'screen', name: s.title, meta: `${s.kind} · ${fmtH(s.hours)}`, label: `${s.kind}, ${fmtH(s.hours)}`, h: s.hours }));
    const groups = [books, artists, shows];
    groups.forEach((g) => {
      const max = Math.max(...g.map((x) => x.h));
      g.forEach((x) => (x.w = Math.sqrt(x.h / max)));
      g.sort((a, b) => b.h - a.h);
      g[0].lead = true;
    });
    const all = groups.flat();
    const r = rng(17);
    const placed = [];
    const wide = innerWidth > 900;
    all.sort((a, b) => b.w - a.w).forEach((x) => {
      for (let tries = 0; tries < 400; tries++) {
        const px = wide ? 30 + r() * 64 : 8 + r() * 84;
        const py = wide ? 14 + r() * 72 : 12 + r() * 46;
        if (wide && px < 46 && py > 46) continue;
        const minD = 7 + x.w * 7;
        if (placed.every((p) => Math.hypot((p.x - px) * (wide ? 1.6 : 1), p.y - py) > minD)) {
          x.x = px; x.y = py; placed.push(x); break;
        }
      }
    });

    const wrap = $('.field__objects');
    const tags = [];
    placed.forEach((x, i) => {
      const glow = Math.round(26 + x.w * (wide ? 120 : 84));
      const b = el('button', 'obj');
      b.type = 'button';
      b.setAttribute('role', 'listitem');
      b.setAttribute('aria-label', `${x.name}, ${x.label}`);
      b.setAttribute('aria-expanded', 'false');
      b.style.cssText = `left:${x.x}%;top:${x.y}%;--c:${C[x.kind]};--glow:${glow}px;--hit:${Math.max(44, glow * 0.45)}px`;
      b.innerHTML = webbStar(glow, C[x.kind], { spikes: x.w > 0.45, glow: 0.4 + x.w * 0.6 });
      const tag = el('div', 'tag', `<span class="tag__line"></span><span class="tag__text"><span class="tag__name">${x.name}</span><span class="tag__meta">${x.meta}</span></span>`);
      tag.style.color = C[x.kind];
      tag.style.left = `${x.x}%`;
      tag.style.top = `${x.y}%`;
      if (x.x > (wide ? 72 : 55)) tag.classList.add('tag--flip');
      tag.hidden = !x.lead;
      x.tag = tag; x.btn = b;
      tags.push(x);
      b.addEventListener('click', () => {
        const open = b.getAttribute('aria-expanded') === 'true';
        tags.forEach((t) => { t.tag.hidden = true; t.btn.setAttribute('aria-expanded', 'false'); });
        if (open) { showLeads(); return; }
        tag.hidden = false;
        b.setAttribute('aria-expanded', 'true');
        if (tag.getBoundingClientRect().right > innerWidth - 12) tag.classList.add('tag--flip');
        if (tag.getBoundingClientRect().left < 12) tag.classList.remove('tag--flip');
      });
      wrap.appendChild(b);
      wrap.appendChild(tag);
    });
    function showLeads() {
      tags.forEach((t) => (t.tag.hidden = !t.lead));
      // Lead labels must not collide: flip one to the other side, then drop it below if still touching.
      const leads = tags.filter((t) => t.lead);
      const hit = (a, b) => { const r1 = a.querySelector('.tag__text').getBoundingClientRect(), r2 = b.querySelector('.tag__text').getBoundingClientRect(); return !(r1.right < r2.left - 8 || r2.right < r1.left - 8 || r1.bottom < r2.top - 4 || r2.bottom < r1.top - 4); };
      for (let i = 0; i < leads.length; i++) for (let j = 0; j < i; j++) {
        if (hit(leads[i].tag, leads[j].tag)) leads[i].tag.classList.toggle('tag--flip');
        if (hit(leads[i].tag, leads[j].tag)) leads[i].tag.classList.add('tag--below');
      }
    }
    requestAnimationFrame(showLeads);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { tags.forEach((t) => t.btn.setAttribute('aria-expanded', 'false')); showLeads(); }
    });

    // Background stars.
    const sky = $('.field__sky');
    const rs = rng(5);
    let html = '';
    for (let i = 0; i < 240; i++) {
      const s = rs() < 0.92 ? 1 : 2;
      html += `<i style="left:${(rs() * 100).toFixed(2)}%;top:${(rs() * 100).toFixed(2)}%;width:${s}px;height:${s}px;opacity:${(0.15 + rs() * 0.55).toFixed(2)}"></i>`;
    }
    sky.innerHTML = html;

    const readH = sum(D.readingDays) / 60;
    const musicH = sum(D.artists.map((a) => a.hours));
    const screenH = sum(D.shows.map((s) => s.hours));
    $('[data-lede]').innerHTML = `Até agora: <b>${Math.round(readH)} horas</b> lendo, <b>${Math.round(musicH)} horas</b> de música e <b>${Math.round(screenH)} horas</b> de séries e filmes. Cada luz é algo a que dei meu tempo: um livro, alguém que ouvi, uma série ou um filme. Quanto mais tempo, mais ela brilha.`;
  }

  // ---------- Nebula plate ----------
  function buildPlate() {
    // The Webb photo is the plate; the drawn nebula only shows if the photo fails to load.
    const plate = $('.plate');
    const img = $('.plate__img');
    const fallback = () => { plate.classList.add('no-photo'); drawNebula($('.plate__canvas')); };
    if (img.complete && img.naturalWidth === 0) fallback();
    else img.addEventListener('error', fallback);
  }

  function drawNebula(cv) {
    const W = cv.width, H = cv.height, ctx = cv.getContext('2d');
    const perm = new Uint8Array(512);
    const r = rng(42);
    const p = Array.from({ length: 256 }, (_, i) => i).sort(() => r() - 0.5);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    function noise(x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y);
      const a = perm[X] + Y, b = perm[X + 1] + Y;
      const l1 = grad(perm[a], x, y) + u * (grad(perm[b], x - 1, y) - grad(perm[a], x, y));
      const l2 = grad(perm[a + 1], x, y - 1) + u * (grad(perm[b + 1], x - 1, y - 1) - grad(perm[a + 1], x, y - 1));
      return l1 + v * (l2 - l1);
    }
    const fbm = (x, y) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 5; i++) { s += a * noise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; };
    const mix = (a, b, t) => a + (b - a) * t;
    const img = ctx.createImageData(W, H);
    const cx = W * 0.72, cy = H * 0.47, R = H * 0.3;
    const ochre = [227, 167, 95], rust = [190, 86, 52], salmon = [236, 143, 111], slate = [120, 150, 186], cream = [242, 222, 196];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = x / H, ny = y / H;
        const wx = fbm(nx * 2.2 + 3, ny * 2.2) * 0.9, wy = fbm(nx * 2.2, ny * 2.2 + 7) * 0.9;
        const dx = x - cx + wx * R * 0.35, dy = (y - cy) * 1.08 + wy * R * 0.35;
        const d = Math.hypot(dx, dy) / R;
        const ang = Math.atan2(dy, dx);
        const fil = 0.55 + 0.45 * Math.sin(ang * 23 + fbm(nx * 6, ny * 6) * 6);
        const ring = Math.exp(-Math.pow((d - 1) / 0.28, 2)) * (0.55 + 0.6 * fbm(nx * 5, ny * 5) + 0.25 * fil);
        const halo = Math.exp(-Math.pow((d - 1.35) / 0.35, 2)) * 0.35 * (0.5 + fbm(nx * 3 + 9, ny * 3));
        const inner = d < 1 ? Math.pow(1 - d, 1.4) * 0.55 * (0.6 + fbm(nx * 4 + 1, ny * 4 + 2)) : 0;
        const dust = Math.max(0, fbm(nx * 1.6 + 11, ny * 1.6 + 4)) * 0.22 * Math.exp(-Math.pow(d / 2.6, 2));
        let rC = 0, gC = 0, bC = 0;
        const t = Math.min(1, Math.max(0, (d - 0.75) / 0.6));
        const rc = [mix(ochre[0], rust[0], t), mix(ochre[1], rust[1], t), mix(ochre[2], rust[2], t)];
        rC += rc[0] * ring + salmon[0] * halo + slate[0] * inner + ochre[0] * dust;
        gC += rc[1] * ring + salmon[1] * halo + slate[1] * inner + ochre[1] * dust;
        bC += rc[2] * ring + salmon[2] * halo + slate[2] * inner + ochre[2] * dust;
        const core = Math.exp(-Math.pow(d / 0.12, 2)) * 0.9;
        rC += cream[0] * core; gC += cream[1] * core; bC += cream[2] * core;
        const i = (y * W + x) * 4;
        img.data[i] = Math.min(255, 10 + rC * 0.92);
        img.data[i + 1] = Math.min(255, 9 + gC * 0.92);
        img.data[i + 2] = Math.min(255, 9 + bC * 0.92);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---------- Reading ----------
  function buildReading() {
    const days = D.readingDays;
    const max = Math.max(...days);
    const top = [...days].map((m, i) => [m, i]).sort((a, b) => b[0] - a[0]).slice(0, 8).map((x) => x[1]);
    const first = new Date(Date.UTC(D.year, 0, 1)).getUTCDay();
    const year = $('[data-year]');
    let html = '';
    for (let i = 0; i < first; i++) html += '<i class="zero" style="visibility:hidden"></i>';
    days.forEach((m, i) => {
      if (!m) { html += '<i class="zero"></i>'; return; }
      const v = m / max;
      const s = (3 + 11 * Math.sqrt(v)).toFixed(1);
      html += `<i style="--s:${s}px;--o:${(0.35 + 0.65 * v).toFixed(2)};--g:${(0.2 + 0.6 * v).toFixed(2)}">${top.includes(i) ? webbStar(34, C.read, { core: 0.08, glow: 0.2 }) : ''}</i>`;
    });
    year.innerHTML = html;
    const cols = Math.ceil((days.length + first) / 7);
    year.style.setProperty('--cols', cols);
    $('[data-months]').style.setProperty('--cols', cols);
    const total = sum(days) / 60;
    const read = days.filter(Boolean).length;
    year.setAttribute('aria-label', `${read} dias com leitura de ${days.length}; ${Math.round(total)} horas no total.`);
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const mEl = $('[data-months]');
    mEl.innerHTML = months.map((name, mi) => {
      const doy = (Date.UTC(D.year, mi, 1) - Date.UTC(D.year, 0, 1)) / 86400000;
      if (doy >= days.length) return '';
      const col = Math.floor((doy + first) / 7) + 1;
      return `<span style="grid-column-start:${col}">${name}</span>`;
    }).join('');

    // Eye.
    const clock = D.readingClock;
    const S = 400, c = S / 2;
    let svg = `<svg viewBox="0 0 ${S} ${S}" aria-hidden="true"><defs><radialGradient id="pupil"><stop offset="0" stop-color="#DCE7F2" stop-opacity=".9"/><stop offset=".35" stop-color="${C.music}" stop-opacity=".35"/><stop offset="1" stop-color="${C.music}" stop-opacity="0"/></radialGradient></defs><circle cx="${c}" cy="${c}" r="58" fill="url(#pupil)"/>`;
    let best = [0, 0, 0];
    for (let d = 0; d < 7; d++) {
      const rad = 64 + d * 19;
      svg += `<circle cx="${c}" cy="${c}" r="${rad}" fill="none" stroke="${C.band}" stroke-opacity=".06"/>`;
      for (let h = 0; h < 24; h++) {
        const v = clock[d][h];
        if (v > best[0]) best = [v, d, h];
        const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
        const x = c + Math.cos(a) * rad, y = c + Math.sin(a) * rad;
        const col = v > 0.55 ? C.read : v > 0.25 ? C.screen : C.band;
        svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.3 + v * 6.5).toFixed(1)}" fill="${col}" opacity="${(0.25 + v * 0.75).toFixed(2)}"/>`;
      }
    }
    [['0h', 0], ['6h', 6], ['12h', 12], ['18h', 18]].forEach(([t, h]) => {
      const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
      svg += `<text x="${(c + Math.cos(a) * 192).toFixed(1)}" y="${(c + Math.sin(a) * 192 + 4).toFixed(1)}" text-anchor="middle">${t}</text>`;
    });
    svg += '</svg>';
    const eye = $('[data-eye]');
    eye.innerHTML = svg;
    const wd = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    eye.setAttribute('aria-label', `Leitura por hora e dia da semana. Pico: ${wd[best[1]]}, ${best[2]}h.`);
    $('[data-eye-note]').innerHTML = `Minha hora mais forte é <b>${wd[best[1]]}, às ${best[2]}h</b>. As manhãs de fim de semana vêm logo atrás.`;

    // Books.
    const books = [...D.books].sort((a, b) => b.hours - a.hours);
    const bmax = books[0].hours;
    $('[data-books]').innerHTML = books.map((b) => {
      const st = b.status === 'lendo' ? `<span class="s">lendo · ${Math.round(b.progress * 100)}%</span>` : b.status === 'pausado' ? `<span class="s" style="color:var(--band-3)">pausado</span>` : '';
      return `<li class="${b.status === 'lendo' ? 'reading' : ''}"><span class="t">${b.title}</span><span class="h">${fmtH(b.hours)}</span><span class="a">${b.author} ${st}</span><span class="trail" style="--w:${Math.max(6, (b.hours / bmax) * 100).toFixed(1)}%"></span></li>`;
    }).join('');
    const finished = D.books.filter((b) => b.status === 'lido').length;
    const reading = D.books.find((b) => b.status === 'lendo');
    $('[data-read-line]').innerHTML = `<b>${finished} livros terminados</b> e ${read} noites com leitura este ano. Agora estou em <i>${reading.title}</i>, de ${reading.author}.`;
  }

  // ---------- Music ----------
  function buildMusic() {
    const t = D.recentTrack;
    const mins = Math.round((new Date(D.updatedAt) - new Date(t.playedAt)) / 60000);
    $('[data-recent]').innerHTML = `<div class="recent__orb" aria-hidden="true"></div><div><p class="recent__t">${t.title}</p><p class="recent__m">${t.artist} · <i>${t.album}</i></p><p class="recent__m">há ${mins} minutos</p></div>`;
    $('[data-tracks]').innerHTML = D.topTracks.map((x) => `<li><span>${x.title} <span class="a">· ${x.artist}</span></span><span class="x">${x.plays}×</span></li>`).join('');

    const cl = $('[data-cluster]');
    const max = D.artists[0].hours;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const r = rng(9);
    cl.innerHTML = D.artists.map((a, i) => {
      const rad = 0.13 * Math.sqrt(i + 0.3) + r() * 0.03;
      const ang = i * golden + 0.6;
      const x = 50 + Math.cos(ang) * rad * 100 * 1.15;
      const y = 50 + Math.sin(ang) * rad * 100 * 0.95;
      const s = Math.round(28 + 90 * Math.sqrt(a.hours / max));
      return `<span class="star" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%" title="${a.name}, ${a.hours} horas">${webbStar(s, C.music, { spikes: i < 4, glow: 0.4 + 0.6 * (a.hours / max) })}</span>${i < 8 ? `<span class="lbl" style="left:${x.toFixed(1)}%;top:calc(${y.toFixed(1)}% + ${Math.round(s * 0.2) + 4}px)"><b>${a.name}</b>${a.hours}h</span>` : ''}`;
    }).join('');
    cl.setAttribute('aria-label', 'Artistas do ano: ' + D.artists.map((a) => `${a.name}, ${a.hours} horas`).join('; '));

    const band = $('[data-band]');
    const lh = D.listeningHours;
    band.innerHTML = lh.map((v) => `<i style="--h:${(8 + v * 92).toFixed(0)}%;--o:${(0.4 + v * 0.6).toFixed(2)}"></i>`).join('');
    const peak = lh.indexOf(Math.max(...lh));
    band.setAttribute('aria-label', `Música ao longo do dia; pico às ${peak}h.`);
    const total = sum(D.artists.map((a) => a.hours));
    $('[data-music-line]').innerHTML = `<b>${total} horas</b> de música este ano, quase um quarto delas com <b>${D.artists[0].name}</b>. Ouço mais à tarde, por volta das ${peak}h.`;
  }

  // ---------- Screens ----------
  function buildScreens() {
    const series = D.shows.filter((s) => s.kind === 'série');
    const order = { watch_next: 0, collecting_dust: 1, caught_up: 2, completed: 3, stopped: 4 };
    series.sort((a, b) => order[a.status] - order[b.status]);
    const label = (s) => ({
      watch_next: [`Próximo: ${s.next}`, 'st-next'],
      collecting_dust: ['Juntando poeira', 'st-dust'],
      caught_up: ['Em dia', 'st-done'],
      completed: ['Completa', 'st-done'],
      stopped: ['Larguei', 'st-done'],
    })[s.status];
    $('[data-shows]').innerHTML = series.map((s) => {
      const R = 34, c = 44;
      let dots = `<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="${C.band}" stroke-opacity=".1"/>`;
      for (let e = 0; e < s.episodes; e++) {
        const a = (e / s.episodes) * Math.PI * 2 - Math.PI / 2;
        const on = e < s.watched;
        dots += `<circle cx="${(c + Math.cos(a) * R).toFixed(1)}" cy="${(c + Math.sin(a) * R).toFixed(1)}" r="${on ? 4 : 3}" fill="${on ? C.screen : C.band}" opacity="${on ? 1 : 0.2}"/>`;
      }
      const lit = s.watched / s.episodes;
      dots += `<circle cx="${c}" cy="${c}" r="${10 + lit * 8}" fill="${C.screen}" opacity="${(0.25 + lit * 0.6).toFixed(2)}"/>`;
      const [txt, cls] = label(s);
      return `<li class="orbit"><svg viewBox="0 0 88 88" role="img" aria-label="${s.watched} de ${s.episodes} episódios">${dots}</svg><div><p class="orbit__t">${s.title}</p><p class="orbit__s">Temporada ${s.season} · ${s.watched} de ${s.episodes}</p><span class="orbit__st ${cls}">${txt}</span></div></li>`;
    }).join('');

    const names = { touched: 'comoção', thrilled: 'empolgação', tense: 'tensão', amused: 'graça', shocked: 'choque', confused: 'confusão', scared: 'medo', bored: 'tédio' };
    const f = Object.entries(D.feelings).sort((a, b) => b[1] - a[1]);
    const fmax = f[0][1];
    const S = 380, c = S / 2;
    const pts = f.map(([k, n], i) => {
      const a = (i / f.length) * Math.PI * 2 - Math.PI / 2 + (i % 2 ? 0.18 : -0.1);
      const rr = 120 - (n / fmax) * 40 + (i % 3) * 14;
      return { k, n, x: c + Math.cos(a) * rr, y: c + Math.sin(a) * rr };
    });
    let svg = `<svg viewBox="0 0 ${S} ${S}" aria-hidden="true"><polyline points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="${C.screen}" stroke-opacity=".35" stroke-width="1"/>`;
    pts.forEach((p) => {
      const s = 4 + 12 * Math.sqrt(p.n / fmax);
      svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(s * 2.2).toFixed(1)}" fill="${C.screen}" opacity=".12"/><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(s / 2).toFixed(1)}" fill="#FFE6DA"/><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${s.toFixed(1)}" fill="${C.screen}" opacity=".5"/>`;
      const below = p.y > c;
      svg += `<text x="${p.x.toFixed(1)}" y="${(p.y + (below ? s + 20 : -s - 10)).toFixed(1)}" text-anchor="middle"><tspan class="n">${p.n}</tspan> ${names[p.k]}</text>`;
    });
    svg += '</svg>';
    const fe = $('[data-feelings]');
    fe.innerHTML = svg;
    fe.setAttribute('aria-label', 'Sentimentos marcados: ' + f.map(([k, n]) => `${names[k]} ${n}`).join(', '));
    // Make the count tspan bold via class (SVG text inherits).
    fe.querySelectorAll('tspan.n').forEach((t) => t.setAttribute('font-weight', '600'));

    const films = D.shows.filter((s) => s.kind === 'filme');
    $('[data-films]').innerHTML = films.map((m) => `<li><span class="t">${m.title}</span><span class="h">${fmtH(m.hours)}</span></li>`).join('');
    const eps = sum(series.map((s) => s.watched));
    const next = series.find((s) => s.status === 'watch_next');
    $('[data-screen-line]').innerHTML = `<b>${eps} episódios</b> e <b>${films.length} filmes</b> este ano. O próximo da fila é ${next.next} de <i>${next.title}</i>.`;
  }

  function buildFoot() {
    const [, y, mo, da, hh, mi] = D.updatedAt.match(/^(\d+)-(\d+)-(\d+)T(\d+):(\d+)/).map(Number);
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    $('[data-updated]').textContent = `Atualizado em ${da} de ${months[mo - 1]} de ${y}, às ${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}.`;
  }

  buildPlate();
  buildField();
  buildReading();
  buildMusic();
  buildScreens();
  buildFoot();
  requestAnimationFrame(() => $('.field').classList.add('focusing'));
})();
