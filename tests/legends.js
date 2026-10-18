// The legend cards, built exactly as core/game.js builds them (one card per legend player-season, `lg` in the data), and
// attached to every season as S.legends so the tests and calibrations play the same game as the phone. Before 18 Oct 2026
// no test attached them, so every balance figure quoted until then was measured in a game with no legend cards.
module.exports = function attachLegends(G) {
  const out = [];
  for (const [sk, S] of Object.entries(G.seasons)) {
    const top = S.players.filter((p) => p.lg).slice().sort((a, b) => b.r - a.r || b.a - a.a);
    for (const p of top) {
      const main = p.c2 != null && (p.a2 || 0) > (p.a1 || 0) ? p.c2 : p.c;
      out.push({ id: "L:" + p.n + ":" + sk, k: p.k, n: p.n, b: p.b, p: p.p, r: p.r, lv: 4, a: p.a, g: p.g, as: p.as, cs: p.cs, s6: p.s6, nat: p.nat, c: null, cn: S.clubs[main].name, sk });
    }
  }
  out.sort((a, b) => b.r - a.r);
  const aliased = new Set();
  for (const l of out) if (!aliased.has(l.n)) { l.alias = "L:" + l.n; aliased.add(l.n); }
  for (const S of Object.values(G.seasons)) S.legends = out;
  return out;
};
