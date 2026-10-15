// iOS Home Screen launch pictures: the intro's first frame (the green and its beams, before the logo fades in) for each
// iPhone screen size, into assets/splash with splash.json, which scripts/build.py turns into apple-touch-startup-image
// links. Run after a build if the intro's green changes:  node tools/render_splash.js
const path = require("path"), fs = require("fs");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright")); }
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "assets", "splash");
// portrait CSS sizes and pixel ratios of the iPhones in use (SE to 16 Pro Max)
const PHONES = [[375, 667, 2], [414, 736, 3], [375, 812, 3], [414, 896, 2], [414, 896, 3], [360, 780, 3], [390, 844, 3],
  [428, 926, 3], [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3]];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const list = [];
  for (const [w, h, dpr] of PHONES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
    await page.goto("file://" + path.join(ROOT, "index.html"));
    await page.waitForSelector(".fr-intro");
    await page.evaluate(() => {
      document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 0; });
      document.querySelectorAll(".fr-skip, .fr-stage, .fr-slogan").forEach((e) => { e.style.visibility = "hidden"; });
    });
    await page.waitForTimeout(100);
    const file = `splash-${w * dpr}x${h * dpr}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    list.push({ file, w, h, dpr });
    await page.close();
  }
  fs.writeFileSync(path.join(OUT, "splash.json"), JSON.stringify(list, null, 1) + "\n");
  await browser.close();
  console.log("splash pictures:", list.length);
})();
