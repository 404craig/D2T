// Home v2, the stage (Craig, 29 Oct): on a 390x844 phone, the wheel of six games in order from the Daily Challenge,
// turning by the arrows, the keys and a swipe; each game's art, shields and button; the ? sheet, Share and the
// account; then a run going in every mode (Daily, Classic, Club X, Goal Rush, Unbeaten), each splitting its button into
// New game and Continue, Continue going back into the run and New game asking first, then starting over; Tenaball
// opening in a new tab; reduced motion; and a short phone.
// node tests/stage.test.js   (screenshots go to tests/output/)
const path = require("path"), fs = require("fs");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright")); }
const OUT = path.join(__dirname, "output");
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.D2T_URL || "file://" + path.join(__dirname, "..", "index.html");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const fails = [], errors = [];
  const check = (ok, msg) => { if (!ok) fails.push(msg); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const open = async (opts = {}) => {
    const page = await browser.newPage(Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, opts));
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_NAME|net::/.test(m.text())) errors.push("console: " + m.text()); });
    page.on("dialog", (d) => { errors.push("native dialog used: " + d.message()); d.dismiss(); });
    await page.goto(URL); await wait(1500);
    await page.click(".fr-skip", { force: true }).catch(() => {}); await wait(2500);
    return page;
  };
  const page = await open();
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + ".png") });
  const scr = () => page.evaluate(() => document.querySelector(".screen").dataset.screen);
  const home = async () => { await page.evaluate(() => window.D2T.go("home")); await wait(900); };
  const onShow = () => page.evaluate(() => { const on = [...document.querySelectorAll(".stg-dots i")].findIndex((d) => d.classList.contains("on")); return document.querySelectorAll(".stg-sl")[on].dataset.id; });
  const toSlide = async (id) => { for (let k = 0; k < 6 && (await onShow()) !== id; k++) { await page.click(".stg-sw.r"); await wait(300); } await wait(700); };
  const bar = () => page.evaluate(() => [...document.querySelectorAll(".stg-bar button")].map((b) => b.dataset.act).join(","));

  // ---------- fresh ----------
  check((await scr()) === "home" && !!(await page.$(".stg")), "home is not the stage");
  const ids = await page.$$eval(".stg-sl", (s) => s.map((x) => x.dataset.id));
  check(ids.join(",") === "daily,classic,clubx,goal,ub,ten", "the wheel's games are not Daily, Classic, Club X, Goal Rush, Unbeaten, Tenaball: " + ids);
  check((await onShow()) === "classic", "home does not open on Classic after the intro");
  // the Daily takeover is tested on its own below: off here (the test switch)
  await page.evaluate(() => { window.D2T.state.dailyNudge = { off: true }; window.D2T.save(); });
  await page.keyboard.press("ArrowLeft"); await wait(900);
  check((await onShow()) === "daily", "the left arrow key did not turn from Classic to the Daily");
  check(!(await page.$(".fr-tabbar")) && !(await page.$('[data-go="league"]')), "the stage still has the tab bar");
  check(await page.$$eval(".stg-top .stg-rb", (b) => b.length === 3 && b.every((x) => x.getBoundingClientRect().width >= 44 && x.getBoundingClientRect().height >= 44)), "the top bar should have three round 44px buttons");
  check(await page.evaluate(() => { const r = document.querySelector(".stg-logo").getBoundingClientRect(); const b = document.querySelector(".stg-rb").getBoundingClientRect(); return r.left < 40 && r.width > 160 && r.height <= 44.5 && r.right < b.left; }), "the logo is not big and top left, clear of the buttons");
  check(await page.evaluate(() => document.querySelector('.stg-sl[data-id="daily"] .stg-hl').textContent === window.D2T.game.dailyEntry(window.D2T.game.today()).name + " " + window.D2T.game.dailyEntry(window.D2T.game.today()).season), "the Daily's headline is not today's club and season");
  check(await page.$$eval(".stg-sl", (s) => s.filter((x) => x.dataset.id !== "ten").every((x) => x.querySelectorAll(".stg-sh").length === 4) && !!document.querySelector('.stg-sl[data-id="ten"] .stg-tbb')), "every game but Tenaball should have four shields; Tenaball its board");
  check(await page.evaluate(() => getComputedStyle(document.querySelector(".stg-main")).backgroundColor !== "rgba(0, 0, 0, 0)" && /PLAY TODAY/i.test(document.querySelector(".stg-main").textContent)), "the Daily's button should read Play today");
  await shot("70-stage-daily");
  // turning: the arrow, the keys, a swipe, round the loop
  await page.click(".stg-sw.r"); await wait(900);
  check((await onShow()) === "classic", "the right arrow did not turn to Classic");
  check(await page.evaluate(() => /SPIN FOR A CLUB/i.test(document.querySelector(".stg-main").textContent) && getComputedStyle(document.querySelector(".stg-main")).backgroundColor === "rgb(201, 208, 217)"), "Classic's button should be silver and read Spin for a club");
  await shot("71-stage-classic");
  await page.keyboard.press("ArrowLeft"); await wait(900);
  check((await onShow()) === "daily", "the left arrow key did not turn back");
  await page.keyboard.press("ArrowLeft"); await wait(900);
  check((await onShow()) === "ten", "the wheel does not loop from the Daily back to Tenaball");
  check(await page.evaluate(() => document.querySelector(".stg-shr").disabled), "Share should be off on Tenaball");
  await page.mouse.move(300, 400); await page.mouse.down(); await page.mouse.move(200, 400, { steps: 6 }); await page.mouse.move(120, 400, { steps: 6 }); await page.mouse.up(); await wait(1200);
  check((await onShow()) === "daily", "a swipe left did not turn on to the next game (round the loop to the Daily)");
  // ? and account
  await page.click(".stg-q"); await wait(600);
  check(!!(await page.$(".sheet")) && /Daily Challenge/.test(await page.textContent(".sheet")), "? did not open the Daily's rules");
  await page.evaluate(() => { const s = document.querySelector(".sheet-scrim"); if (s) s.click(); }); await wait(600);
  await page.click(".stg-acct"); await wait(700);
  check((await scr()) === "account", "the account button did not open the account page");
  await home();
  for (const id of ["clubx", "goal", "ub"]) { await toSlide(id); await shot("72-stage-" + id); }

  // ---------- a run going in every mode ----------
  const play = (n) => page.evaluate((n) => { const G = window.D2T.game; window.D2T.state.run.tableSeen = true; while (G.inDraft && G.inDraft()) G.draftPick(G.rollCards()[0].id); if (G.eng().phase === "setup") G.startSeason(); let k = 0; for (let i = 0; i < 400 && k < n; i++) { const e = G.eng(); if (e.phase === "window") G.pass(); else { G.play(); G.afterMatch(); k++; } } window.D2T.save(); }, n);
  const split = async (id) => { await home(); await toSlide(id); return (await bar()) === "new,continue"; };
  const cont = async (id, want) => { await page.click(".stg-contg"); await wait(1800); const s = await scr(); check(want.includes(s), `${id}: Continue went to ${s}`); };
  const fresh = async (id, want) => { await page.click(".stg-newg"); await wait(600); check(!!(await page.$('.sheet [data-k="yes"]')), `${id}: New game did not ask first`); await page.click('.sheet [data-k="yes"]'); await wait(1800); const s = await scr(); check(want.includes(s), `${id}: New game went to ${s}`); };
  await page.evaluate(() => { const G = window.D2T.game; G.newRun("classic"); G.chooseClub(G.offer()[0].key); window.D2T.save(); }); await play(3);
  check(await split("classic"), "a Classic run did not split the button into New game and Continue");
  check(await page.$$eval(".stg-dots i.live", (d) => d.length === 0), "the page dots still carry a green run dot");
  await shot("73-stage-classic-going");
  await cont("classic", ["transfer", "fixtures", "squad"]);
  await home(); check((await onShow()) === "classic", "home did not come back on Classic after leaving a Classic run"); await toSlide("daily"); await page.click(".stg-main"); await wait(1800); check(["table", "squad"].includes(await scr()), "Play today did not start the Daily"); await play(2);
  check(await split("daily"), "a Daily go did not split the button"); await cont("daily", ["fixtures", "transfer", "squad"]);
  check(await split("classic"), "the Classic run was lost when the Daily started"); await cont("classic (parked)", ["transfer", "fixtures", "squad"]);
  await page.evaluate(() => { const G = window.D2T.game, st = window.D2T.state; G.stashDaily(); st.parked = st.run; st.run = null; G.newRun("clubx"); G.setXName("Southside Rovers"); const e = G.eng(); if (e.clubOffer) G.chooseClub(e.clubOffer[0]); window.D2T.save(); }); await play(2);
  check(await split("clubx"), "a Club X run did not split the button"); await cont("clubx", ["fixtures", "transfer", "squad"]);
  await home(); await toSlide("goal"); await page.click(".stg-main"); await wait(1500);
  const sk = await page.$(".g4-reveal"); if (sk) { await sk.click(); await wait(600); }
  await page.waitForFunction(() => !document.querySelector(".g4 .sp-main").disabled, null, { timeout: 15000 }); await page.click(".g4 .sp-main"); await page.waitForSelector(".g4 [data-c]", { timeout: 15000 }); await wait(2500);
  await page.click('.g4 [data-c="0"]'); await wait(150); await page.click('.g4 [data-c="0"]'); await wait(2500);
  check(await split("goal"), "a Goal Rush game did not split the button"); await cont("goal", ["goals433"]);
  await home(); await toSlide("ub"); await page.click(".stg-main"); await wait(1200);
  await page.click(".ub-spin"); await page.waitForFunction(() => document.querySelectorAll(".ub-ans:not([disabled])").length === 2, null, { timeout: 20000 }); await wait(400);
  await page.click(".ub-bar .is-home"); await wait(500); await page.click('.sheet [data-k="home"]'); await wait(1200);
  check(await split("ub"), "an Unbeaten run did not split the button");
  await shot("74-stage-ub-going");
  await cont("ub", ["unbeaten"]);
  await page.waitForFunction(() => document.querySelectorAll(".ub-ans:not([disabled])").length === 2, null, { timeout: 20000 }).catch(() => {});
  await page.click(".ub-bar .is-home"); await wait(500); await page.click('.sheet [data-k="home"]'); await wait(1200);
  await toSlide("ub"); await fresh("ub", ["unbeaten"]);
  check(await page.evaluate(() => !(window.D2T.state.ub && window.D2T.state.ub.run)), "Unbeaten's New game kept the old run");
  check(await split("goal"), "the Goal Rush game was lost"); await fresh("goal", ["goals433"]);
  check(await page.evaluate(() => (window.D2T.state.g433.filled || []).length === 0), "Goal Rush's New game kept the old game");
  check(await split("clubx"), "the Club X run was lost"); await fresh("clubx", ["spin"]);
  check(await split("daily"), "the Daily go was lost"); await fresh("daily", ["table", "squad"]);
  check(await split("classic"), "the Classic run was lost"); await fresh("classic", ["spin"]);
  await home(); await toSlide("ten");
  const [pop] = await Promise.all([page.waitForEvent("popup", { timeout: 4000 }).catch(() => null), page.click(".stg-main")]);
  check(pop && /404craig\.github\.io\/Tenaball/.test(pop.url()), "Tenaball did not open in a new tab");
  if (pop) await pop.close();

  // ---------- the Daily takes over the top bar (build 184) ----------
  {
    const dp = await open();
    const dShow = () => dp.evaluate(() => { const on = [...document.querySelectorAll(".stg-dots i")].findIndex((d) => d.classList.contains("on")); return document.querySelectorAll(".stg-sl")[on].dataset.id; });
    const dHome = async () => { await dp.evaluate(() => window.D2T.go("home")); await wait(900); };
    const dTo = async (id) => { for (let k = 0; k < 6 && (await dShow()) !== id; k++) { await dp.click(".stg-sw.r"); await wait(300); } await wait(500); };
    const shows = (ms) => dp.waitForSelector(".stg-top.dly-full", { timeout: ms }).then(() => true).catch(() => false);
    await dp.evaluate(() => { window.D2T.state.tips = Object.assign(window.D2T.state.tips || {}, { "stage-swipe": 1, "stage-help": 1, "stage-share": 1 }); delete window.D2T.state.dailyNudge; window.D2T.save(); });
    check((await dShow()) === "classic", "a fresh load did not open on Classic");
    await dTo("daily");
    check(!(await shows(8500)), "the Daily takeover showed on the Daily slide");
    await dp.evaluate(() => { window.D2T_DLY_GAP = 1500; });   // 40 s between plays, shortened for the test
    await dTo("classic");
    check(await shows(12000), "the Daily takeover never showed on Classic");
    await wait(700);
    check(await dp.evaluate(() => { const d = document.querySelector(".stg-dly").getBoundingClientRect(), r = document.querySelector(".stg-acct").getBoundingClientRect(); return Math.abs(d.height - 44) < 0.6 && Math.abs(d.top - r.top) < 0.6 && Math.abs(d.right - r.right) < 1; }), "the Daily bar is not 44px tall and in line with the buttons");
    check(await dp.evaluate(() => /Today's Daily Challenge/i.test(document.querySelector(".stg-dly").textContent) && /Play/.test(document.querySelector(".stg-dly-go").textContent)), "the Daily bar should say Today's Daily Challenge and Play");
    // the hand back never blinks (build 211): from the moment the bar goes, the logo parts and the three buttons stay at
    // opacity 1 on every frame for 600 ms
    const sampleEnd = () => dp.evaluate(() => { window.__dlyMin = null; const top = document.querySelector(".stg-top");
      const parts = () => [...top.querySelectorAll(".fr-hl-p, .stg-rb")];
      const go = () => { const t0 = performance.now(); let min = 1; const f = () => { parts().forEach((n) => { min = Math.min(min, +getComputedStyle(n).opacity); }); if (performance.now() - t0 < 600) requestAnimationFrame(f); else window.__dlyMin = min; }; f(); };
      // Chromium keeps the animated values through the change, so it never shows the blink Safari did; what it can check is
      // that the hand back runs with transitions off, so nothing can restart a fade from 0
      const mo = new MutationObserver(() => { if (!top.classList.contains("dly-on")) { mo.disconnect(); window.__dlySnap = parts().every((n) => getComputedStyle(n).transitionDuration.split(",").every((d) => parseFloat(d) === 0)); go(); } }); mo.observe(top, { attributes: true, attributeFilter: ["class"] }); });
    const endMin = async () => { await dp.waitForFunction(() => window.__dlyMin != null, null, { timeout: 15000 }).catch(() => {}); return dp.evaluate(() => (window.__dlySnap ? window.__dlyMin : 'transitions on: ' + window.__dlyMin)); };
    await sampleEnd();
    // the full bar holds 6 s (build 210): still there 5 s after it filled, gone by 8 s
    await wait(4300);
    check(!!(await dp.$(".stg-top.dly-full")), "the Daily bar did not hold for 6 s");
    await wait(3500);
    check(!(await dp.$(".stg-top.dly-on")), "the Daily bar did not go back after its hold");
    { const m = await endMin(); check(m === 1, `the top bar blinked as the Daily bar went back (lowest opacity ${m})`); }
    // no cap (build 210): with the gap shortened it plays a second and a third time on the same visit
    check(await shows(6000), "the Daily takeover did not play a second time");
    await dp.waitForSelector(".stg-top:not(.dly-on)", { timeout: 12000 }).catch(() => {});
    check(await shows(14000), "the Daily takeover did not play a third time on the same visit");
    // an interrupted one hands back at once, with no fade from 0 either
    await wait(600); await sampleEnd();
    await dp.evaluate(() => document.querySelector(".stg").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    { const m = await endMin(); check(m === 1, `the top bar blinked when a touch sent the Daily bar back (lowest opacity ${m})`); }
    check(await shows(14000), "the Daily takeover did not come back after a touch");
    await dp.evaluate(() => { delete window.D2T_DLY_GAP; });
    await dp.click(".stg-dly"); await wait(1200);
    check((await dShow()) === "daily", "a tap on the Daily bar did not turn the wheel to the Daily");
    await dp.click(".stg-q"); await wait(600);
    check(!!(await dp.$(".sheet")), "the ? button does not work after the Daily takeover");
    await dp.evaluate(() => { const s = document.querySelector(".sheet-scrim"); if (s) s.click(); }); await wait(600);
    // a Daily in progress: Carry on
    await dp.click(".stg-main"); await wait(1800); await dHome(); await dTo("classic");
    check(await shows(12000), "the Daily takeover did not show with a Daily in progress");
    check(await dp.evaluate(() => /Carry on/i.test(document.querySelector(".stg-dly-go").textContent) && /in progress/i.test(document.querySelector(".stg-dly-tx").textContent)), "with a Daily in progress the bar should say Carry on");
    // today's Daily done: never
    await dp.evaluate(() => { const G = window.D2T.game, st = window.D2T.state; st.record.daily = st.record.daily || {}; const d = G.dailyEntry(G.today()); st.record.daily[G.today()] = { n: G.dailyNumber(G.today()), club: d.name, season: d.season, mode: 'classic', finish: 9, histFinish: d.pos, rise: d.pos - 9, pts: 50, histPts: 30, goes: 1 }; window.D2T.save(); });
    await dHome(); await dTo("goal");
    check(!(await shows(9000)), "the Daily takeover showed after today's Daily was done");
    await dp.close();
  }

  // ---------- reduced motion, and a short phone ----------
  const calm = await open({ reducedMotion: "reduce" });
  const moving = await calm.evaluate(() => [...document.querySelectorAll(".stg *")].filter((e) => { const a = getComputedStyle(e).animationName; return a && a !== "none"; }).length);
  check(moving === 0, `with reduced motion ${moving} things still move on the stage`);
  await calm.close();
  const small = await open({ viewport: { width: 375, height: 667 } });
  check(await small.evaluate(() => { const b = document.querySelector(".stg-bar").getBoundingClientRect(), s = document.querySelector('.stg-sl[data-id="classic"] .stg-st').getBoundingClientRect(), d = document.querySelector(".stg-dots").getBoundingClientRect(); return s.bottom <= d.top + 2 && d.bottom <= b.top && b.bottom <= innerHeight; }), "on a 375x667 phone the shields, dots and button overlap");
  await small.screenshot({ path: path.join(OUT, "75-stage-small.png") });
  await small.close();

  await browser.close();
  const all = fails.concat(errors);
  if (all.length) { console.log("FAIL\n" + all.join("\n")); process.exit(1); }
  console.log("ok: the stage (six games, arrows, keys, swipe, loop, rules, account), a run going in every mode with New game and Continue, Tenaball, the Daily takeover, reduced motion, a short phone");
})().catch((e) => { console.log("ERR", e.stack || e.message); process.exit(1); });
