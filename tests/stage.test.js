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
  check((await onShow()) === "daily", "home does not open on the Daily Challenge");
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

  // ---------- reduced motion, and a short phone ----------
  const calm = await open({ reducedMotion: "reduce" });
  const moving = await calm.evaluate(() => [...document.querySelectorAll(".stg *")].filter((e) => { const a = getComputedStyle(e).animationName; return a && a !== "none"; }).length);
  check(moving === 0, `with reduced motion ${moving} things still move on the stage`);
  await calm.close();
  const small = await open({ viewport: { width: 375, height: 667 } });
  check(await small.evaluate(() => { const b = document.querySelector(".stg-bar").getBoundingClientRect(), s = document.querySelector('.stg-sl[data-id="daily"] .stg-st').getBoundingClientRect(), d = document.querySelector(".stg-dots").getBoundingClientRect(); return s.bottom <= d.top + 2 && d.bottom <= b.top && b.bottom <= innerHeight; }), "on a 375x667 phone the shields, dots and button overlap");
  await small.screenshot({ path: path.join(OUT, "75-stage-small.png") });
  await small.close();

  await browser.close();
  const all = fails.concat(errors);
  if (all.length) { console.log("FAIL\n" + all.join("\n")); process.exit(1); }
  console.log("ok: the stage (six games, arrows, keys, swipe, loop, rules, account), a run going in every mode with New game and Continue, Tenaball, reduced motion, a short phone");
})().catch((e) => { console.log("ERR", e.stack || e.message); process.exit(1); });
