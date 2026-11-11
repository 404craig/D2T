// Render the high-resolution crests (assets/crests/hi, from tools/fetch_crests_hi.py) to 256px PNGs in assets/crests/256,
// the size the game ships for big crests (Unbeaten Run's shirts). SVGs are drawn by Chromium on a transparent page;
// clubs the badge library only has as 200px PNGs are copied as they are (never upscaled).
// node tools/render_crests.js
const fs = require("fs"), path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright")); }
const HI = path.join(__dirname, "..", "assets", "crests", "hi"), OUT = path.join(__dirname, "..", "assets", "crests", "256");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 1 });
  let svg = 0, png = 0;
  for (const f of fs.readdirSync(HI).sort()) {
    const name = f.replace(/\.(svg|png)$/, ""), src = path.join(HI, f);
    if (f.endsWith(".png")) { fs.copyFileSync(src, path.join(OUT, name + ".png")); png++; continue; }
    const uri = "data:image/svg+xml;base64," + fs.readFileSync(src).toString("base64");
    await page.setContent(`<html><body style="margin:0;background:transparent"><img id="c" src="${uri}" style="display:block;width:256px;height:256px;object-fit:contain"></body></html>`);
    await page.waitForFunction(() => document.getElementById("c").complete);
    await page.screenshot({ path: path.join(OUT, name + ".png"), omitBackground: true, clip: { x: 0, y: 0, width: 256, height: 256 } });
    svg++;
  }
  await browser.close();
  console.log(`${svg} rendered from SVG, ${png} copied: ${OUT}`);
})();
