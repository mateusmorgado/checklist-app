const { chromium } = require('./pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => { const u=r.request().url(); const f = u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : 'react/umd/react.production.min.js'; r.fulfill({ path: process.cwd()+'/pw/node_modules/'+f, contentType:'text/javascript' }); });
  await p.goto('file:///home/user/checklist-app/index.html');
  const order = () => p.evaluate(() => [...document.querySelectorAll('.stack button')].map(e => e.innerText.replace(/\s+/g,' ').trim()).reverse().join(' | '));
  await p.click('text=Preflight');
  console.log('fresh run  :', await order());
  for (const t of ['Check fuel','Check flaps','Check radio','Check lights']) { await p.click('text='+t); await p.waitForTimeout(1150); }
  console.log('all ticked :', await order());
  await p.click('text=Check radio'); console.log('untick radio:', await order());
  await p.click('text=Check fuel'); console.log('untick fuel :', await order());
  await p.click('text=Check radio'); await p.waitForTimeout(1200); console.log('retick radio:', await order());
  await p.click('text=Close');
  await p.click('text=Preflight'); console.log('run again  :', await order());
  await b.close();
})();
