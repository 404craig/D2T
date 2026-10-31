// League (black): one friends table with the four achievement counts and a rating to rank by. Also registers 'stats'.
// Rating: each run scores by its best finish (beat the drop 1, top half 2, top 3 3, title 5), averaged out of 5 as a %.
// The counts are cumulative (a title is also a top 3, top half and beat the drop finish), so
// rating = (drop + half + top3 + 2 x titles) / (runs x 5) x 100, which is the same as the per-run best-finish average.
(function () {
  const rating = (p) => (p.runs ? Math.round(((p.drop + p.half + p.top3 + 2 * p.titles) / (p.runs * 5)) * 100) : 0);

  D2T.screen('league', {
    title: 'League', theme: 'black',
    mount(root) {
      root.appendChild(D2T.topbar({ back: true }));
      const me = D2T.game.record();
      const body = D2T.h(`<div class="screen-body fr-page">
        <h1 class="fr-title">League</h1>
        <p class="fr-lead" style="margin-bottom:14px">You and your friends in one table, ranked on how far you take your clubs.</p>
        <table class="fr-lg"><thead><tr><th>#</th><th>Player</th><th>Drop</th><th>Half</th><th>Top 3</th><th>Title</th><th style="text-align:right">Rating</th></tr></thead><tbody>
          <tr class="me"><td class="k">1</td><td class="n">You<small>${me.runs} run${me.runs === 1 ? '' : 's'}</small></td><td>${me.drop}</td><td>${me.half}</td><td>${me.top3}</td><td>${me.titles}</td><td class="r">${rating(me)}%</td></tr>
        </tbody></table>
        <div class="fr-rate"><span><b>Rating:</b> each run scores its best finish (beat the drop = 1, top half = 2, top 3 = 3, title = 5). Your average out of 5, as a percentage.</span></div>
        <p class="fr-small">Adding friends needs accounts, which are coming next. Your own line is live now.</p>
      </div>`);
      root.appendChild(body);
    }
  });

  // ---------- my stats ----------
  D2T.screen('stats', {
    title: 'Stats', theme: 'black',
    mount(root) {
      root.appendChild(D2T.topbar({ back: true }));
      const rec = D2T.game.record(), runs = D2T.game.classicRuns(), dr = D2T.game.dreamRecord(), xr = D2T.game.xRecord();
      const dreamClubs = Object.entries(D2T.state.record.dreamClubs || {}).sort((a, b) => (b[1].dream ? 1 : 0) - (a[1].dream ? 1 : 0) || a[1].finish - b[1].finish);
      const best = runs.length ? Math.min(...runs.map((r) => r.finish)) : null;
      const clubs = Object.entries(D2T.state.record.clubs).sort((a, b) => a[1].finish - b[1].finish);
      const run = D2T.state.run && D2T.state.run.eng && D2T.state.run.eng.seasonKey && D2T.state.run.eng.phase !== 'summary' ? D2T.run() : null;
      const body = D2T.h(`<div class="screen-body fr-page">
        <h1 class="fr-title">My stats</h1>
        <p class="fr-lead" style="margin-bottom:14px">Your record across every full season of Classic, the Daily and Club X, then Dare2Dream and Club X on their own.</p>
        ${D2T.frRecord(rec, 'dark')}
        <h2 class="fr-h2">Runs</h2>
        <div class="fr-panel">
          <div class="fr-row"><span>Runs played</span><span>${rec.runs}</span></div>
          <div class="fr-row"><span>Rating</span><span class="fr-green">${rating(rec)}%</span></div>
          <div class="fr-row"><span>Best finish</span><span>${best ? D2T.ordinal(best) : '-'}</span></div>
          <div class="fr-row"><span>Best rise</span><span>${rec.bestRise == null ? '-' : (rec.bestRise > 0 ? '+' : '') + rec.bestRise}</span></div>
          <div class="fr-row"><span>Relegated</span><span>${Math.max(0, rec.runs - rec.drop)}</span></div>
          ${run ? `<div class="fr-row"><span>Current run</span><span>${D2T.esc(run.club.name)} ${run.season}, GW ${D2T.game.eng().gw}</span></div>` : ''}
        </div>
        <h2 class="fr-h2">Daily challenge</h2>
        <div class="fr-panel">
          <div class="fr-row"><span>Days played</span><span>${Object.keys(D2T.state.record.daily || {}).length}</span></div>
          <div class="fr-row"><span>Best rise</span><span>${(() => { const d = Object.values(D2T.state.record.daily || {}); if (!d.length) return '-'; const b = Math.max(...d.map((x) => x.rise)); return (b > 0 ? '+' : '') + b; })()}</span></div>
        </div>
        <h2 class="fr-h2">Dare2Dream</h2>
        <div class="fr-panel">
          <div class="fr-row"><span>Runs played</span><span>${dr.runs}</span></div>
          <div class="fr-row"><span>Dreams achieved</span><span class="fr-green">${dr.dreams}</span></div>
          <div class="fr-row"><span>Best rise</span><span>${dr.bestRise == null ? '-' : (dr.bestRise > 0 ? '+' : '') + dr.bestRise}</span></div>
        </div>
        ${dreamClubs.length ? `<div class="fr-clubs" style="margin-top:12px">${dreamClubs.map(([k, c]) => { const [season, name] = k.split(':'); const cl = D2T.game.club(name); return `<div class="fr-club"><img src="${cl.crest}" alt=""><span>${D2T.esc(name)}<small>${season} · best ${D2T.ordinal(c.finish)}${c.dream ? ' · dream' : ''}</small></span></div>`; }).join('')}</div>` : ''}
        <h2 class="fr-h2">Club X</h2>
        <div class="fr-panel">
          <div class="fr-row"><span>Runs played</span><span>${xr.runs}</span></div>
          <div class="fr-row"><span>Titles</span><span class="fr-green">${xr.titles}</span></div>
          <div class="fr-row"><span>Best finish</span><span>${xr.best == null ? '-' : D2T.ordinal(xr.best)}</span></div>
        </div>
        <h2 class="fr-h2">Classic clubs played</h2>
        ${clubs.length ? `<div class="fr-clubs">${clubs.map(([k, c]) => { const [season, name] = k.split(':'); const cl = D2T.game.club(name); return `<div class="fr-club"><img src="${cl.crest}" alt=""><span>${D2T.esc(name)}<small>${season} · best ${D2T.ordinal(c.finish)}</small></span></div>`; }).join('')}</div>` : '<p class="fr-small">No finished seasons yet.</p>'}
      </div>`);
      root.appendChild(body);
    }
  });
})();
