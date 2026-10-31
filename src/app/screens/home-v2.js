// Home v2, "the stage" (Craig, 29 Oct; design/prototype/home-stage.html on the design branch): one full screen, no
// scrolling and no tab bar. The games sit on a wheel hung from a pivot far below the screen, one at a time: swipe (or the
// arrows, or the arrow keys) to turn it, and it snaps to the nearest game with a small overshoot. Each game shows its
// art, its name, a headline and a line, its record in four metallic shields, and its button at the foot: one button in
// the game's colour, or New game and Continue side by side once that game has a run going. Share (the record of the
// game on show), its rules (?) and the account sit top right. Home opens on the Daily Challenge.
// The old home is kept as screens/home-v1.js (D2T.HOME in core/app.js).
(function () {
  const D2T = window.D2T;
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const CHL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const CHR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  const SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.1 20.2C2.6 12.4 6.6 7.9 12.7 7.4V3.5l8.4 7.9-8.4 7.9v-4.8c-4.1-.1-7.3 2.1-9.6 5.7z"/></svg>';
  const ACCT = '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><circle cx="12" cy="8" r="4.5"/><path d="M3.5 21a8.5 8.5 0 0 1 17 0z"/></svg>';
  // the game's hand-drawn swipe arrows (Unbeaten), up and down
  const SWIPE = (col, down) => `<svg viewBox="0 0 32 150" class="${down ? 'dn' : 'up'}" aria-hidden="true"><g ${down ? 'transform="rotate(180 16 75)"' : ''}><path d="M11.5 146 Q16 150 20.5 146 L17.6 26 Q16 22 14.4 26 Z" fill="${col}"/><path d="M4 40 L16 14 Q21 26 29 37" fill="none" stroke="${col}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
  const TENABALL = 'https://404craig.github.io/Tenaball/';
  const CLASSIC = '#C9D0D9';   // Classic is silver on the stage (Craig, 29 Oct): green is Club X's
  const STEP = 24;             // degrees between games on the wheel

  const hex = (h) => { const s = String(h || '#000000').replace('#', ''); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) || 0); };
  const dark = (c) => { const [r, g, b] = hex(c); return 0.299 * r + 0.587 * g + 0.114 * b < 150; };
  const esc = (s) => D2T.esc(String(s));

  // ---------- the runs each game may have going ----------
  function runsGoing() {
    const G = D2T.game, st = D2T.state, today = G.today();
    const runs = [st.run, st.parked, st.dailyRun].filter((r) => r && G.live(r) && !G.locked(r));
    const g4 = st.g433, n4 = g4 && Array.isArray(g4.filled) ? g4.filled.length : 0;
    return {
      daily: runs.find((r) => r.daily === today && !r.recorded && r.eng.phase !== 'summary') || null,
      classic: runs.find((r) => !r.daily && r.eng.mode === 'classic') || null,
      clubx: runs.find((r) => !r.daily && r.eng.mode === 'clubx') || null,
      goal: n4 > 0 && n4 < 11 ? g4 : null,
      ub: st.ub && st.ub.run ? st.ub.run : null
    };
  }
  // look at a saved run as if it were on screen for a moment (nothing is saved)
  const viewRun = (r, fn) => { const st = D2T.state, keep = st.run; st.run = r; try { return fn(); } finally { st.run = keep; } };

  // ---------- each game's record, count first (the Your record shields) ----------
  function shieldsFor(id, record) {
    const G = D2T.game, o = D2T.ordinal, st = D2T.state, runs = st.record.runs || [], sg = (v) => (v > 0 ? '+' : '') + v;
    if (id === 'daily') {
      const days = Object.values(st.record.daily || {}), bf = days.slice().sort((a, b) => a.finish - b.finish)[0];
      // once today's Daily has a finished go, its finish (the day's best go) in place of the best finish (Craig, 31 Oct, build 194)
      const td = record ? null : G.dailyResult(G.today());   // the My record share card keeps the best finish
      return [[days.length, 'Played'], td && td.finish ? [o(td.finish), "Today's finish"] : [bf ? o(bf.finish) : '-', 'Best finish'], [days.length ? sg(Math.max(...days.map((d) => d.rise))) : '-', 'Best rise'], [days.filter((d) => d.finish === 1).length, 'Wins']];
    }
    if (id === 'classic') { const r = G.record(); return [[r.drop, 'Beat the drop'], [r.half, 'Top half'], [r.top3, 'Top 3'], [r.titles, 'League titles']]; }
    if (id === 'clubx') { const x = G.xRecord(); return [[x.runs, 'Seasons'], [x.titles, 'Titles'], [runs.filter((r) => r.mode === 'clubx' && !r.daily && r.top3).length, 'Top 3'], [x.best ? o(x.best) : '-', 'Best finish']]; }
    if (id === 'goal') {
      const g = G.g433.record(), last = g.last == null ? '-' : g.last === g.lastTarget ? '0' : g.last > g.lastTarget ? `${g.last - g.lastTarget}+` : `${g.lastTarget - g.last}-`;
      return [[g.games, 'Games'], [g.exact || 0, 'Spot on'], [g.games ? `${Math.round(100 * (g.exact || 0) / g.games)}%` : '-', 'Hit rate'], [last, 'Last game']];
    }
    if (id === 'ub') { const u = st.ub || {}, b = Object.values(u.best || {}); return [[u.runs || 0, 'Runs'], [b.length ? Math.max(...b) : 0, 'Best run'], [b.filter((v) => v > 0).length, 'Topics'], [u.lastRun != null ? u.lastRun : '-', 'Last run']]; }
    return [];
  }
  // the player cards' own shape (home v1's Your record, build 173), smaller: the number 21px, the label 9.5px, a long
  // label broken over two lines ("League / titles")
  const shieldsHTML = (list, c) => {
    const m = D2T.metal(c), wh = dark(c);
    const two = (l) => (l.length > 7 && l.includes(' ') ? esc(l).replace(/ (?=[^ ]*$)/, '<br>') : esc(l));
    // the league table shield (Craig, 31 Oct; HomeKit): an outline in the game's colour round a dark face, tappable
    return list.map(([n, l, lb]) => lb ? `<div class="fr-frame fr-al stg-sh stg-lb${lb.state === 'pos' ? '' : ' is-off'}" role="button" tabindex="0" data-lb="1" style="--r1:${c};--r2:${D2T.mix(c, '#000000', 0.3)}" aria-label="${esc(lb.state === 'pos' ? `League table: you are ${n}. Open the leaderboard` : lb.state === 'join' ? 'League table: play to join. Open the leaderboard' : 'League table: sign in to join')}"><i class="fr-al-rim"></i><i class="fr-al-face"></i><b>${esc(n)}</b><span>${two(l)}</span></div>`
      : `<div class="fr-frame fr-al stg-sh${wh ? ' lt' : ''}" style="--m1:${m[0]};--m2:${m[1]};--m3:${m[2]};--m4:${m[3]};--r1:${D2T.mix(c, '#FFFFFF', 0.7)};--r2:${D2T.mix(c, '#000000', 0.55)}"><i class="fr-al-rim"></i><i class="fr-al-face"></i><b>${esc(n)}</b><span>${two(l)}</span></div>`).join('');
  };
  // what the slide shows (Craig, 31 Oct): once the server answers, three record shields and the league table shield in
  // their place (each game drops one: the Daily Played, Classic Top half, Club X Top 3, Goal Rush Last game, Unbeaten
  // Topics); with no server, or the endpoints not there yet, the four record shields as before. The share card keeps all four.
  const DROP = { daily: 0, classic: 1, clubx: 2, goal: 3, ub: 2 };
  function homeShields(g) {
    const lb = D2T.lb && D2T.lb.shield(g.id);
    if (!lb || lb.state === 'off' || !(g.id in DROP)) return g.st;
    return g.st.filter((_, i) => i !== DROP[g.id]).concat([[lb.n, lb.l, lb]]);
  }

  // ---------- the games ----------
  function games() {
    const G = D2T.game, d = G.dailyEntry(G.today()), dc = G.club(d.name) || {}, going = runsGoing();
    const list = [
      { id: 'daily', name: 'Daily Challenge', k: dc.accent || '#FFFFFF', kt: dc.text || '#FFFFFF', ink: dc.ink || (dark(dc.accent || '#FFFFFF') ? '#FFFFFF' : '#0A0A0A'),
        hl: `${d.name} ${d.season}`, sb: `Same club for everyone today. They went down in ${D2T.ordinal(d.pos)}.`, play: 'Play today', share: 'daily', entry: d,
        rules: 'One club for everyone today, a side that really went down. It plays like Classic: their real squad, 17 transfer rolls and 5 respins. Have as many goes as you like; your best go of the day counts. It closes at midnight.' },
      { id: 'classic', name: 'Classic', k: CLASSIC, ink: '#0A0A0A', hl: 'Pick a new club', sb: 'Take a side that went down from the drop to the top.', play: 'Spin for a club', share: 'classic', mode: 'classic',
        rules: 'Spin for a club that really went down and keep their real XI. Then sign players through the season: three cards a roll, three rolls before the season, one every three games and three more in January. Beat the drop, or take them to the top.' },
      { id: 'clubx', name: 'Club X', k: '#12F06C', ink: '#0A0A0A', hl: 'Career mode', sb: 'Draft 11, replace the worst side, win the league. Then go again.', play: 'Play Club X', share: 'clubx', mode: 'clubx',
        rules: 'Name your club and take the place of a real season\'s bottom side. Draft 11 from nothing, then play the season and win the league. Stay up and your career carries on, season after season.' },
      { id: 'goal', name: 'Goal Rush', k: '#FFD21F', ink: '#0A0A0A', hl: 'Score exactly <span class="stg-fx"><span class="stg-dg"><span class="stg-dr"><i>?</i></span></span><span class="stg-hy">-</span><span class="stg-dg"><span class="stg-dr"><i>?</i></span></span><span class="stg-hy">-</span><span class="stg-dg"><span class="stg-dr"><i>?</i></span></span></span>',
        hlText: 'Score exactly', sb: 'Pick 11 real players. Their career goals must hit the target.', play: 'Play Goal Rush', share: 'g433',
        rules: 'Each game picks a formation, and its number is your target: 3-5-2 means score exactly 352. Spin three real players for an open shirt and pick one. Get your XI\'s career Premier League goals to the number exactly.' },
      { id: 'ub', name: 'Unbeaten Run', k: '#22D3EE', ink: '#0A0A0A', hl: 'Higher or lower?', sb: 'One stat, real Premier League numbers. How long can you go?', play: 'Start a run', share: 'unbeaten',
        rules: 'Spin a stat. Is the next real number higher or lower? Swipe up for higher, down for lower, or tap. Three refreshes a run swap the hidden card. One wrong call ends your run.' },
      { id: 'ten', name: 'Tenaball', k: '#A66BFF', ink: '#FFFFFF', hl: 'Name the top ten', sb: 'Our football quiz. Opens Tenaball in a new tab.', play: 'Play Tenaball', board: true,
        rules: 'Tenaball is our football quiz: name the top ten in a Premier League list. It opens in its own tab, and your Tenaball scores stay there.' }
    ];
    list.forEach((g) => { g.run = going[g.id] || null; g.st = shieldsFor(g.id); });
    return list;
  }

  // ---------- each game's art (the game's own renderers) ----------
  const UB = { left: [['pts', 'Man Utd', '1999/00'], ['cg', 'Wayne Rooney']], right: [['pts', 'Man City', '2017/18'], ['cg', 'Mohamed Salah']],
    fill: [['pts', 'Arsenal', '2003/04'], ['cg', 'Harry Kane'], ['pts', 'Chelsea', '2004/05'], ['cg', 'Thierry Henry'], ['pts', 'Liverpool', '2019/20'], ['cg', 'Sergio Aguero']] };
  function ubRow(spec) {
    const A = D2T.ubArt, dk = A && A.decks(); if (!dk) return null;
    if (spec[0] === 'pts') return dk.club.find((c) => c.club === spec[1] && c.season === spec[2]) || null;
    return dk.career.find((c) => c.name === spec[1]) || null;
  }
  const ubItem = (spec, shown) => { const r = ubRow(spec); return r ? `<div class="stg-ubi">${D2T.ubArt.item(spec[0], r, shown, spec[0] === 'pts' ? 116 : 104)}</div>` : '<div class="stg-ubi"></div>'; };
  function artHTML(g) {
    const G = D2T.game;
    if (g.id === 'daily') return `<div class="stg-dcard">${D2T.cards.club(g.entry, { w: 168, slow: true })}</div>`;
    if (g.id === 'classic') return '<div class="stg-cfan"></div>';
    if (g.id === 'clubx') return `<div class="stg-clx"><img src="${G.club('Club X').crest}" alt="Club X"></div>`;
    if (g.id === 'goal') return `<div class="stg-gr"><div class="stg-ball"><img src="${window.D2T_GOALRUSH_LOGO || ''}" alt=""></div></div>`;
    if (g.id === 'ub') return `<div class="stg-ub"><div class="stg-reel"><div class="stg-strip" data-side="0">${ubItem(UB.left[0], true)}</div></div><div class="stg-reel"><div class="stg-strip" data-side="1">${ubItem(UB.right[0], false)}</div></div><div class="stg-ar">${SWIPE('#22D3EE')}${SWIPE('#7FE7F7', true)}</div></div>`;
    if (g.id === 'ten') return `<div class="stg-tb"><img src="${window.D2T_TENABALL_LOGO || ''}" alt="Tenaball"></div>`;
    return '';
  }
  // Tenaball's board: the Premier League's all-time top four scorers from the game's own data, in Tenaball's style
  function boardHTML() {
    const dk = D2T.ubArt && D2T.ubArt.decks(), top = dk ? dk.career.slice().sort((a, b) => b.g - a.g).slice(0, 4) : [];
    return `<div class="stg-tbb"><div class="stg-tbq">PREMIER LEAGUE ALL-TIME TOP SCORERS</div><div class="stg-tbw"><div class="stg-tbl">${top.map((p, i) => `<div class="stg-tr"><span class="no">${i + 1}</span><span class="an"><i>${esc(p.name.split(' ').map((w) => w[0]).join(''))}</i><b>${esc(p.name)}</b><em>${p.g} goals</em></span></div>`).join('')}</div></div></div>`;
  }

  let cleanups = [];
  D2T.screen(D2T.HOME === 'v1' ? 'home-v2' : 'home', {
    title: 'Home', theme: 'black', chrome: ['#000000', '#000000'],
    mount(root, params) {
      const G = D2T.game, reduced = D2T.reduced();
      G.closeOldDaily();                                           // yesterday's unfinished Daily closed at midnight
      cleanups = [];
      const timers = [], ivals = [];
      const later = (f, ms) => { const t = setTimeout(f, ms); timers.push(t); return t; };
      const every = (f, ms) => { const t = setInterval(f, ms); ivals.push(t); return t; };
      cleanups.push(() => { timers.forEach(clearTimeout); ivals.forEach(clearInterval); });
      const GM = games(), N = GM.length;

      const el = D2T.h(`<div class="stg">
        <div class="stg-bgs">${GM.map((g) => `<i class="stg-bg" style="background:radial-gradient(70% 42% at 50% 36%,${g.k}55,transparent 70%),radial-gradient(120% 55% at 50% 112%,${g.k}30,#000 70%)"></i>`).join('')}</div>
        <div class="stg-top"><button class="fr-home-logo stg-logo" aria-label="DROP2TOP">${D2T.homeLogo()}</button>
          <button class="stg-rb stg-shr" aria-label="Share your record">${SHARE}</button><button class="stg-rb stg-q" aria-label="How to play this game">?</button><button class="stg-rb stg-acct" aria-label="Your account">${ACCT}</button>
          <button class="stg-dly" type="button" tabindex="-1" aria-hidden="true"><span class="stg-dly-cr"><img alt=""></span><span class="stg-dly-tx"><i></i><b></b></span><span class="stg-dly-go"><span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span><i class="stg-dly-sh"></i></button></div>
        <div class="stg-wheel" aria-roledescription="carousel">${GM.map((g) => `<section class="stg-sl" data-id="${g.id}" aria-label="${esc(g.name)}" style="--k:${g.k};--kt:${g.kt || g.k}">
          <div class="stg-art"><div class="stg-artin">${artHTML(g)}</div></div>
          <div class="stg-nm"><div class="stg-gn">${esc(g.name)}</div><div class="stg-hl">${g.id === 'goal' ? g.hl : esc(g.hl)}</div><p class="stg-sb">${esc(g.sb)}</p></div>
          ${g.board ? boardHTML() : `<div class="stg-st">${shieldsHTML(homeShields(g), g.k)}</div>`}</section>`).join('')}</div>
        <button class="stg-sw l" aria-label="Previous game">${CHL}</button><button class="stg-sw r" aria-label="Next game">${CHR}</button>
        <div class="stg-dots" aria-hidden="true">${GM.map((g) => `<i></i>`).join('')}</div>
        <div class="stg-bar"></div>
        <div class="stg-defs" aria-hidden="true">${D2T.shirts ? D2T.shirts.defs() : ''}</div></div>`);
      // from the intro the stage starts hidden: the class goes on before the first style is computed (the layout reads
      // below), or the .5s transition faded the drawn home OUT to black and then back in (Fable, 30 Oct: Craig's flash)
      if (params.fromIntro && !reduced) el.classList.add('stg-in');
      root.appendChild(el);
      const $ = (s) => el.querySelector(s), SL = [...el.querySelectorAll('.stg-sl')], BG = [...el.querySelectorAll('.stg-bg')], DT = [...el.querySelectorAll('.stg-dots i')];
      const wheel = $('.stg-wheel'), bar = $('.stg-bar');

      // the art is drawn for a 300px box and scaled to the room the phone has
      // (every read first, then the writes, so mounting lays the page out once; Fable's review, 30 Oct)
      let W = el.clientWidth * 0.85;
      const fit = () => {
        const a = SL[0].querySelector('.stg-art'), r = a.getBoundingClientRect(), er = el.getBoundingClientRect(), s = Math.min(1, (r.height || 300) / 300);
        W = er.width * 0.85;
        el.style.setProperty('--as', s.toFixed(3));
        el.style.setProperty('--swy', (r.top - er.top + r.height / 2 - 22).toFixed(0) + 'px');
      };
      const logo = $('.stg-logo'), logoR = logo.getBoundingClientRect(), rootR = root.getBoundingClientRect();   // for the hand-over from the intro
      fit(); const onResize = () => fit(); window.addEventListener('resize', onResize); cleanups.push(() => window.removeEventListener('resize', onResize));

      // ---------- the wheel ----------
      // coming back from a game opens on that game (Craig, 30 Oct)
      // a fresh load opens on Classic (Craig, 31 Oct, build 185: the Daily takeover is how people find the Daily now)
      const classicAt = GM.findIndex((g) => g.id === 'classic'), back = params.fromIntro ? -1 : GM.findIndex((g) => g.id === D2T.state.stageAt);
      let pos = back >= 0 ? back : Math.max(0, classicAt), vel = 0, target = pos, raf = 0, drag = null, shown = -1;
      const wrapD = (d) => ((d % N) + N * 1.5) % N - N / 2;
      const idx = (p) => ((Math.round(p) % N) + N) % N;
      function render() {
        SL.forEach((s, i) => { const d = wrapD(i - pos); s.style.transform = `rotate(${(d * STEP).toFixed(3)}deg)`; s.style.opacity = Math.max(0, 1 - Math.abs(d) * 0.78).toFixed(3); s.style.visibility = Math.abs(d) > 1.6 ? 'hidden' : 'visible'; });
        BG.forEach((b, i) => { b.style.opacity = Math.max(0, 1 - Math.abs(wrapD(i - pos))).toFixed(3); });
        const n = idx(pos);
        if (n !== shown) { const was = shown; shown = n; onShow(n, was); }
      }
      function settle() {
        cancelAnimationFrame(raf); let last = performance.now();
        const step = (now) => {
          const dt = Math.min(0.032, (now - last) / 1000); last = now;
          vel += (-210 * (pos - target) - 19 * vel) * dt; pos += vel * dt; render();
          if (Math.abs(pos - target) < 0.0008 && Math.abs(vel) < 0.002) { pos = target; vel = 0; render(); rest(); return; }
          raf = requestAnimationFrame(step);
        };
        if (reduced) { pos = target; vel = 0; render(); rest(); return; }
        raf = requestAnimationFrame(step);
      }
      cleanups.push(() => cancelAnimationFrame(raf));
      const go = (t) => { target = t; D.rest = false; settle(); };   // D: the Daily takeover's state, below
      const turn = (dlt) => go(Math.round(target) + dlt);
      wheel.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        cancelAnimationFrame(raf); drag = { x: e.clientX, y: e.clientY, p: pos, t: performance.now(), lx: e.clientX, v: 0, moved: false, lb: e.target.closest('.stg-lb') };
        wheel.setPointerCapture(e.pointerId);
      });
      wheel.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const now = performance.now();
        if (!drag.moved && Math.abs(e.clientX - drag.x) < 4) return;
        drag.moved = true; wheel.classList.add('drag');
        drag.v = -(e.clientX - drag.lx) / W / Math.max(0.008, (now - drag.t) / 1000); drag.lx = e.clientX; drag.t = now;
        pos = drag.p - (e.clientX - drag.x) / W; render();
      });
      const up = () => {
        if (!drag) return; wheel.classList.remove('drag');
        if (!drag.moved) { const lb = drag.lb; drag = null; go(Math.round(pos)); if (lb && lb.closest('.stg-sl') === SL[shown]) openBoard(GM[shown], lb); return; }
        vel = drag.v * 0.6; const flick = Math.abs(drag.v) > 1.2 ? Math.sign(drag.v) : 0;
        let t = Math.round(pos); if (flick && t === Math.round(drag.p)) t += flick;
        drag = null; go(t);
      };
      wheel.addEventListener('pointerup', up); wheel.addEventListener('pointercancel', up);
      $('.stg-sw.l').onclick = () => turn(-1); $('.stg-sw.r').onclick = () => turn(1);
      // the league table shield: the leaderboard on that game, or the account page to sign in first
      function openBoard(g, sh) {
        window.D2TSound && window.D2TSound.play('tapSmall');
        D2T.state.stageAt = g.id; D2T.save();
        if (!D2T.lb || !D2T.lb.signedIn()) { D2T.go('account'); return; }
        // the shield's outline lifts off and flies to the trophy card on the leaderboard (build 195; leaderboard.js D2T.lbFly)
        const F = D2T.lbFly;
        if (!F || F.still() || !sh || !sh.isConnected) { D2T.go('leaderboard', { game: g.id }); return; }
        const b = sh.querySelector('b'), sp = sh.querySelector('span');
        const ghost = F.ghostAt(sh.getBoundingClientRect(), g.k, false, `<b>${b ? b.innerHTML : ''}</b><span>${sp ? sp.innerHTML : ''}</span>`);
        sh.style.visibility = 'hidden';
        ghost.querySelectorAll('b, span').forEach((n) => n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }));
        el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.97)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
        later(() => D2T.go('leaderboard', { game: g.id, ghost }), 160);
      }
      // the positions come from the server once it answers: the shields are drawn again if that changes what they show
      const shieldsNow = () => GM.map((g) => (g.board ? '' : homeShields(g).map((x) => x[0] + '|' + x[1]).join(','))).join(';');
      let shieldsWere = shieldsNow();
      const redrawShields = () => { if (!root.isConnected || shieldsNow() === shieldsWere) return; shieldsWere = shieldsNow(); GM.forEach((g, i) => { const st = SL[i].querySelector('.stg-st'); if (st) st.innerHTML = shieldsHTML(homeShields(g), g.k); }); };
      if (D2T.lb) D2T.lb.positions().then(redrawShields).catch(() => {});
      const onKey = (e) => { if (document.querySelector('.sheet')) return; if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.stg-lb')) { e.preventDefault(); openBoard(GM[shown], e.target.closest('.stg-lb')); return; } if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') dlyBack(); if (e.key === 'ArrowRight') turn(1); else if (e.key === 'ArrowLeft') turn(-1); };
      document.addEventListener('keydown', onKey); cleanups.push(() => document.removeEventListener('keydown', onKey));

      // ---------- the game on show: dots, colours, the button, its art's motion ----------
      const arts = {};   // per game: start() when it comes on, stop() when it goes
      function onShow(n, was) {
        const g = GM[n];
        el.style.setProperty('--k', g.k); el.style.setProperty('--kt', g.kt || g.k); el.style.setProperty('--ink', g.ink || '#0A0A0A');
        DT.forEach((d, i) => d.classList.toggle('on', i === n));
        $('.stg-shr').disabled = !g.share; $('.stg-shr').setAttribute('aria-label', g.share ? `Share your ${g.name} record` : 'Share');
        drawBar(g);
      }
      // once the wheel comes to rest: the game on show starts moving (the one before stops) and its share card is built
      // when the phone is idle (both ran on every slide passed and while the spring settled: Fable's review, 30 Oct)
      let moving = -1, idleId = 0;
      const idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 1500 }) : (f) => setTimeout(f, 300);
      const noIdle = window.cancelIdleCallback || clearTimeout;
      cleanups.push(() => noIdle(idleId));
      function rest() {
        const n = shown, g = GM[n];
        dlyRest();
        if (moving !== n) {
          if (moving >= 0 && arts[GM[moving].id]) arts[GM[moving].id].stop();
          moving = n;
          if (arts[g.id] && !reduced) arts[g.id].start();
          if (g.board && arts.ten) arts.ten.reset();
        }
        noIdle(idleId); idleId = idle(() => { if (shown === n && root.isConnected) shareCard(g); });
      }

      // ---------- the button at the foot ----------
      function drawBar(g) {
        if (!g.run) {
          bar.className = 'stg-bar';
          bar.innerHTML = `<button class="stg-main" data-act="main" data-game="${g.id}"><span>${esc(g.play)}</span><span class="stg-parw">${ARROW}</span></button>`;
        } else {
          const c = contLook(g);
          bar.className = 'stg-bar split';
          bar.innerHTML = `<button class="stg-newg" data-act="new" data-game="${g.id}">New game<span class="stg-parw">${ARROW}</span></button>
            <button class="stg-contg" data-act="continue" data-game="${g.id}" aria-label="Continue ${esc(c.label)}" style="--c1:${c.a};--ct:${dark(c.a) ? '#FFFFFF' : '#0A0A0A'}">${c.crest ? `<img src="${c.crest}" alt="">` : ''}Continue<span class="stg-parw">${ARROW}</span></button>`;
        }
        bar.querySelectorAll('button').forEach((b) => { b.onclick = (e) => act(b.dataset.act, g, e.currentTarget); });
      }
      // Continue in the run's own colours: the club for Classic, the Daily and Club X (the old continue card's sweep)
      function contLook(g) {
        if (g.id === 'goal') return { a: '#FFD21F', crest: window.D2T_GOALRUSH_LOGO, label: 'your Goal Rush game' };
        if (g.id === 'ub') return { a: '#22D3EE', crest: D2T.share.svgSrc(D2T.ubMark.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" color="#0A0A0A" ')), label: 'your Unbeaten run' };
        return viewRun(g.run, () => { const c = D2T.run().club; return { a: c.accent || g.k, crest: c.crestCard || c.crestLight || c.crest, label: `${c.name} ${D2T.run().season}` }; });
      }
      const ask = (title, line, yes, fn) => {
        const s = D2T.sheet({ title, body: `<p class="fr-lead">${line}</p><div class="fr-two"><button class="btn btn-ghost" data-k="no">Keep it</button><button class="btn btn-ghost" data-k="yes" style="color:#12F06C">${yes}</button></div>` });
        s.body.querySelector('[data-k="no"]').onclick = s.close;
        s.body.querySelector('[data-k="yes"]').onclick = () => { s.close(); fn(); };
      };
      const newRun = (from, mode) => { G.newRun(mode); D2T.toBlack('spin', { from }); };
      function act(kind, g, from) {
        const st = D2T.state;
        st.stageAt = g.id; D2T.save();
        if (g.id === 'ten') { window.open(TENABALL, '_blank', 'noopener'); return; }
        if (g.id === 'daily') {
          if (kind === 'new') { ask('Start again?', 'Your go at today\'s Daily will be lost. Your best go today still counts.', 'Start again', () => { G.restartDaily(); D2T.toBlack(G.stepFor() || 'table', { from }); }); return; }
          G.startDaily(); D2T.toBlack(G.stepFor() || 'table', { from }); return;
        }
        if (g.id === 'goal') {
          if (kind === 'new') { ask('New Goal Rush game?', 'The game you have going will be lost.', 'New game', () => { st.g433 = null; D2T.save(); D2T.toBlack('goals433', { from }); }); return; }
          D2T.toBlack('goals433', { from }); return;
        }
        if (g.id === 'ub') {
          if (kind === 'new') { ask('New run?', 'The run you have going will be lost.', 'New run', () => { if (st.ub) st.ub.run = null; D2T.save(); D2T.toBlack('unbeaten', { from }); }); return; }
          D2T.toBlack('unbeaten', { from }); return;
        }
        // Classic and Club X
        if (kind === 'continue') {
          if (st.run !== g.run) { if (G.otherRun() === g.run) G.switchToOther(); else { G.stashDaily(); st.run = g.run; if (st.parked === g.run) st.parked = null; D2T.save(); } }
          D2T.toBlack(G.stepFor() || 'squad', { from }); return;
        }
        G.stashDaily();                                            // an unfinished Daily keeps its own slot
        const live = G.live(st.run) ? st.run : null;
        const lose = kind === 'new' ? g.run : live;
        if (!lose) { newRun(from, g.mode); return; }
        const name = viewRun(lose, () => D2T.run().club.name), career = G.careerOpen(lose);
        ask(career ? 'Start a new career?' : 'Start a new run?', career ? `Your ${esc(name)} career is waiting for its next season. Starting again will lose it.` : `Your ${esc(name)} run will be lost.`, career ? 'New career' : 'New run', () => {
          if (st.parked === lose) st.parked = null;
          if (st.run !== lose && G.live(st.run) && !st.run.daily) st.parked = st.run;   // the other game's run waits
          st.run = null; newRun(from, g.mode);
        });
      }

      // ---------- share, rules, account ----------
      const cards = {};
      function sharePage(g) {
        const p = (D2T.recordPages() || []).find((x) => x.k === g.share);
        const out = p ? Object.assign({}, p) : { k: g.share, name: g.name, c: g.k, mark: {}, shields: [] };
        out.shields = (g.id === 'daily' ? shieldsFor('daily', true) : g.st).map(([n, l]) => ({ n, l }));
        if (g.id === 'classic') out.c = CLASSIC;
        if (g.id === 'daily') { out.c = g.k; out.mark = { src: g.entry.crest }; }
        return out;
      }
      const shareCard = (g) => (g.share ? cards[g.id] || (cards[g.id] = D2T.recordShare(sharePage(g))) : null);
      // Share opens a choice (Craig, 30 Oct): your game in progress (or today's Daily result) or your record for this game
      const send = (sh) => { if (!sh) return; window.D2TSound && window.D2TSound.play('share'); const fire = () => (sh.done ? D2T.share.send(sh) : setTimeout(fire, 80)); fire(); };
      $('.stg-shr').onclick = () => {
        const g = GM[shown]; if (!g.share) return;
        const today = g.id === 'daily' && G.dailyResult();
        const prog = g.run ? progressShare(g) : today ? D2T.dailyShare(G.today()) : null, rec = shareCard(g);
        // the end sheet's own pill buttons (Craig, 30 Oct): the first filled in the game's colour, the record as the outlined ghost
        const btn = (k, label, main) => `<button class="btn ${main ? 'end-primary' : 'btn-ghost'} fr-btn-wide" type="button" data-k="${k}"${main ? ` style="background:${g.k};color:${g.ink || '#0A0A0A'}"` : ' style="border-color:#fff"'}>${label}</button>`;
        const s = D2T.sheet({ title: `Share ${esc(g.name)}`, cls: 'stg-share', body: `<div class="fr-stack end-stack stg-opts">${prog ? btn('prog', g.run ? 'My game so far' : 'Today\'s result', true) : ''}${btn('rec', 'My record', !prog)}</div>` });
        const b1 = s.body.querySelector('[data-k="prog"]'); if (b1) b1.onclick = () => { s.close(); send(prog); };
        s.body.querySelector('[data-k="rec"]').onclick = () => { s.close(); send(rec); };
      };
      $('.stg-q').onclick = () => { const g = GM[shown]; if (D2T.gameHelp) D2T.gameHelp(g); else D2T.sheet({ title: g.name, body: `<p class="fr-lead">${esc(g.rules)}</p>` }); };
      // where a game in progress stands, for its share
      function runNow(g) {
        if (g.id === 'goal') { const S4 = g.run, t = (S4.filled || []).reduce((a, x) => a + (x.goals || 0), 0); return { n: S4.filled.length, total: t, target: +S4.formation, shape: G.g433.shapeText(S4.formation) }; }
        if (g.id === 'ub') { const A = D2T.ubArt, st = A && A.STATS.find((x) => x.id === g.run.stat); return { streak: g.run.streak || 0, stat: st ? st.big : 'Higher or lower' }; }
        return viewRun(g.run, () => {
          const d = D2T.run(), c = d.club, e = G.eng(), games = G.fixtures().length, played = (e.played || []).length;
          const row = played ? G.standings(null).find((x) => x.name === G.clubName()) : null;
          const real = g.id === 'clubx' ? null : G.historyTable().find((x) => x.name === G.clubName());   // where they really finished
          return { c, name: g.id === 'clubx' ? G.xName() : (c.full || c.name), season: d.season, played, games, pos: row ? row.pos : null, pts: row ? row.pts : 0, hist: real ? real.pos : null };
        });
      }
      // a share card for a game in progress, in the share cards' frame
      function progressShare(g) {
        const r = runNow(g), o = D2T.ordinal, L = D2T.share.LINK, end = ['', '_Your turn. Beat that!_', L];
        if (g.id === 'goal') {
          return D2T.share.build({ text: [`*DROP2TOP Goal Rush · ${r.shape}*`, '', `${r.n} of 11 picked: ${r.total} career goals so far.`, `Target ${r.target}.`].concat(end).join('\n'),
            c: g.k, wash: g.k, band: g.k, ink: '#0A0A0A', tag: `Goal Rush · ${r.shape}`, dare: 'Pick 11. Hit the number', imgs: { mark: window.D2T_GOALRUSH_LOGO },
            draw: (gx, im, k) => { k.pic(im.mark, k.W / 2, 262, 220); k.mid(`${r.total}/${r.target}`, k.W / 2, 640, 960, 900, 150, true, '#FFFFFF'); k.fit(`${r.n} OF 11 PICKED · GAME IN PROGRESS`, k.W / 2, 760, 960, 800, 30, false, g.k, 'center', '3px'); } });
        }
        if (g.id === 'ub') {
          return D2T.share.build({ text: ['*DROP2TOP Unbeaten Run*', '', `Topic: ${r.stat.toLowerCase()}`, `Unbeaten in ${r.streak} call${r.streak === 1 ? '' : 's'} so far, and still going.`].concat(end).join('\n'),
            c: g.k, wash: g.k, band: g.k, ink: '#001A1F', tag: 'Unbeaten Run', dare: `Can you beat ${r.streak}?`, imgs: { mark: D2T.share.svgSrc(D2T.ubMark.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" color="${g.k}" `)) },
            draw: (gx, im, k) => { k.pic(im.mark, k.W / 2, 262, 200); gx.save(); gx.shadowColor = 'rgba(34,211,238,.45)'; gx.shadowBlur = 60; k.mid(String(r.streak), k.W / 2, 640, 600, 900, 190, true, g.k); gx.restore(); k.fit('IN A ROW AND STILL GOING', k.W / 2, 770, 960, 800, 30, false, '#FFFFFF', 'center', '3px'); k.fit(r.stat.toUpperCase(), k.W / 2, 830, 960, 900, 54, true, '#FFFFFF'); } });
        }
        const c = r.c, acc = g.id === 'clubx' ? '#12F06C' : (c.accent || g.k), txt = g.id === 'clubx' ? '#12F06C' : (c.text || '#FFFFFF');
        const label = g.id === 'daily' ? 'Daily Challenge' : g.name;
        const where = r.played ? `${o(r.pos)} after ${r.played} of ${r.games} games, on ${r.pts} pts.` : 'Building the squad for the season.';
        const lines = [`*DROP2TOP ${label}*`, '', `${r.name} ${r.season}`, where];
        if (r.hist && g.id !== 'clubx') lines.push(`They really went down in ${o(r.hist)}.`);
        return D2T.share.build({ text: lines.concat(end).join('\n'), c: g.id === 'daily' ? '#FFFFFF' : g.id === 'clubx' ? '#12F06C' : txt, wash: acc, band: acc, ink: g.id === 'clubx' ? '#0A0A0A' : (c.ink || '#0A0A0A'),
          tag: `${label} · in progress`, dare: 'Can you do better?', imgs: { crest: c.crestCard || c.crest },
          draw: (gx, im, k) => {
            k.clubBlock(im.crest, r.name, r.season);
            k.mid(r.played ? o(r.pos) : 'PRE-SEASON', k.W / 2, 712, 960, 900, r.played ? 150 : 90, true, txt);
            k.fit(r.played ? `MATCHDAY ${r.played} OF ${r.games} · ${r.pts} PTS` : 'THE SEASON STARTS SOON', k.W / 2, 800, 960, 800, 28, false, '#FFFFFF', 'center', '3px');
            if (r.hist && g.id !== 'clubx') k.line2('THEY WENT DOWN IN ', o(r.hist).toUpperCase(), txt, 870);
            else if (g.id === 'clubx') k.line2('CHASING ', 'THE TITLE', txt, 870);
          } });
      }
      // first-time tips on the stage (Craig, 30 Oct): swipe for the other games, then the rules, then Share
      later(() => { if (!root.isConnected || document.querySelector('.sheet')) return; D2T.tips([['stage-swipe', $('.stg-dots'), 'Swipe for the other games', { side: 'right' }], ['stage-help', $('.stg-q'), 'How each game works', { place: 'below', side: 'right' }], ['stage-share', $('.stg-shr'), 'Share your game or your record', { place: 'below', side: 'right' }]]); }, params.fromIntro ? 2600 : 900);

      // ---------- the Daily takes over the top bar (Craig, 31 Oct, build 184; option 3 in design/prototype/daily-morph.html) ----------
      // Now and then, only while the wheel rests on another game and today's Daily isn't done: the emblem spins, turns into a
      // white circle and stretches across the top bar (crest, label, club and season, Play or Carry on), holds, then goes back.
      // A tap on it turns the wheel to the Daily. 6 s after coming to rest, then every 45 s; at most 2 a visit and 6 a day.
      const DT0 = $('.stg-top'), DEMB = DT0.querySelector('.fr-hl-emb'), DBAR = DT0.querySelector('.stg-dly');
      const D = { wait: 0, steps: [], on: false, plays: 0, touched: 0, anims: [] };
      const dTimer = (f, ms) => { const t = setTimeout(f, ms); D.steps.push(t); return t; };
      cleanups.push(() => { clearTimeout(D.wait); D.steps.forEach(clearTimeout); D.anims.forEach((a) => a.cancel()); });
      function dlyState() {
        const today = G.today(), st = D2T.state;
        if (G.dailyResult(today)) return null;
        const done = [st.run, st.dailyRun].some((r) => r && r.daily === today && (r.recorded || (r.eng && r.eng.phase === 'summary')));
        if (done) return null;
        return runsGoing().daily ? 'live' : 'new';
      }
      const dlyCapped = () => { const c = D2T.state.dailyNudge; return !!(c && c.day === G.today() && c.n >= 6); };
      const dlyBlocked = () => !root.isConnected || drag || !D.rest || GM[shown].id === 'daily' || document.querySelector('.sheet, .d2t-tip') || Date.now() - D.touched < 3000;
      function dlySchedule(ms) { clearTimeout(D.wait); if (D.plays >= 2) return; D.wait = setTimeout(dlyTry, ms); }
      function dlyTry() {
        if (D.on || D.plays >= 2 || dlyCapped() || !dlyState()) return;
        if (dlyBlocked()) { if (GM[shown].id !== 'daily') dlySchedule(3000); return; }
        dlyPlay();
      }
      function dlyRest() {
        D.rest = true;
        if (GM[shown].id === 'daily') { clearTimeout(D.wait); D.plays = 0; return; }
        if (!D.on) dlySchedule(6000);
      }
      function dlyFill(state) {
        const d = G.dailyEntry(G.today()), c = G.club(d.name) || {};
        const ink = c.ink && dark(c.ink) ? c.ink : '#0A0A0A';
        DBAR.style.setProperty('--dink', ink);
        DBAR.querySelector('img').src = c.crestLight || c.crest || '';
        DBAR.querySelector('.stg-dly-tx i').textContent = state === 'live' ? 'Your Daily is in progress' : "Today's Daily Challenge";
        DBAR.querySelector('.stg-dly-tx b').textContent = `${d.name} ${d.season}`;
        DBAR.querySelector('.stg-dly-go span').textContent = state === 'live' ? 'Carry on' : 'Play';
        DBAR.setAttribute('aria-label', state === 'live' ? "Carry on today's Daily" : "Play today's Daily");
        // the circle sits on the emblem and grows to the account button's right edge
        const tr = DT0.getBoundingClientRect(), er = DEMB.getBoundingClientRect(), left = er.left + er.width / 2 - tr.left - 22;
        DBAR.style.setProperty('--dl', left.toFixed(1) + 'px'); DBAR.style.setProperty('--dw', (tr.width - left).toFixed(1) + 'px');
      }
      // one continuous timeline (Craig, 31 Oct, build 185; run3() in daily-morph.html at b3eba36): ms from the start, the bar
      // full by 1400, held to R, then back, the emblem already spinning in as the bar shrinks; every piece is one keyframe track
      const R = 1400 + 4000, T = R + 1300;
      function track(node, pts) {
        const f = pts.map(([t, o, e]) => Object.assign({ offset: t / T }, o, e ? { easing: e } : {}));
        if (pts[0][0] > 0) f.unshift(Object.assign({}, pts[0][1], { offset: 0 }));
        if (pts[pts.length - 1][0] < T) f.push(Object.assign({}, pts[pts.length - 1][1], { offset: 1 }));
        const an = node.animate(f, { duration: T, fill: 'both' }); D.anims.push(an); return an;
      }
      function dlyPlay() {
        const state = dlyState(); if (!state) return;
        dlyFill(state);
        D.on = true; D.plays += 1;
        const st = D2T.state; if (!st.dailyNudge || st.dailyNudge.day !== G.today()) st.dailyNudge = { day: G.today(), n: 0 }; st.dailyNudge.n += 1; D2T.save();
        DT0.classList.add('dly-on'); DBAR.removeAttribute('aria-hidden'); DBAR.tabIndex = 0;
        if (reduced) {
          DT0.classList.add('dly-rm', 'dly-circ', 'dly-full');
          dTimer(() => dlyBack(), 300 + 4000);
          return;
        }
        const rot = (d) => `rotate(${d}deg)`, W = (parseFloat(DBAR.style.getPropertyValue('--dw')) || 359) + 'px', Q = (x) => DBAR.querySelector(x);
        track(DEMB, [[0, { transform: rot(0), opacity: 1 }, 'cubic-bezier(.5,0,1,1)'], [650, { transform: rot(230), opacity: 1 }, 'linear'], [850, { transform: rot(317), opacity: 0 }, 'linear'], [950, { transform: rot(360), opacity: 0 }],
          [R + 330, { transform: rot(360), opacity: 0 }, 'linear'], [R + 500, { transform: rot(250), opacity: 1 }, 'cubic-bezier(0,0,.3,1)'], [R + 1300, { transform: rot(0), opacity: 1 }]]);
        track(DBAR, [[650, { opacity: 0, transform: 'scale(.8)', width: '44px' }, 'ease-out'], [800, { opacity: 1, transform: 'scale(1)', width: '44px' }, 'linear'], [820, { opacity: 1, transform: 'scale(1)', width: '44px' }, 'cubic-bezier(.35,.9,.45,1.06)'], [1400, { opacity: 1, transform: 'scale(1)', width: W }],
          [R, { opacity: 1, transform: 'scale(1)', width: W }, 'cubic-bezier(.55,0,.9,.6)'], [R + 330, { opacity: 1, transform: 'scale(1)', width: '124px' }, 'cubic-bezier(.2,.6,.4,1)'], [R + 520, { opacity: 1, transform: 'scale(1)', width: '44px' }, 'ease-in'], [R + 640, { opacity: 0, transform: 'scale(.8)', width: '44px' }]]);
        track(Q('.stg-dly-cr'), [[650, { transform: rot(-130) }, 'linear'], [950, { transform: rot(0) }], [R + 330, { transform: rot(0) }, 'linear'], [R + 640, { transform: rot(-200) }]]);
        track(Q('.stg-dly-tx'), [[950, { opacity: 0, transform: 'translateX(10px)' }, 'ease-out'], [1250, { opacity: 1, transform: 'none' }], [R, { opacity: 1, transform: 'none' }, 'ease-in'], [R + 150, { opacity: 0, transform: 'translateX(6px)' }]]);
        track(Q('.stg-dly-go'), [[1100, { opacity: 0, transform: 'scale(.6)' }, 'cubic-bezier(.3,1.6,.5,1)'], [1450, { opacity: 1, transform: 'scale(1)' }], [R, { opacity: 1, transform: 'scale(1)' }, 'ease-in'], [R + 150, { opacity: 0, transform: 'scale(.7)' }]]);
        track(Q('.stg-dly-sh'), [[1500, { transform: 'translateX(-50px)', opacity: 0 }, 'ease-in-out'], [1650, { opacity: 1 }], [2150, { opacity: 1 }], [2300, { transform: `translateX(${W})`, opacity: 0 }]]);
        DT0.querySelectorAll('.fr-hl-p:not(.fr-hl-emb), .stg-rb').forEach((n) => track(n, [[700, { opacity: 1 }, 'ease-out'], [950, { opacity: 0 }], [R + 330, { opacity: 0 }, 'ease-out'], [R + 700, { opacity: 1 }]]));
        dTimer(() => DT0.classList.add('dly-circ'), 650);    // the bar takes taps once it shows
        dTimer(() => DT0.classList.add('dly-full'), 1400);   // full width (the animations draw it; the class marks the state)
        dTimer(() => dlyBack(), T);
      }
      // back to the logo: at once (a tap, a swipe, a sheet) or once the timeline has played out
      function dlyBack() {
        if (!D.on) return;
        D.steps.forEach(clearTimeout); D.steps = [];
        D.anims.forEach((an) => an.cancel()); D.anims = [];
        if (reduced && DT0.classList.contains('dly-rm')) { DT0.classList.remove('dly-full', 'dly-circ', 'dly-on'); dTimer(() => DT0.classList.remove('dly-rm'), 320); }   // the crossfade back
        else DT0.classList.remove('dly-full', 'dly-circ', 'dly-on', 'dly-rm');
        D.on = false; DBAR.setAttribute('aria-hidden', 'true'); DBAR.tabIndex = -1;
        if (GM[shown].id !== 'daily') dlySchedule(45000);
      }
      DBAR.onclick = (e) => {
        e.stopPropagation(); if (!D.on) return;
        dlyBack();
        const di = GM.findIndex((g) => g.id === 'daily'), cur = Math.round(target);
        go(cur + wrapD(di - idx(cur)));
      };
      // any other touch rolls it back at once and pushes the next one back
      const dlyTouch = (e) => { D.touched = Date.now(); if (D.on && !DBAR.contains(e.target)) dlyBack(); };
      el.addEventListener('pointerdown', dlyTouch, true); cleanups.push(() => el.removeEventListener('pointerdown', dlyTouch, true));
      wheel.addEventListener('pointerdown', () => { D.rest = false; }, true);
      $('.stg-acct').onclick = () => D2T.go('account');
      $('.stg-logo').onclick = () => D2T.go('intro');

      // ---------- the art's motion ----------
      // Classic: the home fan (FAN_POS), turning every few seconds; the card heading to the back cross-fades to a new club
      // as it starts to move. Every card sits in the same box, so none jumps.
      (() => {
        const fan = el.querySelector('.stg-cfan'); if (!fan) return;
        const POS = [{ t: 'translate(-50%,-50%) rotate(-13deg) translateY(6px)', z: 1 }, { t: 'translate(-50%,-50%) rotate(0deg) translateY(-6px)', z: 3 }, { t: 'translate(-50%,-50%) rotate(13deg) translateY(6px)', z: 2 }];
        const pool = G.pool, used = [];
        const pick = () => { let c, n = 0; do { c = pool[Math.floor(Math.random() * pool.length)]; } while (used.includes(c.key) && ++n < 50); used.push(c.key); if (used.length > 6) used.shift(); return c; };
        const card = (c) => `<span class="stg-fc">${D2T.cards.club(c, { w: 150, slow: true, delay: -Math.random() * 10 })}</span>`;
        const slots = POS.map((p) => { const s = D2T.h(`<span class="stg-fs" style="transform:${p.t};z-index:${p.z}">${card(pick())}</span>`); fan.appendChild(s); return s; });
        let turnN = 0, iv = 0;
        const tick = () => {
          if (document.hidden) return;
          turnN = (turnN + 1) % 3;
          slots.forEach((s, i) => { const p = POS[(i + turnN) % 3]; s.style.transform = p.t; s.style.zIndex = p.z; });
          const back = slots.find((s) => s.style.zIndex === '1'); if (!back) return;
          const old = back.lastElementChild, nx = D2T.h(card(pick())); back.appendChild(nx);
          const t = { duration: 700, easing: 'ease-in-out', fill: 'forwards' };
          nx.animate([{ opacity: 0 }, { opacity: 1 }], t); old.animate([{ opacity: 1 }, { opacity: 0 }], t);
          later(() => old.remove(), 750);
        };
        arts.classic = { start: () => { clearInterval(iv); iv = every(tick, 4000); }, stop: () => clearInterval(iv) };
      })();

      // Goal Rush: formations, three real players' shirts (goals rolling up as they appear) and two empty shirts float
      // round the ball, with four smaller balls drifting by; ?-?-? rolls to a formation and back
      (() => {
        const gr = el.querySelector('.stg-gr'); if (!gr) return;
        const find = (sur, pos) => (G.g433.list(pos) || []).find((p) => p.sur === sur);
        const P = [find('Bowen', 'FWD'), find('Ings', 'FWD'), find('Duff', 'MID')];
        const FL = [['f', '4-4-2'], ['p', P[0]], ['e', 'DEF'], ['p', P[1]], ['f', '3-5-2'], ['e', 'myst'], ['p', P[2]]];
        const spots = [[40, 40, 0], [210, 26, 1], [236, 140, 0], [200, 214, 1], [44, 206, 0], [30, 120, 1], [128, 8, 0]];
        const nums = [];
        FL.forEach(([t, v], i) => {
          let html;
          if (t === 'f') html = `<span class="stg-fm">${v}</span>`;
          else if (t === 'e') html = D2T.shirts.shirt(v === 'myst' ? { w: 46, state: 'myst' } : { w: 46, pos: 'DEF' });
          else if (v) html = D2T.shirts.shirt({ w: 46, player: Object.assign({}, v, { goals: v.goals }) });
          else return;
          const f = D2T.h(`<div class="stg-fl${spots[i][2] ? ' over' : ''}" style="left:${spots[i][0]}px;top:${spots[i][1]}px;animation-delay:${(i * 1.57).toFixed(2)}s">${html}</div>`);
          gr.appendChild(f);
          if (t === 'p') { const num = f.querySelector('.gnum'); if (num) { nums.push(num); const roll = () => rollNum(num, v.goals); f.addEventListener('animationstart', roll); f.addEventListener('animationiteration', roll); } }
        });
        [[96, 40, 30, 1, 0.8], [262, 92, 24, 0, 3.6], [78, 250, 34, 1, 6.2], [240, 250, 22, 0, 9.4]].forEach(([x, y, w, o, dl]) => gr.appendChild(D2T.h(`<div class="stg-mb${o ? ' over' : ''}" style="left:${x}px;top:${y}px;width:${w}px;animation-delay:${dl}s"><img src="${window.D2T_GOALRUSH_LOGO || ''}" alt=""></div>`)));
        function rollNum(num, to) {
          if (reduced) { num.textContent = to; return; }
          const t0 = performance.now(), D = 1100;
          const f = (now) => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); num.textContent = k < 1 ? Math.round(to * e + (1 - e) * Math.random() * to) : to; if (k < 1 && num.isConnected) requestAnimationFrame(f); };
          requestAnimationFrame(f);
        }
        // the ?-?-? in the headline: each figure rolls up like a reel to a formation, holds, rolls back to ?, then on
        const DR = [...el.querySelectorAll('.stg-sl[data-id="goal"] .stg-dr')], FS = ['433', '442', '352', '451', '343', '532', '424', '541'];
        let fi = 0, iv = 0, back = 0;
        const roll = (dr, to, delay) => {
          const seq = []; for (let k = 0; k < 7; k++) seq.push(String(Math.floor(Math.random() * 10))); seq.push(to);
          const cur = dr.lastElementChild ? dr.lastElementChild.textContent : '?';
          dr.innerHTML = [cur, ...seq].map((c) => `<i>${c}</i>`).join(''); dr.style.transition = 'none'; dr.style.transform = 'translateY(0)'; void dr.offsetHeight;
          later(() => { dr.style.transition = 'transform 1.1s cubic-bezier(.2,.75,.25,1.12)'; dr.style.transform = `translateY(-${(seq.length * 1.02).toFixed(2)}em)`; }, delay);
        };
        const cyc = () => { const f = FS[fi++ % FS.length]; DR.forEach((dr, i) => roll(dr, f[i], i * 160)); back = later(() => DR.forEach((dr, i) => roll(dr, '?', i * 160)), 3600); };
        let first = 0;
        arts.goal = { start: () => { clearInterval(iv); clearTimeout(first); first = later(cyc, 900); iv = every(cyc, 6400); }, stop: () => { clearInterval(iv); clearTimeout(first); clearTimeout(back); } };
      })();

      // Unbeaten: Man Utd v Man City's club cards; every 8s both roll up like reels (the right 180ms behind) through other
      // cards and shirts to Rooney 208 and Salah ?, then back again
      (() => {
        const sA = el.querySelector('.stg-strip[data-side="0"]'), sB = el.querySelector('.stg-strip[data-side="1"]'); if (!sA) return;
        // both ways for both reels are built once, the first time the slide comes on, and only swapped in after that
        // (rebuilding six items a reel every 8s cost a 50ms frame: Fable's review, 30 Oct)
        let side = 0, iv = 0, built = null;
        const H = 196;
        const build = () => {
          const mid = UB.fill.slice().sort(() => Math.random() - 0.5);
          built = [0, 1].map((sd) => { const L = sd ? UB.right : UB.left, m = sd ? mid.slice(2, 6) : mid.slice(0, 4);
            return [0, 1].map((dir) => { const box = document.createElement('div'); box.innerHTML = ubItem(L[dir], !sd) + m.map((x) => ubItem(x, false)).join('') + ubItem(L[1 - dir], !sd); return box; }); });
        };
        const flip = () => {
          if (!built) build();
          [sA, sB].forEach((strip, sd) => {
            strip.getAnimations().forEach((a) => a.cancel());
            strip.replaceChildren(built[sd][side]);
            strip.animate([{ transform: 'translateY(0)' }, { transform: `translateY(-${5 * H}px)` }], { duration: 1300, delay: sd ? 180 : 0, easing: 'cubic-bezier(.25,.7,.25,1.1)', fill: 'forwards' });
          });
          side = 1 - side;
        };
        arts.ub = { start: () => { clearInterval(iv); if (!built) idle(() => { if (!built && root.isConnected) build(); }); iv = every(flip, 8000); }, stop: () => clearInterval(iv) };
      })();

      // Tenaball: the board fills from 4th up to 1st in the Premier League's green to teal, climbing as it fills, holds,
      // then again; it starts again from 4th each time you land on Tenaball
      (() => {
        const tbl = el.querySelector('.stg-tbl'); if (!tbl) return;
        const rows = [...tbl.children], RH = 41, VIS = 3, TOP = rows.length; let r = TOP, tm = 0;
        const show = () => { const top = Math.max(0, r - VIS); tbl.style.transform = `translateY(${-top * RH + 4}px)`; rows[r - 1].classList.add('on'); };
        const reset = () => { rows.forEach((x) => x.classList.remove('on', 'win')); r = TOP; tbl.style.transition = 'none'; tbl.style.transform = `translateY(${-(TOP - VIS) * RH + 4}px)`; void tbl.offsetHeight; tbl.style.transition = ''; };
        // a little quicker, and the top answer celebrated: it bounces and glows, holds, then the board starts again (Craig, 30 Oct)
        const tick = () => { if (r < 1) { tm = later(() => { reset(); tm = later(tick, 600); }, 3600); return; } show(); if (r === 1) later(() => rows[0].classList.add('win'), 350); r--; tm = later(tick, 900); };
        arts.ten = { start: () => {}, stop: () => clearTimeout(tm), reset: () => { clearTimeout(tm); reset(); if (reduced) { rows.forEach((x) => x.classList.add('on')); tbl.style.transform = 'translateY(4px)'; } else tm = later(tick, 500); } };
        reset();
      })();

      // ---------- opening ----------
      render(); rest();
      // arriving from the intro: take the logo from where the intro left it (measured before the wheel was drawn), then
      // bring the stage in
      const fi = params.fromIntro;
      if (fi && typeof fi === 'object' && !reduced) {
        const r = logoR, rr = rootR;
        const dx = fi.left - (r.left - rr.left), dy = fi.top - (r.top - rr.top), s = fi.width / r.width;
        logo.style.transformOrigin = '0 0';
        logo.animate([{ transform: `translate(${dx}px,${dy}px) scale(${s})` }, { transform: 'none' }], { duration: 760, easing: 'cubic-bezier(.6,0,.2,1)' });
        later(() => el.classList.add('on'), 380);
      } else if (fi && !reduced) { later(() => el.classList.add('on'), 60); }
      if (D2T.state.dailyClosed) {                                  // say once that an unfinished Daily closed at midnight
        const dc = D2T.state.dailyClosed; delete D2T.state.dailyClosed; D2T.save();
        later(() => { if (root.isConnected) D2T.sheet({ title: 'That Daily has closed', body: `<p class="fr-lead">${esc(G.dailyName(dc))} closed at midnight before you finished it. Today's club is ready for everyone.</p>` }); }, 900);
      }
      // back from the leaderboard: the trophy card's outline lands back on this game's league shield as home fades in (build 195)
      const gb = params.ghostBack && params.ghostBack.isConnected ? params.ghostBack : null;
      if (gb) {
        const F = D2T.lbFly, sh = SL[idx(pos)] && SL[idx(pos)].querySelector('.stg-lb');
        if (sh && F && !reduced) {
          const r = sh.getBoundingClientRect();
          sh.style.visibility = 'hidden';
          el.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 120, easing: 'ease-out', fill: 'backwards' });
          F.flyTo(gb, r, false, F.FLY).then(() => { sh.style.visibility = ''; sh.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 }); F.fadeOut(gb, 200); });
        } else gb.remove();
        cleanups.push(() => gb.remove());
      }
      // the cards the reels and the fan will show next, so they are ready before they roll in
      later(() => { [...UB.fill, ...UB.left, ...UB.right].forEach((sp) => { const r = ubRow(sp); if (r) { const c = G.club(r.club); [c.crest, c.crestCard, c.crestLight].forEach((u) => { if (u) { const im = new Image(); im.src = u; } }); } }); }, 1200);
    },
    unmount() { cleanups.forEach((f) => { try { f(); } catch (e) { /* gone */ } }); cleanups = []; }
  });
})();
