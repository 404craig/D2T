// The Transfer News bar in the January window (Craig, 1 Nov, build 220, via the design session): before the first spin
// it sits centred in the gap between the pitch and the bottom bar, as the Summer one does (tests/ui.test.js checks that
// one), on a tall and a short phone. Needs Playwright's Chromium and the page served at http://localhost:8765 (or BASE).
const { chromium } = require(process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright");
const BASE = process.env.BASE || "http://localhost:8765/";
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log("FAIL: " + msg); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[390, 844], [390, 700], [320, 640]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(BASE + "?v=test");
    await p.waitForFunction(() => location.hash.includes("home") && window.D2T && window.D2T.game, null, { timeout: 30000 });
    // a Classic run played on to the January window, its raid due and the window's sheet already seen
    const ok = await p.evaluate(() => {
      const G = window.D2T.game; G.newRun("classic"); G.chooseClub(G.offer()[0].key); window.D2T.state.run.tableSeen = true;
      if (G.eng().phase === "setup") G.startSeason();
      for (let i = 0; i < 400; i++) {
        const e = G.eng(), jr = G.janRaid();
        if (e.phase === "window" && jr && jr.gw === e.gw) { window.D2T.state.run.janIntro = true; window.D2T.save(); window.D2T.go("transfer"); return true; }
        if (e.phase === "summary") return false;
        if (e.phase === "window") G.pass(); else { G.play(); G.afterMatch(); }
      }
      return false;
    });
    check(ok, `${w}x${h}: never reached the January window with its raid`);
    if (!ok) { await ctx.close(); continue; }
    // from the moment it shows, the box never moves (Craig, 2 Nov, build 223: it came in about 15px low and snapped up)
    await p.evaluate(() => { window.__nbTops = []; const t0 = performance.now(); const f = () => { const n = document.querySelector(".se-news"); if (n && !n.classList.contains("se-nb-wait")) window.__nbTops.push(n.getBoundingClientRect().top); if (performance.now() - t0 < 9000) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await p.waitForSelector(".se-news:not(.se-nb-wait)", { timeout: 15000 }).catch(() => {});
    await wait(2500);
    const tops = await p.evaluate(() => window.__nbTops);
    check(tops.length > 10 && Math.max(...tops) - Math.min(...tops) <= 1, `${w}x${h}: the news box moved after it appeared: ${tops.length ? Math.round(Math.min(...tops)) + " to " + Math.round(Math.max(...tops)) : "never seen"}`);
    const g = await p.evaluate(() => {
      const n = document.querySelector(".se-news"), f = document.querySelector(".tr-field"), b = document.querySelector(".sp-screen .game-bar");
      if (!n || !f || !b) return null;
      const r = n.getBoundingClientRect();
      const v = n.querySelector(".se-nb-view").getBoundingClientRect(), words = [...n.querySelectorAll(".se-nb-text .w")], c = n.querySelector(".se-nb-crest");
      return { above: r.top - f.getBoundingClientRect().bottom, below: b.getBoundingClientRect().top - r.bottom, flow: n.classList.contains("se-news-flow"),
        inset: [Math.round(r.left), Math.round(innerWidth - r.right)], fits: words.every((x) => x.getBoundingClientRect().right <= v.right + 0.5),
        lines: new Set(words.map((x) => Math.round(x.getBoundingClientRect().top))).size, crest: !!c && !c.hidden && c.getBoundingClientRect().width === 44,
        dots: n.querySelectorAll(".se-nb-count i").length, kind: n.querySelector(".se-nb-kind").textContent };
    });
    check(g && Math.abs(g.above - g.below) <= 4 && g.above > 0 && g.below > 0, `${w}x${h}: the January news bar should be centred between the pitch and the bottom bar: ${JSON.stringify(g)}`);
    // option F (Craig, 2 Nov, build 222): a box inset 16px, the buying club's crest, no dots for the one January raid,
    // Rumour or Done deal, and the headline on two lines that fit, even on a 320px phone
    check(g && g.inset[0] === 16 && g.inset[1] === 16, `${w}x${h}: the news box should sit 16px in from each side: ${JSON.stringify(g && g.inset)}`);
    check(g && g.crest && g.dots === 0 && /rumour|done deal/i.test(g.kind), `${w}x${h}: the box should show the crest, Rumour or Done deal, and no dots in January: ${JSON.stringify(g)}`);
    check(g && g.fits && g.lines <= 2, `${w}x${h}: the headline should fit on two lines: ${JSON.stringify(g)}`);
    check(!errs.length, `${w}x${h}: page errors: ` + errs.join(" | "));
    await ctx.close();
  }
  await browser.close();
  if (fails) { console.log(`${fails} check(s) failed`); process.exit(1); }
  console.log("ok: the January Transfer News bar sits centred between the pitch and the bottom bar on a tall, a short and a 320px phone, inset 16px with the crest and the headline fitting");
})();
