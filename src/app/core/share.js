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

  // ---------- drawing helpers, all centred unless given an x ----------
  function kit(g) {
    const spaced = (on) => { if ('letterSpacing' in g) g.letterSpacing = on || '0px'; };
    // text at the largest size up to px that fits maxW
    const fit = (text, x, y, maxW, w, px, italic, color, align = 'center', ls) => {
      spaced(ls);
      let s = px; g.font = FONT(w, s, italic);
      while (s > 12 && g.measureText(text).width > maxW) { s -= 2; g.font = FONT(w, s, italic); }
      g.textAlign = align; g.fillStyle = color; g.fillText(text, x, y);
      spaced(); return s;
    };
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
    return { fit, rr, box, wrap, pic, club, duo, W, H };
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
        const k = kit(g);
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        if (img.ghost) k.pic(img.ghost, W / 2, 170, 1040, o.ghostAlpha || 0.13);
        // the long logo in white
        if (img.logo) {
          const lw = 640, lh = lw * img.logo.naturalHeight / img.logo.naturalWidth, t = document.createElement('canvas'); t.width = lw; t.height = lh;
          const tg = t.getContext('2d'); tg.drawImage(img.logo, 0, 0, lw, lh); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#fff'; tg.fillRect(0, 0, lw, lh);
          g.drawImage(t, (W - lw) / 2, 70 + (110 - lh) / 2);
        }
        // the game's tag: a slanted pill in its colour
        if (o.tag) {
          const label = o.tag.toUpperCase();
          g.font = FONT(900, 40, true); if ('letterSpacing' in g) g.letterSpacing = '2px';
          const tw = Math.min(900, g.measureText(label).width), pw = tw + 60, ph = 62, x = (W - pw) / 2, y = 212;
          g.save(); g.translate(W / 2, y + ph / 2); g.transform(1, 0, -0.176, 1, 0, 0); g.translate(-W / 2, -(y + ph / 2));
          k.rr(x, y, pw, ph, 12); g.fillStyle = o.c; g.fill(); g.restore();
          g.fillStyle = '#0A0A0A'; g.textAlign = 'center'; g.fillText(label, W / 2, y + 13, 900);
          if ('letterSpacing' in g) g.letterSpacing = '0px';
        }
        o.draw(g, img, k);
        // the dare band
        if (o.dare) {
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
