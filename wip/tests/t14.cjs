const { chromium } = require('./pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => { const u=r.request().url(); const f = u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : 'react/umd/react.production.min.js'; r.fulfill({ path: process.cwd()+'/pw/node_modules/'+f, contentType:'text/javascript' }); });
  await p.goto('file:///home/user/checklist-app/index.html');
  const active = () => p.evaluate(() => document.activeElement.id);
  const has = sel => p.locator(sel).count();
  await p.click('text=+ New');
  console.log('step1: title field', await has('#title'), '| draft field', await has('#draft'), '| focused', await active());
  await p.screenshot({ path: 'n-step1.png' });
  await p.click('text=Next');
  console.log('blank Next stays on step1:', await has('#title'));
  await p.keyboard.type('Shutdown'); await p.keyboard.press('Enter');
  console.log('feedback step after name:', await p.locator('#fb-sound').count(), await p.locator('#title').count(), await p.locator('#draft').count());
  await p.click('#fb-next');
  console.log('step2: title field', await has('#title'), '| draft field', await has('#draft'), '| focused', await active(), '| heading', await p.textContent('h1'));
  for (const t of ['Mixture off','Switches off']) { await p.keyboard.type(t); await p.keyboard.press('Enter'); }
  await p.screenshot({ path: 'n-step2.png' });
  await p.click('h1');
  console.log('back to name:', await p.inputValue('#title'), '| focused', await active());
  await p.click('text=Next'); await p.click('#fb-next');
  console.log('items kept:', await p.locator('.stack .row').count());
  await p.click('text=Cancel');
  console.log('cancel -> home:', await has('text=+ New'));
  // new list: tap Next button path, then Save
  await p.click('text=+ New'); await p.keyboard.type('Second'); await p.click('text=Next'); await p.click('#fb-next');
  await p.keyboard.type('Only item'); await p.click('text=Save');
  console.log('saved lists:', await p.locator('.stack button:not(.hint)').allTextContents());
  // existing list opens on points page
  await p.locator('.stack > div', { hasText: 'Second' }).locator('text=edit').click();
  console.log('edit existing: title field', await has('#title'), '| draft', await has('#draft'), '| focused', await active(), '| heading', await p.textContent('h1'));
  await p.click('text=Cancel');
  console.log('scroll', await p.evaluate(() => [document.documentElement.scrollHeight, innerHeight]));
  await b.close();
})();
