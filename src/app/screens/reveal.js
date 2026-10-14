// The rare card reveal (Craig, 13 Oct; design/prototype/rare-reveal-v3.html). A purple or legend card in a player roll
// does not land on its own: its reel slows, the screen darkens, glass smashes out of the middle in the card's colours and
// the big card fades in, then its six numbers pop in, the rating rolls down onto its number, the flag and the crest burst
// on and the name prints letter by letter. It holds for 3 seconds and shrinks back into its slot. D2T.roll.mount drives
// the reels (cfg.rare); this file only plays the reveal over the app: D2T.rareReveal.play({ host, slot, card, land })
// returns { done, kill }. land() is called as the card arrives in its slot. Glass is Craig's one exception to the no
// glass rule. The clips are files fetched after home (D2TSound.loadReveal); if they are not in yet it plays silently.
(function () {
  const D2T = window.D2T = window.D2T || {};
  const LVC = { legend: ['#FF6900', '#FFD36E', '#FF2882', '#EBFF00', '#ffffff'], baller: ['#B48CFF', '#6A2EE8', '#05F0FF', '#FF2882', '#ffffff'] };
  const isRare = (c) => !!c && (c.level === 'baller' || c.level === 'legend');
  const R = Math.random;

  function play(o) {
    const host = o.host, c = o.card, slot = o.slot, SND = window.D2TSound;
    const S = (id, opt) => (SND && SND.reveal ? SND.reveal(id, opt) : null);
    // the small clips went through the mock-up's 0.8 output; the glass, crowd and fireworks skip the top cut
    const snd = (id, g, rate = 1, lp = 0) => S(id, { gain: g * 0.8, rate, lp });
    let dead = false, shards = [], glassOn = false, crowd = null;
    const timers = new Set(), rafs = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms); timers.add(id); };
    const wait = (ms) => new Promise((res) => later(res, ms));
    const frame = (f) => { const id = requestAnimationFrame((t) => { rafs.delete(id); if (!dead) f(t); }); rafs.add(id); };
    const tween = (ms, f) => new Promise((res) => { const t0 = performance.now(); const st = (now) => { const u = Math.min(1, (now - t0) / ms); f(u); if (u < 1) frame(st); else res(); }; frame(st); });

    const ov = D2T.h('<div class="rr-ov" aria-hidden="true"><div class="rr-dim"></div><canvas></canvas><div class="rr-flash"></div><span class="rr-ring"></span><div class="rr-badge"></div></div>');
    // Skip (Craig, 14 Oct): bottom right like the intro's; it lands the card in its slot at once
    const skipBtn = D2T.h('<button class="rr-skip" type="button">Skip</button>');
    ov.appendChild(skipBtn);
    skipBtn.addEventListener('click', (e) => { e.stopPropagation(); skip(); });
    host.appendChild(ov);
    const cv = ov.querySelector('canvas'), cx = cv.getContext('2d'), K = Math.min(2, window.devicePixelRatio || 1);
    const crowdOff = (fade) => { if (!crowd) return; crowd.forEach((h) => h && h.stop(fade)); crowd = null; };

    // ---------- 3D glass: plates, long splinters and tiny bits in the card's colours ----------
    const shard = (x, y, a, v, pts, cols, life) => ({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: a + Math.PI / 2 * (R() < 0.5 ? 0 : 1), vr: (R() - 0.5) * 0.16, flip: R() * 6, vf: 0.05 + R() * 0.12, pts, c1: cols[(R() * cols.length) | 0], c2: cols[(R() * cols.length) | 0], life: 1, d: life });
    const shatter = (x, y, scale, cols) => {
      for (let i = 0, n = Math.round(90 * scale); i < n; i++) {
        const a = R() * Math.PI * 2, v = 3 + R() * 9, r = 8 + R() * 30, k = 3 + ((R() * 3) | 0), pts = [];
        for (let j = 0; j < k; j++) { const t = (j / k) * Math.PI * 2 + R() * 0.8; pts.push([Math.cos(t) * r * (0.4 + R() * 0.8), Math.sin(t) * r * (0.4 + R() * 0.8) * 0.6]); }
        shards.push(shard(x, y, a, v, pts, cols, 0.004 + R() * 0.005));
      }
      for (let i = 0, n = Math.round(40 * scale); i < n; i++) {
        const a = R() * Math.PI * 2, L = 50 + R() * 170, w = 4 + R() * 14, v = 4 + R() * 10;
        const s = shard(x, y, a, v, [[-w * 0.5, L * 0.5], [w * 0.5, L * 0.42], [w * 0.15, -L * 0.5]], cols, 0.004 + R() * 0.004); s.rot = a + Math.PI / 2; s.vr *= 0.3; shards.push(s);
      }
      for (let i = 0, n = Math.round(200 * scale); i < n; i++) {
        const a = R() * Math.PI * 2, r = 1.5 + R() * 3.5, v = 5 + R() * 15;
        shards.push(shard(x, y, a, v, [[-r, -r * 0.6], [r, -r * 0.3], [r * 0.5, r], [-r * 0.8, r * 0.5]], cols, 0.006 + R() * 0.008));
      }
      if (!glassOn) { glassOn = true; frame(glass); }
    };
    function glass() {
      cx.clearRect(0, 0, cv.width, cv.height); shards = shards.filter((g) => g.life > 0);
      for (const g of shards) {
        g.x += g.vx; g.y += g.vy; g.vx *= 0.992; g.vy *= 0.992; g.vy += 0.02; g.rot += g.vr; g.flip += g.vf; g.life -= g.d;
        const fl = Math.cos(g.flip), light = Math.abs(Math.sin(g.flip));     // it narrows as it turns and catches the light on its edge
        cx.save(); cx.translate(g.x * K, g.y * K); cx.rotate(g.rot); cx.scale(K, K * (0.15 + 0.85 * Math.abs(fl))); cx.globalAlpha = Math.min(1, g.life * 1.4);
        cx.beginPath(); g.pts.forEach(([px, py], j) => (j ? cx.lineTo(px, py) : cx.moveTo(px, py))); cx.closePath();
        const gr = cx.createLinearGradient(-30, -60, 30, 60);
        gr.addColorStop(0, `rgba(255,255,255,${0.25 + light * 0.6})`); gr.addColorStop(0.3, g.c1 + 'CC'); gr.addColorStop(0.75, g.c2 + '88'); gr.addColorStop(1, 'rgba(255,255,255,.15)');
        cx.fillStyle = gr; cx.fill();
        cx.lineWidth = 0.9; cx.strokeStyle = `rgba(255,255,255,${0.45 + light * 0.5})`; cx.stroke();
        if (g.pts.length === 3 && light > 0.55) { cx.beginPath(); cx.moveTo(g.pts[0][0] * 0.6, g.pts[0][1] * 0.6); cx.lineTo(g.pts[2][0] * 0.6, g.pts[2][1] * 0.6); cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = 0.7; cx.stroke(); }
        cx.restore();
      }
      cx.globalAlpha = 1;
      if (shards.length) frame(glass); else { glassOn = false; cx.clearRect(0, 0, cv.width, cv.height); }
    }
    const popIn = (el, ms) => { el.classList.add('in'); el.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.55 }, { transform: 'scale(1)', opacity: 1 }], { duration: ms, easing: 'cubic-bezier(.3,1.1,.5,1)' }); return wait(ms); };

    // the crest: light rays turning behind it, two shockwaves, its own glass, a spin and a flare, a thud as it lands
    const crestBlast = async (el, at, cols, ms) => {
      const par = el.parentElement, wrap = D2T.h('<span class="rr-blast"><span class="rr-rays"></span><span class="rr-sw"></span><span class="rr-sw b"></span></span>');
      par.style.position = 'relative'; par.insertBefore(wrap, el);
      wrap.style.cssText = `left:${el.offsetLeft + el.offsetWidth / 2}px;top:${el.offsetTop + el.offsetHeight / 2}px;--ms:${ms}ms`;
      shatter(at[0], at[1], 0.55, cols);
      for (let i = 0; i < 3; i++) later(() => shatter(at[0], at[1], 0.15, cols), 260 + i * 260);
      el.classList.add('in');
      el.animate([{ transform: 'scale(0) rotate(-35deg)', opacity: 0, filter: 'brightness(3)' }, { transform: 'scale(1.2) rotate(6deg)', opacity: 1, filter: 'brightness(1.8)', offset: 0.45 },
        { transform: 'scale(.94) rotate(-2deg)', filter: 'brightness(1.2)', offset: 0.7 }, { transform: 'scale(1) rotate(0)', opacity: 1, filter: 'brightness(1)' }], { duration: ms, easing: 'cubic-bezier(.25,1,.5,1)' });
      later(() => snd('thud_low', 1, 0.85), ms * 0.42);
      await wait(ms); later(() => wrap.remove(), 800);
    };

    async function run() {
      const ph = host.getBoundingClientRect();
      cv.width = Math.round(ph.width * K); cv.height = Math.round(ph.height * K);
      const L = D2T.LV[c.level], cols = LVC[c.level];
      ov.style.setProperty('--lc', L.text);
      void ov.offsetWidth; ov.classList.add('on');
      const W = 270, H = W * 1.667, fx = (ph.width - W) / 2, fy = (ph.height - H) / 2 + 10, mx = ph.width / 2, my = fy + H / 2;
      await wait(420);                                            // the screen darkens, the reel still crawling under it
      slot.classList.add('rr-hidden');
      const big = D2T.h(`<div class="rr-big rr-blank">${D2T.cards.player(c, { w: W, shine: false })}</div>`); ov.appendChild(big);
      big.style.setProperty('--glow', L.glow.replace(/\d+px/, '30px'));
      const place = (x, y, s) => { big.style.transform = `translate(${x}px,${y}px) scale(${s})`; };
      // the glass smashes out of the centre with a flash and a ring; the crowd and fireworks come in half a second later
      const flash = ov.querySelector('.rr-flash'), ring = ov.querySelector('.rr-ring'), badge = ov.querySelector('.rr-badge');
      ring.style.left = mx + 'px'; ring.style.top = my + 'px';
      flash.classList.add('go'); ring.classList.add('go');
      shatter(mx, my, 3, cols);
      S('glass_smash', { gain: 0.25, lp: 3000, raw: true });
      later(() => { crowd = [S('crowd_long', { gain: 1.25, fadeIn: 0.3, raw: true }), S('fireworks_long', { gain: 1.6, fadeIn: 0.3, raw: true })]; }, 500);
      big.style.opacity = 0; place(mx, my, 0.001);
      await wait(500);                                            // then the card fades in from small to large
      await tween(900, (u) => { const e = 1 - Math.pow(1 - u, 3), k = Math.max(0.001, 0.15 + e * 0.85 + Math.sin(u * Math.PI) * 0.12);
        big.style.opacity = Math.min(1, u * 1.6); place(mx - W * k / 2, my - H * k / 2, k); });
      big.style.opacity = 1; place(fx, fy, 1);
      badge.textContent = c.level === 'legend' ? 'LEGEND' : 'PURPLE'; badge.style.top = (fy - 46) + 'px'; badge.classList.add('go');
      await wait(500);
      // the six numbers, one after the other under their labels: a swoosh in, a dull thud down
      for (const st of big.querySelectorAll('.d2c-stat b')) { snd('swoosh_up', 0.45, 1.15, 3000); popIn(st, 520); later(() => snd('thud_low', 0.55, 1.2, 1200), 300); await wait(400); }
      await wait(350);
      // the rating: higher numbers above roll down into place, ticking as each passes, then the last five tick in
      const ovr = big.querySelector('.d2c-ovr'), body = big.querySelector('.d2c-body'), br = body.getBoundingClientRect(), or = ovr.getBoundingClientRect(), cs = getComputedStyle(ovr);
      const lh = or.height, ovrN = Math.min(99, c.ovr), start = Math.max(40, ovrN - 40), nums = [];
      for (let n = ovrN + 2; n >= start; n--) nums.push(n <= 99 ? n : '');
      const roller = D2T.h('<div class="rr-roller"></div>');
      roller.style.cssText = `left:${or.left - br.left - 6}px;top:${or.top - br.top - lh}px;width:${or.width + 12}px;height:${lh * 3}px;font:${cs.font};color:${cs.color}`;
      roller.innerHTML = `<div class="rr-rs">${nums.map((n) => `<span style="height:${lh}px;line-height:${lh}px">${n}</span>`).join('')}</div>`;
      body.appendChild(roller);
      const rs = roller.firstElementChild, last = nums.length - 1, target = nums.indexOf(ovrN), fast = last - target - 5;
      const at = (pos) => { rs.style.transform = `translateY(${(-(last - pos) + 1) * lh}px)`; };
      let lastTick = -1;
      await tween(1600, (u) => { const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, sp = Math.sin(u * Math.PI), pos = e * fast; at(pos);
        rs.style.filter = sp > 0.15 ? `blur(${(sp * 3).toFixed(1)}px)` : '';
        if (Math.floor(pos) !== lastTick && (sp < 0.6 || Math.floor(pos) % 2 === 0)) { lastTick = Math.floor(pos); snd('tick_wood', 0.35 + (1 - sp) * 0.3, 1, 2200); } });
      rs.style.filter = '';
      for (let k = 1; k <= 5; k++) {
        const from = fast + k - 1, gap = [150, 200, 270, 360, 480][k - 1];
        snd('tick_wood', 0.65, 1, 2200);
        await tween(180, (u) => { const e = 1 - Math.pow(1 - u, 3) + Math.sin(u * Math.PI) * 0.08; at(from + e); });
        if (k === 5) snd('thud_low', 1); await wait(gap);
      }
      roller.remove(); ovr.classList.add('in');
      ['.d2c-pos', '.d2c-rule'].forEach((s) => { const e = big.querySelector(s); e && e.classList.add('in'); });
      // the flag (or the level word on a card with no flag), then the crest's own explosion
      const centre = (e) => { const r = e.getBoundingClientRect(); return [r.left - ph.left + r.width / 2, r.top - ph.top + r.height / 2]; };
      const flag = big.querySelector('.d2c-flag') || big.querySelector('.d2c-lvl'), crest = big.querySelector('.d2c-crest');
      if (flag) { shatter(...centre(flag), 0.3, cols); snd('swoosh_up', 0.3, 1, 2400); await popIn(flag, 840); }
      if (crest) await crestBlast(crest, centre(crest), cols, 1380);
      // the name, letter by letter, a dull tick each
      for (const e of [big.querySelector('.d2c-first'), big.querySelector('.d2c-last')]) {
        if (!e) continue;
        const t = e.textContent; e.textContent = ''; e.classList.add('in');
        for (const ch of t) { const s = document.createElement('span'); s.className = 'rr-ch'; s.textContent = ch; e.appendChild(s); if (ch.trim()) snd('tick_mech', 0.5, 0.8, 900); await wait(90); }
      }
      big.classList.remove('rr-blank');
      await wait(3000);
      // from its full size down into its place in the reel
      badge.classList.remove('go'); ov.classList.remove('on');
      const sr = slot.getBoundingClientRect(), hr = host.getBoundingClientRect(), to = { x: sr.left - hr.left, y: sr.top - hr.top, s: 114 / W };
      snd('swoosh_up', 0.3, 0.8, 2000);
      await tween(500, (u) => { const e = u * u * (3 - 2 * u); place(fx + (to.x - fx) * e, fy + (to.y - fy) * e, 1 + (to.s - 1) * e); });
      big.remove(); slot.classList.remove('rr-hidden');
      landNow(); snd('thud_low', 0.6, 1.1);
      crowdOff(1.5);                                              // the crowd and fireworks run to the very end, then fade
      await wait(300);
      kill(true);
    }
    let resolve, landed = false;
    const done = new Promise((r) => { resolve = r; });
    const landNow = () => { if (landed) return; landed = true; o.land && o.land(); };
    function skip() { if (dead) return; landNow(); kill(true); }
    function kill(finished) {
      if (dead) return; dead = true;
      timers.forEach(clearTimeout); timers.clear(); rafs.forEach(cancelAnimationFrame); rafs.clear();
      shards = []; ov.remove(); slot.classList.remove('rr-hidden');
      crowdOff(finished ? 1.5 : 0.3);
      if (finished) resolve();
    }
    run();
    return { done, kill: () => kill(false) };
  }

  D2T.rareReveal = { play, isRare };
})();
