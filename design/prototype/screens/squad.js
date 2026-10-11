// Season agent: squad and tactics. Pitch with mini cards in formation, formation sheet, subs carousel, tap and drag swaps.
(function () {
  const D2T = window.D2T, SE = D2T.se;
  const PITCH_W = 56, SUB_W = 92;
  const ROLE_NAME = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' };

  const pitchLines = `<svg class="se-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <rect x="3" y="2" width="94" height="96" rx=".6"/><line x1="3" y1="50" x2="97" y2="50"/>
    <rect x="24" y="2" width="52" height="15"/><rect x="38" y="2" width="24" height="5.5"/>
    <rect x="24" y="83" width="52" height="15"/><rect x="38" y="92.5" width="24" height="5.5"/>
  </svg><span class="se-circle" aria-hidden="true"></span><span class="se-spot" aria-hidden="true"></span>`;

  D2T.screen('squad', {
    title: 'Squad', theme: 'black',
    mount(root) {
      const ctx = SE.ensure(), st = ctx.st, data = ctx.data, club = data.club;
      SE.accent(root, club); SE.setStep(ctx, 'squad');
      const reduced = D2T.reduced();
      root.appendChild(D2T.topbar());
      const body = D2T.h(`<div class="screen-body se-squad">
        <div class="se-sqhead">
          <img class="se-sqcrest" src="${club.crest}" alt="">
          <div class="se-sqtext"><div class="se-sqname">${D2T.esc(club.name)}</div><div class="se-sqsub">${data.season} · Gameweek ${Math.min(st.gw, 38)}</div></div>
          <div class="se-rating" aria-live="polite"><b class="se-rating-n">0</b><i>Team<br>rating</i></div>
        </div>
        <div class="se-pitch">${pitchLines}<div class="se-slots"></div></div>
        <button class="se-formlink" type="button">Change formation · <b class="se-fname"></b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <div class="se-subshead"><span class="se-subs-t">Substitutes</span><span class="se-hint" aria-live="polite"></span></div>
        <div class="se-subs" role="list" aria-label="Substitutes"></div>
      </div>`);
      root.appendChild(body);

      // next fixture in the fixed bar
      const fx = SE.fixture(data, st.gw);
      const bar = D2T.h(fx ? (() => {
        const opp = SE.club(data, fx.opp);
        return `<footer class="actionbar se-nextbar"><div class="se-next"><img src="${opp.crest}" alt=""><div class="se-next-t"><small>Next · GW${fx.gw} · ${SE.date(fx.date, false)}</small><b>${D2T.esc(opp.name)}</b><span class="se-ha">${fx.ha === 'H' ? 'Home' : 'Away'}</span></div></div><button class="btn se-btn se-play" type="button">Play</button></footer>`;
      })() : '<footer class="actionbar"><button class="btn se-btn se-wide" type="button">Season complete</button></footer>');
      root.appendChild(bar);
      bar.querySelector('button').onclick = () => {
        if (!fx) { D2T.go('home'); return; }
        st.step = 'fixtures'; D2T.save(); D2T.go('fixtures');
      };

      const slotsEl = body.querySelector('.se-slots'), subsEl = body.querySelector('.se-subs');
      const hintEl = body.querySelector('.se-hint'), ratingEl = body.querySelector('.se-rating-n');
      let L = null, sel = null, shownRating = 0;

      // ---------- render ----------
      const allItems = () => [...root.querySelectorAll('[data-card]')];
      function render(before) {
        L = SE.lineup(ctx);
        const slots = SE.FORMATIONS[st.formation];
        slotsEl.innerHTML = slots.map((s, i) => {
          const c = L.xi[i], oop = c.pos !== s.role;
          return `<div class="se-slot${oop ? ' se-oop' : ''}" style="left:${s.x}%;top:${s.y}%;z-index:${Math.round(s.y)}" data-i="${i}">
            <div class="se-cardwrap" data-card="${D2T.esc(c.name)}" data-kind="pitch" data-i="${i}" role="button" tabindex="0" aria-label="${D2T.esc(c.name)}, ${c.ovr}, playing ${ROLE_NAME[s.role]}${oop ? ', out of position' : ''}">
              ${D2T.cards.player(c, { w: PITCH_W, mini: true, shine: false })}${oop ? `<span class="se-oopchip">${s.role}</span>` : ''}</div></div>`;
        }).join('');
        const sl = subsEl.scrollLeft;
        subsEl.innerHTML = L.subs.map((c) => `<div class="se-sub" role="listitem"><div class="se-cardwrap" data-card="${D2T.esc(c.name)}" data-kind="sub" role="button" tabindex="0" aria-label="${D2T.esc(c.name)}, ${c.ovr}, ${ROLE_NAME[c.pos]}, substitute">${D2T.cards.player(c, { w: SUB_W, shine: false })}</div></div>`).join('');
        subsEl.scrollLeft = sl;
        body.querySelector('.se-fname').textContent = st.formation;
        body.querySelector('.se-subs-t').textContent = `Substitutes · ${L.subs.length}`;
        setRating(SE.rating(L.xi));
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
      function applySel() {
        root.querySelectorAll('.se-sel').forEach((n) => n.classList.remove('se-sel'));
        slotsEl.classList.toggle('se-armed', !!sel);
        if (sel) {
          const el = root.querySelector(`[data-kind="${sel.kind}"][data-card="${CSS.escape(sel.name)}"]`);
          if (el) el.classList.add('se-sel'); else sel = null;
        }
        const last = sel ? sel.name.split(' ').slice(-1)[0] : '';
        hintEl.textContent = !sel ? 'Tap to select, drag onto the pitch' : sel.kind === 'sub' ? `Tap a player to bring on ${last}` : `Tap a player to swap with ${last}`;
      }
      function select(kind, name) { sel = { kind, name }; applySel(); }
      function clearSel() { sel = null; applySel(); }
      function openBig(el, name) {
        const card = L.all.get(name); if (!card) return;
        D2T.cards.openLarge(el.querySelector('.d2c') || el, D2T.cards.player(card, { w: 280 }), {});
      }

      // ---------- swaps ----------
      function swap(a, b, ghostRect) { // a, b: { kind, name }
        if (a.kind === 'sub' && b.kind === 'sub') return;
        const before = new Map(allItems().map((el) => [el.dataset.card, el.getBoundingClientRect()]));
        if (ghostRect) before.set(a.name, ghostRect);
        const xi = st.xi, subs = st.subs;
        if (a.kind === 'pitch' && b.kind === 'pitch') {
          const i = xi.indexOf(a.name), j = xi.indexOf(b.name); xi[i] = b.name; xi[j] = a.name;
        } else {
          const p = a.kind === 'pitch' ? a.name : b.name, s = a.kind === 'sub' ? a.name : b.name;
          const i = xi.indexOf(p), j = subs.indexOf(s); xi[i] = s; subs[j] = p;
        }
        D2T.save();
        sel = null;
        render(before);
      }

      // ---------- taps ----------
      function tap(item) {
        const kind = item.dataset.kind, name = item.dataset.card;
        if (sel && sel.kind === kind && sel.name === name) { openBig(item, name); return; }
        if (sel && !(sel.kind === 'sub' && kind === 'sub')) { swap(sel, { kind, name }); return; }
        select(kind, name);
      }
      root.addEventListener('keydown', (e) => { const it = e.target.closest && e.target.closest('[data-card]'); if (it && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tap(it); } });

      // ---------- pointer: tap or drag (touch and mouse) ----------
      let press = null, ghost = null, target = null;
      const host = document.getElementById('app');
      const onDown = (e) => {
        if (e.button) return;
        const item = e.target.closest('[data-card]');
        if (!item || !root.contains(item)) { if (sel && !e.target.closest('.se-formlink, .actionbar, .topbar')) clearSel(); return; }
        press = { item, kind: item.dataset.kind, name: item.dataset.card, x0: e.clientX, y0: e.clientY, id: e.pointerId, type: e.pointerType, dragging: false };
      };
      const onMove = (e) => {
        if (!press || e.pointerId !== press.id) return;
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
        if (!press || e.pointerId !== press.id) return;
        const p = press; press = null;
        if (p.dragging) drop(p, e.clientX, e.clientY); else tap(p.item);
      };
      const onCancel = (e) => { if (!press || e.pointerId !== press.id) return; const p = press; press = null; if (p.dragging) drop(p, null, null); };

      function startDrag(e) {
        press.dragging = true;
        const card = L.all.get(press.name), w = 70;
        const hr = host.getBoundingClientRect();
        ghost = D2T.h(`<div class="se-ghost" aria-hidden="true">${D2T.cards.player(card, { w, mini: true, shine: false })}</div>`);
        ghost._hr = hr; ghost._w = w; ghost._h = w * 1.667;
        host.appendChild(ghost);
        press.item.classList.add('se-dragsrc');
        root.classList.add('se-dragging');
        subsEl.style.overflowX = 'hidden';
        sel = null; applySel();
        moveGhost(e.clientX, e.clientY);
        hintEl.textContent = 'Drop on a player to swap';
      }
      function moveGhost(x, y) {
        const hr = ghost._hr;
        ghost.style.transform = `translate(${x - hr.left - ghost._w / 2}px,${y - hr.top - ghost._h * 0.62}px) rotate(-4deg) scale(1.08)`;
        const under = document.elementFromPoint(x, y);
        let t = under && under.closest('[data-card]');
        if (t && (!root.contains(t) || t.dataset.card === press.name || (press.kind === 'sub' && t.dataset.kind === 'sub'))) t = null;
        if (!t && under && press.kind === 'sub') { const slot = under.closest('.se-slot'); t = slot && slot.querySelector('[data-card]'); }
        if (t !== target) { target && target.classList.remove('se-target'); target = t; target && target.classList.add('se-target'); }
      }
      function drop(p, x, y) {
        const g = ghost, t = target; ghost = null; target = null;
        root.classList.remove('se-dragging');
        subsEl.style.overflowX = '';
        p.item.classList.remove('se-dragsrc');
        t && t.classList.remove('se-target');
        if (!g) return;
        const gr = g.querySelector('.d2c').getBoundingClientRect();
        if (t && x != null) {
          g.remove();
          swap({ kind: p.kind, name: p.name }, { kind: t.dataset.kind, name: t.dataset.card }, gr);
          return;
        }
        // no target: the card drops back to where it came from
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
        let pending = st.formation;
        const tile = (k) => `<button class="se-formcard${k === pending ? ' is-on' : ''}" type="button" data-f="${k}" aria-pressed="${k === pending}">
          <span class="se-fpitch"><span class="se-fline"></span>${SE.FORMATIONS[k].map((s) => `<i style="left:${s.x}%;top:${s.y}%"></i>`).join('')}</span><b>${k}</b></button>`;
        const el = D2T.h(`<div><div class="se-formgrid">${SE.FORMATION_KEYS.map(tile).join('')}</div><p class="se-note">Your best XI is picked for the shape you choose. You can still swap anyone after.</p><button class="btn se-btn se-done" type="button">Done</button></div>`);
        const sh = D2T.sheet({
          title: 'Formation', body: el,
          onClose: () => {
            if (pending === st.formation) return;
            const before = new Map(allItems().map((n) => [n.dataset.card, n.getBoundingClientRect()]));
            st.formation = pending;
            st.xi = SE.bestXI(pending, [...SE.cards(ctx).values()]);
            st.subs = [];
            D2T.save(); sel = null;
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

      render(null);
      // first load: cards deal onto the pitch
      if (!reduced) [...slotsEl.querySelectorAll('.se-cardwrap')].forEach((n, i) => n.animate([{ opacity: 0, transform: 'translateY(14px) scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 60 + i * 40, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' }));
    },
    unmount() { this._off && this._off(); }
  });
})();
