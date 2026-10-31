// Home v1 (kept, Craig 29 Oct: the stage, home-v2.js, replaced it as the default; D2T.HOME in core/app.js switches back).
// Home (black, the new green as its accent). Also defines D2T.toBlack(next): the move into the game screens,
// where green light glints through the white logo as it shrinks into the small top-left logo.
(function () {
  const STEP_LABEL = { spin: 'Pick a club', table: 'Preview', squad: 'Squad', fixtures: 'Fixtures', match: 'Match day', results: 'Results', standings: 'League table', transfer: 'Transfer' };
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
  // Bottom bar icons: solid and slanted like the Black Italic type, all white (chosen 11 Oct)
  const SK = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="skewX(-10) translate(2 0)">${d}</g></svg>`;
  const TAB_ICON = {
    league: SK('<path d="M6 3h12v4.5a6 6 0 01-12 0z"/><path d="M3 4.5h2.6v1.6A3.4 3.4 0 003.3 6zM18.4 4.5H21a3 3 0 01-2.6 3.3z"/><path d="M10.6 13h2.8v3.6H17V21H7v-4.4h3.6z"/>'),
    stats: SK('<rect x="3" y="13" width="4.6" height="8" rx="1"/><rect x="9.7" y="8.5" width="4.6" height="12.5" rx="1"/><rect x="16.4" y="3" width="4.6" height="18" rx="1"/>'),
    howto: SK('<path d="M6 2.5h12l3 3v11.2L12 21.5 3 16.7V5.5z"/><path class="k" d="M10.1 9.6a2 2 0 013.8.6c0 1.4-2 1.6-2 3h-1.8c0-2.4 2-2.4 2-3.1a.4.4 0 00-.8-.1zM11 14.4h1.9v1.9H11z"/>'),
    account: SK('<circle cx="12" cy="7.5" r="4.3"/><path d="M3.5 21c.8-4.6 4.2-7.2 8.5-7.2s7.7 2.6 8.5 7.2z"/>')
  };

  // card outline (chamfered top corners, shallow point at the bottom), as in .d2c-rim
  const FRAME = '<svg viewBox="0 0 100 128" preserveAspectRatio="none" aria-hidden="true"><polygon points="1,11 11,1 89,1 99,11 99,108 50,127 1,108" stroke-linejoin="round"/></svg>';
  // Coming soon (chosen 12 Oct, "grey sweep"): two grey squares side by side, faded icon, a lock where the arrow would be
  const STEAL_ICON = '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"><path d="M30 14 H70 L80 24 V76 L50 90 L20 76 V24 Z"/><path d="M44 52 H92 M78 38 L92 52 L78 66"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const MODES = [
    { name: 'Head to head', sub: 'Multiplayer online, challenge your friends.', icon: '<span class="fr-soon-vs">VS</span>' },
    { name: 'Steal', sub: 'Every card comes from the club you play next.', icon: STEAL_ICON }
  ];
  D2T.frFrame = FRAME;
  D2T.frRecord = (rec, cls = '') => `<div class="fr-record ${cls}">
      <div class="fr-frame">${FRAME}<b>${rec.drop}</b><span>Beat the drop</span></div>
      <div class="fr-frame">${FRAME}<b>${rec.half}</b><span>Top half</span></div>
      <div class="fr-frame">${FRAME}<b>${rec.top3}</b><span>Top 3</span></div>
      <div class="fr-frame">${FRAME}<b>${rec.titles}</b><span>League titles</span></div></div>`;

  // a run in progress, or a Club X career whose season is over with the next one open (D2T.game.live; Craig, 13 Oct)
  const inRun = () => D2T.game.live();
  // Continue cards: the run on screen, and the other one (a run parked for the daily, or a daily put aside),
  // drawn by viewing it as the run for a moment (nothing is saved).
  function continueCards() {
    let html = inRun() ? continueCard('continue') : '';
    const other = D2T.game.otherRun();
    if (other) { const keep = D2T.state.run; D2T.state.run = other; try { html += continueCard('continue-other'); } finally { D2T.state.run = keep; } }
    return html;
  }
  function continueCard(act) {
    const eng = D2T.game.eng(), data = D2T.run(), c = data.club, run = D2T.state.run;
    const label = run.daily ? D2T.game.dailyName(run.daily, true).replace('Daily Challenge', 'Daily').toUpperCase() : D2T.game.modeName().toUpperCase();   // one line: CONTINUE · DAILY 11 OCT
    const games = data.fixtures.length, played = eng.played.length;
    const where = eng.phase === 'summary' ? `Season ${run.career ? run.career.n : 1} over · Next season waiting` : eng.phase === 'draft' ? `Draft · Shirt ${eng.draft.step + 1} of ${eng.xi.length}` : eng.phase === 'setup' ? 'Pre-season' : `Gameweek ${Math.min(eng.gw, games)} · ${STEP_LABEL[D2T.game.stepFor()] || 'In progress'}`;
    // Club sweep (chosen 11 Oct): light club colour at the left, the true colour across the middle, a deeper shade at the right.
    const mix = D2T.mix, a = c.accent;
    const lum = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((t, v, i) => t + v * [0.2126, 0.7152, 0.0722][i], 0); };
    const dark = lum(a) > 0.33, txt = dark ? (lum(c.ink) < 0.08 ? c.ink : '#0A0A0A') : '#FFFFFF';
    const paint = `--face:linear-gradient(100deg, ${mix(a, '#FFFFFF', 0.4)} 0%, ${a} 30%, ${a} 55%, ${mix(a, '#000000', 0.45)} 100%);--rim:linear-gradient(170deg, ${mix(a, '#FFFFFF', 0.7)}, ${mix(a, '#000000', 0.4)});--txt:${txt};--glowc:${a}44;--track:${dark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.25)'};--tsh:${dark ? 'none' : '0 2px 8px rgba(0,0,0,0.4)'};--goBg:${dark ? '#0A0A0A' : '#FFFFFF'};--goFg:${dark ? '#FFFFFF' : '#0A0A0A'}`;
    const locked = D2T.game.locked(run);   // Dare2Dream locked for repair: the save is kept, the card doesn't open
    if (locked) return `<div class="fr-card-btn fr-cont fr-in fr-locked" style="${paint}" aria-disabled="true" aria-label="${D2T.esc(c.full)} ${data.season}, Dare2Dream is locked for repair">
      <span class="fr-cont-tex"></span><span class="fr-cont-crest"><img src="${c.crestCard || c.crestLight || c.crest}" alt=""></span>
      <span class="fr-cont-txt"><span class="fr-cont-lbl">DARE2DREAM · LOCKED FOR REPAIR</span><span class="fr-cont-name" style="display:block">${D2T.esc(c.name)}</span>
      <span class="fr-cont-meta" style="display:block">${data.season} · ${where} · saved</span></span>
      <span class="fr-soon-lock" aria-hidden="true">${LOCK}</span></div>`;
    return `<button class="fr-card-btn fr-cont fr-in" style="${paint}" data-act="${act}" aria-label="Continue with ${D2T.esc(c.full)} ${data.season}, ${where}">
      <span class="fr-cont-tex"></span><span class="fr-cont-hi"></span><span class="d2t-shine slow" style="${shineBeat()}"></span><span class="fr-cont-crest"><img src="${c.crestCard || c.crestLight || c.crest}" alt=""></span>
      <span class="fr-cont-txt"><span class="fr-cont-lbl">CONTINUE · ${label}</span><span class="fr-cont-name" style="display:block">${D2T.esc(c.name)}</span>
      <span class="fr-cont-meta" style="display:block">${data.season} · ${where}</span>
      <span class="fr-cont-bar" style="display:block"><i style="transform:scaleX(${Math.max(0.03, played / games)})"></i></span></span>
      <span class="fr-go">${ARROW}</span></button>`;
  }

  // Other games cards (chosen 12 Oct, option A): every card the same shape, its game's colour washing in from the right
  // with a thin rim, the game's mark faded behind on the right. Daily white, Dare2Dream blue, Club X green, Goal Rush yellow, Tenaball purple.
  const gameCard = ({ c, attrs, tag, big, sub, mark, cls = '', label, href, locked }) => {
    const inner = `<span class="fr-gm-mark" aria-hidden="true">${mark}</span>
      <span class="fr-gm-txt"><span class="fr-tag">${tag}</span><span class="fr-big">${big}</span><span class="fr-sub">${sub}</span></span>
      ${locked ? `<span class="fr-soon-lock" aria-hidden="true">${LOCK}</span>` : `<span class="fr-go">${ARROW}</span>`}`;
    if (locked) return `<div class="fr-card-btn fr-gm fr-locked ${cls}" style="--c:${c}" aria-disabled="true" aria-label="${label}, locked for repair">${inner}</div>`;
    return href ? `<a class="fr-card-btn fr-gm ${cls}" style="--c:${c}" href="${href}" target="_blank" rel="noopener" aria-label="${label}">${inner}</a>`
      : `<button class="fr-card-btn fr-gm ${cls}" style="--c:${c}" ${attrs} aria-label="${label}">${inner}</button>`;
  };

  // Goal Rush card (yellow, was 433 Goals; UI_SPEC 8f): carry on a game in progress, or your best so far.
  function g433Card() {
    const g = D2T.state.g433, n = g && g.filled ? g.filled.length : 0;
    const shape = g && g.formation ? D2T.game.g433.shapeText(g.formation) : '';
    // two lines, no record (Craig, 13 Oct); a game in progress still says so
    const sub = 'Pick 11 real players whose career goals hit the target exactly.' + (n > 0 && n < 11 ? ` Carry on: ${shape ? shape + ', ' : ''}${n} of 11 picked.` : '');
    return gameCard({ c: '#FFD21F', attrs: 'data-act="g433"', label: 'Goal Rush', tag: 'GOAL RUSH', big: 'Score the exact number of goals', sub, mark: `<img src="${window.D2T_GOALRUSH_LOGO || ''}" alt="">` });
  }

  // Unbeaten Run card (cyan; Craig's higher or lower game, 12 Oct): the question wording, then your best run.
  function ubCard() {
    const sub = 'One stat, real Premier League numbers. How long can you stay unbeaten?';   // no record on the card (Craig, 13 Oct)
    return gameCard({ c: '#22D3EE', attrs: 'data-act="unbeaten"', label: 'Unbeaten Run', tag: 'UNBEATEN RUN', big: 'Higher or lower?', sub, mark: D2T.ubMark || '' });
  }

  // The Daily strip (Craig, 29 Oct; "C, the strip, through the day" in design/prototype/home-daily.html): a slim strip
  // between the logo and Classic, today's crest, club and season, and a line that follows your day: the question, the
  // finish that beats your best, where a go in progress is, or how today went. Classic stays the big card under it.
  const UP = '<svg class="fr-up" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1 L11 8 H7.5 V11 H4.5 V8 H1 Z" fill="currentColor"/></svg>';
  // today's Daily go in progress, if there is one (on screen or in its own slot), with where it stands
  function dailyLive(date) {
    const G = D2T.game, st = D2T.state, ok = (r) => r && r.daily === date && !r.recorded && G.live(r) && r.eng.phase !== 'summary';
    const r = ok(st.run) ? st.run : ok(st.dailyRun) ? st.dailyRun : null;
    if (!r) return null;
    const keep = st.run; st.run = r;
    try {
      const e = G.eng(), games = G.fixtures().length;
      if (!e.played || !e.played.length || e.phase === 'setup') return 'Building your squad';
      const me = G.clubName(), row = G.standings(null).find((x) => x.name === me);
      return `Matchday ${Math.min(e.played.length, games)} of ${games}${row ? ' · ' + D2T.ordinal(row.pos) : ''}`;
    } catch (err) { return 'In progress'; } finally { st.run = keep; }
  }
  function dailyStrip() {
    const G = D2T.game, o = D2T.ordinal, esc = D2T.esc, d = G.dailyEntry(G.today()), res = G.dailyResult();
    const date = G.dailyName(d.date, true).replace('Daily Challenge ', '').toUpperCase(), go = dailyLive(d.date);
    let state, small, plain, on = false;
    if (go) { state = 'IN PROGRESS'; on = true; small = plain = `${go} · Tap to carry on`; }
    else if (res) {
      state = 'COMPLETED'; on = true;
      const cmp = G.dailyCompare(), how = res.rise > 0 ? `up ${res.rise}` : res.rise < 0 ? `down ${-res.rise}` : 'level';
      small = `Finished <b>${o(res.finish)}</b>, ${how}${cmp.isBest ? ' · <em>New best</em>' : ''}`;
      plain = `Finished ${o(res.finish)}, ${how}${cmp.isBest ? ', new best' : ''}`;
    } else {
      state = date;
      const best = G.dailyBest();
      if (!best) small = plain = `They went down in ${o(d.pos)}. How high can you finish?`;
      else {
        const need = d.pos - best.rise;   // the finish that beats your best rise (as the old Today's Daily tile)
        if (need < 1) small = plain = `Their real finish: ${o(d.pos)}`;
        else if (need === 1) small = plain = `Win the league to ${best.finish > 1 ? 'beat' : 'match'} your best`;
        else { small = `Finish <b>${o(need)}</b> or higher to beat your best`; plain = `Finish ${o(need)} or higher to beat your best`; }
      }
    }
    const label = `DAILY CHALLENGE · ${state}`;
    const big = `${d.name} ${d.season}`;
    return `<button class="fr-dstrip fr-in" data-act="daily"${res && !go ? ' data-done="1"' : ''} aria-label="${esc(`Daily Challenge, ${go ? 'in progress' : res ? 'completed' : G.dailyName(d.date, true).replace('Daily Challenge ', '')}: ${big}. ${plain}`)}">
      <img class="fr-dstrip-crest" src="${d.crest}" alt=""><span class="fr-dstrip-txt"><span class="fr-dstrip-lbl${on ? ' on' : ''}">${label}</span>
      <span class="fr-dstrip-big">${esc(big)}</span><span class="fr-dstrip-sub">${small}</span></span><span class="fr-go">${ARROW}</span></button>`;
  }
  // Your record (Craig, 29 Oct; "B, refined: metallic, your arrow" in design/prototype/record-swipe.html): one record with a
  // page per game, slanted tags over it, swiped or tapped, dots under it and Share in the heading. Each page is four
  // metallic shields in the game's colour, its count first; a game never played has no page (Classic always shows).
  const SHARE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.1 20.2C2.6 12.4 6.6 7.9 12.7 7.4V3.5l8.4 7.9-8.4 7.9v-4.8c-4.1-.1-7.3 2.1-9.6 5.7z"/></svg>';
  function recordPages() {
    const G = D2T.game, o = D2T.ordinal, st = D2T.state, runs = st.record.runs || [], sg = (v) => (v > 0 ? '+' : '') + v, pages = [];
    const days = Object.values(st.record.daily || {});
    if (days.length) {
      const bf = days.slice().sort((a, b) => a.finish - b.finish || b.rise - a.rise)[0], c = G.club(bf.club);
      pages.push({ k: 'daily', tag: 'DAILY', name: 'Daily', c: '#FFFFFF', mark: { src: c && c.crest }, shields: [
        { n: days.length, l: 'Played' }, { n: o(bf.finish), l: 'Best finish', crest: c && c.crest },
        { n: sg(Math.max(...days.map((d) => d.rise))), l: 'Best rise', c: '#12F06C' }, { n: days.filter((d) => d.finish === 1).length, l: 'Wins' }] });
    }
    const rec = G.record();
    pages.push({ k: 'classic', tag: 'CLASSIC', name: 'Classic', c: '#12F06C', mark: { src: D2T.ASSET.emblem, tint: true }, shields: [
      { n: rec.drop, l: 'Beat the drop' }, { n: rec.half, l: 'Top half' }, { n: rec.top3, l: 'Top 3' }, { n: rec.titles, l: 'League titles' }] });
    const g4 = G.g433.record();
    if (g4.games) {
      const last = g4.last == null ? '-' : g4.last === g4.lastTarget ? '0' : g4.last > g4.lastTarget ? `${g4.last - g4.lastTarget}+` : `${g4.lastTarget - g4.last}-`;
      pages.push({ k: 'g433', tag: 'GOAL RUSH', name: 'Goal Rush', c: '#FFD21F', mark: { src: window.D2T_GOALRUSH_LOGO }, shields: [
        { n: g4.games, l: 'Games' }, { n: g4.exact || 0, l: 'Bang on' }, { n: `${Math.round(100 * (g4.exact || 0) / g4.games)}%`, l: 'Hit rate' }, { n: last, l: 'Last game' }] });
    }
    const ub = st.ub || {};
    if (ub.runs) {
      const best = Object.values(ub.best || {});
      pages.push({ k: 'unbeaten', tag: 'UNBEATEN', name: 'Unbeaten Run', c: '#22D3EE', mark: { svg: true }, shields: [
        { n: ub.runs, l: 'Runs' }, { n: best.length ? Math.max(...best) : 0, l: 'Best run' }, { n: best.filter((v) => v > 0).length, l: 'Topics tried' }, { n: ub.lastRun != null ? ub.lastRun : '-', l: 'Last run' }] });
    }
    const xr = G.xRecord();
    if (xr.runs) {
      const badge = G.club('Club X').crest;
      pages.push({ k: 'clubx', tag: 'CLUB X', name: 'Club X', c: '#12F06C', mark: { src: badge }, shields: [
        { n: xr.runs, l: 'Seasons' }, { n: xr.titles, l: 'Titles' }, { n: runs.filter((r) => r.mode === 'clubx' && !r.daily && r.top3).length, l: 'Top 3' }, { n: o(xr.best), l: 'Best finish', crest: badge }] });
    }
    const dr = G.dreamRecord();
    if (dr.runs) {
      pages.push({ k: 'dream', tag: 'DARE2DREAM', name: 'Dare2Dream', c: '#3BA4FF', mark: { src: D2T.ASSET.emblemLine, tint: true }, shields: [
        { n: dr.runs, l: 'Runs' }, { n: dr.dreams, l: 'Dreams' }, { n: sg(dr.bestRise), l: 'Best rise' }, { n: runs.filter((r) => r.mode === 'dare2dream' && !r.daily && r.title).length, l: 'Titles' }] });
    }
    return pages;
  }
  // the metallic face: the game's colour with a sheen, as on the game's cards (155deg: lighter, the colour, darker, light)
  const metal = (c) => { const m = D2T.mix; return [m(c, '#FFFFFF', 0.45), c, m(c, '#000000', 0.38), m(c, '#FFFFFF', 0.15)]; };
  const shieldHTML = (sh, pc) => {
    const c = sh.c || pc, g = metal(c), lt = c === '#3BA4FF';
    return `<div class="fr-frame fr-al${lt ? ' lt' : ''}" style="--m1:${g[0]};--m2:${g[1]};--m3:${g[2]};--m4:${g[3]};--r1:${D2T.mix(c, '#FFFFFF', 0.7)};--r2:${D2T.mix(c, '#000000', 0.55)}"><i class="fr-al-rim"></i><i class="fr-al-face"></i><b>${sh.n}</b><span>${sh.l}</span></div>`;
  };
  function recordSection(pages) {
    const p0 = pages[0];
    return `<section class="fr-sect fr-in fr-rec" aria-label="Your record">
      <div class="fr-sect-h"><h2>Your record</h2><button type="button" class="fr-shr" style="--c:${p0.c}" aria-label="Share your ${p0.name} record"><span>Share</span>${SHARE_ICON}</button></div>
      <div class="fr-ptabs" role="tablist">${pages.map((p, i) => `<button type="button" role="tab" data-i="${i}" style="--c:${p.c}" class="${i ? '' : 'on'}" aria-selected="${!i}"><span>${p.tag}</span></button>`).join('')}</div>
      <div class="fr-rpages">${pages.map((p) => `<div class="fr-rpage" aria-label="${p.name} record"><div class="fr-record fr-quad">${p.shields.map((sh) => shieldHTML(sh, p.c)).join('')}</div></div>`).join('')}</div>
      <div class="fr-rdots" aria-hidden="true">${pages.map((p, i) => `<i style="--c:${p.c}" class="${i ? '' : 'on'}"></i>`).join('')}</div></section>`;
  }
  // a page's record as a share card: its mark, MY RECORD, the four shields big in a 2 x 2, "CAN YOU BEAT IT?"
  function recordShare(p) {
    const text = [`*DROP2TOP ${p.name} record*`, '', p.shields.map((sh) => `${sh.l} ${sh.n}`).join(' · '), '', '_Your turn. Beat that!_', D2T.share.LINK].join('\n');
    const imgs = {};
    if (p.mark.svg) imgs.mark = D2T.share.svgSrc(D2T.ubMark.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" color="${p.c}" `));
    else if (p.mark.src) imgs.mark = p.mark.src;
    p.shields.forEach((sh, i) => { if (sh.crest) imgs['cr' + i] = sh.crest; });
    return D2T.share.build({ text, c: p.c, wash: p.c, band: p.c, ink: p.c === '#3BA4FF' ? '#FFFFFF' : '#0A0A0A', tag: p.k === 'daily' ? 'Daily Challenge' : p.name, dare: 'Can you beat it?', imgs,
      draw: (g, im, k) => {
        const W = k.W;
        if (im.mark) {
          if (p.mark.tint) { const t = document.createElement('canvas'), S = 340; t.width = S; t.height = S; const tg = t.getContext('2d'), r = Math.min(S / im.mark.naturalWidth, S / im.mark.naturalHeight), w = im.mark.naturalWidth * r, h = im.mark.naturalHeight * r;
            tg.drawImage(im.mark, (S - w) / 2, (S - h) / 2, w, h); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = p.c; tg.fillRect(0, 0, S, S); g.drawImage(t, W / 2 - 85, 250, 170, 170); }
          else k.pic(im.mark, W / 2, 250, 170);
        }
        k.mid('MY RECORD', W / 2, 462, 900, 900, 54, true, '#FFFFFF', 'center', '3px');
        const SW = 232, SH = 301, CARD_PATH = 'M1.77 10.23 L10.23 1.77 Q12 0 14.5 0 L99.5 0 Q102 0 103.77 1.77 L112.23 10.23 Q114 12 114 14.5 L114 127 Q114 130 111.14 130.9 L60.81 146.8 Q57 148 53.19 146.8 L2.86 130.9 Q0 130 0 127 L0 14.5 Q0 12 1.77 10.23Z';
        p.shields.forEach((sh, i) => {
          const x0 = W / 2 + (i % 2 ? 22 : -22 - SW), y0 = 512 + Math.floor(i / 2) * (SH + 18), c = sh.c || p.c, m = metal(c), ink = c === '#3BA4FF' ? '#FFFFFF' : '#0A0A0A';
          const P = new Path2D(); P.addPath(new Path2D(CARD_PATH), new DOMMatrix().translate(x0, y0).scale(SW / 114, SH / 148)); g.save();
          const a = 155 * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), L = (Math.abs(SW * dx) + Math.abs(SH * dy)) / 2, cx = x0 + SW / 2, cy = y0 + SH / 2;
          const gr = g.createLinearGradient(cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L); [[0, m[0]], [0.32, m[1]], [0.7, m[2]], [1, m[3]]].forEach(([o2, col]) => gr.addColorStop(o2, col));
          g.fillStyle = gr; g.fill(P); g.lineWidth = 4; g.strokeStyle = D2T.mix(c, '#FFFFFF', 0.6); g.lineJoin = 'round'; g.stroke(P); g.restore();
          if (im['cr' + i]) k.pic(im['cr' + i], x0 + SW * 0.91 - 26, y0 + SH * 0.07, 52);
          k.mid(String(sh.n), cx, y0 + SH * 0.30 + 44, SW - 40, 900, 92, true, ink);
          k.fit(sh.l.toUpperCase(), cx, y0 + SH * 0.30 + 104, SW - 44, 800, 26, false, ink, 'center', '1px');
        });
      } });
  }

  // The long logo in two pieces (emblem and name, measured from long.png) so the emblem can turn on its own,
  // each with a glint layer sized to the whole logo so one sweep runs across both.
  const P = (n) => (n * 100).toFixed(3) + '%';
  const homeLogo = () => `<span class="fr-hl" role="img" aria-label="DROP2TOP">
    <span class="fr-hl-p fr-hl-emb" style="left:0;top:0;width:${P(234 / 1301)};height:100%;-webkit-mask-image:url('${D2T.ASSET.emblem}');mask-image:url('${D2T.ASSET.emblem}')"><i class="fr-hl-s" style="left:0;top:0;width:${P(1301 / 234)};height:100%"></i></span>
    <span class="fr-hl-p" style="left:${P(233 / 1301)};top:${P(41 / 237)};width:${P(1068 / 1301)};height:${P(143 / 237)};-webkit-mask-image:url('${D2T.ASSET.longText}');mask-image:url('${D2T.ASSET.longText}')"><i class="fr-hl-s" style="left:${P(-233 / 1068)};top:${P(-41 / 143)};width:${P(1301 / 1068)};height:${P(237 / 143)}"></i></span></span>`;
  // Classic button (chosen 11 Oct, "shuffle"): three real relegated club cards fanned on the right. Every 10 to 15 seconds
  // the back card slides round to the front, and the card leaving the front is swapped for another club while it is behind.
  const FAN_POS = [
    { t: 'translate(-50%,-50%) rotate(-13deg) translateY(6px)', z: 1 },
    { t: 'translate(-50%,-50%) rotate(0deg) translateY(-6px)', z: 3 },
    { t: 'translate(-50%,-50%) rotate(13deg) translateY(6px)', z: 2 }
  ];
  // Always three clearly different club colours: a new card's accent must be far enough from the other two.
  const fanUsed = new Set();
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const far = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) >= 110; };
  const fanPick = (avoid = []) => {
    const pool = D2T.game.pool; let c, n = 0;
    do { c = pool[Math.floor(Math.random() * pool.length)]; } while ((fanUsed.has(c.key) || avoid.some((x) => !far(x, c.accent))) && ++n < 200);
    fanUsed.add(c.key); if (fanUsed.size > 12) fanUsed.delete(fanUsed.values().next().value);
    return c;
  };
  const fanCard = (c) => `<span class="fr-fan-c" data-acc="${c.accent}">${D2T.cards.club(c, { w: 84, slow: true, delay: -Math.random() * 10 })}</span>`;
  const fanStart = () => { const out = []; for (let i = 0; i < 3; i++) out.push(fanPick(out.map((c) => c.accent))); return out; };
  // each continue card shines on its own beat (8 to 12s, random start) so they never sweep together
  const shineBeat = () => { const d = 8 + Math.random() * 4; return `animation-duration:${d.toFixed(2)}s;animation-delay:${(2 + Math.random() * d).toFixed(2)}s`; };
  let fanTimer = 0;
  let idleTimer = 0, idleFirst = 0;

  // shared with home v2: the long logo in two pieces, the record pages and their share cards
  D2T.homeLogo = () => homeLogo(); D2T.recordPages = () => recordPages(); D2T.recordShare = (p) => recordShare(p); D2T.metal = (c) => metal(c);

  D2T.screen(D2T.HOME === 'v1' ? 'home' : 'home-v1', {
    title: 'Home', theme: 'black',
    mount(root, params) {
      D2T.game.closeOldDaily();                                  // yesterday's unfinished Daily closed at midnight
      const rec = D2T.game.record(), dreams = D2T.game.dreamRecord(), xr = D2T.game.xRecord(), recPages = recordPages();
      const body = D2T.h(`<div class="screen-body fr-home">
        <div class="fr-home-top"><button class="fr-home-logo" aria-label="DROP2TOP">${homeLogo()}</button></div>
        ${dailyStrip()}
        <button class="fr-card-btn fr-pick fr-classic fr-in" data-act="pick" data-mode="classic">
          <span class="fr-fan" aria-hidden="true">${fanStart().map((c, i) => `<span class="fr-fan-s" style="transform:${FAN_POS[i].t};z-index:${FAN_POS[i].z}">${fanCard(c)}</span>`).join('')}</span>
          <span class="fr-classic-txt"><span class="fr-tag" style="display:block">CLASSIC</span><span class="fr-big" style="display:block">Pick a new club</span><span class="fr-sub" style="display:block">Take them from the drop to the top.</span>
          <span class="fr-spin">Spin for a club ${ARROW}</span></span></button>
        ${continueCards()}
        ${recordSection(recPages)}
        <section class="fr-sect fr-in" aria-label="Other games">
          <div class="fr-sect-h"><h2>Other games</h2></div>
        ${gameCard({ c: '#12F06C', attrs: 'data-act="pick" data-mode="clubx"', label: 'Club X', tag: 'CLUB X', big: 'From nowhere to champions', sub: 'Career mode. Replace the worst side, win the league, go again.', mark: `<img src="${D2T.game.club('Club X').crest}" alt="">` })}
        ${g433Card()}
        ${ubCard()}
        ${gameCard({ c: '#3BA4FF', attrs: 'data-act="pick" data-mode="dare2dream"', label: 'Dare2Dream', locked: D2T.game.dreamLocked, tag: D2T.game.dreamLocked ? 'DARE2DREAM<span class="fr-tag-off"> · LOCKED FOR REPAIR</span>' : 'DARE2DREAM', big: 'Rewrite their season', sub: `Any club from any season. Draft 11 and beat their real finish.${dreams.runs ? ` ${dreams.dreams} of ${dreams.runs} dreams so far.` : ''}`, mark: D2T.logo('emblemLine') })}
        ${gameCard({ c: '#A66BFF', href: 'https://404craig.github.io/Tenaball/', label: 'Tenaball, opens in a new tab', tag: 'TENABALL', big: 'Name the top ten', sub: 'Our football quiz. Opens Tenaball.', mark: `<img src="${window.D2T_TENABALL_LOGO || ''}" alt="">` })}
          <div class="fr-sect-h fr-soon-h"><span>Coming soon</span></div>
          <div class="fr-soon">${MODES.map((m) => `<button class="fr-soon-t" aria-label="${m.name}, coming soon">
            <span class="fr-soon-ic" aria-hidden="true">${m.icon}</span><span class="fr-soon-lock" aria-hidden="true">${LOCK}</span>
            <span class="fr-soon-tag">COMING SOON</span><span class="fr-soon-nm">${m.name}</span><span class="fr-soon-sb">${m.sub}</span></button>`).join('')}</div></section>
      </div>`);
      root.appendChild(body);
      const bar = D2T.h(`<nav class="fr-tabbar fr-in" aria-label="More">
        <button data-go="league">${TAB_ICON.league}League</button><button data-go="stats">${TAB_ICON.stats}Stats</button>
        <button data-go="howto">${TAB_ICON.howto}How to play</button><button data-go="account">${TAB_ICON.account}Account</button></nav>`);
      root.appendChild(bar);

      const logoBtn = body.querySelector('.fr-home-logo');
      const ins = [...root.querySelectorAll('.fr-in')];
      const reveal = (base) => ins.forEach((el, i) => setTimeout(() => el.classList.add('on'), base + i * 70));

      // arriving from the intro: take the logo from where the intro left it, then bring the content in
      const fi = params.fromIntro;
      if (fi && typeof fi === 'object' && !D2T.reduced()) {
        const r = logoBtn.getBoundingClientRect(), rr = root.getBoundingClientRect();
        const dx = fi.left - (r.left - rr.left), dy = fi.top - (r.top - rr.top), s = fi.width / r.width;
        logoBtn.style.transformOrigin = '0 0';
        logoBtn.animate([{ transform: `translate(${dx}px,${dy}px) scale(${s})` }, { transform: 'none' }], { duration: 760, easing: 'cubic-bezier(.6,0,.2,1)' });
        reveal(380);
      } else if (fi && !D2T.reduced()) reveal(60);
      else ins.forEach((el) => el.classList.add('on'));

      // Every 20 seconds the emblem turns once and a green glint runs across the logo (not with reduced motion).
      const idle = () => {
        if (document.hidden || D2T.reduced() || !root.isConnected) return;
        const emb = body.querySelector('.fr-hl-emb');
        emb.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 1150, easing: 'cubic-bezier(.65,0,.25,1)' });
        body.querySelectorAll('.fr-hl-s').forEach((g) => g.animate([{ transform: 'translateX(-62%)' }, { transform: 'translateX(62%)' }], { duration: 1300, delay: 950, easing: 'cubic-bezier(.4,0,.3,1)' }));
      };
      clearTimeout(idleFirst); clearInterval(idleTimer);
      idleFirst = setTimeout(idle, 6000); idleTimer = setInterval(idle, 20000);
      clearTimeout(fanTimer);
      const fan = body.querySelector('.fr-fan');
      let turn = 0;
      const shuffle = () => {
        if (!root.isConnected) return;
        if (!document.hidden && !D2T.reduced()) {
          turn = (turn + 1) % 3;
          const slots = [...fan.children];
          slots.forEach((el, i) => { const p = FAN_POS[(i + turn) % 3]; el.style.transform = p.t; el.style.zIndex = p.z; });
          // once the move has settled, cross-fade the card now at the back into a new club (never a snap)
          setTimeout(() => {
            const back = slots.find((el) => el.style.zIndex === '1'); if (!back || !root.isConnected) return;
            const others = slots.filter((el) => el !== back).map((el) => el.querySelector('.fr-fan-c:last-child').dataset.acc);
            const oldC = back.querySelector('.fr-fan-c:last-child'), next = D2T.h(fanCard(fanPick(others)));
            next.classList.add('fr-fan-in'); back.appendChild(next);
            const t = { duration: 900, easing: 'ease-in-out', fill: 'forwards' };
            next.animate([{ opacity: 0 }, { opacity: 1 }], t);
            oldC.animate([{ opacity: 1 }, { opacity: 0 }], t);
            setTimeout(() => { oldC.remove(); next.classList.remove('fr-fan-in'); }, 950);
          }, 900);
        }
        fanTimer = setTimeout(shuffle, 10000 + Math.random() * 5000);
      };
      fanTimer = setTimeout(shuffle, 10000 + Math.random() * 5000);
      if (D2T.state.dailyClosed) {                               // say once that an unfinished Daily closed at midnight
        const dc = D2T.state.dailyClosed; delete D2T.state.dailyClosed; D2T.save();
        setTimeout(() => { if (root.isConnected) D2T.sheet({ title: 'That Daily has closed', body: `<p class="fr-lead">${D2T.esc(D2T.game.dailyName(dc))} closed at midnight before you finished it. Today's club is ready for everyone.</p>` }); }, 900);
      }
      const startNew = (from, mode) => { D2T.game.newRun(mode); D2T.toBlack('spin', { from }); };
      // the Daily strip: play or carry on; once today's is played, a slide-up to share it or go again (Craig, 14 Oct)
      const daily = body.querySelector('[data-act="daily"]');
      if (daily) daily.onclick = (e) => {
        const G = D2T.game, t = G.today(), from = e.currentTarget, r = G.dailyResult(t), sh = daily.dataset.done && r && D2T.dailyShare && D2T.dailyShare(t);
        if (!sh) { G.startDaily(); D2T.toBlack(G.stepFor() || 'table', { from }); return; }
        const sign = (v) => (v > 0 ? '+' : '') + v;
        D2T.endSheet({ title: G.dailyName(t), colour: '#FFFFFF', ink: '#0A0A0A',
          lead: `Your best go today: <b>${D2T.esc(r.club)}</b> ${D2T.ordinal(r.histFinish)} to ${D2T.ordinal(r.finish)}, a rise of ${sign(r.rise)}.`,
          buttons: [{ k: 'share', label: 'Share result', primary: true, fn: () => { window.D2TSound && window.D2TSound.play('share'); D2T.share.send(sh); } },
            { k: 'again', label: 'Go again', fn: () => { G.startDaily(); D2T.toBlack(G.stepFor() || 'table', { from }); } }] }).open();
      };
      // Your record: tags and swipes change the page, Share shares the page on show (its card built ahead)
      const rsec = body.querySelector('.fr-rec');
      if (rsec) {
        const pg = rsec.querySelector('.fr-rpages'), tabs = rsec.querySelector('.fr-ptabs'), shr = rsec.querySelector('.fr-shr'), cards = {};
        let cur = 0;
        const card = (i) => cards[i] || (cards[i] = recordShare(recPages[i]));
        const show = (i) => {
          cur = i; const p = recPages[i];
          tabs.querySelectorAll('button').forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-selected', j === i); });
          rsec.querySelectorAll('.fr-rdots i').forEach((d, j) => d.classList.toggle('on', j === i));
          shr.style.setProperty('--c', p.c); shr.setAttribute('aria-label', `Share your ${p.name} record`);
          const t = tabs.children[i]; if (t) { const l = t.offsetLeft - tabs.offsetLeft, r = l + t.offsetWidth; if (l < tabs.scrollLeft) tabs.scrollTo({ left: l - 8, behavior: 'smooth' }); else if (r > tabs.scrollLeft + tabs.clientWidth) tabs.scrollTo({ left: r - tabs.clientWidth + 8, behavior: 'smooth' }); }
          setTimeout(() => card(i), 0);
        };
        tabs.querySelectorAll('button').forEach((b) => b.onclick = () => { const i = +b.dataset.i; pg.scrollTo({ left: i * pg.clientWidth, behavior: D2T.reduced() ? 'auto' : 'smooth' }); show(i); });
        let raf = 0;
        pg.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const i = Math.round(pg.scrollLeft / Math.max(1, pg.clientWidth)); if (i !== cur && recPages[i]) show(i); }); }, { passive: true });
        shr.onclick = () => { const sh = card(cur); window.D2TSound && window.D2TSound.play('share'); const go = () => (sh.done ? D2T.share.send(sh) : setTimeout(go, 80)); go(); };
        setTimeout(() => card(0), 1500);
      }
      const other = body.querySelector('[data-act="continue-other"]');
      if (other) other.onclick = (e) => { D2T.game.switchToOther(); D2T.toBlack(D2T.game.stepFor() || 'squad', { from: e.currentTarget }); };
      body.querySelectorAll('[data-act="pick"]').forEach((btn) => btn.onclick = (e) => {
        const from = e.currentTarget, mode = from.dataset.mode;
        D2T.game.stashDaily();                                   // an unfinished daily keeps its own slot
        if (!inRun()) { startNew(from, mode); return; }
        // the game's own question, never the phone's confirm box
        const name = D2T.run().club.name, career = D2T.game.careerOpen(D2T.state.run);
        const s = D2T.sheet({ title: career ? 'Start a new career?' : 'Start a new run?', body: `<p class="fr-lead">${career ? `Your ${D2T.esc(name)} career is waiting for its next season. Starting again will lose it.` : `Your ${D2T.esc(name)} run will be lost.`}</p>
          <div class="fr-two"><button class="btn btn-ghost" data-k="no">Keep playing</button><button class="btn btn-ghost" data-k="yes" style="color:#12F06C">New run</button></div>` });
        s.body.querySelector('[data-k="no"]').onclick = s.close;
        s.body.querySelector('[data-k="yes"]').onclick = () => { s.close(); startNew(from, mode); };
      });
      body.querySelector('[data-act="g433"]').onclick = (e) => D2T.toBlack('goals433', { from: e.currentTarget });
      body.querySelector('[data-act="unbeaten"]').onclick = (e) => D2T.toBlack('unbeaten', { from: e.currentTarget });
      const cont = body.querySelector('[data-act="continue"]');
      if (cont) cont.onclick = (e) => D2T.toBlack(D2T.game.stepFor() || 'squad', { from: e.currentTarget });
      body.querySelector('.fr-home-logo').onclick = () => D2T.go('intro');
      body.querySelectorAll('.fr-soon-t').forEach((m) => m.onclick = () => { m.classList.remove('nudge'); void m.offsetWidth; m.classList.add('nudge'); });
      bar.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => D2T.go(b.dataset.go));
    },
    unmount() { clearTimeout(idleFirst); clearInterval(idleTimer); clearTimeout(fanTimer); }
  });

  // ---------- D2T.toBlack(next, {from}) ----------
  // Green collapses into black from the button you tapped, the home logo turns white as green light ripples through it,
  // then it shrinks into the small white top-left logo of the next (black) screen.
  let busy = false;
  D2T.toBlack = async (next, opts = {}) => {
    const app = document.getElementById('app');
    const scr = app.querySelector('.screen');
    const logoEl = scr && scr.querySelector('.fr-home-logo .fr-hl');
    if (busy) return;
    if (D2T.reduced() || !logoEl) { D2T.go(next); return; }
    busy = true;
    const ar = app.getBoundingClientRect();
    const lr = logoEl.getBoundingClientRect();
    const L = { x: lr.left - ar.left, y: lr.top - ar.top, w: lr.width, h: lr.height };
    let ox = ar.width / 2, oy = ar.height / 2;
    if (opts.from) { const b = opts.from.getBoundingClientRect(); ox = b.left - ar.left + b.width / 2; oy = b.top - ar.top + b.height / 2; }
    const R = Math.hypot(Math.max(ox, ar.width - ox), Math.max(oy, ar.height - oy)) / 30 + 0.5;

    const shortW = L.h * (857 / 241);
    const ov = D2T.h(`<div class="fr-tb" aria-hidden="true"><div class="fr-tb-black" style="left:${ox}px;top:${oy}px"></div>
      <div class="fr-tb-logo" style="width:${L.w}px;height:${L.h}px;transform:translate(${L.x}px,${L.y}px)">
        <span class="fr-tb-m fr-tb-long" style="-webkit-mask-image:url('${D2T.ASSET.long}');mask-image:url('${D2T.ASSET.long}')"><i class="w"></i><i class="s"></i></span>
        <span class="fr-tb-m fr-tb-short" style="-webkit-mask-image:url('${D2T.ASSET.short}');mask-image:url('${D2T.ASSET.short}');right:auto;width:${shortW}px;opacity:0"><i class="w"></i></span>
      </div></div>`);
    app.appendChild(ov);
    logoEl.style.visibility = 'hidden';
    const black = ov.querySelector('.fr-tb-black'), fly = ov.querySelector('.fr-tb-logo');
    const lng = ov.querySelector('.fr-tb-long'), shrt = ov.querySelector('.fr-tb-short');
    const ease = 'cubic-bezier(.6,0,.2,1)';

    // 1. home content drops away, black floods in from the tap
    const body = scr.querySelector('.screen-body'), bar = scr.querySelector('.fr-tabbar');
    [body, bar].forEach((el) => el && el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.97)' }], { duration: 300, easing: 'ease-in', fill: 'forwards' }));
    black.animate([{ transform: 'scale(0)' }, { transform: `scale(${R})` }], { duration: 520, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
    // 2. green glistens through the white logo in waves
    lng.querySelector('.s').animate([{ transform: 'translateX(-60%)' }, { transform: 'translateX(40%)' }], { duration: 1050, delay: 120, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' });
    await D2T.wait(620);

    // 3. the next screen mounts under the black; find its top-left logo and fly to it
    D2T.go(next);
    await D2T.wait(30);
    const nscr = app.querySelector('.screen');
    const target = nscr && nscr.querySelector('.topbar .logo-home .logo-mask');
    let T = { x: 16, y: 19, h: 26 };
    if (target) { const tr = target.getBoundingClientRect(); T = { x: tr.left - ar.left, y: tr.top - ar.top, h: tr.height }; target.style.visibility = 'hidden'; }
    const s = T.h / L.h;
    fly.animate([{ transform: `translate(${L.x}px,${L.y}px) scale(1)` }, { transform: `translate(${T.x}px,${T.y}px) scale(${s})` }], { duration: 640, easing: ease, fill: 'forwards' });
    // the long name folds back into D2T as it lands (emblems stay aligned on the left)
    lng.animate([{ opacity: 1 }, { opacity: 1, offset: 0.2 }, { opacity: 0, offset: 0.6 }, { opacity: 0 }], { duration: 600, fill: 'forwards' });
    shrt.animate([{ opacity: 0 }, { opacity: 0, offset: 0.2 }, { opacity: 1, offset: 0.6 }, { opacity: 1 }], { duration: 600, fill: 'forwards' });
    // reveal the new screen by fading the black flood (black on black, so only its content appears)
    black.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 200, easing: 'ease-out', fill: 'forwards' });
    await D2T.wait(660);
    if (target) target.style.visibility = '';
    ov.remove();
    busy = false;
  };
})();
