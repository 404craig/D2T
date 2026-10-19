// Engine checks: node tests/engine.test.js
const assert = require("assert");
const D = require("../src/engine.js");
const G = require("../data/game/game.json");
require("./legends.js")(G);   // the legend cards, as the phone plays them
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const play = (seed, season, club, strategy = "greedy") => {
  const S = G.seasons[season]; const c = S.clubs.find(x => x.name === club).id;
  const st = D.newRun({ seed, catalogue: G.catalogue, fixedClub: `${season}:${club}` });
  D.chooseClub(st, S, S.relegated.find(r => r.c === c) || { c, f: "4-4-2", xi: [] }); D.startSeason(st, S);
  const offered = [];
  let g = 0;
  while (st.phase !== "summary" && g++ < 600) {
    if (st.phase === "window") {
      offered.push(...st.roll.cards);
      if (strategy === "pass") { D.pass(st, S); continue; }
      let best = null;
      for (const id of st.roll.cards) for (const o of D.signPreview(st, S, id)) if (!best || o.delta > best.delta) best = { id, slot: o.slot, delta: o.delta };
      if (best.delta > 0) D.sign(st, S, best.id, best.slot); else D.pass(st, S);
    } else D.playMatch(st, S);
  }
  return { st, S, offered };
};
t("history tables match the real points for every relegated club", () => {
  for (const [key, S] of Object.entries(G.seasons)) {
    const H = D.historyTable(S, S.deductions);
    for (const r of S.relegated) {
      const pos = H.findIndex(x => x.c === r.c) + 1, row = H[pos - 1];
      assert.strictEqual(row.pts, r.pts, `${key} ${S.clubs[r.c].name} pts`);
      assert.strictEqual(pos, r.pos, `${key} ${S.clubs[r.c].name} pos`);
    }
  }
});
t("Derby 2007/08 history: 11 points, 20 for, 89 against", () => {
  const S = G.seasons["2007/08"], d = S.clubs.find(c => c.name === "Derby").id;
  const row = D.historyTable(S).find(r => r.c === d);
  assert.deepStrictEqual([row.pts, row.gf, row.ga, row.w], [11, 20, 89, 1]);
});
t("17 rolls in a 38-game season, last roll before GW36", () => {
  const S = G.seasons["2007/08"], d = S.clubs.find(c => c.name === "Derby").id;
  const sch = D.schedule(D.fixturesOf(S, d));
  assert.strictEqual(sch.reduce((a, w) => a + w.n, 0), 17);
  assert.strictEqual(sch[sch.length - 1].gw, 36);
  assert.strictEqual(sch.find(w => w.kind === "jan").gw, 21);
});
const run1 = play("test-seed", "2007/08", "Derby");
t("a season ends with every club on 38 games", () => {
  const T = D.table(run1.S, run1.st, null, run1.S.deductions);
  assert.strictEqual(T.length, 20);
  for (const r of T) assert.strictEqual(r.p, 38);
  assert.strictEqual(run1.st.played.length, 38);
});
t("the same seed and choices give the same season", () => {
  const again = play("test-seed", "2007/08", "Derby");
  assert.deepStrictEqual(again.st.final.table, run1.st.final.table);
  assert.deepStrictEqual(again.st.played.map(r => [r.us, r.them]), run1.st.played.map(r => [r.us, r.them]));
});
t("a Daily's goes have random seeds of their own: two goes differ in rolls and results, and each go replays itself", () => {
  // the app seeds every go `daily-<date>-r<random>` (GAME.dailySeed in core/game.js): only the club is shared
  const date = "2026-10-13", go1 = play("daily-" + date + "-rabc123", "2004/05", "Southampton", "pass"), go2 = play("daily-" + date + "-rxyz789", "2004/05", "Southampton", "pass");
  const again = play("daily-" + date + "-rabc123", "2004/05", "Southampton", "pass");
  assert.notDeepStrictEqual(go1.offered.slice(0, 3), go2.offered.slice(0, 3), "the first roll should differ between goes");
  const shared = go1.offered.filter(id => go2.offered.includes(id)).length;
  // two goes on different phones share about 31% of their cards on average (15 Oct: 40% of draws are gold, weighted by
  // rating, from a pool of about 55 a season; 19% on the 13 Oct odds; the anti-repeat memory covers the same phone)
  assert.ok(shared < go1.offered.length / 2, `goes share too many cards: ${shared} of ${go1.offered.length}`);
  const r1 = go1.st.played.map(r => `${r.us}-${r.them}`), r2 = go2.st.played.map(r => `${r.us}-${r.them}`);
  assert.ok(r1.filter((s, i) => s === r2[i]).length < 20, "the same XI should not get the same results in another go");
  assert.deepStrictEqual(again.offered, go1.offered, "the same go should offer the same cards");
  assert.deepStrictEqual(again.st.played.map(r => [r.us, r.them]), go1.st.played.map(r => [r.us, r.them]), "the same go should replay its results");
});
t("recent cards: a run told what the last run offered serves far fewer of them, and replays the same with the same history", () => {
  const S = G.seasons["2007/08"], c = S.clubs.find(x => x.name === "Derby").id, rel = S.relegated.find(r => r.c === c);
  const go = (seed, recent) => {
    const st = D.newRun({ seed, catalogue: G.catalogue, fixedClub: "2007/08:Derby", recent });
    D.chooseClub(st, S, rel); D.startSeason(st, S);
    let g = 0; while (st.phase !== "summary" && g++ < 600) { if (st.phase === "window") D.pass(st, S); else D.playMatch(st, S); }
    return st;
  };
  const first = go("recent-a", null);
  assert.strictEqual(first.offered.length, 51, "17 rolls of 3 cards should all be noted as offered");
  const w = D.recentWeights([first.offered]);
  assert.strictEqual(w[first.offered[0]], D.RULES.recent[0]);
  const plain = go("recent-b", null), aware = go("recent-b", w);
  const shared = (st) => st.offered.filter(id => first.offered.includes(id)).length;
  assert.ok(shared(aware) * 2 < shared(plain) || shared(aware) <= 2, `recent cards still came up: ${shared(aware)} against ${shared(plain)} without the history`);
  assert.deepStrictEqual(go("recent-b", w).offered, aware.offered, "the same seed and history should offer the same cards");
  // the weights follow the run's age: a card from the run before last is halfway between
  const w3 = D.recentWeights([["x"], ["y", "x"], ["z"]]);
  assert.deepStrictEqual(w3, { x: 0.1, y: 0.25, z: 0.5 });
});
t("match results look like football: about 2.7 goals a game, 5+ goal margins rare, 0-0 and 1-0 common", () => {
  let n = 0, goals = 0, big = 0, nil = 0, oneNil = 0;
  for (const S of Object.values(G.seasons)) {
    const ix = D.indexSeason(S), str = {};
    for (let c = 0; c < ix.nClubs; c++) str[c] = D.clubStrength(S, c, new Set());
    for (const m of ix.matches) {
      const r = D.stream("football", S.season, m.i), po = (l) => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L && k < 12); return k - 1; };
      const hg = po(D.expectedGoals(str[m.h], str[m.a], true)), ag = po(D.expectedGoals(str[m.a], str[m.h], false));
      n++; goals += hg + ag; if (Math.abs(hg - ag) >= 5) big++; if (hg === 0 && ag === 0) nil++; if (hg + ag === 1) oneNil++;
    }
  }
  // real Premier League, 1992/93 to 2025/26: 2.69 goals a game, 2.0% of matches by 5 or more, 7.8% 0-0, 17.6% 1-0 or 0-1
  assert.ok(Math.abs(goals / n - 2.69) < 0.15, "goals a game " + (goals / n).toFixed(2));
  assert.ok(big / n < 0.03, "5+ goal margins " + (100 * big / n).toFixed(2) + "%");
  assert.ok(nil / n > 0.055, "0-0 " + (100 * nil / n).toFixed(1) + "%");
  assert.ok(oneNil / n > 0.15, "1-0 or 0-1 " + (100 * oneNil / n).toFixed(1) + "%");
});
t("no player is offered twice in a run, and never one of your own squad", () => {
  assert.strictEqual(new Set(run1.offered).size, run1.offered.length);
  const own = new Set(D.squadOf(run1.S, run1.st.club).map(p => p.id));
  for (const id of run1.offered) assert.ok(!own.has(id));
});
t("respins: 5 a season, then refused", () => {
  const S = G.seasons["2007/08"], d = S.clubs.find(c => c.name === "Derby").id;
  const st = D.newRun({ seed: "rs", catalogue: G.catalogue });
  assert.ok(D.respinClubs(st, G.catalogue));
  D.chooseClub(st, S, S.relegated.find(r => r.c === d)); D.startSeason(st, S);
  for (let i = 0; i < 4; i++) assert.ok(D.respinCards(st, S));
  assert.strictEqual(st.respins, 0);
  assert.ok(!D.respinCards(st, S));
});
t("signing a player weakens his club and he never scores against you", () => {
  for (const s of run1.st.signed) {
    if (String(s.id).startsWith("L:")) continue;
    const p = D.playerOf(run1.S, s.id);
    assert.ok(D.strengthLoss(run1.S, p.c, new Set([s.id])) >= 0);
  }
  const signedAt = new Map(run1.st.signed.map(s => [s.id, s.gw]));
  for (const r of run1.st.played) for (const e of r.events) if (!e.us && signedAt.has(e.id)) assert.ok(r.gw < signedAt.get(e.id), "signed player scored against you");
});
t("raids only ever take points off raided clubs", () => {
  const H = D.historyTable(run1.S), T = D.table(run1.S, run1.st, null);
  const raided = new Set(run1.st.signed.map(s => D.playerOf(run1.S, s.id)).filter(p => p && p.c != null).flatMap(p => [p.c, p.c2]));
  const others = D.otherResults(run1.S, run1.st).filter(m => m.changed);
  for (const m of others) assert.ok(raided.has(m.h) || raided.has(m.a));
});
t("passing every roll keeps Derby near history", () => {
  let pts = 0; for (let i = 0; i < 20; i++) pts += play("pass" + i, "2007/08", "Derby", "pass").st.final.pts;
  assert.ok(pts / 20 < 30, "avg " + pts / 20);
});
t("every relegated club-season can be played to the end", () => {
  for (const c of G.catalogue.filter((_, i) => i % 9 === 0)) {
    const r = play("all-" + c.key, c.season, c.club);
    assert.strictEqual(r.st.phase, "summary", c.key);
    assert.strictEqual(r.st.played.length, r.st.fixtures.length);
  }
});
// Dare2Dream: draft 11 (best effective rating each time), then play the season greedily.
const draft = (seed, c, formation, mode) => {
  const S = G.seasons[c.season], id = S.clubs.find(x => x.name === c.club).id;
  const st = D.newRun({ seed, mode: mode || "dare2dream", catalogue: G.clubSeasons });
  D.chooseClub(st, S, { c: id, f: "4-4-2", xi: [] });
  if (formation) assert.ok(D.draftFormation(st, S, formation));
  while (st.phase === "draft") {
    if (D.draftSlot(st) == null) {   // Club X: the best card on the shirt he fits best
      const opts = st.roll.cards.map((cid) => { const s = D.draftFits(st, S, cid)[0]; return { cid, s, r: D.effRating(D.playerOf(S, cid, S.legends), D.FORMATIONS[st.formation][s][0]) }; });
      const b = opts.sort((x, y) => y.r - x.r)[0];
      assert.ok(D.draftPick(st, S, b.cid, b.s)); continue;
    }
    const slot = D.draftSlot(st), pos = D.FORMATIONS[st.formation][slot][0];
    assert.strictEqual(st.roll.cards.length, 3, c.key);
    for (const cid of st.roll.cards) assert.strictEqual(D.broadOf(D.playerOf(S, cid)), D.SLOT_BROAD[pos], c.key + " card out of position");
    const best = st.roll.cards.slice().sort((x, y) => D.effRating(D.playerOf(S, y), pos) - D.effRating(D.playerOf(S, x), pos))[0];
    assert.ok(D.draftPick(st, S, best));
  }
  return { st, S };
};
t("Dare2Dream: the draft fills 11 shirts in position from other clubs, then the season has no pre-season rolls", () => {
  assert.strictEqual(G.clubSeasons.length, 686);
  for (const c of G.clubSeasons.filter((_, i) => i % 7 === 0)) {
    const { st, S } = draft("d2d-" + c.key, c, "4-3-3");
    assert.strictEqual(st.phase, "setup");
    assert.strictEqual(st.xi.filter(x => x != null).length, 11, c.key);
    assert.strictEqual(new Set(st.xi).size, 11, c.key);
    const own = new Set(D.squadOf(S, st.club).map(p => p.id));
    assert.ok(st.xi.every(id => !own.has(id)), c.key + " drafted his own club's player");
    assert.strictEqual(st.signed.filter(x => x.draft).length, 11);
    D.startSeason(st, S);
    assert.ok(st.rolls.every(w => w.kind !== "pre"), "pre-season rolls should be dropped");
    assert.strictEqual(st.rolls.reduce((a, w) => a + w.n, 0), D.schedule(st.fixtures).reduce((a, w) => a + w.n, 0) - 3, c.key + " rolls");
    assert.strictEqual(st.phase, "prematch");
  }
});
t("Club X: each season's bottom club is replaced by a drafted XI that plays the season out", () => {
  const bottom = Object.values(G.clubSeasons.reduce((m, c) => { if (!m[c.season] || c.pos > m[c.season].pos) m[c.season] = c; return m; }, {}));
  assert.strictEqual(bottom.length, Object.keys(G.seasons).length);
  assert.ok(D.DRAFT_MODES.includes("clubx"));
  for (const c of bottom.filter((_, i) => i % 6 === 0)) {
    const { st, S } = draft("clx-" + c.key, c, null, "clubx");
    assert.strictEqual(st.mode, "clubx");
    assert.strictEqual(st.xi.filter(x => x != null).length, 11, c.key);
    D.startSeason(st, S);
    assert.ok(st.rolls.every(w => w.kind !== "pre"));
    let g = 0;
    while (st.phase !== "summary" && g++ < 700) { if (st.phase === "window") D.pass(st, S); else D.playMatch(st, S); }
    assert.strictEqual(st.phase, "summary", c.key);
  }
});
t("Club X spins one season and drafts from every open shirt, each card green in one of them; Dare2Dream stays keeper first", () => {
  const S = G.seasons["2007/08"], derby = S.clubs.find(x => x.name === "Derby").id;
  const xr = D.newRun({ seed: "clx-one", mode: "clubx", catalogue: G.clubSeasons });
  assert.strictEqual(xr.clubOffer.length, 1, "Club X should offer one season");
  assert.ok(D.respinClubs(xr, G.clubSeasons) && xr.clubOffer.length === 1, "a Club X respin should offer one season");
  assert.strictEqual(D.newRun({ seed: "d2d-three", mode: "dare2dream", catalogue: G.clubSeasons }).clubOffer.length, 3);
  const F = D.FORMATIONS["4-4-2"];
  const play = (seed, mode, pickLast) => {
    const st = D.newRun({ seed, mode, catalogue: G.clubSeasons }); D.chooseClub(st, S, { c: derby, f: "4-4-2", xi: [] });
    const out = [], firstPos = [];
    while (st.phase === "draft") {
      assert.strictEqual(st.roll.cards.length, 3, "three cards every spin");
      if (mode === "clubx") {
        const open = st.xi.map((x, i) => (x == null ? F[i][0] : null)).filter(Boolean);
        for (const id of st.roll.cards) {
          const p = D.playerOf(S, id, S.legends), fits = D.draftFits(st, S, id);
          assert.ok(fits.length === open.length && fits.every((i) => st.xi[i] == null), "a card can go on any open shirt");
          assert.ok(open.some((pos) => D.fitOf(p, pos) === "green"), "every card is green in at least one open shirt");
        }
        if (!out.length) st.roll.cards.forEach((id) => firstPos.push(F[D.draftFits(st, S, id)[0]][0]));
        const id = st.roll.cards[pickLast ? 2 : 0], slot = D.draftFits(st, S, id)[0];
        assert.ok(D.draftPick(st, S, id, slot)); out.push(slot);
      } else { out.push(D.draftSlot(st)); assert.ok(D.draftPick(st, S, st.roll.cards[0])); }
    }
    assert.ok(st.xi.every((x) => x != null), "all 11 shirts filled");
    return { out, firstPos };
  };
  const runs = ["a", "b", "c", "d", "e", "f"].map((k) => play("clx-open-" + k, "clubx"));
  assert.ok(runs.some((r) => r.firstPos.some((pos) => pos !== "GK")), "Club X's first spin should not be all keepers");
  assert.ok(runs.some((r) => new Set(r.firstPos).size > 1), "Club X's first spin mixes positions");
  assert.deepStrictEqual(play("clx-open-a", "clubx").out, runs[0].out, "the same seed and picks replay");
  // the shape can change after any spin: drafted players re-seated, the cards on the table kept; any open shirt, even a red one
  {
    const st = D.newRun({ seed: "clx-shape", mode: "clubx", catalogue: G.clubSeasons }); D.chooseClub(st, S, { c: derby, f: "4-4-2", xi: [] });
    for (let k = 0; k < 4; k++) { const id = st.roll.cards[0]; assert.ok(D.draftPick(st, S, id, D.draftFits(st, S, id)[0])); }
    const before = st.xi.filter(Boolean).sort(), cards = st.roll.cards.slice();
    assert.ok(D.draftFormation(st, S, "3-5-2"), "Club X can change shape mid-draft");
    assert.strictEqual(st.formation, "3-5-2");
    assert.deepStrictEqual(st.xi.filter(Boolean).sort(), before, "the drafted players stay");
    assert.deepStrictEqual(st.roll.cards, cards, "the cards on the table stay");
    const id = st.roll.cards[0], p = D.playerOf(S, id, S.legends), F2 = D.FORMATIONS["3-5-2"];
    const red = D.draftFits(st, S, id).find((i) => D.fitOf(p, F2[i][0]) === "red");
    if (red != null) { assert.ok(D.draftPick(st, S, id, red), "a red open shirt can be picked"); assert.strictEqual(st.xi[red], id); }
    const dd = D.newRun({ seed: "d2d-shape", mode: "dare2dream", catalogue: G.clubSeasons }); D.chooseClub(dd, S, { c: derby, f: "4-4-2", xi: [] });
    assert.ok(D.draftPick(dd, S, dd.roll.cards[0]));
    assert.ok(!D.draftFormation(dd, S, "3-5-2"), "Dare2Dream's shape is fixed after the first pick");
  }
  const d = play("d2d-order", "dare2dream").out;
  assert.strictEqual(d[0], 0, "Dare2Dream starts with the keeper");
  assert.deepStrictEqual(d, D.draftOrder("4-4-2"));
});
t("Club X career: carried XI leaves its real clubs, later seasons get pre-season rolls, forecast results replay", () => {
  const S = G.seasons["2024/25"], st = D.newRun({ seed: "car-1", mode: "clubx", catalogue: [] });
  st.seasonKey = S.season; st.club = 19; st.formation = "4-4-2"; st.career = 2;
  const ids = D.autoXI(S, 0, "4-4-2", []);
  D.carryIn(st, S, ids);
  assert.strictEqual(st.phase, "setup");
  assert.ok(st.raids.length >= 1 && st.raids.every((r) => r.club === 0 && r.date === "0000-00-00"), "carried players leave their real club before the season");
  assert.ok(D.startSeason(st, S) && st.rolls[0].kind === "pre", "a career's later season has pre-season rolls");
  const T = G.seasons["2025/26"], copy = () => Object.assign({}, T, { matches: T.matches.map((m) => [m[0], m[1], m[2], 0, 0]), _ix: null, season: "2026/27" });
  const a = D.simResults(copy(), "car-sim", 5, null), b = D.simResults(copy(), "car-sim", 5, null);
  assert.deepStrictEqual(a.matches, b.matches, "the same career gets the same forecast");
  const goals = a.matches.reduce((n, m) => n + m[3] + m[4], 0) / a.matches.length;
  assert.ok(goals > 2 && goals < 3.5, "forecast goals per game look like football: " + goals.toFixed(2));
});
t("Club X career: Poached takes 3 outfield players to 3 different league clubs, once, from the seed, and the season plays out", () => {
  const S = G.seasons["2024/25"];
  const setup = (seed) => { const st = D.newRun({ seed, mode: "clubx", catalogue: [] }); st.seasonKey = S.season; st.club = 19; st.formation = "4-4-2"; st.career = 2; D.carryIn(st, S, D.autoXI(S, 0, "4-4-2", [])); return st; };
  const slots = D.FORMATIONS["4-4-2"].map((x) => x[0]);
  const first = setup("poach-1"), xi0 = first.xi.slice(), out = D.poach(first, S);
  assert.strictEqual(out.length, 3, "three players go");
  assert.ok(out.every((x) => slots[x.slot] !== "GK"), "never the keeper");
  assert.strictEqual(new Set(out.map((x) => x.club)).size, 3, "each to a different club");
  assert.ok(out.every((x) => x.club !== first.club && x.club >= 0 && x.club < S.clubs.length), "a league club, never yours");
  assert.ok(out.every((x) => { const p = D.playerOf(S, x.id); return x.club !== p.c && x.club !== p.c2 && xi0[x.slot] === x.id; }), "never back to his own club; his own shirt");
  assert.ok(out.every((x) => first.xi[x.slot] == null) && first.xi.filter((id) => id == null).length === 3, "their shirts are left empty");
  assert.strictEqual(D.poach(first, S), null, "once a season");
  assert.deepStrictEqual(D.poach(setup("poach-1"), S), out, "the same seed takes the same players to the same clubs");
  const two = new Set(); for (let i = 0; i < 12; i++) two.add(JSON.stringify(D.poach(setup("poach-v" + i), S)));
  assert.ok(two.size > 6, "different seeds poach differently");
  assert.strictEqual(D.poach(Object.assign(setup("poach-2"), { career: 1 }), S), null, "not in a career's first season");
  // a poached player joins his new club: it picks him, and is stronger for it
  assert.ok(out.every((x) => D.clubXI(S, x.club, new Set(), D.joinersOf(S, first, x.club)).length === 11));
  assert.ok(out.some((x) => D.strengthLoss(S, x.club, new Set(), null, D.joinersOf(S, first, x.club)) < 0), "at least one rival is strengthened");
  // the Summer window: sign into an empty shirt, pass the rest; any shirt still empty gets a free agent before GW1
  D.startSeason(first, S);
  assert.strictEqual(first.phase, "window");
  const hole = first.xi.indexOf(null), card = first.roll.cards[0];
  assert.ok(D.sign(first, S, card, hole) && first.xi[hole] === card, "a roll signs into an empty shirt");
  while (first.phase === "window") D.pass(first, S);
  assert.ok(first.xi.every((id) => id != null), "no empty shirts at kick-off");
  assert.strictEqual(first.freeFill.length, 2, "the two shirts left empty were filled with free agents");
  assert.ok(first.freeFill.every((f) => { const p = D.playerOf(S, f.id); return p.lv === 0 && D.fitOf(p, slots[f.slot]) === "green"; }), "bronze, and green in the shirt");
  assert.ok(out.every((x) => !first.offered.includes(x.id)), "a poached player never comes back in the rolls");
  let g = 0;
  while (first.phase !== "summary" && g++ < 700) { if (first.phase === "window") D.pass(first, S); else D.playMatch(first, S); }
  assert.strictEqual(first.phase, "summary", "the season plays to the end");
  assert.ok(!first.final.bestSigning || !first.freeFill.some((f) => f.id === first.final.bestSigning.id), "a free agent is not the best signing");
});
t("Dare2Dream: a sample of drafted seasons plays to the end, and draft picks weaken their clubs", () => {
  for (const c of G.clubSeasons.filter((_, i) => i % 45 === 0)) {
    const { st, S } = draft("d2d-play-" + c.key, c);
    D.startSeason(st, S);
    let g = 0;
    while (st.phase !== "summary" && g++ < 700) {
      if (st.phase === "window") D.pass(st, S); else D.playMatch(st, S);
    }
    assert.strictEqual(st.phase, "summary", c.key);
    assert.ok(!st.final.bestSigning, "draft picks are not signings");
    const gone = new Set(st.signed.map(x => x.id)), clubs = [...new Set(st.signed.map(x => x.from).filter(x => x != null))];
    assert.ok(clubs.some(cl => D.strengthLoss(S, cl, gone) > 0), c.key + ": no drafted player weakened his club");
  }
});

// ---------- the 18 Oct rethink (docs/SCOPE_ENGINE.md) ----------
t("raids: with nobody taken every other result is history; taking Man Utd's midfield three costs them 15 to 30 points", () => {
  const S = G.seasons["2000/01"], d = S.clubs.find(c => c.name === "Derby").id, mu = S.clubs.find(c => c.name === "Man Utd").id;
  const st = D.newRun({ seed: "raid0", catalogue: G.catalogue, fixedClub: "2000/01:Derby" });
  D.chooseClub(st, S, S.relegated.find(r => r.c === d) || { c: d, f: "4-4-2", xi: [] }); D.startSeason(st, S);
  const ix = D.indexSeason(S);
  for (const m of D.otherResults(S, st)) { const r = ix.matches[m.i]; assert.strictEqual(m.hg, r.hg); assert.strictEqual(m.ag, r.ag); assert.ok(!m.changed); }
  // pretend the three were signed before the season
  const trio = S.players.filter(p => p.c === mu && ["Roy Keane", "David Beckham", "Paul Scholes"].includes(p.n));
  assert.strictEqual(trio.length, 3);
  for (const p of trio) st.signed.push({ id: p.id, gw: 1, slot: 0, out: null, from: mu, date: "0000-00-00" });
  const pts = (rows) => rows.filter(m => m.h === mu || m.a === mu).reduce((a, m) => a + (m.h === mu ? (m.hg > m.ag ? 3 : m.hg === m.ag ? 1 : 0) : (m.ag > m.hg ? 3 : m.hg === m.ag ? 1 : 0)), 0);
  const real = pts(ix.matches), now = pts(D.otherResults(S, st));
  assert.ok(real - now >= 15 && real - now <= 30, `Man Utd ${real} -> ${now}`);
});
t("stars count for the user's XI only, above 80 by level; the plain rating is untouched", () => {
  assert.strictEqual(D.starRating({ r: 80, lv: 4 }), 80);
  assert.strictEqual(D.starRating({ r: 90, lv: 2 }), 90);     // a gold plays at his number: the levels matter
  assert.strictEqual(D.starRating({ r: 89, lv: 3 }), 93.5);
  assert.strictEqual(D.starRating({ r: 93, lv: 4 }), 106);
  const { st, S } = run1;
  const plain = D.plainStrength(S, st), match = D.userStrength(S, st, S.legends, { tactic: false });
  assert.ok(match.ovr >= plain.ovr);
  const full = D.clubStrength(S, st.club, new Set());   // a real club's strength never takes the curve
  assert.ok(Math.abs(full.ovr - D.xiStrength(D.clubXI(S, st.club, new Set()).map((p, i) => Object.assign({}, p, { p: [["GK","RB","CB","CB","LB","RM","CM","CM","LM","ST","ST"][i]] })), ["GK","RB","CB","CB","LB","RM","CM","CM","LM","ST","ST"]).ovr) < 1e-9);
});
t("tactics: mid block is the plain model, the others lean on a line, half as hard outside their shapes", () => {
  const { st, S } = run1;
  const base = D.userStrength(S, st, S.legends, { tactic: false });
  assert.deepStrictEqual(D.userStrength(S, Object.assign({}, st, { tactic: "mid" })), D.tacticLines(Object.assign({}, st, { tactic: "mid" }), base, [], []));
  const low = D.userStrength(S, Object.assign({}, st, { tactic: "low" }));
  assert.ok(Math.abs((low.def - base.def) - 0.9 * (D.RULES.tactics.low.shapes.includes(st.formation) ? 1 : 0.5) * (base.def - D.RULES.lineOffset.def - base.ovr)) < 1e-9);
  const S2 = G.seasons["2007/08"], d2 = S2.clubs.find(c => c.name === "Derby").id, fresh = D.newRun({ seed: "tac", catalogue: G.catalogue, fixedClub: "2007/08:Derby" });
  D.chooseClub(fresh, S2, S2.relegated.find(r => r.c === d2));
  assert.ok(D.setTactic(fresh, "press") && fresh.tactic === "press"); assert.ok(!D.setTactic(fresh, "nothing"));
  assert.ok(!D.setTactic(st, "low"), "a finished season took a tactic");
  for (const k of D.TACTIC_NAMES) { const L = D.userStrength(S, Object.assign({}, st, { tactic: k })); assert.ok(isFinite(L.att) && isFinite(L.def)); }
});
t("settling: a signing never plays below the shirt's floor, and is himself once settled; legends always run", () => {
  const { st, S } = run1;
  const signs = st.signed.filter(s => !s.draft && !s.free);
  assert.ok(signs.length > 3);
  for (const s of signs) {
    const p = D.playerOf(S, s.id, S.legends);
    if ((p.lv || 0) >= 3) assert.ok(!s.settle, "a purple or legend settles");
    if (!s.settle) continue;
    for (let g = s.gw; g < s.gw + s.settle.games + 1; g++) {
      const r = D.settledRating(p, s, g);
      if (g >= s.gw + s.settle.games) { assert.strictEqual(r, null); continue; }
      assert.ok(r >= Math.min(s.settle.from, p.r) - 1e-9 && r <= p.r + 1e-9, `gw ${g}: ${r} vs ${p.r} from ${s.settle.from}`);
    }
  }
  const types = new Set(signs.map(s => (s.settle ? s.settle.games : 0)));
  assert.ok(types.size >= 2, "one kind of settling only: " + [...types]);
});
t("scouting: 2 respins, three cards green in the shirt and better than its man (or the next best, tagged); refused with nobody better", () => {
  const S = G.seasons["2007/08"], d = S.clubs.find(c => c.name === "Derby").id;
  const st = D.newRun({ seed: "scout1", catalogue: G.catalogue, fixedClub: "2007/08:Derby" });
  D.chooseClub(st, S, S.relegated.find(r => r.c === d)); D.startSeason(st, S);
  const info = D.scoutInfo(st, S);
  assert.strictEqual(info.length, 11);
  const slot = info.find(x => x.better >= 3).slot, pos = D.FORMATIONS[st.formation][slot][0], holder = D.playerOf(S, st.xi[slot]);
  assert.ok(D.scout(st, S, slot)); assert.strictEqual(st.respins, 3); assert.strictEqual(st.roll.scout, slot);
  assert.strictEqual(st.roll.cards.length, 3);
  for (const id of st.roll.cards) { const p = D.playerOf(S, id, S.legends); assert.ok(!String(id).startsWith("L:")); assert.strictEqual(D.fitOf(p, pos), "green"); assert.ok(p.r > holder.r); }
  assert.deepStrictEqual(st.roll.tags, ["better", "better", "better"]);
  assert.ok(D.scout(st, S, slot)); assert.strictEqual(st.respins, 1);
  assert.ok(!D.scout(st, S, slot), "scouted on one respin");
  // nobody better: put a 99 in the shirt
  const st2 = D.newRun({ seed: "scout2", catalogue: G.catalogue, fixedClub: "2007/08:Derby" });
  D.chooseClub(st2, S, S.relegated.find(r => r.c === d)); D.startSeason(st2, S);
  const top = S.players.slice().sort((a, b) => b.r - a.r)[0]; st2.xi[9] = top.id;
  assert.strictEqual(D.scoutInfo(st2, S)[9].better, 0); assert.ok(!D.scout(st2, S, 9));
});
t("every season puts a legend on the table", () => {
  for (let i = 0; i < 12; i++) { const { offered } = play("leg" + i, "2007/08", "Derby", "pass"); assert.ok(offered.some(id => String(id).startsWith("L:")), "no legend in run " + i); }
});
t("the January raid: one outfield player goes to a top-half club as the window opens, once a season, and his club is stronger from that date", () => {
  const S = G.seasons["2007/08"], d = S.clubs.find(c => c.name === "Derby").id;
  const st = D.newRun({ seed: "jan1", catalogue: G.catalogue, fixedClub: "2007/08:Derby" });
  D.chooseClub(st, S, S.relegated.find(r => r.c === d)); D.startSeason(st, S);
  let g = 0; const before = st.xi.slice();
  while (st.phase !== "summary" && g++ < 600) { if (st.phase === "window") D.pass(st, S); else D.playMatch(st, S); }
  const x = st.janRaid; assert.ok(x, "no raid");
  const jan = st.rolls.find(w => w.kind === "jan"); assert.strictEqual(x.gw, jan.gw);
  assert.ok(before.includes(x.id) && D.FORMATIONS[st.formation][x.slot][0] !== "GK");
  const H = D.historyTable(S, S.deductions); assert.ok(H.findIndex(r => r.c === x.club) < 10, "not a top-half club");
  assert.strictEqual(st.poached.filter(p => p.jan).length, 1);
  assert.ok(D.joinersOf(S, st, x.club, "2007-08-01") == null && D.joinersOf(S, st, x.club, x.date).length === 1, "joins only from the raid date");
  assert.ok((st.freeFill || []).some(f => f.slot === x.slot), "the empty shirt was filled at the window's close");
});
t("aging: a carried card keeps its number for a season, then loses 3 a season; the dressing room caps the XI's star lift", () => {
  assert.strictEqual(D.agedRating(93, 0), 93); assert.strictEqual(D.agedRating(93, 1), 93); assert.strictEqual(D.agedRating(93, 2), 90); assert.strictEqual(D.agedRating(93, 5), 81); assert.strictEqual(D.agedRating(60, 9), 55);
  const slots = D.FORMATIONS["4-4-2"].map(s => s[0]);
  const legends = slots.map((pos, i) => ({ id: i, r: 93, lv: 4, p: [pos] }));
  const S = { season: "x", clubs: [], matches: [], players: legends, relegated: [] };
  const st = { formation: "4-4-2", xi: legends.map(l => l.id), signed: [], tactic: "mid" };
  const L = D.userStrength(S, st, []);
  assert.ok(Math.abs(L.ovr - (93 + D.RULES.star.cap / 11)) < 1e-6, "cap not applied: " + L.ovr);
});
t("Club X Summer poach takes your best outfield player for certain", () => {
  const S = G.seasons["2013/14"]; S.legends = S.legends || [];
  const st = D.newRun({ seed: "pb", mode: "clubx", catalogue: [] });
  st.seasonKey = S.season; st.club = D.historyTable(S, S.deductions).slice(-1)[0].c; st.formation = "4-4-2"; st.career = 2;
  const best = S.players.filter(p => (p.a || 0) >= 10 && p.b !== "GK").sort((a, b) => b.r - a.r).slice(0, 10).map(p => p.id), gk = S.players.filter(p => p.b === "GK" && (p.a || 0) >= 10)[0].id;
  D.carryIn(st, S, [gk].concat(best));
  const out = D.poach(st, S); assert.strictEqual(out.length, 3); assert.strictEqual(out[0].id, best[0]);
});
console.log(`${n} checks passed`);
