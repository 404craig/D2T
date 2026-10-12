// Unbeaten Run (black, cyan #22D3EE as the mode colour; Craig's higher or lower game, 12 Oct, prototype on this branch).
// A spin picks the stat for the run (Premier League numbers only, for now). Two real players (or clubs) side by side: the
// left one's number shows on his shirt, the right one's is a ?. Swipe the right shirt up for higher, down for lower, or
// tap Higher or Lower. Right: +1 to the unbeaten run, his shirt slides left and the reel spins in the next. Wrong: the run
// is over. Sudden death, no skips, never an equal pair, never a zero, no repeats in a run. Cards are random from the whole
// deck, with close calls (within 10%) mixed in: about 1 in 5 for cards 1 to 10, 1 in 3 for 11 to 20, then 1 in 2.
// Best run per stat in D2T.state.ub, apart from every other mode's record.
(function () {
  const C = '#22D3EE';
  const snd = (id) => { const S = window.D2TSound; if (S) S.play(id); };
  const rand = (n) => Math.floor(Math.random() * n);
  const UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 15l7-7 7 7"/></svg>';
  const DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>';

  // ---------- the stats (one per run) ----------
  const STATS = [
    { id: 'cg', big: 'Career goals', unit: 'Premier League goals', deck: 'career', val: (r) => r.g },
    { id: 'ca', big: 'Career appearances', unit: 'Premier League games', deck: 'career', val: (r) => r.a },
    { id: 'cas', big: 'Career assists', unit: 'Premier League assists', deck: 'career', val: (r) => r.as },
    { id: 'cga', big: 'Career goals + assists', unit: 'Premier League goals and assists', deck: 'career', val: (r) => r.g + r.as },
    { id: 'sg', big: 'Goals in a season', unit: 'Premier League goals', deck: 'season', val: (r) => r.g },
    { id: 'sga', big: 'Goals + assists in a season', unit: 'Premier League goals and assists', deck: 'season', val: (r) => r.g + r.as },
    { id: 'pts', big: 'Points in a season', unit: 'points', deck: 'club', val: (r) => r.pts },
    { id: 'w', big: 'Wins in a season', unit: 'wins', deck: 'club', val: (r) => r.w },
    { id: 'atp', big: 'All-time points', unit: 'Premier League points', deck: 'alltime', val: (r) => r.pts }
  ];

  // ---------- decks, built once from the game data ----------
  let DECKS = null;
  function decks() {
    if (DECKS) return DECKS;
    const G = window.D2T_GAME, keys = Object.keys(G.seasons).sort();
    const disp = (n) => n.replace(/\s*\([^)]*\)$/, '');
    const name = {}, as = {}, apps = {}, nat = {}, season = [];
    keys.forEach((sk) => {
      const S = G.seasons[sk], cl = S.clubs.map((c) => c.name);
      S.players.forEach((p) => {
        name[p.k] = disp(p.n); as[p.k] = (as[p.k] || 0) + (p.as || 0); nat[p.k] = p.nat || '';
        const a = apps[p.k] || (apps[p.k] = {});
        a[cl[p.c]] = (a[cl[p.c]] || 0) + (p.a1 != null ? p.a1 : p.a);
        if (p.c2 != null) a[cl[p.c2]] = (a[cl[p.c2]] || 0) + (p.a2 || 0);
        const two = p.c2 != null && (p.a2 || 0) > (p.a1 || 0);
        season.push({ name: disp(p.n), club: cl[two ? p.c2 : p.c], club2: p.c2 != null ? cl[two ? p.c : p.c2] : null, season: sk, g: p.g, as: p.as || 0, nat: p.nat || '' });
      });
    });
    const career = [];
    (G.careers || []).forEach((k, i) => {
      if (name[i] == null) return;
      const club = Object.entries(apps[i]).sort((x, y) => y[1] - x[1])[0][0];
      career.push({ name: name[i], club, a: k.a, g: k.g, as: as[i], f: k.f, l: k.l, nat: nat[i] });
    });
    const club = (G.clubSeasons || []).map((c) => ({ club: c.club, season: c.season, pts: c.pts, w: c.w }));
    const tot = {};
    club.forEach((c) => { const t = tot[c.club] || (tot[c.club] = { club: c.club, pts: 0, n: 0 }); t.pts += c.pts; t.n++; });
    DECKS = { career, season, club, alltime: Object.values(tot) };
    return DECKS;
  }

  // ---------- a shirt with the stat as its number, and the club badge and his flag under it ----------
  const SHIRT = 'M31 9 L42 4 Q50 11 58 4 L69 9 L95 24 L85 44 L74 38 L74 96 L26 96 L26 38 L15 44 L5 24 Z';
  const SLEEVES = 'M31 9 L5 24 L15 44 L26 38 Z M69 9 L95 24 L85 44 L74 38 Z';
  function shirt(w, club, word, num) {
    const k = D2T.shirts.kit(club), st = k.stroke ? ` stroke="${k.stroke}" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round"` : '';
    const W = word.toUpperCase(), fs = Math.max(8.5, Math.min(13, 104 / Math.max(6, W.length)));
    const n = num == null ? '?' : String(num);
    const fill = k.pat ? `url(#g4p-${k.id})` : k.fill;
    const sleeves = k.sl ? `<path d="${SLEEVES}" fill="${k.sl}" stroke="${k.trim}" stroke-width="2.4" stroke-linejoin="round"/>` : '';
    return `<div class="g4-shirt ub-shirt" style="--sw:${w}px;--trimc:${k.trim};--ink:${k.ink}"><svg viewBox="0 0 100 100" aria-hidden="true"><path class="body" d="${SHIRT}" style="fill:${fill}"/>${sleeves}
      <path d="${SHIRT}" fill="url(#g4sheen)"/><path class="body" d="${SHIRT}" style="fill:none"/><path class="trim" d="M42 4 Q50 11 58 4"/><path class="trim" d="M85 44 L95 24 M15 44 L5 24" stroke-width="3"/>
      <text x="50" y="27" font-size="${fs}" textLength="${Math.min(52, W.length * fs * 0.62)}" lengthAdjust="spacingAndGlyphs"${st}>${D2T.esc(W)}</text>
      <text class="ub-num${num == null ? ' q' : ''}" x="50" y="70" font-size="34"${n.length > 2 ? ' textLength="44" lengthAdjust="spacingAndGlyphs"' : ''}${st}>${n}</text></svg></div>`;
  }
  function item(stat, r, shown, w) {
    const G = D2T.game, c = G.club(r.club), v = shown ? stat.val(r) : null;
    const word = r.name ? r.name.split(' ').slice(-1)[0] : (c.name || r.club);
    const flag = r.nat ? G.flag(r.nat) : '';
    const second = r.name ? (flag ? `<span class="ub-flag"><img class="d2c-flag" src="${flag}" alt="${D2T.esc(r.nat)}" title="${D2T.esc(r.nat)}"></span>` : `<span class="ub-chip">${D2T.esc(r.nat || '')}</span>`)
      : r.season ? `<span class="ub-chip ub-chip-s">${r.season}</span>` : `<span class="ub-chip ub-chip-s">${r.n} seasons</span>`;
    return `<div class="ub-item">${shirt(w, r.club, word, v)}<div class="ub-row"><span class="ub-crest"><img src="${G.crestHi(r.club) || c.crest}" alt="${D2T.esc(c.full || r.club)}"></span>${second}</div></div>`;
  }
  const whoLine = (stat, r) => {
    const c = D2T.game.club(r.club);
    if (!r.name) return `<b>${D2T.esc(c.full || r.club)}</b>`;
    const where = stat.deck === 'career' ? `${D2T.esc(c.name || r.club)} · ${r.f === r.l ? r.f : r.f + ' to ' + r.l}` : `${D2T.esc(c.name || r.club)}${r.club2 ? ' / ' + D2T.esc(D2T.game.club(r.club2).name || r.club2) : ''} · ${r.season}`;
    return `<b>${D2T.esc(r.name)}</b><span>${where}</span>`;
  };

  // ---------- one reel (D2T's fruit machine: the roll screen's motion, sized for a shirt) ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let fid = 0;
  class Reel {
    constructor(slot, pitch) {
      this.slot = slot; this.pitch = pitch; this.id = 'ubmb' + (++fid);
      slot.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="${this.id}" x="-20%" y="-40%" width="140%" height="180%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 0"/></filter></svg>
        <div class="sp-glow"></div><div class="sp-win"><div class="sp-strip">${'<div class="sp-node"></div>'.repeat(5)}<div class="sp-streak"></div></div><div class="sp-sweep"></div></div>`;
      this.win = slot.querySelector('.sp-win'); this.strip = slot.querySelector('.sp-strip'); this.streak = slot.querySelector('.sp-streak');
      this.nodes = Array.from(slot.querySelectorAll('.sp-node')); this.gauss = slot.querySelector('feGaussianBlur');
      this.seq = []; this.filtered = false; this.landed = 0;
    }
    show(html) { this.seq = [html]; this.landed = 0; this.nodes.forEach((n) => { n.dataset.vi = ''; n.classList.remove('is-gone'); n.classList.add('is-hit'); }); this.draw(0, 0); }
    load(seq) { this.seq = seq; this.nodes.forEach((n) => { n.dataset.vi = ''; n.classList.remove('is-hit', 'is-gone'); }); this.slot.classList.remove('is-set'); this.draw(0, 0); }
    draw(p, v) {
      const c = Math.round(p), P = this.pitch;
      for (let k = -2; k <= 2; k++) {
        const vi = c + k, node = this.nodes[((vi % 5) + 5) % 5];
        if (node.dataset.vi !== String(vi)) { node.dataset.vi = String(vi); node.innerHTML = this.seq[vi] || ''; }
        node.style.transform = `translate3d(0, ${((vi - p) * P).toFixed(2)}px, 0)`;
      }
      const pxf = Math.abs(v) * P / 60, sd = clamp(pxf * 0.3 - 1.2, 0, 22);
      if (sd < 0.4) { if (this.filtered) { this.strip.style.filter = ''; this.gauss.setAttribute('stdDeviation', '0 0'); this.filtered = false; } }
      else { this.gauss.setAttribute('stdDeviation', `0 ${sd.toFixed(1)}`); if (!this.filtered) { this.strip.style.filter = `url(#${this.id})`; this.filtered = true; } }
      const k = clamp(pxf / 80, 0, 1);
      this.streak.style.opacity = (k * k * 0.9).toFixed(3);
      this.win.style.transform = k > 0.02 ? `scaleY(${(1 + 0.05 * k).toFixed(4)})` : '';
    }
    hit() { this.slot.style.setProperty('--sp-accent', C); this.slot.classList.remove('is-hit'); void this.slot.offsetWidth; this.slot.classList.add('is-hit'); }
    settle(t) {
      this.landed = t;
      this.nodes.forEach((n) => { if (n.dataset.vi === String(t)) n.classList.add('is-hit'); else n.classList.add('is-gone'); });
      setTimeout(() => { this.slot.classList.add('is-set'); this.slot.classList.remove('is-hit'); }, 320);
    }
    current() { return this.seq[this.landed] || this.seq[0] || ''; }
  }

  let timers = [], rafs = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

  D2T.screen('unbeaten', {
    title: 'Unbeaten Run', theme: 'black',
    mount(root) {
      const reduced = D2T.reduced();
      const R = D2T.state.ub || (D2T.state.ub = { best: {}, runs: 0, last: null });
      const save = () => D2T.save();
      root.classList.add('ub');
      root.appendChild(D2T.topbar({ mode: ['Unbeaten Run', C] }));
      const H = root.clientHeight || 760, SW = H < 640 ? 118 : H < 720 ? 134 : 150, PITCH = Math.round(SW * 1.02 + 62);
      const wrap = D2T.h(`<div class="ub-wrap" style="--ub-sw:${SW}px;--ub-ph:${PITCH - 10}px">${D2T.shirts.defs()}
        <div class="ub-head"><div class="ub-h-l"><span class="ub-kick">Premier League</span><h1 class="ub-title">Spin for a stat</h1><span class="ub-sub">Premier League stats only, for now</span></div>
          <div class="ub-streak" aria-live="polite"><span class="ring"></span><b class="ub-n">0</b><i>unbeaten</i></div></div>
        <div class="ub-stage"></div>
        <div class="sp-hint ub-hint"></div>
        <div class="sp-bar ub-bar"></div></div>`);
      root.appendChild(wrap);
      const stage = wrap.querySelector('.ub-stage'), bar = wrap.querySelector('.ub-bar'), hint = wrap.querySelector('.ub-hint');
      const title = wrap.querySelector('.ub-title'), sub = wrap.querySelector('.ub-sub'), streakEl = wrap.querySelector('.ub-streak'), nEl = wrap.querySelector('.ub-n');
      let run = null, busy = false, reelL = null, reelR = null;

      // ---------- the bottom bar: Spin before a run, Lower and Higher during one ----------
      function spinBar() {
        bar.innerHTML = `<button class="sp-main ub-spin">${D2T.logo('emblem', { label: '' })}<span class="sp-lbl">Spin</span></button><button class="sp-round is-home" aria-label="Home">${D2T.ICON.home}</button>`;
        bar.querySelector('.is-home').onclick = () => D2T.go('home');
        bar.querySelector('.ub-spin').onclick = statSpin;
      }
      function answerBar() {
        bar.innerHTML = `<button class="ub-ans ub-lower" aria-label="Lower">${DOWN}<span>Lower</span></button><button class="ub-ans ub-higher" aria-label="Higher">${UP}<span>Higher</span></button><button class="sp-round is-home" aria-label="Home">${D2T.ICON.home}</button>`;
        bar.querySelector('.is-home').onclick = () => D2T.go('home');
        bar.querySelector('.ub-lower').onclick = () => answer(false);
        bar.querySelector('.ub-higher').onclick = () => answer(true);
      }
      const enable = (on) => bar.querySelectorAll('.ub-ans').forEach((b) => { b.disabled = !on; });

      // ---------- the stat spin: a reel of stats, never the same one twice in a row ----------
      function idle() {
        run = null; busy = false; nEl.textContent = '0'; title.textContent = 'Spin for a stat'; sub.textContent = 'Premier League stats only, for now';
        stage.innerHTML = `<div class="ub-statwin"><div class="ub-statstrip">${statTile(STATS.find((s) => s.id === R.last) || STATS[0], true)}</div></div>
          <div class="ub-bests">${STATS.map((s) => `<span class="ub-best"><i>${s.big}</i><b class="${R.best[s.id] ? '' : 'none'}">${R.best[s.id] || '-'}</b></span>`).join('')}</div>`;
        hint.textContent = 'Spin to see which stat this run is about';
        spinBar();
        later(() => D2T.tip('ub-spin', bar.querySelector('.ub-spin'), 'A new stat every run'), 700);
      }
      const statTile = (s, dim) => `<div class="ub-tile${dim ? ' dim' : ''}"><small>PREMIER LEAGUE</small><span>${s.big}</span></div>`;
      function statSpin() {
        if (busy) return;
        busy = true; snd('roll3');
        const target = STATS.filter((s) => s.id !== R.last)[rand(STATS.length - 1)];
        R.last = target.id; save();
        const other = (not) => { const o = STATS.filter((s) => !not.includes(s)); return o[rand(o.length)]; };
        const seq = [other([])];
        for (let i = 0; i < 22; i++) seq.push(other([seq[seq.length - 1], i === 21 ? target : null]));
        seq.push(target, other([target]));
        const strip = stage.querySelector('.ub-statstrip');
        strip.innerHTML = seq.map((s) => statTile(s)).join('');
        stage.querySelector('.ub-bests').classList.add('gone');
        bar.querySelector('.ub-spin').disabled = true;
        const end = -(seq.length - 3) * 76;
        const done = () => { snd('lockin'); stage.querySelector('.ub-statwin').classList.add('is-hit'); later(() => startRun(target), reduced ? 200 : 650); };
        if (reduced) { strip.style.transform = `translateY(${end}px)`; done(); return; }
        strip.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${end}px)` }], { duration: 1800, easing: 'cubic-bezier(.15,.8,.25,1)', fill: 'forwards' }).onfinish = done;
      }

      // ---------- a run ----------
      function pickNext() {
        const cur = run.stat.val(run.cur), pool = run.deck.filter((r) => !run.used.has(r) && run.stat.val(r) !== cur);
        if (!pool.length) return null;
        const k = run.streak + 1, pClose = k <= 10 ? 0.2 : k <= 20 ? 1 / 3 : 0.5;
        if (Math.random() < pClose) { const close = pool.filter((r) => Math.abs(run.stat.val(r) - cur) / cur <= 0.10); if (close.length) return close[rand(close.length)]; }
        return pool[rand(pool.length)];
      }
      function spinTo(reel, html, opts, done) {
        const P = D2T.roll.profile(opts), n = P.target;
        const seq = [reel.current() || `<div class="ub-ph">?</div>`];
        for (let i = 1; i < n + 4; i++) seq.push(i === n ? html : item(run.stat, run.deck[rand(run.deck.length)], false, SW));
        reel.load(seq);
        if (reduced) { reel.draw(n, 0); reel.settle(n); done && done(); return; }
        const t0 = performance.now(); let landed = false;
        const step = (now) => {
          const s = D2T.roll.sample(P, (now - t0) / 1000);
          reel.draw(s.p, s.v);
          if (!landed && (now - t0) / 1000 >= P.landAt) { landed = true; reel.hit(); reel.settle(n); done && done(); }
          if (s.phase !== 'done' && root.isConnected) rafs.push(requestAnimationFrame(step));
        };
        rafs.push(requestAnimationFrame(step));
      }
      function startRun(stat) {
        const deck = decks()[stat.deck].filter((r) => stat.val(r) > 0);
        run = { stat, deck, used: new Set(), streak: 0 };
        run.cur = deck[rand(deck.length)]; run.used.add(run.cur);
        run.next = pickNext(); run.used.add(run.next);
        title.textContent = stat.big; sub.textContent = "Premier League stats only, for now";
        stage.innerHTML = `<div class="ub-cols"><div class="ub-col"><div class="ub-slot ub-l"></div><div class="ub-who ub-who-l"></div></div>
          <div class="ub-col"><div class="ub-slot ub-r"></div><div class="ub-who ub-who-r"></div></div><span class="ub-vs">VS</span></div>`;
        const sl = stage.querySelector('.ub-l'), sr = stage.querySelector('.ub-r');
        reelL = new Reel(sl, PITCH); reelR = new Reel(sr, PITCH);
        reelL.show(`<div class="ub-ph">?</div>`); reelR.show(`<div class="ub-ph">?</div>`);
        answerBar(); enable(false); hint.textContent = '';
        bindSwipe(sr);
        snd('roll3');
        spinTo(reelL, item(stat, run.cur, true, SW), { delay: 0, cruiseT: 0.9, decelT: 1.0, n: 2.2 }, () => { stage.querySelector('.ub-who-l').innerHTML = whoLine(stat, run.cur); });
        spinTo(reelR, item(stat, run.next, false, SW), { delay: 0.12, cruiseT: 1.4, decelT: 1.4, n: 3.0, v1: 2.0 }, () => {
          stage.querySelector('.ub-who-r').innerHTML = whoLine(stat, run.next);
          busy = false; enable(true);
          hint.textContent = 'Swipe his shirt up for higher, down for lower, or tap below';
          later(() => tips(), 450);
        });
      }
      // first-time tips, one at a time, each once ever (D2T.tips)
      const tips = () => D2T.tips([
        ['ub-guess', stage.querySelector('.ub-r .sp-node.is-hit') || stage.querySelector('.ub-r'), 'Higher or lower?'],
        ['ub-swipe', stage.querySelector('.ub-r'), 'Swipe the shirt up or down', { place: 'below' }],
        ['ub-run', streakEl, 'One wrong and the run is over', { place: 'below', side: 'right' }]
      ]);
      const numEl = () => stage.querySelector('.ub-r .sp-node.is-hit .ub-num') || stage.querySelector('.ub-r .ub-num');
      function countUp(el, to, ms, done) {
        if (!el || reduced) { if (el) { el.textContent = to; el.classList.remove('q'); } done(); return; }
        el.classList.remove('q'); const t0 = performance.now();
        const step = (t) => { const p = Math.min(1, (t - t0) / ms); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) rafs.push(requestAnimationFrame(step)); else { el.classList.add('ub-pop'); done(); } };
        rafs.push(requestAnimationFrame(step));
      }
      function answer(higher) {
        if (!run || busy) return;
        busy = true; enable(false); snd('tap');
        const a = run.stat.val(run.cur), b = run.stat.val(run.next), right = higher ? b > a : b < a;
        countUp(numEl(), b, 520, () => {
          stage.querySelector('.ub-r').classList.add(right ? 'ok' : 'bad');
          if (right) win(); else { snd('buzzer'); later(over, reduced ? 200 : 950); }
        });
      }
      function win() {
        run.streak++; snd('lockin');
        const from = stage.querySelector('.ub-r').getBoundingClientRect(), to = nEl.getBoundingClientRect();
        const done = () => {
          nEl.textContent = run.streak;
          streakEl.classList.remove('burst'); void streakEl.offsetWidth; streakEl.classList.add('burst');
          later(advance, reduced ? 120 : 420);
        };
        if (reduced) { done(); return; }
        const fly = D2T.h('<div class="ub-fly">+1</div>');
        fly.style.left = from.left + from.width / 2 - 20 + 'px'; fly.style.top = from.top + 40 + 'px'; document.body.appendChild(fly);
        fly.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${to.left - from.left - from.width / 2 + 24}px,${to.top - from.top - 30}px) scale(.6)`, opacity: .2 }], { duration: 520, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => { fly.remove(); done(); };
      }
      function advance() {
        run.cur = run.next;
        const nxt = pickNext();
        if (!nxt) { over(true); return; }
        run.next = nxt; run.used.add(nxt);
        const sl = stage.querySelector('.ub-l'), sr = stage.querySelector('.ub-r');
        sr.classList.remove('ok');
        // the shirt you got right slides across to the left, then the right reel spins in the next one
        reelL.show(item(run.stat, run.cur, true, SW)); sl.classList.add('is-set');
        stage.querySelector('.ub-who-l').innerHTML = whoLine(run.stat, run.cur); stage.querySelector('.ub-who-r').innerHTML = '';
        if (!reduced) { const dx = sr.getBoundingClientRect().left - sl.getBoundingClientRect().left; sl.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.5,0,.2,1)' }); }
        reelR.show(`<div class="ub-ph">?</div>`); sr.classList.remove('is-set');
        snd('roll3');
        spinTo(reelR, item(run.stat, run.next, false, SW), { delay: 0.15, cruiseT: 0.55, decelT: 1.0, n: 2.6, v1: 2.2 }, () => {
          stage.querySelector('.ub-who-r').innerHTML = whoLine(run.stat, run.next);
          busy = false; enable(true); later(() => tips(), 300);
        });
      }
      function over(cleared) {
        if (!root.isConnected) return;
        const s = run.stat, n = run.streak, prev = R.best[s.id] || 0, newBest = n > prev && n > 0;
        R.runs++; if (newBest) R.best[s.id] = n; save();
        if (newBest) snd('champions');
        const a = run.cur, b = run.next, nm = (r) => r.name || D2T.game.club(r.club).full || r.club;
        const head = cleared ? 'The whole deck, unbeaten' : n === 0 ? 'Beaten first time' : `Unbeaten in ${n}`;
        const lead = cleared ? 'You got through every card in this deck.' : `<b>${D2T.esc(nm(b))}</b> had <b>${s.val(b)}</b>, <b>${D2T.esc(nm(a))}</b> had <b>${s.val(a)}</b>.`;
        const best = newBest ? ' A new best.' : prev ? ` Your best on ${s.big.toLowerCase()}: ${prev}.` : '';
        const text = `DROP2TOP Unbeaten Run\n${s.big} (Premier League): unbeaten in ${n}${newBest ? ', a new best' : ''}`;
        const sh = D2T.sheet({ title: head, body: `<p class="fr-lead">${lead}${best}</p>
          <div class="fr-stack"><button class="btn btn-ghost fr-btn-wide" data-k="share">Share with your mates</button><button class="btn ub-again fr-btn-wide" data-k="again">Spin again</button></div>`, onClose: () => { if (root.isConnected && run) idle(); } });
        sh.body.querySelector('[data-k="again"]').onclick = () => { sh.close(); idle(); later(statSpin, 250); };
        sh.body.querySelector('[data-k="share"]').onclick = async () => {
          try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
          try { await navigator.clipboard.writeText(text); sh.body.querySelector('.fr-lead').textContent = 'Copied. Paste it into the group chat.'; } catch (e) { /* nothing to copy to */ }
        };
      }
      // swipe the right shirt up for higher, down for lower
      function bindSwipe(el) {
        let y0 = null, id = null;
        el.onpointerdown = (e) => { if (!run || busy) return; y0 = e.clientY; id = e.pointerId; el.setPointerCapture(id); };
        el.onpointermove = (e) => { if (y0 == null || e.pointerId !== id) return; el.style.transform = `translateY(${clamp(e.clientY - y0, -70, 70) * 0.5}px)`; };
        el.onpointerup = el.onpointercancel = (e) => { if (y0 == null || e.pointerId !== id) return; const dy = e.clientY - y0; y0 = null; el.style.transform = ''; if (Math.abs(dy) > 50) answer(dy < 0); };
      }
      idle();
    },
    unmount() { timers.forEach(clearTimeout); rafs.forEach(cancelAnimationFrame); timers = []; rafs = []; document.querySelectorAll('.ub-fly').forEach((f) => f.remove()); }
  });

  // the home screen card (screens/home.js), in the same shape as the other games' cards
  D2T.ubRecord = () => { const R = D2T.state.ub || { best: {}, runs: 0 }; const top = Math.max(0, ...Object.values(R.best || {})); return { runs: R.runs || 0, top }; };
})();
