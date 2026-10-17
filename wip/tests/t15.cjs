const { chromium } = require('./pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => { const u=r.request().url(); const f = u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : 'react/umd/react.production.min.js'; r.fulfill({ path: process.cwd()+'/pw/node_modules/'+f, contentType:'text/javascript' }); });
  await p.goto('file:///home/user/checklist-app/index.html');
  const geo = sel => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }, sel);
  await p.click('text=+ New');
  console.log('name step  entry', await geo('.entry'), 'actions', await geo('.actions'), 'actions text:', await p.textContent('.actions'));
  await p.screenshot({ path: 'g-name.png' });
  await p.keyboard.type('Shutdown'); await p.keyboard.press('Enter'); await p.click('#fb-next');
  for (const t of ['Mixture off','Switches off','Chock wheels']) { await p.keyboard.type(t); await p.keyboard.press('Enter'); }
  console.log('points step stack', await geo('.stack'), 'entry', await geo('.entry'), 'actions', await geo('.actions'));
  console.log('actions order:', await p.locator('.actions button').allTextContents(), '| entry children:', await p.evaluate(() => [...document.querySelector('.entry').children].map(e => e.tagName)));
  await p.screenshot({ path: 'g-points.png' });
  // many items: stack shrinks, no scroll, entry/actions still visible
  for (let i = 1; i <= 9; i++) { await p.keyboard.type('Item ' + i); await p.keyboard.press('Enter'); }
  console.log('12 items   stack', await geo('.stack'), 'entry', await geo('.entry'), 'actions', await geo('.actions'), 'scroll', await p.evaluate(() => [document.documentElement.scrollHeight, innerHeight]));
  await p.screenshot({ path: 'g-many.png' });
  await p.click('text=Cancel');
  // existing list: Delete present inside actions
  await p.locator('.stack > div', { hasText: 'Preflight' }).locator('text=edit').click();
  console.log('edit existing actions:', await p.locator('.actions button').allTextContents());
  await b.close();
})();
