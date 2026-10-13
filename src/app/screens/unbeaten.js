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
  const REFRESH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>';
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
    const when = r.season ? r.season : `${r.n} seasons`, nf = nameFit(c.name);
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
        <div class="sp-bar ub-bar"></div></div>`);
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

      // ---------- the bottom bar: Spin before a run, Lower and Higher during one ----------
      function spinBar() {
        bar.innerHTML = `<button class="sp-main ub-spin">${D2T.logo('emblem', { label: '' })}<span class="sp-lbl">Spin</span></button><button class="sp-round is-home" aria-label="Home">${D2T.ICON.home}</button>`;
        bar.querySelector('.is-home').onclick = () => D2T.go('home');
        bar.querySelector('.ub-spin').onclick = statSpin;
      }
      function answerBar() {
        bar.innerHTML = `<button class="sp-round is-reload ub-reload" aria-label="New card">${REFRESH}<span class="sp-count"></span></button><button class="ub-ans ub-lower" aria-label="Lower">${DOWN}<span>Lower</span></button><button class="ub-ans ub-higher" aria-label="Higher">${UP}<span>Higher</span></button><button class="sp-round is-home" aria-label="Home">${D2T.ICON.home}</button>`;
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
        run.refreshes--; busy = true; enable(false); snd('roll3');
        run.next = nxt; run.used.add(nxt);
        stage.querySelector('.ub-who-r').innerHTML = '';
        spinTo(reelR, run.next, { delay: 0, cruiseT: 0.5, decelT: 1.0, n: 2.6, v1: 2.2 }, () => {
          stage.querySelector('.ub-who-r').innerHTML = whoLine(run.stat, run.next);
          busy = false; enable(true);
        });
      }
      // home during a run asks (as Goal Rush does): a run is sudden death, so leaving ends it with no result
      function leave() {
        if (!run) { D2T.go('home'); return; }   // during a run it always asks, even mid-animation
        const sh = D2T.sheet({ title: 'Leave the run?', body: `<p class="fr-lead">Unbeaten in ${run.streak} so far. Restart or Quit ends the run and nothing is recorded.</p>
          <div class="fr-stack"><button class="btn btn-ghost fr-btn-wide" data-k="keep">Keep playing</button><button class="btn btn-ghost fr-btn-wide" data-k="restart">Restart the game</button><button class="btn btn-ghost fr-danger fr-btn-wide" data-k="quit">Quit the run</button></div>` });
        sh.body.querySelector('[data-k="keep"]').onclick = sh.close;
        // restart (Craig, 12 Oct): drop this run, nothing recorded, and go back to spinning for a stat
        sh.body.querySelector('[data-k="restart"]').onclick = () => { sh.close(); timers.forEach(clearTimeout); rafs.forEach(cancelAnimationFrame); timers = []; rafs = []; document.querySelectorAll('.ub-fly, .ub-boom, .ub-tick').forEach((f) => f.remove()); stage.classList.remove('ub-clubs'); idle(); };
        sh.body.querySelector('[data-k="quit"]').onclick = () => { sh.close(); run = null; D2T.go('home'); };
      }

      // ---------- the stat spin: a reel of stats, never the same one twice in a row ----------
      function idle() {
        run = null; busy = false; nEl.textContent = '0'; title.textContent = 'Spin for a stat'; sub.textContent = 'Each run is about one stat. Real Premier League numbers, higher or lower, one wrong answer ends it.';
        stage.innerHTML = `<div class="ub-statwin"><div class="ub-statstrip">${statTile(STATS.find((s) => s.id === R.last) || STATS[0], true)}</div></div>
          <div class="ub-bests-h">Your best runs</div><div class="ub-bests">${STATS.map((s) => `<span class="ub-best"><i>${s.big}</i><b class="${R.best[s.id] ? '' : 'none'}">${R.best[s.id] || '-'}</b></span>`).join('')}</div>`;
        hint.textContent = 'Spin to see which stat this run is about';
        spinBar();
        later(() => { const b = bar.querySelector('.ub-spin'); if (b && !run && !busy && root.isConnected) D2T.tip('ub-spin', b, 'A new stat every run'); }, 700);
      }
      const statTile = (s, dim) => `<div class="ub-tile${dim ? ' dim' : ''}"><small>PREMIER LEAGUE</small><span>${s.big}</span></div>`;
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
        const strip = stage.querySelector('.ub-statstrip');
        strip.innerHTML = seq.map((s) => statTile(s)).join('');
        stage.querySelector('.ub-bests').classList.add('gone'); stage.querySelector('.ub-bests-h').classList.add('gone');
        bar.querySelector('.ub-spin').disabled = true;
        const end = -seq.lastIndexOf(target) * 76;   // the chosen stat stops in the frame (it was one tile short)
        const done = () => { snd('lockin'); stage.querySelector('.ub-statwin').classList.add('is-hit'); later(() => startRun(target), reduced ? 200 : 650); };
        if (reduced) { strip.style.transform = `translateY(${end}px)`; done(); return; }
        strip.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${end}px)` }], { duration: 1800, easing: 'cubic-bezier(.15,.8,.25,1)', fill: 'forwards' }).onfinish = done;
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
        const t0 = performance.now(); let landed = false;
        const step = (now) => {
          const s = D2T.roll.sample(P, (now - t0) / 1000);
          reel.draw(s.p, s.v);
          if (!landed && (now - t0) / 1000 >= P.landAt) { landed = true; reel.hit(accentOf(r)); reel.settle(n); done && done(); }
          if (s.phase !== 'done' && root.isConnected) rafs.push(requestAnimationFrame(step));
        };
        rafs.push(requestAnimationFrame(step));
      }
      function startRun(stat) {
        const deck = decks()[stat.deck].filter((r) => stat.val(r) > 0);
        run = { stat, deck, used: new Set(), streak: 0, refreshes: REFRESHES };
        run.cur = deck[rand(deck.length)]; run.used.add(run.cur);
        run.next = pickNext(); run.used.add(run.next);
        title.textContent = stat.big; sub.innerHTML = 'Premier League · <em>one wrong and it is over</em>';
        SIZE = sizes(isClub(stat));
        stage.style.setProperty('--ub-sw', SIZE.w + 'px'); stage.style.setProperty('--ub-ph', SIZE.pitch + 'px'); stage.style.setProperty('--ub-slw', SIZE.slot + 'px'); stage.style.setProperty('--ub-vs', SIZE.vs);
        stage.classList.toggle('ub-clubs', isClub(stat));
        stage.innerHTML = `<div class="ub-cols"><div class="ub-col"><div class="ub-slot ub-l"></div><div class="ub-who ub-who-l"></div></div>
          <div class="ub-col"><div class="ub-slot ub-r"></div><div class="ub-who ub-who-r"></div></div><span class="ub-vs">VS</span></div>`;
        const sl = stage.querySelector('.ub-l'), sr = stage.querySelector('.ub-r');
        reelL = new Reel(sl, SIZE.pitch); reelR = new Reel(sr, SIZE.pitch);
        reelL.show(ph()); reelR.show(ph());
        answerBar(); enable(false); hint.textContent = '';
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
          if (right) win(); else { snd('buzzer'); later(over, reduced ? 200 : 950); }
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
        run.streak++; snd('lockin');
        const done = () => {
          nEl.textContent = run.streak;
          streakEl.classList.remove('burst'); void streakEl.offsetWidth; streakEl.classList.add('burst');
          later(advance, reduced ? 120 : 380);
        };
        if (reduced) { done(); return; }
        // a cyan tick pops where VS sits, then flies up to the run count, which ticks up as it lands
        const vs = stage.querySelector('.ub-vs').getBoundingClientRect(), to = nEl.getBoundingClientRect();
        const tick = D2T.h('<div class="ub-tick" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>');
        const cx = vs.left + vs.width / 2, cy = vs.top + vs.height / 2;
        tick.style.left = cx + 'px'; tick.style.top = cy + 'px'; document.body.appendChild(tick);
        const dx = to.left + to.width / 2 - cx, dy = to.top + to.height / 2 - cy;
        tick.animate([{ transform: 'translate(-50%,-50%) scale(0) rotate(-30deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.3) rotate(6deg)', opacity: 1, offset: 0.6 }, { transform: 'translate(-50%,-50%) scale(1) rotate(0)', opacity: 1 }], { duration: 340, easing: 'cubic-bezier(.2,.9,.3,1.3)', fill: 'forwards' });
        later(() => {
          tick.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.45)`, opacity: 0.9 }], { duration: 520, easing: 'cubic-bezier(.55,0,.25,1)', fill: 'forwards' })
            .onfinish = () => { tick.remove(); done(); };
        }, 560);
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
      function over(cleared) {
        if (!root.isConnected || !run) return;
        const s = run.stat, n = run.streak, prev = R.best[s.id] || 0, newBest = n > prev && n > 0;
        R.runs++; if (newBest) R.best[s.id] = n; save();
        if (newBest) snd('champions');
        const a = run.cur, b = run.next, nm = (r) => r.name || D2T.game.club(r.club).full || r.club;
        const head = cleared ? 'The whole deck, unbeaten' : n === 0 ? 'Beaten first time' : `Unbeaten in ${n}`;
        const lead = cleared ? 'You got through every card in this deck.' : `<b>${D2T.esc(nm(b))}</b> had <b>${s.val(b)}</b>, <b>${D2T.esc(nm(a))}</b> had <b>${s.val(a)}</b>.`;
        const best = newBest ? ' A new best.' : prev ? ` Your best on ${s.big.toLowerCase()}: ${prev}.` : '';
        const text = `DROP2TOP Unbeaten Run\n${s.big} (Premier League): unbeaten in ${n}${newBest ? ', a new best' : ''}`;
        const sh = D2T.sheet({ title: head, body: `<div class="ub-endbig"><b>${n}</b><span>Unbeaten${newBest ? ' · a new best' : ''}</span></div><p class="fr-lead">${lead}${best}</p>
          <div class="fr-stack"><button class="btn ub-again fr-btn-wide" data-k="share">Share with your mates</button><button class="btn btn-ghost fr-btn-wide ub-newrun" data-k="again">New run</button></div>`, onClose: () => { if (root.isConnected && run) idle(); } });
        sh.body.querySelector('[data-k="again"]').onclick = () => { sh.close(); idle(); later(statSpin, 250); };
        sh.body.querySelector('[data-k="share"]').onclick = async () => {
          try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
          try { await navigator.clipboard.writeText(text); sh.body.querySelector('.fr-lead').textContent = 'Copied. Paste it into the group chat.'; } catch (e) { /* nothing to copy to */ }
        };
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
      // or down on its rubber band, and a cyan elastic arrow stretches from where the finger landed to where it is now
      let arrow = null;
      function drawArrow(x0, y0, x, y) {
        if (!arrow) { arrow = D2T.h('<svg class="ub-arrow" aria-hidden="true"><path class="shaft"/><path class="head"/></svg>'); document.body.appendChild(arrow); }
        const dx = x - x0, dy = y - y0, len = Math.hypot(dx, dy);
        if (len < 4) { arrow.style.opacity = 0; return; }
        arrow.style.opacity = 1;
        const ux = dx / len, uy = dy / len, hl = Math.min(22, 10 + len * 0.08), bx = x - ux * hl * 0.8, by = y - uy * hl * 0.8;
        const sw = Math.max(3, 11 - len / 28);                     // it thins as it stretches, like elastic
        const sh = arrow.querySelector('.shaft'); sh.setAttribute('d', `M${x0},${y0} L${bx.toFixed(1)},${by.toFixed(1)}`); sh.style.strokeWidth = sw.toFixed(1);
        const px = -uy * hl * 0.62, py = ux * hl * 0.62;
        arrow.querySelector('.head').setAttribute('d', `M${x.toFixed(1)},${y.toFixed(1)} L${(x - ux * hl + px).toFixed(1)},${(y - uy * hl + py).toFixed(1)} L${(x - ux * hl - px).toFixed(1)},${(y - uy * hl - py).toFixed(1)} Z`);
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
      idle();
    },
    unmount() { timers.forEach(clearTimeout); rafs.forEach(cancelAnimationFrame); timers = []; rafs = []; document.querySelectorAll('.ub-fly, .ub-boom, .ub-tick, .ub-arrow').forEach((f) => f.remove()); }
  });

  // the home screen card (screens/home.js), in the same shape as the other games' cards
  D2T.ubRecord = () => { const R = D2T.state.ub || { best: {}, runs: 0 }; const top = Math.max(0, ...Object.values(R.best || {})); return { runs: R.runs || 0, top }; };
  D2T.ubMark = MARK;
})();
