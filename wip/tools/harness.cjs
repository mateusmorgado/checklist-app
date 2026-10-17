// Shared test harness. Usage:
//   const { openApp, closeAll } = require('/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/harness.cjs');
//   const { page, ctx, browser } = await openApp('/abs/path/index.html', { width: 390, height: 780, settings: { design: 'modern' }, colorScheme: 'light', reducedMotion: 'no-preference', touch: false, init: () => {...}, storage: { checklists: [...] } });
// React comes from local node_modules (CDN is not reachable). Google Fonts requests are answered from local
// @fontsource files, so screenshots show the real typefaces. Other network is blocked unless routes are added.
const path = require('path');
const fs = require('fs');
const ROOT = __dirname;
const NM = path.join(ROOT, 'pw', 'node_modules');
const { chromium } = require(path.join(NM, 'playwright-core'));
const FONTS = {
  'B612': ['b612', [400, 700]], 'B612 Mono': ['b612-mono', [400, 700]],
  'Bricolage Grotesque': ['bricolage-grotesque', [400, 500, 700, 800]], 'Space Grotesk': ['space-grotesk', [400, 500, 700]],
};
function fontCss() {
  let css = '';
  for (const [family, [dir, weights]] of Object.entries(FONTS))
    for (const w of weights) css += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(https://fonts.gstatic.com/local/${dir}-latin-${w}-normal.woff2) format('woff2');}\n`;
  return css;
}
const browsers = [];
async function openApp(file, o = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', ...(o.args || [])] });
  browsers.push(browser);
  const ctx = await browser.newContext({
    viewport: { width: o.width || 390, height: o.height || 780 },
    colorScheme: o.colorScheme || 'light',
    reducedMotion: o.reducedMotion || 'reduce',
    forcedColors: o.forcedColors || 'none',
    hasTouch: !!o.touch, isMobile: false,
    deviceScaleFactor: o.dpr || 1,
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => { (o.errors || console.log)('PAGEERR ' + e.message); });
  page.on('console', m => { if (m.type() === 'error' && o.logConsole) console.log('CONSOLE.ERROR', m.text()); });
  await page.route('https://cdnjs.cloudflare.com/**', r => {
    const u = r.request().url();
    const f = u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : 'react/umd/react.production.min.js';
    r.fulfill({ path: path.join(NM, f), contentType: 'text/javascript' });
  });
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: fontCss() }));
  await page.route('https://fonts.gstatic.com/local/**', r => {
    const f = path.join(NM, '@fontsource', r.request().url().split('/local/')[1].replace(/-latin-.*$/, ''), 'files', r.request().url().split('/local/')[1]);
    fs.existsSync(f) ? r.fulfill({ path: f, contentType: 'font/woff2' }) : r.abort();
  });
  await page.addInitScript(([settings, storage, once]) => {
    const seeded = sessionStorage.getItem('__seeded');
    if (once && seeded) return;
    sessionStorage.setItem('__seeded', '1');
    try {
      if (settings) localStorage.setItem('settings', JSON.stringify(settings));
      for (const [k, v] of Object.entries(storage || {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    } catch (e) {}
  }, [o.settings || null, o.storage || null, !!o.seedOnce]);
  if (o.init) await page.addInitScript(o.init, o.initArg);
  await page.goto('file://' + file);
  if (!o.noWait) await page.waitForSelector('#new, .screen', { timeout: 30000 });
  return { page, ctx, browser };
}
async function closeAll() { for (const b of browsers.splice(0)) await b.close().catch(() => {}); }
module.exports = { openApp, closeAll, ROOT, NM };
