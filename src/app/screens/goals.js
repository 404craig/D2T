// Goal Rush (was 433 Goals; black, yellow #FFD21F as the mode colour; UI_SPEC 8f, prototype design/prototype/goal-rush.html, chosen 12 Oct).
// Each game picks a formation at random (442, 433, 451, 352, 343, 424, 532 or 541): the pitch takes that shape and its number is
// the target, so 3-5-2 means score exactly 352. A target reveal opens each game. Fill the XI in any order: each spin shows three
// real players for any open shirt (they show yellow), as shirts with the name and crest on the back. Place one on an open shirt
// of his position; his Premier League career goals roll onto it and shoot up to the total. On the last shot, sometimes one of
// the three has exactly the goals needed (D2T.game.g433.gift per formation). 3 respins a game.
// The game in progress is D2T.state.g433 (saved after every step, so a refresh never re-rolls or replays the reveal), results go
// to record.g433, carried on from 433 Goals.
(function () {
  const POS1 = { GK: 'goalkeeper', DEF: 'defender', MID: 'midfielder', FWD: 'forward' };
  // the pitch for a formation (UI_SPEC 8f): labels per line, spaced up to 25% apart, the outer pair of a 4 or 5 line 2% higher
  const LABELS = { DEF: { 3: ['CB', 'CB', 'CB'], 4: ['LB', 'CB', 'CB', 'RB'], 5: ['LWB', 'CB', 'CB', 'CB', 'RWB'] }, MID: { 2: ['CM', 'CM'], 3: ['CM', 'CM', 'CM'], 4: ['LM', 'CM', 'CM', 'RM'], 5: ['LM', 'CM', 'CM', 'CM', 'RM'] }, FWD: { 1: ['ST'], 2: ['ST', 'ST'], 3: ['LW', 'ST', 'RW'], 4: ['LW', 'ST', 'ST', 'RW'] } };
  const slotsFor = (f) => {
    const sh = D2T.game.g433.shape(f), out = [['GK', 'GK', 50, 87.5]];
    [[sh.DEF, 'DEF', 67], [sh.MID, 'MID', 43], [sh.FWD, 'FWD', 17]].forEach(([n, pos, y]) => {
      const gap = n === 1 ? 0 : Math.min(25, 76 / (n - 1));
      LABELS[pos][n].forEach((lab, i) => out.push([lab, pos, 50 + (i - (n - 1) / 2) * gap, y + (n >= 4 && (i === 0 || i === n - 1) ? -2 : 0)]));
    });
    return out;
  };
  const shapeText = (f) => D2T.game.g433.shapeText(f);
  // this game's target and pitch (set from the saved formation on mount and for each new game)
  let TARGET = 433, FORM = '433', SLOTS = slotsFor('433');
  const setShape = (f) => { FORM = String(f); TARGET = +FORM; SLOTS = slotsFor(FORM); };
  const snd = (id) => { const S = window.D2TSound; if (S) S.play(id); };

  // ---------- colours and kits ----------
  const hexrgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const lum = (h) => hexrgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((t, v, i) => t + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const shade = (h, k) => '#' + hexrgb(h).map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k).toString(16).padStart(2, '0')).join('');
  // Home kits: the body colour from clubs.json, plus each club's pattern and second colour so fewer shirts are plain red with
  // a white outline (design choices, not checked data). pat: s stripes, h hoops, v halves; f body; sl sleeves; tr outline; ink number.
  const KITS = {
    'Arsenal': { sl: '#FFFFFF', tr: '#8A0A10' }, 'Liverpool': { tr: '#7A0A1C' }, 'Man Utd': { tr: '#1A1A1A' }, 'Chelsea': { tr: '#FFFFFF' },
    'Spurs': { tr: '#132257', ink: '#132257' }, 'Newcastle': { pat: 's', b: '#111111', tr: '#111111', ink: '#FFFFFF' }, 'Everton': { tr: '#FFFFFF' },
    'West Ham': { f: '#7A263A', sl: '#1BB1E7', tr: '#3E0F1D', ink: '#FFFFFF' }, 'Aston Villa': { f: '#670E36', sl: '#95BFE5', tr: '#3B0820', ink: '#FFFFFF' }, 'Man City': { tr: '#1C2C5B', ink: '#1C2C5B' },
    'Southampton': { pat: 's', b: '#FFFFFF', tr: '#111111', ink: '#111111' }, 'Blackburn': { pat: 'v', b: '#FFFFFF', tr: '#0B2A55', ink: '#0B2A55' },
    'Leicester': { tr: '#00184D' }, 'Leeds': { tr: '#1D428A', ink: '#1D428A' }, 'Crystal Palace': { pat: 's', b: '#1B458F', tr: '#0B1F45', ink: '#FFFFFF' },
    'Middlesbrough': { tr: '#FFFFFF' }, 'Wolves': { tr: '#111111', ink: '#111111' }, 'Fulham': { tr: '#111111', ink: '#111111' }, 'Bolton': { tr: '#132257', ink: '#132257' },
    'Sunderland': { pat: 's', b: '#FFFFFF', tr: '#111111', ink: '#111111' }, 'Bournemouth': { pat: 's', b: '#111111', tr: '#111111', ink: '#FFFFFF' },
    'Norwich': { tr: '#00A650', ink: '#00843D' }, 'Brighton': { pat: 's', b: '#FFFFFF', tr: '#0B3B80', ink: '#0B3B80' }, 'Sheffield Wed': { pat: 's', b: '#FFFFFF', tr: '#0B1F55', ink: '#0B1F55' },
    'West Brom': { pat: 's', b: '#FFFFFF', tr: '#0B1F45', ink: '#0B1F45' }, 'Coventry': { tr: '#1C3F66', ink: '#0F2440' }, 'Burnley': { f: '#6C1D45', sl: '#99D6EA', tr: '#3A0C25', ink: '#FFFFFF' },
    'Stoke': { pat: 's', b: '#FFFFFF', tr: '#111111', ink: '#111111' }, 'Nottingham Forest': { tr: '#FFFFFF' }, 'QPR': { pat: 'h', b: '#FFFFFF', tr: '#0B2A55', ink: '#0B2A55' },
    'Wimbledon': { f: '#002D73', tr: '#FFE600', ink: '#FFE600' }, 'Charlton': { tr: '#FFFFFF' }, 'Swansea': { tr: '#111111', ink: '#111111' }, 'Wigan': { pat: 's', b: '#FFFFFF', tr: '#0B2A55', ink: '#0B2A55' },
    'Sheffield Utd': { pat: 's', b: '#FFFFFF', tr: '#111111', ink: '#111111' }, 'Derby': { tr: '#111111', ink: '#111111' }, 'Brentford': { pat: 's', b: '#FFFFFF', tr: '#111111', ink: '#111111' },
    'Ipswich': { tr: '#FFFFFF' }, 'Watford': { tr: '#ED2127', ink: '#111111' }, 'Portsmouth': { tr: '#C8102E' }, 'Birmingham': { tr: '#FFFFFF' },
    'Hull': { pat: 's', b: '#111111', tr: '#111111', ink: '#111111' }, 'Reading': { pat: 'h', b: '#FFFFFF', tr: '#00224D', ink: '#00224D' }, 'Oldham': { tr: '#002A5C' },
    'Huddersfield': { pat: 's', b: '#FFFFFF', tr: '#0B2A55', ink: '#0B2A55' }, 'Bradford': { pat: 's', b: '#6D1D2C', tr: '#4A0818', ink: '#FFFFFF' },
    'Cardiff': { tr: '#FFFFFF' }, 'Swindon': { tr: '#FFFFFF' }, 'Barnsley': { tr: '#7A0A0E' }
  };
  // thin black line-drawn crests that vanish on a shirt: they sit on a light patch
  const LINE_CRESTS = new Set(['Derby', 'Sheffield Wed', 'Spurs', 'Swansea']);
  const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '-');
  const kits = {};
  const kit = (name) => kits[name] || (kits[name] = (() => {
    const c = D2T.game.club(name) || {}, x = KITS[name] || {}, fill = x.f || c.accent || '#888888', cink = c.ink || '#111111';
    const ink = x.ink || (contrast(fill, cink) >= 3 ? cink : (lum(fill) > 0.4 ? '#0A0A0A' : '#FFFFFF'));
    return { id: slug(name), fill, b: x.b, pat: x.pat, sl: x.sl, trim: x.tr || (cink === fill ? shade(fill, -0.45) : cink), ink,
      stroke: x.pat ? (lum(ink) > 0.4 ? '#111111' : '#FFFFFF') : '', crest: c.crest || '', crestLight: c.crestLight || c.crest || '', line: LINE_CRESTS.has(name) };
  })());
  // pattern defs for every patterned club and the sheen, once per screen
  const defs = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.keys(KITS).filter((n) => KITS[n].pat).map((n) => {
    const k = kit(n), a = k.fill, b = k.b;
    const inner = k.pat === 's' ? `<rect width="7" height="100" fill="${a}"/><rect x="7" width="7" height="100" fill="${b}"/>` : k.pat === 'h' ? `<rect width="100" height="8" fill="${a}"/><rect y="8" width="100" height="8" fill="${b}"/>` : `<rect width="50" height="100" fill="${a}"/><rect x="50" width="50" height="100" fill="${b}"/>`;
    const sz = k.pat === 's' ? 'width="14" height="100" x="1"' : k.pat === 'h' ? 'width="100" height="16" y="2"' : 'width="100" height="100"';
    return `<pattern id="g4p-${k.id}" patternUnits="userSpaceOnUse" ${sz}>${inner}</pattern>`; }).join('')}
    <clipPath id="g4clip"><path d="${SHIRT}"/></clipPath>
    <filter id="g4roll" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="0 2.6"/></filter>
    <linearGradient id="g4sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.34"/><stop offset="0.32" stop-color="#fff" stop-opacity="0.08"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="0.78" stop-color="#000" stop-opacity="0.10"/><stop offset="1" stop-color="#000" stop-opacity="0.26"/></linearGradient>
    <linearGradient id="g4glint" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0.35" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.65" stop-color="#fff" stop-opacity="0"/></linearGradient></defs></svg>`;

  // ---------- shirts ----------
  // The back of a shirt. Big (spinning) shirts: surname across the shoulders, a ? where the number goes, the crest printed
  // below, a slight sheen. Pitch shirts: his goals as the number (always the three-figure size), the crest on a light disc.
  const SHIRT = 'M31 9 L42 4 Q50 11 58 4 L69 9 L95 24 L85 44 L74 38 L74 96 L26 96 L26 38 L15 44 L5 24 Z';
  const SLEEVES = 'M31 9 L5 24 L15 44 L26 38 Z M69 9 L95 24 L85 44 L74 38 Z';
  const CREST = () => D2T.g4crest || 'disc';
  // under each big shirt: the club's name, or its crest when the crest moves there
  const trioCap = (p) => (CREST() === 'caption' ? `<img class="capcrest" src="${kit(p.club).crest}" alt="${D2T.esc(p.club)}">` : D2T.esc(p.club));
  function shirt(o) {
    const w = o.w, big = w >= 70, cls = o.cls || '';
    if (!o.player) {
      const mid = o.state === 'myst' ? '<text x="50" y="70" font-size="44">?</text>' : `<text x="50" y="64" font-size="24">${o.pos}</text>`;
      return `<div class="g4-shirt ${o.state === 'myst' ? 'myst' : 'empty'}${o.next ? ' next' : ''} ${cls}" style="--sw:${w}px"><svg viewBox="0 0 100 100" aria-hidden="true"><path class="body" d="${SHIRT}"/><path class="trim" d="M42 4 Q50 11 58 4"/>${mid}</svg></div>`;
    }
    const p = o.player, k = kit(p.club), st = k.stroke ? ` stroke="${k.stroke}" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round"` : '';
    let top = '', mid = '', over = '', disc = '';
    if (big) {
      const sur = p.sur.toUpperCase(), fs = Math.max(8.5, Math.min(13, 104 / Math.max(6, sur.length)));
      top = `<text x="50" y="${CREST() === 'collar' ? 35 : 27}" font-size="${fs}" textLength="${Math.min(52, sur.length * fs * 0.62)}" lengthAdjust="spacingAndGlyphs"${st}>${D2T.esc(sur)}</text>`;
      // the crest (12 Oct, three ways to try): collar = on a white disc at the collar like the pitch shirts; disc = on a white
      // circle in the middle of the back; caption = under the shirt in place of the club's name (see trioCap)
      const cs = CREST();
      if (k.crest && cs === 'collar') disc = `<span class="plate" style="--d:${Math.round(w * 0.36)}px"><img src="${k.crestLight}" alt=""></span>`;
      if (k.crest && cs === 'disc') over = `<circle cx="50" cy="61" r="17" fill="#F4F4F6" stroke="${k.trim}" stroke-width="1.6"/><image href="${k.crestLight}" x="38" y="49" width="24" height="24" preserveAspectRatio="xMidYMid meet"/>`;
    } else {
      const g = String(p.goals);
      mid = `<text class="gnum" x="50" y="65" font-size="30"${g.length > 2 ? ' textLength="46" lengthAdjust="spacingAndGlyphs"' : ''}${st}>${g}</text>`;
      if (k.crest) disc = `<span class="plate" style="--d:${Math.round(w * 0.4)}px"><img src="${k.crestLight}" alt=""></span>`;
    }
    const fill = k.pat ? `url(#g4p-${k.id})` : k.fill;
    const sleeves = k.sl ? `<path d="${SLEEVES}" fill="${k.sl}" stroke="${k.trim}" stroke-width="2.4" stroke-linejoin="round"/>` : '';
    const sheen = big ? `<path d="${SHIRT}" fill="url(#g4sheen)"/><g clip-path="url(#g4clip)"><path class="glint" d="${SHIRT}" fill="url(#g4glint)" opacity="0"/></g>` : '';
    return `<div class="g4-shirt ${cls}" style="--sw:${w}px;--trimc:${k.trim};--ink:${k.ink}" ${o.attr || ''}>${disc}<svg viewBox="0 0 100 100" aria-hidden="true"><path class="body" d="${SHIRT}" style="fill:${fill}"/>${sleeves}${sheen}<path class="body" d="${SHIRT}" style="fill:none"/><path class="trim" d="M42 4 Q50 11 58 4"/><path class="trim" d="M85 44 L95 24 M15 44 L5 24" stroke-width="3"/>${top}${mid}${over}</svg></div>`;
  }
  const glint = (el, reduced) => { const g = el && el.querySelector('.glint'); if (!g || reduced) return; g.animate([{ opacity: 0, transform: 'translateX(-60px)' }, { opacity: 1, transform: 'translateX(0)', offset: 0.5 }, { opacity: 0, transform: 'translateX(60px)' }], { duration: 650, easing: 'ease-in-out' }); };

  // ---------- the bar: yellow fills to the white target line; past it, the line moves in and the extra runs on in grey ----------
  const gapText = (t) => (t === TARGET ? 'exactly ' + TARGET : t < TARGET ? (TARGET - t) + ' away' : (t - TARGET) + ' over');
  const goalsN = (n) => n + (n === 1 ? ' goal' : ' goals');
  const toGo = (t) => (t === TARGET ? 'exactly ' + TARGET : t < TARGET ? goalsN(TARGET - t) + ' to go' : goalsN(t - TARGET) + ' over');
  const barState = (t) => { if (t <= TARGET) return { fill: t / TARGET, mark: 1, ovr: 0 }; const m = TARGET / t; return { fill: m, mark: m, ovr: 1 - m }; };
  function paintBar(host, t) {
    const tr = host.querySelector('.g4-track'), s = barState(t), o = tr.querySelector('.ovr');
    tr.querySelector('.fill').style.width = (s.fill * 100) + '%'; tr.querySelector('.mark').style.left = (s.mark * 100) + '%';
    o.style.left = (s.mark * 100) + '%'; o.style.width = (s.ovr * 100) + '%';
    host.querySelector('.tnum').textContent = t; setGap(host, t);
  }
  // the tally (UI_SPEC 8f): "38 goals to go" in yellow under "Player 7 of 11", and the big scored number over "/352 GOALS"
  function setGap(host, v) { const g = host.querySelector('.taway'); g.textContent = toGo(v); g.className = 'taway' + (v > TARGET ? ' overt' : v === TARGET ? ' exact' : ''); host.querySelector('.g4-tally').classList.toggle('near', v !== TARGET && Math.abs(v - TARGET) <= 20); }

  const COLORS = ['#FFD21F', '#FFB000', '#FFFFFF', '#FFE375'];
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/></svg>';
  const LINES = '<svg class="lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="3" y="2.5" width="94" height="95" rx="1.5" stroke-width="0.5"/><line x1="3" y1="50" x2="97" y2="50" stroke-width="0.5"/><rect x="26" y="2.5" width="48" height="14" stroke-width="0.5"/><rect x="38" y="2.5" width="24" height="5" stroke-width="0.5"/><rect x="26" y="83.5" width="48" height="14" stroke-width="0.5"/><rect x="38" y="92.5" width="24" height="5" stroke-width="0.5"/></svg>';

  let timers = [], rafs = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

  D2T.screen('goals433', {
    title: 'Goal Rush', theme: 'black',
    mount(root) {
      const reduced = D2T.reduced(), G4 = D2T.game.g433;
      const fresh = () => ({ filled: [], respins: G4.RESPINS, cands: null, recorded: false, gift: null, formation: G4.pickFormation(), revealed: false });
      let S = D2T.state.g433 && Array.isArray(D2T.state.g433.filled) ? D2T.state.g433 : (D2T.state.g433 = fresh());
      // a game saved by 433 Goals carries on as a 4-3-3 with no reveal
      if (!S.formation) { S.formation = '433'; S.revealed = true; }
      setShape(S.formation);
      // a game saved before any-order spins filled the shirts in order: give each its slot, drop three of one position
      S.filled.forEach((p, i) => { if (p.slot == null) p.slot = i; if (!p.pos) p.pos = SLOTS[p.slot][1]; });
      if (S.cands && S.cands.some((c) => !c.pos)) S.cands = null;
      const save = () => D2T.save();
      const total = () => S.filled.reduce((t, p) => t + p.goals, 0);
      let busy = false, sel = null;

      root.classList.add('g4', 'g4-cs-' + CREST());
      root.appendChild(D2T.topbar({ mode: ['Goal Rush', '#FFD21F'] }));
      const wrap = D2T.h(`<div class="g4-wrap">${defs()}
        <div class="g4-tally"><div class="top"><span class="g4-info"><b class="g4-player"></b><i class="g4-left"><span class="g4-lefttxt"></span><em class="taway"></em></i></span><span class="g4-tot"><b class="tnum">0</b><small class="ttarget">/433</small><em>Goals</em></span></div>
          <div class="g4-track"><span class="ovr"></span><span class="fill"></span><span class="mark"></span></div></div>
        <div class="g4-pitch"></div>
        <div class="g4-trio"></div>
        <div class="g4-hint"></div>
        <div class="sp-bar g4-bar"><button class="sp-round is-reload" aria-label="Spin again">${ARROW}<span class="sp-count"></span></button>
          <button class="sp-main">${D2T.logo('emblem', { label: '' })}<span class="sp-lbl">Spin</span></button>
          <button class="sp-round is-home" aria-label="Home">${D2T.ICON.home}</button></div></div>`);
      root.appendChild(wrap);
      const pitchEl = wrap.querySelector('.g4-pitch'), trioEl = wrap.querySelector('.g4-trio'), hintEl = wrap.querySelector('.g4-hint');
      const main = wrap.querySelector('.sp-main'), lbl = main.querySelector('.sp-lbl'), reload = wrap.querySelector('.is-reload');
      wrap.querySelector('.is-home').onclick = () => D2T.go('home');

      // sizes from the phone: big shirts shrink on short screens, pitch shirts follow the pitch height
      const H = root.clientHeight || 700, TW = H < 620 ? 72 : H < 700 ? 84 : 96;
      wrap.style.setProperty('--tw', TW + 'px');
      let PW = 56;
      // a shirt, its crest disc and its name must fit the tightest gap between two lines (defence to keeper, about 20% of the
      // pitch), so short phones get smaller shirts rather than overlapping ones
      const sizePitch = () => { const ph = pitchEl.clientHeight || 358; PW = Math.round(Math.max(30, Math.min(58, (ph * 0.205 - 16) / 1.19))); };

      const slotOf = (i) => S.filled.find((p) => p.slot === i);
      const openSlots = () => SLOTS.map((_, i) => i).filter((i) => !slotOf(i));
      const openPos = () => openSlots().reduce((o, i) => { o[SLOTS[i][1]] = (o[SLOTS[i][1]] || 0) + 1; return o; }, {});
      const fitSlots = (pos) => openSlots().filter((i) => SLOTS[i][1] === pos);
      const selPos = () => (sel != null && S.cands && S.cands[sel] ? S.cands[sel].pos : null);
      const drawPitch = () => {
        pitchEl.innerHTML = `${LINES}<span class="circle"></span><div class="modename">${TARGET} GOALS</div><span class="g4-shape">${shapeText(FORM)}</span>${SLOTS.map(([lab, , x, y], i) => {
          const f = slotOf(i);
          const inner = f ? shirt({ w: PW, player: f }) + `<span class="nm">${D2T.esc(f.sur)}</span>` : shirt({ w: PW, pos: lab, next: true });
          return `<div class="slotp${f ? '' : ' open'}" data-slot="${i}" style="left:${x}%;top:${y}%">${inner}</div>`; }).join('')}`;
        fitNames(); markPitch();
      };
      // names under the pitch shirts never run into the next shirt: on a line of 4 or 5 (shirts closer together) a long
      // surname shrinks until it fits the space to its neighbour
      const fitNames = () => {
        const pw = pitchEl.clientWidth || 360, count = {};
        SLOTS.forEach(([, pos]) => { count[pos] = (count[pos] || 0) + 1; });
        pitchEl.querySelectorAll('.slotp .nm').forEach((nm) => {
          const n = count[SLOTS[+nm.parentElement.dataset.slot][1]];
          if (n < 2) return;
          const room = pw * Math.min(25, 76 / (n - 1)) / 100 - 6;
          const w = nm.scrollWidth; if (w > room) nm.style.fontSize = Math.max(6.5, 9.5 * room / w).toFixed(1) + 'px';   // one read, one write
        });
      };
      // with a player selected, the open shirts he fits pulse and the rest of the open ones step back
      const markPitch = () => {
        const pos = selPos();
        pitchEl.querySelectorAll('.slotp.open').forEach((el) => { const fit = pos && SLOTS[+el.dataset.slot][1] === pos; el.classList.toggle('fit', !!fit); el.classList.toggle('nofit', !!pos && !fit); });
        pitchEl.querySelectorAll('.slotp.open').forEach((el) => { el.onclick = () => { const i = +el.dataset.slot; if (!busy && sel != null && SLOTS[i][1] === selPos()) place(sel, null, i); }; });
      };
      const trioMyst = () => `${[0, 1, 2].map(() => `<div class="cell"><span class="g4-ptag"></span><div class="reelwin"><div class="strip">${shirt({ w: TW, state: 'myst' })}</div></div><span class="cap"></span></div>`).join('')}`;
      const trioLanded = () => S.cands.map((c, i) => `<div class="cell"><span class="g4-ptag on">${c.pos}</span><div class="reelwin landed"><div class="strip">${shirt({ w: TW, player: c, attr: `data-c="${i}"` })}</div></div><span class="cap">${trioCap(c)}</span></div>`).join('');
      // left of the tally (UI_SPEC 8f): which player you are on and how many after him; the goals to go sit after it (setGap),
      // and the respins live only on the respin button's badge
      const setInfo = () => {
        const n = S.filled.length, cur = Math.min(n + 1, 11), left = 11 - cur;
        wrap.querySelector('.g4-player').textContent = n >= 11 ? 'Full XI' : `Player ${cur} of 11`;
        wrap.querySelector('.g4-lefttxt').textContent = n >= 11 ? '' : `${left} ${left === 1 ? 'player' : 'players'} to pick · `;
      };
      const setCounts = () => { setInfo(); reload.querySelector('.sp-count').textContent = S.respins; reload.disabled = busy || S.respins <= 0 || !S.cands || !openSlots().length; reload.setAttribute('aria-label', `Spin again, ${S.respins} left`); };
      const setUI = (label, hint, off) => { lbl.textContent = label; lbl.style.fontSize = label.length > 10 ? Math.max(13, Math.round(21 * 10 / label.length)) + 'px' : ''; hintEl.textContent = hint; main.disabled = !!off; setCounts(); };
      const setTally = (t) => { paintBar(wrap, t); setInfo(); };

      function idleUI() {
        const left = openSlots().length;
        markPitch();
        if (!left) { setUI('Play again', `Full XI: ${gapText(total())}`); return; }
        if (S.cands) { attach(); if (sel == null) tipsFor433(); setUI(sel != null ? 'Pick ' + S.cands[sel].sur : 'Pick one', sel != null ? `Drag him onto a yellow ${POS1[S.cands[sel].pos]} shirt, or tap again` : 'Drag a shirt onto a yellow shirt, or tap to pick', sel == null); return; }
        if (!S.filled.length) tipsFor433();
        setUI('Spin', left === 1 ? 'Last shot: spin for your final shirt' : `Spin for three players. ${left} shirts to fill`);
      }
      // first-time tips: what to aim for, then how to place a player, then the respins
      function tipsFor433() {
        later(() => { if (!root.isConnected || busy) return;
          const mid = trioEl.querySelector('[data-c="1"]');
          if (!S.cands) D2T.tip('g433-goal', wrap.querySelector('.tnum'), `Get this to exactly ${TARGET}`, { place: 'below', side: 'right' });
          else D2T.tips([['g433-drag', mid, 'Drag one onto a yellow shirt'], ...(S.respins > 0 ? [['g433-respin', reload, 'Not keen? Spin again']] : [])]);
        }, 700);
      }
      function render() {
        trioEl.innerHTML = S.cands ? trioLanded() : trioMyst();   // the trio first: the pitch takes the height that is left
        wrap.querySelector('.ttarget').textContent = '/' + TARGET;
        sizePitch(); drawPitch(); setTally(total());
        idleUI();
      }

      // ---------- reels: transform-only, speed blur, smooth stop and a small spring; the landed shirt never jumps ----------
      let uid = 0;
      function runReels(targets) {
        const opens = Object.keys(openPos());
        const wins = [...trioEl.querySelectorAll('.reelwin')];
        return new Promise((resolve) => {
          let landed = 0;
          wins.forEach((w, i) => {
            const strip = w.querySelector('.strip'), filler = [];
            while (filler.length < 16) { const L = G4.list(opens[Math.floor(Math.random() * opens.length)]), c = L[Math.floor(Math.random() * Math.min(L.length, 260))]; if (c !== targets[i]) filler.push(c); }
            strip.innerHTML = filler.concat([targets[i]]).map((p) => shirt({ w: TW, player: p })).join('');
            const D = strip.lastElementChild.getBoundingClientRect().top - strip.firstElementChild.getBoundingClientRect().top;
            const id = `g4b${++uid}`;
            w.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute"><filter id="${id}" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="0 0"/></filter></svg>`);
            const blur = w.querySelector('feGaussianBlur'); strip.style.filter = `url(#${id})`;
            const T = 1250 + i * 420, t0 = performance.now(); let lastY = 0, lastT = t0, hit = false;
            const finish = () => {
              strip.style.filter = ''; strip.innerHTML = shirt({ w: TW, player: targets[i], attr: `data-c="${i}"` }); strip.style.transform = 'none';
              w.classList.add('landed'); glint(strip.firstElementChild, reduced);
              w.parentElement.querySelector('.cap').innerHTML = trioCap(targets[i]);
              const tag = w.parentElement.querySelector('.g4-ptag'); tag.textContent = targets[i].pos; tag.classList.add('on');
              if (++landed === wins.length) resolve();
            };
            if (reduced) { finish(); return; }
            const frame = (now) => {
              if (!root.isConnected) return;
              const t = now - t0; let y;
              if (t < T) { const u = t / T; y = D * (1 - Math.pow(1 - u, 4)); } else { const s = (t - T) / 1000; y = D + 9 * Math.exp(-9 * s) * Math.sin(16 * s); }
              const v = Math.abs(y - lastY) / Math.max(1, now - lastT) * 16; lastY = y; lastT = now;
              blur.setAttribute('stdDeviation', `0 ${Math.min(9, Math.max(0, v * 0.22 - 0.6)).toFixed(2)}`);
              strip.style.transform = `translateY(${-y}px)`;
              if (t >= T && !hit) { hit = true; w.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' }); snd('tap'); }
              if (t < T + 520) rafs.push(requestAnimationFrame(frame)); else finish();
            };
            rafs.push(requestAnimationFrame(frame));
          });
        });
      }

      async function spin() {
        const open = openSlots();
        if (busy || !open.length) return;
        busy = true; sel = null; markPitch();
        const avoid = S.filled.map((p) => p.name), need = TARGET - total();
        // the last shot: decide once per game whether one of the three is exactly what you need
        if (open.length === 1 && S.gift == null) S.gift = G4.canGift(SLOTS[open[0]][1], need, avoid, FORM) && Math.random() < G4.gift(FORM);
        S.cands = G4.drawOpen(openPos(), avoid, open.length === 1 && S.gift ? need : null, FORM); save();   // saved first: a refresh shows the same three
        trioEl.innerHTML = trioMyst();
        setUI('Spinning', '', true); main.classList.add('is-spinning'); snd('roll3');
        await runReels(S.cands);
        if (!root.isConnected) return;
        main.classList.remove('is-spinning'); busy = false; idleUI();
      }
      function attach() {
        trioEl.querySelectorAll('[data-c]').forEach((el) => {
          const i = +el.dataset.c;
          el.classList.toggle('sel', sel === i); el.classList.toggle('dim', sel != null && sel !== i);
          if (el.dataset.on) return; el.dataset.on = 1;
          el.onclick = () => { if (el.dataset.dragged) { delete el.dataset.dragged; return; } choose(i); };
          dragify(el, i);
        });
      }
      function choose(i) {
        if (busy || !S.cands) return;
        if (sel === i) { place(i); return; }
        sel = i; snd('pick'); idleUI();
      }
      function place(i, fromRect, slot) {
        if (busy || !S.cands) return;
        const p = S.cands[i], ni = slot != null ? slot : fitSlots(p.pos)[0];
        if (ni == null || slotOf(ni) || SLOTS[ni][1] !== p.pos) return;
        busy = true;
        const from = total(), src = trioEl.querySelector(`[data-c="${i}"]`);
        // measure the target shirt at rest (its pulse scales it), so the flyer lands exactly on top of it
        pitchEl.querySelectorAll('.slotp.fit, .slotp.nofit').forEach((el) => el.classList.remove('fit', 'nofit'));
        const hr = wrap.getBoundingClientRect(), a = fromRect || src.getBoundingClientRect(), b = pitchEl.querySelector(`[data-slot="${ni}"] .g4-shirt`).getBoundingClientRect();
        S.filled.push(Object.assign({}, p, { slot: ni })); S.cands = null; sel = null;
        const done = !openSlots().length;
        let result = null;
        if (done && !S.recorded) { S.recorded = true; result = G4.finish(total(), TARGET); }
        save();
        snd('lockin');
        const fly = D2T.h(`<div class="g4-flyer">${shirt({ w: TW, player: p })}</div>`);
        fly.style.left = (a.left - hr.left) + 'px'; fly.style.top = (a.top - hr.top) + 'px'; fly.firstElementChild.style.setProperty('--sw', a.width + 'px');
        wrap.appendChild(fly); src.style.visibility = 'hidden';
        const s = b.width / a.width, dx = b.left - a.left, dy = b.top - a.top;   // the flyer scales from its top left (transform-origin 0 0)
        const anim = fly.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 40}px) scale(${(1 + s) / 2 * 1.1})`, offset: 0.55 }, { transform: `translate(${dx}px,${dy}px) scale(${s})` }], { duration: reduced ? 1 : 520, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
        const after = () => {
          if (!root.isConnected) return;
          fly.remove(); drawPitch(); trioEl.innerHTML = trioMyst();
          setInfo();
          setUI(done ? 'Play again' : 'Spin', '', true);
          const slotEl = pitchEl.querySelector(`[data-slot="${ni}"]`);
          rollNumber(slotEl, p, () => shoot(slotEl, p, () => tickTo(from, total(), () => { busy = false; idleUI(); if (done) ending(total(), result); })));
        };
        anim.onfinish = after;
        later(() => { if (fly.isConnected) after(); }, 900);          // in case the animation never reports back
      }
      function dragify(el, i) {
        el.addEventListener('pointerdown', (e) => {
          if (busy) return;
          const sx = e.clientX, sy = e.clientY; let ghost = null;
          const move = (ev) => {
            if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
              if (sel !== i) { sel = i; idleUI(); }
              ghost = D2T.h(`<div class="g4-ghost">${shirt({ w: TW * 0.84, player: S.cands[i] })}</div>`); document.body.appendChild(ghost);
            }
            if (ghost) { ghost.style.left = (ev.clientX - TW * 0.42) + 'px'; ghost.style.top = (ev.clientY - TW * 0.42) + 'px'; ev.preventDefault(); }
          };
          const up = (ev) => {
            window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
            if (!ghost) return;
            el.dataset.dragged = 1; setTimeout(() => { delete el.dataset.dragged; }, 50);
            const gr = ghost.getBoundingClientRect(); ghost.remove();
            // dropped on (or near) an open shirt of his position: the nearest one takes him
            let best = null, bd = 1e9;
            fitSlots(S.cands[i].pos).forEach((si) => {
              const t = pitchEl.querySelector(`[data-slot="${si}"]`).getBoundingClientRect();
              if (ev.clientX > t.left - 30 && ev.clientX < t.right + 30 && ev.clientY > t.top - 30 && ev.clientY < t.bottom + 30) {
                const d = Math.hypot(ev.clientX - (t.left + t.width / 2), ev.clientY - (t.top + t.height / 2)); if (d < bd) { bd = d; best = si; }
              }
            });
            if (best != null) place(i, gr, best);
          };
          window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
        });
      }

      // ---------- effects ----------
      function burstAt(x, y, big) {
        const b = D2T.h('<div class="g4-burst"></div>'); b.style.left = x + 'px'; b.style.top = y + 'px'; wrap.appendChild(b);
        const n = big ? 28 : 16;
        for (let i = 0; i < n; i++) {
          const p = document.createElement('i'), ang = (i / n) * Math.PI * 2 + Math.random() * 0.4, d = (big ? 70 : 42) + Math.random() * 30;
          p.style.setProperty('--c', COLORS[i % COLORS.length]); b.appendChild(p);
          p.animate([{ transform: 'translate(-3px,-3px) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d}px) rotate(${Math.random() * 360}deg) scale(.4)`, opacity: 0 }], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.1,.8,.3,1)', fill: 'forwards' });
        }
        const r = D2T.h('<div class="g4-ring"></div>'); r.style.left = x + 'px'; r.style.top = y + 'px'; wrap.appendChild(r);
        r.animate([{ transform: 'scale(.5)', opacity: 1 }, { transform: 'scale(5)', opacity: 0 }], { duration: 600, easing: 'ease-out', fill: 'forwards' });
        later(() => { b.remove(); r.remove(); }, 1000);
      }
      function revealShirt(slotEl) {
        if (reduced || !slotEl) return;
        const num = slotEl.querySelector('.gnum'), sh = slotEl.querySelector('.g4-shirt');
        const hr = wrap.getBoundingClientRect(), r = sh.getBoundingClientRect(), cx = r.left - hr.left + r.width / 2, cy = r.top - hr.top + r.height / 2;
        burstAt(cx, cy, true);
        sh.animate([{ transform: 'scale(1.6)', filter: 'brightness(2.2)' }, { transform: 'scale(0.92)', offset: 0.5 }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 520, easing: 'cubic-bezier(.3,1.4,.5,1)' });
        if (num) num.animate([{ transform: 'scale(1.9)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.3,1.4,.5,1)' });
      }
      // fruit machine: the number on his back rolls with a motion blur, slows, then lands on his goals with the burst
      function rollNumber(slotEl, p, done) {
        const num = slotEl && slotEl.querySelector('.gnum');
        if (reduced || !num) { done(); return; }
        const steps = [38, 38, 40, 42, 46, 50, 56, 64, 74, 88, 108, 136], n = String(p.goals).length;
        num.setAttribute('filter', 'url(#g4roll)');
        let i = 0;
        const tick = () => {
          if (!root.isConnected) return;
          if (i < steps.length) {
            let v; do { v = n > 2 ? 100 + Math.floor(Math.random() * 181) : n > 1 ? 10 + Math.floor(Math.random() * 90) : Math.floor(Math.random() * 10); } while (v === p.goals);
            num.textContent = v;
            if (i >= steps.length - 3) num.removeAttribute('filter');
            num.animate([{ transform: 'translateY(-14px)', opacity: 0.4 }, { transform: 'translateY(0)', opacity: 1 }], { duration: steps[i], easing: 'linear' });
            if (i % 2 === 0) snd('tap');
            later(tick, steps[i++]);
            return;
          }
          num.textContent = p.goals; num.removeAttribute('filter');
          revealShirt(slotEl);
          later(done, 380);
        };
        tick();
      }
      // the goals fly off his shirt up to the total at the top right, which pulses as they land
      function shoot(slotEl, p, done) {
        const tnum = wrap.querySelector('.tnum'), sh = slotEl && slotEl.querySelector('.g4-shirt');
        if (reduced || !sh) { done(); return; }
        const hr = wrap.getBoundingClientRect(), a = sh.getBoundingClientRect(), b = tnum.getBoundingClientRect();
        const x0 = a.left - hr.left + a.width / 2, y0 = a.top - hr.top + a.height / 2, x1 = b.left - hr.left + b.width / 2, y1 = b.top - hr.top + b.height / 2;
        const shot = D2T.h(`<div class="g4-shot">+${p.goals}</div>`); shot.style.left = x0 + 'px'; shot.style.top = y0 + 'px'; wrap.appendChild(shot);
        const dx = x1 - x0, dy = y1 - y0;
        const an = shot.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
          { transform: `translate(calc(-50% + ${dx * 0.15}px), calc(-50% + ${dy * 0.1 + 18}px)) scale(1.5)`, opacity: 1, offset: 0.22 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.75)`, opacity: 0.9 }], { duration: 640, easing: 'cubic-bezier(.55,0,.75,.4)', fill: 'forwards' });
        let ended = false;
        const land = () => { if (ended) return; ended = true; shot.remove(); if (!root.isConnected) return;
          tnum.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 360, easing: 'cubic-bezier(.3,1.4,.5,1)' });
          burstAt(x1, y1, false); done(); };
        an.onfinish = land; later(land, 800);
      }
      // blowing through the target: the line snaps in two and flies off, the target number tumbles away, the tally shakes
      function gateBreak(tr) {
        const mark = tr.querySelector('.mark'), r = mark.getBoundingClientRect(), hr = wrap.getBoundingClientRect();
        const x = r.left - hr.left + r.width / 2, y = r.top - hr.top, h = r.height;
        mark.style.opacity = 0;
        [-1, 1].forEach((d) => {
          const piece = D2T.h('<div class="g4-gatep"></div>');
          piece.style.left = (x - 1.5) + 'px'; piece.style.top = (d < 0 ? y : y + h / 2) + 'px'; piece.style.height = (h / 2) + 'px'; wrap.appendChild(piece);
          piece.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${6 + Math.random() * 10}px, ${d * 58}px) rotate(${d * 80}deg)`, opacity: 0 }], { duration: 760, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
          later(() => piece.remove(), 800);
        });
        const lab = D2T.h(`<div class="g4-gatel">${TARGET}</div>`); lab.style.left = (x - 24) + 'px'; lab.style.top = (y + h + 2) + 'px'; wrap.appendChild(lab);
        lab.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 0.8 }, { transform: 'translate(-14px, 70px) rotate(38deg)', opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
        later(() => lab.remove(), 950);
        burstAt(x, y + h / 2, true); burstAt(x + 10, y + h / 2, false);
        wrap.querySelector('.g4-tally').animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-5px,2px)' }, { transform: 'translate(6px,-2px)' }, { transform: 'translate(-3px,1px)' }, { transform: 'translate(0,0)' }], { duration: 360 });
        tr.querySelector('.fill').animate([{ filter: 'brightness(1)' }, { filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], { duration: 420 });
        snd('lockin');
      }
      // the number, the to-go text and the bar count up together; crossing the target = race past the line, burst on it, then the bar re-scales
      function tickTo(from, to, done) {
        const num = wrap.querySelector('.tnum'), tr = wrap.querySelector('.g4-track');
        if (reduced) { paintBar(wrap, to); done(); return; }
        const crosses = from <= TARGET && to > TARGET, dur = crosses ? 1500 : 950, t0 = performance.now();
        const fill = tr.querySelector('.fill'), mark = tr.querySelector('.mark'), ovr = tr.querySelector('.ovr');
        let burstDone = false;
        const step = (now) => {
          if (!root.isConnected) return;
          const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3), v = Math.round(from + (to - from) * e);
          num.textContent = v; setGap(wrap, v);
          if (!crosses) { const s = barState(v); fill.style.width = (s.fill * 100) + '%'; mark.style.left = (s.mark * 100) + '%'; ovr.style.left = mark.style.left; ovr.style.width = (s.ovr * 100) + '%'; }
          else {
            const runEnd = Math.min(1.16, to / TARGET);
            if (p < 0.55) {
              const q = p / 0.55, w = (from / TARGET) + (runEnd - from / TARGET) * (1 - Math.pow(1 - q, 2));
              fill.style.width = (w * 100) + '%'; mark.style.left = '100%'; ovr.style.width = '0%';
              if (!burstDone && w >= 1) { burstDone = true; gateBreak(tr); tr.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(1.8)' }, { transform: 'scaleY(1)' }], { duration: 380 }); }
            } else {
              const q = (p - 0.55) / 0.45, k = 1 - Math.pow(1 - q, 3), s = barState(to);
              fill.style.width = ((runEnd + (s.fill - runEnd) * k) * 100) + '%'; mark.style.left = ((1 + (s.mark - 1) * k) * 100) + '%';
              ovr.style.left = mark.style.left; ovr.style.width = (s.ovr * k * 100) + '%'; mark.style.opacity = Math.max(0, (q - 0.35) / 0.65);
            }
          }
          if (p < 1) rafs.push(requestAnimationFrame(step)); else { mark.style.opacity = ''; paintBar(wrap, to); done(); }
        };
        rafs.push(requestAnimationFrame(step));
      }
      function confetti(ms = 3200) {
        const cv = document.createElement('canvas'); cv.className = 'g4-confetti'; wrap.appendChild(cv);
        const W = cv.width = wrap.clientWidth * 2, Hh = cv.height = wrap.clientHeight * 2, ctx = cv.getContext('2d');
        const cols = ['#FFD21F', '#FFE375', '#FFFFFF', '#12F06C', '#FFB000'];
        const ps = Array.from({ length: 180 }, (_, i) => ({ x: W / 2 + (Math.random() - 0.5) * 120, y: Hh * 0.42, vx: (Math.random() - 0.5) * 34, vy: -18 - Math.random() * 26, r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.4, w: 8 + Math.random() * 10, h: 5 + Math.random() * 6, c: cols[i % cols.length] }));
        const t0 = performance.now();
        const f = (now) => {
          const t = now - t0; ctx.clearRect(0, 0, W, Hh);
          ps.forEach((p) => { p.vy += 0.9; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - ms + 800) / 800); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); ctx.restore(); });
          if (t < ms && root.isConnected) rafs.push(requestAnimationFrame(f)); else cv.remove();
        };
        rafs.push(requestAnimationFrame(f));
      }
      // the four endings, then the result sheet
      function ending(t, result) {
        const gap = TARGET - t, show = () => resultSheet(t, result);
        if (reduced) { show(); return; }
        const pr = pitchEl.getBoundingClientRect(), hr = wrap.getBoundingClientRect(), midY = pr.top - hr.top + pr.height / 2;
        const msg = (cls, big, small) => { const m = D2T.h(`<div class="g4-msg ${cls}"><b>${big}</b><span>${small}</span></div>`); m.style.top = (midY - 70) + 'px'; wrap.appendChild(m); return m; };
        const fade = (els, at) => later(() => { els.forEach((x) => x.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' })); later(() => { els.forEach((x) => x.remove()); show(); }, 520); }, at);
        const dim = (ms) => { const d = D2T.h('<div class="g4-dim"></div>'); wrap.appendChild(d); d.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, fill: 'forwards' }); return d; };
        if (gap === 0) {
          // EXACT: the bar turns gold, the shirts light up in a wave, confetti, the giant target slams onto the pitch
          snd('champions');
          wrap.querySelector('.g4-track').classList.add('glow');
          [...pitchEl.querySelectorAll('.slotp .g4-shirt')].forEach((s, i) => s.animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.25)', filter: 'brightness(1.8)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 500, delay: 80 * (10 - i) }));
          later(() => {
            confetti(); const d = dim(300), m = msg('', String(TARGET), `Perfect. Exactly ${TARGET}.`);
            m.querySelector('b').animate([{ transform: 'scale(3) rotate(-8deg)', opacity: 0 }, { transform: 'scale(0.92) rotate(-3deg)', opacity: 1, offset: 0.55 }, { transform: 'scale(1) rotate(-3deg)', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'forwards' });
            pitchEl.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,3px)' }, { transform: 'translate(5px,-2px)' }, { transform: 'translate(-3px,1px)' }, { transform: 'translate(0,0)' }], { duration: 380, delay: 360 });
            m.querySelector('span').animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 700, fill: 'backwards' });
            fade([m, d], 3600);
          }, 700);
        } else if (gap > 25) {
          // A LONG WAY SHORT: no drama, just the gap, so near misses still feel special
          const m = msg('over', gap + ' short', 'Play again to get closer');
          m.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'ease-out', fill: 'backwards' });
          fade([m], 2400);
        } else if (gap > 0) {
          // SO CLOSE: the screen dims, the gap beats like a heartbeat and the empty end of the bar flashes
          snd('conceded');
          const d = dim(600), m = msg('close', gap === 1 ? '1 GOAL' : gap + ' GOALS', 'So close');
          m.animate([{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 500, easing: 'ease-out', fill: 'backwards' });
          m.querySelector('b').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], { duration: 1100, iterations: 2, delay: 500 });
          const tr = wrap.querySelector('.g4-track'), ghost = D2T.h('<span class="ghost"></span>');
          ghost.style.left = (t / TARGET * 100) + '%'; tr.appendChild(ghost);
          ghost.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 700, iterations: 4 });
          wrap.querySelector('.taway').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 700, iterations: 4 });
          fade([m, d, ghost], 3300);
        } else {
          // BLOWN PAST: the bar has raced past and re-scaled; a grey stamp says how far over
          snd('buzzer');
          const m = msg('over', '+' + (-gap), `Blown past ${TARGET}`);
          m.animate([{ opacity: 0, transform: 'translateX(-60px) skewX(-12deg)' }, { opacity: 1, transform: 'translateX(8px) skewX(-6deg)', offset: 0.6 }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'ease-out', fill: 'backwards' });
          fade([m], 2800);
        }
      }
      function resultSheet(t, result) {
        if (!root.isConnected) return;
        const rec = (result && result.rec) || G4.record(), gap = Math.abs(t - TARGET);
        const head = gap === 0 ? `Exactly ${TARGET}` : t < TARGET ? `${gap} short of ${TARGET}` : `${gap} over ${TARGET}`;
        const best = result && result.newBest && rec.games > 1 ? 'A new best.' : rec.best != null ? `Your best: ${rec.best === 0 ? 'exactly on target' : rec.best + ' away'}${rec.bestTarget ? ` (${rec.bestTotal}/${rec.bestTarget})` : ''}.` : '';
        const text = `DROP2TOP Goal Rush (${shapeText(FORM)})\nMy XI: ${t}/${TARGET} goals (${gapText(t)})\n${S.filled.map((p) => `${p.sur} ${p.goals}`).join(', ')}\nCan you beat it? 404craig.github.io/D2T`;
        const sh = D2T.sheet({ title: head, body: `<p class="fr-lead">Your XI scored <b>${t}</b> Premier League goals. ${best}${rec.exact ? ` Bang on target: ${rec.exact} ${rec.exact === 1 ? 'time' : 'times'}.` : ''}</p>
          <div class="fr-stack"><button class="btn btn-ghost fr-btn-wide" data-k="share">Share with your mates</button><button class="btn g4-again fr-btn-wide" data-k="again">Play again</button></div>` });
        sh.body.querySelector('[data-k="again"]').onclick = () => { sh.close(); newGame(); };
        sh.body.querySelector('[data-k="share"]').onclick = async () => {
          try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
          try { await navigator.clipboard.writeText(text); sh.body.querySelector('.fr-lead').textContent = 'Copied. Paste it into the group chat.'; } catch (e) { /* nothing to copy to */ }
        };
      }
      function newGame() { S = D2T.state.g433 = fresh(); setShape(S.formation); save(); sel = null; busy = false; wrap.querySelector('.g4-track').classList.remove('glow'); render(); reveal(); }

      // ---------- the target reveal (UI_SPEC 8f): once per game, never after a refresh; tap to skip, none with reduced motion ----------
      // a dim layer, "THIS GAME'S TARGET", the eight formations rolling through the big number, slowing to stop on this one
      function reveal() {
        if (S.revealed) return;
        if (reduced) { S.revealed = true; save(); return; }
        busy = true;
        const F = G4.FORMATIONS, end = Math.max(0, F.indexOf(FORM)), last = F.length * 2 + end;
        const el = D2T.h(`<div class="g4-reveal" role="button" tabindex="0" aria-label="This game's target is ${TARGET}: line up ${shapeText(FORM)}. Tap to start"><small>THIS GAME'S TARGET</small><b>${F[0]}</b><span>Line up ${shapeText(FORM)} · score ${TARGET}</span><div class="roll">${F.map((f) => `<i data-f="${f}">${f}</i>`).join('')}</div></div>`);
        wrap.appendChild(el);
        const big = el.querySelector('b'), chips = [...el.querySelectorAll('.roll i')], line = el.querySelector('span');
        line.style.opacity = 0;
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'backwards' });
        let k = 0, over = false;
        const finish = () => {
          if (over) return; over = true;
          S.revealed = true; save();                         // seen: leaving mid-roll shows it again next time
          el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' });
          later(() => { el.remove(); if (!root.isConnected) return; busy = false; idleUI(); }, 330);
        };
        el.onclick = finish; el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); } };
        later(() => el.focus({ preventScroll: true }), 50);
        const step = () => {
          if (over || !root.isConnected) return;
          const f = F[k % F.length];
          big.textContent = f; chips.forEach((c) => c.classList.toggle('on', c.dataset.f === f));
          if (k >= last) {
            snd('lockin');
            big.animate([{ transform: 'rotate(-3deg) scale(1.35)' }, { transform: 'rotate(-3deg) scale(.94)', offset: 0.55 }, { transform: 'rotate(-3deg) scale(1)' }], { duration: 480, easing: 'cubic-bezier(.3,1.4,.5,1)' });
            line.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 200, fill: 'forwards' });
            later(finish, 1700);
            return;
          }
          if (k % 2 === 0) snd('tap');
          later(step, 50 + Math.pow(k / last, 3) * 280); k++;
        };
        step();
      }

      main.onclick = () => {
        if (busy) return;
        if (!openSlots().length) { newGame(); return; }
        if (!S.cands) { spin(); return; }
        if (sel != null) place(sel);
      };
      reload.onclick = () => { if (busy || S.respins <= 0 || !S.cands || !openSlots().length) return; S.respins -= 1; save(); spin(); };
      render();
      reveal();
    },
    unmount() { timers.forEach(clearTimeout); rafs.forEach(cancelAnimationFrame); timers = []; rafs = []; document.querySelectorAll('.g4-ghost').forEach((g) => g.remove()); }
  });
})();
