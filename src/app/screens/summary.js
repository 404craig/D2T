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

  // ---------- share (Craig, 13 Oct; design/prototype/share-cards.html): image and a short message ending in a dare ----------
  // Built ahead so Share opens at once (core/share.js draws the frame: logo, tag, faded crest, dare band).
  function runShare(o) {
    const { F, club, S, line, daily, mode, met, car, x, n, rel, rows } = o;
    const G = D2T.game, ord = D2T.ordinal, nm = club.full || club.name, L = D2T.share.LINK, sim = G.isSim();
    const mon = (d) => { const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], [, m, dd] = d.split('-'); return `${+dd} ${M[+m - 1]}`; };
    const they = sim ? 'FORECAST' : 'THEY FINISHED';
    let spec;
    if (x) {
      const xn = G.xName(), seasons = (car.seasons || []).concat([{ season: S.season, finish: F.finish, sim }]);
      const start = car.start || { season: S.season, replaced: S.clubs[G.eng().club].name };
      const titles = seasons.filter((z) => z.finish === 1).length, down = F.finish > n - rel;
      if (seasons.length < 2) {
        spec = { c: '#12F06C', tag: 'Club X', dare: 'From nowhere to champions. Your go',
          text: `DROP2TOP Club X\nI built ${xn} from nothing, put them in ${start.replaced}'s place in ${S.season} and ${F.finish === 1 ? 'won the league' : `finished ${ord(F.finish)}`}.\n${F.finish === 1 ? 'From nowhere to champions.' : 'Champions next time.'}\nYour turn.\n${L}`,
          draw: (g, im, k) => { k.club(im.crest, xn, `${S.season} · in ${start.replaced}'s place`); k.duo(`${start.replaced.toUpperCase()} FINISHED`, ord(F.histFinish), `${F.histPts} pts`, 'WE FINISHED', ord(F.finish), `${F.pts} pts`, '#12F06C');
            k.fit(F.finish === 1 ? 'CHAMPIONS' : ord(F.finish).toUpperCase(), k.W / 2, 975, 960, 900, 112, true, '#12F06C'); } };
      } else {
        const last = seasons.slice(-5), list = last.map((z) => `${z.season} ${ord(z.finish)}${z.sim ? ' (forecast)' : ''}`).join(' · ');
        spec = { c: '#12F06C', tag: `Club X · Season ${seasons.length}`, dare: titles ? `Build a dynasty. Beat ${titles} title${titles === 1 ? '' : 's'}` : 'Build a dynasty. Win one',
          text: `DROP2TOP Club X · Career\n${xn}: ${seasons.length} seasons, ${titles} title${titles === 1 ? '' : 's'}.\n${list}\n${down ? `Relegated in season ${seasons.length}, after ${titles} title${titles === 1 ? '' : 's'}.\n` : ''}Started in ${start.replaced}'s place. Can you build a dynasty?\n${L}`,
          draw: (g, im, k) => {
            k.club(im.crest, xn, `Career from ${start.season} · in ${start.replaced}'s place`);
            const gap = 18, bw = (900 - gap * (last.length - 1)) / last.length;
            last.forEach((z, i) => {
              const bx = 90 + i * (bw + gap), won = z.finish === 1;
              k.box(bx, 668, bw, 270, 22, won ? '#12F06C' : '#222226', won ? '#0F2A1A' : '#0E0E10');
              k.fit(z.season, bx + bw / 2, 700, bw - 20, 800, 32, false, '#8E8E99');
              k.fit(ord(z.finish), bx + bw / 2, 748, bw - 20, 900, 104, true, won ? '#12F06C' : '#FFFFFF');
              if (won) k.fit('CHAMPIONS', bx + bw / 2, 868, bw - 20, 900, 26, false, '#12F06C', 'center', '3px');
              if (z.sim) k.fit('FORECAST', bx + bw / 2, won ? 900 : 868, bw - 20, 800, 22, false, '#8E8E99', 'center', '2px');
            });
            k.fit(`${titles} TITLE${titles === 1 ? '' : 'S'} IN ${seasons.length} SEASONS`, k.W / 2, 990, 960, 900, 84, true, '#12F06C');
          } };
      }
      spec.imgs = { crest: club.crest }; spec.ghost = club.crest;
    } else if (mode === 'dare2dream') {
      spec = { c: '#3BA4FF', tag: 'Dare2Dream', dare: 'Draft 11. Beat their real finish',
        text: `DROP2TOP Dare2Dream\nI drafted ${nm} ${S.season} from nothing and finished ${ord(F.finish)}. They really finished ${ord(F.histFinish)}.\n${met ? 'Dream achieved.' : 'Fell short.'}\nPick any club and beat their real finish.\n${L}`,
        draw: (g, im, k) => { k.club(im.crest, nm, `${S.season} · drafted from nothing`); k.duo('THEY FINISHED', ord(F.histFinish), `${F.histPts} pts`, 'I FINISHED', ord(F.finish), `${F.pts} pts`, '#3BA4FF');
          k.fit(met ? 'DREAM ACHIEVED' : 'FELL SHORT', k.W / 2, 975, 960, 900, 112, true, '#3BA4FF'); } };
    } else if (daily) {
      // the Daily (Craig, 29 Oct; "3 · Team sheet" in design/prototype/daily-share.html): the club's wash, the white tag,
      // their finish to yours, The Rise in places, then a team sheet of the top scorer and the best card
      const num = G.dailyNumber(daily), M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], [, mm, dd] = daily.split('-');
      const day = `${ord(+dd)} ${M[+mm - 1]}`, won = F.finish === 1, acc = club.accent || '#FFFFFF', txt = club.text || '#FFFFFF';
      const places = `${sign(F.rise)} ${Math.abs(F.rise) === 1 ? 'place' : 'places'}`;
      const ts = rows && rows.topScorer, bc = rows && rows.best;
      const lines = ['*DROP2TOP Daily Challenge*', '',   // bold in WhatsApp; the number and date are on the picture's tag (Craig, 29 Oct)
        `${nm} ${S.season}`, `They went down in ${ord(F.histFinish)}.`,
        won ? `I won the league on ${F.pts} pts.` : `I finished ${ord(F.finish)} on ${F.pts} pts.`, `The Rise: ${places}`];
      if (ts || bc) lines.push('');
      if (ts) lines.push(`Top scorer: ${ts.name}, ${ts.goals} goal${ts.goals === 1 ? '' : 's'}`);
      if (bc) lines.push(`Best card: ${bc.name}, ${bc.r}`);
      lines.push('', '_Your turn. Beat that!_', L);
      const bestClub = bc && G.club(bc.crest);
      spec = { c: '#FFFFFF', wash: acc, band: acc, ink: club.ink || '#0A0A0A', tag: `Daily #${num} · ${day}`, dare: `Same club today. Beat ${ord(F.finish)}`,
        text: lines.join('\n'), imgs: { crest: club.crest, best: bestClub && bestClub.crest },
        draw: (g, im, k) => {
          const W = k.W;
          k.pic(im.crest, W / 2, 252, 236);
          k.fit(String(nm).toUpperCase(), W / 2, 500, 960, 900, 74, true, '#FFFFFF');
          k.fit(S.season, W / 2, 580, 960, 600, 38, false, '#E6E6EA');
          // 21st -> 1st, the arrow on the figures' middle
          const a = ord(F.histFinish), b = ord(F.finish), C = 712, gap = 140, wa = k.width(a, 900, 136, true), wb = k.width(b, 900, 136, true), x0 = W / 2 - (wa + gap + wb) / 2;
          k.mid(a, x0, C, 999, 900, 136, true, '#8E8E99', 'left'); k.mid(b, x0 + wa + gap, C, 999, 900, 136, true, txt, 'left');
          g.strokeStyle = '#FFFFFF'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
          const ax = x0 + wa + 26, bx = x0 + wa + gap - 26;
          g.beginPath(); g.moveTo(ax, C); g.lineTo(bx, C); g.moveTo(bx - 24, C - 22); g.lineTo(bx, C); g.lineTo(bx - 24, C + 22); g.stroke();
          k.fit(`WENT DOWN${F.histPts != null ? ` · ${F.histPts} PTS` : ''}`, x0 + wa / 2, 790, 440, 800, 26, false, '#8E8E99', 'center', '2px');
          k.fit(`${F.pts} PTS${won ? ' · CHAMPIONS' : ''}`, x0 + wa + gap + wb / 2, 790, 460, 800, 26, false, txt, 'center', '2px');
          // THE RISE: +20 PLACES
          const t1 = 'THE RISE: ', t2 = places.toUpperCase(), w1 = k.width(t1, 900, 54, true), w2 = k.width(t2, 900, 54, true), rx = W / 2 - (w1 + w2) / 2;
          k.fit(t1, rx, 846, 999, 900, 54, true, '#FFFFFF', 'left'); k.fit(t2, rx + w1, 846, 999, 900, 54, true, txt, 'left');
          // the team sheet: numbers right-aligned in one column, their words after them
          const row = (y, icon, label, name, num, word, col) => {
            k.box(90, y, 900, 100, 22); const c = y + 50;
            icon();
            k.fit(label, 206, y + 18, 560, 800, 22, false, '#8E8E99', 'left', '3px');
            k.fit(String(name).toUpperCase(), 206, y + 46, 560, 900, 40, true, '#FFFFFF', 'left');
            k.mid(num, 826, c, 220, 900, 64, true, col, 'right'); k.mid(word, 840, c, 140, 800, 22, false, col, 'left', '2px');
          };
          if (ts) row(930, () => k.ball(150, 980, 28), 'TOP SCORER', ts.name, String(ts.goals), ts.goals === 1 ? 'GOAL' : 'GOALS', txt);
          if (bc) { const Lc = k.LVC[bc.lv] || k.LVC.bronze; row(1044, () => k.card(126, 1056, 58, bc, im.best), 'BEST CARD', bc.name, String(bc.r), Lc[6], Lc[5]); }
        } };
    } else {
      spec = { c: club.text, tag: 'Classic', dare: `Beat my rise of ${sign(F.rise)}`,
        text: `DROP2TOP\nI took ${nm} ${S.season} from ${ord(F.histFinish)} to ${ord(F.finish)}.\nThe Rise: ${sign(F.rise)} (${F.pts} pts)\nThink you can do better with a side that went down?\n${L}`,
        draw: (g, im, k) => { k.club(im.crest, nm, S.season); k.duo(they, ord(F.histFinish), `${F.histPts} pts`, 'I FINISHED', ord(F.finish), `${F.pts} pts`, club.text);
          k.fit('THE RISE ' + sign(F.rise), k.W / 2, 975, 960, 900, 112, true, club.text); k.wrap(line, k.W / 2, 1098, 860, 500, 32, '#BDBDC6', 42); } };
    }
    spec.imgs = spec.imgs || { crest: club.crest }; spec.ghost = spec.ghost || club.crest;
    return D2T.share.build(spec);
  }

  // Share a Daily again from home (Craig, 14 Oct): the same share as its summary, built from the day's best go in the record
  D2T.dailyShare = (date) => {
    const G = D2T.game; date = date || G.today();
    G.fillDailyRows && G.fillDailyRows(date);   // a Daily recorded before build 161 gets its rows from its run, if it is still here
    const r = G.dailyResult(date); if (!r) return null;
    const club = G.club(r.club) || { name: r.club, text: '#FFFFFF' };
    return runShare({ F: { finish: r.finish, histFinish: r.histFinish, rise: r.rise, pts: r.pts, histPts: r.histPts }, club, S: { season: r.season }, line: '', daily: date, mode: 'classic', rows: { topScorer: r.topScorer || null, best: r.best || null } });
  };

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
          ${x && !nx ? `<p class="sm-banter">Relegated. The career ends here.</p>` : ''}
          <button class="btn btn-ghost fr-btn-wide" data-act="table">Final table</button>
          ${x ? '<button class="btn btn-ghost fr-btn-wide" data-act="history">Club history</button>' : ''}
          <div class="se-pad"></div>
          <div class="se-pad"></div>
        </div>
      </div>`);
      root.appendChild(body);

      // the end sheet (Craig, 14 Oct; D2T.endSheet): no bottom bar here. Share, then Play again (the Daily: Go again; Club X:
      // Next season while the career is open, and New career), then Home. Dragged closed, a "Season over" peek bar
      // brings it back; the summary scrolls behind it.
      // the Daily card's team sheet (Craig, 29 Oct): the top scorer and the best card (highest-rated in the XI, the next
      // highest when he is also the top scorer)
      const tsC = F.topScorer && GAME.card(S, F.topScorer.id), bcC = F.bestCard != null && GAME.card(S, F.bestCard);
      const rows = { topScorer: tsC ? { name: tsC.name, goals: F.topScorer.goals } : null, best: bcC ? { name: bcC.name, r: bcC.ovr, lv: bcC.level, p: bcC.pos, crest: bcC.club } : null };
      const sh = runShare({ F, club, S, line, daily, mode: GAME.mode(), met, car, x, n, rel, rows });
      const colour = daily ? '#FFFFFF' : x ? '#12F06C' : GAME.mode() === 'dare2dream' ? '#3BA4FF' : club.text, ink = daily || x || GAME.mode() === 'dare2dream' ? '#0A0A0A' : club.ink;
      const again = () => { if (daily) { GAME.restartDaily(); D2T.go(GAME.stepFor() || 'table'); return; } const m = GAME.mode(); GAME.newRun(m); D2T.go('spin'); };
      const buttons = [{ k: 'share', label: 'Share result', fn: () => { window.D2TSound && window.D2TSound.play('share'); D2T.share.send(sh); } }];
      if (nx) buttons.push({ k: 'next', label: `Next season · ${D2T.esc(nx.key)}`, primary: true, fn: () => { if (GAME.nextSeason()) D2T.go('table'); } });
      // Final table (and Club history in Club X) in the sheet too (Craig, 25 Oct), under Next season / Play again
      const tableBtn = { k: 'table', label: 'Final table', peek: true, fn: () => openTable() };
      const histBtn = x ? { k: 'history', label: 'Club history', fn: () => D2T.go('history') } : null;
      if (nx) buttons.push(tableBtn, ...(histBtn ? [histBtn] : []));
      buttons.push({ k: 'again', label: daily ? 'Go again' : x ? 'New career' : 'Play again', primary: !nx, fn: again });
      if (!nx) buttons.push(tableBtn, ...(histBtn ? [histBtn] : []));
      buttons.push({ k: 'home', label: 'Home', fn: () => D2T.go('home') });
      const lead = x ? `<b>${D2T.esc(GAME.xName())}</b> finished ${D2T.ordinal(F.finish)} in ${D2T.esc(S.season)}${nx ? `. The career goes on to ${D2T.esc(nx.key)}.` : '.'}`
        : dream ? `<b>${D2T.esc(club.name)}</b> finished ${D2T.ordinal(F.finish)}. The dream was ${goal.toLowerCase()}.`
        : `<b>${D2T.esc(club.name)}</b> finished ${D2T.ordinal(F.finish)}, ${F.rise > 0 ? `${F.rise} place${F.rise === 1 ? '' : 's'} above` : F.rise < 0 ? `${-F.rise} place${F.rise === -1 ? '' : 's'} below` : 'level with'} ${hw.toLowerCase()}.`;
      const end = D2T.endSheet({ title: `Season over · ${dream ? (met ? (x ? 'Champions' : 'Dream achieved') : 'Fell short') : headline(F)}`, lead, colour, ink, buttons, peek: 'Season over', host: root });
      this._end = end;
      // the summary first (Craig, 25 Oct): the sheet starts collapsed, its "Season over" peek bar brings it up
      end.peek(); this._kill = null;
      const hist = body.querySelector('[data-act="history"]'); if (hist) hist.onclick = () => D2T.go('history');
      function openTable() {
        const rows = GAME.standings(null);
        D2T.sheet({ title: `Final table ${D2T.esc(S.season)}`, body: `<div class="se-run" style="--se-acc:${club.accent};--se-text:${club.text};--se-acc-b:${SE.rgba(club.accent, 0.55)}"><div class="se-table">${SE.tableHead()}${rows.map((r, i) => SE.rowHTML(r, club.name, i === n - rel - 1 ? 'se-zone' : '')).join('')}</div></div>` });
      }
      body.querySelector('[data-act="table"]').onclick = openTable;
      body.querySelectorAll('.sm-award').forEach((b) => { b.onclick = () => { const c = awards.find(([, x]) => String(x.id) === b.dataset.id); if (c) D2T.cards.openLarge(b.querySelector('.d2c') || b, D2T.cards.player(c[1], { w: 280 }), {}); }; });
    },
    unmount() { this._kill && this._kill(); }
  });
})();
