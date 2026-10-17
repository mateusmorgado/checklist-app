// usage: node shots.cjs <html file> <outdir> [design] [mode]
const { chromium } = require('./pw/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const [file, out, design = 'classic', mode = 'light', w = '390', h = '780'] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, colorScheme: mode === 'dark' ? 'dark' : 'light', reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.route('https://cdnjs.cloudflare.com/**', r => { const u = r.request().url(); const f = u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : 'react/umd/react.production.min.js'; r.fulfill({ path: process.cwd() + '/pw/node_modules/' + f, contentType: 'text/javascript' }); });
  await p.route('https://fonts.googleapis.com/**', r => r.abort());
  await p.addInitScript(([d, m]) => { if (!localStorage.getItem('settings')) localStorage.setItem('settings', JSON.stringify({ design: d, mode: m })); }, [design, mode]);
  await p.goto('file://' + file);
  await p.waitForSelector('text=+ New');
  const shot = n => p.screenshot({ path: `${out}/${n}.png` });
  await shot('01-home');
  await p.locator('.stack button', { hasText: 'Preflight' }).click(); await p.click('text=Check fuel'); await shot('02-run'); await p.click('.bar button');
  await p.locator('.stack button', { hasText: 'Weekend trip' }).click(); await shot('03-ask-number'); await p.keyboard.type('3'); await p.keyboard.press('Enter'); await shot('04-run-qty'); await p.click('.bar button');
  await p.locator('.stack button', { hasText: 'Gym' }).click(); await shot('05-ask-yesno'); await p.click('#yes'); await p.click('.bar button');
  await p.click('text=+ New'); await shot('06-edit-name'); await p.keyboard.type('Shutdown'); await p.keyboard.press('Enter'); await shot('07-edit-feedback');
  await p.click('#fb-sound'); await p.click('#fb-next'); for (const t of ['Mixture off', 'Switches off', 'Chock wheels']) { await p.keyboard.type(t); await p.keyboard.press('Enter'); }
  await shot('08-edit-points'); await p.locator('.row', { hasText: 'Switches off' }).click(); await p.keyboard.type('Master, avionics'); await shot('09-edit-item'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  await p.click('text=Questions'); await shot('10-questions'); await p.click('#add-question'); await shot('11-question-type'); await p.click('#type-yesno'); await p.keyboard.type('I land at night'); await shot('12-question-cond'); await p.keyboard.press('Enter'); await p.keyboard.type('Landing light'); await p.keyboard.press('Enter'); await shot('13-question-then'); await p.keyboard.press('Enter');
  await p.click('text=Back'); await p.click('text=Cancel');
  if (await p.locator('#settings').count()) { await p.click('#settings'); await shot('14-settings'); await p.click('#set-refs'); await shot('15-references'); }
  await b.close();
})();
