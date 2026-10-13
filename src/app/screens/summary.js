// Season summary (black, club accent): where you finished against history, The Rise, your season line against
// history's, how you changed the league, awards, share and play again. Records the run once (D2T.game.finish).
(function () {
  const D2T = window.D2T, SE = D2T.se;
  const sign = (n) => (n > 0 ? '+' : '') + n;

  const BANTER = {
    champions: ['From the drop to the top. Somebody print the t-shirts.', 'Champions. History has asked for a recount.', 'They went down. You took them to the title. Absolute scenes.'],
    top4: ["Top four with a side that went down. Bit greedy, isn't it?", 'Top four with a relegated squad. The pundits are furious.'],
    tophalf: ['Top half. Not bad for a side history wrote off.', 'Mid-table respectability. Your nan would be proud.'],
    survived: ['Safe. Ugly, but safe. Nobody remembers how.', "Survival. The Great Escape, director's cut."],
    better: ['Still down, but you made them look like a football team at least.', 'Relegated, but with dignity. Well, some.'],
    same: ['Relegated anyway. History was right about this lot.', 'You had the whole league to pick from and still went down. Impressive, in its own way.']
  };
  const banter = (F, seed) => {
    const k = F.stars.champions ? 'champions' : F.finish <= 4 ? 'top4' : F.stars.tophalf ? 'tophalf' : F.stars.survive ? 'survived' : F.rise > 0 || F.gained > 0 ? 'better' : 'same';
    const list = BANTER[k];
    return list[window.D2TE.hash32(seed + '|banter') % list.length];
  };
  const headline = (F) => (F.stars.champions ? 'Champions' : F.finish <= 3 ? 'Top 3' : F.stars.tophalf ? 'Top half' : F.stars.survive ? 'Beat the drop' : 'Relegated');

  // Your league position each gameweek (solid, club colour) against history's (dashed grey).
  function ghostSVG(mine, hist, n, rel) {
    const W = 340, H = 180, L = 28, R = 10, T = 12, B = 22, w = W - L - R, h = H - T - B, len = Math.max(hist.length, mine.length, 2);
    const x = (i) => L + i * (w / (len - 1)), y = (p) => T + (p - 1) * (h / (n - 1));
    const pts = (a) => a.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
    const grid = [1, Math.round(n / 2), n].map((p) => `<line x1="${L}" x2="${W - R}" y1="${y(p)}" y2="${y(p)}" stroke="#222226" stroke-dasharray="3 4"/><text x="${L - 6}" y="${y(p) + 4}" font-size="10" text-anchor="end" fill="#8E8E99">${p}</text>`).join('');
    return `<svg class="sm-ghost" viewBox="0 0 ${W} ${H}" role="img" aria-label="Your league position each week against history's">
      <rect x="${L}" y="${y(n - rel + 1) - 5}" width="${w}" height="${y(n) - y(n - rel + 1) + 10}" fill="rgba(255,40,80,0.10)"/>${grid}
      <polyline points="${pts(hist)}" fill="none" stroke="#8E8E99" stroke-width="2" stroke-dasharray="5 4"/>
      <polyline class="sm-line" points="${pts(mine)}" fill="none" stroke="var(--se-text)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      <text x="${L}" y="${H - 6}" font-size="10" fill="#8E8E99">GW1</text><text x="${W - R}" y="${H - 6}" font-size="10" text-anchor="end" fill="#8E8E99">GW${len}</text></svg>`;
  }

  // ---------- share: text and image built ahead so Share opens at once (Tenaball lesson) ----------
  function buildShare(F, club, season, line, tag) {
    const sim = D2T.game.isSim();
    const text = `DROP2TOP${tag ? ' · ' + tag : ''}\n${club.full || club.name} ${season}\n${sim ? 'Forecast' : 'History'}: ${D2T.ordinal(F.histFinish)}, ${F.histPts} pts\nMine: ${D2T.ordinal(F.finish)}, ${F.pts} pts\nTHE RISE ${sign(F.rise)}\n${line}`;
    const out = { text, file: null };
    try {
      const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
      Promise.all([load(club.crest), load(D2T.ASSET.long)]).then(([cr, logo]) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        if (cr) { g.globalAlpha = 0.14; g.drawImage(cr, W / 2 - 520, 160, 1040, 1040); g.globalAlpha = 1; }
        if (logo) {
          const lw = 700, lh = lw * logo.naturalHeight / logo.naturalWidth, t = document.createElement('canvas'); t.width = lw; t.height = lh;
          const tg = t.getContext('2d'); tg.drawImage(logo, 0, 0, lw, lh); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#fff'; tg.fillRect(0, 0, lw, lh);
          g.drawImage(t, (W - lw) / 2, 80);
        }
        if (cr) g.drawImage(cr, W / 2 - 110, 280, 220, 220);
        g.textAlign = 'center'; g.fillStyle = '#fff';
        g.font = "italic 900 76px 'Exo 2', sans-serif"; g.fillText((club.full || club.name).toUpperCase(), W / 2, 600);
        g.font = "600 44px 'Exo 2', sans-serif"; g.fillStyle = '#BDBDC6'; g.fillText(season + (tag ? ' · ' + tag : ''), W / 2, 662);
        g.fillStyle = '#0E0E10'; g.fillRect(90, 720, 900, 300); g.strokeStyle = '#222226'; g.lineWidth = 3; g.strokeRect(90, 720, 900, 300);
        g.font = "800 38px 'Exo 2', sans-serif"; g.fillStyle = '#8E8E99'; g.fillText(sim ? 'FORECAST' : 'HISTORY', 315, 790); g.fillText('MINE', 765, 790);
        g.font = "italic 900 120px 'Exo 2', sans-serif"; g.fillStyle = '#fff'; g.fillText(D2T.ordinal(F.histFinish), 315, 915); g.fillStyle = club.text; g.fillText(D2T.ordinal(F.finish), 765, 915);
        g.font = "600 38px 'Exo 2', sans-serif"; g.fillStyle = '#BDBDC6'; g.fillText(F.histPts + ' pts', 315, 980); g.fillText(F.pts + ' pts', 765, 980);
        g.font = "italic 900 110px 'Exo 2', sans-serif"; g.fillStyle = club.text; g.fillText('THE RISE ' + sign(F.rise), W / 2, 1150);
        g.font = "500 36px 'Exo 2', sans-serif"; g.fillStyle = '#BDBDC6';
        let yy = 1230, ln = '';
        line.split(' ').forEach((wd) => { const tt = ln ? ln + ' ' + wd : wd; if (g.measureText(tt).width > 900 && ln) { g.fillText(ln, W / 2, yy); yy += 44; ln = wd; } else ln = tt; });
        if (ln) g.fillText(ln, W / 2, yy);
        c.toBlob((b) => { if (b) out.file = new File([b], 'drop2top.png', { type: 'image/png' }); }, 'image/png');
      });
    } catch (e) { /* text only */ }
    return out;
  }
  async function share(sh) {
    try {
      if (sh.file && navigator.canShare && navigator.canShare({ files: [sh.file] })) { await navigator.share({ files: [sh.file], text: sh.text }); return; }
      if (navigator.share) { await navigator.share({ text: sh.text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(sh.text); D2T.sheet({ title: 'Copied', body: '<p class="fr-lead">Your result is copied. Paste it into the group chat.</p>' }); }
    catch (e) { D2T.sheet({ title: 'Your result', body: `<p class="fr-lead" style="white-space:pre-line;user-select:text;-webkit-user-select:text">${D2T.esc(sh.text)}</p>` }); }
  }

  // the Daily: today's result next to your best one, so you can see how today stacks up
  function dailyVs(date) {
    const G = D2T.game, cmp = G.dailyCompare(date), t = cmp.today, b = cmp.best;
    if (!t) return '';
    return `<div class="sm-panel sm-daily"><div class="sm-label">${D2T.esc(G.dailyName(date))}</div>
      <div class="sm-dv"><span><small>Today</small><b>${sign(t.rise)}</b><i>${D2T.ordinal(t.finish)}</i></span>
      <span><small>Your best Daily</small>${b && !cmp.isBest ? `<b>${sign(b.rise)}</b><i>${D2T.esc(b.club)} ${b.season}</i>` : `<b>${sign(t.rise)}</b><i>${b ? 'Today. A new best' : 'Your first Daily'}</i>`}</span></div></div>`;
  }

  D2T.screen('summary', {
    title: 'Season over', theme: 'black',
    mount(root) {
      const GAME = D2T.game, run = D2T.state.run, eng = GAME.eng(), S = GAME.S();
      const F = GAME.finish();
      if (!F) { D2T.go('home'); return; }
      const club = GAME.club(GAME.clubName()), n = S.clubs.length, rel = S.relegationPlaces || 3;
      SE.accent(root, club);
      root.appendChild(D2T.topbar());
      if (!run.summarySound) { run.summarySound = true; D2T.save(); window.D2TSound && window.D2TSound.play(F.stars.champions ? 'champions' : F.finish <= 3 ? 'top3' : F.stars.tophalf ? 'tophalf' : F.stars.survive ? 'survived' : 'relegated'); }

      const line = banter(F, eng.seed);
      const name = (c) => S.clubs[c].name;
      const changes = F.changes.map((c) => {
        const cl = GAME.club(name(c.club));
        const H = GAME.isSim() ? 'Forecast' : 'History';
        const [t, s] = c.kind === 'champion' ? [`${cl.name} are champions`, `${H}: ${name(c.was)}`] : c.kind === 'down' ? [`${cl.name} go down`, `${H}: they stayed up`] : [`${cl.name} stay up`, `${H}: they went down`];
        return `<div class="sm-li"><img src="${cl.crest}" alt=""><span><b>${D2T.esc(t)}</b><small>${D2T.esc(s)}</small></span></div>`;
      }).join('');
      const card = (id) => GAME.card(S, id);
      const awards = [];
      if (F.playerOfSeason != null) { const c = card(F.playerOfSeason); if (c) awards.push(['Player of the season', c]); }
      if (F.topScorer) { const c = card(F.topScorer.id); if (c) awards.push([`Top scorer · ${F.topScorer.goals} goal${F.topScorer.goals === 1 ? '' : 's'}`, c]); }
      if (F.bestSigning) { const c = card(F.bestSigning.id); if (c) awards.push([`Best signing · before GW${F.bestSigning.gw}`, c]); }
      const daily = run.daily || null;
      const dream = GAME.mode() !== 'classic', x = GAME.mode() === 'clubx', met = dream && GAME.dreamMet(F.finish, F.histFinish);
      // a Club X career (Craig, 13 Oct): go on to the next season unless you went down; after 2025/26 "history" is a forecast
      const nx = x ? GAME.careerNext() : null, car = x ? GAME.career() : null, hw = GAME.isSim() ? 'Forecast' : 'History';
      const goal = x ? 'Win the league' : F.histFinish === 1 ? 'Win the league again' : `Finish ${D2T.ordinal(GAME.target(F.histFinish))} or better`;
      const ach = dream ? [[goal, met]] : [['Beat the drop', F.finish <= n - rel], ['Top half', F.finish <= n / 2], ['Top 3', F.finish <= 3], ['Title', F.finish === 1]];

      const body = D2T.h(`<div class="screen-body sm">
        <div class="sm-crest" aria-hidden="true" style="background-image:url('${club.crest}')"></div>
        <div class="sm-in">
          <div class="se-kicker">Season over · ${D2T.esc(S.season)}</div>
          <h1 class="se-h1">${D2T.esc(club.full || club.name)}</h1>
          <div class="sm-head${dream && !met ? ' sm-miss' : ''}">${dream ? (met ? (x ? 'Champions' : 'Dream achieved') : 'Fell short') : headline(F)}</div>
          <div class="sm-finish"><span class="sm-pos">${D2T.ordinal(F.finish)}</span>
            <span class="sm-sub"><b>${F.pts} pts · W${F.w} D${F.d} L${F.l}</b><span>${hw}: ${D2T.ordinal(F.histFinish)}, ${F.histPts} pts</span></span></div>
          ${daily ? dailyVs(daily) : ''}
          <div class="sm-tiles">
            <div class="sm-tile sm-rise"><b>${sign(F.rise)}</b><span>The Rise</span></div>
            <div class="sm-tile"><b>${sign(F.gained)}</b><span>Points on ${hw.toLowerCase()}</span></div>
            <div class="sm-tile"><b>${sign(F.gf - F.ga)}</b><span>Goal difference</span></div>
          </div>
          <div class="sm-panel"><div class="sm-label">Your season against ${hw.toLowerCase()}</div>${ghostSVG(F.positions, F.history, n, rel)}
            <div class="sm-key"><span><i class="sm-k1"></i>You</span><span><i class="sm-k2"></i>${hw}</span></div></div>
          <div class="sm-ach${dream ? ' sm-ach-one' : ''}">${ach.map(([t, on]) => `<span class="${on ? 'on' : ''}">${t}</span>`).join('')}</div>
          ${awards.length ? `<div class="sm-label">Awards</div><div class="sm-awards">${awards.map(([t, c]) => `<button class="sm-award" data-id="${D2T.esc(String(c.id))}" aria-label="${D2T.esc(t)}: ${D2T.esc(c.name)}">${D2T.cards.player(c, { w: 96 })}<span>${D2T.esc(t)}</span></button>`).join('')}</div>` : ''}
          ${changes ? `<div class="sm-label">How you changed ${D2T.esc(S.season)}</div><div class="sm-list">${changes}</div>` : ''}
          <p class="sm-banter">${D2T.esc(line)}</p>
          ${x && car.n > 1 ? `<p class="sm-banter">Season ${car.n} of your career${car.seasons.length ? `: ${car.seasons.filter((z) => z.finish === 1).length + (F.finish === 1 ? 1 : 0)} title${car.seasons.filter((z) => z.finish === 1).length + (F.finish === 1 ? 1 : 0) === 1 ? '' : 's'} so far` : ''}.</p>` : ''}
          ${nx ? `<button class="btn se-btn sm-next" type="button" data-act="next">Next season · ${D2T.esc(nx.key)}</button>` : x ? `<p class="sm-banter">Relegated. The career ends here.</p>` : ''}
          <div class="sm-two"><button class="btn btn-ghost" data-act="table">Final table</button><button class="btn btn-ghost" data-act="again">${daily ? 'Home' : x ? 'Restart' : 'Play again'}</button></div>
          <div class="se-pad"></div>
        </div>
      </div>`);
      const bar = D2T.h(`<footer class="actionbar"><button class="btn se-btn se-wide" type="button" data-act="share">Share result</button>${SE.homeBtn()}</footer>`);
      root.append(body, bar);

      const tag = x ? (met ? 'Club X: champions' : 'Club X') + (car.n > 1 ? ` · season ${car.n}` : '') : dream ? (met ? 'Dare2Dream: dream achieved' : 'Dare2Dream') : '';
      const sh = buildShare(F, club, S.season, line, daily ? `${GAME.dailyName(daily)}${tag ? ' · ' + tag : ''}` : tag);
      if (daily) { const cmp = GAME.dailyCompare(daily); sh.text += `${cmp.isBest ? '\nMy best Daily yet' : cmp.bestLine ? '\n' + cmp.bestLine : ''}\nCan you beat it? 404craig.github.io/D2T`; }
      bar.querySelector('[data-act="share"]').onclick = () => { window.D2TSound && window.D2TSound.play('share'); share(sh); };
      const nb = body.querySelector('[data-act="next"]');
      if (nb) nb.onclick = () => { if (GAME.nextSeason()) D2T.go('table'); };
      body.querySelector('[data-act="again"]').onclick = () => { if (daily) { D2T.go('home'); return; } const m = GAME.mode(); D2T.state.run = null; D2T.save(); GAME.newRun(m); D2T.go('spin'); };
      body.querySelector('[data-act="table"]').onclick = () => {
        const rows = GAME.standings(null);
        D2T.sheet({ title: `Final table ${D2T.esc(S.season)}`, body: `<div class="se-run" style="--se-acc:${club.accent};--se-text:${club.text};--se-acc-b:${SE.rgba(club.accent, 0.55)}"><div class="se-table">${SE.tableHead()}${rows.map((r, i) => SE.rowHTML(r, club.name, i === n - rel - 1 ? 'se-zone' : '')).join('')}</div></div>` });
      };
      body.querySelectorAll('.sm-award').forEach((b) => { b.onclick = () => { const c = awards.find(([, x]) => String(x.id) === b.dataset.id); if (c) D2T.cards.openLarge(b.querySelector('.d2c') || b, D2T.cards.player(c[1], { w: 280 }), {}); }; });
    }
  });
})();
