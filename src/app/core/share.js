// D2T share cards (Craig, 13 Oct; design/prototype/share-cards.html): every game shares an image and a short message.
// One frame for all of them, drawn on a 1080 x 1350 canvas: the long logo in white at the top, the game's tag under it
// (a slanted pill in the mode's colour, dark text), the crest or mark faded large behind, the game's own content, and a
// dare band across the foot in the mode's colour (the dare over the link). The image is built ahead, so Share opens at
// once; Share falls back to the text, then to the clipboard, then to a sheet with the text to copy.
// D2T.share.build({ text, c, tag, ghost, imgs: {name: src}, draw(g, img, k), dare }) -> { text, file }
// D2T.share.send(sh)
(function () {
  const D2T = window.D2T;
  const W = 1080, H = 1350, BAND = 132, LINK = '404craig.github.io/D2T';
  const FONT = (w, px, italic) => `${italic ? 'italic ' : ''}${w} ${px}px 'Exo 2', sans-serif`;
  const load = (src) => new Promise((r) => { if (!src) { r(null); return; } const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  const svgSrc = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const rgba = (hex, a) => { const h = String(hex || '#FFFFFF').replace('#', ''), f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h, n = parseInt(f.slice(0, 6), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  // a small card's face stops, ink, text colour and word by level (core/cards.js)
  const LVC = { bronze: ['#F6D2AE', '#D99A66', '#A9653A', '#C8875A', '#2B1608', '#E3A577', 'BRONZE'], silver: ['#FFFFFF', '#DCE2E8', '#A8B2BD', '#D3D9DF', '#16202A', '#DCE2E8', 'SILVER'],
    gold: ['#FFF6C8', '#FFD95A', '#E3A814', '#F7CE4A', '#2A1B00', '#FFD95A', 'GOLD'], baller: ['#E4D2FF', '#A774FF', '#6A2EE8', '#8F5CFF', '#FFFFFF', '#B48CFF', 'BALLER'],
    legend: ['#FFD36E', '#FF6900', '#FF2882', '#FF6900', '#FFFFFF', '#FF8A4C', 'LEGEND'] };
  const SHIELD = 'M1.77 10.23 L10.23 1.77 Q12 0 14.5 0 L99.5 0 Q102 0 103.77 1.77 L112.23 10.23 Q114 12 114 14.5 L114 127 Q114 130 111.14 130.9 L60.81 146.8 Q57 148 53.19 146.8 L2.86 130.9 Q0 130 0 127 L0 14.5 Q0 12 1.77 10.23Z';

  // ---------- drawing helpers, all centred unless given an x ----------
  function kit(g) {
    const spaced = (on) => { if ('letterSpacing' in g) g.letterSpacing = on || '0px'; };
    // text at the largest size up to px that fits maxW
    const size = (text, maxW, w, px, italic, ls) => {
      spaced(ls);
      let s = px; g.font = FONT(w, s, italic);
      while (s > 12 && g.measureText(text).width > maxW) { s -= 2; g.font = FONT(w, s, italic); }
      return s;
    };
    const fit = (text, x, y, maxW, w, px, italic, color, align = 'center', ls) => {
      const s = size(text, maxW, w, px, italic, ls);
      g.textAlign = align; g.fillStyle = color; g.fillText(text, x, y);
      spaced(); return s;
    };
    // the capitals centred on cy (design session, 29 Oct: 'top' at a fixed offset left them low in the tag)
    const mid = (text, x, cy, maxW, w, px, italic, color, align = 'center', ls) => {
      size(text, maxW, w, px, italic, ls);
      g.textBaseline = 'alphabetic'; const m = g.measureText(text);
      g.textAlign = align; g.fillStyle = color; g.fillText(text, x, cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
      g.textBaseline = 'top'; spaced(); return m.width;
    };
    const width = (text, w, px, italic, ls) => { spaced(ls); g.font = FONT(w, px, italic); const v = g.measureText(text).width; spaced(); return v; };
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const box = (x, y, w, h, r, edge, fill) => { rr(x, y, w, h, r); g.fillStyle = fill || '#0E0E10'; g.fill(); g.lineWidth = 3; g.strokeStyle = edge || '#222226'; g.stroke(); };
    const wrap = (text, x, y, maxW, w, px, color, lh) => {
      g.font = FONT(w, px); g.textAlign = 'center'; g.fillStyle = color;
      let line = '', yy = y;
      text.split(' ').forEach((wd) => { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); yy += lh; line = wd; } else line = t; });
      if (line) g.fillText(line, x, yy);
    };
    // a crest (or mark) inside a square, kept in proportion
    const pic = (im, cx, top, size, alpha = 1) => {
      if (!im) return;
      const r = Math.min(size / im.naturalWidth, size / im.naturalHeight), w = im.naturalWidth * r, h = im.naturalHeight * r;
      g.globalAlpha = alpha; g.drawImage(im, cx - w / 2, top + (size - h) / 2, w, h); g.globalAlpha = 1;
    };
    // the club block: crest, name, season line
    const club = (im, name, season) => {
      pic(im, W / 2, 290, 200);
      fit(String(name).toUpperCase(), W / 2, 510, 960, 900, 80, true, '#FFFFFF');
      fit(season, W / 2, 598, 960, 600, 42, false, '#BDBDC6');
    };
    // two halves: what they did against what you did
    const duo = (l, lv, ls, r, rv, rs, rc) => {
      box(90, 668, 900, 270, 26);
      g.fillStyle = '#222226'; g.fillRect(538, 671, 3, 264);
      [[l, lv, ls, '#FFFFFF', 315], [r, rv, rs, rc, 765]].forEach(([a, b, c, col, x]) => {
        fit(a, x, 696, 400, 800, 34, false, '#8E8E99', 'center', '3px');
        fit(b, x, 738, 420, 900, 128, true, col);
        fit(c, x, 874, 400, 600, 36, false, '#BDBDC6');
      });
    };
    // the game's tag: a slanted pill in its colour, the label centred on it
    const tag = (label, y, colour) => {
      label = String(label).toUpperCase();
      const pw = Math.min(900, width(label, 900, 40, true, '2px')) + 60, ph = 62, x = (W - pw) / 2;
      g.save(); g.translate(W / 2, y + ph / 2); g.transform(1, 0, -0.176, 1, 0, 0); g.translate(-W / 2, -(y + ph / 2));
      rr(x, y, pw, ph, 12); g.fillStyle = colour; g.fill(); g.restore();
      mid(label, W / 2, y + ph / 2, 900, 900, 40, true, '#0A0A0A', 'center', '2px');
    };
    // a small card in its level's colours: rating, broad position, crest, surname (p: { r, lv, p, name }, im: its crest)
    const card = (x, y, w, p, im) => {
      const L = LVC[p.lv] || LVC.bronze, s = w / 114;
      g.save(); g.translate(x, y); g.scale(s, s);
      const gr = g.createLinearGradient(0, 0, 114, 148); gr.addColorStop(0, L[0]); gr.addColorStop(0.35, L[1]); gr.addColorStop(0.7, L[2]); gr.addColorStop(1, L[3]);
      g.fillStyle = gr; g.fill(new Path2D(SHIELD)); g.restore();
      const sur = String(p.name || '').trim().split(' ').slice(1).join(' ') || String(p.name || '');
      fit(String(p.r), x + w * 0.29, y + w * 0.13, w * 0.4, 900, w * 0.32, true, L[4]);
      fit(String(p.p || ''), x + w * 0.29, y + w * 0.50, w * 0.4, 800, w * 0.13, false, L[4]);
      pic(im, x + w * 0.73, y + w * 0.14, w * 0.32);
      fit(sur.toUpperCase(), x + w / 2, y + w * 0.80, w * 0.86, 900, w * 0.16, true, L[4]);
    };
    // a football, drawn (no emoji)
    const ball = (cx, cy, r) => {
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = '#FFFFFF'; g.fill(); g.lineWidth = r * 0.09; g.strokeStyle = '#0A0A0A'; g.stroke();
      const pent = (px, py, pr, rot) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = rot + i * 2 * Math.PI / 5; g.lineTo(px + pr * Math.cos(a), py + pr * Math.sin(a)); } g.closePath(); g.fillStyle = '#0A0A0A'; g.fill(); };
      pent(cx, cy, r * 0.36, -Math.PI / 2);
      g.save(); g.beginPath(); g.arc(cx, cy, r * 0.96, 0, 7); g.clip();
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; pent(cx + r * 0.95 * Math.cos(a), cy + r * 0.95 * Math.sin(a), r * 0.3, a + Math.PI / 2); }
      g.restore();
    };
    // a hand-drawn red cross (Craig, 29 Oct; design/prototype/daily-share.html): a quadratic stroke drawn as a filled
    // shape tapering to fine ends, T its widest; cross() lays a long flat stroke over a steeper doubled one, edge = a black
    // outline for light backgrounds
    const tstroke = (x0, y0, cx, cy, x1, y1, T, col) => {
      const n = 48, L = [], R = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, u = 1 - t, x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
        const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy), l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        const w = T * (0.18 + 0.82 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.55)) / 2;
        L.push([x + nx * w, y + ny * w]); R.push([x - nx * w, y - ny * w]);
      }
      g.beginPath(); L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); R.reverse().forEach(([x, y]) => g.lineTo(x, y)); g.closePath(); g.fillStyle = col; g.fill();
    };
    const cross = (cx, cy, w, h, edge, col = '#FF4D52') => {
      const S = [[cx - w * 0.5, cy - h * 0.22, cx, cy + h * 0.02, cx + w * 0.5, cy + h * 0.3, 12], [cx - w * 0.4, cy + h * 0.5, cx - w * 0.02, cy + h * 0.06, cx + w * 0.42, cy - h * 0.5, 8], [cx - w * 0.34, cy + h * 0.6, cx + w * 0.04, cy + h * 0.18, cx + w * 0.46, cy - h * 0.36, 6]];
      g.save();
      if (edge) S.forEach(([a, b, c, d, e, f, T]) => { g.save(); g.strokeStyle = '#0A0A0A'; g.lineWidth = 2.5; g.lineJoin = 'round'; tstroke(a, b, c, d, e, f, T, '#0A0A0A'); g.stroke(); g.restore(); });
      S.forEach(([a, b, c, d, e, f, T]) => tstroke(a, b, c, d, e, f, T, col));
      g.restore();
    };
    return { fit, mid, width, rr, box, wrap, pic, club, duo, tag, card, ball, tstroke, cross, LVC, W, H };
  }

  function build(o) {
    const out = { text: o.text, file: null, done: false };
    D2T.share.last = out;   // the last card built (tests read it)
    try {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'); g.textBaseline = 'top';
      const srcs = Object.assign({ logo: D2T.ASSET && D2T.ASSET.long, ghost: o.ghost }, o.imgs || {});
      const keys = Object.keys(srcs);
      const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      Promise.all([ready].concat(keys.map((k) => load(srcs[k])))).then(([, ...ims]) => {
        const img = {}; keys.forEach((k, i) => { img[k] = ims[i]; });
        const k = kit(g), v2 = !!o.wash;
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        // the new frame (the Daily since build 161, design/prototype/daily-share.html): a wash of the club's colour at the top
        if (v2) { const lg = g.createLinearGradient(0, 0, 0, 720); lg.addColorStop(0, rgba(o.wash, 0x55 / 255)); lg.addColorStop(0.45, rgba(o.wash, 0x1A / 255)); lg.addColorStop(1, rgba(o.wash, 0)); g.fillStyle = lg; g.fillRect(0, 0, W, 720); }
        if (img.ghost) k.pic(img.ghost, W / 2, v2 ? 150 : 170, 1040, o.ghostAlpha || (v2 ? 0.09 : 0.13));
        // the long logo in white
        if (img.logo) {
          const lw = 640, lh = lw * img.logo.naturalHeight / img.logo.naturalWidth, t = document.createElement('canvas'); t.width = lw; t.height = lh;
          const tg = t.getContext('2d'); tg.drawImage(img.logo, 0, 0, lw, lh); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#fff'; tg.fillRect(0, 0, lw, lh);
          g.drawImage(t, (W - lw) / 2, (v2 ? 40 : 70) + (110 - lh) / 2);
        }
        // the game's tag: a slanted pill in its colour, the label centred on it
        if (o.tag) k.tag(o.tag, v2 ? 168 : 212, o.c);
        o.draw(g, img, k);
        // the dare band; the new frame has no link on the picture and leaves black under the band (WhatsApp's caption
        // covers the foot)
        if (o.dare && v2) { const B = 1176, BH = 110; g.fillStyle = o.band || o.c; g.fillRect(0, B, W, BH); k.mid(o.dare.toUpperCase(), W / 2, B + BH / 2, 980, 900, 50, true, o.ink || '#0A0A0A'); }
        else if (o.dare) {
          g.fillStyle = o.c; g.fillRect(0, H - BAND, W, BAND);
          k.fit(o.dare.toUpperCase(), W / 2, H - BAND + 22, 1000, 900, 50, true, '#0A0A0A');
          g.globalAlpha = 0.75; k.fit(LINK, W / 2, H - BAND + 82, 1000, 700, 30, false, '#0A0A0A'); g.globalAlpha = 1;
        }
        out.canvas = c;
        c.toBlob((b) => { if (b) out.file = new File([b], 'drop2top.png', { type: 'image/png' }); out.done = true; }, 'image/png');
      });
    } catch (e) { /* text only */ }
    return out;
  }

  async function send(sh) {
    try {
      if (sh.file && navigator.canShare && navigator.canShare({ files: [sh.file] })) { await navigator.share({ files: [sh.file], text: sh.text }); return; }
      if (navigator.share) { await navigator.share({ text: sh.text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(sh.text); D2T.sheet({ title: 'Copied', body: '<p class="fr-lead">Your result is copied. Paste it into the group chat.</p>' }); }
    catch (e) { D2T.sheet({ title: 'Your result', body: `<p class="fr-lead" style="white-space:pre-line;user-select:text;-webkit-user-select:text">${D2T.esc(sh.text)}</p>` }); }
  }

  D2T.share = { build, send, svgSrc, LINK, W, H };
})();
