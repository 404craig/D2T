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

  // ---------- the season's motions (Craig, 31 Oct, build 196; design/prototype/anim-polish.html) ----------
  // The finish lands like Goal Rush's fruit machine (rollNumber in goals.js: the same steps, a random place 1 to 20 each
  // tick, never the final one, the blur on all but the last three, numberTick every other tick), then its suffix wipes
  // in, the verdict tag stamps in with a glint and the three tiles count up. The targets fill one after another as they
  // scroll into view, and both lines of the graph draw left to right together. A tap jumps each to its end.
  function motion(body, F) {
    const MO = D2T.mo, posEl = body.querySelector('.sm-pos'), headEl = body.querySelector('.sm-head');
    const num = String(F.finish), ord = D2T.ordinal(F.finish);
    posEl.innerHTML = `<span class="sm-pn">${num}</span><span class="sm-ps">${D2T.esc(ord.slice(num.length))}</span>`;
    if (!MO || MO.still()) return;
    const tiles = [...body.querySelectorAll('.sm-tile b')];
    tiles.forEach((b) => { b.dataset.v = b.textContent; b.textContent = MO.startText(b.textContent); });
    headEl.classList.add('sm-hold');
    let ended = false;
    const timers = [];
    const later = (f, ms) => timers.push(setTimeout(f, ms));
    const end = () => {
      if (ended) return; ended = true;
      timers.forEach(clearTimeout); MO.untrack(seq);
      headEl.classList.remove('sm-hold'); headEl.style.animation = 'none';
      tiles.forEach((b) => { if (!b.querySelector('.mo-odo')) b.textContent = b.dataset.v; });
    };
    const seq = MO.track({ finish() { if (ended) return; end(); tiles.forEach((b) => { b.textContent = b.dataset.v; }); } });
    const stamp = () => {
      headEl.classList.remove('sm-hold'); headEl.style.animation = 'none';
      headEl.animate([{ transform: 'scale(1.5) rotate(-4deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      MO.glint(headEl, { delay: 260, dur: 480 });
      later(() => { end(); tiles.forEach((b, k) => MO.odometer(b, b.dataset.v, { delay: k * 140, dur: 700 })); }, 320);
    };
    // the finish is there at once, number and suffix together (Craig, 31 Oct, build 206: the roll and the suffix wipe looked
    // terrible); only the verdict tag stamps in and the tiles count up
    later(stamp, 300);

    // the targets you hit fill one after another as the row scrolls into view; the missed ones stay dashed
    const ach = body.querySelector('.sm-ach'), on = [...body.querySelectorAll('.sm-ach span.on')];
    if (ach && on.length && window.IntersectionObserver) {
      on.forEach((s) => s.classList.add('sm-wait'));
      const io = new IntersectionObserver((es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const tt = [];
        const done = () => { tt.forEach(clearTimeout); MO.untrack(fm); on.forEach((s) => { s.classList.remove('sm-wait'); s.querySelectorAll('.sm-achf').forEach((x) => x.remove()); }); };
        const fm = MO.track({ finish: done });
        on.forEach((s, k) => tt.push(setTimeout(() => {
          if (!s.isConnected) return;
          const ov = document.createElement('b'); ov.className = 'sm-achf'; ov.textContent = s.textContent; s.appendChild(ov);
          ov.animate([{ clipPath: 'inset(0 100% 0 0 round 12px)' }, { clipPath: 'inset(0 0% 0 0 round 12px)' }], { duration: 380, easing: 'ease-in-out' })
            .finished.catch(() => {}).then(() => { s.classList.remove('sm-wait'); ov.remove(); if (k === on.length - 1) MO.untrack(fm); });
          MO.glint(s, { delay: 300, dur: 480 });
        }, k * 420)));
      }, { threshold: 0.6 });
      io.observe(ach);
    }

    // both lines of the graph draw left to right together: a clip that widens over 1.6 s (the dashes stay dashes)
    const rev = body.querySelector('.sm-rev'), panel = body.querySelector('.sm-ghost');
    if (rev && panel && window.IntersectionObserver) {
      const W = +rev.getAttribute('width'), t0 = performance.now();
      rev.setAttribute('width', '0');
      let raf = 0;
      const full = () => { cancelAnimationFrame(raf); rev.setAttribute('width', String(W)); MO.untrack(gm); };
      const gm = { finish: full };
      const io = new IntersectionObserver((es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setTimeout(() => {
          MO.track(gm);
          const s0 = performance.now();
          const step = (now) => { const p = Math.max(0, Math.min(1, (now - s0) / 1600)), e = 1 - Math.pow(1 - p, 3); rev.setAttribute('width', (W * e).toFixed(1)); if (p < 1 && rev.isConnected) raf = requestAnimationFrame(step); else full(); };
          raf = requestAnimationFrame(step);
        }, Math.max(0, 400 - (performance.now() - t0)));
      }, { threshold: 0.3 });
      io.observe(panel);
    }
  }

  // Your league position each gameweek (solid, club colour) against history's (dashed grey).
  function ghostSVG(mine, hist, n, rel) {
    const W = 340, H = 180, L = 28, R = 10, T = 12, B = 22, w = W - L - R, h = H - T - B, len = Math.max(hist.length, mine.length, 2);
    const x = (i) => L + i * (w / (len - 1)), y = (p) => T + (p - 1) * (h / (n - 1));
    const pts = (a) => a.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
    const grid = [1, Math.round(n / 2), n].map((p) => `<line x1="${L}" x2="${W - R}" y1="${y(p)}" y2="${y(p)}" stroke="#222226" stroke-dasharray="3 4"/><text x="${L - 6}" y="${y(p) + 4}" font-size="10" text-anchor="end" fill="#8E8E99">${p}</text>`).join('');
    return `<svg class="sm-ghost" viewBox="0 0 ${W} ${H}" role="img" aria-label="Your league position each week against history's">
      <rect x="${L}" y="${y(n - rel + 1) - 5}" width="${w}" height="${y(n) - y(n - rel + 1) + 10}" fill="rgba(255,40,80,0.10)"/>${grid}
      <defs><clipPath id="smReveal"><rect class="sm-rev" x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
      <g clip-path="url(#smReveal)"><polyline points="${pts(hist)}" fill="none" stroke="#8E8E99" stroke-width="2" stroke-dasharray="5 4"/>
      <polyline class="sm-line" points="${pts(mine)}" fill="none" stroke="var(--se-text)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></g>
      <text x="${L}" y="${H - 6}" font-size="10" fill="#8E8E99">GW1</text><text x="${W - R}" y="${H - 6}" font-size="10" text-anchor="end" fill="#8E8E99">GW${len}</text></svg>`;
  }

  // ---------- share (Craig, 13 Oct; design/prototype/share-cards.html): image and a short message ending in a dare ----------
  // Built ahead so Share opens at once (core/share.js draws the frame: logo, tag, faded crest, dare band).
  function runShare(o) {
    const { F, club, S, line, daily, mode, met, car, x, n, rel, rows } = o;
    const G = D2T.game, ord = D2T.ordinal, nm = club.full || club.name, L = D2T.share.LINK, sim = G.isSim();
    const ts = rows && rows.topScorer, bc = rows && rows.best, GREEN = '#12F06C';
    const goalsW = (g) => (g === 1 ? 'GOAL' : 'GOALS');
    const placesW = (r) => `${sign(r)} ${Math.abs(r) === 1 ? 'place' : 'places'}`;
    // the team sheet under every season card (Craig, 29 Oct): the top scorer and the best card (the highest-rated in the
    // final XI, the next highest when he is also the top scorer), in the message and as two rows on the picture
    const sheetLines = () => {
      const out = [];
      if (ts || bc) out.push('');
      if (ts) out.push(`Top scorer: ${ts.name}, ${ts.goals} goal${ts.goals === 1 ? '' : 's'}`);
      if (bc) out.push(`Best card: ${bc.name}, ${bc.r}`);
      return out;
    };
    const bestImg = bc && G.club(bc.crest) && G.club(bc.crest).crest;
    const sheetRows = (k, im, col, scorer = ts, best = bc, l1 = 'TOP SCORER', l2 = 'BEST CARD') => {
      if (scorer) k.row(930, { icon: 'ball', label: l1, name: scorer.name, n: scorer.goals, u: goalsW(scorer.goals), col });
      if (best) { const Lc = k.LVC[best.lv] || k.LVC.bronze; k.row(1044, { icon: 'card', label: l2, name: best.name, n: best.r, u: Lc[6], col: Lc[5], p: best, im: im.best }); }
    };
    const end = (lines) => lines.concat(['', '_Your turn. Beat that!_', L]).join('\n');
    const acc = club.accent || '#FFFFFF', txt = club.text || '#FFFFFF', won = F.finish === 1;
    let spec;
    if (x) {
      const xn = G.xName(), seasons = (car.seasons || []).concat([{ season: S.season, finish: F.finish, sim }]);
      const start = car.start || { season: S.season };
      if (seasons.length < 2) {
        // Club X, the first season: no replaced club anywhere, just where your drafted 11 finished
        const lines = ['*DROP2TOP Club X*', '', `Drafted from nothing, ${S.season}`, won ? `Won the league on ${F.pts} pts.` : `Finished ${ord(F.finish)} on ${F.pts} pts.`];
        if (won) lines.push('From nowhere to champions.');
        spec = { c: GREEN, wash: GREEN, band: GREEN, ink: '#0A0A0A', ghostAlpha: 0.07, tag: 'Club X', dare: 'Draft 11. Win the league',
          text: end(lines.concat(sheetLines())), imgs: { crest: club.crest, best: bestImg },
          draw: (g, im, k) => {
            k.clubBlock(im.crest, xn, `${S.season} · drafted from nothing`);
            k.mid(ord(F.finish), k.W / 2, 700, 900, 900, 170, true, GREEN);
            k.fit(won ? `CHAMPIONS · ${F.pts} PTS` : `${F.pts} PTS`, k.W / 2, 790, 900, 800, 28, false, GREEN, 'center', '3px');
            if (won) k.line2('FROM NOWHERE ', 'TO CHAMPIONS', GREEN); else k.line2('FINISHED ', `${ord(F.finish).toUpperCase()} OF ${n}`, GREEN);
            sheetRows(k, im, GREEN);
          } };
      } else {
        // Club X, season 2 on: the career's climb down a league table, the record, the all-time top scorer and best player
        const titles = seasons.filter((z) => z.finish === 1).length, N = seasons.length, short = (sk) => String(sk).slice(2);
        const H = G.careerHistory(), top = H.top;
        const bests = H.seasons.map((r) => r.bestCard).filter(Boolean).concat(bc ? [bc] : []);
        const bp = bests.sort((a, b) => b.r - a.r)[0] || null, bpImg = bp && G.club(bp.crest) && G.club(bp.crest).crest;
        const cnt = (f) => seasons.filter(f).length, pl = (v, w) => `${v} ${w}${v === 1 ? '' : 's'}`;
        const lines = [`*DROP2TOP Club X · Season ${N}*`, '', `Drafted from nothing in ${start.season}`, '', 'My record:',
          `${pl(titles, 'title')} · ${cnt((z) => z.finish <= 3)} top 3 · ${cnt((z) => z.finish <= n / 2)} top half · ${cnt((z) => z.finish <= n - rel)} beat the drop`];
        if (top || bp) lines.push('');
        if (top) lines.push(`All-time top scorer: ${top.name}, ${top.goals} goal${top.goals === 1 ? '' : 's'}`);
        if (bp) lines.push(`Best player: ${bp.name}, ${bp.r}`);
        spec = { c: GREEN, wash: GREEN, band: GREEN, ink: '#0A0A0A', ghostAlpha: 0.07, tag: `Club X · Season ${N}`,
          dare: titles ? `Build a dynasty. Beat ${pl(titles, 'title')}` : 'Build a dynasty. Win one',
          text: end(lines), imgs: { crest: club.crest, best: bpImg },
          draw: (g, im, k) => {
            k.pic(im.crest, k.W / 2, 248, 190);
            k.fit(String(xn).toUpperCase(), k.W / 2, 452, 960, 900, 70, true, '#FFFFFF');
            k.fit(`Drafted from nothing in ${short(start.season)}`, k.W / 2, 528, 960, 600, 34, false, '#E6E6EA');
            k.line2(`${titles} TITLE${titles === 1 ? '' : 'S'} `, `IN ${N} SEASONS`, GREEN, 592);
            k.climb(seasons.map((z) => [short(z.season), z.finish, z.finish === 1]), 676, 236);
            sheetRows(k, im, GREEN, top, bp, 'ALL-TIME TOP SCORER', 'BEST PLAYER');
          } };
      }
      spec.ghost = club.crest;
    } else if (mode === 'dare2dream') {
      // Dare2Dream: their real finish against yours, then Dream achieved (or Fell short) in places
      const line = met ? ['DREAM ACHIEVED: ', F.rise > 0 ? placesW(F.rise).toUpperCase() : 'CHAMPIONS AGAIN'] : ['FELL SHORT: ', F.rise === 0 ? 'SAME PLACE' : placesW(F.rise).toUpperCase()];
      const lines = ['*DROP2TOP Dare2Dream*', '', `${nm} ${S.season}, drafted from nothing`, `They really finished ${ord(F.histFinish)}.`,
        won ? `I won the league on ${F.pts} pts.` : `I finished ${ord(F.finish)} on ${F.pts} pts.`, `${line[0][0] + line[0].slice(1, -2).toLowerCase()}: ${line[1].toLowerCase()}`];
      spec = { c: '#3BA4FF', wash: acc, band: acc, ink: club.ink || '#0A0A0A', tag: 'Dare2Dream', dare: 'Draft 11. Beat their real finish',
        text: end(lines.concat(sheetLines())), imgs: { crest: club.crest, best: bestImg },
        draw: (g, im, k) => {
          k.clubBlock(im.crest, nm, `${S.season} · drafted from nothing`);
          k.result(ord(F.histFinish), ord(F.finish), txt, `REAL FINISH${F.histPts != null ? ` · ${F.histPts} PTS` : ''}`, `${F.pts} PTS${won ? ' · CHAMPIONS' : ''}`);
          k.line2(line[0], line[1], txt);
          sheetRows(k, im, txt);
        } };
    } else {
      // Classic and the Daily (Craig, 29 Oct; "3 · Team sheet" in design/prototype/daily-share.html): the club's wash, their
      // finish to yours, The Rise in places, then the team sheet; the Daily's tag white with its number and date
      const places = placesW(F.rise);
      const lines = [daily ? '*DROP2TOP Daily Challenge*' : '*DROP2TOP Classic*', '',   // bold in WhatsApp; the Daily's number and date are on its tag
        `${nm} ${S.season}`, `They went down in ${ord(F.histFinish)}.`,
        won ? `I won the league on ${F.pts} pts.` : `I finished ${ord(F.finish)} on ${F.pts} pts.`, `The Rise: ${places}`];
      let tag = 'Classic', tagC = txt, dare = `Beat my rise of ${sign(F.rise)}`;
      if (daily) {
        const num = G.dailyNumber(daily), M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], [, mm, dd] = daily.split('-');
        tag = `Daily #${num} · ${ord(+dd)} ${M[+mm - 1]}`; tagC = '#FFFFFF'; dare = `Same club today. Beat ${ord(F.finish)}`;
      }
      spec = { c: tagC, wash: acc, band: acc, ink: club.ink || '#0A0A0A', tag, dare,
        text: end(lines.concat(sheetLines())), imgs: { crest: club.crest, best: bestImg },
        draw: (g, im, k) => {
          k.clubBlock(im.crest, nm, S.season);
          k.result(ord(F.histFinish), ord(F.finish), txt, `WENT DOWN${F.histPts != null ? ` · ${F.histPts} PTS` : ''}`, `${F.pts} PTS${won ? ' · CHAMPIONS' : ''}`);
          k.line2('THE RISE: ', places.toUpperCase(), txt);
          sheetRows(k, im, txt);
        } };
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
        <div class="sm-crestwrap" aria-hidden="true"><div class="sm-crest" style="background-image:url('${club.crest}')"></div></div>
        <div class="sm-in">
          <div class="se-kicker">Season over · ${D2T.esc(S.season)}</div>
          <div class="sm-title"><img class="sm-badge" src="${club.crest}" alt=""><h1 class="se-h1">${D2T.esc(club.full || club.name)}</h1></div>
          <div class="sm-head${dream && !met ? ' sm-miss' : ''}">${dream ? (met ? (x ? 'Champions' : 'Dream achieved') : 'Fell short') : headline(F)}</div>
          <div class="sm-finish"><span class="sm-pos">${D2T.ordinal(F.finish)}</span>
            <span class="sm-sub"><b>${F.pts} pts · W${F.w} D${F.d} L${F.l}</b><span>${hw}: ${D2T.ordinal(F.histFinish)}, ${F.histPts} pts</span></span></div>
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
          ${x && car.n > 1 ? `<p class="sm-banter">Season ${car.n} of your career${car.seasons.length ? `: ${car.seasons.filter((z) => z.finish === 1).length + (F.finish === 1 ? 1 : 0)} title${car.seasons.filter((z) => z.finish === 1).length + (F.finish === 1 ? 1 : 0) === 1 ? '' : 's'} so far` : ''}.</p>` : ''}
          ${x && !nx ? `<p class="sm-banter">Relegated. The career ends here.</p>` : ''}
          <button class="btn btn-ghost fr-btn-wide" data-act="table">Final table</button>
          ${x ? '<button class="btn btn-ghost fr-btn-wide" data-act="history">Club history</button>' : ''}
          ${daily ? dailyVs(daily) : ''}
          <div class="se-pad"></div>
          <div class="se-pad"></div>
        </div>
      </div>`);
      root.appendChild(body);
      motion(body, F);
      // the award cards shine once, as their row comes into view (Craig, 1 Nov, build 212: the endless shine on the masked
      // cards repainted them and moved the page on iPhone)
      { const aw = body.querySelector('.sm-awards');
        if (aw && window.IntersectionObserver) { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { aw.classList.add('seen'); io.disconnect(); } }, { threshold: 0.4 }); io.observe(aw); }
        else if (aw) aw.classList.add('seen'); }

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
      // the banter line sits in the sheet under the lead, not on the screen (Craig, 1 Nov, build 212)
      const end = D2T.endSheet({ title: `Season over · ${dream ? (met ? (x ? 'Champions' : 'Dream achieved') : 'Fell short') : headline(F)}`, lead: lead + `<p class="end-banter">${D2T.esc(line)}</p>`, colour, ink, buttons, peek: 'Season over', host: root });
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
