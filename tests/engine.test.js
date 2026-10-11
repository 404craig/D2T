// Engine checks: node tests/engine.test.js
const assert = require("assert");
const D = require("../src/engine.js");
const G = require("../data/game/game.json");
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
const draft = (seed, c, formation) => {
  const S = G.seasons[c.season], id = S.clubs.find(x => x.name === c.club).id;
  const st = D.newRun({ seed, mode: "dare2dream", catalogue: G.clubSeasons });
  D.chooseClub(st, S, { c: id, f: "4-4-2", xi: [] });
  if (formation) assert.ok(D.draftFormation(st, S, formation));
  while (st.phase === "draft") {
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
console.log(`${n} checks passed`);
