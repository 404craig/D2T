// D2T card renderers (v1 shiny style). All return HTML strings; size with opts.w (px width).
(function () {
  const D2T = window.D2T = window.D2T || {};
  const NOHOLO = 'none';
  const LV = {
    bronze: { label: 'BRONZE', name: 'Bronze', ink: '#2B1608', line: 'rgba(43,22,8,0.35)', text: '#E3A577',
      face: 'linear-gradient(155deg, #F6D2AE 0%, #D99A66 28%, #A9653A 55%, #7A4422 75%, #C8875A 100%)',
      rim: 'linear-gradient(160deg, #FFE6CC 0%, #B97A4B 50%, #6E3C1C 100%)', holo: NOHOLO,
      glow: 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))' },
    silver: { label: 'SILVER', name: 'Silver', ink: '#16202A', line: 'rgba(22,32,42,0.30)', text: '#DCE2E8',
      face: 'linear-gradient(155deg, #FFFFFF 0%, #DCE2E8 25%, #A8B2BD 52%, #7E8894 72%, #D3D9DF 100%)',
      rim: 'linear-gradient(160deg, #FFFFFF 0%, #B9C2CC 50%, #5F6974 100%)', holo: NOHOLO,
      glow: 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))' },
    gold: { label: 'GOLD', name: 'Gold', ink: '#2A1B00', line: 'rgba(42,27,0,0.30)', text: '#FFD95A',
      face: 'linear-gradient(155deg, #FFF6C8 0%, #FFD95A 25%, #E3A814 52%, #A87406 74%, #F7CE4A 100%)',
      rim: 'linear-gradient(160deg, #FFF8D6 0%, #F2C230 45%, #8A5E00 100%)', holo: NOHOLO,
      glow: 'drop-shadow(0 0 10px rgba(255,200,61,0.30))' },
    baller: { label: 'BALLER', name: 'Baller', ink: '#FFFFFF', line: 'rgba(255,255,255,0.40)', text: '#B48CFF',
      face: 'linear-gradient(155deg, #E4D2FF 0%, #A774FF 22%, #6A2EE8 50%, #2E0F7A 78%, #8F5CFF 100%)',
      rim: 'linear-gradient(160deg, #F1E6FF 0%, #9B5CFF 45%, #2A0C70 100%)',
      holo: 'linear-gradient(115deg, rgba(5,240,255,0) 35%, rgba(5,240,255,0.22) 48%, rgba(255,40,130,0.18) 58%, rgba(255,40,130,0) 70%)',
      glow: 'drop-shadow(0 0 12px rgba(155,92,255,0.55))' },
    legend: { label: 'LEGEND', name: 'Legend', ink: '#FFFFFF', line: 'rgba(255,255,255,0.45)', text: '#FF8A4C',
      face: 'linear-gradient(150deg, #FFD36E 0%, #FF6900 28%, #FF2882 55%, #7A0F4A 80%, #FF6900 100%)',
      rim: 'linear-gradient(160deg, #FFF3B0 0%, #FF6900 45%, #8A0F50 100%)',
      holo: 'linear-gradient(115deg, rgba(5,240,255,0) 30%, rgba(5,240,255,0.30) 45%, rgba(235,255,0,0.28) 55%, rgba(235,255,0,0) 70%)',
      glow: 'drop-shadow(0 0 14px rgba(255,105,0,0.55))' }
  };
  const KEYS = ['GOL', 'IMP', 'FIT', 'WIN', 'DEF', 'EXP'];
  const GK_KEYS = ['WAL', 'CLN', 'FIT', 'WIN', 'EXP']; // goalkeepers: walls (saves proxy) and clean sheets
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // colour helpers for club faces
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
  function clubPaint(c) {
    const a = c.accent;
    return {
      face: `linear-gradient(170deg, ${mix(a, '#FFFFFF', 0.55)} 0%, ${a} 22%, ${mix(a, '#000000', 0.32)} 42%, ${mix(a, '#000000', 0.80)} 66%, ${mix(a, '#000000', 0.92)} 100%)`,
      rim: `linear-gradient(170deg, ${mix(a, '#FFFFFF', 0.7)} 0%, ${a} 40%, ${mix(a, '#000000', 0.75)} 100%)`,
      tex: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.12) 0 0.2em, rgba(255,255,255,0) 0.2em 0.7em)',
      glow: `drop-shadow(0 0 10px ${a}55)`
    };
  }
  const splitName = (n) => { const i = n.indexOf(' '); return i < 0 ? ['', n] : [n.slice(0, i), n.slice(i + 1)]; };

  function player(c, opts = {}) {
    const w = opts.w || 114, L = LV[c.level] || LV.bronze;
    const [first, last] = splitName(c.name);
    const style = `--w:${w}px;--face:${L.face};--rim:${L.rim};--ink-c:${L.ink};--line-c:${L.line};--holo:${L.holo};--glow:${opts.glow || L.glow}`;
    const keys = c.pos === 'GK' ? GK_KEYS : KEYS;
    const pcrest = L.ink === '#FFFFFF' ? c.crest : (c.crestLight || c.crest); // dark faces take the white crest
    const stats = keys.map((k) => `<span class="d2c-stat"><b>${c.stats[k] == null ? '-' : c.stats[k]}</b><i>${k}</i></span>`).join('');
    const shine = opts.shine === false ? '' : `<span class="d2t-shine${opts.slow ? ' slow' : ''}" style="animation-delay:${opts.delay || 0}s"></span>`;
    // nationality (12 Oct, option A): a flag under the position on bigger cards (in place of the level word, which the card's
    // colour already shows), and under the crest beside the rating on pitch cards
    const flag = c.flag ? `<img class="d2c-flag" src="${c.flag}" alt="${esc(c.nat || '')}">` : '';
    if (opts.mini) { // pitch card: position tab, big rating beside the crest, full name
      return `<div class="d2c d2c-player mini pos-${c.role || c.pos} ${opts.cls || ''}" style="${style}" data-level="${c.level}" aria-label="${esc(c.name)}, ${c.ovr} ${L.name}, ${c.main || c.pos}${c.nat ? ', ' + esc(c.nat) : ''}">
      <span class="d2c-tab">${opts.tab || c.main || c.pos}</span><div class="d2c-rim"></div><div class="d2c-face"><span class="d2c-tex"></span><span class="d2c-hi"></span><span class="d2c-holo"></span>${shine}
      <div class="d2c-body"><div class="d2c-mid"><span class="d2c-ovr">${c.ovr}</span>${flag ? `<span class="d2c-side"><img class="d2c-crest" src="${pcrest}" alt="">${flag}</span>` : `<img class="d2c-crest" src="${pcrest}" alt="">`}</div>
      <span class="d2c-first d2c-fit">${esc(first)}</span><span class="d2c-last">${esc(last)}</span></div></div></div>`;
    }
    return `<div class="d2c d2c-player${opts.mini ? ' mini' : ''} ${opts.cls || ''}" style="${style}" data-level="${c.level}" aria-label="${esc(c.name)}, ${c.ovr} ${L.name}, ${c.main || c.pos}${c.nat ? ', ' + esc(c.nat) : ''}">
      <div class="d2c-rim"></div><div class="d2c-face"><span class="d2c-tex"></span><span class="d2c-hi"></span><span class="d2c-holo"></span>${shine}
      <div class="d2c-body"><div class="d2c-top"><div class="d2c-left"><span class="d2c-ovr">${c.ovr}</span><span class="d2c-pos">${c.main || c.pos}</span><span class="d2c-rule"></span>${flag || `<span class="d2c-lvl">${L.label}</span>`}</div>
      <img class="d2c-crest" src="${pcrest}" alt=""></div>
      <span class="d2c-first">${esc(first)}</span><span class="d2c-last">${esc(last)}</span><span class="d2c-div"></span><div class="d2c-stats">${stats}</div></div></div></div>`;
  }

  // a club name's longest word sets its size, so one long word (Middlesbrough, Huddersfield) never runs off the card
  const cnameSize = (n) => { const w = Math.max(...String(n).split(/\s+/).map((x) => x.length)); return w > 11 ? ` style="font-size:${(1.35 * 11 / w).toFixed(2)}em"` : ''; };
  function club(c, opts = {}) {
    const w = opts.w || 114, P = clubPaint(c);
    const style = `--w:${w}px;--face:${P.face};--rim:${P.rim};--tex:${P.tex};--glow:${opts.glow || P.glow};--club-text:${c.text}`;
    const shine = opts.shine === false ? '' : `<span class="d2t-shine${opts.slow ? ' slow' : ''}" style="animation-delay:${opts.delay || 0}s"></span>`;
    const foot = opts.foot || `${ordinal(c.pos)} · ${c.pts} pts`;
    return `<div class="d2c d2c-club ${opts.cls || ''}" style="${style}" aria-label="${esc(c.full || c.name)} ${c.season}">
      <div class="d2c-rim"></div><div class="d2c-face"><span class="d2c-tex"></span><span class="d2c-hi"></span>${shine}
      <div class="d2c-body"><img class="d2c-crest" src="${c.crestCard || c.crestLight || c.crest}" alt=""><span class="d2c-cname"${cnameSize(c.name)}>${esc(c.name)}</span><span class="d2c-season">${c.season}</span>
      <span class="d2c-grow"></span><span class="d2c-hr"></span><span class="d2c-flabel">${opts.footLabel || 'REAL FINISH'}</span><span class="d2c-foot">${foot}</span></div></div></div>`;
  }

  // Placeholder slot before a spin: 'question' (? and scrambled data) or 'fuzzy' (blurred crest)
  const SCR = '#%&@$?!0123456789ABCDEFGHJKMNPRSTUVWXYZ';
  const scramble = (n) => Array.from({ length: n }, () => SCR[Math.floor(Math.random() * SCR.length)]).join('');
  function placeholder(opts = {}) {
    const w = opts.w || 114;
    const inner = opts.variant === 'fuzzy'
      ? `<img class="d2c-fuzz" src="${opts.crest}" alt="">`
      : `<span class="d2c-q">?</span>`;
    return `<div class="d2c d2c-ph ${opts.cls || ''}" style="--w:${w}px;--glow:none" aria-label="Empty slot">
      <div class="d2c-rim"></div><div class="d2c-face"><div class="d2c-body" style="align-items:center;padding-top:1.6em">${inner}
      <span class="d2c-grow"></span><span class="d2c-scr" data-scr="8">${scramble(8)}</span><span class="d2c-scr" data-scr="6">${scramble(6)}</span></div></div></div>`;
  }

  // Long surnames shrink to fit the card instead of being cut with an ellipsis: every .d2c-last added to the page is
  // measured once and scaled down (to 55% at most), and again once Exo 2 has loaded.
  function fitName(el, force) {
    if (!el.isConnected || (el.dataset.fit && !force)) return;
    const cw = el.clientWidth; if (!cw) return;
    el.dataset.fit = '1'; el.style.fontSize = '';
    const sw = el.scrollWidth;
    if (sw > cw + 1) { const fs = parseFloat(getComputedStyle(el).fontSize); el.style.fontSize = Math.max(fs * 0.55, fs * (cw / sw) * 0.97).toFixed(2) + 'px'; }
  }
  const FIT = '.d2c-last, .d2c-fit';
  const fitIn = (n) => { if (n.nodeType !== 1) return; if (n.matches(FIT)) fitName(n); else n.querySelectorAll(FIT).forEach((e) => fitName(e)); };
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(fitIn))).observe(document.documentElement, { childList: true, subtree: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => document.querySelectorAll(FIT).forEach((e) => fitName(e, true)));
  }

  // What sits under a big player card (Craig, 13 Oct; option B in design/prototype/player-detail.html): nothing the card
  // already shows (name, flag, rating), then two panels with the same four numbers in the same spots for every player,
  // this season (its border tinted in the card's level colour) and his whole Premier League career, then a strip with
  // his positions and his clubs in career order. A number the data doesn't have shows as a dash, never a guess.
  function info(c) {
    const k = c.career, lvl = (LV[c.level] || LV.bronze).text;
    const num = (v) => (v == null ? '\u2013' : v);
    const cell = (v, l) => `<div><span class="pd-num">${num(v)}</span><span class="pd-lab">${l}</span></div>`;
    const four = (g, a, as, cs) => `<div class="pd-g">${cell(g, 'Games')}${cell(a, 'Goals')}${cell(as, 'Assists')}${cell(cs, 'Clean sheets')}</div>`;
    const crestOf = (n) => { const cl = D2T.game && D2T.game.club(n); return cl && cl.crest ? `<img class="pd-crest" src="${cl.crest}" alt="${esc(n)}" title="${esc(n)}">` : ''; };
    const yrs = k ? (k.f === k.l ? k.f : `${k.f} to ${k.l}`) : '';
    const pos = c.main ? `<span class="pd-pos"><b class="is-main">${c.main}</b>${c.alt.map((x) => `<b>${x}</b>`).join('')}</span>` : `<span class="pd-pos"><b class="is-main">${c.pos}</b></span>`;
    const clubs = k ? `<span class="pd-crests">${k.c.slice(0, 4).map(crestOf).join('')}${k.c.length > 4 ? `<em>+${k.c.length - 4}</em>` : ''}</span>` : '';
    return `<div class="pd" style="--lvl:${lvl}">
      <div class="pd-pan"><div class="pd-p is-now"><div class="pd-ph">${crestOf(c.club)}<div><span class="pd-lab">This season</span><small>${c.season}${c.provisional ? ' · provisional' : ''}</small></div></div>${four(c.apps, c.goals, c.assists, c.cleanSheets)}</div>
        <div class="pd-p"><div class="pd-ph"><div><span class="pd-lab">PL career</span><small>${yrs}</small></div></div>${k ? four(k.a, k.g, k.as, k.cs) : four()}</div></div>
      <div class="pd-strip"><div><span class="pd-lab">Positions</span>${pos}</div>${k ? `<div><span class="pd-lab">${k.n} season${k.n === 1 ? '' : 's'} · clubs</span>${clubs}</div>` : ''}</div></div>`;
  }

  function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  // Big detail card. Default is a plain scale overlay; core/flip.js replaces this with the spin transition.
  function openLarge(fromEl, html, opts = {}) {
    const host = document.getElementById('app');
    const ov = document.createElement('div');
    ov.className = 'card-overlay';
    ov.style.cssText = 'position:absolute;inset:0;z-index:40;background:rgba(0,0,0,.85);display:grid;place-items:center';
    ov.innerHTML = html;
    host.appendChild(ov);
    const close = () => { ov.remove(); opts.onClose && opts.onClose(); };
    ov.addEventListener('click', close);
    return { close };
  }

  D2T.LV = LV; D2T.KEYS = KEYS; D2T.GK_KEYS = GK_KEYS; D2T.esc = esc; D2T.ordinal = ordinal; D2T.mix = mix;
  D2T.cards = { player, club, placeholder, openLarge, clubPaint, scramble, info };
})();
