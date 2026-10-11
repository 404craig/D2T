// The historic table: the real final table revealed top to bottom, then every club reset to zero.
(function () {
  const D2T = window.D2T, SE = D2T.se;
  // ---------- table screen: the real final table revealed top to bottom, then reset to zero ----------
  D2T.screen('table', {
    title: 'Historic table', theme: 'black',
    mount(root) {
      const ctx = SE.ensure(), data = ctx.data, club = data.club, me = club.name;
      SE.accent(root, club); SE.setStep(ctx, 'table');
      const mine = data.table.find((r) => r.name === me);
      const zone = data.table.length - (D2T.game.S().relegationPlaces || 3);   // last safe place
      const relegated = mine.pos > zone, dream = D2T.game.mode() === 'dare2dream';
      root.appendChild(D2T.topbar());
      const body = D2T.h(`<div class="screen-body se-table-screen">
        <div class="se-clubhead">
          <img class="se-clubcrest" src="${club.crest}" alt="">
          <div class="se-clubtext"><div class="se-kicker">Your club</div><h1 class="se-h1">${D2T.esc(club.name)}</h1><div class="se-season">${data.season}</div></div>
        </div>
        <div class="se-tablelabel"><span class="se-tl-a">Real final table ${data.season}</span><span class="se-tl-b" aria-live="polite"></span></div>
        <div class="se-table" role="table" aria-label="Premier League ${data.season}">${SE.tableHead()}
          ${data.table.map((r) => SE.rowHTML(r, me, 'se-hid' + (r.pos === zone ? ' se-zone' : ''))).join('')}
        </div>
        <p class="se-note se-fin">${D2T.esc(club.name)} finished ${D2T.ordinal(mine.pos)} on ${mine.pts} points${relegated ? ' and went down' : ''}. ${dream ? (mine.pos === 1 ? 'Your dream: win it again.' : `Your dream: ${D2T.ordinal(D2T.game.target(mine.pos))} or better.`) : 'Now it is your turn.'}</p>
        <div class="se-pad"></div>
      </div>`);
      const flash = D2T.h('<div class="se-newseason" aria-hidden="true"><span>New season</span></div>');
      const bar = D2T.h('<footer class="actionbar"><button class="btn se-btn se-btn-ghost se-wide" type="button">Skip</button></footer>');
      root.append(body, flash, bar);
      const btn = bar.querySelector('button');
      const tbl = body.querySelector('.se-table');
      const rowsEl = () => [...tbl.querySelectorAll('.se-tr:not(.se-th)')];
      let gen = 0, done = false, cam = null, alive = true;
      this._kill = () => { alive = false; gen++; cam && cam.stop(); };

      const finish = (rebuild = true) => { // final state: zeroed and alphabetical, my row highlighted
        gen++; done = true; cam && cam.stop();
        if (rebuild) {
        const sorted = [...data.table].sort((a, b) => a.name.localeCompare(b.name));
        rowsEl().forEach((el) => el.remove());
        sorted.forEach((r, i) => {
          const el = D2T.h(SE.rowHTML(Object.assign({}, r, { pos: i + 1, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }), me, (i === zone - 1 ? 'se-zone' : '') + (r.name === me ? ' se-landed' : '')));
          tbl.appendChild(el);
        });
        }
        body.classList.add('se-reset');
        body.querySelector('.se-tl-a').textContent = `${data.season} · New season`;
        body.querySelector('.se-tl-b').textContent = 'Everyone starts on 0.';
        body.querySelector('.se-fin').textContent = dream && mine.pos === 1 ? `Real finish: champions on ${mine.pts} points. Do it again.` : `Real finish: ${D2T.ordinal(mine.pos)}, ${mine.pts} points. Beat it.`;
        btn.textContent = 'Continue'; btn.classList.remove('se-btn-ghost');
        const myEl = tbl.querySelector('.se-me');
        if (myEl && rebuild) { const sr = body.getBoundingClientRect(), r = myEl.getBoundingClientRect(); body.scrollTop += r.top - sr.top - body.clientHeight * 0.45; }
      };

      btn.onclick = () => {
        if (!done) { finish(true); return; }
        ctx.st.tableSeen = true; ctx.st.step = 'squad'; D2T.save(); D2T.go('squad');
      };

      const run = async () => {
        const g = ++gen, ok = () => alive && g === gen;
        const els = rowsEl();
        const stopAt = els.findIndex((el) => el.dataset.name === me);
        if (D2T.reduced()) {
          els.forEach((el) => el.classList.remove('se-hid'));
          els[stopAt].classList.add('se-landed');
          await D2T.wait(1800); if (!ok()) return;
          finish(); return;
        }
        await D2T.wait(450); if (!ok()) return;
        cam = SE.follow(body);
        // Tenaball's scan, reversed: start at 1st and run down to my club, fast at first and slowing into my result.
        const N = stopAt + 1;
        for (let i = 0; i < N; i++) {
          els.forEach((e) => e.classList.remove('se-scan'));
          const el = els[i];
          el.classList.remove('se-hid'); el.classList.add('se-build', 'se-scan');
          cam.to(el);
          if (i === stopAt) break;
          const t = N > 1 ? i / (N - 1) : 1;
          await D2T.wait(38 + 520 * Math.pow(t, 2.8)); if (!ok()) return;
        }
        const myEl = els[stopAt];
        myEl.classList.add('se-stop');
        await D2T.wait(900); if (!ok()) return;
        myEl.classList.remove('se-scan', 'se-stop');
        myEl.classList.add('se-landed', 'se-thump');
        tbl.classList.add('se-shake');
        els.slice(stopAt + 1).forEach((el, k) => { el.classList.remove('se-hid'); el.classList.add('se-build'); el.style.animationDelay = (k * 70) + 'ms'; });
        body.querySelector('.se-fin').classList.add('se-in');
        await D2T.wait(1700); if (!ok()) return;
        tbl.classList.remove('se-shake');

        // Reset: every number rolls down to 0 together, then the table flattens to alphabetical.
        flash.classList.add('se-go');
        body.querySelector('.se-tl-a').textContent = `${data.season} · New season`;
        const nums = [...tbl.querySelectorAll('.se-n')];
        const from = nums.map((n) => +n.dataset.v);
        const t0 = performance.now(), dur = 1300;
        await new Promise((res) => {
          const step = (now) => {
            if (!ok()) return res();
            const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
            nums.forEach((n, i) => { const v = Math.round(from[i] * (1 - e)); if (n.textContent !== String(v)) n.textContent = v; });
            if (p < 1) requestAnimationFrame(step); else res();
          };
          requestAnimationFrame(step);
        });
        if (!ok()) return;
        body.classList.add('se-reset');
        await D2T.wait(350); if (!ok()) return;
        const before = SE.rects(els);
        const sorted = [...els].sort((a, b) => a.dataset.name.localeCompare(b.dataset.name));
        sorted.forEach((el, i) => { tbl.appendChild(el); el.classList.remove('se-zone', 'se-build', 'se-thump'); el.style.animationDelay = ''; el.querySelector('.se-pos').textContent = i + 1; if (i === zone - 1) el.classList.add('se-zone'); });
        SE.flip(sorted, before, { duration: 900, stagger: 18, easing: 'cubic-bezier(.65,0,.25,1)' });
        cam.to(myEl);
        body.querySelector('.se-tl-b').textContent = 'Everyone starts on 0.';
        await D2T.wait(1300); if (!ok()) return;
        flash.classList.remove('se-go');
        finish(false);
      };
      if (ctx.st.tableSeen) finish(true); else run();
    },
    unmount() { this._kill && this._kill(); }
  });
})();
