// The leaderboards (Craig, 31 Oct) against a mocked server: the league table shield on the stage in every state (on the
// table, never played, signed out, the server missing or down), the leaderboard screen on six phone sizes (nothing
// overlaps, long names truncate, the list scrolls and your row sticks, the arrows and a swipe change game, every game
// opens on All time, the empty states read right), the guest's pinned row, and a finished game going up by run id.
// node tests/leaderboard.test.js   (screenshots go to tests/output/, or $LB_SHOTS)
const path = require("path"), fs = require("fs");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright")); }
const OUT = process.env.LB_SHOTS || path.join(__dirname, "output");
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.D2T_URL || "file://" + path.join(__dirname, "..", "index.html");
const SIZES = [[320, 568], [375, 667], [390, 844], [393, 852], [412, 915], [430, 932]];
const TOKEN = "a".repeat(64);

// ---------- the mocked server ----------
const NAMES = ["toffee_tom", "LaurenB", "MattyW", "gaffer_ali", "kop_kid", "Priya22", "jj_saints", "deano", "Hollie_9", "owen.k", "TashF", "Zak_Villa", "millsy", "boro_ben", "NinaB", "Ciaran", "RedDevilRuby"];
const COLS = { daily: [["Played", "Wins", "Best rise"], ["Goes", "Best finish", "Rise"]], classic: [["Seasons", "Titles", "Top 3"], ["Seasons", "Titles", "Top 3"]], clubx: [["Seasons", "Titles", "In a row"], ["Points", "Wins", "Goal diff"]], goal: [["Games", "Spot on", "Hit rate"], ["Games", "Spot on", "Closest"]], ub: [["Runs", "Best run", "Average"], ["Runs", "Best run", "Average"]] };
const TROPHY = { daily: [["Most Daily wins", "toffee_tom", "11 league titles from 21 Dailies"], ["First to win the league today", "LaurenB", "Bolton champions at 09:14, on the 2nd go"]], classic: [["The hardest title", "deano", "Won the league with Derby 2007/08 (11 pts for real)"], ["Most titles this week", "gaffer_ali", "4 titles this week, the best Burnley 2009/10 from 18th"]],
  clubx: [["The longest dynasty", "kop_kid", "9 titles in a row with Hollow Rovers"], ["Most points in a season", "deano", "104 points with Kirk United, season 6"]], goal: [["Most times spot on", "jj_saints", "Spot on 19 times in 210 games"], ["First spot on today", "jj_saints", "Spot on 433 at 08:41"]], ub: [["The record run", "LaurenB", "41 in a row on career goals"], ["Best run this week", "kop_kid", "23 in a row on club points in a season, Tuesday"]] };
const vals = (game, t, i) => game === "daily" ? (t ? [1 + i % 4, i < 6 ? "1st" : `${i}th`, "+" + (19 - i)] : [21 - i, 11 - Math.floor(i / 2), "+" + (19 - (i % 3))]) : game === "classic" ? [140 - 6 * i, 12 - Math.floor(i / 2), 31 - i] : game === "clubx" ? (t ? [104 - i, 34 - i, "+" + (81 - 3 * i)] : [25 - i, 17 - i, 9 - Math.floor(i / 2)]) : game === "goal" ? (t ? [6 + i, Math.max(0, 4 - i), i] : [210 - 9 * i, 19 - i, `${11 - (i % 5)}%`]) : [310 - 10 * i, 41 - 2 * i, (8.1 - i * 0.2).toFixed(1)];
// scenario: full (signed in, 23rd), top (signed in, 4th), today (the second tab empty), never (signed in, not on the table),
// out (signed out, would be 12th), outNone (signed out, nothing played), empty (nobody on any table)
function board(game, tab, sc) {
  const t = tab === "all" ? 0 : 1, cols = COLS[game][t], tr = TROPHY[game][t], signedIn = !/^out/.test(sc);
  const row = (pos, name, me) => ({ pos, name, v: vals(game, t, pos - 1), me: !!me });
  const out = { game, tab, cols, sort: game === "clubx" && t ? 0 : 1, signedIn, name: signedIn ? "You" : null, rows: [], me: null, count: 0, trophy: null };
  if (sc === "empty" || (sc === "today" && t)) return out;
  out.trophy = { title: tr[0], who: tr[1], val: "1", what: tr[2] };
  const top = NAMES.slice(0, 10).map((n, i) => row(i + 1, i === 3 && sc === "top" ? "You" : i === 1 ? "A very long player name that should truncate" : n, i === 3 && sc === "top"));
  out.rows = top; out.count = 214;
  if (sc === "top") { out.me = top[3]; out.rows.push({ gap: true }); }
  else if (sc === "full") { out.rows.push({ gap: true }, row(21, "Ciaran"), row(22, "millsy"), row(23, "You", true), row(24, "RedDevilRuby"), row(25, "NinaB"), { gap: true }); out.me = out.rows[13]; }
  else out.rows.push({ gap: true });
  if (sc === "out") out.you = { pos: 12, v: vals(game, t, 11) };
  if (sc === "outNone") out.you = null;
  return out;
}
const ME = { full: { pos: 23, count: 214 }, top: { pos: 4, count: 214 }, today: { pos: 23, count: 214 }, never: null, out: null, outNone: null, empty: null };
async function mock(page, sc, hits = []) {
  await page.route("**/api/d2t/**", (route) => {
    const u = route.request().url(), p = u.slice(u.indexOf("/api/d2t/") + 9);
    let body = {}; try { body = route.request().postDataJSON() || {}; } catch (e) { /* none */ }
    hits.push({ p, body });
    const H = { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: H });
    if (sc === "missing") return route.fulfill({ status: 404, headers: H, body: JSON.stringify({ error: "Not found" }) });
    if (sc === "down") return route.abort("failed");
    if (p === "me") return route.fulfill({ status: 200, headers: H, body: JSON.stringify(/^out/.test(sc) ? { signedIn: false, games: {} } : { signedIn: true, name: "You", games: { daily: ME[sc], classic: ME[sc], clubx: ME[sc], goal: ME[sc], ub: ME[sc] } }) });
    if (p === "board") return route.fulfill({ status: 200, headers: H, body: JSON.stringify(board(body.game, body.tab, sc)) });
    if (p === "merge" || p === "result") return route.fulfill({ status: 200, headers: H, body: JSON.stringify({ added: (body.results || [1]).length, refused: 0, games: {}, pos: { classic: { pos: 23, count: 214 } } }) });
    return route.fulfill({ status: 404, headers: H, body: "{}" });
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const fails = [], errors = [];
  const check = (ok, msg) => { if (!ok) fails.push(msg); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // a phone: signed in or out, with the server mocked for a scenario; opens past the intro on the stage
  const open = async (sc, { w = 390, h = 844, signedIn = !/^out/.test(sc), hits = [], fresh = false } = {}) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    page.on("pageerror", (e) => errors.push(`${sc} ${w}x${h} pageerror: ` + e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_NAME|net::|ERR_FAILED|status of 404/.test(m.text())) errors.push(`${sc} console: ` + m.text()); });
    page.on("dialog", (d) => { errors.push("native dialog used: " + d.message()); d.dismiss(); });
    await mock(page, sc, hits);
    const st = { tips: { "stage-swipe": 1, "stage-help": 1, "stage-share": 1 }, dailyNudge: { day: "9999-01-01", n: 6 } };
    if (signedIn) st.account = { signedIn: true, user: { id: "u1", name: "You", email: "you@example.com" }, token: TOKEN };
    if (!fresh) st.lb = { phone: "abc123", queue: [], sentFor: "u1", pos: {}, posAt: 0, ok: null };
    else st.record = { runs: [{ key: "2007/08:Derby", mode: "classic", season: "2007/08", club: "Derby", finish: 9, rise: 11, pts: 50, histFinish: 20, histPts: 11, drop: true, half: true, top3: false, title: false, at: "2026-10-20" }], clubs: {} };   // a record from before the tables
    await page.addInitScript((s) => { localStorage.setItem("d2t-v2", JSON.stringify(s)); window.D2T_SERVER_URL = "https://tenaball.crw84.workers.dev"; }, st);
    await page.goto(URL); await wait(1200);
    await page.click(".fr-skip", { force: true }).catch(() => {}); await wait(2200);
    return page;
  };
  const shot = (page, n) => page.screenshot({ path: path.join(OUT, n + ".png") });
  const onShow = (page) => page.evaluate(() => { const on = [...document.querySelectorAll(".stg-dots i")].findIndex((d) => d.classList.contains("on")); return document.querySelectorAll(".stg-sl")[on].dataset.id; });
  const toSlide = async (page, id) => { for (let k = 0; k < 6 && (await onShow(page)) !== id; k++) { await page.click(".stg-sw.r"); await wait(300); } await wait(700); };
  const scr = (page) => page.evaluate(() => document.querySelector(".screen").dataset.screen);
  const rect = (page, sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; });
  // the stage's shields on the slide on show: four, level, same size, and the league table shield's words
  const shields = (page) => page.evaluate(() => { const on = [...document.querySelectorAll(".stg-dots i")].findIndex((d) => d.classList.contains("on")), sl = document.querySelectorAll(".stg-sl")[on];
    const sh = [...sl.querySelectorAll(".stg-sh")].map((s) => { const r = s.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), lb: s.classList.contains("stg-lb"), n: s.querySelector("b").textContent, l: s.querySelector("span").innerHTML.replace(/<br>/g, " ").replace(/\s+/g, " ") }; });
    const st = sl.querySelector(".stg-st").getBoundingClientRect(), art = sl.querySelector(".stg-art").getBoundingClientRect(), dots = document.querySelector(".stg-dots").getBoundingClientRect(), bar = document.querySelector(".stg-bar").getBoundingClientRect();
    return { sh, fit: st.bottom <= dots.top + 2 && dots.bottom <= bar.top + 1 && bar.bottom <= innerHeight + 0.5 && art.height >= 109, art: Math.round(art.height), level: sh.every((s) => s.top === sh[0].top && s.h === sh[0].h && s.w === sh[0].w) }; });

  // ---------- home: the league table shield in every state, on every size ----------
  for (const [w, h] of SIZES) {
    const page = await open("full", { w, h });
    await wait(600);
    for (const id of ["daily", "classic", "clubx", "goal", "ub"]) {
      await toSlide(page, id);
      const s = await shields(page);
      check(s.sh.length === 4 && s.level, `${w}x${h} ${id}: the shields are not four and level: ${JSON.stringify(s.sh)}`);
      check(s.fit, `${w}x${h} ${id}: the stage does not fit (art ${s.art})`);
      const lb = s.sh[3];
      check(lb && lb.lb && lb.n === "23rd" && /LEAGUE TABLE/i.test(lb.l), `${w}x${h} ${id}: the league table shield should read 23rd / LEAGUE TABLE: ${JSON.stringify(lb)}`);
      const dropped = { daily: /PLAYED/i, classic: /TOP HALF/i, clubx: /TOP 3/i, goal: /LAST GAME/i, ub: /TOPICS/i }[id];
      check(!s.sh.some((x) => dropped.test(x.l)), `${w}x${h} ${id}: the dropped shield is still there`);
      if (w === 390 || w === 320) await shot(page, `lb-home-${id}-${w}x${h}`);
    }
    // the share card keeps the four record shields
    await toSlide(page, "classic");
    const four = await page.evaluate(() => { const g = document.querySelector('.stg-sl[data-id="classic"]'); return !!g; });
    check(four, `${w}x${h}: Classic slide missing`);
    await page.close();
  }
  {
    const page = await open("full");
    await toSlide(page, "classic"); await page.click(".stg-shr"); await wait(600);
    await page.click('.sheet [data-k="rec"]'); await wait(1500);
    const text = await page.evaluate(() => (window.D2T.share.last || {}).text || "");
    check(/Beat the drop .* · Top half .* · Top 3 .* · League titles/.test(text), "the record share should keep its four record shields: " + text);
    await page.evaluate(() => { const s = document.querySelector(".sheet-scrim"); if (s) s.click(); }); await wait(500);
    // tapping the shield opens the leaderboard on that game
    await toSlide(page, "goal"); await page.click('.stg-sl[data-id="goal"] .stg-lb', { force: true }); await wait(900);
    check((await scr(page)) === "leaderboard", "tapping the league table shield did not open the leaderboard");
    check(await page.evaluate(() => /GOAL RUSH/i.test(document.querySelector(".lb-gn b").textContent)), "the leaderboard did not open on Goal Rush");
    await page.close();
  }
  // never played: - / PLAY TO JOIN; signed out: - / SIGN IN TO JOIN (and the shield opens the account page)
  {
    const page = await open("never"); await toSlide(page, "classic");
    const s = await shields(page);
    check(s.sh[3].lb && s.sh[3].n === "-" && /PLAY TO JOIN/i.test(s.sh[3].l), "never played: the shield should read - / PLAY TO JOIN: " + JSON.stringify(s.sh[3]));
    await shot(page, "lb-home-never");
    await page.close();
    const out = await open("out"); await toSlide(out, "classic");
    const so = await shields(out);
    check(so.sh[3].lb && so.sh[3].n === "-" && /SIGN IN TO JOIN/i.test(so.sh[3].l), "signed out: the shield should read - / SIGN IN TO JOIN: " + JSON.stringify(so.sh[3]));
    await shot(out, "lb-home-signedout");
    await out.click('.stg-sl[data-id="classic"] .stg-lb', { force: true }); await wait(800);
    check((await scr(out)) === "account", "signed out, the shield should open the account page");
    await out.close();
  }
  // the server missing (404) or down: the four record shields, nothing broken; and the shields swap in once a fresh phone hears from the server
  for (const sc of ["missing", "down"]) {
    const page = await open(sc); await toSlide(page, "classic"); await wait(800);
    const s = await shields(page);
    check(s.sh.length === 4 && !s.sh.some((x) => x.lb) && /TOP HALF/i.test(s.sh[1].l), `server ${sc}: home should keep its four record shields: ` + JSON.stringify(s.sh.map((x) => x.l)));
    check(!(await page.$(".sheet")), `server ${sc}: something opened a sheet`);
    if (sc === "missing") await shot(page, "lb-home-server-missing");
    await page.close();
  }
  {
    const hits = [], page = await open("full", { fresh: true, hits });
    await wait(3500);                                            // the first sync runs 2.5 s after the game is up
    await toSlide(page, "classic");
    const s = await shields(page);
    check(s.sh[3] && s.sh[3].lb && s.sh[3].n === "23rd", "a fresh phone should swap in the league table shield once the server answers: " + JSON.stringify(s.sh));
    check(hits.some((x) => x.p === "merge") && hits.some((x) => x.p === "me"), "a fresh signed-in phone should send its records once and ask for its positions: " + hits.map((x) => x.p).join(","));
    await page.close();
  }

  // ---------- the leaderboard screen on every size ----------
  for (const [w, h] of SIZES) {
    const page = await open("full", { w, h });
    await page.evaluate(() => window.D2T.go("leaderboard", { game: "daily" })); await wait(900);
    const where = `${w}x${h}`;
    check((await scr(page)) === "leaderboard", `${where}: the leaderboard did not open`);
    // nothing overlaps: each fixed piece ends before the next starts, the bar sits at the foot
    const R = {}; for (const [k, sel] of [["top", ".lb-top"], ["head", ".lb-head"], ["game", ".lb-game"], ["tabs", ".lb-tabs"], ["trophy", ".lb-trophy"], ["cols", ".lb-cols"], ["list", ".lb-list"], ["bar", ".lb .actionbar"]]) R[k] = await rect(page, sel);
    const order = ["top", "head", "game", "tabs", "trophy", "cols", "list", "bar"];
    for (let i = 1; i < order.length; i++) check(R[order[i - 1]].bottom <= R[order[i]].top + 0.6, `${where}: ${order[i - 1]} (${Math.round(R[order[i - 1]].bottom)}) runs into ${order[i]} (${Math.round(R[order[i]].top)})`);
    check(R.bar.bottom <= h + 0.5 && R.list.height >= 120, `${where}: the bar is off the screen or the list is too short (${Math.round(R.list.height)}px)`);
    check(await page.$$eval(".lb-tabs [role=tab]", (t) => t.every((b) => b.scrollWidth <= b.clientWidth + 1)), `${where}: a tab label is cut`);
    check(await page.$eval(".lb-tt b", (b) => b.scrollWidth <= b.clientWidth + 1 || getComputedStyle(b).textOverflow === "ellipsis"), `${where}: the trophy holder is cut`);
    // the columns line up, the ranking column is in the game's colour
    const colX = await page.$$eval(".lb-cols .c-v", (c) => c.map((x) => Math.round(x.getBoundingClientRect().right)));
    const rowX = await page.$$eval(".lb-row:not(.me) .c-v", (c) => c.slice(0, 3).map((x) => Math.round(x.getBoundingClientRect().right)));
    check(colX.join() === rowX.join(), `${where}: the columns do not line up with their headers (${colX} v ${rowX})`);
    check(await page.$eval(".lb-cols .c-v.is-sort", (c) => getComputedStyle(c).color === "rgb(255, 255, 255)"), `${where}: the Daily's ranking column should be white`);
    // the long name truncates and the values stay in their columns
    const long = await page.$$eval(".lb-row", (rows) => { const r = rows.find((x) => /very long/.test(x.textContent)); if (!r) return null; const n = r.querySelector(".c-name"), v = [...r.querySelectorAll(".c-v")]; return { cut: n.scrollWidth > n.clientWidth && getComputedStyle(n).textOverflow === "ellipsis", inside: v.every((x) => x.getBoundingClientRect().right <= r.getBoundingClientRect().right + 0.5) }; });
    check(long && long.cut && long.inside, `${where}: the long name does not truncate (${JSON.stringify(long)})`);
    // gold, silver, bronze on the top three; your row in the game's colour, sticky to the bottom edge while out of view
    const medals = await page.$$eval(".lb-row .c-pos", (p) => p.slice(0, 3).map((x) => getComputedStyle(x).color));
    check(medals.join() === "rgb(255, 210, 31),rgb(217, 222, 229),rgb(227, 154, 91)", `${where}: the top three are not gold, silver and bronze: ${medals}`);
    // scrolled to the top: your row (23rd) is either naturally in view on a tall phone, or pinned to the bottom edge
    const sticky = await page.evaluate(() => { const l = document.querySelector(".lb-list"), me = l.querySelector(".lb-row.me"); l.scrollTop = 0; const lr = l.getBoundingClientRect(), mr = me.getBoundingClientRect();
      const nat = [...l.children].slice(0, [...l.children].indexOf(me)).reduce((t, x) => t + x.getBoundingClientRect().height, 0);
      return { scrolls: l.scrollHeight > l.clientHeight + 2, inView: nat + me.getBoundingClientRect().height <= l.clientHeight, pinned: Math.abs(mr.bottom - lr.bottom) < 1.5, colour: getComputedStyle(me).backgroundColor, pos: me.querySelector(".c-pos").textContent, sticky: getComputedStyle(me).position === "sticky" }; });
    check(sticky.scrolls, `${where}: the list should scroll`);
    check(sticky.sticky && (sticky.inView || sticky.pinned) && sticky.pos === "23", `${where}: your row should pin to the bottom edge while out of view: ${JSON.stringify(sticky)}`);
    check(sticky.colour === "rgb(255, 255, 255)", `${where}: the Daily's row for you should be white: ${sticky.colour}`);
    await shot(page, `lb-table-daily-${where}`);
    const atEnd = await page.evaluate(() => { const l = document.querySelector(".lb-list"); l.scrollTop = l.scrollHeight; const me = l.querySelector(".lb-row.me"), lr = l.getBoundingClientRect(), mr = me.getBoundingClientRect(); return mr.top >= lr.top - 0.5 && mr.bottom <= lr.bottom + 0.5; });
    check(atEnd, `${where}: scrolled to the end, your row should sit in its place`);
    // the arrows and a swipe change game, and every game opens on All time
    await page.click(".lb-arr.r"); await wait(600);
    check(await page.evaluate(() => /CLASSIC/i.test(document.querySelector(".lb-gn b").textContent)), `${where}: the right arrow did not turn to Classic`);
    await page.click('.lb-tabs [data-t="1"]'); await wait(600);
    check(await page.evaluate(() => document.querySelector('.lb-tabs [data-t="1"]').getAttribute("aria-selected") === "true" && /THIS WEEK/i.test(document.querySelector('.lb-tabs [data-t="1"]').textContent)), `${where}: Classic's second tab should be This week and selectable`);
    await shot(page, `lb-table-classic-week-${where}`);
    const mid = Math.round(R.list.top + 20);
    await page.mouse.move(w - 40, mid); await page.mouse.down(); await page.mouse.move(w / 2, mid, { steps: 6 }); await page.mouse.move(40, mid, { steps: 6 }); await page.mouse.up(); await wait(700);
    check(await page.evaluate(() => /CLUB X/i.test(document.querySelector(".lb-gn b").textContent)), `${where}: a swipe left did not turn to Club X`);
    check(await page.evaluate(() => document.querySelector('.lb-tabs [data-t="0"]').getAttribute("aria-selected") === "true"), `${where}: a new game should open on All time`);
    check(await page.evaluate(() => /BEST SEASON/i.test(document.querySelector('.lb-tabs [data-t="1"]').textContent) && /LONGEST DYNASTY/i.test(document.querySelector(".lb-tt i").textContent)), `${where}: Club X's tabs and trophy are wrong`);
    await page.click(".lb-arr.l"); await wait(500);
    check(await page.evaluate(() => /CLASSIC/i.test(document.querySelector(".lb-gn b").textContent)), `${where}: the left arrow did not turn back`);
    await page.click(".lb-arr.l"); await wait(500); await page.click(".lb-arr.l"); await wait(600);
    check(await page.evaluate(() => /UNBEATEN RUN/i.test(document.querySelector(".lb-gn b").textContent)), `${where}: the games do not loop round to Unbeaten Run`);
    await shot(page, `lb-table-ub-${where}`);
    await page.click(".lb-arr.l"); await wait(600);
    check(await page.evaluate(() => /SPOT ON/i.test(document.querySelector(".lb-cols").textContent) && /Spot on/.test(document.querySelector(".lb-tt b, .lb-tt span").parentNode.textContent)), `${where}: Goal Rush should say Spot on`);
    check(!/Bang on|Exactly right/i.test(await page.textContent(".lb")), `${where}: Goal Rush must never say Bang on or Exactly right`);
    await shot(page, `lb-table-goal-${where}`);
    // the game's top bar (the D2T logo, Share my place, the account; no back arrow) and one Back to home button in the game's colour
    const bar = await page.evaluate(() => { const b = [...document.querySelectorAll(".lb .actionbar > button")], t = document.querySelector(".lb-top"); return { n: b.length, main: b[0].textContent.trim(), col: getComputedStyle(b[0]).backgroundColor, logo: !!t.querySelector(".lb-logo .fr-hl-p, .lb-logo svg, .lb-logo img, .lb-logo *"), q: !!t.querySelector(".lb-q"), acct: !!t.querySelector('[aria-label="Account"]'), share: !!t.querySelector(".lb-share:not([disabled])"), back: !!document.querySelector(".lb .lb-back, .lb .back-btn") }; });
    check(bar.n === 1 && /Back to home/i.test(bar.main) && bar.col === "rgb(255, 210, 31)" && bar.logo && bar.q && bar.acct && bar.share && !bar.back, `${where}: the bars are wrong: ${JSON.stringify(bar)}`);
    // Share my place: the card and its message
    await page.click(".lb-share"); await wait(1500);
    const text = await page.evaluate(() => (window.D2T.share.last || {}).text || "");
    check(/^\*DROP2TOP leaderboard · Goal Rush\*/.test(text) && /23rd of 214 all time/.test(text) && text.trim().endsWith("404craig.github.io/D2T"), `${where}: the share message is wrong: ${JSON.stringify(text)}`);
    await page.evaluate(() => { const s = document.querySelector(".sheet-scrim"); if (s) s.click(); }); await wait(300);
    await page.click(".lb-main"); await wait(700);
    check((await scr(page)) === "home", `${where}: Back to home did not go home`);
    await page.close();
  }
  // in the top ten: no gap row before you, your row sits in the ten
  {
    const page = await open("top");
    await page.evaluate(() => window.D2T.go("leaderboard", { game: "classic" })); await wait(900);
    const r = await page.evaluate(() => { const rows = [...document.querySelectorAll(".lb-list > *")]; return { gaps: rows.filter((x) => x.classList.contains("lb-gap")).length, me: rows.findIndex((x) => x.classList.contains("me")), share: !document.querySelector(".lb-share").disabled }; });
    check(r.gaps === 1 && r.me === 3 && r.share, "in the top ten: your row should be 4th with one gap after the ten: " + JSON.stringify(r));
    await shot(page, "lb-table-top");
    await page.close();
  }
  // the empty states: nobody today, nobody this week, the trophy says Nobody yet
  {
    const page = await open("today");
    await page.evaluate(() => window.D2T.go("leaderboard", { game: "daily" })); await wait(900);
    await page.click('.lb-tabs [data-t="1"]'); await wait(700);
    const t = await page.textContent(".lb");
    check(/Nobody yet/.test(t) && /Be the first to win the league with .+ today/.test(t) && /No one has played today yet/.test(t) && /The day starts at midnight\. Your best go today puts you top of the table\./.test(t), "the Daily's empty today is worded wrong: " + t.slice(0, 400));
    check(await page.evaluate(() => !!document.querySelector(".lb-empty svg")), "the empty table should show a star");
    check(!(await page.$(".lb-count")) || (await page.textContent(".lb-count")).trim() === "", "an empty table should show no count");
    await shot(page, "lb-table-empty-today");
    await page.click(".lb-arr.r"); await wait(500); await page.click('.lb-tabs [data-t="1"]'); await wait(700);
    check(/The week starts on Monday/.test(await page.textContent(".lb")), "Classic's empty week should say the week starts on Monday");
    await page.click(".lb-arr.r"); await wait(500); await page.click(".lb-arr.r"); await wait(500); await page.click('.lb-tabs [data-t="1"]'); await wait(700);
    check(/Be the first spot on today/.test(await page.textContent(".lb")) && /Your first game puts you on the table/.test(await page.textContent(".lb")), "Goal Rush's empty today is worded wrong");
    await page.close();
  }
  // never played: a dash row of your own under the table; signed out: the pinned row, and it opens the account page
  {
    const page = await open("never");
    await page.evaluate(() => window.D2T.go("leaderboard", { game: "ub" })); await wait(900);
    const r = await page.evaluate(() => { const me = document.querySelector(".lb-list .lb-row.me"); return me ? { pos: me.querySelector(".c-pos").textContent, name: me.querySelector(".c-name").textContent, v: [...me.querySelectorAll(".c-v")].map((x) => x.textContent).join(""), share: !document.querySelector(".lb-share").disabled } : null; });
    check(r && r.pos === "–" && r.name === "You" && r.v === "–––" && r.share, "never played: a dash row of your own and Share still lit (build 201): " + JSON.stringify(r));
    await shot(page, "lb-table-never");
    await page.close();
    const out = await open("out");
    await out.evaluate(() => window.D2T.go("leaderboard", { game: "classic" })); await wait(900);
    const pin = await out.textContent(".lb-pin");
    check(/You · would be 12th/.test(pin) && /Sign in to claim it/.test(pin), "signed out: the pinned row should say You · would be 12th · Sign in to claim it: " + pin);
    check(await out.evaluate(() => { const p = document.querySelector(".lb-you").getBoundingClientRect(), l = document.querySelector(".lb-list").getBoundingClientRect(), b = document.querySelector(".lb .actionbar").getBoundingClientRect(); return p.top >= l.bottom - 0.5 && p.bottom <= b.top + 0.5; }), "the pinned row should sit between the list and the bar");
    check(await out.evaluate(() => !document.querySelector(".lb-share").disabled), "signed out: Share my place should stay lit (build 201)");
    await out.click(".lb-share"); await new Promise((r) => setTimeout(r, 500));
    check(/Sign in and finish a game/.test(await out.evaluate(() => (document.querySelector(".sheet") || {}).textContent || "")), "signed out: a tap on Share should say how to get a place");
    await out.evaluate(() => { const s = document.querySelector(".sheet-scrim"); if (s) s.click(); }); await new Promise((r) => setTimeout(r, 400));
    await shot(out, "lb-table-signedout");
    await out.click(".lb-you"); await wait(700);
    check((await scr(out)) === "account", "the pinned row should open the account page");
    await out.close();
    const none = await open("outNone");
    await none.evaluate(() => window.D2T.go("leaderboard", { game: "classic" })); await wait(900);
    check(/Sign in to join/.test(await none.textContent(".lb-pin")), "signed out with nothing played: the pinned row should say Sign in to join");
    await none.close();
  }
  // the server down: the screen says so and offers Try again; the empty table (nobody anywhere) reads right
  {
    const page = await open("down");
    await page.evaluate(() => window.D2T.go("leaderboard", { game: "classic" })); await wait(900);
    check(/Can't reach the leaderboard/.test(await page.textContent(".lb-list")) && !!(await page.$(".lb-retry")), "with the server down the table should say so and offer Try again");
    await shot(page, "lb-table-down");
    await page.close();
    const e = await open("empty");
    await e.evaluate(() => window.D2T.go("leaderboard", { game: "clubx" })); await wait(900);
    check(/Nobody yet/.test(await e.textContent(".lb-trophy")) && /No seasons finished yet/.test(await e.textContent(".lb-list")), "an empty Club X table is worded wrong");
    await e.close();
  }
  // a finished game goes up by its run id, once
  {
    const hits = [], page = await open("full", { hits });
    await page.evaluate(() => { const G = window.D2T.game; G.newRun("classic"); G.chooseClub(G.offer()[0].key); window.D2T.state.run.tableSeen = true; if (G.eng().phase === "setup") G.startSeason(); for (let i = 0; i < 400 && G.eng().phase !== "summary"; i++) { const e = G.eng(); if (e.phase === "window") G.pass(); else { G.play(); G.afterMatch(); } } G.finish(); window.D2T.save(); });
    await wait(1500);
    const sent = hits.filter((x) => x.p === "merge" && (x.body.results || []).some((r) => r.game === "classic"));
    const rec = sent.length && sent[0].body.results.find((r) => r.game === "classic").rec;
    check(rec && rec.rid && rec.club && /^\d{4}\/\d{2}$/.test(rec.season) && rec.finish >= 1 && rec.histPts >= 0 && rec.at > 0, "a finished Classic season should go to the server with its run id: " + JSON.stringify(rec));
    const seed = await page.evaluate(() => window.D2T.state.record.runs.slice(-1)[0].seed);
    check(rec && rec.rid === seed, "the run id should be the engine's seed");
    const q = await page.evaluate(() => (window.D2T.state.lb.queue || []).length);
    check(q === 0, "the queue should be empty once the server has it");
    await page.evaluate(() => window.D2T.lb.record("classic", { rid: window.D2T.state.record.runs.slice(-1)[0].seed, club: "x", season: "2007/08", finish: 1 })); await wait(300);
    check(hits.filter((x) => x.p === "merge" && (x.body.results || []).some((r) => r.game === "classic")).length === sent.length, "the same run id must not be sent twice");
    await page.close();
  }

  await browser.close();
  const all = fails.concat(errors);
  if (all.length) { console.log("FAIL\n" + all.join("\n")); process.exit(1); }
  console.log(`ok: the league table shield in every state on ${SIZES.length} sizes, the leaderboard screen on every size (layout, columns, medals, the sticky row, arrows, swipe, All time first, Spot on, the bar, Share), the top ten, the empty states, the dash and pinned rows, the server down, and a finished game sent once by run id`);
})().catch((e) => { console.log("ERR", e.stack || e.message); process.exit(1); });
