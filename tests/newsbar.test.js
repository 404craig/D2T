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
  for (const [w, h] of [[390, 844], [390, 700]]) {
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
    await p.waitForSelector(".se-news:not(.se-nb-wait)", { timeout: 15000 }).catch(() => {});
    await wait(600);
    const g = await p.evaluate(() => {
      const n = document.querySelector(".se-news"), f = document.querySelector(".tr-field"), b = document.querySelector(".sp-screen .game-bar");
      if (!n || !f || !b) return null;
      const r = n.getBoundingClientRect();
      return { above: r.top - f.getBoundingClientRect().bottom, below: b.getBoundingClientRect().top - r.bottom, flow: n.classList.contains("se-news-flow") };
    });
    check(g && Math.abs(g.above - g.below) <= 4 && g.above > 0 && g.below > 0, `${w}x${h}: the January news bar should be centred between the pitch and the bottom bar: ${JSON.stringify(g)}`);
    check(!errs.length, `${w}x${h}: page errors: ` + errs.join(" | "));
    await ctx.close();
  }
  await browser.close();
  if (fails) { console.log(`${fails} check(s) failed`); process.exit(1); }
  console.log("ok: the January Transfer News bar sits centred between the pitch and the bottom bar on a tall and a short phone");
})();
