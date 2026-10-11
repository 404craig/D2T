// Season agent: match day. Kick off, a 90 minute clock in about 24 seconds with a live feed, Skip to end,
// then the final score and the league table after this gameweek. My result is simulated (seeded Poisson); nothing here is labelled real except other clubs' real results.
(function () {
  const D2T = window.D2T, SE = D2T.se;
  const MATCH_MS = 24000, HT_PAUSE = 900;
  const ICON = {
    goal: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#fff"/><path d="M12 7.2l3.3 2.4-1.3 3.9h-4l-1.3-3.9z" fill="#111"/><path d="M12 3v4.2M20.6 9.2l-5.3.4M17.4 19.4l-3.4-5.9M6.6 19.4l3.4-5.9M3.4 9.2l5.3.4" stroke="#111" stroke-width="1.3"/></svg>',
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
      const gw = st.match || eng.gw, fx = SE.fixture(data, gw);
      if (!fx) { D2T.go('fixtures'); return; }
      const meC = SE.club(data, me), oppC = SE.club(data, fx.opp);
      const home = fx.ha === 'H';
      const [hC, aC] = home ? [meC, oppC] : [oppC, meC];
      // Already played (a refresh, or back from another screen): the engine has the result, so show it.
      let sim = st.match ? GAME.result(gw) : null;
      const preRating = sim ? sim.me : GAME.rating(), preOpp = sim ? sim.oppStrength : GAME.oppStrength(gw);
      const oppRow = data.table.find((r) => r.name === fx.opp);
      const last = (n) => n.split(' ').slice(-1)[0];

      const body = D2T.h(`<div class="screen-body se-match">
        <div class="se-sb">
          <div class="se-sb-k">Gameweek ${gw} · ${SE.date(fx.date)}</div>
          <div class="se-sb-row">
            <div class="se-sb-team${home ? ' se-mine' : ''}"><img src="${hC.crest}" alt=""><b>${D2T.esc(hC.name)}</b></div>
            <div class="se-sb-score" aria-live="polite"><span class="se-sh">0</span><i></i><span class="se-sa">0</span></div>
            <div class="se-sb-team${home ? '' : ' se-mine'}"><img src="${aC.crest}" alt=""><b>${D2T.esc(aC.name)}</b></div>
          </div>
          <div class="se-clockrow"><span class="se-clock">0'</span></div>
          <div class="se-prog"><span></span><i class="se-prog-ht"></i></div>
        </div>
        <div class="se-feed" aria-live="polite">
          <div class="se-preview">
            <div class="se-pv"><span>Your XI rating</span><b>${preRating}</b></div>
            <div class="se-pv"><span>${D2T.esc(oppC.name)} rating</span><b>${preOpp}</b></div>
            <div class="se-pv"><span>${D2T.esc(oppC.name)} finished</span><b>${D2T.ordinal(oppRow ? oppRow.pos : 0)}</b></div>
            <p class="se-note">Your result is played out by the game from your XI's defence, midfield and attack against ${D2T.esc(oppC.name)}'s real squad${eng.signed.length ? ', minus anyone you have signed from them' : ''}.</p>
          </div>
        </div>
        <div class="se-pad"></div>
      </div>`);
      const bar = D2T.h('<footer class="actionbar"><button class="btn se-btn se-wide se-main" type="button">Kick off</button></footer>');
      root.append(body, bar);
      const btn = bar.querySelector('.se-main');
      const feed = body.querySelector('.se-feed'), clockEl = body.querySelector('.se-clock'), prog = body.querySelector('.se-prog span');
      const sh = body.querySelector('.se-sh'), sa = body.querySelector('.se-sa');
      let phase = 'pre', alive = true, raf = 0, score = { me: 0, opp: 0 }, nextEv = 0;
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
      const push = (e, animate) => {
        if (e.type === 'goal') { score[e.side]++; const el = (e.side === 'me') === home ? sh : sa; el.textContent = score[e.side]; if (animate && !reduced) { el.classList.remove('se-pop'); void el.offsetWidth; el.classList.add('se-pop'); body.querySelector('.se-sb').classList.remove('se-goalflash'); void feed.offsetWidth; body.querySelector('.se-sb').classList.add('se-goalflash'); } }
        const n = D2T.h(evHTML(e));
        if (animate && !reduced) n.classList.add('se-ev-in');
        feed.prepend(n);
      };
      const setClock = (m, label) => { clockEl.textContent = label || `${m}'`; prog.style.transform = `scaleX(${Math.min(1, m / 90)})`; };

      const kickOff = () => {
        sim = GAME.play();
        if (!sim) { D2T.go(GAME.stepFor() || 'home'); return; }
        SND.play('kickoff'); SND.crowd(true);
        phase = 'live';
        btn.textContent = 'Skip to end'; btn.classList.add('se-btn-ghost');
        feed.innerHTML = ''; push({ type: 'ko' }, true);
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
        cancelAnimationFrame(raf);
        while (nextEv < sim.events.length) push(sim.events[nextEv++], false);
        setClock(90, 'FT'); end();
      };
      const end = () => {
        phase = 'ft';
        SND.crowd(false); SND.play('fulltime');
        body.querySelector('.se-sb').classList.remove('se-live');
        btn.textContent = 'Final score'; btn.classList.remove('se-btn-ghost');
        setTimeout(() => { if (alive && phase === 'ft') showFinal(true); }, reduced ? 300 : 1100);
      };

      // ---------- final score ----------
      const showFinal = (animate) => {
        phase = 'final';
        const r = { gf: sim.gf, ga: sim.ga, scorers: sim.events.filter((e) => e.type === 'goal').map((e) => ({ side: e.side, who: e.who, min: e.min })) };
        const res = r.gf > r.ga ? 'win' : r.gf < r.ga ? 'loss' : 'draw';
        const goals = (side) => r.scorers.filter((s) => s.side === side).map((s) => `<li>${D2T.esc(s.who ? last(s.who) : (side === 'me' ? meC.name : oppC.name))} <span>${s.min}'</span></li>`).join('') || '<li class="se-none">No goals</li>';
        const [hs, as] = home ? [r.gf, r.ga] : [r.ga, r.gf];
        const [hg, ag] = home ? [goals('me'), goals('opp')] : [goals('opp'), goals('me')];
        body.innerHTML = `<div class="se-final${animate && !reduced ? ' se-final-in' : ''}">
          <div class="se-sb-k">Gameweek ${gw} · Full time</div>
          <div class="se-result se-res-${res}">${res === 'win' ? 'Win' : res === 'draw' ? 'Draw' : 'Defeat'} · ${res === 'win' ? '+3 points' : res === 'draw' ? '+1 point' : '0 points'}</div>
          <div class="se-fs">
            <div class="se-fs-team${home ? ' se-mine' : ''}"><img src="${hC.crest}" alt=""><b>${D2T.esc(hC.name)}</b></div>
            <div class="se-fs-score"><span>${hs}</span><i></i><span>${as}</span></div>
            <div class="se-fs-team${home ? '' : ' se-mine'}"><img src="${aC.crest}" alt=""><b>${D2T.esc(aC.name)}</b></div>
          </div>
          <div class="se-scorers"><ul>${hg}</ul><span class="se-ball">${ICON.goal}</span><ul>${ag}</ul></div>
          <p class="se-note" style="text-align:center">Played out by the game from your XI and the opposition's strength.</p>
        </div>`;
        body.scrollTop = 0;
        btn.textContent = 'League table'; btn.classList.remove('se-btn-ghost');
      };

      // ---------- league table after this gameweek ----------
      const showTable = () => {
        phase = 'table';
        const prev = SE.standings(ctx, gw - 1), now = SE.standings(ctx, gw);
        const prevPos = new Map(prev.map((r) => [r.name, r.pos]));
        const prevByName = new Map(prev.map((r) => [r.name, r]));
        const realOthers = true;
        body.innerHTML = `<div class="se-aftertable">
          <div class="se-kicker">Premier League ${data.season}</div>
          <h1 class="se-h1 se-gw">After gameweek ${gw}</h1>
          <div class="se-table" role="table" aria-label="Table after gameweek ${gw}">${SE.tableHead()}
            ${prev.map((r) => SE.rowHTML(r, me, r.name === me ? 'se-landed' : '')).join('')}
          </div>
          <p class="se-note">Other clubs keep their real ${data.season} results on their real dates${eng.signed.length ? ', but clubs you have signed players from are weaker and can drop points' : ''}. Yours is the one you just played.</p>
          <div class="se-pad"></div></div>`;
        const tbl = body.querySelector('.se-table');
        const rows = [...tbl.querySelectorAll('.se-tr:not(.se-th)')];
        const go = () => {
          const before = SE.rects(rows);
          const byName = new Map(rows.map((el) => [el.dataset.name, el]));
          now.forEach((r) => {
            const el = byName.get(r.name); tbl.appendChild(el);
            el.querySelector('.se-pos').textContent = r.pos;
            const mv = prevPos.get(r.name) - r.pos;
            const team = el.querySelector('.se-team');
            if (mv && gw > 1) team.insertAdjacentHTML('beforeend', `<span class="se-mv ${mv > 0 ? 'se-up' : 'se-down'}" aria-label="${mv > 0 ? 'up' : 'down'} ${Math.abs(mv)}">${mv > 0 ? '▲' : '▼'}</span>`);
            SE.COLS.forEach((k) => {
              const n = el.querySelector(`[data-k="${k}"]`), from = prevByName.get(r.name)[k], to = r[k];
              if (from === to) return;
              if (reduced) { n.textContent = to; return; }
              const t0 = performance.now();
              const step = (t) => { const p = Math.min(1, (t - t0) / 700); n.textContent = Math.round(from + (to - from) * p); if (p < 1 && alive) requestAnimationFrame(step); };
              requestAnimationFrame(step);
              n.classList.add('se-changed');
            });
          });
          SE.flip(rows, before, { duration: 800, stagger: 12, easing: 'cubic-bezier(.65,0,.25,1)' });
          const mine = byName.get(me);
          setTimeout(() => { if (!alive) return; mine.classList.add('se-thump'); const sr = body.getBoundingClientRect(), rr = mine.getBoundingClientRect(); body.scrollTo({ top: body.scrollTop + rr.top - sr.top - body.clientHeight * 0.45, behavior: reduced ? 'auto' : 'smooth' }); }, reduced ? 0 : 850);
        };
        if (reduced) go(); else setTimeout(() => alive && go(), 500);
        btn.textContent = 'Continue';
      };

      btn.onclick = () => {
        if (phase === 'pre') kickOff();
        else if (phase === 'live') skip();
        else if (phase === 'ft') showFinal(true);
        else if (phase === 'final') showTable();
        else if (phase === 'table') {
          const next = GAME.afterMatch();
          D2T.go(next);
        }
      };
      // already played this gameweek (for example after a reload): straight to the final score
      if (sim) showFinal(false);
    },
    unmount() { this._kill && this._kill(); }
  });
})();
