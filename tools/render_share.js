// The link preview image (WhatsApp, iMessage, Slack and so on): the intro's green backdrop with the full DROP2TOP logo
// in black, as the intro shows it (Craig, 12 Oct). Renders the built page's own backdrop and logo at 1200 x 630 and
// writes assets/share.jpg, which index.html points to with og:image. Run after python3 scripts/build.py:
//   node tools/render_share.js
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const ROOT = path.join(__dirname, '..');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForFunction(() => window.D2T && window.D2T.greenBackdrop && window.D2T.logo, null, { timeout: 15000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    document.body.innerHTML = `<div class="theme-green" style="position:fixed;inset:0;overflow:hidden">${window.D2T.greenBackdrop()}
      <div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);display:flex;justify-content:center;color:#0A0A0A">${window.D2T.logo('long', { style: 'width:900px' })}</div></div>`;
  });
  await p.waitForTimeout(800);
  const png = path.join(ROOT, 'assets', 'share.png');
  await p.screenshot({ path: png });
  await b.close();
  // a JPEG keeps it small (about 40 KB); WhatsApp skips previews over a few hundred KB
  execSync(`python3 -c "from PIL import Image; Image.open('${png}').convert('RGB').save('${path.join(ROOT, 'assets', 'share.jpg')}', quality=88, optimize=True, progressive=True)"`);
  require('fs').unlinkSync(png);
  console.log('assets/share.jpg written');
})();
