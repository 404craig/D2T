// Intro (green): the short D2T logo in black, then the emblem spins 360 while D2T opens into DROP2TOP,
// then the slogan beat, then the logo glides to the top as the green gives way to black and the logo turns white,
// handing over to the black home screen. Plays every time the game is freshly loaded (tap to skip).
// Geometry is measured from the logo PNGs (all cropped to content):
//   short.png 857x241: emblem at (-2,1) 239x242, short_text at (240,38) 617x160
//   long.png 1301x237: emblem at (0,0) 234x237, long_text at (233,41) 1068x143
// Letters are cut out of the text masks with slanted clip-paths (the cuts follow the italic gaps).
(function () {
  const SHORT = { w: 857, h: 241, emb: [-2, 1, 239, 242], txt: [240, 38, 617, 160] };
  const LONG = { w: 1301, h: 237, emb: [0, 0, 234, 237], txt: [233, 41, 1068, 143] };
  // clip polygons in % of the text box (top x, bottom x of each slanted cut)
  const cutPoly = (a, b) => `polygon(${a[0]}% 0, ${b[0]}% 0, ${b[1]}% 100%, ${a[1]}% 100%)`;
  const S0 = [0, 0], S1 = [39.38, 28.2], S2 = [69.04, 60.62], SE = [100, 100];
  const L0 = [0, 0], L1 = [16.95, 11.89], L3 = [53.18, 47.94], L4 = [65.73, 61.8], L5 = [78.09, 68.63], LE = [100, 100];
  // letter centres and glyph heights in each text image's own pixels
  const SL = { D: [113.5, 80, 159], two: [298, 79.5, 159], T: [517.5, 79.5, 159] };
  const LL = { D: [82.5, 72, 132], two: [604.5, 71, 142], T: [755.5, 72.5, 133] };
  const SLOGAN = 'DO YOU HAVE WHAT IT TAKES TO TAKE A TEAM FROM THE DROP TO THE TOP?';

  let anims = [], timers = [], done = false, cleanup = null;

  const anim = (el, kf, o) => { const a = el.animate(kf, Object.assign({ fill: 'forwards' }, o)); anims.push(a); return a; };

  D2T.screen('intro', {
    title: 'Intro', theme: 'green',
    mount(root) {
      done = false; anims = []; timers = [];
      root.insertAdjacentHTML('beforeend', D2T.greenBackdrop());
      const wrap = D2T.h('<div class="fr-intro" role="button" aria-label="Skip intro"><div class="fr-stage"></div><button class="fr-skip" type="button">Skip</button></div>');
      root.appendChild(wrap);
      const stage = wrap.querySelector('.fr-stage');
      const vw = root.clientWidth, vh = root.clientHeight;

      // layouts in screen px
      const WS = Math.min(vw * 0.8, 340), kS = WS / SHORT.w, HS = SHORT.h * kS;
      const WL = vw * 0.75, kL = WL / LONG.w, HL = LONG.h * kL;
      const sx = (vw - WS) / 2, sy = vh / 2 - HS / 2 - 10;
      const lx = (vw - WL) / 2, ly = vh / 2 - HL / 2 - 10;

      // only the short logo is in the page ahead of the intro; the other pictures arrive a moment later, well before
      // the open-up needs them, and D2T.introArt puts them on their pieces
      const art = [];
      const setArt = (el, k) => { const u = `url('${D2T.ASSET[k]}')`; el.style.webkitMaskImage = u; el.style.maskImage = u; };
      const putArt = (el, k) => { if (String(D2T.ASSET[k]).startsWith('data:')) setArt(el, k); else art.push([el, k]); return el; };
      D2T.introArt = () => { art.splice(0).forEach(([el, k]) => setArt(el, k)); };
      const piece = (k, x, y, w, h, extra = '') => {
        const el = D2T.h(`<span class="fr-piece" aria-hidden="true" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${extra}"></span>`);
        stage.appendChild(el); return putArt(el, k);
      };
      // the whole short logo (exact artwork) for the opening hold
      const shortWhole = piece('short', sx, sy, WS, HS);
      // pieces for the open-up
      const E0 = { x: sx + SHORT.emb[0] * kS, y: sy + SHORT.emb[1] * kS, w: SHORT.emb[2] * kS, h: SHORT.emb[3] * kS };
      const E1 = { x: lx, y: ly, w: LONG.emb[2] * kL, h: LONG.emb[3] * kL };
      const emb = piece('emblem', E1.x, E1.y, E1.w, E1.h, 'opacity:0');
      const st = { x: sx + SHORT.txt[0] * kS, y: sy + SHORT.txt[1] * kS, w: SHORT.txt[2] * kS, h: SHORT.txt[3] * kS };
      const lt = { x: lx + LONG.txt[0] * kL, y: ly + LONG.txt[1] * kL, w: LONG.txt[2] * kL, h: LONG.txt[3] * kL };
      const sPiece = (a, b) => piece('shortText', st.x, st.y, st.w, st.h, `clip-path:${cutPoly(a, b)};opacity:0`);
      const lPiece = (a, b) => piece('longText', lt.x, lt.y, lt.w, lt.h, `clip-path:${cutPoly(a, b)};opacity:0`);
      const sD = sPiece(S0, S1), s2 = sPiece(S1, S2), sT = sPiece(S2, SE);
      const lD = lPiece(L0, L1), lROP = lPiece(L1, L3), l2 = lPiece(L3, L4), lT = lPiece(L4, L5), lOP = lPiece(L5, LE);
      const longWhole = piece('long', lx, ly, WL, HL, 'opacity:0');

      // slogan (characters wrapped per word so lines break between words); "DROP TO THE TOP?" always has a line of its own
      const slogan = D2T.h('<p class="fr-slogan anim" aria-label="Do you have what it takes to take a team from the drop to the top?"></p>');
      const word = (w) => {
        const rev = w === 'DROP' || w === 'TOP?';
        const core = rev ? w.replace('?', '') : w;
        const chars = [...core].map((c) => `<span class="fr-c">${c}</span>`).join('');
        const inner = rev ? `<span class="fr-rev"><i class="fr-rev-bg"></i>${chars}</span>${w.endsWith('?') ? '<span class="fr-c">?</span>' : ''}` : chars;
        return `<span class="fr-w" aria-hidden="true">${inner}</span>`;
      };
      const words = SLOGAN.split(' '), cut = words.indexOf('DROP');
      slogan.innerHTML = words.slice(0, cut).map(word).join(' ') + '<br><span class="fr-sl2">' + words.slice(cut).map(word).join(' ') + '</span>';
      wrap.appendChild(slogan);
      // shrink the type if the last line would not fit the width
      const line2 = slogan.querySelector('.fr-sl2');
      for (let fs = 31; fs > 18 && line2.getBoundingClientRect().width > slogan.clientWidth; fs--) slogan.style.fontSize = fs - 1 + 'px';

      // the slogan sits exactly in the middle of the screen; the logo waits just above it
      const slH = slogan.getBoundingClientRect().height;
      const slTop = (vh - slH) / 2;
      slogan.style.top = slTop + 'px';
      const beatY = Math.max(24, slTop - 34 - HL);
      const beatShift = beatY - ly;

      const skipBtn = wrap.querySelector('.fr-skip');
      skipBtn.classList.add('on'); // Skip is there from the first frame, every load (Craig, 12 Oct)

      const finish = (to) => {
        if (done) return; done = true;
        D2T.whenReady(() => { D2T.go('home', { fromIntro: to || true }); setTimeout(() => D2T.loadClips && D2T.loadClips(), 1200); D2T.loadReveal && D2T.loadReveal(); });   // the rest may still be arriving; the clips are read once home is up
      };
      wrap.addEventListener('click', () => finish(null));

      const centreOf = (box, img, L) => ({ x: box.x + L[0] * (box.w / img), y: box.y + L[1] * (box.w / img) });

      // The whole intro is scheduled on its first frame as one timeline of transform and opacity animations (Craig, 15 Oct:
      // it must start within 200 ms). Those run on the phone's compositor, so they keep playing smoothly while the main
      // thread is still reading the rest of the page (9 MB of game data): what native apps do with their launch animation.
      // Nothing waits on a timer or the page; only the hand-over to home (and Skip) waits for the game to be ready.
      const at = (el, prop, v, delay) => anim(el, [{ [prop]: v }, { [prop]: v }], { duration: 1, delay });   // a step at a set time
      const later = (fn, ms) => timers.push(setTimeout(() => { if (!done) fn(); }, ms));
      // where the home logo will sit, measured from a hidden copy of the home header (its CSS is in the head)
      const probe = D2T.h(`<div class="fr-home" aria-hidden="true" style="position:absolute;left:0;right:0;top:0;visibility:hidden;pointer-events:none"><div class="fr-home-top"><span class="fr-home-logo" style="display:block">${D2T.logo('long')}</span></div></div>`);
      probe.querySelector('.logo-mask').style.removeProperty('--src');   // only its size is wanted, and the picture may not be in yet
      wrap.appendChild(probe);
      const target = () => { const r = probe.querySelector('.logo-mask').getBoundingClientRect(), rr = root.getBoundingClientRect(); return { left: r.left - rr.left, top: r.top - rr.top, width: r.width }; };
      // the fonts load alongside: fit the slogan again once they are in
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (done) return; slogan.style.fontSize = ''; for (let fs = 31; fs > 18 && line2.getBoundingClientRect().width > slogan.clientWidth; fs--) slogan.style.fontSize = fs - 1 + 'px'; });

      function play() {
        if (D2T.reduced()) {
          // keep the result, skip the motion: long logo plus slogan, then home
          shortWhole.style.opacity = 0; longWhole.style.opacity = 1;
          longWhole.style.transform = `translateY(${beatShift}px)`;
          slogan.classList.remove('anim');
          later(() => finish(null), 2200);
          return;
        }
        // 1. the short logo arrives
        anim(shortWhole, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
        const T1 = 950;
        // 2. open up: the emblem spins 360 and shrinks into place, the D2T letters slide apart, ROP and OP appear
        later(() => { window.D2TSound && window.D2TSound.play('intro'); }, T1);   // only heard if sound is already awake
        at(shortWhole, 'opacity', 0, T1);
        const D = 1150, ease = 'cubic-bezier(.65,0,.25,1)';
        const ec0 = { x: E0.x + E0.w / 2, y: E0.y + E0.h / 2 }, ec1 = { x: E1.x + E1.w / 2, y: E1.y + E1.h / 2 };
        anim(emb, [
          { opacity: 1, transform: `translate(${ec0.x - ec1.x}px,${ec0.y - ec1.y}px) scale(${E0.w / E1.w}) rotate(0deg)` },
          { opacity: 1, transform: 'translate(0,0) scale(1) rotate(360deg)' }
        ], { duration: D, delay: T1, easing: ease });
        const pairs = [[sD, lD, 'D'], [s2, l2, 'two'], [sT, lT, 'T']];
        pairs.forEach(([se, le, k]) => {
          const cs = centreOf(st, SHORT.txt[2], SL[k]), cl = centreOf(lt, LONG.txt[2], LL[k]);
          const r = (LL[k][2] * kL) / (SL[k][2] * kS);
          se.style.transformOrigin = `${cs.x - st.x}px ${cs.y - st.y}px`;
          le.style.transformOrigin = `${cl.x - lt.x}px ${cl.y - lt.y}px`;
          anim(se, [
            { transform: 'none', opacity: 1 },
            { transform: `translate(${(cl.x - cs.x) * 0.4}px,${(cl.y - cs.y) * 0.4}px) scale(${1 + (r - 1) * 0.4})`, opacity: 1, offset: 0.38 },
            { transform: `translate(${(cl.x - cs.x) * 0.85}px,${(cl.y - cs.y) * 0.85}px) scale(${1 + (r - 1) * 0.85})`, opacity: 0, offset: 0.62 },
            { transform: `translate(${cl.x - cs.x}px,${cl.y - cs.y}px) scale(${r})`, opacity: 0 }
          ], { duration: D, delay: T1, easing: ease });
          anim(le, [
            { transform: `translate(${cs.x - cl.x}px,${cs.y - cl.y}px) scale(${1 / r})`, opacity: 0 },
            { transform: `translate(${(cs.x - cl.x) * 0.6}px,${(cs.y - cl.y) * 0.6}px) scale(${1 + (1 / r - 1) * 0.6})`, opacity: 0, offset: 0.38 },
            { transform: `translate(${(cs.x - cl.x) * 0.15}px,${(cs.y - cl.y) * 0.15}px) scale(${1 + (1 / r - 1) * 0.15})`, opacity: 1, offset: 0.62 },
            { transform: 'none', opacity: 1 }
          ], { duration: D, delay: T1, easing: ease });
        });
        // the missing letters emerge from behind D and 2 with a little motion blur
        [[lROP, 0.42], [lOP, 0.5]].forEach(([el, a]) => {
          anim(el, [
            { opacity: 0, transform: `translateX(${-WL * 0.08}px)`, filter: 'blur(4px)' },
            { opacity: 0, transform: `translateX(${-WL * 0.08}px)`, filter: 'blur(4px)', offset: a },
            { opacity: 1, transform: 'none', filter: 'blur(0)' }
          ], { duration: D, delay: T1, easing: 'cubic-bezier(.3,.7,.2,1)' });
        });
        // swap the pieces for the exact long artwork (same box, pixel aligned)
        const T2 = T1 + D + 60;
        at(longWhole, 'opacity', 1, T2);
        [emb, sD, s2, sT, lD, lROP, l2, lT, lOP].forEach((e) => at(e, 'opacity', 0, T2));

        // 3. slogan beat: the logo glides up, the line types in left to right, DROP and TOP reversed out
        const T3 = T2 + 380;
        anim(longWhole, [{ transform: 'none' }, { transform: `translateY(${beatShift}px)` }], { duration: 640, delay: T3, easing: 'cubic-bezier(.5,0,.2,1)' });
        const T4 = T3 + 360;
        const chars = [...slogan.querySelectorAll('.fr-c')];
        const step = 19;
        chars.forEach((c, i) => {
          anim(c, [{ opacity: 0, transform: 'translateX(-5px)' }, { opacity: 1, transform: 'none' }], { duration: 160, delay: T4 + i * step, easing: 'ease-out' });
          const rev = c.parentElement.classList.contains('fr-rev') && c.previousElementSibling && c.previousElementSibling.classList.contains('fr-rev-bg');
          if (rev) anim(c.previousElementSibling, [{ transform: 'skewX(-10deg) scaleX(0)' }, { transform: 'skewX(-10deg) scaleX(1)' }], { duration: 260, delay: T4 + i * step - 30, easing: 'cubic-bezier(.2,.8,.2,1)' });
        });

        // 4. hand over: the slogan lifts away, then the logo glides up and shrinks into the home header while the
        // green gives way to black and the logo turns from black to white as green light ripples through it.
        const T5 = T4 + chars.length * step + 1250;
        anim(slogan, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 260, delay: T5, easing: 'ease-in' });
        anim(skipBtn, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: T5 });
        const T6 = T5 + 240;
        const to = target(), from = { x: lx, y: ly + beatShift, w: WL, h: HL };
        const fx = D2T.h(`<span class="fr-ihand fr-tb-m" aria-hidden="true" style="left:${from.x}px;top:${from.y}px;width:${from.w}px;height:${from.h}px;opacity:0"><i class="w"></i><i class="k"></i><i class="s"></i></span>`);
        stage.appendChild(putArt(fx, 'long'));
        const black = D2T.h('<div class="fr-iblack" aria-hidden="true"></div>');
        wrap.insertBefore(black, stage);
        at(longWhole, 'opacity', 0, T6);
        at(fx, 'opacity', 1, T6);
        later(() => D2T.chrome('#000000', '#000000'), T6);
        anim(black, [{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: T6, easing: 'cubic-bezier(.5,0,.3,1)' });
        anim(fx, [{ transform: 'none' }, { transform: `translate(${to.left - from.x}px,${to.top - from.y}px) scale(${to.width / from.w})` }], { duration: 1000, delay: T6, easing: 'cubic-bezier(.6,0,.2,1)' });
        anim(fx.querySelector('.k'), [{ opacity: 1 }, { opacity: 0 }], { duration: 620, delay: T6 + 220, easing: 'ease-in-out' });
        anim(fx.querySelector('.s'), [{ transform: 'translateX(-60%)' }, { transform: 'translateX(40%)' }], { duration: 1100, delay: T6 + 120, easing: 'cubic-bezier(.4,0,.3,1)' });
        // home takes over once the hand-over has landed and the game is ready, whichever is later
        later(() => finish(to), T6 + 1150);
      }
      play();
      cleanup = () => { done = true; anims.forEach((a) => { try { a.cancel(); } catch (e) {} }); timers.forEach(clearTimeout); };
    },
    unmount() { cleanup && cleanup(); }
  });
})();
