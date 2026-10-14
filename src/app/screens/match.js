// Season agent: match day. The fixtures screen's Kick off decides the match in the engine (GAME.play) and opens this
// screen, which plays it out: a 90 minute clock in 10 seconds with a live feed, the scorers panel filling in as each
// goal goes in, the ratings panel under it, Skip to end, then full time and See results (the results screen, then the
// table after this gameweek). Nothing here is labelled real except other clubs' real results.
// A refresh mid-match shows the match settled (run.watch is taken as the screen mounts; the result was decided at Kick off).
(function () {
  const D2T = window.D2T, SE = D2T.se;
  const MATCH_MS = 9400, HT_PAUSE = 600;   // 10 seconds kick-off to full time, half-time pause included (Craig, 12 Oct)
  const ICON = {
    goal: SE.ball,
    miss: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V5h16v15" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M4 9h16M8 5v15M12 5v15M16 5v15" stroke="currentColor" stroke-width=".8" opacity=".5"/></svg>',
    yellow: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="4" width="10" height="15" rx="1.6" fill="#FFD43B" transform="rotate(8 12 12)"/></svg>',
    whistle: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="14" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 10l8-3v4l-6 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
  };

  D2T.screen('match', {
    title: 'Match', theme: 'black',
    mount(root) {
      const ctx = SE.ensure(), st = ctx.st, data = ctx.data, club = data.club, me = club.name;
      SE.accent(root, club); SE.setStep(ctx, 'match');
      const reduced = D2T.reduced();
      root.appendChild(D2T.topbar());
      const GAME = D2T.game, eng = GAME.eng(), SND = window.D2TSound || { play() {}, crowd() {} };
      const gw = st.match, fx = gw ? SE.fixture(data, gw) : null;
      const sim = gw ? GAME.result(gw) : null;
      if (!fx || !sim) { D2T.go(GAME.stepFor() || 'home'); return; }
      // fresh from Kick off: play it out; otherwise (a refresh, or back from the results) it is settled
      const fresh = !!st.watch; if (fresh) { st.watch = false; D2T.save(); }
      const meC = SE.club(data, me), oppC = SE.club(data, fx.opp);
      const home = fx.ha === 'H';
      const [hC, aC] = home ? [meC, oppC] : [oppC, meC];
      const oppRow = data.table.find((r) => r.name === fx.opp);
      const last = SE.surname;

      const body = D2T.h(`<div class="screen-body se-match">
        <div class="se-sb">
          <div class="se-sb-k">Gameweek ${gw} · ${SE.date(fx.date)}</div>
          <div class="se-sb-row">
            <div class="se-sb-team${home ? ' se-mine' : ''}"><img src="${hC.crest}" alt=""><b>${D2T.esc(hC.name)}</b></div>
            <div class="se-sb-score" aria-live="polite"><span class="se-sh">0</span><i></i><span class="se-sa">0</span></div>
            <div class="se-sb-team${home ? '' : ' se-mine'}"><img src="${aC.crest}" alt=""><b>${D2T.esc(aC.name)}</b></div>
          </div>
          <div class="se-clockrow"><span class="se-clock">0'</span><span class="se-result se-result-live" hidden></span></div>
          <div class="se-prog"><span></span><i class="se-prog-ht"></i></div>
        </div>
        ${SE.scorers([], [])}
        <div class="se-preview">
          <div class="se-pv"><span>Your XI rating</span><b>${sim.me}</b></div>
          <div class="se-pv"><span>${D2T.esc(oppC.name)} rating</span><b>${sim.oppStrength}</b></div>
          <div class="se-pv"><span>${D2T.esc(oppC.name)} finished</span><b>${D2T.ordinal(oppRow ? oppRow.pos : 0)}</b></div>
          <p class="se-note">Your result is played out by the game from your XI's defence, midfield and attack against ${D2T.esc(oppC.name)}'s real squad${eng.signed.length ? ', minus anyone you have signed from them' : ''}.</p>
        </div>
        <div class="se-feed" aria-live="polite"></div>
        <div class="se-pad"></div>
      </div>`);
      // home (the menu), a greyed back (the result is decided), Skip to end then See results (Craig, 14 Oct)
      const bar = D2T.h(SE.bar({ main: SE.mainBtn(fresh ? 'Skip to end' : 'See results', 'se-main' + (fresh ? ' se-btn-ghost' : '')) }));
      root.append(body, bar);
      const btn = bar.querySelector('.se-main');
      const feed = body.querySelector('.se-feed'), clockEl = body.querySelector('.se-clock'), prog = body.querySelector('.se-prog span');
      const sh = body.querySelector('.se-sh'), sa = body.querySelector('.se-sa'), chip = body.querySelector('.se-result');
      const scorers = body.querySelector('.se-scorers'), lists = scorers.querySelectorAll('ul');
      let phase = 'live', alive = true, raf = 0, score = { me: 0, opp: 0 }, nextEv = 0;
      this._kill = () => { alive = false; cancelAnimationFrame(raf); };

      const evHTML = (e) => {
        const mine = e.side === 'me', cl = mine ? meC.name : oppC.name, who = e.who ? D2T.esc(e.who) : '';
        let icon = ICON.whistle, text = '', cls = '';
        if (e.type === 'goal') {
          icon = ICON.goal; cls = mine ? 'se-ev-goal se-ev-me' : 'se-ev-goal';
          const s = home ? `${score.me}-${score.opp}` : `${score.opp}-${score.me}`;
          text = mine ? `<b>GOAL! ${D2T.esc(last(e.who))}</b> scores for ${D2T.esc(cl)}. <span class="se-ev-s">${s}</span>` : `<b>${D2T.esc(cl)} score.</b>${who ? ` ${who} finishes.` : ''} <span class="se-ev-s">${s}</span>`;
        } else if (e.type === 'miss') {
          icon = ICON.miss; cls = mine ? 'se-ev-me-soft' : '';
          const n = who || D2T.esc(cl);
          text = [`${n} hits the post!`, `Big chance! ${n} shoots just wide.`, `Great save to deny ${n}.`, `${n} heads over from close range.`][e.kind || 0];
        } else if (e.type === 'yellow') {
          icon = ICON.yellow; text = `Yellow card for ${who || D2T.esc(cl)}${who ? ` (${D2T.esc(cl)})` : ''}.`;
        } else if (e.type === 'ht') { cls = 'se-ev-break'; text = `<b>Half time.</b> ${D2T.esc(hC.name)} ${home ? score.me : score.opp}, ${D2T.esc(aC.name)} ${home ? score.opp : score.me}.`; }
        else if (e.type === 'ft') { cls = 'se-ev-break'; text = '<b>Full time.</b>'; }
        else if (e.type === 'ko') { cls = 'se-ev-break'; text = `<b>Kick off.</b> ${D2T.esc(hC.name)} v ${D2T.esc(aC.name)}.`; }
        return `<div class="se-ev ${cls}"><span class="se-ev-min">${e.type === 'ko' ? "0'" : e.type === 'ht' ? 'HT' : e.type === 'ft' ? 'FT' : e.min + "'"}</span><span class="se-ev-ic">${icon}</span><span class="se-ev-t">${text}</span></div>`;
      };
      // a goal goes onto the scorers panel as it goes in: the home side's list on the left, the away side's on the right
      const addScorer = (e, animate) => {
        const ul = lists[(e.side === 'me') === home ? 0 : 1], none = ul.querySelector('.se-none');
        if (none) none.remove();
        const li = D2T.h(`<li>${D2T.esc(last(e.who || (e.side === 'me' ? meC.name : oppC.name)))} <span>${e.min}'</span></li>`);
        if (animate && !reduced) li.classList.add('se-ev-in');
        ul.appendChild(li);
      };
      const push = (e, animate) => {
        if (e.type === 'goal') {
          score[e.side]++; const el = (e.side === 'me') === home ? sh : sa; el.textContent = score[e.side];
          addScorer(e, animate);
          if (animate && !reduced) { el.classList.remove('se-pop'); void el.offsetWidth; el.classList.add('se-pop'); body.querySelector('.se-sb').classList.remove('se-goalflash'); void feed.offsetWidth; body.querySelector('.se-sb').classList.add('se-goalflash'); }
        }
        const n = D2T.h(evHTML(e));
        if (animate && !reduced) n.classList.add('se-ev-in');
        feed.prepend(n);
      };
      const setClock = (m, label) => { clockEl.textContent = label || `${m}'`; prog.style.transform = `scaleX(${Math.min(1, m / 90)})`; };
      const res = sim.gf > sim.ga ? 'win' : sim.gf < sim.ga ? 'loss' : 'draw';
      const showChip = (animate) => {
        chip.hidden = false; chip.classList.add('se-res-' + res);
        chip.textContent = `${res === 'win' ? 'Win' : res === 'draw' ? 'Draw' : 'Defeat'} · ${res === 'win' ? '+3 points' : res === 'draw' ? '+1 point' : '0 points'}`;
        if (animate && !reduced) chip.classList.add('se-ev-in');
      };

      const kickOff = () => {
        SND.play('kickoff'); SND.crowd(true);
        setTimeout(() => alive && phase === 'live' && D2T.tip('match-skip', btn, 'Jump to the final score'), 1500);
        push({ type: 'ko' }, true);
        body.querySelector('.se-sb').classList.add('se-live');
        const msPerMin = MATCH_MS / 90; let t0 = performance.now(), paused = 0;
        const tick = (now) => {
          if (!alive || phase !== 'live') return;
          let el = now - t0 - paused;
          let m = Math.min(90, Math.floor(el / msPerMin));
          while (nextEv < sim.events.length && sim.events[nextEv].min <= m) {
            const e = sim.events[nextEv++];
            if (e.type === 'ft') { push(e, true); setClock(90, 'FT'); end(); return; }
            push(e, true);
            if (e.type === 'goal') SND.play(e.side === 'me' ? 'goal' : 'conceded');
            if (e.type === 'ht') { SND.play('halftime'); setClock(45, 'HT'); paused += HT_PAUSE; raf = requestAnimationFrame(tick); return; }
          }
          setClock(m);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      };
      const skip = () => {
        cancelAnimationFrame(raf); SND.play('skip');
        while (nextEv < sim.events.length) push(sim.events[nextEv++], false);
        setClock(90, 'FT'); end();
      };
      // full time: the whistle, then the result chip and the crowd's verdict (the old full-time screen's cheer or groan)
      const end = () => {
        phase = 'ft';
        SND.crowd(false); SND.play('fulltime');
        body.querySelector('.se-sb').classList.remove('se-live');
        btn.textContent = 'See results'; btn.classList.remove('se-btn-ghost');
        setTimeout(() => { if (!alive) return; showChip(true); SND.play('result', res === 'win' ? 0 : res === 'draw' ? 1 : 2, 0.2); }, reduced ? 300 : 1100);
      };
      // settled (a refresh, or back from the results): the whole match as it finished, no replay
      const settle = () => {
        phase = 'ft';
        push({ type: 'ko' }, false);
        while (nextEv < sim.events.length) push(sim.events[nextEv++], false);
        setClock(90, 'FT'); showChip(false);
      };

      btn.onclick = () => {
        if (phase === 'live') { skip(); return; }
        st.step = 'results'; D2T.save(); D2T.go('results');
      };
      if (fresh) kickOff(); else settle();
    },
    unmount() { this._kill && this._kill(); }
  });
})();
