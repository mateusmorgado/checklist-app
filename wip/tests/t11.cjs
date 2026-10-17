const { chromium } = require('./pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => { const u=r.request().url(); const f = u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : 'react/umd/react.production.min.js'; r.fulfill({ path: process.cwd()+'/pw/node_modules/'+f, contentType:'text/javascript' }); });
  await p.goto('file:///home/user/checklist-app/index.html');
  await p.click('text=+ New');
  await p.keyboard.type('S'); await p.keyboard.press('Enter'); await p.click('#fb-next');
  for (const t of ['A','B','C']) { await p.keyboard.type(t); await p.keyboard.press('Enter'); }
  await p.locator('.row', { hasText: 'B' }).click(); await p.keyboard.type('zzz'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  await p.keyboard.type('D'); await p.keyboard.press('Enter');
  const order = () => p.evaluate(() => [...document.querySelectorAll('.stack .row')].sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top).map(e => e.querySelector('.label > span').textContent).join(''));
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const bx = async t => { const r = await p.locator('.row', { hasText: t }).boundingBox(); return { x: r.x + r.width/2, y: r.y + r.height/2, h: r.height }; };
  const a = await bx('A'), d = await bx('D');
  console.log('A', a, 'D', d);
  await touch('touchStart', a.x, a.y); await p.waitForTimeout(500);
  for (let k = 1; k <= 10; k++) { await touch('touchMove', a.x, a.y + (d.y - 5 - a.y) * k / 10); await p.waitForTimeout(k < 100 ? 16 : 0); console.log(k, await order()); }
  await touch('touchEnd');
  await b.close();
})();
