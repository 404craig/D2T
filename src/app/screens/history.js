// Club history (Craig, 14 Oct; option B in claude.ai/artifact/HpaCjVyXqu5b1PWyJJemyr with the home page's record in
// place of the trophy cabinet): one Club X career on a page. Your badge and club name, the career's record in the home
// page's four shields (beat the drop, top half, top 3, league titles), four big numbers (best points, wins, top scorer,
// biggest win) and every season, newest first. Opens from the Club X season summary (GAME.careerHistory).
(function () {
  D2T.screen('history', {
    title: 'Club history', theme: 'black',
    mount(root) {
      root.appendChild(D2T.topbar({ back: true }));
      const G = D2T.game, h = G.careerHistory();
      const name = h.club || G.xName(), first = h.seasons[0], esc = D2T.esc;
      const tiles = [];
      if (h.best) tiles.push(['g', h.best.pts, 'Best points', h.best.season]);
      if (h.full) tiles.push(['', h.wins, 'Wins', `in ${h.games} games`]);
      if (h.top) tiles.push(['', h.top.goals, 'Top scorer', `${esc(h.top.name)}${h.top.seasons > 1 ? `, ${h.top.seasons} seasons` : ''}`]);
      if (h.big) tiles.push(['', `${h.big.us}-${h.big.them}`, 'Biggest win', `v ${esc(h.big.opp)}, ${esc(h.big.season)}`]);
      const rows = h.seasons.slice().reverse().map((r) => `<tr class="${r.title ? 'champ' : ''}"><td>${esc(r.season)}${r.sim ? ' <span class="hs-fc">Forecast</span>' : ''}</td><td class="p">${D2T.ordinal(r.finish)}</td><td class="r">${r.w != null ? `${r.w}-${r.d}-${r.l}` : '-'}</td><td class="r">${r.pts}</td></tr>`).join('');
      const body = D2T.h(`<div class="screen-body fr-page hs">
        <div class="hs-club"><img src="${G.club('Club X').crest}" alt=""><div><div class="kick">Club history</div><h1 class="fr-title">${esc(name)}</h1>
          <div class="hs-sub">${h.seasons.length ? `${h.seasons.length} season${h.seasons.length === 1 ? '' : 's'} · since ${esc(first.season)}` : 'No finished seasons yet'}</div></div></div>
        ${h.seasons.length ? `
        <section class="fr-sect" aria-label="Your record">
          <div class="fr-sect-h"><h2>Your record</h2><span>${h.seasons.length} season${h.seasons.length === 1 ? '' : 's'}</span></div>
          ${D2T.frRecord(h.record, 'dark')}
        </section>
        ${tiles.length ? `<div class="hs-tiles">${tiles.map(([c, v, l, s]) => `<div class="hs-tile"><b class="${c}">${v}</b><span>${l}</span><em>${s}</em></div>`).join('')}</div>` : ''}
        <table class="hs-table"><thead><tr><th>Season</th><th>Finish</th><th class="r">W-D-L</th><th class="r">Pts</th></tr></thead><tbody>${rows}</tbody></table>
        ${h.seasons.some((r) => r.w == null) ? '<p class="fr-small">Seasons played before this page came in show only their finish and points.</p>' : ''}` : ''}
      </div>`);
      root.appendChild(body);
    }
  });
})();
