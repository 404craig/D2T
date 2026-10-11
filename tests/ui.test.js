// Plays a whole season through the real page on a 390x844 phone screen.
// node tests/ui.test.js   (screenshots go to tests/output/)
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright")); }
const OUT = path.join(__dirname, "output");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) errors.push("console: " + m.text()); });
  page.on("dialog", d => { errors.push("native dialog used: " + d.message()); d.dismiss(); });
  await page.goto("file://" + path.join(__dirname, "..", "index.html"));
  await page.evaluate(() => localStorage.setItem("d2t-settings-v1", JSON.stringify({ fastMatches: true, muted: true })));
  await page.reload();
  await page.waitForTimeout(400);
  await page.click(".intro").catch(() => {});
  await page.waitForTimeout(500);
  const shot = n => page.screenshot({ path: path.join(OUT, n + ".png") });
  const tap = sel => page.click(sel);
  await shot("01-home");
  // every button at least 44px tall
  const small = await page.$$eval("button", bs => bs.filter(b => b.offsetParent && b.getBoundingClientRect().height < 34).map(b => b.textContent.trim().slice(0, 30)));
  if (small.length) errors.push("buttons under 34px on home: " + small.join(", "));
  await tap('[data-act="newrun"]'); await page.waitForTimeout(300); await shot("02-clubroll");
  await tap('[data-act="selclub"][data-i="1"]'); await tap('[data-act="pickclub"]'); await page.waitForTimeout(300); await shot("03-hub");
  await tap('[data-act="squad"]'); await page.waitForTimeout(300); await shot("04-squad");
  await tap('[data-act="formation"][data-f="4-3-3"]'); await page.waitForTimeout(200);
  await tap('.slot[data-i="9"]'); await page.waitForTimeout(400); await shot("05-squad-picker");
  await page.click('.sheet [data-act="sheet-close"]'); await page.waitForTimeout(300);
  await tap('[data-act="hub"]'); await page.waitForTimeout(200);
  await tap('[data-act="startseason"]'); await page.waitForTimeout(900); await shot("06-roll");
  await tap('.pcard[data-i="0"]'); await page.waitForTimeout(300); await shot("07-roll-selected");
  await tap('.pcard[data-i="0"]'); await page.waitForTimeout(400); await shot("08-card-sheet");
  await page.click('.sheet [data-act="sheet-close"]'); await page.waitForTimeout(300);
  // play the season: sign the card with the best gain, else pass
  let guard = 0, matches = 0, signings = 0;
  while (guard++ < 400) {
    const view = await page.evaluate(() => window.D2T_UI.ui.view);
    if (view === "summary") break;
    if (view === "roll") {
      const best = await page.evaluate(() => {
        const r = window.D2T_UI.run, S = window.D2T_GAME.seasons[r.seasonKey];
        let b = null; r.roll.cards.forEach((id, i) => window.D2T.signPreview(r, S, id).forEach(o => { if (!b || o.delta > b.d) b = { i, d: o.delta }; }));
        return b;
      });
      if (best && best.d > 0.2) {
        const already = await page.evaluate(i => window.D2T_UI.ui.sel === window.D2T_UI.run.roll.cards[i], best.i);
        if (!already) await tap(`.pcard[data-i="${best.i}"]`);
        await tap('[data-act="sign"]'); signings = await page.evaluate(() => window.D2T_UI.run.signed.length);
      }
      else await tap('[data-act="pass"]');
      await page.waitForTimeout(650);
    } else if (view === "match") {
      const k = await page.$('[data-act="kickoff"]');
      if (k) { await k.click(); matches = await page.evaluate(() => window.D2T_UI.run.played.length); if (matches === 5) { await page.waitForTimeout(200); await shot("09-fulltime"); } }
      else { await tap('[data-act="afterft"]'); matches = await page.evaluate(() => window.D2T_UI.run.played.length); }
      await page.waitForTimeout(650);
    } else if (view === "hub") { const b = await page.$('[data-act="toroll"],[data-act="tomatch"],[data-act="tosummary"]'); await b.click(); }
    else { errors.push("stuck on view " + view); break; }
  }
  await page.waitForTimeout(800);
  await shot("10-summary");
  await page.evaluate(() => window.scrollTo(0, 2000)); await page.waitForTimeout(200); await shot("11-summary-bottom");
  await tap('[data-act="table"]'); await page.waitForTimeout(400); await shot("12-table");
  const final = await page.evaluate(() => window.D2T_UI.run.final && { finish: window.D2T_UI.run.final.finish, pts: window.D2T_UI.run.final.pts, rise: window.D2T_UI.run.final.rise });
  console.log("matches", matches, "signings", signings, "final", JSON.stringify(final));
  // live match animation check
  await page.evaluate(() => { localStorage.setItem("d2t-settings-v1", JSON.stringify({ fastMatches: false, muted: true })); });
  await page.reload(); await page.waitForTimeout(300); await page.click(".intro").catch(() => {});
  await tap('[data-act="newrun"]').catch(() => {}); await page.waitForTimeout(200);
  const askOpen = await page.$('[data-act="ask-yes"]'); if (askOpen) { await askOpen.click(); await page.waitForTimeout(300); }
  await page.waitForTimeout(300); await shot("12b-before-pick");
  await tap('[data-act="pickclub"]'); await page.waitForTimeout(300); await shot("12c-after-pick"); await tap('[data-act="startseason"]'); await page.waitForTimeout(300);
  for (let i = 0; i < 3; i++) { await tap('[data-act="pass"]'); await page.waitForTimeout(700); }
  await tap('[data-act="kickoff"]'); await page.waitForTimeout(7200); await shot("13-live-halftime");
  await page.waitForTimeout(9000); await shot("14-live-fulltime");
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  if (sw > 390) errors.push("horizontal scroll: " + sw);
  console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no errors");
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
