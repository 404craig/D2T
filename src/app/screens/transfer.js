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
  // where it landed instead of spinning again. Once the three cards land they drop into a tray and your pitch appears
  // above them: drag a card onto a shirt to sign him there (or tap him, then the shirt). Respin lifts them back up first.
  let api = null, intr = null, filler = null, kill = null;
  const fillerCards = () => {
    const S = D2T.game.S();
    if (filler && filler.season === S.season) return filler.cards;
    const ids = S.players.filter((p) => p.a >= 10).map((p) => p.id);
    const cards = shuffle(ids).slice(0, 90).map((id) => D2T.game.card(S, id));
    filler = { season: S.season, cards };
    return cards;
  };
  const LV_ACCENT = (p) => { const L = D2T.LV[p.level] || D2T.LV.bronze; return { accent: p.level === 'silver' ? '#DCE2E8' : p.level === 'bronze' ? '#D99A66' : L.text, ink: p.level === 'silver' || p.level === 'bronze' || p.level === 'gold' ? '#000' : '#fff' }; };
  const PITCH_W = 50;
  const ROLE = { GK: 'goalkeeper', DEF: 'defender', MID: 'midfielder', FWD: 'forward' };
  const ROLES = { GK: 'goalkeepers', DEF: 'defenders', MID: 'midfielders', FWD: 'forwards' };

  D2T.screen('transfer', {
    title: 'Transfer window', theme: 'black',
    mount(root) {
      const GAME = D2T.game, SE = D2T.se, SND = window.D2TSound || { play() {} };
      const st = D2T.state.run, eng = GAME.eng(), run = D2T.run(), club = run.club;
      SE.accent(root, club);
      root.appendChild(D2T.topbar());
      // Dare2Dream's draft runs here too: one spin per shirt, three players for that position, no respins, no pass.
      const draft = GAME.inDraft(), di = draft ? GAME.draftInfo() : null;
      const info = draft ? { name: 'Draft', step: di.step, of: di.of, overall: di.step, total: di.of, gw: 1 } : GAME.windowInfo();
      const rollKey = eng.roll ? `${eng.roll.key}.${eng.roll.spin}` : '';
      const lvName = (p) => (D2T.LV[p.level] || D2T.LV.bronze).name;
      const body = D2T.h('<div style="flex:1 1 auto;min-height:0;position:relative;display:flex;flex-direction:column"></div>');
      root.appendChild(body);
      const fx = GAME.fixture(info.gw), opp = fx ? D2T.esc(fx.opp) + (fx.ha === 'H' ? ' (H)' : ' (A)') : '';
      const reduced = D2T.reduced();
      let alive = true, placing = false, leaving = false, signing = false, field = null, slotsEl = null, ratingEl = null, timers = [];
      kill = () => { alive = false; timers.forEach(clearTimeout); endDrag(true); };

      // ---------- the pitch above the tray ----------
      function drawPitch(best = -1, fresh = -1) {
        if (!slotsEl) return;
        const L = GAME.lineup();
        if (draft) best = di.slot;
        // Club X's open draft: every open shirt is lit, or once a card is picked the open shirts he lists
        let lit = new Set([best]);
        if (draft && di.open) {
          const ds = api ? api.selected() : -1, dc = ds >= 0 ? api.results()[ds] : null;
          lit = new Set(dc ? GAME.draftFits(dc.id) : GAME.lineup().xi.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0));
        }
        // the selected card in the tray: each shirt shows how he would fit it (green preferred, amber near, red not)
        const si = placing && !draft && !signing && api ? api.selected() : -1, inc = si >= 0 ? api.results()[si] : null;
        const pf = (i) => (inc ? GAME.fit(inc.id, i) : null);
        const fitWord = { green: 'a preferred position', amber: 'close to his position', red: 'out of position' };
        slotsEl.innerHTML = GAME.slots().map((s, i) => {
          const c = L.xi[i], f = pf(i), cls = `se-slot${lit.has(i) ? ' se-best' : ''}${f ? ' se-pf-' + f : ''}`;
          const chipFor = f ? `<span class="se-oopchip se-pfchip se-fit-${f}">${s.pos}</span>` : '';
          const say = f ? `, ${fitWord[f]} for ${D2T.esc(inc.name)}` : '';
          if (!c) return `<div class="${cls}" style="left:${s.x}%;top:${s.y}%;z-index:${Math.round(s.y)}" data-i="${i}"><div class="se-cardwrap" data-i="${i}" role="button" tabindex="0" aria-label="Empty ${s.pos} shirt${lit.has(i) ? ', open for this pick' : ''}${say}">${SE.emptyShirt(s.pos, PITCH_W)}${chipFor}</div></div>`;
          const fit = GAME.fit(c.id, i), oop = fit !== 'green';
          return `<div class="${cls}" style="left:${s.x}%;top:${s.y}%;z-index:${Math.round(s.y)}" data-i="${i}">
            <div class="se-cardwrap" data-i="${i}" role="button" tabindex="0" aria-label="${D2T.esc(c.name)}, ${c.ovr}, playing ${s.pos}. Sign the selected player here${say}">
              ${D2T.cards.player(c, { w: PITCH_W, mini: true, shine: i === fresh })}${chipFor || (oop ? `<span class="se-oopchip se-fit-${fit}">${s.pos}</span>` : '')}</div></div>`;
        }).join('');
        ratingEl.textContent = GAME.rating();
        if (fresh >= 0 && !reduced) {
          const el = slotsEl.querySelector(`.se-cardwrap[data-i="${fresh}"]`);
          el && el.animate([{ transform: 'scale(1.5)', filter: 'brightness(1.8)' }, { transform: 'scale(.95)' }, { transform: 'none', filter: 'none' }], { duration: 650, easing: 'cubic-bezier(.3,1.4,.5,1)' });
        }
      }
      function buildPitch() {
        field = D2T.h(`<div class="tr-pitch" aria-label="Your XI">
          <div class="tr-head"><div class="tr-head-t"><b>${draft ? `Draft · Shirt ${info.step} of ${info.of}` : `${D2T.esc(info.name)} · Roll ${info.step} of ${info.of}`}</b><span>${draft ? (di.open ? 'Drag one onto a lit shirt' : `Drag one onto the lit ${di.pos} shirt`) : 'Drag a player onto a shirt to sign him there'}</span></div>
            <div class="se-rating" aria-live="polite"><b class="tr-rating">0</b><i>Team<br>rating</i></div></div>
          <div class="se-pitch tr-field">${SE.pitchLines}<div class="se-slots"></div></div></div>`);
        api.el.insertBefore(field, api.el.querySelector('.sp-stage'));
        slotsEl = field.querySelector('.se-slots'); ratingEl = field.querySelector('.tr-rating');
        slotsEl.addEventListener('click', (e) => {
          const w = e.target.closest('.se-cardwrap'); if (!w || !placing) return;
          const i = api.selected();
          if (i < 0) { api.hint('Pick one of the three first, then tap a shirt'); return; }
          sign(i, +w.dataset.i);
        });
      }

      // FLIP the row of cards between the middle of the screen and the tray
      const row = () => api.el.querySelector('.sp-row');
      function flip(toPlacing) {
        const r = row(), b = r.getBoundingClientRect();
        api.el.classList.toggle('is-placing', toPlacing);
        const a = r.getBoundingClientRect();
        if (reduced) return;
        const dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2), sc = b.width / a.width;
        const end = getComputedStyle(r).transform; const e = end === 'none' ? 'none' : end;
        r.animate([{ transform: `translate(${dx}px,${dy}px) ${e === 'none' ? '' : e} scale(${sc})` }, { transform: e }], { duration: 520, easing: 'cubic-bezier(.5,0,.2,1)' });
      }
      function enterPlacing(animate) {
        if (placing || !alive) return;
        placing = true;
        drawPitch();
        if (animate && !reduced) {
          flip(true);
          field.animate([{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 160, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
        } else api.el.classList.add('is-placing');
        api.hint(draft ? 'Drag one onto the lit shirt, or tap him then Sign' : 'Drag a player onto the pitch, or tap him then a shirt');
      }
      function leavePlacing() {
        if (!placing) return Promise.resolve();
        placing = false; leaving = true; api.clear();
        if (reduced) { api.el.classList.remove('is-placing'); return Promise.resolve(); }
        return new Promise((res) => {
          field.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' }).onfinish = () => {
            flip(false);
            field.getAnimations().forEach((x) => x.cancel());
            timers.push(setTimeout(res, 480));
          };
        });
      }

      // ---------- sign or pass ----------
      function sign(i, slot) {
        if (signing || !placing) return;
        const p = api.results()[i];
        if (draft && di.open && p && !GAME.draftFits(p.id).includes(slot)) { api.hint(`${surname(p.name)} can't play there. Pick a lit shirt.`); return; }
        if (draft && !di.open && slot !== di.slot) { api.hint(`This pick goes in the lit ${di.pos} shirt`); return; }
        if (!p || !(draft ? GAME.draftPick(p.id, slot) : GAME.signAt(p.id, slot))) return;
        signing = true;
        SND.play('subIn');
        drawPitch(-1, slot);
        const s = api.slots[i];
        s.classList.add('is-signed');
        api.hint(`${surname(p.name)} is in. Welcome to ${club.name}.`);
        const ph = GAME.eng().phase;
        timers.push(setTimeout(() => { if (alive) D2T.go(ph === 'window' || ph === 'draft' ? 'transfer' : 'squad'); }, reduced ? 300 : (draft ? 800 : 1100)));
      }
      function pass() {
        if (signing) return;
        GAME.pass();
        D2T.go(GAME.eng().phase === 'window' ? 'transfer' : 'squad');
      }

      // ---------- drag a card from the tray onto a shirt ----------
      // A press on a card is remembered from the moment the finger goes down, even while the reels are still landing
      // (a keen player grabs the left card before the right one stops, or the instant the last one lands, before the
      // tray has dropped): the drag starts, and the tray comes up, as soon as the roll has settled.
      let drag = null, ghost = null, target = null, suppress = -1;
      const host = document.getElementById('app');
      function endDrag(cancel) {
        if (ghost) ghost.remove(); ghost = null;
        if (target) target.classList.remove('se-target'); target = null;
        if (cancel) drag = null;
      }
      const onDown = (e) => {
        suppress = -1;   // a new press: any click that follows belongs to it
        if (signing || e.button || !api) return;
        const s = e.target.closest('.sp-slot'); if (!s || !api.el.contains(s)) return;
        drag = { i: api.slots.indexOf(s), x0: e.clientX, y0: e.clientY, pid: e.pointerId, moved: false };
      };
      const onMove = (e) => {
        if (!drag || e.pointerId !== drag.pid) return;
        if (!drag.moved) {
          if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
          if (!api.settled() || leaving || signing) return;
          if (!placing) enterPlacing(true);
          drag.moved = true;
          if (api.selected() !== drag.i) api.select(drag.i);
          const p = api.results()[drag.i];
          ghost = D2T.h(`<div class="se-ghost" aria-hidden="true">${D2T.cards.player(p, { w: 64, mini: true, shine: false })}</div>`);
          host.appendChild(ghost);
          drawPitch(draft ? di.slot : GAME.bestSlot(p.id));
        }
        if (e.cancelable) e.preventDefault();
        const hr = host.getBoundingClientRect();
        ghost.style.transform = `translate(${e.clientX - hr.left - 32}px,${e.clientY - hr.top - 58}px) rotate(-4deg) scale(1.08)`;
        const under = document.elementFromPoint(e.clientX, e.clientY);
        let t = under && under.closest('.tr-field .se-cardwrap');
        if (!t && under) { const sl = under.closest('.tr-field .se-slot'); t = sl && sl.querySelector('.se-cardwrap'); }
        if (t !== target) { target && target.classList.remove('se-target'); target = t; target && target.classList.add('se-target'); }
      };
      const onUp = (e) => {
        if (!drag || e.pointerId !== drag.pid) return;
        const d = drag; drag = null;
        if (!d.moved) return;
        suppress = d.i;
        const t = target; endDrag(false);
        if (t) sign(d.i, +t.dataset.i);
      };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', () => { drag = null; endDrag(false); });
      root.addEventListener('pointerdown', onDown);
      // a drag is not a tap: swallow the click that follows it (a touch drag has none, so the next press clears it)
      root.addEventListener('click', (e) => { if (suppress >= 0 && e.target.closest('.sp-slot')) { e.stopPropagation(); e.preventDefault(); } suppress = -1; }, true);
      const blockTouch = (e) => { if (drag && drag.moved && e.cancelable) e.preventDefault(); };
      window.addEventListener('touchmove', blockTouch, { passive: false });
      const prevKill = kill;
      kill = () => { prevKill(); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('touchmove', blockTouch); };

      const build = () => {
        api = D2T.roll.mount(body, {
          kicker: draft ? `${GAME.modeName()} draft · Shirt ${info.step} of ${info.of}` : `${info.name} · Roll ${info.step} of ${info.of}`,
          title: draft ? (di.open ? 'Pick your next player' : `Pick your ${ROLE[di.broad]}`) : 'Who comes in?',
          sub: draft ? (di.open ? `Three players from ${run.season} for your open shirts. Put him in any lit shirt he plays. No respins in the draft.` : `Three ${ROLES[di.broad]} from ${run.season} for your ${di.pos} shirt. No respins in the draft.`) : `Roll ${info.overall} of ${info.total} this season${fx ? `, before GW${info.gw} against ${opp}` : ''}. Sign one or pass.`,
          pool: fillerCards(),
          render: (p, w) => D2T.cards.player(p, { w }),
          pick: () => { SND.play('roll3'); return GAME.rollCards(); },
          settled: st.spun === rollKey ? GAME.rollCards() : null,
          onSettled: () => { leaving = false; st.spun = `${GAME.eng().roll.key}.${GAME.eng().roll.spin}`; D2T.save(); timers.push(setTimeout(() => enterPlacing(true), reduced ? 0 : 450)); },
          accent: LV_ACCENT,
          caption: (p) => `${p.main || p.pos} · ${lvName(p).toUpperCase()}`,
          details: (p) => D2T.cards.info(p), detailsBare: true,
          mainLabel: 'Spin', pickLabel: draft ? 'Pick one' : 'Pass', spinningLabel: 'Rolling',
          selectedLabel: (p) => (draft ? `Sign ${surname(p.name)}` : 'Pass'),
          hintIdle: 'Hit Spin to roll three players', hintSettled: '', hintSelected: 'Tap a shirt to sign him there, or tap him again for his card',
          respins: draft ? null : eng.respins,
          baseBtn: { accent: club.accent, ink: club.ink },
          onRespinsChange: () => { GAME.respinCards(); st.spun = ''; D2T.save(); },
          beforeSpin: () => leavePlacing(),
          onSelect: (i, p) => { if (placing) drawPitch(draft ? di.slot : GAME.bestSlot(p.id)); timers.push(setTimeout(() => api && D2T.tip('card-again', api.el.querySelectorAll('.sp-slot')[i], 'Tap him again for his career'), 250)); },
          afterSettle: draft ? null : { label: 'Pass', onClick: pass },
          onConfirm: (p) => { if (draft) sign(api.results().indexOf(p), di.open ? GAME.draftFits(p.id)[0] : di.slot); }
        });
        api.el.classList.add('sp-reveal');
        buildPitch();
        if (st.spun === rollKey) enterPlacing(false);
      };
      // the emblem burst opens each window and the draft, not every one of the 11 draft spins
      if (st.spun === rollKey || (draft && di.step > 1)) build();
      else intr = intro(body, () => { intr = null; build(); });
    },
    unmount() { kill && kill(); kill = null; intr && intr.cancel(); intr = null; api && api.unmount(); api = null; }
  });
})();
