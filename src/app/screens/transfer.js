// Transfer roll (route 'transfer'): the D2T emblem spins and bursts into particles, then three player reels.
(function () {
  const D2T = window.D2T = window.D2T || {};
  const surname = (n) => n.split(' ').slice(-1)[0];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- intro: emblem turns 360, then bursts outward ----------
  function intro(root, onDone) {
    const host = D2T.h(`<div class="sp-intro" aria-hidden="true"><div class="sp-ring"></div><div class="sp-emblem">${D2T.logo('emblem', { label: '' })}</div><canvas></canvas></div>`);
    root.appendChild(host);
    const em = host.querySelector('.sp-emblem'), ring = host.querySelector('.sp-ring'), cv = host.querySelector('canvas');
    let finished = false, revealed = false, raf = 0, timer = 0;
    const end = (go) => { if (finished) return; finished = true; cancelAnimationFrame(raf); clearTimeout(timer); host.remove(); if (go && !revealed) { revealed = true; onDone(); } };
    const finish = () => end(true);
    host.addEventListener('click', finish);
    if (D2T.reduced()) { timer = setTimeout(finish, 350); return { cancel: () => end(false) }; }

    const W = host.clientWidth, H = host.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const SIZE = 128, cx = W / 2, cy = H / 2;

    // phase 1: one full turn (0 .. 700ms); phase 2: a 150ms charge (it swells and brightens); phase 3: the burst (720ms)
    const T1 = 640, TC = 150, T2 = 720;
    const t0 = performance.now();
    let particles = null;
    const img = new Image(); img.src = D2T.ASSET.emblem;
    const buildParticles = () => {
      // sample the emblem's alpha into a grid of particles that fly outward
      try {
        const off = document.createElement('canvas'); off.width = SIZE; off.height = SIZE;
        const oc = off.getContext('2d'); oc.drawImage(img, 0, 0, SIZE, SIZE);
        const d = oc.getImageData(0, 0, SIZE, SIZE).data, step = 4, out = [];
        for (let y = 0; y < SIZE; y += step) for (let x = 0; x < SIZE; x += step) {
          const a = d[(y * SIZE + x) * 4 + 3]; if (a < 90) continue;
          const dx = x - SIZE / 2, dy = y - SIZE / 2, r = Math.hypot(dx, dy) || 1;
          const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
          const sp = 260 + Math.random() * 520 + r * 2.6;
          out.push({ x: cx + dx, y: cy + dy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, s: step * (0.8 + Math.random() * 0.8), life: 0.5 + Math.random() * 0.5, spin: (Math.random() - 0.5) * 12 });
        }
        return out;
      } catch (e) { return null; }
    };
    const step = (now) => {
      const t = now - t0;
      if (t < T1) {
        const q = Math.min(1, t / T1), k = q < 0.3 ? Math.pow(q / 0.3, 2) * 0.16 : 0.16 + 0.84 * (1 - Math.pow(1 - (q - 0.3) / 0.7, 1.7));
        em.style.transform = `rotate(${(k * 360).toFixed(1)}deg) scale(${(0.86 + 0.26 * Math.sin(k * Math.PI)).toFixed(3)})`;
        em.style.filter = k > 0.2 && k < 0.8 ? `blur(${(Math.sin(k * Math.PI) * 1.4).toFixed(2)}px)` : '';
        raf = requestAnimationFrame(step); return;
      }
      if (t < T1 + TC) {
        const c = (t - T1) / TC;
        em.style.transform = `scale(${(0.86 + 0.34 * c * c).toFixed(3)})`;
        em.style.filter = `brightness(${(1 + 0.8 * c).toFixed(2)}) blur(${(c * 0.8).toFixed(2)}px)`;
        raf = requestAnimationFrame(step); return;
      }
      if (!particles) {
        particles = buildParticles();
        em.style.opacity = '0'; em.style.filter = ''; host.style.background = 'transparent';
        ring.style.transition = 'transform .7s cubic-bezier(.2,.8,.2,1), opacity .7s'; ring.style.opacity = '0.9';
        requestAnimationFrame(() => { ring.style.transform = 'translate(-50%,-50%) scale(4.2)'; ring.style.opacity = '0'; });
        if (!particles) { host.style.transition = 'opacity .4s'; host.style.opacity = '0'; timer = setTimeout(finish, 420); return; }
        particles.t = now;
      }
      const u = (t - T1 - TC) / T2, dt = Math.min(0.05, (now - particles.t) / 1000); particles.t = now;
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of particles) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.965; p.vy *= 0.965;
        const a = Math.max(0, 1 - u / p.life); if (a <= 0) continue; alive++;
        ctx.globalAlpha = a; ctx.fillStyle = '#fff';
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin * u); ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.8); ctx.restore();
      }
      ctx.globalAlpha = 1;
      // the slots rise underneath while the last fragments are still fading, so it reads as one motion
      if (u > 0.3 && !revealed) { revealed = true; host.style.pointerEvents = 'none'; onDone(); }
      if (u < 1 && alive) raf = requestAnimationFrame(step); else end(false);
    };
    raf = requestAnimationFrame(step);
    return { cancel: () => end(false) };
  }

  // ---------- the roll screen ----------
  // Cards, odds, respins and what you've already seen all come from the engine. A roll that has already spun shows
  // where it landed instead of spinning again.
  let api = null, intr = null, filler = null;
  const fillerCards = () => {
    const S = D2T.game.S();
    if (filler && filler.season === S.season) return filler.cards;
    const ids = S.players.filter((p) => p.a >= 10).map((p) => p.id);
    const cards = shuffle(ids).slice(0, 90).map((id) => D2T.game.card(S, id));
    filler = { season: S.season, cards };
    return cards;
  };
  D2T.screen('transfer', {
    title: 'Transfer window', theme: 'black',
    mount(root) {
      const GAME = D2T.game, SND = window.D2TSound || { play() {} };
      const st = D2T.state.run, eng = GAME.eng(), run = D2T.run();
      root.appendChild(D2T.topbar());
      const info = GAME.windowInfo();
      const rollKey = eng.roll ? `${eng.roll.key}.${eng.roll.spin}` : '';
      const accent = run.club.accent, ink = run.club.ink;
      const lvName = (p) => (D2T.LV[p.level] || D2T.LV.bronze).name;
      const body = D2T.h('<div style="flex:1 1 auto;min-height:0;position:relative;display:flex;flex-direction:column"></div>');
      root.appendChild(body);
      const fx = GAME.fixture(info.gw), opp = fx ? D2T.esc(fx.opp) + (fx.ha === 'H' ? ' (H)' : ' (A)') : '';
      const build = () => {
        api = D2T.roll.mount(body, {
          kicker: `${info.name} · Roll ${info.step} of ${info.of}`, title: 'Who comes in?',
          sub: `Roll ${info.overall} of ${info.total} this season${fx ? `, before GW${info.gw} against ${opp}` : ''}. Sign one or pass.`,
          pool: fillerCards(),
          render: (p, w) => D2T.cards.player(p, { w }),
          pick: () => { SND.play('roll3'); return GAME.rollCards(); },
          settled: st.spun === rollKey ? GAME.rollCards() : null,
          onSettled: () => { st.spun = `${GAME.eng().roll.key}.${GAME.eng().roll.spin}`; D2T.save(); },
          accent: (p) => { const L = D2T.LV[p.level] || D2T.LV.bronze; return { accent: p.level === 'silver' ? '#DCE2E8' : p.level === 'bronze' ? '#D99A66' : L.text, ink: p.level === 'silver' || p.level === 'bronze' || p.level === 'gold' ? '#000' : '#fff' }; },
          caption: (p) => `${p.pos} · ${lvName(p).toUpperCase()}`,
          details: (p) => {
            const keys = p.pos === 'GK' ? D2T.GK_KEYS : D2T.KEYS;
            const best = GAME.preview(p.id).reduce((b, o) => (o.delta > b.delta ? o : b), { delta: -1e9 });
            const out = GAME.lineup().xi[best.slot];
            return `<div class="sp-det-name">${D2T.esc(p.name)}</div><div class="sp-det-line">${D2T.esc(p.club)}${p.club2 ? ' / ' + D2T.esc(p.club2) : ''} ${p.season} · ${p.pos} · ${p.ovr} ${lvName(p)}${p.nat ? ' · ' + D2T.esc(p.nat) : ''} · ${p.apps} games, ${p.goals} goals${p.provisional ? ' · provisional rating' : ''}</div>
              <div class="sp-det-grid cols-3">${keys.map((k) => `<span class="sp-det-stat"><b>${p.stats[k] == null ? '-' : p.stats[k]}</b><i>${k}</i></span>`).join('')}</div>
              <div class="sp-det-badges"><span>Best spot: for ${D2T.esc(out ? out.name : '')}, team ${best.delta >= 0 ? '+' : ''}${best.delta.toFixed(1)}</span></div>`;
          },
          mainLabel: 'Spin', pickLabel: 'Pick a player', spinningLabel: 'Rolling',
          selectedLabel: (p) => `Sign ${surname(p.name)}`,
          hintIdle: 'Hit Spin to roll three players', hintSettled: 'Tap a player to pick them', hintSelected: 'Tap again for the full card, or sign them',
          respins: eng.respins,
          baseBtn: { accent, ink },
          onRespinsChange: () => { GAME.respinCards(); st.spun = ''; D2T.save(); },
          pass: { label: 'Pass on this roll', onPass: () => { GAME.pass(); D2T.go(GAME.eng().phase === 'window' ? 'transfer' : 'squad'); } },
          onConfirm: (p) => { SND.play('pick'); GAME.hold(p.id); D2T.go('squad'); }
        });
        api.el.classList.add('sp-reveal');
      };
      if (st.spun === rollKey) build();
      else intr = intro(body, () => { intr = null; build(); });
    },
    unmount() { intr && intr.cancel(); intr = null; api && api.unmount(); api = null; }
  });
})();
