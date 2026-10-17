const { chromium } = require('./pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => { const u=r.request().url(); const f = u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : 'react/umd/react.production.min.js'; r.fulfill({ path: process.cwd()+'/pw/node_modules/'+f, contentType:'text/javascript' }); });
  // old-format data (string items) must still load
  await p.addInitScript(() => { if (!localStorage.getItem('checklists')) localStorage.setItem('checklists', JSON.stringify([{ id: 'old', title: 'Old list', items: ['One', 'Two'] }])); });
  await p.goto('file:///home/user/checklist-app/index.html');
  await p.click('text=Old list');
  console.log('old format run:', await p.evaluate(() => [...document.querySelectorAll('.stack button')].map(e => e.innerText.replace(/\s+/g,' ').trim()).reverse().join(' | ')));
  await p.click('text=Close');

  await p.click('text=+ New');
  await p.keyboard.type('Shutdown'); await p.keyboard.press('Enter'); await p.click('#fb-next');
  for (const t of ['Mixture off','Switches off','Chock wheels']) { await p.keyboard.type(t); await p.keyboard.press('Enter'); }
  // tap an item -> entry switches to details mode
  await p.locator('.row', { hasText: 'Switches off' }).click();
  console.log('item step focused:', await p.evaluate(() => document.activeElement.id));
  await p.keyboard.type('Master, avionics, then magnetos'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  console.log('back on points, draft present:', await p.locator('#draft').count());
  await p.focus('#draft');
  await p.keyboard.type('Log hobbs time'); await p.keyboard.press('Enter');
  await p.screenshot({ path: 'e-edit.png' });
  const order = () => p.evaluate(() => [...document.querySelectorAll('.stack .row')].sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top).map(e => e.querySelector('.label > span').textContent).join(' | '));
  console.log('order:', await order());
  // drag the bottom item to the top (touch)
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const bx = async t => { const r = await p.locator('.row', { hasText: t }).boundingBox(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; };
  const a = await bx('Mixture off'), top = await bx('Log hobbs time');
  await touch('touchStart', a.x, a.y); await p.waitForTimeout(500);
  for (let k = 1; k <= 10; k++) { await touch('touchMove', a.x, a.y + (top.y - 5 - a.y) * k / 10); await p.waitForTimeout(16); }
  await touch('touchEnd');
  console.log('after drag:', await order());
  console.log('on points after drag:', await p.locator('#draft').count());
  await p.click('text=Save');
  await p.locator('.stack button', { hasText: 'Shutdown' }).click();
  console.log('run:', await p.evaluate(() => [...document.querySelectorAll('.stack button')].map(e => e.innerText.replace(/\s+/g,' ').trim()).reverse().join(' | ')));
  await p.screenshot({ path: 'e-run.png' });
  console.log('scroll', await p.evaluate(() => [document.documentElement.scrollHeight, innerHeight, document.documentElement.scrollWidth, innerWidth]));
  await b.close();
})();
