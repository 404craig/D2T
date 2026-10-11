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
    // sequence of html strings; target index is where it lands
    load(seq) { this.seq = seq; this.nodes.forEach((n) => { n.dataset.vi = ''; n.classList.remove('is-hit', 'is-gone'); }); this.draw(0, 0); }
    draw(p, v) {
      this.p = p;
      const c = Math.round(p);
      for (let k = -2; k <= 2; k++) {
        const vi = c + k, node = this.nodes[((vi % NODES) + NODES) % NODES];
        if (node.dataset.vi !== String(vi)) { node.dataset.vi = String(vi); node.innerHTML = this.seq[vi] || ''; }
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
    reset() { this.slot.classList.remove('is-set', 'is-hit', 'is-sel', 'is-other'); this.cap.textContent = ''; }
    get cardEl() { return this.slot.querySelector('.sp-node.is-hit .d2c') || this.slot.querySelector('.sp-node .d2c'); }
  }

  // ---------- the roll screen ----------
  // cfg: { kicker, title, sub, hint, pool: items, render(item) -> html, pick() -> [3 items], accent(item) -> {accent, ink},
  //        caption(item), details(item) -> html, mainLabel, selectedLabel(item), onConfirm(item), respins (number or null),
  //        onRespinsChange(n), pass: {label, onPass}, placeholder() -> html }
  function mount(root, cfg) {
    const reduced = D2T.reduced();
    const el = D2T.h(`<div class="sp-screen">
      <div class="sp-head"><span class="sp-kicker">${cfg.kicker || ''}</span><h1 class="sp-title">${cfg.title}</h1><p class="sp-sub">${cfg.sub || ''}</p></div>
      <div class="sp-stage"><div class="sp-floor"></div><div class="sp-row"><div class="sp-slot"></div><div class="sp-slot"></div><div class="sp-slot"></div></div></div>
      <div class="sp-hint"></div>
      <div class="sp-bar">
        <button class="sp-round is-reload" aria-label="Spin again">${D2T.logo('emblemLine', { label: '' })}<span class="sp-count"></span></button>
        <button class="sp-main">${D2T.logo('emblem', { label: '' })}<span class="sp-lbl">${cfg.mainLabel || 'Spin'}</span></button>
        <button class="sp-round is-home" aria-label="Home">${D2T.ICON.home}</button>
      </div></div>`);
    root.appendChild(el);
    const slots = Array.from(el.querySelectorAll('.sp-slot')), reels = slots.map((s) => new Reel(s));
    const main = el.querySelector('.sp-main'), lbl = main.querySelector('.sp-lbl'), reload = el.querySelector('.sp-round.is-reload');
    const count = reload.querySelector('.sp-count'), hintEl = el.querySelector('.sp-hint');
    el.querySelector('.sp-round.is-home').onclick = () => D2T.go('home');

    let state = 'idle', results = null, selected = -1, respins = cfg.respins == null ? null : cfg.respins, raf = 0, timers = [], tick = 0, open = null;
    const hint = (t) => { hintEl.textContent = t || ''; };
    const setMain = (text, item) => {
      lbl.textContent = text; main.classList.remove('is-swap'); void main.offsetWidth; main.classList.add('is-swap');
      const a = item && cfg.accent ? cfg.accent(item) : cfg.baseBtn;
      if (a) { el.style.setProperty('--sp-btn', a.accent); el.style.setProperty('--sp-btn-ink', a.ink); }
      else { el.style.removeProperty('--sp-btn'); el.style.removeProperty('--sp-btn-ink'); }
    };
    const setRespins = () => {
      if (respins == null) { reload.style.display = 'none'; return; }
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
      selected = i;
      slots.forEach((s, j) => { s.classList.toggle('is-sel', j === i); s.classList.toggle('is-other', j !== i); });
      setMain(cfg.selectedLabel(results[i]), results[i]);
      main.disabled = false;
      hint(cfg.hintSelected || 'Tap it again to take a closer look');
    };
    const openCard = (i) => {
      if (open) return;
      const item = results[i], card = reels[i].cardEl;
      if (!card) return;
      const a = cfg.accent ? cfg.accent(item) : { accent: '#fff' };
      const below = cfg.details ? `<div class="sp-det" style="--sp-accent:${a.accent}">${cfg.details(item)}</div>` : '';
      open = D2T.cards.openLarge(card, cfg.render(item, 280), { below, onClose: () => { open = null; } });
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
      const firsts = reels.map((r) => r.seq[r.seq.length > 1 ? r.seq.length - 4 : 0] || '');
      reels.forEach((r) => r.reset());
      // left lands first, middle shortly after, right last with a longer crawl at the end
      const profs = [
        profile({ delay: 0, cruiseT: 1.0, decelT: 1.1, n: 2.2 }),
        profile({ delay: 0.07, cruiseT: 1.35, decelT: 1.2, n: 2.4 }),
        profile({ delay: 0.14, cruiseT: 1.75, decelT: 1.5, n: 3.0, v1: 2.0 })
      ];
      reels.forEach((r, i) => r.load(sequence(firsts[i], results[i], profs[i])));
      if (reduced) {
        reels.forEach((r, i) => { r.draw(profs[i].target, 0); r.hit(cfg.accent(results[i]).accent); r.settle(profs[i].target, cfg.caption && cfg.caption(results[i])); });
        done(); return;
      }
      const t0 = performance.now(), landed = [false, false, false];
      let settledCalled = false;
      const step = (now) => {
        const t = (now - t0) / 1000;
        let allDone = true;
        reels.forEach((r, i) => {
          const P = profs[i], s = sample(P, t);
          r.draw(s.p, s.v);
          if (!landed[i] && t >= P.landAt) { landed[i] = true; r.hit(cfg.accent(results[i]).accent); r.settle(P.target, cfg.caption && cfg.caption(results[i])); }
          if (s.phase !== 'done') allDone = false;
        });
        // the moment the last reel lands the result is final: taps count while the bounce plays out
        if (!settledCalled && landed.every(Boolean)) { settledCalled = true; done(); }
        if (!allDone) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const done = () => {
      state = 'settled';
      main.classList.remove('is-spinning'); main.disabled = true; setMain(cfg.pickLabel || 'Pick one', null);
      setRespins(); hint(cfg.hintSettled || 'Tap a card to pick it');
      cfg.onSettled && cfg.onSettled(results);
    };

    main.onclick = () => {
      if (state === 'idle') { spin(); return; }
      if (state === 'settled' && selected >= 0) cfg.onConfirm(results[selected], { respins });
    };
    reload.onclick = () => {
      if (state === 'spinning' || respins == null || respins <= 0) return;
      respins -= 1; cfg.onRespinsChange && cfg.onRespinsChange(respins);
      spin();
    };
    if (cfg.pass) {
      const p = D2T.h(`<button class="sp-pass">${cfg.pass.label}</button>`);
      el.insertBefore(p, el.querySelector('.sp-bar')); p.onclick = cfg.pass.onPass;
    }
    setRespins(); main.disabled = false; setMain(cfg.mainLabel || 'Spin', null);
    hint(cfg.hintIdle || '');
    // A spin that already happened (back, or a refresh) shows where it landed instead of spinning again.
    if (cfg.settled && cfg.settled.length) {
      stopTick();
      results = cfg.settled;
      reels.forEach((r, i) => { r.load([cfg.render(results[i], 114)]); r.draw(0, 0); r.settle(0, cfg.caption && cfg.caption(results[i])); r.slot.classList.add('is-set'); });
      state = 'settled'; main.disabled = true; setMain(cfg.pickLabel || 'Pick one', null); setRespins(); hint(cfg.hintSettled || 'Tap a card to pick it');
    }

    return {
      el, reels, slots, spin,
      unmount() { cancelAnimationFrame(raf); stopTick(); timers.forEach(clearTimeout); if (open) { try { open.el.remove(); } catch (e) { /* gone */ } } }
    };
  }

  D2T.roll = { mount, Reel, profile, sample, PITCH };

  // ---------- route: spin (pick a club) ----------
  // The three clubs and the respins come from the engine (seeded per run), so a refresh never re-rolls them.
  let api = null;
  D2T.screen('spin', {
    title: 'Pick your club', theme: 'black',
    mount(root) {
      const GAME = D2T.game, SND = window.D2TSound || { play() {} };
      if (!D2T.state.run || !GAME.eng() || GAME.eng().phase !== 'clubroll') GAME.newRun();
      const st = D2T.state.run, eng = GAME.eng();
      root.appendChild(D2T.topbar());
      api = mount(root, {
        kicker: 'New run · Classic', title: 'Pick your club',
        sub: 'Three clubs that went down. Pick one and take it from the drop to the top.',
        pool: GAME.pool,
        render: (c, w) => D2T.cards.club(c, { w }),
        pick: () => { SND.play('roll3'); return GAME.offer(); },
        settled: st.spun ? GAME.offer() : null,
        onSettled: () => { st.spun = true; D2T.save(); },
        accent: (c) => ({ accent: c.accent, ink: c.ink }),
        caption: (c) => c.code,
        details: (c) => `<div class="sp-det-name">${D2T.esc(c.full)}</div><div class="sp-det-line">${c.season} · Real finish ${D2T.ordinal(c.pos)} · ${c.gf} scored, ${c.ga} conceded</div>
          <div class="sp-det-grid"><span class="sp-det-stat"><b>${c.w}</b><i>WON</i></span><span class="sp-det-stat"><b>${c.d}</b><i>DRAWN</i></span><span class="sp-det-stat"><b>${c.l}</b><i>LOST</i></span><span class="sp-det-stat"><b>${c.pts}</b><i>POINTS</i></span></div>`,
        mainLabel: 'Spin', pickLabel: 'Pick a club', spinningLabel: 'Spinning',
        selectedLabel: () => 'Play',
        hintIdle: 'Hit Spin to see who you get', hintSettled: 'Tap a club to pick it', hintSelected: 'Tap it again for the full card, or hit Play',
        respins: eng.respins,
        onRespinsChange: () => { GAME.respinClubs(); st.spun = false; D2T.save(); },
        onConfirm: (c) => { SND.play('lockin'); GAME.chooseClub(c.key); D2T.go('table'); }
      });
    },
    unmount() { api && api.unmount(); api = null; }
  });
})();
