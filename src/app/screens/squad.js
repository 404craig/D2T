// Squad and tactics. Pitch with mini cards in formation, formation sheet, a carousel underneath, tap and drag swaps.
// Before the season the carousel holds the whole real squad. Once the season starts it's just your 11; new players
// are signed straight onto the pitch from the transfer roll (screens/transfer.js).
(function () {
  const D2T = window.D2T, SE = D2T.se, GAME = D2T.game;
  const PITCH_W = 50; // the bench cards are the roll's full cards (Craig, 15 Oct), positions in grey under each: as they
  // roll in (114 wide) on taller phones, smaller (80) on short ones such as 375 x 667 so the bench and its positions fit
  const subW = () => (window.innerHeight < 760 ? 80 : 114);
  const ROLE_NAME = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' };
  const last = (n) => n.split(' ').slice(-1)[0];
  const idOf = (s) => (/^\d+$/.test(String(s)) ? +s : s);   // player ids are numbers; legend ids are text

  const pitchLines = SE.pitchLines;

  D2T.screen('squad', {
    title: 'Squad', theme: 'black',
    mount(root) {
      const ctx = SE.ensure(), st = ctx.st, data = ctx.data, club = data.club;
      const eng = GAME.eng();
      SE.accent(root, club); SE.setStep(ctx, 'squad');
      const reduced = D2T.reduced();
      const pre = GAME.preseason(), drafting = GAME.inDraft(), dream = GAME.isDraftMode();
      root.appendChild(D2T.topbar());
      const gwLabel = drafting ? 'Draft your XI' : pre ? 'Pre-season' : `Gameweek ${Math.min(eng.gw, data.fixtures.length)}`;
      const hist = data.table.find((r) => r.name === club.name);
      const goalLabel = drafting ? '' : GAME.mode() !== 'classic' && hist ? ` · Target ${hist.pos === 1 || GAME.mode() === 'clubx' ? 'champions' : D2T.ordinal(GAME.target(hist.pos))}` : '';
      const body = D2T.h(`<div class="screen-body se-squad">
        <div class="se-sqhead">
          <img class="se-sqcrest" src="${club.crest}" alt="">
          <div class="se-sqtext"><div class="se-sqname">${D2T.esc(club.name)}</div><div class="se-sqsub">${data.season} · ${gwLabel}${goalLabel}</div></div>
          <div class="se-rating" aria-live="polite"><b class="se-rating-n">0</b><i>Team<br>rating</i></div>
        </div>
        <div class="se-lines-host"></div>
        <div class="se-pitch">${pitchLines}<div class="se-slots"></div><button class="se-formlink" type="button"><b class="se-fname"></b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>${SE.tacticChip()}</div>
        <div class="se-subshead"><span class="se-subs-t"></span><span class="se-hint" aria-live="polite"></span></div>
        <div class="se-subs" role="list" aria-label="Squad"></div>
      </div>`);
      root.appendChild(body);

      // ---------- the fixed bar: next fixture and the way on ----------
      const fx = SE.fixture(data, pre || drafting ? 1 : eng.gw);
      const oppC = fx ? SE.club(data, fx.opp) : null;
      const nextHTML = fx ? `<div class="se-next"><img src="${oppC.crest}" alt=""><div class="se-next-t"><small>Next · ${fx.ha === 'H' ? 'Home' : 'Away'}</small><b class="d2c-fit">${D2T.esc(oppC.name)}</b></div></div>` : '';
      const carried = GAME.mode() === 'clubx' && GAME.career().n > 1;   // a Club X career's later seasons have pre-season rolls
      // mid-season the squad is only reached from the fixtures' back arrow (Craig, 14 Oct), so its way on is the fixtures
      const label = drafting ? 'Start the draft' : pre ? (dream && !carried ? 'Start the season' : 'Transfer window') : 'Fixtures';
      // every squad bar (Craig, 13 Oct): home, then a greyed middle button (nowhere to go back to and no respin here; before
      // the draft it is the greyed respin the draft's own bar shows, as the draft has none), then Play across the right
      // mid-season (reached by the fixtures' back arrow) the middle button is a back arrow to the fixtures
      const mid = !pre && !drafting;
      const bar = D2T.h(SE.bar({ cls: 'se-nextbar', mid: drafting ? SE.respinOff() : mid ? SE.backBtn('Back to fixtures') : SE.backOff(), main: SE.mainBtn(label, 'se-play') }));
      root.appendChild(bar);
      if (mid) bar.querySelector('.se-back').onclick = () => { st.step = 'fixtures'; D2T.save(); D2T.go('fixtures'); };
      const playBtn = bar.querySelector('.se-play');
      playBtn.onclick = () => {
        if (drafting) { st.step = 'transfer'; D2T.save(); D2T.go('transfer'); return; }
        if (pre) { GAME.startSeason(); D2T.go(GAME.eng().phase === 'window' ? 'transfer' : 'fixtures'); return; }
        if (eng.phase === 'window') { D2T.go('transfer'); return; }
        st.step = 'fixtures'; D2T.save(); D2T.go('fixtures');
      };

      const slotsEl = body.querySelector('.se-slots'), subsEl = body.querySelector('.se-subs');
      const hintEl = body.querySelector('.se-hint'), ratingEl = body.querySelector('.se-rating-n');
      let L = null, sel = null, shownRating = 0;

      // ---------- render ----------
      const allItems = () => [...root.querySelectorAll('[data-card]')];
      function render(before) {
        L = GAME.lineup();
        const slots = GAME.slots(), away = GAME.poachedSlots();
        slotsEl.innerHTML = slots.map((s, i) => {
          const c = L.xi[i];
          if (!c) return `<div class="se-slot" style="left:${s.x}%;top:${s.y}%;z-index:${Math.round(s.y)}" data-i="${i}">${SE.emptyShirt(s.pos, PITCH_W, away[i])}</div>`;
          const fit = GAME.fit(c.id, i), oop = fit !== 'green';
          return `<div class="se-slot${oop ? ' se-oop' : ''}" style="left:${s.x}%;top:${s.y}%;z-index:${Math.round(s.y)}" data-i="${i}">
            <div class="se-cardwrap" data-card="${c.id}" data-kind="pitch" data-i="${i}" role="button" tabindex="0" aria-label="${D2T.esc(c.name)}, ${c.ovr}, playing ${s.pos}${oop ? ', out of position' : ''}">
              ${D2T.cards.player(c, { w: PITCH_W, mini: true, shine: false, tab: s.pos, cls: 'fit-' + fit, dots: (GAME.settling(c.id) || {}).left })}</div></div>`;
        }).join('');
        // your three lines (Craig, 18 Oct) and the tactic on its chip; neither in the draft before a shirt is filled
        body.querySelector('.se-lines-host').innerHTML = L.xi.some(Boolean) ? SE.lineBars() : '';
        body.querySelector('.se-tname').textContent = GAME.tacticName();
        const sl = subsEl.scrollLeft;
        subsEl.innerHTML = L.subs.map((c) => `<div class="se-sub" role="listitem"><div class="se-cardwrap" data-card="${c.id}" data-kind="sub" role="button" tabindex="0" aria-label="${D2T.esc(c.name)}, ${c.ovr}, ${ROLE_NAME[c.pos]}, in the squad">${D2T.cards.player(c, { w: subW(), shine: false })}</div><div class="se-sub-pos" aria-hidden="true">${(c.main ? [c.main, ...(c.alt || [])] : [c.pos]).join('<i>/</i>')}</div></div>`).join('');
        subsEl.scrollLeft = sl;
        body.querySelector('.se-fname').textContent = GAME.eng().formation;
        const showSubs = L.subs.length > 0;
        body.querySelector('.se-subshead').style.display = showSubs || (pre && !dream) ? '' : 'none';
        subsEl.style.display = showSubs ? '' : 'none';
        let gone = body.querySelector('.se-gone');
        const goneText = drafting ? (GAME.mode() === 'clubx' ? 'Pick your shape, then start the draft: 11 spins, three players each time for any of your open shirts, in any order. Each goes in a shirt he plays. No respins.' : 'Pick your shape, then start the draft: 11 spins, one per shirt (keeper first, then defence, midfield and attack). Three players each time, no respins.')
          : carried && pre ? `${GAME.isSim() ? "Last season's XI comes with you, on the same cards, which age: 3 a season after the first." : "Last season's XI, each on his card for this season (a man with no Premier League season now keeps his old one, and it ages: 3 a season after the first)."} Swap shirts or change the shape, then pre-season: 3 rolls before the first game, and 5 respins for the season.`
          : dream && pre ? 'Your drafted XI. Swap shirts or change the shape, then start the season. Your 5 respins are for the transfer rolls during the season.'
          : 'The rest of the squad has gone. New faces only come through the transfer rolls, and each one takes a shirt from your XI.';
        if (!showSubs && (!pre || dream) && !gone) { gone = D2T.h(`<p class="se-note se-gone">${goneText}</p>`); subsEl.after(gone); }
        if (gone) gone.style.display = showSubs || (pre && !dream) ? 'none' : '';
        body.querySelector('.se-subs-t').textContent = `Squad · ${L.subs.length}`;
        setRating(GAME.rating());
        if (before) animateMoves(before);
        applySel();
      }
      function setRating(v) {
        if (reduced || shownRating === v) { ratingEl.textContent = v; shownRating = v; return; }
        const from = shownRating || v - 12, t0 = performance.now(), dur = shownRating ? 500 : 900;
        shownRating = v;
        const step = (now) => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); ratingEl.textContent = Math.round(from + (v - from) * e); if (p < 1 && root.isConnected) requestAnimationFrame(step); };
        requestAnimationFrame(step);
        ratingEl.parentElement.classList.remove('se-bump'); void ratingEl.offsetWidth; ratingEl.parentElement.classList.add('se-bump');
      }
      // Cards that changed place fly from where they were (clones in an overlay, so nothing clips them).
      function animateMoves(before) {
        if (reduced) return;
        const host = document.getElementById('app'), hr = host.getBoundingClientRect();
        allItems().forEach((el) => {
          const b = before.get(el.dataset.card), a = el.getBoundingClientRect();
          if (!b) { el.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.3,1.4,.5,1)' }); return; }
          if (Math.abs(b.left - a.left) < 1 && Math.abs(b.top - a.top) < 1 && Math.abs(b.width - a.width) < 1) return;
          if (a.right < hr.left || a.left > hr.right) return; // off-screen in the carousel
          const clone = el.cloneNode(true);
          clone.classList.remove('se-sel', 'se-target', 'se-dragsrc');
          clone.removeAttribute('data-card');
          clone.style.cssText = `position:absolute;left:${a.left - hr.left}px;top:${a.top - hr.top}px;width:${a.width}px;height:${a.height}px;margin:0;z-index:35;pointer-events:none;transform-origin:0 0`;
          host.appendChild(clone);
          el.style.visibility = 'hidden';
          const s = b.width / a.width;
          const anim = clone.animate([
            { transform: `translate(${b.left - a.left}px,${b.top - a.top}px) scale(${s})` },
            { transform: `translate(${(b.left - a.left) * 0.45}px,${(b.top - a.top) * 0.45 - 18}px) scale(${(s + 1) / 2 * 1.08})`, offset: 0.5 },
            { transform: 'none' }
          ], { duration: 560, easing: 'cubic-bezier(.45,0,.25,1)' });
          const end = () => { clone.remove(); el.style.visibility = ''; };
          anim.onfinish = end; anim.oncancel = end;
        });
      }

      // ---------- selection ----------
      const nameOf = (id) => { const c = L.all.get(String(id)); return c ? c.name : ''; };
      function applySel() {
        root.querySelectorAll('.se-sel').forEach((n) => n.classList.remove('se-sel'));
        slotsEl.classList.toggle('se-armed', !!sel);
        if (sel) {
          const el = root.querySelector(`[data-kind="${sel.kind}"][data-card="${sel.id}"]`);
          if (el) el.classList.add('se-sel'); else sel = null;
        }
        const nm = sel ? last(nameOf(sel.id)) : '';
        if (!sel) hintEl.textContent = pre ? 'Tap to select, drag onto the pitch' : '';
        else hintEl.textContent = sel.kind === 'sub' ? `Tap a player to bring on ${nm}` : `Tap a player to swap with ${nm}`;
        if (!pre) bar.dataset.hint = sel ? `Tap a player to swap with ${nm}` : '';
        markFit(sel ? sel.id : null);
      }
      // A card on the pitch shows the shirt it is in on its tab, coloured by fit (green preferred, amber near, red out of
      // position). While a player is selected or dragged, every shirt gets a ring in how he would fit it (Craig, 13 Oct).
      function markFit(id) {
        const card = id == null ? null : L.all.get(String(id)), slots = GAME.slots();
        slotsEl.querySelectorAll('.se-slot').forEach((sl) => {
          sl.classList.remove('se-pf-green', 'se-pf-amber', 'se-pf-red');
          if (!card) return;
          sl.classList.add('se-pf-' + GAME.fit(card.id, +sl.dataset.i));
        });
      }
      function select(kind, id) { sel = { kind, id }; applySel(); }
      function clearSel() { sel = null; applySel(); }
      function openBig(el, id) {
        const card = L.all.get(String(id)); if (!card) return;
        const W = Math.min(236, Math.round(root.clientWidth * 0.6));
        D2T.cards.openLarge(el.querySelector('.d2c') || el, D2T.cards.player(card, { w: W }), { w: W, below: D2T.cards.info(card), scroll: true });
      }

      // ---------- swaps ----------
      function swap(a, b, ghostRect) { // a, b: { kind, id }
        if (a.kind === 'sub' && b.kind === 'sub') return;
        const before = new Map(allItems().map((el) => [el.dataset.card, el.getBoundingClientRect()]));
        if (ghostRect) before.set(String(a.id), ghostRect);
        if (!GAME.swap(idOf(a.id), idOf(b.id))) return;
        window.D2TSound && window.D2TSound.play('cardDrop');
        sel = null;
        render(before);
      }

      // ---------- taps ----------
      function tap(item) {
        const kind = item.dataset.kind, id = item.dataset.card;
        if (sel && sel.kind === kind && sel.id === id) { openBig(item, id); return; }
        if (sel && !(sel.kind === 'sub' && kind === 'sub')) { swap(sel, { kind, id }); return; }
        select(kind, id);
      }
      root.addEventListener('keydown', (e) => { const it = e.target.closest && e.target.closest('[data-card]'); if (it && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tap(it); } });

      // ---------- pointer: tap or drag (touch and mouse) ----------
      let press = null, ghost = null, target = null;
      const host = document.getElementById('app');
      const onDown = (e) => {
        if (e.button) return;
        const item = e.target.closest('[data-card]');
        if (!item || !root.contains(item)) { if (sel && !e.target.closest('.se-formlink, .actionbar, .topbar')) clearSel(); return; }
        press = { item, kind: item.dataset.kind, id: item.dataset.card, x0: e.clientX, y0: e.clientY, id2: e.pointerId, type: e.pointerType, dragging: false };
      };
      const onMove = (e) => {
        if (!press || e.pointerId !== press.id2) return;
        const dx = e.clientX - press.x0, dy = e.clientY - press.y0;
        if (!press.dragging) {
          if (press.kind === 'sub' && press.type !== 'mouse') {
            // in the carousel a sideways swipe scrolls; an upward pull lifts the card
            if (dy < -10 && Math.abs(dy) > Math.abs(dx) * 1.1) startDrag(e);
            else if (Math.abs(dx) > 12) press = null;
          } else if (Math.hypot(dx, dy) > 8) startDrag(e);
          return;
        }
        e.preventDefault();
        moveGhost(e.clientX, e.clientY);
      };
      const onUp = (e) => {
        if (!press || e.pointerId !== press.id2) return;
        const p = press; press = null;
        if (p.dragging) drop(p, e.clientX, e.clientY); else tap(p.item);
      };
      const onCancel = (e) => { if (!press || e.pointerId !== press.id2) return; const p = press; press = null; if (p.dragging) drop(p, null, null); };

      function startDrag(e) {
        press.dragging = true;
        const card = L.all.get(press.id), w = 70;
        const hr = host.getBoundingClientRect();
        ghost = D2T.h(`<div class="se-ghost" aria-hidden="true">${D2T.cards.player(card, { w, mini: true, shine: false })}</div>`);
        ghost._hr = hr; ghost._w = w; ghost._h = w * 1.2;
        host.appendChild(ghost);
        press.item.classList.add('se-dragsrc');
        root.classList.add('se-dragging');
        subsEl.style.overflowX = 'hidden';
        sel = null; applySel(); markFit(press.id);
        moveGhost(e.clientX, e.clientY);
        hintEl.textContent = 'Drop on a player to swap';
      }
      function moveGhost(x, y) {
        const hr = ghost._hr;
        ghost.style.transform = `translate(${x - hr.left - ghost._w / 2}px,${y - hr.top - ghost._h * 0.62}px) rotate(-4deg) scale(1.08)`;
        const under = document.elementFromPoint(x, y);
        let t = under && under.closest('[data-card]');
        if (t && (!root.contains(t) || t.dataset.card === press.id || (press.kind === 'sub' && t.dataset.kind === 'sub'))) t = null;
        if (!t && under && press.kind === 'sub') { const slot = under.closest('.se-slot'); t = slot && slot.querySelector('[data-card]'); }
        if (t !== target) {
          target && target.classList.remove('se-target'); target = t; target && target.classList.add('se-target');
          const sl = t && t.closest('.se-slot'), card = L.all.get(String(press.id));
          if (sl && card && window.D2TSound) { try { window.D2TSound.play('shirtFit', { green: 0, amber: 1, red: 2 }[GAME.fit(card.id, +sl.dataset.i)]); } catch (e) { /* no fit, no sound */ } }
        }
      }
      function drop(p, x, y) {
        const g = ghost, t = target; ghost = null; target = null;
        root.classList.remove('se-dragging');
        subsEl.style.overflowX = '';
        p.item.classList.remove('se-dragsrc');
        t && t.classList.remove('se-target');
        markFit(null);
        if (!g) return;
        const gr = g.querySelector('.d2c').getBoundingClientRect();
        if (t && x != null) {
          g.remove();
          swap({ kind: p.kind, id: p.id }, { kind: t.dataset.kind, id: t.dataset.card }, gr);
          return;
        }
        // no target: the card drops back to where it came from
        window.D2TSound && window.D2TSound.play('dropCancel');
        const back = p.item.getBoundingClientRect(), hr = g._hr;
        if (reduced || !p.item.isConnected) { g.remove(); applySel(); return; }
        const anim = g.animate([{ transform: g.style.transform }, { transform: `translate(${back.left - hr.left}px,${back.top - hr.top}px) scale(${back.width / g._w})` }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
        anim.onfinish = () => { g.remove(); applySel(); };
      }
      const blockTouch = (e) => { if (press && press.dragging) e.preventDefault(); };
      root.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('touchmove', blockTouch, { passive: false });
      this._off = () => {
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel); window.removeEventListener('touchmove', blockTouch);
        ghost && ghost.remove();
      };

      // ---------- formation sheet ----------
      body.querySelector('.se-formlink').onclick = () => {
        let pending = GAME.eng().formation;
        const tile = (k) => `<button class="se-formcard${k === pending ? ' is-on' : ''}" type="button" data-f="${k}" aria-pressed="${k === pending}">
          <span class="se-fpitch"><span class="se-fline"></span>${GAME.formationDots(k).map((s) => `<i style="left:${s.x}%;top:${s.y}%"></i>`).join('')}</span><b>${k}</b></button>`;
        const note = drafting ? 'The draft fills this shape shirt by shirt. It is fixed once you make your first pick, then you can change it again before the season.'
          : pre && !dream ? 'Your best XI from the squad is picked for the shape you choose. You can still swap anyone after.' : 'Your 11 are moved into the new shape. Players out of their position play at 90% (near) or 70% (wrong).';
        const el = D2T.h(`<div><div class="se-formgrid">${GAME.formations().map(tile).join('')}</div><p class="se-note">${note}</p><button class="btn se-btn se-done" type="button">Done</button></div>`);
        const sh = D2T.sheet({
          title: 'Formation', body: el,
          onClose: () => {
            if (pending === GAME.eng().formation) return;
            const before = new Map(allItems().map((n) => [n.dataset.card, n.getBoundingClientRect()]));
            GAME.setFormation(pending);
            window.D2TSound && window.D2TSound.play('formation');
            sel = null;
            render(before);
          }
        });
        sh.el.classList.add('se-run');
        ['--se-acc', '--se-ink', '--se-text', '--se-acc-a', '--se-acc-b'].forEach((v) => sh.el.style.setProperty(v, root.style.getPropertyValue(v)));
        el.querySelectorAll('.se-formcard').forEach((b) => {
          b.onclick = () => {
            pending = b.dataset.f;
            el.querySelectorAll('.se-formcard').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on); });
          };
        });
        el.querySelector('.se-done').onclick = () => sh.close();
      };

      // ---------- tactics sheet (Craig, 18 Oct) ----------
      body.querySelector('.se-taclink').onclick = () => { SE.tacticSheet(root, () => { sel = null; render(null); }); };

      render(null);

      // ---------- Poached (Craig, 14 Oct; option B in design/prototype/clubx-raid.html) ----------
      // A Club X career's later seasons: three of the XI are taken by other sides before the Summer window. The first time
      // (GAME.poachDue) each one in turn: the rival's crest drops in above him, a line shoots down, he wobbles and is reeled
      // up into the crest, which flies off with him; his shirt is left empty with the crest and "TO {CLUB}". A news ticker
      // across the bottom carries each move as it happens and stays until you go on to the Summer window; then a summary
      // sheet. The engine decides it as the sequence starts, so a refresh shows the end state. Reduced motion: the end
      // state, the headlines standing still, and the summary at once.
      let ticker = null, poachKill = null;
      const poachDue = pre && carried && GAME.poachDue();
      if (pre && carried && (poachDue || GAME.poached().length)) {
        ticker = makeTicker();
        const list = poachDue ? GAME.poach() : GAME.poached();
        if (poachDue) render(null);
        if (poachDue && !reduced) runPoach(list);
        else {                                                    // reduced motion, or a refresh before the summary was seen
          if (list.length) ticker.add(list[list.length - 1]);
          if (!st.poachSeen) { const t = setTimeout(() => root.isConnected && poachSummary(list), 300); poachKill = () => clearTimeout(t); }
        }
      }
      // the Transfer News bar (Craig, 14 Oct; news() in design/prototype/clubx-poached.html): centred in the empty space
      // between the pitch and the bottom bar, one headline at a time right after the pill; a new one replaces the last at
      // once (a quick fade up); it only scrolls, slowly left and back, if it is too long to fit (never with reduced motion)
      function makeTicker() {
        const el = D2T.h('<div class="se-ticker" role="status" aria-label="Transfer news"><b class="se-tk-tag">Transfer news</b><div class="se-tk-view"><span class="se-tk-item"></span></div></div>');
        root.appendChild(el); root.classList.add('se-has-ticker');
        const view = el.querySelector('.se-tk-view'), sp = el.querySelector('.se-tk-item'), pitch = body.querySelector('.se-pitch');
        const place = () => {
          if (!el.isConnected) return;
          const rr = root.getBoundingClientRect(), pb = pitch.getBoundingClientRect().bottom, bt = bar.getBoundingClientRect().top;
          el.style.top = `${Math.round((pb + bt) / 2 - rr.top - 17)}px`;
        };
        place();
        const ro = window.ResizeObserver ? new ResizeObserver(place) : null; ro && ro.observe(root);
        let timer = 0;
        return {
          el,
          add(p) {
            sp.getAnimations().forEach((a) => a.cancel()); clearTimeout(timer);
            sp.textContent = `${p.name} joins ${p.club}`; sp.style.transform = '';
            if (reduced) return;
            sp.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
            const over = sp.scrollWidth - view.clientWidth + 14;
            if (over > 0) timer = setTimeout(() => { if (sp.isConnected) sp.animate([{ transform: 'none' }, { transform: 'none', offset: 0.2 }, { transform: `translateX(${-over}px)`, offset: 0.8 }, { transform: `translateX(${-over}px)` }], { duration: 2500 + over * 25, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }); }, 250);
          },
          stop() { clearTimeout(timer); ro && ro.disconnect(); }
        };
      }
      function poachSummary(list) {
        const el = D2T.h(`<div class="se-poach-sum"><p class="se-note">Other sides came in over the summer. Fill the gaps with your rolls.</p>
          <ul>${list.map((x) => `<li>${x.crest ? `<img src="${x.crest}" alt="">` : ''}<b>${D2T.esc(x.name)}</b><span>to ${D2T.esc(x.club)}</span></li>`).join('')}</ul>
          <button class="btn se-btn se-poach-go" type="button">Continue</button></div>`);
        // seen once it is closed (Continue, a drag or a tap outside); a refresh before then shows it again, never the show
        const sh = D2T.sheet({ title: list.length === 3 ? 'Three players gone' : `${list.length} players gone`, body: el, onClose: () => { st.poachSeen = true; D2T.save(); } });
        sh.el.classList.add('se-run', 'se-poach-sheet');
        ['--se-acc', '--se-ink', '--se-text', '--se-acc-a', '--se-acc-b'].forEach((v) => sh.el.style.setProperty(v, root.style.getPropertyValue(v)));
        el.querySelector('.se-poach-go').onclick = () => { sh.close(); if (root.isConnected) playBtn.onclick(); };
      }
      async function runPoach(list) {
        let alive = true; const anims = [], timers = [];
        const host = document.getElementById('app'), fxl = D2T.h('<div class="se-poach-fx" aria-hidden="true"></div>');
        poachKill = () => { alive = false; timers.forEach(clearTimeout); anims.forEach((a) => { try { a.cancel(); } catch (e) { /* gone */ } }); fxl.remove(); root.classList.remove('se-poaching'); };
        const wait = (ms) => new Promise((r) => timers.push(setTimeout(r, ms)));
        const anim = (el, k, o) => { const a = el.animate(k, Object.assign({ fill: 'forwards' }, o)); anims.push(a); return a.finished.catch(() => {}); };
        const SND = window.D2TSound || { play() {} }, S = GAME.S(), pitchSlots = GAME.slots();
        // the three go back on the pitch for the show (the engine has already emptied their shirts)
        list.forEach((x) => {
          const sl = slotsEl.querySelector(`.se-slot[data-i="${x.slot}"]`), c = GAME.card(S, x.id); if (!sl || !c) return;
          sl.innerHTML = `<div class="se-cardwrap" data-i="${x.slot}">${D2T.cards.player(c, { w: PITCH_W, mini: true, shine: false, tab: pitchSlots[x.slot].pos, cls: 'fit-' + GAME.fit(c.id, x.slot) })}</div>`;
        });
        root.classList.add('se-poaching');
        host.appendChild(fxl);
        await wait(1300);
        for (const x of list) {
          if (!alive) return;
          const sl = slotsEl.querySelector(`.se-slot[data-i="${x.slot}"]`), w = sl && sl.querySelector('.se-cardwrap'); if (!w) continue;
          const hr = host.getBoundingClientRect(), r = w.getBoundingClientRect();
          const cx = r.left - hr.left + r.width / 2, cyCard = r.top - hr.top + r.height / 2, top = r.top - hr.top;
          const cy = Math.max(70, cyCard - 120);
          // 1. the rival's crest drops in above him
          const rv = D2T.h(`<div class="se-pc-rival" style="left:${cx}px;top:${cy}px">${x.crest ? `<img src="${x.crest}" alt="">` : ''}</div>`);
          fxl.appendChild(rv);
          SND.play('dropCancel');
          // his headline replaces the last one as the crest lands (Craig, 14 Oct)
          timers.push(setTimeout(() => { if (!alive) return; SND.play('land'); ticker.add(x); }, 380));
          await anim(rv, [{ transform: 'translateY(-260px) scale(.6)', opacity: 0 }, { transform: 'translateY(8px) scale(1.05)', opacity: 1, offset: 0.75 }, { transform: 'none', opacity: 1 }], { duration: 500, easing: 'cubic-bezier(.3,1.3,.5,1)' });
          if (!alive) return;
          // 2. a line shoots down to the card
          const th = D2T.h(`<div class="se-pc-line" style="left:${cx - 1.5}px;top:${cy + 31}px;height:${Math.max(8, top - cy - 31)}px"></div>`);
          fxl.appendChild(th);
          await anim(th, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 220, easing: 'ease-out' });
          if (!alive) return;
          // 3. he wobbles (lifted into the overlay so nothing clips him on the way up)
          const clone = w.cloneNode(true);
          clone.style.cssText = `position:absolute;left:${r.left - hr.left}px;top:${top}px;width:${r.width}px;height:${r.height}px;margin:0`;
          fxl.appendChild(clone); w.style.visibility = 'hidden';
          await anim(clone, [{ transform: 'none' }, { transform: 'rotate(-6deg)', offset: 0.3 }, { transform: 'rotate(5deg)', offset: 0.6 }, { transform: 'none' }], { duration: 380 });
          if (!alive) return;
          // 4. reeled up into the crest
          SND.play('playerOut');
          anim(th, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: 380, easing: 'ease-in' });
          await anim(clone, [{ transform: 'none', opacity: 1 }, { transform: `translateY(${cy - cyCard}px) scale(.3)`, opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.6,0,.9,.4)' });
          if (!alive) return;
          th.remove(); clone.remove();
          // 5. his shirt is left empty with the crest of where he went; the crest flies off with him
          sl.innerHTML = SE.emptyShirt(pitchSlots[x.slot].pos, PITCH_W, x);
          anim(sl.firstElementChild, [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
          setRating(GAME.rating());
          SND.play('pass');
          await anim(rv, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-300px) scale(.7)', opacity: 0 }], { duration: 450, easing: 'ease-in' });
          if (!alive) return;
          rv.remove();
          await wait(700);
        }
        if (!alive) return;
        poachKill(); poachKill = null;
        render(null);
        await new Promise((res) => setTimeout(res, 200));
        if (root.isConnected) poachSummary(list);
      }
      // first-time tips: the shape, then (another visit) swapping a sub in
      const tipT = setTimeout(() => { if (!root.isConnected) return; const subs = subsEl.querySelectorAll('[data-card]'), sub = subs[Math.min(3, subs.length - 1)];   // a sub clear of the Formation button
        D2T.tips([['formation', body.querySelector('.se-formlink'), 'Change your shape here'], ...(pre && !drafting && sub ? [['subs', sub, 'Drag a sub onto the pitch']] : [])]); }, 1100);
      const offOld = this._off; this._off = () => { clearTimeout(tipT); poachKill && poachKill(); ticker && ticker.stop(); offOld && offOld(); };
      // first load: cards deal onto the pitch
      if (!reduced && window.D2TSound && L.xi.some(Boolean)) window.D2TSound.play('dealPitch');   // empty shirts before the draft: no cards land, so no sound
      if (!reduced) [...slotsEl.querySelectorAll('.se-cardwrap')].forEach((n, i) => n.animate([{ opacity: 0, transform: 'translateY(14px) scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 60 + i * 40, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' }));
    },
    unmount() { this._off && this._off(); }
  });
})();
