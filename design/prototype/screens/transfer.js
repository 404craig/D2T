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
    const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // phase 1: one full turn (0 .. 700ms); phase 2: a 150ms charge (it swells and brightens); phase 3: the burst (720ms)
    const T1 = 700, TC = 150, T2 = 720;
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
        const k = easeInOut(Math.min(1, t / T1));
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

  // ---------- odds ----------
  const WEIGHT = { bronze: 14, silver: 34, gold: 38, baller: 11, legend: 4 };
  function pickThree(pool, legend) {
    const byLevel = {}; pool.forEach((p) => { (byLevel[p.level] = byLevel[p.level] || []).push(p); });
    if (legend) byLevel.legend = [legend];
    const levels = Object.keys(byLevel).filter((l) => byLevel[l].length);
    const out = [];
    while (out.length < 3 && levels.length) {
      let tot = levels.reduce((s, l) => s + WEIGHT[l], 0), r = Math.random() * tot, lv = levels[0];
      for (const l of levels) { r -= WEIGHT[l]; if (r <= 0) { lv = l; break; } }
      const c = shuffle(byLevel[lv]).find((p) => !out.includes(p));
      if (!c) { levels.splice(levels.indexOf(lv), 1); continue; }
      out.push(c);
      if (lv === 'legend') levels.splice(levels.indexOf('legend'), 1); // at most one legend per roll
    }
    return out;
  }

  let api = null, intr = null;
  D2T.screen('transfer', {
    title: 'Transfer window', theme: 'black',
    mount(root) {
      root.appendChild(D2T.topbar());
      const run = D2T.run() || D2T.data.runs['Wolves 2011/12'];
      const st = D2T.state.run || { signed: [], respins: 0 };
      const signed = st.signed || [];
      const pool = run.transferPool.filter((p) => !signed.includes(p.name));
      const rollNo = Math.min(17, signed.length + 1);
      const accent = run.club.accent, ink = run.club.ink;
      const lvName = (p) => (D2T.LV[p.level] || D2T.LV.bronze).name;
      const body = D2T.h('<div style="flex:1 1 auto;min-height:0;position:relative;display:flex;flex-direction:column"></div>');
      root.appendChild(body);
      const build = () => {
        api = D2T.roll.mount(body, {
          kicker: `Transfer window · Roll ${rollNo} of 17`, title: 'Who comes in?',
          sub: `Three players are up for ${D2T.esc(run.club.name)}. Sign one or pass.`,
          pool,
          render: (p, w) => D2T.cards.player(p, { w }),
          pick: () => pickThree(pool, Math.random() < 0.06 ? D2T.data.sampleLegend : null),
          accent: (p) => { const L = D2T.LV[p.level] || D2T.LV.bronze; return { accent: p.level === 'silver' ? '#DCE2E8' : p.level === 'bronze' ? '#D99A66' : L.text, ink: p.level === 'silver' || p.level === 'bronze' || p.level === 'gold' ? '#000' : '#fff' }; },
          caption: (p) => `${p.pos} · ${lvName(p).toUpperCase()}`,
          details: (p) => {
            const keys = p.pos === 'GK' ? D2T.GK_KEYS : D2T.KEYS;
            return `<div class="sp-det-name">${D2T.esc(p.name)}</div><div class="sp-det-line">${D2T.esc(p.club)}${p.season ? ' ' + p.season : ''} · ${p.pos} · ${p.ovr} ${lvName(p)}${p.nat ? ' · ' + D2T.esc(p.nat) : ''} · ${p.apps} apps, ${p.goals} goals</div>
              <div class="sp-det-grid cols-3">${keys.map((k) => `<span class="sp-det-stat"><b>${p.stats[k] == null ? '-' : p.stats[k]}</b><i>${k}</i></span>`).join('')}</div>
              ${p.badges && p.badges.length ? `<div class="sp-det-badges">${p.badges.map((b) => `<span>${D2T.esc(b)}</span>`).join('')}</div>` : ''}`;
          },
          mainLabel: 'Spin', pickLabel: 'Pick a player', spinningLabel: 'Rolling',
          selectedLabel: (p) => `Sign ${surname(p.name)}`,
          hintIdle: 'Hit Spin to roll three players', hintSettled: 'Tap a player to pick them', hintSelected: 'Tap again for the full card, or sign them',
          respins: st.respins == null ? null : st.respins,
          onRespinsChange: (n) => { if (D2T.state.run) { D2T.state.run.respins = n; D2T.save(); } },
          pass: { label: 'Pass on this roll', onPass: () => { if (D2T.state.run) { D2T.state.run.step = 'squad'; D2T.save(); } D2T.go('squad'); } },
          onConfirm: (p) => {
            if (D2T.state.run) { D2T.state.run.signed = (D2T.state.run.signed || []).concat(p.name); D2T.state.run.step = 'squad'; D2T.save(); }
            D2T.go('squad');
          }
        });
        api.el.classList.add('sp-reveal');
        // inside a run the club colour is the accent for the main button
        api.el.querySelector('.sp-main').style.setProperty('--sp-btn', accent);
        api.el.querySelector('.sp-main').style.setProperty('--sp-btn-ink', ink);
      };
      intr = intro(body, () => { intr = null; build(); });
    },
    unmount() { intr && intr.cancel(); intr = null; api && api.unmount(); api = null; }
  });
})();
