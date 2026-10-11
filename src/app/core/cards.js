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
    const stats = keys.map((k) => `<span class="d2c-stat"><b>${c.stats[k] == null ? '-' : c.stats[k]}</b><i>${k}</i></span>`).join('');
    const shine = opts.shine === false ? '' : `<span class="d2t-shine" style="animation-delay:${opts.delay || 0}s"></span>`;
    if (opts.mini) { // pitch card: position tab, big rating beside the crest, full name
      return `<div class="d2c d2c-player mini pos-${c.pos} ${opts.cls || ''}" style="${style}" data-level="${c.level}" aria-label="${esc(c.name)}, ${c.ovr} ${L.name}, ${c.pos}">
      <span class="d2c-tab">${c.pos}</span><div class="d2c-rim"></div><div class="d2c-face"><span class="d2c-tex"></span><span class="d2c-hi"></span><span class="d2c-holo"></span>${shine}
      <div class="d2c-body"><div class="d2c-mid"><span class="d2c-ovr">${c.ovr}</span><img class="d2c-crest" src="${c.crest}" alt=""></div>
      <span class="d2c-first d2c-fit">${esc(first)}</span><span class="d2c-last">${esc(last)}</span></div></div></div>`;
    }
    return `<div class="d2c d2c-player${opts.mini ? ' mini' : ''} ${opts.cls || ''}" style="${style}" data-level="${c.level}" aria-label="${esc(c.name)}, ${c.ovr} ${L.name}, ${c.pos}">
      <div class="d2c-rim"></div><div class="d2c-face"><span class="d2c-tex"></span><span class="d2c-hi"></span><span class="d2c-holo"></span>${shine}
      <div class="d2c-body"><div class="d2c-top"><div class="d2c-left"><span class="d2c-ovr">${c.ovr}</span><span class="d2c-pos">${c.pos}</span><span class="d2c-rule"></span><span class="d2c-lvl">${L.label}</span></div>
      <img class="d2c-crest" src="${c.crest}" alt=""></div>
      <span class="d2c-first">${esc(first)}</span><span class="d2c-last">${esc(last)}</span><span class="d2c-div"></span><div class="d2c-stats">${stats}</div></div></div></div>`;
  }

  function club(c, opts = {}) {
    const w = opts.w || 114, P = clubPaint(c);
    const style = `--w:${w}px;--face:${P.face};--rim:${P.rim};--tex:${P.tex};--glow:${opts.glow || P.glow};--club-text:${c.text}`;
    const shine = opts.shine === false ? '' : `<span class="d2t-shine" style="animation-delay:${opts.delay || 0}s"></span>`;
    const foot = opts.foot || `${ordinal(c.pos)} · ${c.pts} pts`;
    return `<div class="d2c d2c-club ${opts.cls || ''}" style="${style}" aria-label="${esc(c.full || c.name)} ${c.season}">
      <div class="d2c-rim"></div><div class="d2c-face"><span class="d2c-tex"></span><span class="d2c-hi"></span>${shine}
      <div class="d2c-body"><img class="d2c-crest" src="${c.crest}" alt=""><span class="d2c-cname">${esc(c.name)}</span><span class="d2c-season">${c.season}</span>
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

  // What sits under a big player card: the facts the small card can't show (no repeat of its six stats).
  // Career numbers are every Premier League season in the data; clean sheets only where the rated data has them.
  function info(c, accent) {
    const k = c.career, yrs = k ? (k.f === k.l ? k.f : `${k.f} to ${k.l}`) : '';
    const season = `${c.apps} game${c.apps === 1 ? '' : 's'}, ${c.goals} goal${c.goals === 1 ? '' : 's'}${c.cleanSheets != null && (c.pos === 'GK' || c.pos === 'DEF') ? `, ${c.cleanSheets} clean sheet${c.cleanSheets === 1 ? '' : 's'}` : ''}`;
    return `<div class="sp-det" style="--sp-accent:${accent || '#fff'}"><div class="sp-det-name">${esc(c.name)}</div>
      <div class="sp-det-line">${esc(c.club)}${c.club2 ? ' / ' + esc(c.club2) : ''} ${c.season}: ${season}${c.nat ? ' · ' + esc(c.nat) : ''}${c.provisional ? ' · provisional rating' : ''}</div>
      ${k ? `<div class="sp-det-grid cols-3"><span class="sp-det-stat"><b>${k.a}</b><i>PL GAMES</i></span><span class="sp-det-stat"><b>${k.g}</b><i>PL GOALS</i></span><span class="sp-det-stat"><b>${k.n}</b><i>SEASONS</i></span></div>
      <div class="sp-det-clubs"><span>Premier League ${yrs}</span>${k.c.map((n) => `<b>${esc(n)}</b>`).join('')}</div>` : ''}</div>`;
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
