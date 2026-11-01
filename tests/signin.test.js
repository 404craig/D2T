// One sign-in for Tenaball and DROP2TOP (Craig, 1 Nov, build 217): a Tenaball sign-in on the phone signs DROP2TOP in
// (checked with the server's /api/me) with "Signed in as Craig · Not you?" once on home; a bad token leaves it signed
// out with no error; "Not you?" is never taken again; a DROP2TOP sign-in fills Tenaball's keys only when they are empty;
// signing out of one game never ends the other's session. Against a mocked server. Needs the page at localhost:8765.
const { chromium } = require(process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright");
const BASE = process.env.BASE || "http://localhost:8765/";
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log("FAIL: " + msg); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const USERS = { good: { id: "u1", name: "Craig" }, other: { id: "u2", name: "Emma" }, fresh: { id: "u3", name: "Dave" } };

(async () => {
  const browser = await chromium.launch();
  // a page with a fresh store; `seed` runs before the game (Tenaball's keys); every server call is mocked and logged
  async function open(seed) {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
    const calls = [];
    await ctx.route("**/api/**", (route) => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname.replace(/^\/api/, ""), auth = (req.headers().authorization || "").replace("Bearer ", "");
      calls.push({ path, auth });
      const json = (b, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
      if (path === "/me") return USERS[auth] ? json({ user: USERS[auth], stats: { played: 3 } }) : json({ error: "Not signed in." }, 401);
      if (path === "/signin") return json({ token: "fresh", user: { id: "u3", name: "Dave" }, stats: { played: 1 } });
      if (path === "/signout") return json({ ok: true });
      if (path.startsWith("/d2t/")) return json({ ok: true, games: {}, signedIn: !!USERS[auth], pos: {} });
      return json({});
    });
    if (seed) await ctx.addInitScript(seed);
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(BASE + "?v=test");
    await p.waitForFunction(() => location.hash.includes("home") && window.D2T && window.D2T.game, null, { timeout: 30000 });
    return { ctx, p, calls, errs };
  }
  const tb = (t) => `try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('tenaball-token', '${t}'); localStorage.setItem('tenaball-user', JSON.stringify({ user: { id: 'x', name: 'x' }, stats: null })); } } catch (e) {}`;
  const acct = (p) => p.evaluate(() => window.D2T.state.account || {});
  const note = (p) => p.evaluate(() => { const n = document.querySelector(".d2t-signed"); return n ? n.textContent.replace(/\s*·\s*/, " · ").replace(/\s+/g, " ").trim() : null; });

  // 1. a good Tenaball token signs DROP2TOP in, the note once, never naming Tenaball
  {
    const { ctx, p, calls, errs } = await open(tb("good"));
    await wait(2000);
    const a = await acct(p);
    check(a.token === "good" && a.user && a.user.name === "Craig", "a good Tenaball token did not sign DROP2TOP in: " + JSON.stringify(a));
    check((await note(p)) === "Signed in as Craig · Not you?", "the note should read 'Signed in as Craig · Not you?', got " + (await note(p)));
    check(calls.some((c) => c.path === "/d2t/adopted" && c.auth === "good"), "the automatic sign-in was not counted on the server");
    await p.mouse.click(200, 500); await wait(500);
    check((await note(p)) === null, "the note did not go on the next tap");
    await p.evaluate(() => window.D2T.go("account")); await wait(300); await p.evaluate(() => window.D2T.go("home")); await wait(1500);
    check((await note(p)) === null, "the note showed a second time");
    // signing out of DROP2TOP leaves Tenaball's session alone: no /signout on the shared token, Tenaball's key kept
    await p.evaluate(() => window.D2T.go("account")); await wait(600);
    await p.click('[data-act="out"]'); await wait(500);
    check(!(await acct(p)).token, "Sign out did not sign DROP2TOP out");
    check(!calls.some((c) => c.path === "/signout"), "signing out of DROP2TOP ended the session Tenaball shares");
    check((await p.evaluate(() => localStorage.getItem("tenaball-token"))) === "good", "signing out of DROP2TOP removed Tenaball's sign-in");
    await p.reload(); await p.waitForFunction(() => location.hash.includes("home") && window.D2T && window.D2T.game, null, { timeout: 30000 }); await wait(2000);
    check(!(await acct(p)).token, "after signing out of DROP2TOP it signed itself back in from Tenaball's sign-in");
    check(!errs.length, "page errors: " + errs.join(" | "));
    await ctx.close();
  }
  // 2. a bad token: still signed out, no note, no error
  {
    const { ctx, p, errs } = await open(tb("expired"));
    await wait(2000);
    check(!(await acct(p)).token && (await note(p)) === null, "a bad Tenaball token signed DROP2TOP in or showed the note");
    check(!errs.length, "page errors with a bad token: " + errs.join(" | "));
    await ctx.close();
  }
  // 3. "Not you?" signs out of DROP2TOP only and that token is never taken again (a reload, a return to the tab)
  {
    const { ctx, p, calls } = await open(tb("good"));
    await wait(2000);
    await p.click(".d2t-notyou"); await wait(600);
    check(!(await acct(p)).token, "Not you? did not sign DROP2TOP out");
    check(!calls.some((c) => c.path === "/signout"), "Not you? ended Tenaball's session");
    await p.reload(); await p.waitForFunction(() => location.hash.includes("home") && window.D2T && window.D2T.game, null, { timeout: 30000 }); await wait(2000);
    check(!(await acct(p)).token, "a token turned down with Not you? was taken again after a reload");
    check((await p.evaluate(() => localStorage.getItem("tenaball-token"))) === "good", "Not you? removed Tenaball's sign-in");
    // a different Tenaball sign-in later is taken
    await p.evaluate(() => { localStorage.setItem("tenaball-token", "other"); document.dispatchEvent(new Event("visibilitychange")); }); await wait(1500);
    check((await acct(p)).token === "other", "a different Tenaball sign-in was not taken on returning to the tab");
    await ctx.close();
  }
  // 4. a DROP2TOP sign-in fills Tenaball's keys only when Tenaball has none
  async function signIn(p) {
    await p.evaluate(() => window.D2T.go("account")); await wait(600);
    await p.fill('input[name="email"]', "dave@example.com"); await p.fill('input[name="pin"]', "1234");
    await p.click('form [type="submit"]'); await wait(800);
  }
  {
    const { ctx, p, calls } = await open();
    await signIn(p);
    const k = await p.evaluate(() => ({ t: localStorage.getItem("tenaball-token"), u: JSON.parse(localStorage.getItem("tenaball-user") || "null"), e: localStorage.getItem("tenaball-email") }));
    check(k.t === "fresh" && k.u && k.u.user && k.u.user.name === "Dave" && k.u.stats && k.e === "dave@example.com", "a DROP2TOP sign-in did not fill Tenaball's keys: " + JSON.stringify(k));
    // a sign-out of a session Tenaball shares never ends it; one it does not share does
    await p.evaluate(() => localStorage.setItem("tenaball-token", "someone-else")); await p.evaluate(() => window.D2T.go("home")); await wait(300); await p.evaluate(() => window.D2T.go("account")); await wait(500);
    await p.click('[data-act="out"]'); await wait(500);
    check(calls.some((c) => c.path === "/signout" && c.auth === "fresh"), "signing out of a session Tenaball doesn't share did not end it");
    await ctx.close();
  }
  {
    const { ctx, p } = await open(tb("other"));
    await wait(1500);
    await p.evaluate(() => { window.D2T.state.account = {}; window.D2T.save(); });   // signed out here, Tenaball signed in as someone else
    await signIn(p);
    check((await p.evaluate(() => localStorage.getItem("tenaball-token"))) === "other", "a DROP2TOP sign-in overwrote another Tenaball sign-in");
    await ctx.close();
  }
  await browser.close();
  if (fails) { console.log(`${fails} check(s) failed`); process.exit(1); }
  console.log("ok: one sign-in (a Tenaball sign-in signs DROP2TOP in with the note once, a bad token stays signed out, Not you? is never taken again, a DROP2TOP sign-in fills Tenaball's keys only when empty, signing out never ends the other game's session)");
})();
