const { chromium } = require('/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 } });
  // record sound + speech calls
  await ctx.addInitScript(() => {
    window.__ticks = 0; window.__said = [];
    const Orig = window.AudioContext;
    window.AudioContext = class extends Orig { createOscillator() { window.__ticks++; return super.createOscillator(); } };
    const synth = window.speechSynthesis;
    synth.speak = u => { window.__said.push(u.text); };
    synth.cancel = () => {};
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => { const u=r.request().url(); const f = u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : 'react/umd/react.production.min.js'; r.fulfill({ path: '/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/pw/node_modules/'+f, contentType:'text/javascript' }); });
  await p.goto('file:///tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/work/uxrun/index.html');
  let fails = 0; const ok = (n, c, x='') => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, x); };
  const order = () => p.evaluate(() => [...document.querySelectorAll('.stack button')].map(e => e.querySelector('.label > span').textContent).reverse().join(' | '));
  const seen = () => p.evaluate(() => ({ ticks: window.__ticks, said: window.__said.slice() }));

  // 1. run: items never move, any timing
  await p.locator('.stack button', { hasText: 'Preflight' }).click();
  const before = await order();
  await p.click('text=Check fuel'); await p.click('text=Check radio');
  const mid = await order(); await p.waitForTimeout(1500);
  const after = await order();
  ok('order unchanged right after ticking', before === mid, mid);
  ok('order unchanged after 1.5 s', before === after, after);
  ok('ticked items are dimmed with a tick', await p.locator('.stack button.done').count() === 2);
  await p.click('text=Check fuel'); ok('untick works in place', await p.locator('.stack button.done').count() === 1 && (await order()) === before);
  let s = await seen(); ok('defaults off: no sound and no voice', s.ticks === 0 && s.said.length === 0, JSON.stringify(s));
  await p.click('.bar button');

  // 2. creation: name -> feedback -> points. Defaults off, toggles preview, saved per checklist
  await p.click('text=+ New');
  await p.keyboard.type('Loud'); await p.keyboard.press('Enter');
  ok('feedback step after name', await p.locator('#fb-sound').count() === 1 && await p.locator('#fb-voice').count() === 1);
  ok('both off by default', (await p.textContent('#fb-sound')).includes('off') && (await p.textContent('#fb-voice')).includes('off'));
  await p.screenshot({ path: 'f-step.png' });
  await p.click('#fb-sound'); await p.click('#fb-voice');
  ok('both on', (await p.textContent('#fb-sound')).includes('on') && (await p.textContent('#fb-voice')).includes('on'));
  s = await seen(); ok('turning on previews tick and voice', s.ticks === 1 && s.said.join() === 'Confirmation cue on', JSON.stringify(s));
  await p.click('#fb-next');
  await p.keyboard.type('Alpha'); await p.keyboard.press('Enter');
  await p.keyboard.type('Beta'); await p.keyboard.press('Enter');
  await p.click('text=Save');

  // 3. a "Quiet" list with only sound, and the Loud list with both
  await p.click('text=+ New');
  await p.keyboard.type('Sound only'); await p.keyboard.press('Enter');
  await p.click('#fb-sound'); await p.click('#fb-next');
  await p.keyboard.type('One'); await p.keyboard.press('Enter');
  await p.click('text=Save');

  await p.evaluate(() => { window.__ticks = 0; window.__said = []; });
  await p.locator('.stack button', { hasText: 'Loud' }).click();
  await p.click('text=Alpha');
  s = await seen(); ok('Loud: tick plus the item said out loud', s.ticks === 1 && s.said.join() === 'Alpha', JSON.stringify(s));
  await p.click('text=Alpha'); // untick
  s = await seen(); ok('untick is silent', s.ticks === 1 && s.said.length === 1, JSON.stringify(s));
  await p.click('.bar button');

  await p.evaluate(() => { window.__ticks = 0; window.__said = []; });
  await p.locator('.stack button', { hasText: 'Sound only' }).click();
  await p.click('text=One');
  s = await seen(); ok('Sound only: tick, no voice', s.ticks === 1 && s.said.length === 0, JSON.stringify(s));
  await p.click('.bar button');

  // 4. quantity is spoken ("Shirts, 3"); x1 is not
  await p.locator('.stack > div', { hasText: 'Weekend trip' }).locator('text=edit').click();
  await p.click('h1'); await p.click('text=Next');
  await p.click('#fb-voice'); await p.click('#fb-next'); await p.click('text=Save');
  await p.evaluate(() => { window.__said = []; });
  await p.locator('.stack button', { hasText: 'Weekend trip' }).click();
  await p.keyboard.type('3'); await p.keyboard.press('Enter');
  await p.click('text=Shirts'); await p.click('text=Passport');
  s = await seen(); ok('quantity spoken when not 1', s.said.join('|') === 'Shirts, 3|Passport', JSON.stringify(s.said));
  await p.click('.bar button');

  // 5. settings survive reload (saved per list) and old lists default to off
  await p.reload();
  await p.locator('.stack > div', { hasText: 'Loud' }).locator('text=edit').click();
  await p.click('h1'); await p.click('text=Next');
  ok('Loud keeps sound+voice after reload', (await p.textContent('#fb-sound')).includes('on') && (await p.textContent('#fb-voice')).includes('on'));
  console.log('scroll', await p.evaluate(() => [document.documentElement.scrollHeight, innerHeight]), 'FAILS:', fails);
  await b.close();
})();
