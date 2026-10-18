// Calibration: how the engine plays out with no signings, and how champions fare.
// node tests/calibrate.js [season] [club] [runs]   (ODDS='[b,s,g,p,l]' overrides RULES.levelOdds; POLICIES=average,greedy)
const D = require("../src/engine.js");
const { decide, POLICIES } = require("./policy.js");
if (process.env.ODDS) D.RULES.levelOdds = JSON.parse(process.env.ODDS);
if (process.env.ELITE) D.RULES.elite = JSON.parse(process.env.ELITE);
const G = require("../data/game/game.json");
require("./legends.js")(G);   // the legend cards, as the phone plays them
const [season = "2007/08", clubName = "Derby", runsArg = "200"] = process.argv.slice(2);
const S = G.seasons[season];
const club = S.clubs.find(c => c.name === clubName).id;
const rel = S.relegated.find(r => r.c === club) || { c: club, f: "4-4-2", xi: [] };
function run(seed, strategy) {
  const st = D.newRun({ seed, catalogue: G.catalogue, fixedClub: `${season}:${clubName}` });
  D.chooseClub(st, S, rel); D.startSeason(st, S);
  let guard = 0;
  const r = D.stream(seed, "policy");
  while (st.phase !== "summary" && guard++ < 500) {
    if (st.phase === "window") decide(st, S, strategy, r);
    else if (st.phase === "prematch") D.playMatch(st, S);
  }
  return st.final;
}
for (const strat of (process.env.POLICIES ? process.env.POLICIES.split(",") : POLICIES)) {
  const n = +runsArg, fin = [], pts = [], gf = [], ga = [];
  const t0 = Date.now();
  for (let i = 0; i < n; i++) { const f = run("cal" + i, strat); fin.push(f.finish); pts.push(f.pts); gf.push(f.gf); ga.push(f.ga); }
  const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  const share = p => (100 * fin.filter(p).length / n).toFixed(1) + "%";
  console.log(`${season} ${clubName} [${strat}] runs ${n} (${((Date.now()-t0)/n).toFixed(0)} ms/run): pts ${avg(pts)} gf ${avg(gf)} ga ${avg(ga)} finish ${avg(fin)} | survive ${share(f => f <= 17)} tophalf ${share(f => f <= 10)} top4 ${share(f => f <= 4)} title ${share(f => f === 1)}`);
}
const H = D.historyTable(S, S.deductions);
console.log("history:", H.slice(0, 3).map(r => S.clubs[r.c].name + " " + r.pts).join(", "), "...", H.slice(-3).map(r => S.clubs[r.c].name + " " + r.pts).join(", "));
