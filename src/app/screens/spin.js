// Club spin (route 'spin') plus the shared roll engine used by the transfer roll (screens/transfer.js).
// D2T.roll.mount(root, cfg) builds the header, three reel slots and the action bar; D2T.roll.Reel drives one reel.
(function () {
  const D2T = window.D2T = window.D2T || {};
  const PITCH = 198;            // card height 190 + 8 gap, in px
  const NODES = 5;              // recycled card nodes per reel
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let fid = 0;

  // ---------- motion profile ----------
  // Velocity in cards per second. Three phases then a spring:
  //  accel  (0..accelT): v ramps 0 -> vmax, distance vmax*accelT/2
  //  cruise (accelT..accelT+cruiseT): v = vmax
  //  decel  (..+decelT): v = v1 + (vmax - v1) * (1-u)^n, lands exactly on the target still moving at v1
  //  spring: x = (v1/wd) e^(-z t) sin(wd t), a small overshoot past the mark and one soft bounce back
  function profile(o) {
    const P = { accelT: 0.3, vmax: 24, decelT: 1.1, n: 2.2, v1: 2.4, z: 5.2, w: 15, delay: 0, settleT: 0.75 };
    Object.assign(P, o);
    P.accelD = P.vmax * P.accelT / 2;
    P.decelD = P.decelT * (P.v1 + (P.vmax - P.v1) / (P.n + 1));
    const rough = P.accelD + P.vmax * P.cruiseT + P.decelD;
    P.target = Math.ceil(rough);
    P.cruiseT = (P.target - P.accelD - P.decelD) / P.vmax;   // adjust the cruise so the decel lands exactly on the target
    P.wd = Math.sqrt(P.w * P.w - P.z * P.z);
    P.total = P.delay + P.accelT + P.cruiseT + P.decelT + P.settleT;
    P.landAt = P.delay + P.accelT + P.cruiseT + P.decelT;
    return P;
  }
  // position (cards) and velocity (cards/s) at time t (seconds since the spin started)
  function sample(P, t) {
    t -= P.delay;
    if (t <= 0) return { p: 0, v: 0, phase: 'wait' };
    if (t < P.accelT) return { p: P.vmax * t * t / (2 * P.accelT), v: P.vmax * t / P.accelT, phase: 'accel' };
    t -= P.accelT;
    if (t < P.cruiseT) return { p: P.accelD + P.vmax * t, v: P.vmax, phase: 'cruise' };
    t -= P.cruiseT;
    if (t < P.decelT) {
      const u = t / P.decelT, k = Math.pow(1 - u, P.n);
      const d = P.decelT * (P.v1 * u + (P.vmax - P.v1) * (1 - Math.pow(1 - u, P.n + 1)) / (P.n + 1));
      return { p: P.accelD + P.vmax * P.cruiseT + d, v: P.v1 + (P.vmax - P.v1) * k, phase: 'decel' };
    }
    t -= P.decelT;
    const e = Math.exp(-P.z * t), x = (P.v1 / P.wd) * e * Math.sin(P.wd * t);
    const v = (P.v1 / P.wd) * e * (P.wd * Math.cos(P.wd * t) - P.z * Math.sin(P.wd * t));
    return { p: P.target + x, v, phase: t < P.settleT ? 'spring' : 'done' };
  }

  // ---------- one reel ----------
  class Reel {
    constructor(slot) {
      this.slot = slot;
      this.id = 'spmb' + (++fid);
      slot.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="${this.id}" x="-20%" y="-40%" width="140%" height="180%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 0"/></filter></svg>
        <div class="sp-glow"></div><div class="sp-win"><div class="sp-strip">${'<div class="sp-node"></div>'.repeat(NODES)}<div class="sp-streak"></div></div><div class="sp-sweep"></div></div><div class="sp-cap"></div>`;
      this.win = slot.querySelector('.sp-win'); this.strip = slot.querySelector('.sp-strip'); this.streak = slot.querySelector('.sp-streak');
      this.nodes = Array.from(slot.querySelectorAll('.sp-node')); this.gauss = slot.querySelector('feGaussianBlur'); this.cap = slot.querySelector('.sp-cap');
      this.nodes.forEach((n) => { n.dataset.vi = ''; });
      this.seq = []; this.p = 0; this.filtered = false;
    }
    // show one card html, still
    show(html, cap) { this.seq = [html]; this.draw(0, 0); this.cap.textContent = cap || ''; }
    // sequence of html strings; target index is where it lands (or this.gen(index) -> html, for a reel with no set end)
    load(seq) { this.seq = seq; this.nodes.forEach((n) => { n.dataset.vi = ''; n.classList.remove('is-hit', 'is-gone'); }); this.draw(0, 0); }
    draw(p, v) {
      this.p = p;
      const c = Math.round(p);
      for (let k = -2; k <= 2; k++) {
        const vi = c + k, node = this.nodes[((vi % NODES) + NODES) % NODES];
        if (node.dataset.vi !== String(vi)) { node.dataset.vi = String(vi); node.innerHTML = (this.gen ? this.gen(vi) : this.seq[vi]) || ''; }
        node.style.transform = `translate3d(0, ${((vi - p) * PITCH).toFixed(2)}px, 0)`;
      }
      // speed-dependent vertical blur, stretch and streak
      const pxf = Math.abs(v) * PITCH / 60;               // px per frame at 60fps
      const sd = clamp(pxf * 0.3 - 1.2, 0, 22);
      if (sd < 0.4) { if (this.filtered) { this.strip.style.filter = ''; this.gauss.setAttribute('stdDeviation', '0 0'); this.filtered = false; } }
      else { this.gauss.setAttribute('stdDeviation', `0 ${sd.toFixed(1)}`); if (!this.filtered) { this.strip.style.filter = `url(#${this.id})`; this.filtered = true; } }
      const k = clamp(pxf / 80, 0, 1);
      this.streak.style.opacity = (k * k * 0.9).toFixed(3);
      this.win.style.transform = k > 0.02 ? `scaleY(${(1 + 0.05 * k).toFixed(4)})` : '';
    }
    nodeAt(vi) { return this.nodes[((vi % NODES) + NODES) % NODES]; }
    // settle dressing: hit flash now, then fade the neighbours and drop the mask
    hit(accent) {
      this.slot.style.setProperty('--sp-accent', accent);
      this.slot.classList.remove('is-hit'); void this.slot.offsetWidth; this.slot.classList.add('is-hit');
    }
    settle(target, cap) {
      this.nodes.forEach((n) => { if (n.dataset.vi === String(target)) n.classList.add('is-hit'); else n.classList.add('is-gone'); });
      this.cap.textContent = cap || '';
      setTimeout(() => { this.slot.classList.add('is-set'); this.slot.classList.remove('is-hit'); }, 320);
    }
    reset() { this.slot.classList.remove('is-set', 'is-hit', 'is-sel', 'is-other', 'is-xset'); this.cap.textContent = ''; }
    get cardEl() { return this.slot.querySelector('.sp-node.is-hit .d2c') || this.slot.querySelector('.sp-node .d2c'); }
  }

  const REFRESH = D2T.ICON.respin;

  // ---------- the roll screen ----------
  // cfg: { kicker, title, sub, hint, pool: items, render(item) -> html, pick() -> [3 items], accent(item) -> {accent, ink},
  //        caption(item), details(item) -> html, mainLabel, selectedLabel(item), onConfirm(item), respins (number or null),
  //        onRespinsChange(n), pass: {label, onPass}, placeholder() -> html,
  //        rare(item) -> true for a card that gets the rare reveal (screens/reveal.js; the player rolls only),
  //        onCommit(items): a reveal is coming, so the roll counts as spun now (a refresh mid-reveal shows it settled),
  //        headTop / headBanner: optional html above the kicker and under the title, headCls / headStyle: a class and inline style on the header }
  function mount(root, cfg) {
    const reduced = D2T.reduced(), SND = window.D2TSound || { play() {}, tick() {}, tease() {} };
    const el = D2T.h(`<div class="sp-screen">
      <div class="sp-head${cfg.headCls ? ' ' + cfg.headCls : ''}"${cfg.headStyle ? ` style="${cfg.headStyle}"` : ''}>${cfg.headTop || ''}<span class="sp-kicker">${cfg.kicker || ''}</span><h1 class="sp-title">${cfg.title}</h1>${cfg.headBanner || ''}<p class="sp-sub">${cfg.sub || ''}</p></div>
      <div class="sp-stage"><div class="sp-floor"></div><div class="sp-row${cfg.count === 1 ? ' sp-one' : ''}">${'<div class="sp-slot"></div>'.repeat(cfg.count || 3)}</div></div>
      <div class="sp-hint"></div>
      <div class="sp-bar game-bar">
        <button class="sp-round is-home bar-home" aria-label="Home">${D2T.ICON.home}</button>
        <button class="sp-round is-reload bar-mid" aria-label="Spin again">${REFRESH}<span class="sp-count"></span></button>
        <button class="sp-main bar-main">${D2T.logo('emblem', { label: '' })}<span class="sp-lbl">${cfg.mainLabel || 'Spin'}</span></button>
      </div></div>`);
    root.appendChild(el);
    const slots = Array.from(el.querySelectorAll('.sp-slot')), reels = slots.map((s) => new Reel(s));
    const main = el.querySelector('.sp-main'), lbl = main.querySelector('.sp-lbl'), reload = el.querySelector('.sp-round.is-reload');
    const count = reload.querySelector('.sp-count'), hintEl = el.querySelector('.sp-hint');
    // the bar (Craig, 13 Oct): home on the left (the run menu, core/season.js), the respin with its count in the middle
    // (greyed where a roll has none, as in the draft, so the bar keeps its shape), the main button across the right
    el.querySelector('.sp-round.is-home').onclick = () => (D2T.runMenu ? D2T.runMenu() : D2T.go('home'));

    let state = 'idle', results = null, selected = -1, respins = cfg.respins == null ? null : cfg.respins, raf = 0, timers = [], tick = 0, open = null, rr = null;
    const hint = (t) => { hintEl.textContent = t || ''; };
    const setMain = (text, item) => {
      lbl.textContent = text; main.classList.remove('is-swap'); void main.offsetWidth; main.classList.add('is-swap');
      const a = item && cfg.accent ? cfg.accent(item) : cfg.baseBtn;
      if (a) { el.style.setProperty('--sp-btn', a.accent); el.style.setProperty('--sp-btn-ink', a.ink); }
      else { el.style.removeProperty('--sp-btn'); el.style.removeProperty('--sp-btn-ink'); }
    };
    const setRespins = () => {
      if (respins == null) { reload.disabled = true; reload.classList.add('is-off'); reload.setAttribute('aria-hidden', 'true'); reload.tabIndex = -1; count.style.display = 'none'; return; }
      count.textContent = respins; reload.disabled = respins <= 0 || state === 'spinning';
      reload.setAttribute('aria-label', `Spin again, ${respins} left`);
    };

    // placeholders with a quiet re-scramble
    const placeholders = () => reels.map((r, i) => {
      const html = cfg.placeholder ? cfg.placeholder(i) : D2T.cards.placeholder({ w: 114, variant: 'question', cls: 'sp-ph' });
      r.show(html); return html;
    });
    placeholders();
    const startTick = () => {
      stopTick();
      if (reduced) return;
      tick = setInterval(() => {
        reels.forEach((r) => {
          if (Math.random() < 0.55) return;
          const ph = r.slot.querySelector('.sp-ph'); if (!ph) return;
          ph.querySelectorAll('.d2c-scr').forEach((s) => { s.textContent = D2T.cards.scramble(+s.dataset.scr); });
          ph.classList.add('is-tick'); setTimeout(() => ph.classList.remove('is-tick'), 110);
        });
      }, 160);
    };
    const stopTick = () => { clearInterval(tick); tick = 0; };
    startTick();

    const clearSelection = () => { selected = -1; slots.forEach((s) => s.classList.remove('is-sel', 'is-other')); };
    const select = (i) => {
      if (state !== 'settled') return;
      if (selected === i) { openCard(i); return; }
      selected = i; SND.play('cardSelect', 0);
      slots.forEach((s, j) => { s.classList.toggle('is-sel', j === i); s.classList.toggle('is-other', j !== i); });
      if (!cfg.afterSettle) { setMain(cfg.selectedLabel(results[i]), results[i]); main.disabled = false; }
      hint(cfg.hintSelected || 'Tap it again to take a closer look');
      cfg.onSelect && cfg.onSelect(i, results[i]);
    };
    const openCard = (i) => {
      if (open) return;
      const item = results[i], card = reels[i].cardEl;
      if (!card) return;
      const a = cfg.accent ? cfg.accent(item) : { accent: '#fff' };
      // a player's details (detailsBare) bring their own panels, a smaller card and a column that scrolls
      const bare = !!cfg.detailsBare, W = bare ? Math.min(236, Math.round(root.clientWidth * 0.6)) : 280;
      const below = cfg.details ? (bare ? cfg.details(item) : `<div class="sp-det" style="--sp-accent:${a.accent}">${cfg.details(item)}</div>`) : '';
      open = D2T.cards.openLarge(card, (cfg.renderOpen || cfg.render)(item, W), { w: W, below, scroll: bare, onClose: () => { open = null; } });
    };
    slots.forEach((s, i) => { s.addEventListener('click', () => select(i)); s.setAttribute('role', 'button'); s.tabIndex = 0; });

    // build a reel sequence: [current card, filler..., target, filler x3]
    const sequence = (first, target, P) => {
      const n = P.target, filler = [];
      const same = (x) => x.name === target.name && x.season === target.season;
      let bag = shuffle(cfg.pool.filter((x) => !same(x)));
      while (filler.length < n + 3) { if (!bag.length) bag = shuffle(cfg.pool.filter((x) => !same(x))); filler.push(bag.pop()); }
      const seq = [first];
      for (let i = 1; i < n; i++) seq.push(cfg.render(filler[i], 114));
      seq.push(cfg.render(target, 114));
      for (let i = 0; i < 3; i++) seq.push(cfg.render(filler[n + i], 114));
      return seq;
    };

    const spin = () => {
      if (state === 'spinning') return;
      stopTick();
      results = cfg.pick();
      clearSelection();
      state = 'spinning';
      main.disabled = true; main.classList.add('is-spinning'); setMain(cfg.spinningLabel || 'Spinning', null);
      setRespins(); hint('');
      const firsts = reels.map((r) => r.landedHtml || r.seq[r.seq.length > 1 ? r.seq.length - 4 : 0] || '');
      reels.forEach((r) => { r.reset(); r.gen = null; r.landedHtml = null; });
      el.classList.add('is-rolling');
      // left lands first, middle shortly after, right last with a longer crawl at the end (a single reel takes that one)
      const opts = reels.length === 1 ? [{ delay: 0, cruiseT: 1.6, decelT: 1.6, n: 3.0, v1: 2.0 }] : [
        { delay: 0, cruiseT: 1.0, decelT: 1.1, n: 2.2 },
        { delay: 0.07, cruiseT: 1.35, decelT: 1.2, n: 2.4 },
        { delay: 0.14, cruiseT: 1.75, decelT: 1.5, n: 3.0, v1: 2.0 }
      ], profs = opts.map(profile);
      reels.forEach((r, i) => r.load(sequence(firsts[i], results[i], profs[i])));
      // a purple or legend card gets its reveal (not with reduced motion): its reel never lands on its own
      const rare = !reduced && cfg.rare && D2T.rareReveal ? results.map((x) => !!cfg.rare(x)) : [];
      if (rare.some(Boolean)) { cfg.onCommit && cfg.onCommit(results); spinRare(opts, profs, firsts, rare); return; }
      if (reduced) {
        reels.forEach((r, i) => { r.draw(profs[i].target, 0); r.hit(cfg.accent(results[i]).accent); r.settle(profs[i].target, cfg.caption && cfg.caption(results[i])); });
        done(); return;
      }
      // a Baller or Legend gets a soft build-up that ends as its reel stops (cfg.bigIndex)
      if (cfg.bigIndex) { const bi = cfg.bigIndex(results); if (bi >= 0 && profs[bi]) SND.tease(profs[bi].landAt); }
      const t0 = performance.now(), landed = reels.map(() => false), lastK = reels.map(() => 0);
      let settledCalled = false;
      const step = (now) => {
        const t = (now - t0) / 1000;
        let allDone = true;
        reels.forEach((r, i) => {
          const P = profs[i], s = sample(P, t);
          r.draw(s.p, s.v);
          const k = Math.floor(s.p); if (k > lastK[i] && !landed[i]) SND.tick(i, s.v); lastK[i] = k;   // a muffled tap per card passing
          if (!landed[i] && t >= P.landAt) { landed[i] = true; r.hit(cfg.accent(results[i]).accent); r.settle(P.target, cfg.caption && cfg.caption(results[i])); if (cfg.landSound) cfg.landSound(i, results[i]); else SND.play('reelLand', i); }
          if (s.phase !== 'done') allDone = false;
        });
        // the moment the last reel lands the result is final: taps count while the bounce plays out
        if (!settledCalled && landed.every(Boolean)) { settledCalled = true; done(); }
        if (!allDone) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    // ---------- a roll with a rare card (Craig, 13 Oct; design/prototype/rare-reveal-v3.html) ----------
    // Reels before the first rare one land as usual. From the rare one on they cruise with no set end (reel.gen draws
    // their cards). When a rare reel's turn comes (straight away in slot 1, or as the reel before it lands) it slows to
    // about 5 cards a second over 1.1 s and its reveal plays over the screen while the later reels keep cruising; the card
    // drops into its slot at the end of the reveal, then the reels after it land in turn.
    function spinRare(opts, profs, firsts, rare) {
      const n = reels.length, first = rare.indexOf(true), t0 = performance.now();
      const S = reels.map((r, i) => ({ mode: i < first ? 'prof' : 'run', P: profs[i], p: 0, v: 0, still: false }));
      for (let i = first; i < n; i++) {
        const s = S[i], item = results[i], same = (x) => x.name === item.name && x.season === item.season, bag = shuffle(cfg.pool.filter((x) => !same(x)));
        s.Pc = profile(Object.assign({}, opts[i], { cruiseT: 600 }));    // the same start, then a cruise that never ends
        s.T = null; s.html = cfg.render(item, 114);
        reels[i].gen = (vi) => (vi === 0 ? firsts[i] : vi === s.T ? s.html : bag.length ? cfg.render(bag[((vi % bag.length) + bag.length) % bag.length], 114) : '');
        reels[i].load([]);
      }
      const landed = reels.map(() => false), lastK = reels.map(() => 0);
      let settledCalled = false;
      const land = (i) => {
        landed[i] = true; const r = reels[i];
        r.hit(cfg.accent(results[i]).accent); r.settle(S[i].T == null ? S[i].P.target : S[i].T, cfg.caption && cfg.caption(results[i]));
        if (S[i].html) r.landedHtml = S[i].html;
      };
      // the non-rare reels from j on (up to the next rare one) land in turn, each a little after the one before
      const landRun = (j, t, prevLand) => {
        for (; j < n && !rare[j]; j++) {
          const s = S[j], P = s.P, q = sample(s.Pc, t);
          const tsd0 = Math.max(t, prevLand + 0.3 - P.decelT), pd = q.p + P.vmax * (tsd0 - t);
          s.T = Math.ceil(pd + P.decelD); s.tr = t; s.pr = q.p;
          s.tsd = t + (s.T - P.decelD - q.p) / P.vmax; s.landT = s.tsd + P.decelT; s.mode = 'land';
          prevLand = s.landT;
        }
      };
      // after the reel before it: a rare reel slows, a run of others lands
      const next = (j, t) => { if (j >= n || S[j].mode !== 'run') return; if (rare[j]) slowDown(j, t); else landRun(j, t, t); };
      const slowDown = (i, t) => { const s = S[i], q = sample(s.Pc, t); s.mode = 'slow'; s.tr = t; s.pr = q.p; s.vFrom = q.v || s.P.vmax; s.dur = 1.1; s.vTo = 5; s.shown = false; };
      const reveal = (i) => {
        rr = D2T.rareReveal.play({ host: document.getElementById('app') || root, slot: reels[i].slot, card: results[i], land: () => {
          const s = S[i], r = reels[i];
          s.mode = 'held'; s.T = Math.round(s.p); s.still = true;
          r.nodes.forEach((nd) => { nd.dataset.vi = ''; nd.classList.remove('is-hit', 'is-gone'); }); r.draw(s.T, 0);
          land(i);
        } });
        rr.done.then(() => { rr = null; timers.push(setTimeout(() => { if (raf) next(i + 1, (performance.now() - t0) / 1000); }, 350)); });
      };
      const step = (now) => {
        const t = (now - t0) / 1000;
        reels.forEach((r, i) => {
          const s = S[i];
          if (s.mode === 'held') return;
          let p, v;
          if (s.mode === 'prof') {
            const q = sample(s.P, t); p = q.p; v = q.v; if (q.phase === 'done') s.still = true;
            if (!landed[i] && t >= s.P.landAt) { land(i); if (cfg.landSound) cfg.landSound(i, results[i]); else SND.play('reelLand', i); next(i + 1, t); }
          } else if (s.mode === 'run') {
            const q = sample(s.Pc, t); p = q.p; v = q.v;
            if (i === 0 && rare[0] && t >= s.P.landAt - s.P.decelT) slowDown(0, t);
          } else if (s.mode === 'slow') {
            const tau = t - s.tr, u = Math.min(1, tau / s.dur), dv = s.vTo - s.vFrom;
            p = s.pr + s.vFrom * Math.min(tau, s.dur) + dv * s.dur * (u - (1 - Math.pow(1 - u, 3)) / 3) + (tau > s.dur ? s.vTo * (tau - s.dur) : 0);
            v = s.vFrom + dv * (1 - Math.pow(1 - u, 2));
            if (u >= 1 && !s.shown) { s.shown = true; reveal(i); }
          } else if (s.mode === 'land') {
            const P = s.P;
            if (t < s.tsd) { p = s.pr + P.vmax * (t - s.tr); v = P.vmax; }
            else if (t < s.landT) {
              const u = (t - s.tsd) / P.decelT;
              p = s.T - P.decelD + P.decelT * (P.v1 * u + (P.vmax - P.v1) * (1 - Math.pow(1 - u, P.n + 1)) / (P.n + 1));
              v = P.v1 + (P.vmax - P.v1) * Math.pow(1 - u, P.n);
            } else {
              const tt = t - s.landT, e = Math.exp(-P.z * tt);
              p = s.T + (P.v1 / P.wd) * e * Math.sin(P.wd * tt); v = 0;
              if (!landed[i]) { land(i); if (cfg.landSound) cfg.landSound(i, results[i]); else SND.play('reelLand', i); next(i + 1, t); }
              if (tt >= P.settleT) { p = s.T; s.still = true; }
            }
          }
          s.p = p; s.v = v;
          r.draw(p, v);
          const k = Math.floor(p); if (k > lastK[i] && !landed[i] && !rr) SND.tick(i, v); lastK[i] = k;   // quiet under a reveal
        });
        if (!settledCalled && landed.every(Boolean)) { settledCalled = true; done(); }
        if (!(landed.every(Boolean) && S.every((s) => s.still))) raf = requestAnimationFrame(step); else raf = 0;
      };
      raf = requestAnimationFrame(step);
    }
    const done = () => {
      el.classList.remove('is-rolling');
      state = 'settled';
      main.classList.remove('is-spinning'); main.disabled = true; setMain(cfg.pickLabel || 'Pick one', null);
      setRespins(); hint(cfg.hintSettled || 'Tap a card to pick it');
      afterSettle();
      cfg.onSettled && cfg.onSettled(results);
      // cfg.afterLand(reel, item) -> Promise: a single reel's own reveal (Club X's crest bursts into its badge); the
      // card is picked for you when it ends, and respins wait for it
      if (cfg.afterLand) {
        const lock = (on) => { landing = on; setRespins(); if (on) reload.disabled = true; };
        lock(true);
        Promise.resolve(cfg.afterLand(reels[0], results[0])).then(() => { lock(false); if (state === 'settled') select(0); });
      }
    };
    let landing = false;

    // cfg.afterSettle { label, onClick }: once the cards land the main button does something else (the transfer roll
    // makes it Pass, as signing is a drag onto the pitch), whatever is selected.
    function afterSettle() {
      if (!cfg.afterSettle) return;
      main.classList.add('is-after'); setMain(cfg.afterSettle.label, null); main.disabled = false;
    }
    main.onclick = () => {
      if (state === 'idle') { if (cfg.gate && !cfg.gate()) return; dropTip(); spin(); return; }
      if (state === 'settled' && cfg.afterSettle) { cfg.afterSettle.onClick(); return; }
      if (state === 'settled' && selected >= 0) cfg.onConfirm(results[selected], { respins });
    };
    let respinning = false;
    reload.onclick = async () => {
      if (state === 'spinning' || landing || respinning || respins == null || respins <= 0) return;
      dropTip();
      respins -= 1; SND.play('respin'); cfg.onRespinsChange && cfg.onRespinsChange(respins);
      main.classList.remove('is-after');
      respinning = true;
      try { if (cfg.beforeSpin) await cfg.beforeSpin(); } finally { respinning = false; }
      spin();
    };
    if (cfg.pass) {
      const p = D2T.h(`<button class="sp-pass">${cfg.pass.label}</button>`);
      el.insertBefore(p, el.querySelector('.sp-bar')); p.onclick = cfg.pass.onPass;
    }
    // cfg.tip { text, onDone }: a handwritten note with a curved arrow pointing at the respin button (as Tenaball's
    // "stats" note). It goes after the first spin or respin and onDone records that for the run.
    let tipEl = null;
    if (cfg.tip && respins != null) {
      tipEl = D2T.h(`<div class="sp-tip" aria-hidden="true"><svg viewBox="0 0 44 60"><path d="M40 8 C20 6 8 22 14 52" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M6 43 L14 54 L22 45" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${cfg.tip.text}</span></div>`);
      el.querySelector('.sp-bar').appendChild(tipEl);
    }
    const dropTip = () => { if (!tipEl) return; tipEl.classList.add('gone'); const t = tipEl; tipEl = null; setTimeout(() => t.remove(), 450); cfg.tip.onDone && cfg.tip.onDone(); };
    setRespins(); main.disabled = false; setMain(cfg.mainLabel || 'Spin', null);
    hint(cfg.hintIdle || '');
    // A spin that already happened (back, or a refresh) shows where it landed instead of spinning again.
    if (cfg.settled && cfg.settled.length) {
      stopTick();
      results = cfg.settled;
      reels.forEach((r, i) => { r.load([(cfg.renderSettled || cfg.render)(results[i], 114)]); r.draw(0, 0); r.settle(0, cfg.caption && cfg.caption(results[i])); r.slot.classList.add('is-set'); if (cfg.accent) r.slot.style.setProperty('--sp-accent', cfg.accent(results[i]).accent); });
      state = 'settled'; main.disabled = true; setMain(cfg.pickLabel || 'Pick one', null); setRespins(); hint(cfg.hintSettled || 'Tap a card to pick it');
      afterSettle();
      if (cfg.afterLand) select(0);
    }

    return {
      el, reels, slots, spin, select, openCard, hint, setLabel: (t) => setMain(t, null),
      results: () => results, selected: () => selected, settled: () => state === 'settled', clear: clearSelection,
      unmount() { cancelAnimationFrame(raf); raf = 0; if (rr) { rr.kill(); rr = null; } stopTick(); timers.forEach(clearTimeout); if (open) { try { open.el.remove(); } catch (e) { /* gone */ } } }
    };
  }

  D2T.roll = { mount, Reel, profile, sample, PITCH };

  // ---------- route: spin (pick a club) ----------
  // The clubs and the respins come from the engine (seeded per run), so a refresh never re-rolls them.
  // Club X (Craig, 12 Oct): you name your club first, then one central reel spins a season; it lands on that season's
  // bottom club, holds for a second, then its crest bursts and the Club X badge takes its place with your name.
  let api = null, xTimers = [];
  D2T.screen('spin', {
    title: 'Pick your club', theme: 'black',
    mount(root) {
      const GAME = D2T.game, SND = window.D2TSound || { play() {} }, reduced = D2T.reduced();
      if (!D2T.state.run || !GAME.eng() || GAME.eng().phase !== 'clubroll') GAME.newRun();
      const st = D2T.state.run, eng = GAME.eng(), dream = GAME.mode() === 'dare2dream', x = GAME.mode() === 'clubx';
      root.appendChild(D2T.topbar());
      const goal = (c) => (c.pos === 1 ? 'Win the league again' : `Finish ${D2T.ordinal(GAME.target(c.pos))} or better`);
      const later = (fn, ms) => { xTimers.push(setTimeout(fn, ms)); };
      // your club in that season: the Club X badge, green, your name, and who you replace at the foot
      const xCard = (c, w) => D2T.cards.club(Object.assign({}, GAME.club('Club X'), { season: c.season }), { w, footLabel: 'REPLACING', foot: D2T.esc(c.name) });
      const xSub = () => `${st.xName ? D2T.esc(GAME.tidyXName(st.xName)) : 'Your club'} takes the bottom club's place in one real season, drafts an XI from scratch and has to win the league.`;
      api = mount(root, {
        kicker: `New run · ${GAME.modeName()}`, title: x ? 'Spin your season' : 'Pick your club',
        sub: x ? xSub() : dream ? 'Three clubs from any season. You start with no players and draft your XI. Finish higher than they really did, or win the league again if they won it.' : 'Three clubs that went down. Pick one and take it from the drop to the top.',
        count: x ? 1 : 3,
        pool: GAME.spinPool(),
        render: (c, w) => D2T.cards.club(c, { w, footLabel: x ? 'YOU REPLACE' : dream ? 'TO BEAT' : undefined }),
        renderSettled: x ? xCard : null, renderOpen: x ? xCard : null,
        pick: () => { SND.play('roll3'); return GAME.offer(); },
        settled: st.spun ? GAME.offer() : null,
        onSettled: () => { st.spun = true; D2T.save(); },
        accent: (c) => (x && st.xShown ? { accent: '#12F06C', ink: '#000000' } : { accent: c.accent, ink: c.ink }),
        caption: (c) => (x ? 'TITLE ' + c.championPts + ' PTS' : c.code),
        details: (c) => x ? `<div class="sp-det-name">${c.season}: ${D2T.esc(GAME.xName())} replaces ${D2T.esc(c.full)}</div><div class="sp-det-line">${D2T.esc(c.name)} finished bottom (${D2T.ordinal(c.pos)}, ${c.pts} pts). ${D2T.esc(c.champion)} won the league on ${c.championPts} points.</div>
          <div class="sp-det-badges"><span>Target: win the league</span></div>` : `<div class="sp-det-name">${D2T.esc(c.full)}</div><div class="sp-det-line">${c.season} · Real finish ${D2T.ordinal(c.pos)} · ${c.gf} scored, ${c.ga} conceded</div>
          <div class="sp-det-grid"><span class="sp-det-stat"><b>${c.w}</b><i>WON</i></span><span class="sp-det-stat"><b>${c.d}</b><i>DRAWN</i></span><span class="sp-det-stat"><b>${c.l}</b><i>LOST</i></span><span class="sp-det-stat"><b>${c.pts}</b><i>POINTS</i></span></div>${dream ? `<div class="sp-det-badges"><span>Target: ${goal(c)}</span></div>` : ''}`,
        mainLabel: x && !st.xName ? 'Name your club' : 'Spin', pickLabel: x ? 'Play' : 'Pick a club', spinningLabel: 'Spinning',
        selectedLabel: () => 'Play',
        hintIdle: x ? 'Hit Spin for your season' : 'Hit Spin to see who you get', hintSettled: x ? 'Your season' : 'Tap a club to pick it', hintSelected: x ? 'Tap it for the full card, or hit Play' : 'Tap it again for the full card, or hit Play',
        respins: eng.respins,
        tip: st.tipDone || st.spun ? null : { text: `${eng.respins} respins, use them wisely!`, onDone: () => { st.tipDone = true; D2T.save(); } },
        onRespinsChange: () => { GAME.respinClubs(); st.spun = false; st.xShown = false; D2T.save(); },
        gate: x ? () => { if (st.xName) return true; askName(); return false; } : null,
        afterLand: x ? (reel, c) => reveal(reel, c) : null,
        onConfirm: (c) => { SND.play('lockin'); GAME.chooseClub(c.key); D2T.go('table'); }
      });

      // ---------- Club X: name your club ----------
      function askName() {
        const cur = GAME.tidyXName(st.xName || D2T.state.xName || '');
        const sh = D2T.sheet({ title: 'Name your club', body: `<p class="fr-lead">Your club takes the place of the bottom side in a real season. What's it called?</p>
          <form class="x-name" novalidate><input class="x-name-in" type="text" maxlength="18" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" placeholder="e.g. Southside FC" aria-label="Club name" value="${D2T.esc(cur)}">
          <p class="x-name-err" role="alert"></p><button class="btn x-name-go fr-btn-wide" type="submit">That's us</button></form>` });
        const form = sh.body.querySelector('form'), input = form.querySelector('input'), err = form.querySelector('.x-name-err');
        input.oninput = () => { err.textContent = ''; };
        form.onsubmit = (e) => {
          e.preventDefault();
          const r = GAME.setXName(input.value);
          if (r.error) { err.textContent = r.error; input.focus(); return; }
          input.blur(); sh.close(); SND.play('pick');
          api.setLabel('Spin'); const sub = api.el.querySelector('.sp-sub'); if (sub) sub.innerHTML = xSub();
        };
        later(() => { if (input.isConnected) input.focus(); }, 380);
      }
      if (x && !st.xName) later(askName, 450);
      if (x && st.xShown && api.reels[0]) api.reels[0].slot.classList.add('is-xset');   // back or a refresh: the end state as it was

      // ---------- Club X: your card swings in and knocks the real club off (Craig, 12 Oct) ----------
      // The real club lands and holds for 2 seconds; then your Club X card swings in from the right, hits the old card
      // and knocks it spinning off the left, with a burst of both cards' colours where they meet, and comes to rest in
      // the middle. Both cards fly as copies over the reel (its window would clip them); the reel takes the new card after.
      // The ending (Craig, 13 Oct): the reel takes the new card only once it is still and the slot has grown to its
      // picked size, with no settle flash, the shine carried on from the flying copy, the same shadow as in flight and
      // the reel window opened out (`is-xset`) so nothing cuts the glow off; the glow behind turns green under the clash.
      function reveal(reel, c) {
        return new Promise((resolve) => {
          const swap = (shineAt) => {
            const card = reel.cardEl, node = card && card.closest('.sp-node');
            if (!node) return null;
            const html = xCard(c, 114); reel.seq[+node.dataset.vi] = html; node.innerHTML = html;
            const shine = node.querySelector('.d2t-shine'); if (shine && shineAt) shine.style.animationDelay = `-${Math.round(shineAt)}ms`;
            reel.slot.classList.add('is-xset'); reel.slot.style.setProperty('--sp-accent', '#12F06C');
            st.xShown = true; D2T.save();
            return node;
          };
          if (reduced) { swap(); reel.hit('#12F06C'); resolve(); return; }
          later(() => {
            if (!root.isConnected) { resolve(); return; }
            const card = reel.cardEl, node = card && card.closest('.sp-node');
            if (!node) { swap(); resolve(); return; }
            const slot = reel.slot, sr = slot.getBoundingClientRect(), k = sr.width / (slot.offsetWidth || sr.width), W = slot.offsetWidth, H = slot.offsetHeight;
            const offR = (window.innerWidth - sr.left) / k + 30, offL = -(sr.right / k) - 60;
            const oldC = D2T.h(`<div class="x-fly">${node.innerHTML}</div>`), newC = D2T.h(`<div class="x-fly x-new">${xCard(c, 114)}</div>`);
            slot.append(oldC, newC); node.style.visibility = 'hidden';
            const HIT = 300, T = 700;
            newC.animate([
              { transform: `translateX(${offR}px) rotate(14deg)`, easing: 'cubic-bezier(.55,0,1,.65)' },
              { transform: `translateX(${W * 0.92}px) rotate(4deg)`, offset: HIT / T, easing: 'cubic-bezier(.12,.8,.3,1)' },
              { transform: 'translateX(-12px) rotate(-3deg)', offset: 0.8 },
              { transform: 'translateX(0) rotate(0)' }], { duration: T, fill: 'forwards' });
            oldC.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${offL * 0.45}px, -26px) rotate(-22deg)`, opacity: 1, offset: 0.4 }, { transform: `translate(${offL}px, 70px) rotate(-48deg)`, opacity: 1 }],
              { duration: 560, delay: HIT, easing: 'cubic-bezier(.2,.75,.35,1)', fill: 'forwards' });
            later(() => {
              clash(slot, W * 0.96, H * 0.42, [c.accent, '#12F06C', c.accent, '#FFFFFF', '#12F06C', c.ink && c.ink !== c.accent ? c.ink : c.accent]);
              SND.play('explode');                                  // Craig, 14 Oct: a boom as your badge smashes theirs, then a rumble
              slot.style.setProperty('--sp-accent', '#12F06C');   // the glow behind goes green under the burst
              const stage = api && api.el.querySelector('.sp-stage');
              if (stage) stage.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-7px,3px)' }, { transform: 'translate(6px,-2px)' }, { transform: 'translate(-3px,1px)' }, { transform: 'translate(0,0)' }], { duration: 300, easing: 'ease-out' });
            }, HIT);
            // the slot grows to its picked size as the card settles, so nothing moves again once it has come to rest
            later(() => slot.classList.add('is-sel'), T - 150);
            later(() => SND.play('cardDrop'), T + 20);
            later(() => oldC.remove(), T + 320);
            // once everything is still the reel takes the card: the same card, shadow and shine, so nothing shows
            later(() => {
              const shine = newC.querySelector('.d2t-shine'), anim = shine && shine.getAnimations()[0];
              node.style.visibility = ''; swap(anim ? anim.currentTime : 0); newC.remove();
              later(resolve, 150);
            }, T + 300);
          }, 2000);
        });
      }
      // the clash: sparks in both clubs' colours, a ring and a flash from where the cards meet
      function clash(host, x, y, cols) {
        const wrap = D2T.h('<div class="x-boom" aria-hidden="true"></div>'); host.appendChild(wrap);
        const ring = D2T.h('<span class="x-boom-ring"></span>'), flash = D2T.h('<span class="x-boom-flash"></span>');
        [ring, flash].forEach((e) => { e.style.left = x + 'px'; e.style.top = y + 'px'; wrap.appendChild(e); });
        flash.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.8)', opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'forwards' });
        ring.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(5)', opacity: 0 }], { duration: 620, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' });
        for (let i = 0; i < 44; i++) {
          // most fly out sideways and up, as if knocked off the impact; some go everywhere
          const a = i % 3 === 0 ? Math.random() * Math.PI * 2 : (i % 2 ? Math.PI : 0) + (Math.random() - 0.5) * 1.6, d = 50 + Math.random() * 110, sz = 4 + Math.random() * 8;
          const bit = D2T.h('<i></i>'); Object.assign(bit.style, { left: x + 'px', top: y + 'px', width: sz + 'px', height: (sz * (0.4 + Math.random())) + 'px', background: cols[i % cols.length] });
          wrap.appendChild(bit);
          bit.animate([{ transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d * 0.7}px), calc(-50% + ${Math.sin(a) * d * 0.7 - 10}px)) rotate(${(Math.random() - 0.5) * 300}deg)`, opacity: 1, offset: 0.55 },
            { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 34}px)) rotate(${(Math.random() - 0.5) * 600}deg)`, opacity: 0 }], { duration: 750 + Math.random() * 350, easing: 'cubic-bezier(.12,.8,.3,1)', fill: 'forwards' });
        }
        later(() => wrap.remove(), 1300);
      }
    },
    unmount() { xTimers.forEach(clearTimeout); xTimers = []; api && api.unmount(); api = null; }
  });
})();
