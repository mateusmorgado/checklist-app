const { chromium } = require('./pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  let fails = 0; const ok = (n, c, x='') => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, x); };
  const mk = async (opts = {}, init) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, colorScheme: opts.scheme || 'light' });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('PAGEERR', e.message));
    await p.route('https://fonts.googleapis.com/**', r => r.abort());
    await p.route('https://cdnjs.cloudflare.com/**', async r => { if (opts.delay) await new Promise(res => setTimeout(res, opts.delay)); const u=r.request().url(); const f = u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : 'react/umd/react.production.min.js'; r.fulfill({ path: process.cwd()+'/pw/node_modules/'+f, contentType:'text/javascript' }); });
    if (init) await p.addInitScript(init);
    return p;
  };
  const attrs = p => p.evaluate(() => { const r = document.documentElement; return [r.dataset.design, r.dataset.mode, r.dataset.effects].join('/'); });
  const bg = p => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const URL = 'file:///home/user/checklist-app/index.html';

  // 1. defaults + Settings screen
  let p = await mk();
  await p.goto(URL); await p.waitForSelector('#settings');
  ok('default design is classic/system/full', await attrs(p) === 'classic/system/full', await attrs(p));
  await p.click('#settings');
  ok('settings has three design choices', await p.locator('[role=radio]').count() === 3);
  ok('classic checked', await p.getAttribute('#design-classic', 'aria-checked') === 'true');
  await p.click('#design-airplane');
  ok('switching applies at once', await attrs(p) === 'airplane/system/full' && await p.getAttribute('#design-airplane', 'aria-checked') === 'true' && await p.getAttribute('#design-classic', 'aria-checked') === 'false', await attrs(p));
  ok('airplane background is dark', (await bg(p)) === 'rgb(5, 8, 11)', await bg(p));
  await p.click('#design-modern');
  ok('modern applies', await attrs(p) === 'modern/system/full' && (await bg(p)) === 'rgb(243, 236, 223)', await attrs(p) + ' ' + await bg(p));
  await p.click('#design-classic');
  await p.click('#set-mode'); ok('mode cycles to light', await attrs(p) === 'classic/light/full', await attrs(p));
  await p.click('#set-mode'); ok('mode cycles to dark', await attrs(p) === 'classic/dark/full' && (await bg(p)) === 'rgb(17, 17, 17)', await attrs(p));
  await p.click('#set-mode'); ok('mode cycles back to system', await attrs(p) === 'classic/system/full');
  await p.click('#set-effects'); ok('effects reduced', await attrs(p) === 'classic/system/reduced');
  await p.click('#design-modern'); await p.click('#set-effects');
  console.log('screen:', await p.evaluate(() => document.querySelector('h1').textContent));

  // 2. persistence across reload
  await p.reload(); await p.waitForSelector('#settings');
  ok('design survives reload', (await attrs(p)).startsWith('modern/'), await attrs(p));
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('settings')));
  ok('stored shape', stored.design === 'modern' && stored.tone.choice === 'tick' && stored.ai.model === 'claude-haiku-5-5' && stored.ai.endpoint === 'https://api.anthropic.com', JSON.stringify(stored));
  await p.context().close();

  // 3. OS dark honoured in system mode, forced light overrides it
  p = await mk({ scheme: 'dark' }); await p.goto(URL); await p.waitForSelector('#settings');
  ok('system mode follows OS dark', (await bg(p)) === 'rgb(17, 17, 17)', await bg(p));
  await p.click('#settings'); await p.click('#set-mode');
  ok('forced light overrides OS dark', await attrs(p) === 'classic/light/full' && (await bg(p)) === 'rgb(255, 255, 255)', await attrs(p) + ' ' + await bg(p));
  await p.context().close();

  // 4. airplane stays dark regardless of mode / OS light
  p = await mk({ scheme: 'light' }, () => localStorage.setItem('settings', JSON.stringify({ design: 'airplane', mode: 'light' })));
  await p.goto(URL); await p.waitForSelector('#settings');
  ok('airplane ignores light mode', (await bg(p)) === 'rgb(5, 8, 11)', await bg(p));
  await p.context().close();

  // 5. corrupt / hostile storage falls back safely
  const bad = [
    ['not json', () => localStorage.setItem('settings', '{oops')],
    ['wrong types', () => localStorage.setItem('settings', JSON.stringify({ design: 7, mode: [], effects: {}, tone: 'x', ai: 5 }))],
    ['unknown values', () => localStorage.setItem('settings', JSON.stringify({ design: 'neon', mode: 'sepia', effects: 'max', tone: { choice: 'boom', volume: 'ear-bleed' } }))],
    ['null', () => localStorage.setItem('settings', 'null')],
    ['huge key', () => localStorage.setItem('settings', JSON.stringify({ ai: { key: 'k'.repeat(100000), model: 'm'.repeat(5000), endpoint: '' } }))],
  ];
  for (const [name, init] of bad) {
    p = await mk({}, init); await p.goto(URL); await p.waitForSelector('#settings');
    const a = await attrs(p);
    ok(`corrupt settings (${name}) -> classic defaults`, a === 'classic/system/full', a);
    if (name === 'huge key') { await p.click('#settings'); const s = await p.evaluate(() => JSON.parse(localStorage.getItem('settings'))); ok('huge values are capped', s.ai.key.length === 300 && s.ai.model.length === 100, `${s.ai.key.length}/${s.ai.model.length}/${s.ai.endpoint}`); }
    await p.context().close();
  }

  // 6. storage blocked entirely
  p = await mk({}, () => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }); });
  await p.goto(URL); await p.waitForSelector('#settings');
  await p.click('#settings'); await p.click('#design-airplane');
  ok('works with storage blocked (applies, no crash)', await attrs(p) === 'airplane/system/full', await attrs(p));
  await p.context().close();

  // 7. no flash of the wrong design: attributes and background are right before React loads
  p = await mk({ delay: 1500 }, () => localStorage.setItem('settings', JSON.stringify({ design: 'airplane' })));
  p.goto(URL, { waitUntil: 'commit' }).catch(() => {}); await p.waitForTimeout(700);
  ok('before React: attribute + dark background already set', (await attrs(p)).startsWith('airplane') && (await bg(p)) === 'rgb(5, 8, 11)', await attrs(p) + ' ' + await bg(p));
  ok('before React: #root still empty', await p.evaluate(() => document.getElementById('root').children.length) === 0);
  await p.context().close();

  // 8. settings sub-screens navigate and return
  p = await mk(); await p.goto(URL); await p.waitForSelector('#settings'); await p.click('#settings');
  await p.click('#set-tone'); ok('tone screen', await p.locator('#tone-back').count() === 1); await p.click('#tone-back'); ok('back to settings', await p.locator('#design-classic').count() === 1);
  await p.click('#set-ai'); ok('quick-list settings screen', await p.locator('#ai-back').count() === 1); await p.click('#ai-back');
  await p.click('#set-refs'); ok('references from settings', (await p.textContent('h1')) === 'References'); await p.click('#refs-back'); ok('back to settings from references', await p.locator('#design-classic').count() === 1);
  await p.click('#settings-back'); ok('back to home', await p.locator('#new').count() === 1);
  await p.click('#quick'); ok('quick list screen opens', await p.locator('#quick-back').count() === 1); await p.click('#quick-back');
  console.log('scroll', await p.evaluate(() => [document.documentElement.scrollHeight, innerHeight]), 'FAILS:', fails);
  await b.close();
})();
