// Season agent: this gameweek's fixtures for everyone (real fixtures, no scores). My match at the top in my club colour.
(function () {
  const D2T = window.D2T, SE = D2T.se;
  const side = (c, cls) => `<span class="se-fx-side ${cls}"><img src="${c.crest}" alt=""><span class="se-fx-name">${D2T.esc(c.name)}</span></span>`;

  D2T.screen('fixtures', {
    title: 'Fixtures', theme: 'black',
    mount(root) {
      const ctx = SE.ensure(), st = ctx.st, data = ctx.data, club = data.club, me = club.name, gw = D2T.game.eng().gw;
      SE.accent(root, club); SE.setStep(ctx, 'fixtures');
      root.appendChild(D2T.topbar());
      const fx = SE.fixture(data, gw);
      if (!fx) {
        root.appendChild(D2T.h(`<div class="screen-body"><h1 class="se-h1" style="margin-top:20px">Season complete</h1><p class="se-note">Every gameweek is played.</p></div>`));
        const bar = D2T.h('<footer class="actionbar"><button class="btn se-btn se-wide" type="button">Home</button></footer>');
        bar.querySelector('button').onclick = () => D2T.go('home'); root.appendChild(bar); return;
      }
      const meC = SE.club(data, me), oppC = SE.club(data, fx.opp);
      const [hC, aC] = fx.ha === 'H' ? [meC, oppC] : [oppC, meC];
      const all = D2T.game.gwFixtures(gw);
      const others = all;
      // group the other fixtures by real match date
      const byDate = [];
      others.forEach((f) => { let g = byDate.find((x) => x.date === f.date); if (!g) byDate.push(g = { date: f.date, list: [] }); g.list.push(f); });
      byDate.sort((a, b) => a.date.localeCompare(b.date));

      const body = D2T.h(`<div class="screen-body se-fixtures">
        <div class="se-kicker">Premier League ${data.season}</div>
        <h1 class="se-h1 se-gw">Gameweek ${gw}</h1>
        <div class="se-myfx se-in-1" aria-label="Your match: ${D2T.esc(hC.name)} v ${D2T.esc(aC.name)}, ${SE.date(fx.date)}">
          <div class="se-myfx-top"><span>Your match</span><span>${SE.date(fx.date)}</span></div>
          <div class="se-myfx-row">
            <span class="se-myfx-team"><img src="${hC.crest}" alt=""><b>${D2T.esc(hC.name)}</b></span>
            <span class="se-v">v</span>
            <span class="se-myfx-team"><img src="${aC.crest}" alt=""><b>${D2T.esc(aC.name)}</b></span>
          </div>
          <div class="se-myfx-foot">${fx.ha === 'H' ? 'Home' : 'Away'} · ${D2T.esc(oppC.name)} finished ${D2T.ordinal((data.table.find((r) => r.name === fx.opp) || {}).pos || 0)} that season</div>
        </div>
        ${all.length ? byDate.map((g, gi) => `<div class="se-fx-date">${SE.date(g.date)}</div><div class="se-fx-list">${g.list.map((f, i) => `<div class="se-fx" style="--d:${120 + (gi * 4 + i) * 45}ms">${side(SE.club(data, f.home), 'se-h')}<span class="se-v">v</span>${side(SE.club(data, f.away), 'se-a')}</div>`).join('')}</div>`).join('')
          : ''}
        <div class="se-pad"></div>
      </div>`);
      const bar = D2T.h('<footer class="actionbar"><button class="icon-btn se-back" type="button" aria-label="Back to squad">' + D2T.ICON.back + '</button><button class="btn se-btn se-wide" type="button">Play match</button></footer>');
      root.append(body, bar);
      bar.querySelector('.se-back').onclick = () => D2T.go('squad');
      bar.querySelector('.se-btn').onclick = () => { st.step = 'match'; D2T.save(); D2T.go('match'); };
    }
  });
})();
