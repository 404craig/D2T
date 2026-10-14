// Unbeaten Run (black, cyan #22D3EE as the mode colour; Craig's higher or lower game, 12 Oct; designs chosen 12 Oct from
// design/prototype/unbeaten-run.html round 2 and unbeaten-club-cards.html option A).
// A spin picks the stat for the run (Premier League numbers only, for now). Two cards side by side: the left one's number
// shows, the right one's is a ? until you answer. Swipe the right card up for higher, down for lower, or tap Higher or Lower.
// Right: +1 to the unbeaten run, the card slides left and the reel spins in the next. Wrong: the run is over. Sudden death,
// no skips, never an equal pair, never a zero, no repeats in a run. Cards are random from the whole deck, with close calls
// (within 10%) mixed in: about 1 in 5 for cards 1 to 10, 1 in 3 for 11 to 20, then 1 in 2.
// Player stats: his shirt in the club's colours, the surname and the stat as his number (sized by its digits so 260 fits),
// and under it only the crest (36px, from the 128px file) and his flag. Club stats: the Classic club shield, bigger (172 wide,
// two to a row), name and season top left, the crest top right, the number in the middle and the stat's unit near the point.
// Both reel in with the club spin's motion (D2T.roll.profile and sample), left first. Best run per stat in D2T.state.ub.
(function () {
  const C = '#22D3EE';
  const snd = (id) => { const S = window.D2TSound; if (S) S.play(id); };
  const rand = (n) => Math.floor(Math.random() * n);
  const UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 15l7-7 7 7"/></svg>';
  const REFRESH = D2T.ICON.respin;   // the respin arrow every bar uses
  const REFRESHES = 3;   // per run (Craig, 13 Oct): swap the hidden card for another, the streak untouched
  const DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>';
  // the mark: up and down chevrons in a ring, line art like the outline emblem (home card and faded behind the pages)
  const MARK = '<svg class="ub-mark" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="50" cy="50" r="44"/><path d="M30 42 L50 22 L70 42"/><path d="M30 58 L50 78 L70 58"/></svg>';

  // ---------- the stats (one per run) ----------
  const STATS = [
    { id: 'cg', big: 'Career goals', unit: 'Premier League goals', deck: 'career', val: (r) => r.g },
    { id: 'ca', big: 'Career appearances', unit: 'Premier League games', deck: 'career', val: (r) => r.a },
    { id: 'cas', big: 'Career assists', unit: 'Premier League assists', deck: 'career', val: (r) => r.as },
    { id: 'cga', big: 'Career goals + assists', unit: 'Premier League goals and assists', deck: 'career', val: (r) => r.g + r.as },
    { id: 'sg', big: 'Goals in a season', unit: 'Premier League goals', deck: 'season', val: (r) => r.g },
    { id: 'sga', big: 'Goals + assists in a season', unit: 'Premier League goals and assists', deck: 'season', val: (r) => r.g + r.as },
    { id: 'pts', big: 'Points in a season', unit: 'points', short: 'POINTS', deck: 'club', val: (r) => r.pts },
    { id: 'w', big: 'Wins in a season', unit: 'wins', short: 'WINS', deck: 'club', val: (r) => r.w },
    { id: 'atp', big: 'All-time points', unit: 'Premier League points', short: 'POINTS', deck: 'alltime', val: (r) => r.pts }
  ];
  const isClub = (stat) => stat.deck === 'club' || stat.deck === 'alltime';

  // ---------- decks, built once from the game data ----------
  let DECKS = null;
  function decks() {
    if (DECKS) return DECKS;
    const G = window.D2T_GAME, keys = Object.keys(G.seasons).sort();
    const disp = (n) => n.replace(/\s*\([^)]*\)$/, '');
    const name = {}, as = {}, apps = {}, nat = {}, season = [];
    keys.forEach((sk) => {
      const S = G.seasons[sk], cl = S.clubs.map((c) => c.name);
      S.players.forEach((p) => {
        name[p.k] = disp(p.n); as[p.k] = (as[p.k] || 0) + (p.as || 0); nat[p.k] = p.nat || '';
        const a = apps[p.k] || (apps[p.k] = {});
        a[cl[p.c]] = (a[cl[p.c]] || 0) + (p.a1 != null ? p.a1 : p.a);
        if (p.c2 != null) a[cl[p.c2]] = (a[cl[p.c2]] || 0) + (p.a2 || 0);
        const two = p.c2 != null && (p.a2 || 0) > (p.a1 || 0);
        season.push({ name: disp(p.n), club: cl[two ? p.c2 : p.c], club2: p.c2 != null ? cl[two ? p.c : p.c2] : null, season: sk, g: p.g, as: p.as || 0, nat: p.nat || '' });
      });
    });
    const career = [];
    (G.careers || []).forEach((k, i) => {
      if (name[i] == null) return;
      const club = Object.entries(apps[i]).sort((x, y) => y[1] - x[1])[0][0];
      career.push({ name: name[i], club, a: k.a, g: k.g, as: as[i], f: k.f, l: k.l, nat: nat[i] });
    });
    const club = (G.clubSeasons || []).map((c) => ({ club: c.club, season: c.season, pts: c.pts, w: c.w }));
    const tot = {};
    club.forEach((c) => { const t = tot[c.club] || (tot[c.club] = { club: c.club, pts: 0, n: 0 }); t.pts += c.pts; t.n++; });
    DECKS = { career, season, club, alltime: Object.values(tot) };
    return DECKS;
  }

  // ---------- a player's shirt with the stat as his number, and the crest and his flag under it ----------
  const SHIRT = 'M31 9 L42 4 Q50 11 58 4 L69 9 L95 24 L85 44 L74 38 L74 96 L26 96 L26 38 L15 44 L5 24 Z';
  const SLEEVES = 'M31 9 L5 24 L15 44 L26 38 Z M69 9 L95 24 L85 44 L74 38 Z';
  // the number fits the shirt body (x 26 to 74): 36 for one or two digits, 25 for three, 20 for four
  const NS = (v) => ({ 1: 36, 2: 36, 3: 25, 4: 20 })[String(v).length] || 20;
  const NY = (v) => (72 - (36 - NS(v)) * 0.35).toFixed(1);
  function shirt(w, club, word, num) {
    const k = D2T.shirts.kit(club), st = k.stroke ? ` stroke="${k.stroke}" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round"` : '';
    const W = word.toUpperCase(), fs = Math.max(8.5, Math.min(13, 104 / Math.max(6, W.length)));
    const n = num == null ? '?' : String(num);
    const fill = k.pat ? `url(#g4p-${k.id})` : k.fill;
    const sleeves = k.sl ? `<path d="${SLEEVES}" fill="${k.sl}" stroke="${k.trim}" stroke-width="2.4" stroke-linejoin="round"/>` : '';
    return `<div class="g4-shirt ub-shirt" style="--sw:${w}px;--trimc:${k.trim};--ink:${k.ink}"><svg viewBox="0 0 100 100" aria-hidden="true"><path class="body" d="${SHIRT}" style="fill:${fill}"/>${sleeves}
      <path d="${SHIRT}" fill="url(#g4sheen)"/><path class="body" d="${SHIRT}" style="fill:none"/><path class="trim" d="M42 4 Q50 11 58 4"/><path class="trim" d="M85 44 L95 24 M15 44 L5 24" stroke-width="3"/>
      <text x="50" y="27" font-size="${fs}" textLength="${Math.min(52, W.length * fs * 0.62)}" lengthAdjust="spacingAndGlyphs"${st}>${D2T.esc(W)}</text>
      <text class="ub-num${num == null ? ' q' : ''}" x="50" y="${NY(n)}" font-size="${NS(n)}"${st}>${n}</text></svg></div>`;
  }
  function playerItem(stat, r, shown, w) {
    const G = D2T.game, c = G.club(r.club), v = shown ? stat.val(r) : null;
    const word = r.name.split(' ').slice(-1)[0], flag = r.nat ? G.flag(r.nat) : '';
    return `<div class="ub-item">${shirt(w, r.club, word, v)}<div class="ub-row"><img class="ub-crest" src="${c.crest}" alt="${D2T.esc(c.full || r.club)}">${flag ? `<img class="d2c-flag ub-flag" src="${flag}" alt="${D2T.esc(r.nat)}" title="${D2T.esc(r.nat)}">` : ''}</div></div>`;
  }

  // ---------- a club's card: the Classic club shield turned round (option A), the stat in the middle ----------
  // the name sits beside the crest in about 5.4em (Black Italic runs about 0.66em a letter): its longest word sets the size,
  // and a word over 10 letters (Middlesbrough, Huddersfield, Southampton) also shrinks the crest to make room
  const nameFit = (n) => { const L = Math.max(...String(n).split(/\s+/).map((x) => x.length)), long = L > 10, f = Math.min(1.1, (long ? 8.8 : 8.0) / L); return { cls: long ? ' long' : '', style: f < 1.1 ? ` style="font-size:${f.toFixed(2)}em"` : '' }; };
  function clubItem(stat, r, shown, w) {
    const G = D2T.game, c = G.club(r.club), P = D2T.cards.clubPaint(c), v = shown ? String(stat.val(r)) : '?';
    // all-time cards say "All-time", never how many seasons (Craig, 13 Oct: that gave the answer away)
    const when = r.season ? r.season : 'All-time', nf = nameFit(c.name);
    return `<div class="ub-item"><div class="d2c d2c-club ub-cc${nf.cls}" style="--w:${w}px;--face:${P.face};--rim:${P.rim};--tex:${P.tex};--glow:${P.glow};--club-text:${c.text}" aria-label="${D2T.esc(c.full || r.club)} ${when}">
      <div class="d2c-rim"></div><div class="d2c-face"><span class="d2c-tex"></span><span class="d2c-hi"></span><span class="d2t-shine slow"></span>
      <div class="d2c-body"><div class="ub-cc-top"><div class="ub-cc-who"><span class="ub-cc-name"${nf.style}>${D2T.esc(c.name)}</span><span class="ub-cc-season">${when}</span></div><img class="ub-cc-crest" src="${c.crestLight || c.crest}" alt=""></div>
      <div class="ub-cc-mid"><span class="ub-num${shown ? '' : ' q'}${v.length > 2 ? ' w3' : ''}">${v}</span></div>
      <div class="ub-cc-foot"><span class="ub-cc-hr"></span><span class="ub-cc-unit">${stat.short || stat.unit}</span></div></div></div></div></div>`;
  }
  const item = (stat, r, shown, w) => (isClub(stat) ? clubItem(stat, r, shown, w) : playerItem(stat, r, shown, w));
  const whoLine = (stat, r) => {
    if (isClub(stat)) return '';
    const c = D2T.game.club(r.club);
    const where = stat.deck === 'career' ? `${D2T.esc(c.name || r.club)} · ${r.f === r.l ? r.f : r.f + ' to ' + r.l}` : `${D2T.esc(c.name || r.club)}${r.club2 ? ' / ' + D2T.esc(D2T.game.club(r.club2).name || r.club2) : ''} · ${r.season}`;
    return `<b>${D2T.esc(r.name)}</b><span>${where}</span>`;
  };

  // ---------- one reel (the club spin's fruit machine, screens/spin.js, sized for these cards) ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let fid = 0;
  class Reel {
    constructor(slot, pitch) {
      this.slot = slot; this.pitch = pitch; this.id = 'ubmb' + (++fid);
      slot.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="${this.id}" x="-20%" y="-40%" width="140%" height="180%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 0"/></filter></svg>
        <div class="sp-glow"></div><div class="sp-win"><div class="sp-strip">${'<div class="sp-node"></div>'.repeat(5)}<div class="sp-streak"></div></div><div class="sp-sweep"></div></div>`;
      this.win = slot.querySelector('.sp-win'); this.strip = slot.querySelector('.sp-strip'); this.streak = slot.querySelector('.sp-streak');
      this.nodes = Array.from(slot.querySelectorAll('.sp-node')); this.gauss = slot.querySelector('feGaussianBlur');
      this.seq = []; this.filtered = false; this.landed = 0;
    }
    show(html) { this.seq = [html]; this.landed = 0; this.nodes.forEach((n) => { n.dataset.vi = ''; n.classList.remove('is-gone'); n.classList.add('is-hit'); }); this.draw(0, 0); }
    load(seq) { this.seq = seq; this.nodes.forEach((n) => { n.dataset.vi = ''; n.classList.remove('is-hit', 'is-gone'); }); this.slot.classList.remove('is-set'); this.draw(0, 0); }
    draw(p, v) {
      const c = Math.round(p), P = this.pitch;
      for (let k = -2; k <= 2; k++) {
        const vi = c + k, node = this.nodes[((vi % 5) + 5) % 5];
        if (node.dataset.vi !== String(vi)) { node.dataset.vi = String(vi); node.innerHTML = this.seq[vi] || ''; }
        node.style.transform = `translate3d(0, ${((vi - p) * P).toFixed(2)}px, 0)`;
      }
      const pxf = Math.abs(v) * P / 60, sd = clamp(pxf * 0.3 - 1.2, 0, 22);
      if (sd < 0.4) { if (this.filtered) { this.strip.style.filter = ''; this.gauss.setAttribute('stdDeviation', '0 0'); this.filtered = false; } }
      else { this.gauss.setAttribute('stdDeviation', `0 ${sd.toFixed(1)}`); if (!this.filtered) { this.strip.style.filter = `url(#${this.id})`; this.filtered = true; } }
      const k = clamp(pxf / 80, 0, 1);
      this.streak.style.opacity = (k * k * 0.9).toFixed(3);
      this.win.style.transform = k > 0.02 ? `scaleY(${(1 + 0.05 * k).toFixed(4)})` : '';
    }
    hit(accent) { this.slot.style.setProperty('--sp-accent', accent || C); this.slot.classList.remove('is-hit'); void this.slot.offsetWidth; this.slot.classList.add('is-hit'); }
    settle(t) {
      this.landed = t;
      this.nodes.forEach((n) => { if (n.dataset.vi === String(t)) n.classList.add('is-hit'); else n.classList.add('is-gone'); });
      setTimeout(() => { this.slot.classList.add('is-set'); this.slot.classList.remove('is-hit'); }, 320);
    }
    current() { return this.seq[this.landed] || this.seq[0] || ''; }
  }

  let timers = [], rafs = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

  D2T.screen('unbeaten', {
    title: 'Unbeaten Run', theme: 'black',
    mount(root) {
      const reduced = D2T.reduced();
      const R = D2T.state.ub || (D2T.state.ub = { best: {}, runs: 0, last: null });
      const save = () => D2T.save();
      root.classList.add('ub');
      root.appendChild(D2T.topbar({ mode: ['Unbeaten Run', C] }));
      const wrap = D2T.h(`<div class="ub-wrap">${D2T.shirts.defs()}<span class="ub-bgmark" aria-hidden="true">${MARK}</span>
        <div class="ub-head"><div class="ub-h-l"><span class="ub-kick">Premier League</span><h1 class="ub-title">Spin for a stat</h1><span class="ub-sub"></span></div>
          <div class="ub-streak" aria-live="polite"><span class="ring"></span><b class="ub-n">0</b><i>unbeaten</i></div></div>
        <div class="ub-stage"></div>
        <div class="sp-hint ub-hint"></div>
        <div class="sp-bar ub-bar game-bar"></div></div>`);
      root.appendChild(wrap);
      const stage = wrap.querySelector('.ub-stage'), bar = wrap.querySelector('.ub-bar'), hint = wrap.querySelector('.ub-hint');
      const title = wrap.querySelector('.ub-title'), sub = wrap.querySelector('.ub-sub'), streakEl = wrap.querySelector('.ub-streak'), nEl = wrap.querySelector('.ub-n');
      let run = null, busy = false, reelL = null, reelR = null, SIZE = null;

      // card sizes for this run: shirts 150 (smaller on short phones); club shields 172 wide, two to a row with a 12px gap,
      // narrower when the screen is (375px phones get 165), and never taller than the stage allows
      function sizes(club) {
        const H = root.clientHeight || 760, sw = (stage.clientWidth || 390) - 32;   // inside the stage's 16px sides
        if (!club) { const SW = H < 640 ? 118 : H < 720 ? 134 : 150; return { w: SW, pitch: Math.round(SW * 1.02 + 62), slot: SW + 10, vs: 0.42 }; }
        const avail = Math.max(220, (stage.clientHeight || 420) - 16);
        const w = Math.max(120, Math.min(172, Math.floor((sw - 12) / 2), Math.floor(avail / 1.667)));
        const h = Math.round(w * 1.667);
        return { w, pitch: h + 8, slot: w, vs: 0.5 };
      }

      // ---------- the bottom bar (Craig, 13 Oct): home on the left, the round middle button, then the main buttons ----------
      // Before a run: home (straight home), the respin greyed (the start page has none), New run across the right.
      function spinBar() {
        bar.innerHTML = `<button class="sp-round is-home bar-home" aria-label="Home">${D2T.ICON.home}</button><button class="sp-round is-reload ub-off bar-mid" disabled aria-hidden="true" tabindex="-1">${REFRESH}</button><button class="sp-main ub-spin bar-main">${D2T.logo('emblem', { label: '' })}<span class="sp-lbl">New run</span></button>`;
        bar.querySelector('.is-home').onclick = leave;
        bar.querySelector('.ub-spin').onclick = statSpin;
      }
      // During a run: home (the menu), the three refreshes with their count, then Lower and Higher.
      function answerBar() {
        bar.innerHTML = `<button class="sp-round is-home bar-home" aria-label="Home">${D2T.ICON.home}</button><button class="sp-round is-reload ub-reload bar-mid" aria-label="New card">${REFRESH}<span class="sp-count"></span></button><button class="ub-ans ub-lower bar-main" aria-label="Lower">${DOWN}<span>Lower</span></button><button class="ub-ans ub-higher bar-main" aria-label="Higher">${UP}<span>Higher</span></button>`;
        bar.querySelector('.is-home').onclick = leave;
        bar.querySelector('.ub-reload').onclick = refreshCard;
        bar.querySelector('.ub-lower').onclick = () => answer(false);
        bar.querySelector('.ub-higher').onclick = () => answer(true);
      }
      const enable = (on) => {
        bar.querySelectorAll('.ub-ans').forEach((b) => { b.disabled = !on; });
        const r = bar.querySelector('.ub-reload'); if (!r || !run) return;
        r.querySelector('.sp-count').textContent = run.refreshes; r.disabled = !on || run.refreshes <= 0; r.setAttribute('aria-label', `New card, ${run.refreshes} left`);
      };
      // a refresh swaps the hidden card for another from the deck and spins it in; the left card and the streak stay
      function refreshCard() {
        if (!run || busy || run.refreshes <= 0) return;
        const nxt = pickNext(); if (!nxt) return;
        run.refreshes--; busy = true; enable(false); snd('respin'); snd('roll3');
        run.next = nxt; run.used.add(nxt);
        stage.querySelector('.ub-who-r').innerHTML = '';
        spinTo(reelR, run.next, { delay: 0, cruiseT: 0.5, decelT: 1.0, n: 2.6, v1: 2.2 }, () => {
          stage.querySelector('.ub-who-r').innerHTML = whoLine(run.stat, run.next);
          busy = false; enable(true);
        });
      }
      // home (Craig, 13 Oct): on the start page it just goes home. During a run (always, even mid-animation) it opens the
      // shared menu (D2T.leaveMenu, core/season.js): Keep playing, Restart (back to the stat spin, nothing recorded), Home
      // (the run is kept in state.ub.run and picks up where it was next time) or Quit (thrown away, nothing recorded).
      function leave() {
        if (!run) { D2T.go('home'); return; }
        D2T.leaveMenu({ title: 'Leave the run?', lead: `Unbeaten in ${run.streak} so far. Home keeps this run for later. Restart or Quit ends it and nothing is recorded.`,
          homeLabel: 'Home, save the run', quitLabel: 'Quit the run',
          home: () => { stash(); D2T.go('home'); },
          restart: () => { timers.forEach(clearTimeout); rafs.forEach(cancelAnimationFrame); timers = []; rafs = []; document.querySelectorAll('.ub-fly, .ub-boom, .ub-tick').forEach((f) => f.remove()); stage.classList.remove('ub-clubs'); idle(); },
          quit: () => { run = null; R.run = null; save(); D2T.go('home'); } });
      }
      // a run in progress, kept for Home: the stat and the cards as places in its deck (the decks are built the same way
      // every time), the cards used so far, the streak and the refreshes left
      function stash() {
        if (!run) return;
        const at = (r) => run.deck.indexOf(r);
        R.run = { stat: run.stat.id, cur: at(run.cur), next: at(run.next), used: [...run.used].map(at).filter((i) => i >= 0), streak: run.streak, refreshes: run.refreshes };
        save();
      }
      // under the title in a run (Craig, 13 Oct): your best on this stat and your best on any
      function bestLine(stat) {
        const top = Math.max(0, ...Object.values(R.best || {}));
        sub.innerHTML = `Your best on this: <em>${R.best[stat.id] || 0}</em> · Best overall: <em>${top}</em>`;
      }
      // the stage for a run: two columns, the reels, the answer bar
      function setStage(stat) {
        title.textContent = stat.big; bestLine(stat);
        SIZE = sizes(isClub(stat));
        stage.style.setProperty('--ub-sw', SIZE.w + 'px'); stage.style.setProperty('--ub-ph', SIZE.pitch + 'px'); stage.style.setProperty('--ub-slw', SIZE.slot + 'px'); stage.style.setProperty('--ub-vs', SIZE.vs);
        stage.classList.toggle('ub-clubs', isClub(stat)); stage.classList.remove('ub-go');
        stage.innerHTML = `<div class="ub-cols"><div class="ub-col"><div class="ub-slot ub-l"></div><div class="ub-who ub-who-l"></div></div>
          <div class="ub-col"><div class="ub-slot ub-r"></div><div class="ub-who ub-who-r"></div></div><span class="ub-vs">VS</span></div>`;
        const sl = stage.querySelector('.ub-l'), sr = stage.querySelector('.ub-r');
        reelL = new Reel(sl, SIZE.pitch); reelR = new Reel(sr, SIZE.pitch);
        answerBar(); enable(false); hint.textContent = '';
        return { sl, sr };
      }
      // back from Home with a run kept: both cards sit where they were, the left shown, the right still hidden
      function resume(sv) {
        const stat = STATS.find((s) => s.id === sv.stat), deck = stat ? decks()[stat.deck].filter((r) => stat.val(r) > 0) : [];
        R.run = null; save();
        if (!stat || !deck[sv.cur] || !deck[sv.next]) { idle(); return; }
        run = { stat, deck, used: new Set((sv.used || []).map((i) => deck[i]).filter(Boolean)), streak: sv.streak || 0, refreshes: sv.refreshes == null ? REFRESHES : sv.refreshes, cur: deck[sv.cur], next: deck[sv.next] };
        run.used.add(run.cur); run.used.add(run.next);
        const { sl, sr } = setStage(stat);
        nEl.textContent = run.streak;
        reelL.show(item(stat, run.cur, true, SIZE.w)); sl.classList.add('is-set'); sl.style.setProperty('--sp-accent', accentOf(run.cur));
        reelR.show(item(stat, run.next, false, SIZE.w)); sr.classList.add('is-set'); sr.style.setProperty('--sp-accent', accentOf(run.next));
        stage.querySelector('.ub-who-l').innerHTML = whoLine(stat, run.cur); stage.querySelector('.ub-who-r').innerHTML = whoLine(stat, run.next);
        busy = false; enable(true);
        hint.textContent = 'Swipe up for higher, down for lower, or tap below';
      }

      // ---------- the stat spin: a reel of stats, never the same one twice in a row ----------
      // the start page (Craig, 13 Oct; design/prototype/unbeaten-start.html): Higher or lower, and your best run for each
      // stat in the home page's record outline rimmed in cyan, 3 x 3 and centred; your highest best is a special cyan card
      // with a black star and a slow shine. New run steps them back and brings the stat reel in at the same spot.
      const STAR = '<svg class="ub-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="#04262C"/></svg>';
      const TOPDEF = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="ubTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E6FDFF"/><stop offset=".3" stop-color="#5CE6F7"/><stop offset=".62" stop-color="#22D3EE"/><stop offset="1" stop-color="#0E8FA6"/></linearGradient></defs></svg>';
      function idle() {
        run = null; busy = false; nEl.textContent = '0'; title.textContent = 'Higher or lower';
        sub.textContent = 'One stat a run. Is the next real number higher or lower? Keep calling it right; one wrong answer ends your run.';
        stage.classList.remove('ub-clubs', 'ub-go'); R.run = null;
        const top = STATS.reduce((m, st, i) => ((R.best[st.id] || 0) > (R.best[STATS[m].id] || 0) ? i : m), 0), hasTop = (R.best[STATS[top].id] || 0) > 0;
        stage.innerHTML = `<div class="ub-start">${TOPDEF}<div class="ub-bests-h">Your best runs</div><div class="ub-grid">${STATS.map((st, i) => {
          const b = R.best[st.id] || 0, isTop = hasTop && i === top;
          return `<div class="ub-fr${b ? '' : ' none'}${isTop ? ' top' : ''}">${D2T.frFrame}${isTop ? '<span class="ub-shine"></span>' + STAR : ''}<b>${b || '-'}</b><span>${st.big}</span></div>`;
        }).join('')}</div></div>
          <div class="ub-reelin"><small>THIS RUN IS ABOUT</small><div class="ub-statwin"><div class="ub-statstrip"></div></div><p class="ub-thisbest"></p></div>`;
        hint.textContent = '';
        spinBar();
        later(() => { const b = bar.querySelector('.ub-spin'); if (b && !run && !busy && root.isConnected) D2T.tip('ub-spin', b, 'A new stat every run'); }, 700);
      }
      const statTile = (s, on) => `<div class="ub-tile${on ? ' on' : ''}"><small>PREMIER LEAGUE</small><span>${s.big}</span></div>`;
      function statSpin() {
        if (busy) return;
        busy = true; snd('roll3');
        const forced = window.D2T_UB_STAT && STATS.find((s) => s.id === window.D2T_UB_STAT);   // tests pick the stat
        const target = forced || STATS.filter((s) => s.id !== R.last)[rand(STATS.length - 1)];
        R.last = target.id; save();
        const other = (not) => { const o = STATS.filter((s) => !not.includes(s)); return o[rand(o.length)]; };
        const seq = [other([])];
        for (let i = 0; i < 22; i++) seq.push(other([seq[seq.length - 1], i === 21 ? target : null]));
        seq.push(target, other([target]));
        const at = seq.lastIndexOf(target), strip = stage.querySelector('.ub-statstrip');
        strip.innerHTML = seq.map((s, i) => statTile(s, i === at)).join('');
        stage.classList.add('ub-go');                         // the best runs step back, the reel comes in
        const btn = bar.querySelector('.ub-spin'); btn.disabled = true; btn.querySelector('.sp-lbl').textContent = 'Spinning';
        const end = -at * 76;
        const done = () => {
          snd('reelLand', 1); stage.querySelector('.ub-statwin').classList.add('is-hit');
          const b = R.best[target.id]; stage.querySelector('.ub-thisbest').innerHTML = `Your best on this: <em>${b || 'none yet'}</em>`;
          later(() => startRun(target), reduced ? 200 : 900);
        };
        if (reduced) { strip.style.transform = `translateY(${end}px)`; done(); return; }
        const anim = strip.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${end}px)` }], { duration: 2000, delay: 300, easing: 'cubic-bezier(.15,.8,.25,1)', fill: 'forwards' });
        // the same rolling ticks as the card reels: a muffled tap for each stat tile that passes, quieter at speed
        let lastI = 0, lastY = 0, lastT = performance.now();
        const watch = (now) => {
          if (!root.isConnected || anim.playState === 'finished') return;
          const y = -new DOMMatrixReadOnly(getComputedStyle(strip).transform).m42, idx = Math.floor(y / 76);
          if (idx > lastI && window.D2TSound) window.D2TSound.tick(1, (y - lastY) / 76 / Math.max(0.001, (now - lastT) / 1000));
          lastI = Math.max(lastI, idx); lastY = y; lastT = now; rafs.push(requestAnimationFrame(watch));
        };
        rafs.push(requestAnimationFrame(watch));
        anim.onfinish = done;
      }

      // ---------- a run ----------
      function pickNext() {
        const cur = run.stat.val(run.cur), pool = run.deck.filter((r) => !run.used.has(r) && run.stat.val(r) !== cur);
        if (!pool.length) return null;
        const k = run.streak + 1, pClose = k <= 10 ? 0.2 : k <= 20 ? 1 / 3 : 0.5;
        if (Math.random() < pClose) { const close = pool.filter((r) => Math.abs(run.stat.val(r) - cur) / cur <= 0.10); if (close.length) return close[rand(close.length)]; }
        return pool[rand(pool.length)];
      }
      const accentOf = (r) => (isClub(run.stat) ? (D2T.game.club(r.club).accent || C) : C);
      const ph = () => `<div class="ub-ph">?</div>`;
      function spinTo(reel, r, opts, done) {
        const P = D2T.roll.profile(opts), n = P.target, html = item(run.stat, r, reel === reelL, SIZE.w);
        const seq = [reel.current() || ph()];
        for (let i = 1; i < n + 4; i++) seq.push(i === n ? html : item(run.stat, run.deck[rand(run.deck.length)], false, SIZE.w));   // fillers show ?, never made-up numbers
        reel.load(seq);
        if (reduced) { reel.draw(n, 0); reel.hit(accentOf(r)); reel.settle(n); done && done(); return; }
        const t0 = performance.now(), ri = reel === reelL ? 0 : 2; let landed = false, lastK = 0;
        const step = (now) => {
          const s = D2T.roll.sample(P, (now - t0) / 1000);
          reel.draw(s.p, s.v);
          const k = Math.floor(s.p); if (k > lastK && !landed && window.D2TSound) window.D2TSound.tick(ri, s.v); lastK = k;   // the same reel ticks as Classic
          if (!landed && (now - t0) / 1000 >= P.landAt) { landed = true; snd('reelLand'); reel.hit(accentOf(r)); reel.settle(n); done && done(); }
          if (s.phase !== 'done' && root.isConnected) rafs.push(requestAnimationFrame(step));
        };
        rafs.push(requestAnimationFrame(step));
      }
      function startRun(stat) {
        const deck = decks()[stat.deck].filter((r) => stat.val(r) > 0);
        run = { stat, deck, used: new Set(), streak: 0, refreshes: REFRESHES };
        run.cur = deck[rand(deck.length)]; run.used.add(run.cur);
        run.next = pickNext(); run.used.add(run.next);
        setStage(stat);
        reelL.show(ph()); reelR.show(ph());
        snd('roll3');
        spinTo(reelL, run.cur, { delay: 0, cruiseT: 0.9, decelT: 1.0, n: 2.2 }, () => { stage.querySelector('.ub-who-l').innerHTML = whoLine(stat, run.cur); });
        spinTo(reelR, run.next, { delay: 0.12, cruiseT: 1.4, decelT: 1.4, n: 3.0, v1: 2.0 }, () => {
          stage.querySelector('.ub-who-r').innerHTML = whoLine(stat, run.next);
          busy = false; enable(true);
          hint.textContent = 'Swipe up for higher, down for lower, or tap below';
          later(() => tips(), 450);
        });
      }
      // first-time tips, one at a time, each once ever (D2T.tips)
      const tips = () => D2T.tips([
        ['ub-guess', stage.querySelector('.ub-r .sp-node.is-hit') || stage.querySelector('.ub-r'), 'Higher or lower?'],
        ['ub-swipe', stage.querySelector('.ub-r'), 'Swipe it up or down', { place: 'below' }],
        ['ub-run', streakEl, 'One wrong and the run is over', { place: 'below', side: 'right' }]
      ]);
      const numEl = () => stage.querySelector('.ub-r .sp-node.is-hit .ub-num') || stage.querySelector('.ub-r .ub-num');
      // the reveal (Craig, 12 Oct): the ? strains, then bursts in cyan, white and the club's colour, and the real number
      // drops in; right puts a cyan tick where VS sits, which flies up to the run count top right
      function answer(higher) {
        if (!run || busy) return;
        busy = true; enable(false); snd('tap');
        const a = run.stat.val(run.cur), b = run.stat.val(run.next), right = higher ? b > a : b < a;
        burstReveal(numEl(), b, () => {
          stage.querySelector('.ub-r').classList.add(right ? 'ok' : 'bad');
          if (right) win(); else { snd('wrong'); later(over, reduced ? 200 : 950); }
        });
      }
      function setNum(el, to) {
        el.classList.remove('q'); el.textContent = to;
        if (el.tagName.toLowerCase() === 'text') { el.setAttribute('font-size', NS(to)); el.setAttribute('y', NY(to)); } else if (String(to).length > 2) el.classList.add('w3');
      }
      function burstReveal(el, to, done) {
        if (!el) { done(); return; }
        if (reduced) { setNum(el, to); done(); return; }
        el.animate([{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(1.25) rotate(-8deg)', offset: 0.4 }, { transform: 'scale(1.15) rotate(7deg)', offset: 0.75 }, { transform: 'scale(1.45) rotate(0)', opacity: 0.6 }], { duration: 260, easing: 'ease-in' });
        later(() => {
          if (!root.isConnected) return;
          const r = el.getBoundingClientRect(), c = D2T.game.club(run.next.club);
          boom(r.left + r.width / 2, r.top + r.height / 2, ['#22D3EE', '#FFFFFF', c.accent || '#22D3EE', '#8BE9F7']);
          snd('reveal');
          setNum(el, to);
          el.animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.3)', opacity: 1, offset: 0.55 }, { transform: 'scale(.95)', offset: 0.8 }, { transform: 'scale(1)', opacity: 1 }], { duration: 480, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
          later(done, 520);
        }, 260);
      }
      // sparks, a ring and a flash from a point on screen (a fixed layer, so the card's window never clips it)
      function boom(x0, y0, cols) {
        const wrap = D2T.h('<div class="ub-boom" aria-hidden="true"></div>'); wrap.style.left = x0 + 'px'; wrap.style.top = y0 + 'px'; document.body.appendChild(wrap);
        const ring = D2T.h('<span class="ub-boom-ring"></span>'), flash = D2T.h('<span class="ub-boom-flash"></span>'); wrap.append(flash, ring);
        flash.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0.95 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }], { duration: 360, easing: 'ease-out', fill: 'forwards' });
        ring.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(4.5)', opacity: 0 }], { duration: 600, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' });
        for (let i = 0; i < 32; i++) {
          const a = (i / 32) * Math.PI * 2 + Math.random() * 0.25, d = 50 + Math.random() * 80, sz = 4 + Math.random() * 6;
          const bit = D2T.h('<i></i>'); Object.assign(bit.style, { width: sz + 'px', height: (sz * (0.5 + Math.random())) + 'px', background: cols[i % cols.length] });
          wrap.appendChild(bit);
          bit.animate([{ transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d * 0.7}px), calc(-50% + ${Math.sin(a) * d * 0.7}px)) rotate(${(Math.random() - 0.5) * 300}deg)`, opacity: 1, offset: 0.55 },
            { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 24}px)) rotate(${(Math.random() - 0.5) * 540}deg)`, opacity: 0 }], { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.12,.8,.3,1)', fill: 'forwards' });
        }
        later(() => wrap.remove(), 1100);
      }
      function win() {
        run.streak++; snd('right');
        const done = () => {
          nEl.textContent = run.streak;
          streakEl.classList.remove('burst'); void streakEl.offsetWidth; streakEl.classList.add('burst');
          later(advance, reduced ? 120 : 380);
        };
        if (reduced) { done(); return; }
        // a cyan tick where VS sits (Craig, 13 Oct: his brush tick): it comes in three times the size and faint, settles at
        // one and a half times in full, gives a quick pulse, then flies up to the run count, which ticks up as it lands
        const vs = stage.querySelector('.ub-vs').getBoundingClientRect(), to = nEl.getBoundingClientRect();
        const tick = D2T.h('<div class="ub-tick" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M7 54 C3 45 9 37 18 37 C23 37 26 40 28 44 L37 62 C52 43 74 18 96 6 C98 5 100 7 98 9 C78 32 60 58 45 82 C41 88 35 92 28 93 C24 93 21 91 20 88 Z"/></svg></div>');
        const cx = vs.left + vs.width / 2, cy = vs.top + vs.height / 2;
        tick.style.left = cx + 'px'; tick.style.top = cy + 'px'; document.body.appendChild(tick);
        const dx = to.left + to.width / 2 - cx, dy = to.top + to.height / 2 - cy, C = 'translate(-50%,-50%)';
        tick.animate([{ transform: `${C} scale(3)`, opacity: 0.1 }, { transform: `${C} scale(1.5)`, opacity: 1, offset: 0.62 }, { transform: `${C} scale(1.75)`, opacity: 1, offset: 0.8 }, { transform: `${C} scale(1.5)`, opacity: 1 }],
          { duration: 600, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'forwards' });
        later(() => {
          tick.animate([{ transform: `${C} scale(1.5)`, opacity: 1 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.45)`, opacity: 0.9 }], { duration: 520, easing: 'cubic-bezier(.55,0,.25,1)', fill: 'forwards' })
            .onfinish = () => { tick.remove(); done(); };
        }, 680);
      }
      function advance() {
        if (!run) return;
        run.cur = run.next;
        const nxt = pickNext();
        if (!nxt) { over(true); return; }
        run.next = nxt; run.used.add(nxt);
        const sl = stage.querySelector('.ub-l'), sr = stage.querySelector('.ub-r');
        sr.classList.remove('ok');
        // the card you got right slides across to the left, then the right reel spins in the next one
        reelL.show(item(run.stat, run.cur, true, SIZE.w)); sl.classList.add('is-set'); sl.style.setProperty('--sp-accent', accentOf(run.cur));
        stage.querySelector('.ub-who-l').innerHTML = whoLine(run.stat, run.cur); stage.querySelector('.ub-who-r').innerHTML = '';
        if (!reduced) { const dx = sr.getBoundingClientRect().left - sl.getBoundingClientRect().left; sl.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.5,0,.2,1)' }); }
        reelR.show(ph()); sr.classList.remove('is-set');
        snd('roll3');
        spinTo(reelR, run.next, { delay: 0.15, cruiseT: 0.55, decelT: 1.0, n: 2.6, v1: 2.2 }, () => {
          stage.querySelector('.ub-who-r').innerHTML = whoLine(run.stat, run.next);
          busy = false; enable(true); later(() => tips(), 300);
        });
      }
      // a new best: HIGH SCORE flashes across the middle the way REWRITE HISTORY does on Classic's table (.se-newseason)
      function highScore() {
        if (reduced) return;
        const f = D2T.h('<div class="se-newseason ub-high" aria-hidden="true"><span>High<br>score</span></div>');
        f.style.setProperty('--se-acc', C); root.appendChild(f);
        requestAnimationFrame(() => f.classList.add('se-go'));
        later(() => f.remove(), 2800);
      }
      function over(cleared) {
        if (!root.isConnected || !run) return;
        const s = run.stat, n = run.streak, prev = R.best[s.id] || 0, newBest = n > prev && n > 0;
        R.runs++; if (newBest) R.best[s.id] = n; R.run = null; save(); bestLine(s);
        if (newBest) { snd('highScore'); highScore(); }
        // the end sheet waits for the HIGH SCORE flash to pass
        const show = () => {
          if (!root.isConnected) return;
          const a = run.cur, b = run.next, nm = (r) => r.name || D2T.game.club(r.club).full || r.club;
          const head = cleared ? 'The whole deck, unbeaten' : n === 0 ? 'Beaten first time' : `Unbeaten in ${n}`;
          const lead = cleared ? 'You got through every card in this deck.' : `<b>${D2T.esc(nm(b))}</b> had <b>${s.val(b)}</b>, <b>${D2T.esc(nm(a))}</b> had <b>${s.val(a)}</b>.`;
          const best = newBest ? ' A new best.' : prev ? ` Your best on ${s.big.toLowerCase()}: ${prev}.` : '';
          // the share card (Craig, 13 Oct): the run huge in cyan, the stat, the dare
          const text = `DROP2TOP Unbeaten Run · ${s.big}\nI went unbeaten in ${n} call${n === 1 ? '' : 's'} of higher or lower.${newBest ? '\nA new best.' : ''}\nCan you go longer?\n${D2T.share.LINK}`;
          const ring = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#22D3EE" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="50" r="44"/><path d="M30 42 L50 22 L70 42"/><path d="M30 58 L50 78 L70 58"/></svg>';
          const card = D2T.share.build({ text, c: '#22D3EE', tag: 'Unbeaten Run', dare: `Go longer than ${n}`, ghost: D2T.share.svgSrc(ring), ghostAlpha: 0.12,
            draw: (g, im, k) => {
              g.save(); g.shadowColor = 'rgba(34,211,238,.45)'; g.shadowBlur = 80; k.fit(String(n), k.W / 2, 330, 980, 900, 420, true, '#22D3EE'); g.restore();
              k.fit(s.big.toUpperCase(), k.W / 2, 730, 960, 900, 64, true, '#FFFFFF');
              k.wrap(`Unbeaten in ${n} call${n === 1 ? '' : 's'} of higher or lower, real Premier League numbers.`, k.W / 2, 830, 820, 600, 40, '#BDBDC6', 52);
            } });
          // the shared end sheet (Craig, 14 Oct; D2T.endSheet): Share, New run, Home. Closing it goes back to the start page,
          // which has New run and Home of its own, so there is no peek bar here.
          D2T.endSheet({ title: head, lead: `<div class="ub-endbig"><b>${n}</b><span>Unbeaten${newBest ? ' · a new best' : ''}</span></div><p class="fr-lead">${lead}${best}</p>`,
            colour: '#22D3EE', ink: '#001A1F', onClose: () => { if (root.isConnected && run) idle(); },
            buttons: [{ k: 'share', label: 'Share with your mates', primary: true, fn: () => D2T.share.send(card) }, { k: 'again', label: 'New run', fn: () => { idle(); later(statSpin, 250); } }, { k: 'home', label: 'Home', fn: () => D2T.go('home') }] }).open();
        };
        if (newBest && !reduced) later(show, 2500); else show();
      }
      // swipe the right card up for higher, down for lower (Craig, 12 Oct): it follows the finger on a rubber band, up to
      // about three times the old reach, and on release springs back past its start and bounces quickly to rest before
      // the answer counts (the rubber band iOS menus use)
      const BAND = 160, rubber = (x) => Math.sign(x) * BAND * (1 - 1 / (Math.abs(x) * 0.75 / BAND + 1));
      function springBack(el, from, done) {
        if (reduced || !from) { el.style.transform = ''; done(); return; }
        const frames = [], N = 32, T = 0.5;
        for (let i = 0; i <= N; i++) { const t = (i / N) * T; frames.push({ transform: `translateY(${(from * Math.exp(-8.5 * t) * Math.cos(2 * Math.PI * 4.6 * t)).toFixed(2)}px)` }); }
        frames[N] = { transform: 'translateY(0)' };
        el.style.transform = '';
        el.animate(frames, { duration: T * 1000, easing: 'linear' }).onfinish = done;
      }
      // swipe anywhere between the stat header and the bottom bar (Craig, 13 Oct): the hidden card follows the finger up
      // or down on its rubber band, and a cyan hand-drawn marker arrow runs from where the finger landed to where it is
      // now (Craig's reference, 13 Oct): one tapered shaft, thicker at its round tail and fine where it meets the head,
      // and an open chevron of two round-capped barbs, the upper one straight, the lower one gently curved. It starts
      // small and grows with the swipe: its weight follows the distance up to 360 px (tail 3 to 11 px wide, barbs 11 to
      // 44 px long and 2.5 to 7.5 px thick), so a short drag is a fine line and a long one a bold stroke.
      let arrow = null;
      function drawArrow(x0, y0, x, y) {
        if (!arrow) { arrow = D2T.h('<svg class="ub-arrow" aria-hidden="true"><path class="shaft"/><path class="head"/></svg>'); document.body.appendChild(arrow); }
        const dx = x - x0, dy = y - y0, len = Math.hypot(dx, dy);
        if (len < 4) { arrow.style.opacity = 0; return; }
        arrow.style.opacity = 1;
        const g = Math.min(1, len / 360), ux = dx / len, uy = dy / len, nx = -uy, ny = ux, f = (v) => v.toFixed(1);
        const tail = 3 + 8 * g, tip = tail * 0.3, bl = Math.min(len * 0.6, 11 + 33 * g), bw = 2.5 + 5 * g;
        // the shaft: a filled outline from a round tail to a fine round tip tucked under the head's join
        const ex = x - ux * bw * 0.45, ey = y - uy * bw * 0.45, r0 = tail / 2, r1 = tip / 2;
        const sh = arrow.querySelector('.shaft');
        if (Math.hypot(ex - x0, ey - y0) > r0) {
          sh.setAttribute('d', `M${f(x0 + nx * r0)},${f(y0 + ny * r0)} L${f(ex + nx * r1)},${f(ey + ny * r1)} A${f(r1)},${f(r1)} 0 0 0 ${f(ex - nx * r1)},${f(ey - ny * r1)} L${f(x0 - nx * r0)},${f(y0 - ny * r0)} A${f(r0)},${f(r0)} 0 0 0 ${f(x0 + nx * r0)},${f(y0 + ny * r0)} Z`);
        } else sh.setAttribute('d', '');
        // the head: the upper barb straight at 27 degrees, the lower one a touch shorter at 34 degrees and bowed outwards
        // (a pen stroke, not a stamp), meeting at the tip with a round join
        const a1 = 27 * Math.PI / 180, a2 = 34 * Math.PI / 180, l2 = bl * 0.94;
        const u1x = x - (ux * Math.cos(a1) - nx * Math.sin(a1)) * bl, u1y = y - (uy * Math.cos(a1) - ny * Math.sin(a1)) * bl;
        const u2x = x - (ux * Math.cos(a2) + nx * Math.sin(a2)) * l2, u2y = y - (uy * Math.cos(a2) + ny * Math.sin(a2)) * l2;
        const cx = (x + u2x) / 2 + (ux * 0.45 - nx * 0.22) * l2 * 0.5, cy = (y + u2y) / 2 + (uy * 0.45 - ny * 0.22) * l2 * 0.5;
        const hd = arrow.querySelector('.head');
        hd.setAttribute('d', `M${f(u1x)},${f(u1y)} L${f(x)},${f(y)} Q${f(cx)},${f(cy)} ${f(u2x)},${f(u2y)}`);
        hd.style.strokeWidth = f(bw);
      }
      // on release it snaps back to where the finger landed and is gone
      function dropArrow(x0, y0, x, y) {
        const a = arrow; arrow = null; if (!a) return;
        if (reduced) { a.remove(); return; }
        const t0 = performance.now(), T = 170;
        const step = (now) => {
          const u = Math.min(1, (now - t0) / T), k = 1 - u * u;
          if (!a.isConnected) return;
          const keep = arrow; arrow = a; drawArrow(x0, y0, x0 + (x - x0) * k, y0 + (y - y0) * k); arrow = keep;
          a.style.opacity = (1 - u).toFixed(2);
          if (u < 1) rafs.push(requestAnimationFrame(step)); else a.remove();
        };
        rafs.push(requestAnimationFrame(step));
      }
      (function bindSwipe() {
        let p = null;
        const card = () => stage.querySelector('.ub-r');
        stage.addEventListener('pointerdown', (e) => {
          if (!run || busy || p || e.button) return;
          const el = card(); if (!el) return;
          p = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, off: 0, el };
          stage.setPointerCapture(e.pointerId); el.getAnimations().forEach((a) => a.cancel());
          drawArrow(p.x0, p.y0, p.x0, p.y0);
        });
        stage.addEventListener('pointermove', (e) => {
          if (!p || e.pointerId !== p.id) return;
          p.x = e.clientX; p.y = e.clientY; p.off = rubber(p.y - p.y0);
          p.el.style.transform = `translateY(${p.off.toFixed(1)}px)`;
          drawArrow(p.x0, p.y0, p.x, p.y);
        });
        const up = (e) => {
          if (!p || e.pointerId !== p.id) return;
          const q = p; p = null;
          const dy = e.clientY - q.y0, go = e.type === 'pointerup' && Math.abs(dy) > 50 && run && !busy;
          dropArrow(q.x0, q.y0, q.x, q.y);
          if (go) { busy = true; enable(false); }
          springBack(q.el, q.off, () => { if (go) { busy = false; answer(dy < 0); } });
        };
        stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
      })();
      if (R.run && R.run.stat) resume(R.run); else idle();   // a run kept by Home picks up where it was
    },
    unmount() { timers.forEach(clearTimeout); rafs.forEach(cancelAnimationFrame); timers = []; rafs = []; document.querySelectorAll('.ub-fly, .ub-boom, .ub-tick, .ub-arrow').forEach((f) => f.remove()); }
  });

  // the home screen card (screens/home.js), in the same shape as the other games' cards
  D2T.ubRecord = () => { const R = D2T.state.ub || { best: {}, runs: 0 }; const top = Math.max(0, ...Object.values(R.best || {})); return { runs: R.runs || 0, top }; };
  D2T.ubMark = MARK;
})();
