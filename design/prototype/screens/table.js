// Season agent. This file also holds D2T.se: shared helpers for the in-season screens (table, squad, fixtures, match).
// It loads before squad.js, fixtures.js and match.js (see index.html), so they can use D2T.se.
(function () {
  const D2T = window.D2T;
  const SE = D2T.se = {};
  SE.SAMPLE = 'Wolves 2011/12';

  // ---------- run state ----------
  // Returns { st: D2T.state.run, data: D2T.run(), sample }. With no run, Wolves 2011/12 is used as a sample (kept in memory until an action saves).
  SE.ensure = () => {
    let sample = false;
    if (!D2T.run()) { D2T.state.run = { key: SE.SAMPLE, step: 'table', gw: 1, formation: '4-4-2', xi: [], subs: [], signed: [] }; sample = true; }
    const st = D2T.state.run;
    st.gw = st.gw || 1; st.formation = SE.FORMATIONS[st.formation] ? st.formation : '4-4-2';
    st.signed = st.signed || []; st.xi = st.xi || []; st.subs = st.subs || []; st.results = st.results || {};
    return { st, data: D2T.run(), sample };
  };
  SE.setStep = (ctx, step) => { ctx.st.step = step; if (!ctx.sample) D2T.save(); };

  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  SE.rgba = rgba;
  // The club colour is the accent inside a run.
  SE.accent = (root, club) => {
    root.style.setProperty('--se-acc', club.accent);
    root.style.setProperty('--se-ink', club.ink);
    root.style.setProperty('--se-text', club.text);
    root.style.setProperty('--se-acc-a', rgba(club.accent, 0.22));
    root.style.setProperty('--se-acc-b', rgba(club.accent, 0.55));
    root.classList.add('se-run');
  };
  SE.club = (data, name) => {
    const c = D2T.data.clubs[name], t = data.table.find((r) => r.name === name) || {};
    return { name, code: (c && c.code) || t.code || name.slice(0, 3).toUpperCase(), crest: (c && c.crest) || t.crest, accent: (c && c.accent) || '#FFFFFF', full: (c && c.full) || name };
  };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  SE.date = (iso, year = true) => { const d = new Date(iso + 'T12:00:00Z'); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${year ? ' ' + d.getUTCFullYear() : ''}`; };
  SE.fixture = (data, gw) => data.fixtures.find((f) => f.gw === gw) || null;
  SE.transferDue = (newGw) => newGw > 1 && (newGw - 1) % 3 === 0; // Craig's schedule: a roll every 3 games (prototype: first one when gw becomes 4)

  // ---------- squad and formations ----------
  // Slots run from the GK upwards; x and y are % of the pitch (attack at the top).
  const F = (rows) => rows.flatMap(([role, y, xs]) => xs.map((x, i) => ({ role, x, y: Array.isArray(y) ? y[i] : y })));
  SE.FORMATIONS = {
    '4-4-2': F([['GK', 88, [50]], ['DEF', 67.5, [13, 37, 63, 87]], ['MID', 42, [13, 37, 63, 87]], ['FWD', 16.5, [35, 65]]]),
    '4-3-3': F([['GK', 88, [50]], ['DEF', 67.5, [13, 37, 63, 87]], ['MID', 43, [24, 50, 76]], ['FWD', 17, [16, 50, 84]]]),
    '4-2-3-1': F([['GK', 88.5, [50]], ['DEF', 70, [13, 37, 63, 87]], ['MID', 51.5, [32, 68]], ['MID', 32.5, [15, 50, 85]], ['FWD', 13, [50]]]),
    '3-5-2': F([['GK', 88, [50]], ['DEF', 68, [24, 50, 76]], ['MID', [38, 46, 47, 46, 38], [10, 30, 50, 70, 90]], ['FWD', 16, [35, 65]]]),
    '5-3-2': F([['GK', 88, [50]], ['DEF', [62, 68.5, 69.5, 68.5, 62], [10, 30, 50, 70, 90]], ['MID', 42, [24, 50, 76]], ['FWD', 16.5, [35, 65]]]),
    '4-5-1': F([['GK', 88, [50]], ['DEF', 67.5, [13, 37, 63, 87]], ['MID', [38, 45, 46, 45, 38], [10, 30, 50, 70, 90]], ['FWD', 14.5, [50]]])
  };
  SE.FORMATION_KEYS = Object.keys(SE.FORMATIONS);

  // Every card I own: the real squad plus anyone signed during the run (from that season's transfer pool).
  SE.cards = (ctx) => {
    const map = new Map();
    ctx.data.squad.forEach((c) => map.set(c.name, c));
    ctx.st.signed.forEach((n) => { const c = ctx.data.transferPool.find((p) => p.name === n); if (c) map.set(c.name, c); });
    return map;
  };
  const fit = (card, role) => (card.pos === role ? card.ovr : card.ovr - (role === 'GK' || card.pos === 'GK' ? 60 : 12));
  // Best XI for a formation: fill each role with the highest rated natural players, then fill gaps with the best fit.
  SE.bestXI = (formation, cards) => {
    const slots = SE.FORMATIONS[formation], pool = [...cards].sort((a, b) => b.ovr - a.ovr), xi = new Array(slots.length).fill(null), used = new Set();
    slots.forEach((s, i) => { const c = pool.find((p) => !used.has(p.name) && p.pos === s.role); if (c) { xi[i] = c; used.add(c.name); } });
    slots.forEach((s, i) => { if (xi[i]) return; const c = pool.filter((p) => !used.has(p.name)).sort((a, b) => fit(b, s.role) - fit(a, s.role))[0]; if (c) { xi[i] = c; used.add(c.name); } });
    return xi.map((c) => c.name);
  };
  // Makes sure xi (11 names in slot order) and subs are valid for this run; repairs and suggests where needed.
  SE.lineup = (ctx) => {
    const st = ctx.st, all = SE.cards(ctx);
    let xi = st.xi.filter((n) => all.has(n));
    if (xi.length !== 11 || new Set(xi).size !== 11) xi = SE.bestXI(st.formation, [...all.values()]);
    const inXI = new Set(xi);
    let subs = st.subs.filter((n) => all.has(n) && !inXI.has(n));
    const missing = [...all.values()].filter((c) => !inXI.has(c.name) && !subs.includes(c.name)).sort((a, b) => b.ovr - a.ovr).map((c) => c.name);
    subs = subs.concat(missing);
    st.xi = xi; st.subs = subs;
    return { all, xi: xi.map((n) => all.get(n)), subs: subs.map((n) => all.get(n)) };
  };
  SE.rating = (xiCards) => Math.round(xiCards.reduce((s, c) => s + c.ovr, 0) / xiCards.length);

  // ---------- seeded simulation ----------
  SE.hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  SE.rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const poisson = (lambda, rnd) => { const L = Math.exp(-lambda); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; };
  const pick = (arr, w, rnd) => { const tot = arr.reduce((s, x) => s + w(x), 0); let r = rnd() * tot; for (const x of arr) { r -= w(x); if (r <= 0) return x; } return arr[arr.length - 1]; };
  // Opponent strength from their real league finish that season: 1st about 80, 20th about 64.
  SE.oppStrength = (data, opp) => { const row = data.table.find((r) => r.name === opp); return 80 - ((row ? row.pos : 10) - 1) * 0.85; };
  // A simple seeded Poisson match: my XI average vs the opponent's strength, a little home advantage. Same XI + gameweek = same result.
  SE.simulate = (ctx, gw) => {
    const fx = SE.fixture(ctx.data, gw), line = SE.lineup(ctx), me = SE.rating(line.xi), opp = SE.oppStrength(ctx.data, fx.opp);
    const rnd = SE.rng(SE.hash(ctx.st.key + '|' + gw + '|' + ctx.st.xi.join(',')));
    const home = fx.ha === 'H' ? 1.12 : 0.9;
    const lamFor = 1.3 * Math.exp((me - opp) / 21) * home, lamAg = 1.3 * Math.exp((opp - me) / 21) / home;
    const gf = Math.min(6, poisson(lamFor, rnd)), ga = Math.min(6, poisson(lamAg, rnd));
    const myName = ctx.data.club.name;
    const outfield = line.xi.filter((c) => c.pos !== 'GK');
    const oppPlayers = ctx.data.transferPool.filter((p) => p.club === fx.opp);
    const oppOut = oppPlayers.filter((p) => p.pos !== 'GK');
    const minutes = (n) => Array.from({ length: n }, () => 1 + Math.floor(rnd() * 90)).sort((a, b) => a - b);
    const ev = [];
    minutes(gf).forEach((m) => ev.push({ min: m, side: 'me', type: 'goal', who: pick(outfield, (c) => Math.pow(c.stats.GOL || 20, 2), rnd).name }));
    minutes(ga).forEach((m) => ev.push({ min: m, side: 'opp', type: 'goal', who: oppOut.length ? pick(oppOut, (c) => Math.pow(c.stats.GOL || 20, 2), rnd).name : '' }));
    const misses = 2 + Math.floor(rnd() * 4);
    for (let i = 0; i < misses; i++) {
      const mine = rnd() < lamFor / (lamFor + lamAg);
      const who = mine ? pick(outfield, (c) => (c.stats.GOL || 20) + (c.stats.IMP || 20), rnd).name : (oppOut.length ? pick(oppOut, (c) => c.stats.GOL || 20, rnd).name : '');
      ev.push({ min: 2 + Math.floor(rnd() * 87), side: mine ? 'me' : 'opp', type: 'miss', who, kind: Math.floor(rnd() * 4) });
    }
    const cards = Math.floor(rnd() * 4);
    for (let i = 0; i < cards; i++) {
      const mine = rnd() < 0.5;
      const who = mine ? pick(outfield, (c) => 100 - (c.stats.DEF || 50) / 2, rnd).name : (oppOut.length ? oppOut[Math.floor(rnd() * oppOut.length)].name : '');
      ev.push({ min: 5 + Math.floor(rnd() * 84), side: mine ? 'me' : 'opp', type: 'yellow', who });
    }
    ev.push({ min: 45, type: 'ht' }, { min: 90, type: 'ft' });
    const order = { goal: 1, miss: 0, yellow: 2, ht: 3, ft: 4 };
    ev.sort((a, b) => a.min - b.min || order[a.type] - order[b.type]);
    return { gw, opp: fx.opp, ha: fx.ha, gf, ga, me, oppStrength: Math.round(opp), events: ev, myName };
  };

  // ---------- league table ----------
  const blankRow = (r) => ({ name: r.name, code: r.code, crest: r.crest, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
  const apply = (rows, home, away, hg, ag) => {
    const h = rows[home], a = rows[away]; if (!h || !a) return;
    h.p++; a.p++; h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
    if (hg > ag) { h.w++; a.l++; h.pts += 3; } else if (hg < ag) { a.w++; h.l++; a.pts += 3; } else { h.d++; a.d++; h.pts++; a.pts++; }
  };
  SE.sortRows = (rows) => rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));
  // Table from zero after gameweek `upto`: real results for everyone else (gameweeks 1 to 3), my simulated results for me.
  SE.standings = (ctx, upto) => {
    const rows = {}, me = ctx.data.club.name;
    ctx.data.table.forEach((r) => { rows[r.name] = blankRow(r); });
    for (let g = 1; g <= upto; g++) {
      if (g <= 3 && ctx.data.gwFixtures[g]) ctx.data.gwFixtures[g].forEach((f) => { if (f.home !== me && f.away !== me) apply(rows, f.home, f.away, f.hg, f.ag); });
      const res = ctx.st.results[g];
      if (res) { const fx = SE.fixture(ctx.data, g); if (fx.ha === 'H') apply(rows, me, fx.opp, res.gf, res.ga); else apply(rows, fx.opp, me, res.ga, res.gf); }
    }
    return SE.sortRows(Object.values(rows)).map((r, i) => Object.assign(r, { pos: i + 1 }));
  };
  const COLS = ['p', 'w', 'd', 'l', 'gf', 'ga', 'pts'];
  SE.tableHead = () => `<div class="se-tr se-th" aria-hidden="true"><span class="se-pos">#</span><span></span><span class="se-team">Club</span><span>P</span><span>W</span><span>D</span><span>L</span><span>GF</span><span>GA</span><span class="se-pts">Pts</span></div>`;
  SE.rowHTML = (r, me, extra = '') => `<div class="se-tr${r.name === me ? ' se-me' : ''} ${extra}" data-name="${D2T.esc(r.name)}" role="row" aria-label="${r.pos}. ${D2T.esc(r.name)}, ${r.pts} points">
    <span class="se-pos">${r.pos}</span><img class="se-crest" src="${r.crest}" alt=""><span class="se-team"><span class="se-tname">${D2T.esc(r.name)}</span></span>
    ${COLS.map((k) => `<span class="se-n${k === 'pts' ? ' se-pts' : ''}" data-k="${k}" data-v="${r[k]}">${r[k]}</span>`).join('')}</div>`;
  SE.COLS = COLS;

  // FLIP: animate elements from their old rects (map key -> DOMRect) to where they are now.
  SE.flip = (els, before, opts = {}) => {
    if (D2T.reduced()) return;
    els.forEach((el, i) => {
      const k = el.dataset.name, b = before.get(k); if (!b) return;
      const a = el.getBoundingClientRect(), dx = b.left - a.left, dy = b.top - a.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: opts.duration || 600, delay: (opts.stagger || 0) * i, easing: opts.easing || 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    });
  };
  SE.rects = (els) => new Map([...els].map((el) => [el.dataset.name, el.getBoundingClientRect()]));

  // Smooth follow-scroll (as Tenaball's scan camera): eases the scroller towards a target row each frame.
  SE.follow = (scroller) => {
    let target = null, on = true;
    const tick = () => {
      if (!on) return;
      if (target !== null) { const y = scroller.scrollTop, d = target - y; if (Math.abs(d) > 0.5) scroller.scrollTop = y + d * 0.2; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return {
      to: (el, at = 0.45) => { const sr = scroller.getBoundingClientRect(), r = el.getBoundingClientRect(); target = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + r.top - sr.top + r.height / 2 - scroller.clientHeight * at)); },
      stop: () => { on = false; }
    };
  };

  // ---------- table screen: the real final table revealed top to bottom, then reset to zero ----------
  D2T.screen('table', {
    title: 'Historic table', theme: 'black',
    mount(root) {
      const ctx = SE.ensure(), data = ctx.data, club = data.club, me = club.name;
      SE.accent(root, club); SE.setStep(ctx, 'table');
      const mine = data.table.find((r) => r.name === me);
      const relegated = mine.pos >= 18;
      root.appendChild(D2T.topbar());
      const body = D2T.h(`<div class="screen-body se-table-screen">
        <div class="se-clubhead">
          <img class="se-clubcrest" src="${club.crest}" alt="">
          <div class="se-clubtext"><div class="se-kicker">Your club</div><h1 class="se-h1">${D2T.esc(club.name)}</h1><div class="se-season">${data.season}</div></div>
        </div>
        <div class="se-tablelabel"><span class="se-tl-a">Real final table ${data.season}</span><span class="se-tl-b" aria-live="polite"></span></div>
        <div class="se-table" role="table" aria-label="Premier League ${data.season}">${SE.tableHead()}
          ${data.table.map((r) => SE.rowHTML(r, me, 'se-hid' + (r.pos === 17 ? ' se-zone' : ''))).join('')}
        </div>
        <p class="se-note se-fin">${D2T.esc(club.name)} finished ${D2T.ordinal(mine.pos)} on ${mine.pts} points${relegated ? ' and went down' : ''}. Now it is your turn.</p>
        <div class="se-pad"></div>
      </div>`);
      const flash = D2T.h('<div class="se-newseason" aria-hidden="true"><span>New season</span></div>');
      const bar = D2T.h('<footer class="actionbar"><button class="btn se-btn se-btn-ghost se-wide" type="button">Skip</button></footer>');
      root.append(body, flash, bar);
      const btn = bar.querySelector('button');
      const tbl = body.querySelector('.se-table');
      const rowsEl = () => [...tbl.querySelectorAll('.se-tr:not(.se-th)')];
      let gen = 0, done = false, cam = null, alive = true;
      this._kill = () => { alive = false; gen++; cam && cam.stop(); };

      const finish = (rebuild = true) => { // final state: zeroed and alphabetical, my row highlighted
        gen++; done = true; cam && cam.stop();
        if (rebuild) {
        const sorted = [...data.table].sort((a, b) => a.name.localeCompare(b.name));
        rowsEl().forEach((el) => el.remove());
        sorted.forEach((r, i) => {
          const el = D2T.h(SE.rowHTML(Object.assign({}, r, { pos: i + 1, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }), me, (i === 16 ? 'se-zone' : '') + (r.name === me ? ' se-landed' : '')));
          tbl.appendChild(el);
        });
        }
        body.classList.add('se-reset');
        body.querySelector('.se-tl-a').textContent = `${data.season} · New season`;
        body.querySelector('.se-tl-b').textContent = 'Everyone starts on 0.';
        body.querySelector('.se-fin').textContent = `Real finish: ${D2T.ordinal(mine.pos)}, ${mine.pts} points. Beat it.`;
        btn.textContent = 'Continue'; btn.classList.remove('se-btn-ghost');
        const myEl = tbl.querySelector('.se-me');
        if (myEl && rebuild) { const sr = body.getBoundingClientRect(), r = myEl.getBoundingClientRect(); body.scrollTop += r.top - sr.top - body.clientHeight * 0.45; }
      };

      btn.onclick = () => {
        if (!done) { finish(true); return; }
        ctx.st.step = 'squad'; D2T.save(); D2T.go('squad');
      };

      const run = async () => {
        const g = ++gen, ok = () => alive && g === gen;
        const els = rowsEl();
        const stopAt = els.findIndex((el) => el.dataset.name === me);
        if (D2T.reduced()) {
          els.forEach((el) => el.classList.remove('se-hid'));
          els[stopAt].classList.add('se-landed');
          await D2T.wait(1800); if (!ok()) return;
          finish(); return;
        }
        await D2T.wait(450); if (!ok()) return;
        cam = SE.follow(body);
        // Tenaball's scan, reversed: start at 1st and run down to my club, fast at first and slowing into my result.
        const N = stopAt + 1;
        for (let i = 0; i < N; i++) {
          els.forEach((e) => e.classList.remove('se-scan'));
          const el = els[i];
          el.classList.remove('se-hid'); el.classList.add('se-build', 'se-scan');
          cam.to(el);
          if (i === stopAt) break;
          const t = N > 1 ? i / (N - 1) : 1;
          await D2T.wait(38 + 520 * Math.pow(t, 2.8)); if (!ok()) return;
        }
        const myEl = els[stopAt];
        myEl.classList.add('se-stop');
        await D2T.wait(900); if (!ok()) return;
        myEl.classList.remove('se-scan', 'se-stop');
        myEl.classList.add('se-landed', 'se-thump');
        tbl.classList.add('se-shake');
        els.slice(stopAt + 1).forEach((el, k) => { el.classList.remove('se-hid'); el.classList.add('se-build'); el.style.animationDelay = (k * 70) + 'ms'; });
        body.querySelector('.se-fin').classList.add('se-in');
        await D2T.wait(1700); if (!ok()) return;
        tbl.classList.remove('se-shake');

        // Reset: every number rolls down to 0 together, then the table flattens to alphabetical.
        flash.classList.add('se-go');
        body.querySelector('.se-tl-a').textContent = `${data.season} · New season`;
        const nums = [...tbl.querySelectorAll('.se-n')];
        const from = nums.map((n) => +n.dataset.v);
        const t0 = performance.now(), dur = 1300;
        await new Promise((res) => {
          const step = (now) => {
            if (!ok()) return res();
            const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
            nums.forEach((n, i) => { const v = Math.round(from[i] * (1 - e)); if (n.textContent !== String(v)) n.textContent = v; });
            if (p < 1) requestAnimationFrame(step); else res();
          };
          requestAnimationFrame(step);
        });
        if (!ok()) return;
        body.classList.add('se-reset');
        await D2T.wait(350); if (!ok()) return;
        const before = SE.rects(els);
        const sorted = [...els].sort((a, b) => a.dataset.name.localeCompare(b.dataset.name));
        sorted.forEach((el, i) => { tbl.appendChild(el); el.classList.remove('se-zone', 'se-build', 'se-thump'); el.style.animationDelay = ''; el.querySelector('.se-pos').textContent = i + 1; if (i === 16) el.classList.add('se-zone'); });
        SE.flip(sorted, before, { duration: 900, stagger: 18, easing: 'cubic-bezier(.65,0,.25,1)' });
        cam.to(myEl);
        body.querySelector('.se-tl-b').textContent = 'Everyone starts on 0.';
        await D2T.wait(1300); if (!ok()) return;
        flash.classList.remove('se-go');
        finish(false);
      };
      run();
    },
    unmount() { this._kill && this._kill(); }
  });
})();
