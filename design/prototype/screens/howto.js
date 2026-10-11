// How to play (black): one-line objective, five short steps, card levels with real cards, the six stats.
(function () {
  function pickCards() {
    const run = D2T.data.runs['Wolves 2011/12'];
    const all = run.squad.concat(run.transferPool);
    const find = (fn) => all.find(fn);
    return [
      { card: find((c) => c.name === 'Stephen Hunt') || find((c) => c.level === 'bronze'), lv: 'bronze', rule: 'Under 65' },
      { card: find((c) => c.name === 'Matt Jarvis') || find((c) => c.level === 'silver'), lv: 'silver', rule: '65 to 74' },
      { card: find((c) => c.level === 'gold' && c.ovr < 80) || find((c) => c.level === 'gold'), lv: 'gold', rule: '75 and up' },
      { card: run.squad.find((c) => c.level === 'baller') || find((c) => c.level === 'baller'), lv: 'baller', rule: "A club's best player" },
      { card: D2T.data.sampleLegend, lv: 'legend', rule: 'Rare all-time great seasons' }
    ].filter((x) => x.card);
  }

  D2T.screen('howto', {
    title: 'How to play', theme: 'black',
    mount(root) {
      root.appendChild(D2T.topbar());
      const cards = pickCards();
      const body = D2T.h(`<div class="screen-body fr-page">
        <h1 class="fr-title">How to play</h1>
        <p class="fr-goal">Take a club that went down.<br>Keep them up, or take them <em>all the way to the title.</em></p>

        <h2 class="fr-h2">The season</h2>
        <ol class="fr-steps">
          <li><b>Pick a club</b>Spin for 3 real clubs that were relegated. Choose one.</li>
          <li><b>Set your XI</b>Pick a formation and your best eleven from that season's squad.</li>
          <li><b>Play 38 games</b>Kick off each match or skip to the score. Everyone else plays their real results.</li>
          <li><b>Transfer rolls</b>Through the season you get a roll: 3 cards appear and you sign one.</li>
          <li><b>Finish high</b>Your final place earns achievements: beat the drop, top half, top 3, the title.</li>
        </ol>

        <h2 class="fr-h2">Card colours</h2>
        <p class="fr-lead" style="margin-bottom:6px">The big number is the rating. The colour tells you the level.</p>
        <div class="fr-levels">${cards.map((x) => `<div class="fr-lv">${D2T.cards.player(x.card, { w: 128, shine: x.lv === 'baller' || x.lv === 'legend' })}
          <div class="fr-lv-name" style="color:${D2T.LV[x.lv].text}">${D2T.LV[x.lv].name}</div><div class="fr-lv-rule">${x.rule}</div>
          <div class="fr-lv-who">${D2T.esc(x.card.name)}, ${D2T.esc(x.card.club)} ${x.card.season || '2011/12'}</div></div>`).join('')}</div>

        <h2 class="fr-h2">The six stats</h2>
        <div class="fr-stats">
          <div class="fr-stat"><b>GOL</b><span>Scoring rate</span></div>
          <div class="fr-stat"><b>IMP</b><span>Share of the club's goals</span></div>
          <div class="fr-stat"><b>FIT</b><span>Games played</span></div>
          <div class="fr-stat"><b>WIN</b><span>Club results</span></div>
          <div class="fr-stat"><b>DEF</b><span>Club defence</span></div>
          <div class="fr-stat"><b>EXP</b><span>Experience</span></div>
        </div>
        <p class="fr-small" style="font-size:13px;color:var(--soft);margin-top:14px">Goalkeepers swap GOL, IMP and DEF for:</p>
        <div class="fr-stats" style="margin-top:8px">
          <div class="fr-stat gk"><b>WAL</b><span>Goals conceded. Fewer let in, higher WAL.</span></div>
          <div class="fr-stat gk"><b>CLN</b><span>Clean sheets</span></div>
        </div>
        <p class="fr-small">Every card comes from that player's real season.</p>
      </div>`);
      root.appendChild(body);
    }
  });
})();
