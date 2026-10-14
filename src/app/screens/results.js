// After full time (Craig, 14 Oct): the results screen, then the league table after this gameweek.
// Results: your match highlighted at the top with its score, scorers and the result chip, then everyone else's scores
// grouped by real match date like the fixtures screen (raids applied: a club you have signed from can drop points).
// Standings: the table rolls from where it stood before the gameweek to where it is now (the old full-time screen's
// table), then Continue hands the run on (GAME.afterMatch: a transfer window, the next gameweek or the season summary).
(function () {
  const D2T = window.D2T, SE = D2T.se;
  const side = (c, cls) => `<span class="se-fx-side ${cls}"><img src="${c.crest}" alt=""><span class="se-fx-name">${D2T.esc(c.name)}</span></span>`;

  D2T.screen('results', {
    title: 'Results', theme: 'black',
    mount(root) {
      const ctx = SE.ensure(), st = ctx.st, data = ctx.data, club = data.club, me = club.name, GAME = D2T.game;
      const gw = st.match, fx = gw ? SE.fixture(data, gw) : null, sim = gw ? GAME.result(gw) : null;
      if (!fx || !sim) { D2T.go(GAME.stepFor() || 'home'); return; }
      SE.accent(root, club); SE.setStep(ctx, 'results');
      root.appendChild(D2T.topbar());
      const reduced = D2T.reduced();
      const meC = SE.club(data, me), oppC = SE.club(data, fx.opp), home = fx.ha === 'H';
      const [hC, aC] = home ? [meC, oppC] : [oppC, meC];
      const [hs, as] = home ? [sim.gf, sim.ga] : [sim.ga, sim.gf];
      const goals = sim.events.filter((e) => e.type === 'goal').map((e) => ({ side: e.side, who: e.who || (e.side === 'me' ? meC.name : oppC.name), min: e.min }));
      const mine = goals.filter((g) => g.side === 'me'), theirs = goals.filter((g) => g.side === 'opp');
      const res = sim.gf > sim.ga ? 'win' : sim.gf < sim.ga ? 'loss' : 'draw';
      const others = GAME.gwResults(gw), byDate = [];
      others.forEach((f) => { let g = byDate.find((x) => x.date === f.date); if (!g) byDate.push(g = { date: f.date, list: [] }); g.list.push(f); });
      byDate.sort((a, b) => a.date.localeCompare(b.date));
      // a dot for every player you signed from a club this season, at the far left for the home side, far right for the away
      const from = GAME.signedFrom(), dots = (name, cls) => from[name] ? `<span class="se-fx-dots ${cls}" aria-label="${from[name]} signed from ${D2T.esc(name)}">${'<i></i>'.repeat(from[name])}</span>` : '';
      const anyDots = others.some((f) => from[f.home] || from[f.away]);
      const body = D2T.h(`<div class="screen-body se-fixtures se-results">
        <div class="se-kicker">Premier League ${data.season}</div>
        <h1 class="se-h1 se-gw">Gameweek ${gw} results</h1>
        <div class="se-myfx se-myres${reduced ? '' : ' se-in-1'}" aria-label="Your match: ${D2T.esc(hC.name)} ${hs}, ${D2T.esc(aC.name)} ${as}">
          <div class="se-myfx-top"><span>Your match</span><span>${SE.date(fx.date)}</span></div>
          <div class="se-myfx-row">
            <span class="se-myfx-team"><img src="${hC.crest}" alt=""><b>${D2T.esc(hC.name)}</b></span>
            <span class="se-myfx-score"><span>${hs}</span><i></i><span>${as}</span></span>
            <span class="se-myfx-team"><img src="${aC.crest}" alt=""><b>${D2T.esc(aC.name)}</b></span>
          </div>
          ${SE.scorers(home ? mine : theirs, home ? theirs : mine)}
          <div class="se-myfx-foot"><span class="se-result se-res-${res}">${res === 'win' ? 'Win' : res === 'draw' ? 'Draw' : 'Defeat'} · ${res === 'win' ? '+3 points' : res === 'draw' ? '+1 point' : '0 points'}</span></div>
        </div>
        ${byDate.length ? byDate.map((g, gi) => `<div class="se-fx-date">${SE.date(g.date)}</div><div class="se-fx-list">${g.list.map((f, i) => `<div class="se-fx se-fx-res" style="--d:${120 + (gi * 4 + i) * 45}ms">${dots(f.home, 'se-h')}${dots(f.away, 'se-a')}${side(SE.club(data, f.home), 'se-h')}<span class="se-fx-sc">${f.hg}<i></i>${f.ag}</span>${side(SE.club(data, f.away), 'se-a')}</div>`).join('')}</div>`).join('')
          : `<p class="se-note">No other matches around this date.</p>`}
        <p class="se-note">${GAME.isSim() ? `Other clubs' results are the ${data.season} forecast, played out by the match model.` : `Other clubs' results are their real ${data.season} results.`}${anyDots ? ' Clubs you sign players from are weaker and can drop points.' : ''}</p>
        ${anyDots ? `<p class="se-note se-fx-key"><span class="se-fx-dots"><i></i></span> = a player you signed from that club</p>` : ''}
        <div class="se-pad"></div>
      </div>`);
      // home (the menu), back to the match as it finished, League table across the right (Craig, 14 Oct)
      const bar = D2T.h(SE.bar({ mid: SE.backBtn('Back to the match'), main: SE.mainBtn('League table', 'se-main') }));
      root.append(body, bar);
      bar.querySelector('.se-back').onclick = () => { st.step = 'match'; st.review = true; D2T.save(); D2T.go('match'); };
      bar.querySelector('.bar-main').onclick = () => { st.step = 'standings'; D2T.save(); D2T.go('standings'); };
      if (!reduced && window.D2TSound) window.D2TSound.play('fixtures', null, 0.15);
    }
  });

  // ---------- the league table after this gameweek ----------
  D2T.screen('standings', {
    title: 'League table', theme: 'black',
    mount(root) {
      const ctx = SE.ensure(), st = ctx.st, data = ctx.data, club = data.club, me = club.name, GAME = D2T.game, eng = GAME.eng();
      const gw = st.match;
      if (!gw || !GAME.result(gw)) { D2T.go(GAME.stepFor() || 'home'); return; }
      SE.accent(root, club); SE.setStep(ctx, 'standings');
      root.appendChild(D2T.topbar());
      const reduced = D2T.reduced(), SND = window.D2TSound || { play() {} };
      let alive = true;
      this._kill = () => { alive = false; };
      const prev = SE.standings(ctx, gw - 1), now = SE.standings(ctx, gw);
      const prevPos = new Map(prev.map((r) => [r.name, r.pos]));
      const prevByName = new Map(prev.map((r) => [r.name, r]));
      const body = D2T.h(`<div class="screen-body se-aftertable">
        <div class="se-kicker">Premier League ${data.season}</div>
        <h1 class="se-h1 se-gw">After gameweek ${gw}</h1>
        <div class="se-table" role="table" aria-label="Table after gameweek ${gw}">${SE.tableHead()}
          ${prev.map((r) => SE.rowHTML(r, me, r.name === me ? 'se-landed' : '')).join('')}
        </div>
        <p class="se-note">${GAME.isSim() ? `Other clubs play out the ${data.season} forecast` : `Other clubs keep their real ${data.season} results on their real dates`}${eng.signed.length ? ', but clubs you have signed players from are weaker and can drop points' : ''}. Yours is the one you just played.</p>
        <div class="se-pad"></div></div>`);
      // home (the menu), back to the results, Continue across the right (Craig, 14 Oct)
      const bar = D2T.h(SE.bar({ mid: SE.backBtn('Back to the results'), main: SE.mainBtn('Continue', 'se-main') }));
      root.append(body, bar);
      bar.querySelector('.se-back').onclick = () => { st.step = 'results'; D2T.save(); D2T.go('results'); };
      bar.querySelector('.bar-main').onclick = () => D2T.go(GAME.afterMatch());
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
        { const mv = gw > 1 ? prevPos.get(me) - (now.find((r) => r.name === me) || {}).pos : 0; SND.play('tableMove', mv > 0 ? 0 : mv < 0 ? 1 : 2); }
        const mine = byName.get(me);
        setTimeout(() => { if (!alive) return; mine.classList.add('se-thump'); const sr = body.getBoundingClientRect(), rr = mine.getBoundingClientRect(); body.scrollTo({ top: body.scrollTop + rr.top - sr.top - body.clientHeight * 0.45, behavior: reduced ? 'auto' : 'smooth' }); }, reduced ? 0 : 850);
      };
      if (reduced) go(); else setTimeout(() => alive && go(), 500);
    },
    unmount() { this._kill && this._kill(); }
  });
})();
