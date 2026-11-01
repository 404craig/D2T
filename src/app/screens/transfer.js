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
    window.D2TSound && window.D2TSound.play('windowOpen');
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
  const LV_IDX = (p) => Math.max(0, ['bronze', 'silver', 'gold', 'baller', 'legend'].indexOf(p && p.level));
  const LV_ACCENT = (p) => { const L = D2T.LV[p.level] || D2T.LV.bronze; return { accent: p.level === 'silver' ? '#DCE2E8' : p.level === 'bronze' ? '#D99A66' : L.text, ink: p.level === 'silver' || p.level === 'bronze' || p.level === 'gold' ? '#000' : '#fff' }; };
  // the transfer pitch's cards are 15% bigger than the squad's (Craig, 14 Oct): 57.5 x 75, each line nudged up or
  // down the pitch (px, minus is up) on top of its formation position so the bigger cards stay clear of each other.
  // A pitch too short for them (under BIG_MIN px tall, as on 375 x 667 and 375 x 812 phones) keeps the squad's 50 x 65 cards.
  const PITCH_W = 57.5, SMALL_W = 50, BIG_MIN = 400;
  const BACK = new Set(['CB', 'LB', 'RB', 'LWB', 'RWB']), MIDS = new Set(['CM', 'LM', 'RM', 'CAM']), FWDS = new Set(['ST', 'LW', 'RW']);
  const nudge = (f, s) => {
    if (s.pos === 'GK') return { x: 0, y: 8 };
    if (f === '4-2-3-1') {
      if (s.pos === 'CDM') return { x: s.x > 50 ? 6 : -6, y: -2 };
      if (s.pos === 'ST') return { x: 0, y: -6 };
      if (s.pos === 'CAM' || s.pos === 'LW' || s.pos === 'RW') return { x: 0, y: -4 };
      return { x: 0, y: 0 };
    }
    if ((f === '5-3-2' || f === '5-4-1') && s.pos === 'CB') return { x: 0, y: -10 };
    if (BACK.has(s.pos)) return { x: 0, y: -4 };
    if (s.pos === 'CDM') return { x: 0, y: -8 };
    if (MIDS.has(s.pos)) return { x: 0, y: -4 };
    if (FWDS.has(s.pos)) return { x: 0, y: -2 };
    return { x: 0, y: 0 };
  };
  // left and top stay the formation's %, plus the nudge; with the big cards the keeper never comes closer than 4px to the goal line
  // (98% down, SE.pitchLines) and no card's ring (3.5px out) touches a touchline (3% in from each side)
  const place = (f, s, w) => {
    const n = w === PITCH_W ? nudge(f, s) : { x: 0, y: 0 }, hw = w / 2 + 4.5, hh = Math.round(w * 1.3) / 2;
    const top = s.pos === 'GK' && w === PITCH_W ? `min(calc(${s.y}% + ${n.y}px), calc(98% - ${4 + hh}px))` : `calc(${s.y}% + ${n.y}px)`;
    return `left:clamp(calc(3% + ${hw}px), calc(${s.x}% + ${n.x}px), calc(97% - ${hw}px));top:${top}`;
  };
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
      let alive = true, big = true, lastBest = -1, mover = -1, sizeObs = null, placing = false, leaving = false, signing = false, field = null, slotsEl = null, ratingEl = null, timers = [];
      let janTake = null, janBack = null, janNews = null;   // the January raid's show: { slot, card } keeps the taken player on the pitch until the badge takes him
      kill = () => { alive = false; timers.forEach(clearTimeout); endDrag(true); sizeObs && sizeObs.disconnect(); janTake && janTake.cancel(); janTake = null; janBack = null; janNews && janNews.stop(); root.classList.remove('rd-busy'); };

      // ---------- the pitch above the tray ----------
      function drawPitch(best = -1, fresh = -1) {
        if (!slotsEl) return;
        const L = GAME.lineup();
        if (draft) best = di.slot;
        // Club X's open draft (Craig, 13 Oct): every open shirt is lit; once a card is picked, his green open shirts
        // (or his best one) and every shirt shows his green, amber or red chip. He can go on any open shirt.
        let lit = new Set([best]);
        if (draft && di.open) {
          const ds = api ? api.selected() : -1, dc = ds >= 0 ? api.results()[ds] : null;
          if (dc) { const fits = GAME.draftFits(dc.id), green = fits.filter((i) => GAME.fit(dc.id, i) === 'green'); lit = new Set(green.length ? green : fits.slice(0, 1)); }
          else lit = new Set(GAME.lineup().xi.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0));
        }
        // the selected card in the tray: each shirt shows how he would fit it (green preferred, amber near, red not)
        const si = placing && (!draft || di.open) && !signing && api ? api.selected() : -1;
        // a player of yours being moved on the pitch (Craig, 15 Oct) rings the shirts for himself, like a tray card
        const inc = si >= 0 ? api.results()[si] : mover >= 0 ? L.xi[mover] : null;
        const pf = (i) => (inc ? GAME.fit(inc.id, i) : null);
        const fitWord = { green: 'a preferred position', amber: 'close to his position', red: 'out of position' };
        const fm = GAME.eng().formation, pw = big ? PITCH_W : SMALL_W;
        lastBest = best;
        const gone = GAME.poachedSlots();   // a Club X career's poached players: their empty shirts keep where they went
        slotsEl.innerHTML = GAME.slots().map((s, i) => {
          const c = L.xi[i] || (janBack && janBack.slot === i ? janBack.card : null), f = pf(i), cls = `se-slot${lit.has(i) ? ' se-best' : ''}${f ? ' se-pf-' + f : ''}${i === mover ? ' se-sel' : ''}`;
          const plist = i === mover && c ? (c.main ? [c.main, ...(c.alt || [])] : [c.pos]) : null, plab = plist ? `<span class="se-poslab" aria-hidden="true">${plist.join('<i>/</i>')}</span>` : '';
          const say = f ? `, ${fitWord[f]} for ${D2T.esc(inc.name)}` : '';
          if (!c) return `<div class="${cls}" style="${place(fm, s, pw)};z-index:${Math.round(s.y)}" data-i="${i}"><div class="se-cardwrap" data-i="${i}" role="button" tabindex="0" aria-label="Empty ${s.pos} shirt${lit.has(i) ? ', open for this pick' : ''}${say}">${SE.emptyShirt(s.pos, pw, gone[i])}</div></div>`;
          const fit = GAME.fit(c.id, i), oop = fit !== 'green';
          return `<div class="${cls}" style="${place(fm, s, pw)};z-index:${Math.round(s.y)}" data-i="${i}">
            <div class="se-cardwrap" data-i="${i}" role="button" tabindex="0" aria-label="${D2T.esc(c.name)}, ${c.ovr}, playing ${s.pos}. Sign the selected player here${say}">
              ${D2T.cards.player(c, { w: pw, mini: true, shine: i === fresh, tab: s.pos, cls: 'fit-' + fit, dots: (GAME.settling(c.id) || {}).left })}</div>${plab}</div>`;
        }).join('');
        rateTo(GAME.rating());
        const tn = field && field.querySelector('.se-tname'); if (tn) tn.textContent = GAME.tacticName();
        if (fresh >= 0 && !reduced) {
          const el = slotsEl.querySelector(`.se-cardwrap[data-i="${fresh}"]`);
          el && el.animate([{ transform: 'scale(1.5)', filter: 'brightness(1.8)' }, { transform: 'scale(.95)' }, { transform: 'none', filter: 'none' }], { duration: 650, easing: 'cubic-bezier(.3,1.4,.5,1)' });
        }
      }
      function buildPitch() {
        field = D2T.h(`<div class="tr-pitch" aria-label="Your XI">
          <div class="tr-head"><div class="tr-head-t"><b>${draft ? `Draft · Shirt ${info.step} of ${info.of}` : `Transfer ${info.overall} of ${info.total}${/^Summer/.test(info.name) ? '<span class="tr-win"> · Summer window</span>' : /^January/.test(info.name) ? '<span class="tr-win"> · January window</span>' : ''}`}</b><span>${draft ? (di.open ? 'Drag one onto an open shirt' : `Drag one onto the lit ${di.pos} shirt`) : 'Drag a player onto a shirt to sign him there'}</span></div>
            <div class="se-rating" aria-live="polite"><b class="tr-rating">0</b><i>Team<br>rating</i></div></div>
          <div class="se-pitch tr-field tr-big">${SE.pitchLines}<div class="se-slots"></div>${draft && !di.open ? '' : `<button class="se-formlink" type="button"><b class="se-fname">${GAME.eng().formation}</b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>${SE.tacticChip()}`}</div></div>`);
        api.el.insertBefore(field, api.el.querySelector('.sp-stage'));
        slotsEl = field.querySelector('.se-slots'); ratingEl = field.querySelector('.tr-rating');
        // big cards only where the pitch has the height for them; redrawn when that changes
        const fieldEl = field.querySelector('.tr-field');
        const sizeUp = () => { const h = fieldEl.clientHeight; if (!h) return; const b = h >= BIG_MIN; if (b === big) return; big = b; fieldEl.classList.toggle('tr-big', b); if (placing || api.el.classList.contains('tr-preraid')) drawPitch(lastBest); };
        if (window.ResizeObserver) { sizeObs = new ResizeObserver(sizeUp); sizeObs.observe(fieldEl); }
        // change the shape on a roll (Craig, 13 Oct): your 11 are re-seated, nobody comes in; some may land out of position
        const fl = field.querySelector('.se-formlink');
        if (fl) fl.onclick = (e) => {
          e.stopPropagation();
          SE.formSheet(root, { onApply: (f) => {
            if (!alive) return;
            GAME.setFormation(f);
            window.D2TSound && window.D2TSound.play('formation');
            fl.querySelector('.se-fname').textContent = f;
            const si = api ? api.selected() : -1, p = si >= 0 ? api.results()[si] : null;
            drawPitch(p && !draft ? GAME.bestSlot(p.id) : -1);
          } });
        };
        // the tactic (Craig, 18 Oct): its chip bottom right, the twin of the shape chip; a change redraws the best shirt
        const tl = field.querySelector('.se-taclink');
        if (tl) tl.onclick = (e) => { e.stopPropagation(); SE.tacticSheet(root, () => { if (!alive) return; const si = api ? api.selected() : -1, p = si >= 0 ? api.results()[si] : null; drawPitch(p && !draft ? GAME.bestSlot(p.id) : -1); }); };
        slotsEl.addEventListener('click', (e) => {
          const w = e.target.closest('.se-cardwrap'); if (!w || !placing) return;
          const i = api.selected(), slot = +w.dataset.i;
          if (i >= 0) { mover = -1; sign(i, slot); return; }
          // nothing picked from the tray: tap one of yours, then another shirt, to swap them (Craig, 15 Oct); tap him
          // again for his big card, to see where else he can play before you sign anyone (Craig, 22 Oct)
          const mine = GAME.lineup().xi[slot];
          if (draft && !di.open) { if (mine) { openMine(slot); return; } api.hint('Pick one of the three first, then tap a shirt'); return; }
          if (mover < 0) { if (!mine) { api.hint('Pick one of the three first, or tap one of yours to see where he plays'); return; } mover = slot; drawPitch(); api.hint('Drag him onto another shirt to swap, or tap him again for his card'); return; }
          if (mover === slot) { openMine(slot); return; }
          // tap to look, drag to swap (Craig, 29 Oct, build 167): tapping another of your players picks him instead of swapping (swaps are drags); an empty shirt still
          // takes the picked player
          if (mine) { mover = slot; SND.play('cardSelect'); drawPitch(); api.hint('Drag him onto another shirt to swap, or tap him again for his card'); return; }
          moveTo(mover, slot);
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
          SND.play('trayDrop');
          flip(true);
          field.animate([{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 160, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
        } else api.el.classList.add('is-placing');
        api.hint(draft ? (di.open ? 'Drag one onto an open shirt, or tap him then a shirt' : 'Drag one onto the lit shirt, or tap him then Sign') : 'Drag a player onto the pitch, or tap him then a shirt');
        if (janShow && !janShown && !preRaid) { janShown = true; playJanRaid(animate ? 760 : 400); }
      }
      // the January raid's show (Craig, 20 Oct; Sweep and strike, SE.raidTake): the taken player is put back in his shirt
      // as the pitch appears, the crosshair hunts him down and the rival's badge takes him; then the sheet
      async function playJanRaid(delay) {
        const sl = slotsEl.querySelector(`.se-slot[data-i="${jr.slot}"]`), pitchEl = field && field.querySelector('.se-pitch');
        if (!sl || !pitchEl) { root.classList.remove('rd-busy'); return janSheet(600); }
        janBack = { slot: jr.slot, card: jr.card }; drawPitch(lastBest);
        root.classList.add('rd-busy');
        // the Transfer News bar takes the hint line's place (Craig, 21 Oct): the rumour as the sweep starts, the deal as
        // the badge lands, no count (one raid); it stays until you move on
        const hint = api.el.querySelector('.sp-hint');
        if (hint && !janNews) { janNews = SE.newsBar({ count: false }); janNews.el.classList.add('se-news-flow'); hint.style.display = 'none'; hint.after(janNews.el); }
        const words = SE.raidWords(0);
        await new Promise((r) => timers.push(setTimeout(r, delay)));
        if (!alive) return;
        janTake = SE.raidTake({
          pitch: pitchEl, slotsEl, slot: jr.slot, crest: jr.crestLight || jr.crest, dark: jr.dark,
          onStart: () => janNews && janNews.say(words.rumour(jr.club)),
          onLanded: () => janNews && janNews.say(words.deal(jr.club, jr.name)),
          onEmpty: () => { janBack = null; drawPitch(lastBest); }
        });
        await janTake.done; janTake = null; janBack = null;
        root.classList.remove('rd-busy');
        if (alive) janSheet(preRaid ? 1000 : 200);
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
        if (draft && di.open && p && !GAME.draftFits(p.id).includes(slot)) { api.hint('That shirt is taken. Pick an open one.'); return; }
        if (draft && !di.open && slot !== di.slot) { api.hint(`This pick goes in the lit ${di.pos} shirt`); return; }
        if (p && !GAME.canPlay(p.id, slot)) { api.hint(GAME.noPlayWord(p.id)); SND.play('dropCancel'); return; }
        const replaced = !draft && p && GAME.lineup().xi[slot];
        if (!p || !(draft ? GAME.draftPick(p.id, slot) : GAME.signAt(p.id, slot))) return;
        signing = true;
        SND.play('cardDrop'); if (replaced) SND.play('playerOut', null, 0.35);
        drawPitch(-1, slot);
        const s = api.slots[i];
        s.classList.add('is-signed');
        // how he settles (Craig, 18 Oct): at once, a couple of games, or three
        const stl = draft ? null : GAME.settling(p.id);
        api.hint(`${surname(p.name)} is in. ${draft ? `Welcome to ${club.name}.` : !stl ? 'He hits the ground running.' : stl.games === 2 ? 'A couple of games to settle.' : 'Three games to settle.'}`);
        const ph = GAME.eng().phase;
        // the window over (Craig, 14 Oct): straight to the fixtures; the draft over: the pre-season squad
        timers.push(setTimeout(() => { if (alive) D2T.go(ph === 'window' || ph === 'draft' ? 'transfer' : draft ? 'squad' : 'fixtures'); }, reduced ? 300 : (draft ? 800 : 1100)));
      }
      // move one of your players to another shirt on the pitch (a swap; an empty shirt moves the other way)
      function moveTo(from, to) {
        mover = -1;
        const mv = GAME.lineup().xi[from];
        if (!GAME.swapSlots(from, to)) { drawPitch(); if (mv && !GAME.canPlay(mv.id, to)) { api.hint(GAME.noPlayWord(mv.id)); SND.play('dropCancel'); } return; }
        SND.play('cardDrop');
        drawPitch(-1, to);
        api.hint(draft ? 'Drag one onto an open shirt, or tap him then a shirt' : 'Drag a player onto the pitch, or tap him then a shirt');
      }
      // Respin or scout (Craig, 18 and 20 Oct): the respin button opens one sheet in the game's style, "N respins left",
      // three option cards: Respin (1), Scout a position (2) and Scout a club (2). A position: your shirts drawn as the
      // pitch's own shirts, red where nobody this season is better than the man in it (no count on the rest since 1 Nov,
      // Craig: the count told you where to move a star to raise the bar); tap one and
      // the scouts' three cards roll in (GAME.scout). A club: the season's clubs by final position, tap one for three of
      // its players (GAME.scoutClub). Neither ever brings a legend card.
      const ICON_SHIRT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h2.2a1.8 1.8 0 0 0 3.6 0H16l5 3.5-2 3.8-2.3-1.2V21H7.3V9.1L5 10.3 3 6.5Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>';
      const ICON_SHIELD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 20 5.5v6c0 4.6-3.3 8.1-8 10-4.7-1.9-8-5.4-8-10v-6Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M12 6.5v12M7 11h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".55"/></svg>';
      const tint = (sh) => { sh.el.classList.add('se-run'); ['--se-acc', '--se-ink', '--se-text', '--se-acc-a', '--se-acc-b'].forEach((v) => sh.el.style.setProperty(v, root.style.getPropertyValue(v))); };
      // Respins and scouting (Craig, 31 Oct, build 186; restyle "A · Dots and icons" on the respin canvas): the same three
      // sheets, fewer words: your respins as dots in the title (the ones a choice will spend pulse), round icons, costs as dots
      const dotsHTML = (n, spend) => { const max = Math.max(5, n); return `<span class="rs-dots" aria-label="${n} respin${n === 1 ? '' : 's'} left">${Array.from({ length: max }, (_, i) => `<i class="${i >= n ? 'gone' : i >= n - spend ? 'spend' : ''}"></i>`).join('')}</span>`; };
      const titleWith = (t, n, spend) => `<span class="rs-title"><span>${t}</span>${dotsHTML(n, spend)}</span>`;
      function respinChoice(n) {
        return new Promise((resolve) => {
          let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
          const can = GAME.canScout(), cost = GAME.scoutCost(), clubs = can ? GAME.scoutClubs() : [];
          const opt = (k, icon, name, sub, c, ok) => `<button class="rs-opt" type="button" data-k="${k}"${ok ? '' : ' disabled'}><span class="rs-ic">${icon}</span><span class="rs-tx"><b>${name}</b><span>${sub}</span></span><span class="rs-cost" aria-label="${c} respin${c === 1 ? '' : 's'}">${'<i></i>'.repeat(c)}</span></button>`;
          const el = D2T.h(`<div class="rs-opts">
            ${opt('respin', D2T.ICON.respin, 'Respin', 'Three new cards', 1, true)}
            ${opt('scout', ICON_SHIRT, 'Scout a position', 'Better than yours, one shirt', cost, can)}
            ${opt('club', ICON_SHIELD, 'Scout a club', 'Three from one club', cost, can && clubs.length > 0)}</div>`);
          const sh = D2T.sheet({ title: titleWith('Respins', n, 0), body: el, onClose: () => fin(null) });
          tint(sh); sh.el.classList.add('rs-sheet');
          el.querySelector('[data-k="respin"]').onclick = () => { done = true; sh.close(); resolve('respin'); };
          el.querySelector('[data-k="scout"]').onclick = () => { if (!can) return; done = true; sh.close(); timers.push(setTimeout(() => scoutSheet().then(resolve), 260)); };
          el.querySelector('[data-k="club"]').onclick = () => { if (!can || !clubs.length) return; done = true; sh.close(); timers.push(setTimeout(() => scoutClubSheet(clubs).then(resolve), 260)); };
        });
      }
      function scoutSheet() {
        return new Promise((resolve) => {
          let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
          const info = GAME.scoutInfo(), slots = GAME.slots(), L = GAME.lineup(), n = GAME.eng().respins;
          const shirt = (s, i) => { const q = info[i], none = !q.better; return `<button class="se-scoutshirt rs-shirt${none ? ' is-none' : ''}" type="button" data-i="${i}" style="left:${s.x}%;top:${s.y}%" aria-label="${s.pos}${none ? ', nobody better this season' : ''}"><b>${s.pos}</b></button>`; };
          const el = D2T.h(`<div><p class="rs-key"><i class="rs-keyred" aria-hidden="true"></i>Red: nobody better this season</p>
            <div class="se-scoutpitch rs-pitch">${SE.pitchLines}${slots.map(shirt).join('')}</div>
            <p class="se-scoutnone" aria-live="polite"></p></div>`);
          if (!info.some((q) => !q.better)) el.querySelector('.rs-key').hidden = true;
          const sh = D2T.sheet({ title: titleWith('Scout a position', n, GAME.scoutCost()), body: el, onClose: () => fin(null) });
          tint(sh); sh.el.classList.add('se-scoutsheet', 'rs-sheet');
          const none = el.querySelector('.se-scoutnone');
          el.querySelectorAll('.se-scoutshirt').forEach((b) => {
            b.onclick = () => {
              const i = +b.dataset.i, q = info[i], bi = q.by != null ? GAME.eng().xi.indexOf(q.by) : -1, mine = L.xi[bi >= 0 ? bi : i];
              if (!q.better) { SND.play('tapSmall'); none.textContent = `Nobody better than ${mine ? surname(mine.name) : 'nobody'} at ${q.pos} in ${run.season}.${q.bestCard ? ` Best there: ${q.bestCard.name} (${q.bestCard.ovr}).` : ''}`; return; }
              if (!GAME.scout(i)) { none.textContent = `The scouts need ${GAME.scoutCost()} respins.`; return; }
              SND.play('respin'); done = true; sh.close(); resolve(GAME.eng().respins);
            };
          });
        });
      }
      function scoutClubSheet(clubs) {
        return new Promise((resolve) => {
          let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
          const tile = (c, i) => `<button class="se-clubtile rs-club" type="button" data-c="${c.club}" aria-label="${D2T.esc(c.name)}, ${D2T.ordinal(i + 1)}"><em>${i + 1}</em>${c.crest ? `<img src="${c.crest}" alt="">` : `<b>${D2T.esc(c.name)}</b>`}<small>${D2T.esc(c.name)}</small></button>`;
          const el = D2T.h(`<div><div class="se-clubgrid rs-clubs">${clubs.map(tile).join('')}</div></div>`);
          const sh = D2T.sheet({ title: titleWith('Scout a club', GAME.eng().respins, GAME.scoutCost()), body: el, onClose: () => fin(null) });
          tint(sh); sh.el.classList.add('se-scoutsheet', 'rs-sheet');
          el.querySelectorAll('.se-clubtile').forEach((b) => {
            b.onclick = () => { if (!GAME.scoutClub(+b.dataset.c)) { SND.play('tapSmall'); return; } SND.play('respin'); done = true; sh.close(); resolve(GAME.eng().respins); };
          });
        });
      }
      // the big card of one of your own players on the pitch (the squad screen's, D2T.cards.info under it)
      function openMine(slot) {
        const card = GAME.lineup().xi[slot], w = slotsEl.querySelector(`.se-cardwrap[data-i="${slot}"]`);
        if (!card || !w) return;
        const W = Math.min(236, Math.round(root.clientWidth * 0.6));
        SND.play('cardSelect', 0);
        D2T.cards.openLarge(w.querySelector('.d2c') || w, D2T.cards.player(card, { w: W }), { w: W, below: D2T.cards.info(card), scroll: true });
      }
      // a tap on the grass or beside the tray's cards lets go of whatever is picked (Craig, 22 Oct): a tray card or one
      // of your own players; the pitch goes back to plain and the main button to its resting label
      function deselect() {
        if (!api || (api.selected() < 0 && mover < 0)) return;
        api.clear(); mover = -1;
        if (draft) api.setLabel('Pick one');
        drawPitch(draft ? di.slot : -1);
        api.hint(draft ? (di.open ? 'Drag one onto an open shirt, or tap him then a shirt' : 'Drag one onto the lit shirt, or tap him then Sign') : 'Pick one of the three, or tap one of yours to move him');
        SND.play('tapSmall');
      }
      function pass() {
        if (signing) return;
        SND.play('pass');
        GAME.pass();
        D2T.go(GAME.eng().phase === 'window' ? 'transfer' : 'fixtures');
      }

      // ---------- drag a card from the tray onto a shirt ----------
      // A press on a card is remembered from the moment the finger goes down, even while the reels are still landing
      // (a keen player grabs the left card before the right one stops, or the instant the last one lands, before the
      // tray has dropped): the drag starts, and the tray comes up, as soon as the roll has settled.
      let drag = null, ghost = null, target = null, suppress = -1, suppressPitch = false;
      const host = document.getElementById('app');
      function endDrag(cancel) {
        if (ghost) ghost.remove(); ghost = null;
        if (target) target.classList.remove('se-target'); target = null;
        if (cancel) drag = null;
      }
      const onDown = (e) => {
        suppress = -1; suppressPitch = false;   // a new press: any click that follows belongs to it
        if (signing || e.button || !api) return;
        const s = e.target.closest('.sp-slot');
        if (!s || !api.el.contains(s)) {
          // a card of yours on the pitch can be dragged onto another shirt (not in Dare2Dream's draft, not with a tray card picked)
          const w = placing && (!draft || di.open) && e.target.closest('.tr-field .se-cardwrap');
          if (w && GAME.lineup().xi[+w.dataset.i] && api.selected() < 0) drag = { pitch: +w.dataset.i, x0: e.clientX, y0: e.clientY, pid: e.pointerId, moved: false };
          return;
        }
        drag = { i: api.slots.indexOf(s), x0: e.clientX, y0: e.clientY, pid: e.pointerId, moved: false };
      };
      const onMove = (e) => {
        if (!drag || e.pointerId !== drag.pid) return;
        if (!drag.moved) {
          if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
          if (!api.settled() || leaving || signing) return;
          if (drag.pitch != null) {
            drag.moved = true; mover = drag.pitch;
            const p = GAME.lineup().xi[drag.pitch];
            ghost = D2T.h(`<div class="se-ghost" aria-hidden="true">${D2T.cards.player(p, { w: 64, mini: true, shine: false })}</div>`);
            host.appendChild(ghost);
            drawPitch();
          } else {
          if (!placing) enterPlacing(true);
          drag.moved = true;
          if (api.selected() !== drag.i) api.select(drag.i);
          const p = api.results()[drag.i];
          ghost = D2T.h(`<div class="se-ghost" aria-hidden="true">${D2T.cards.player(p, { w: 64, mini: true, shine: false })}</div>`);
          host.appendChild(ghost);
          drawPitch(draft ? di.slot : GAME.bestSlot(p.id));
          }
        }
        if (e.cancelable) e.preventDefault();
        const hr = host.getBoundingClientRect();
        ghost.style.transform = `translate(${e.clientX - hr.left - 32}px,${e.clientY - hr.top - 58}px) rotate(-4deg) scale(1.08)`;
        const under = document.elementFromPoint(e.clientX, e.clientY);
        let t = under && under.closest('.tr-field .se-cardwrap');
        if (!t && under) { const sl = under.closest('.tr-field .se-slot'); t = sl && sl.querySelector('.se-cardwrap'); }
        if (t !== target) {
          target && target.classList.remove('se-target'); target = t; target && target.classList.add('se-target');
          if (t) { try { const who = drag.pitch != null ? GAME.lineup().xi[drag.pitch] : api.results()[drag.i]; const f = GAME.fit(who.id, +t.dataset.i); SND.play('shirtFit', { green: 0, amber: 1, red: 2 }[f]); } catch (e) { /* no fit, no sound */ } }
        }
      };
      const onUp = (e) => {
        if (!drag || e.pointerId !== drag.pid) return;
        const d = drag; drag = null;
        if (!d.moved) return;
        if (d.pitch != null) {
          suppressPitch = true;
          const t = target; endDrag(false);
          if (t && +t.dataset.i !== d.pitch) moveTo(d.pitch, +t.dataset.i); else { mover = -1; drawPitch(); SND.play('dropCancel'); }
          return;
        }
        suppress = d.i;
        const t = target; endDrag(false);
        if (t) sign(d.i, +t.dataset.i); else SND.play('dropCancel');
      };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', () => { if (drag && drag.pitch != null && drag.moved) { mover = -1; drawPitch(); } drag = null; endDrag(false); });
      root.addEventListener('pointerdown', onDown);
      // a drag is not a tap: swallow the click that follows it (a touch drag has none, so the next press clears it)
      root.addEventListener('click', (e) => {
        if ((suppress >= 0 && e.target.closest('.sp-slot')) || (suppressPitch && e.target.closest('.tr-field'))) { e.stopPropagation(); e.preventDefault(); }
        suppress = -1; suppressPitch = false;
      }, true);
      // tap off the cards to let go (after the drag guard above, so a drag's own click never lands here)
      root.addEventListener('click', (e) => {
        if (!placing || signing) return;
        const t = e.target;
        if (t.closest('.se-cardwrap, .sp-slot, .se-formlink, button, .game-bar, .sheet, .topbar, .se-news')) return;
        if (!t.closest('.tr-pitch, .sp-stage, .sp-hint')) return;
        deselect();
      });
      const blockTouch = (e) => { if (drag && drag.moved && e.cancelable) e.preventDefault(); };
      window.addEventListener('touchmove', blockTouch, { passive: false });
      const prevKill = kill;
      kill = () => { prevKill(); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('touchmove', blockTouch); };

      // the roll header before the spin (Craig, 14 Oct): the season's track of rolls, "Transfer 7 of 17", and in the
      // Summer and January windows a banner with the window's three rolls. The accent is the mode's colour.
      const head = draft ? null : (() => {
        const track = GAME.rollTrack(), w = GAME.eng().rolls[GAME.eng().rollIx], kind = w && w.kind;
        const acc = (D2T.modeWord() || [0, '#12F06C'])[1];
        const segs = track.map((t) => `<i class="tr-seg is-${t.state}${t.kind === 'pre' || t.kind === 'jan' ? ' is-win' : ''}"></i>`).join('');
        const labels = [];
        let at = 0;
        GAME.eng().rolls.forEach((r) => { if (r.kind === 'pre' || r.kind === 'jan') labels.push(`<span style="grid-column:${at + 1} / span ${r.n}">${r.kind === 'pre' ? 'Summer' : 'January'}</span>`); at += r.n; });
        const cols = `grid-template-columns:repeat(${track.length},minmax(0,1fr))`;
        const top = `<div class="tr-track" aria-hidden="true"><div class="tr-segs" style="${cols}">${segs}</div>${labels.length ? `<div class="tr-wins" style="${cols}">${labels.join('')}</div>` : ''}</div>`;
        const win = kind === 'pre' ? 'Summer' : kind === 'jan' ? 'January' : '';
        const banner = win ? `<div class="tr-banner"><span class="tr-banner-t"><small>The ${win} window is open</small><b>${win} window</b></span>
          <span class="tr-banner-r"><span class="tr-dots">${Array.from({ length: info.of }, (_, k) => `<i${k < info.step ? ' class="is-on"' : ''}></i>`).join('')}</span><span>${info.step} of ${info.of}</span></span></div>` : '';
        return { top, banner, style: `--tr-acc:${acc}` };
      })();
      // the team rating ticks up after a signing (Craig, 31 Oct, build 196): an odometer from the old rating to the new,
      // a chip with the change popping up above the box, and a soft glow in the accent while it rolls
      let lastRating = null;
      function rateTo(v) {
        if (lastRating === v) return;
        const was = lastRating; lastRating = v;
        const MO = D2T.mo;
        if (was == null || !MO || MO.still()) { ratingEl.textContent = v; return; }
        MO.odometer(ratingEl, v, { from: was, dur: 800 });
        const box = ratingEl.closest('.se-rating'); if (!box) return;
        const acc = getComputedStyle(box).getPropertyValue('--se-acc').trim() || '#12F06C';
        const glow = document.createElement('i'); glow.className = 'mo-glow'; glow.style.setProperty('--g', acc); box.appendChild(glow);
        const ga = MO.anim(glow, [{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration: 800, easing: 'ease-out' });
        if (ga) ga.finished.catch(() => {}).then(() => glow.remove()); else glow.remove();
        const d = v - was, chip = document.createElement('span');
        chip.className = 'mo-chip'; chip.textContent = (d > 0 ? '+' : '') + d; box.appendChild(chip);
        chip.animate([{ transform: 'translate(-50%, 10px) scale(.6)', opacity: 0 }, { transform: 'translate(-50%, 0) scale(1)', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' });
        const t = setTimeout(() => chip.animate([{ transform: 'translate(-50%, 0)', opacity: 1 }, { transform: 'translate(-50%, -12px)', opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {}).then(() => cm.finish()), 1600);
        const cm = MO.track({ finish() { clearTimeout(t); chip.remove(); MO.untrack(cm); } });
      }
      // each roll steps the season bar on (build 196): the last roll's segment settles to done, this one fills left to
      // right with a white leading edge and then glows slowly, and "Transfer N" rolls up from N-1
      function stepOn() {
        const MO = D2T.mo; if (!MO || MO.still()) return;
        const segs = [...body.querySelectorAll('.tr-seg')], ci = segs.findIndex((s) => s.classList.contains('is-current'));
        if (ci < 0) return;
        const cur = segs[ci], prev = ci > 0 && segs[ci - 1].classList.contains('is-done') ? segs[ci - 1] : null;
        const acc = getComputedStyle(cur).getPropertyValue('--tr-acc').trim() || '#12F06C';
        if (prev) { const was = document.createElement('i'); was.className = 'tr-segwas'; prev.appendChild(was); const wa = MO.anim(was, [{ opacity: 1 }, { opacity: 0 }], { duration: 350, easing: 'ease-out' }); if (wa) wa.finished.catch(() => {}).then(() => was.remove()); else was.remove(); }
        cur.classList.add('tr-fill');
        const fill = document.createElement('i'); fill.className = 'tr-segfill'; cur.appendChild(fill);
        MO.anim(fill, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 450, delay: 450, easing: 'ease-in-out', fill: 'backwards' });
        const b = body.querySelector('.sp-kicker b'), n = b ? +b.textContent : 0;
        if (b && n > 1) MO.odometer(b, n, { from: n - 1, delay: 450, dur: 450 });
      }
      const build = () => {
        api = D2T.roll.mount(body, {
          kicker: draft ? `${GAME.modeName()} draft · Shirt ${info.step} of ${info.of}` : `Transfer <b>${info.overall}</b> of ${info.total}`,
          headTop: head ? head.top : '', headBanner: head ? head.banner : '', headCls: head ? 'tr-rollhead' : '', headStyle: head ? head.style : '',
          title: draft ? (di.open ? 'Pick your next player' : `Pick your ${ROLE[di.broad]}`) : 'Who comes in?',
          sub: draft ? (di.open ? `Three players from ${run.season} for your open shirts. Each one is green in at least one of them. Put him in any open shirt, and change the shape whenever you like. No respins in the draft.` : `Three ${ROLES[di.broad]} from ${run.season} for your ${di.pos} shirt. No respins in the draft.`) : `${fx ? `Before GW${info.gw} against ${opp}. ` : ''}Sign one or pass.`,
          pool: fillerCards(),
          render: (p, w) => D2T.cards.player(p, { w }),
          pick: () => { SND.play('roll3'); return GAME.rollCards(); },
          settled: st.spun === rollKey ? GAME.rollCards() : null,
          // a purple or legend card gets the rare reveal (screens/reveal.js); the roll counts as spun as it starts
          rare: (p) => D2T.rareReveal.isRare(p),
          // the positions he is green in, under each card, revealed with it as its reel lands (Craig, 15 and 16 Oct)
          below: (p) => { const list = p.main ? [p.main, ...(p.alt || [])] : [p.pos]; const tags = GAME.rollTags(), ti = tags ? GAME.rollCards().findIndex((c) => c.id === p.id) : -1, tag = ti >= 0 ? tags[ti] : null; return `<div class="sp-gp sp-below" aria-label="Green in ${list.join(', ')}${tag ? tag === 'better' ? ', better than the man in the shirt' : ', the next best there' : ''}">${list.join('<i>/</i>')}${tag === 'next' ? '<span class="sp-tag is-next">Next best</span>' : ''}</div>`; },
          onCommit: () => { st.spun = `${GAME.eng().roll.key}.${GAME.eng().roll.spin}`; D2T.save(); },
          onSettled: () => { leaving = false; st.spun = `${GAME.eng().roll.key}.${GAME.eng().roll.spin}`; D2T.save(); timers.push(setTimeout(() => enterPlacing(true), reduced ? 0 : 450)); },
          accent: LV_ACCENT,
          landSound: (i, p) => SND.play('rarity', LV_IDX(p)),
          bigIndex: (rs) => { let b = -1; (rs || []).forEach((p, i) => { if (LV_IDX(p) >= 3 && (b < 0 || LV_IDX(p) >= LV_IDX(rs[b]))) b = i; }); return b; },
          details: (p) => D2T.cards.info(p), detailsBare: true,
          mainLabel: 'Spin', pickLabel: draft ? 'Pick one' : 'Pass', spinningLabel: 'Rolling',
          selectedLabel: (p) => (draft ? `Sign ${surname(p.name)}` : 'Pass'),
          hintIdle: 'Hit Spin to roll three players', hintSettled: '', hintSelected: 'Tap a shirt to sign him there, or tap him again for his card',
          respins: draft ? null : eng.respins,
          baseBtn: { accent: club.accent, ink: club.ink },
          onRespinsChange: () => { GAME.respinCards(); st.spun = ''; D2T.save(); },
          respinChoice: draft ? null : respinChoice,
          beforeSpin: () => leavePlacing(),
          onSelect: (i, p) => { mover = -1; if (placing) drawPitch(draft ? di.slot : GAME.bestSlot(p.id)); timers.push(setTimeout(() => api && D2T.tip('card-again', api.el.querySelectorAll('.sp-slot')[i], 'Tap him again for his career'), 250)); },
          afterSettle: draft ? null : { label: 'Pass', onClick: pass },
          onConfirm: (p) => { if (draft) sign(api.results().indexOf(p), di.open ? GAME.draftFits(p.id)[0] : di.slot); }
        });
        api.el.classList.add('sp-reveal');
        if (st.spun !== rollKey) stepOn();
        buildPitch();
        if (st.spun === rollKey) enterPlacing(false);
      };
      // the January raid (Craig, 19 Oct): as the window opens a top-half club has taken one of yours; say so once
      const jr = !draft && GAME.janRaid(), janDue = !!(jr && jr.gw === eng.gw && !st.janSeen);
      // the show plays on the pitch first (not with reduced motion, and only while his shirt is still empty)
      const janShow = janDue && !reduced && !!jr.card && eng.xi[jr.slot] == null;
      let janShown = false;
      // the raid comes before the window's first spin (Craig, 23 Oct: the sheet, then the raid, then the spin): the pitch
      // shows on its own, the badge takes him, the "January raid" sheet, and closing it goes back to Spin
      const preRaid = janShow && st.spun !== rollKey;
      // Craig, 25 Oct: straight to the pitch (no emblem burst, no empty cards), the "January window" sheet over it, then a
      // second after it closes the raid; a second after the badge takes him, the "January raid" sheet
      let raidPitch = false;
      function raidFirst(then) {
        if (!alive || raidPitch) return;
        if (!api || !slotsEl) { timers.push(setTimeout(() => raidFirst(then), 60)); return; }
        raidPitch = true;
        janBack = { slot: jr.slot, card: jr.card };   // he is still yours until the badge takes him
        root.classList.add('rd-busy');
        api.el.classList.add('is-placing', 'tr-preraid');
        const sub = field.querySelector('.tr-head-t > span'); if (sub) { sub.dataset.was = sub.textContent; sub.textContent = 'A top-half side is coming in for one of yours'; }
        drawPitch();
        if (!reduced) field.animate([{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
        then && then();
      }
      function raidGo() { if (!alive || janShown) return; janShown = true; playJanRaid(1000); }
      function raidDone() {
        if (!preRaid || !alive || !api) return;
        const hint = api.el.querySelector('.sp-hint');
        if (janNews) { janNews.stop(); janNews.el.remove(); janNews = null; }
        if (hint) hint.style.display = '';
        const go = () => { api.el.classList.remove('is-placing', 'tr-preraid'); api.hint('Hit Spin to roll three players'); const sub = field.querySelector('.tr-head-t > span'); if (sub && sub.dataset.was) sub.textContent = sub.dataset.was; };
        if (reduced) return go();
        field.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).onfinish = () => { go(); field.getAnimations().forEach((x) => x.cancel()); };
      }
      // the emblem burst opens each window and the draft, not every one of the 11 draft spins
      if (st.spun === rollKey || (draft && di.step > 1) || preRaid) build();
      else intr = intro(body, () => { intr = null; build(); });
      function janSheet(delay) {
        const el = D2T.h(`<div class="se-poach-sum"><p class="se-note">${D2T.esc(jr.club)} came in for ${D2T.esc(jr.name)} as the window opened. His shirt is empty for your January rolls; if it is still empty when the window closes, a free agent fills it.</p>
          <ul><li>${jr.crest ? `<img src="${jr.crest}" alt="">` : ''}<b>${D2T.esc(jr.name)}</b><span>to ${D2T.esc(jr.club)}</span></li></ul>
          <button class="btn se-btn se-poach-go" type="button">Continue</button></div>`);
        timers.push(setTimeout(() => {
          if (!alive) return;
          if (!janShow) SND.play('playerOut');
          const sh = D2T.sheet({ title: 'January raid', body: el, onClose: () => { st.janSeen = true; D2T.save(); raidDone(); } });
          sh.el.classList.add('se-run', 'se-poach-sheet');
          ['--se-acc', '--se-ink', '--se-text', '--se-acc-a', '--se-acc-b'].forEach((v) => sh.el.style.setProperty(v, root.style.getPropertyValue(v)));
          el.querySelector('.se-poach-go').onclick = () => sh.close();
        }, delay));
      }
      if (janDue && !janShow) janSheet(600);
      // the window opens (Craig, 20 Oct): before the first January roll is spun, a sheet says players go out as well as in
      const windowSheet = () => {
        if (!alive) return;
        const el = D2T.h(`<div class="se-poach-sum"><p class="se-note">The January window is open. Players go out as well as come in: a top-half side comes in for one of yours as it opens, then you have three January rolls to put things right.</p>
          <button class="btn se-btn se-poach-go" type="button">Continue</button></div>`);
        const sh = D2T.sheet({ title: 'January window', body: el, onClose: () => { st.janIntro = true; D2T.save(); if (preRaid) raidGo(); } });
        tint(sh);
        el.querySelector('.se-poach-go').onclick = () => sh.close();
      };
      if (preRaid) raidFirst(() => timers.push(setTimeout(() => { if (st.janIntro) raidGo(); else windowSheet(); }, st.janIntro ? 0 : 450)));
      else if (janDue && !st.janIntro && st.spun !== rollKey) timers.push(setTimeout(windowSheet, 600));
    },
    unmount() { kill && kill(); kill = null; intr && intr.cancel(); intr = null; api && api.unmount(); api = null; }
  });
})();
