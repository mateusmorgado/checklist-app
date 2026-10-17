const { chromium } = require('./pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => { const u=r.request().url(); const f = u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : 'react/umd/react.production.min.js'; r.fulfill({ path: process.cwd()+'/pw/node_modules/'+f, contentType:'text/javascript' }); });
  await p.goto('file:///home/user/checklist-app/index.html');
  let fails = 0; const ok = (name, cond, extra='') => { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, extra); };

  // --- evalQty unit checks
  const ev = (e, v) => p.evaluate(([e, v]) => { try { return evalQty(e, v); } catch (x) { return 'ERR:' + x.message; } }, [e, v]);
  ok('nights+1', await ev('nights + 1', { nights: 3 }) === 4);
  ok('ceil(nights/2)+1', await ev('ceil(nights/2)+1', { nights: 3 }) === 3);
  ok('precedence', await ev('2 + 3 * 4', {}) === 14);
  ok('parens', await ev('(2 + 3) * 4', {}) === 20);
  ok('unary minus', await ev('-2 * 3 + 10', {}) === 4);
  ok('min/max', await ev('min(3, nights) + max(1, 2)', { nights: 5 }) === 5);
  ok('case-insensitive names', await ev('Nights * 2', { nights: 2 }) === 4);
  ok('unknown name errors', String(await ev('foo + 1', {})).startsWith('ERR:'));
  ok('bad syntax errors', String(await ev('2 +', {})).startsWith('ERR:'));
  ok('unknown fn errors', String(await ev('sqrt(4)', {})).startsWith('ERR:'));
  ok('div by zero errors', String(await ev('1 / 0', {})).startsWith('ERR:'));
  ok('no eval/Function in source', !(await p.evaluate(() => /\beval\s*\(|new Function/.test(document.documentElement.innerHTML.split('<script>')[1] || ''))));

  const stackText = () => p.evaluate(() => [...document.querySelectorAll('.stack button')].map(e => e.innerText.replace(/\s+/g,' ').trim()).reverse().join(' | '));
  // --- sample "Weekend trip": ask screen, quantities
  await p.locator('.stack button', { hasText: 'Weekend trip' }).click();
  ok('ask screen shows question', (await p.textContent('h1')) === 'How many nights?', await p.textContent('h1'));
  ok('answer field focused with default 1', await p.evaluate(() => document.activeElement.id + '=' + document.activeElement.value) === 'answer=1');
  await p.keyboard.type('3'); await p.keyboard.press('Enter');
  console.log('run:', await stackText());
  ok('quantities', (await stackText()).includes('Shirts ×3') && (await stackText()).includes('Socks ×4'));
  await p.screenshot({ path: 'q-run.png' });
  // required: Done only after required (Charger, Passport) ticked
  const hasDone = () => p.locator('.bar button', { hasText: 'Done' }).count();
  ok('no Done at start', await hasDone() === 0);
  await p.click('text=Charger'); ok('no Done after one required', await hasDone() === 0);
  await p.click('text=Passport'); ok('Done after both required (others skipped)', await hasDone() === 1);
  await p.click('text=Done');
  // answer 0 drops quantity items
  await p.locator('.stack button', { hasText: 'Weekend trip' }).click();
  await p.keyboard.type('0'); await p.keyboard.press('Enter');
  const z = await stackText(); console.log('nights=0:', z);
  ok('qty 0 items dropped (Shirts gone, Socks = nights+1 = 1, shown without ×1)', !z.includes('Shirts') && (z.includes('Socks') && !z.includes('Socks ×')) && z.includes('Charger'));
  await p.click('text=Close');
  // list without questions skips ask
  await p.locator('.stack button', { hasText: 'Leaving home' }).click();
  ok('no ask for list without questions', (await p.locator('#answer').count()) === 0 && (await stackText()).includes('Keys'));
  await p.click('text=Close');

  // --- editor: build a new list with a question + quantity + required
  await p.click('text=+ New');
  await p.keyboard.type('Camping'); await p.keyboard.press('Enter'); await p.click('#fb-next');
  await p.keyboard.type('Tent'); await p.keyboard.press('Enter');
  await p.keyboard.type('Water bottles'); await p.keyboard.press('Enter');
  // questions step (sentence flow): + Question -> Number -> people -> then (nothing) -> list
  await p.click('text=Questions'); await p.click('#add-question'); await p.click('#type-number');
  await p.keyboard.type('people'); await p.keyboard.press('Enter');
  await p.keyboard.press('Enter');
  ok('question listed as a sentence', (await p.locator('.stack > div').first().textContent()).includes('How many people'), await p.locator('.stack > div').first().textContent());
  await p.click('text=Back');
  // item step on Water bottles
  await p.locator('.row', { hasText: 'Water bottles' }).click();
  ok('item step focuses details', await p.evaluate(() => document.activeElement.id) === 'field');
  await p.keyboard.type('One litre each'); await p.keyboard.press('Enter');
  await p.keyboard.type('foo * 2');
  ok('invalid formula shown', (await p.textContent('.hint.err')).includes('Unknown name'), await p.textContent('.hint'));
  await p.fill('#field', 'people * 2 + 1');
  ok('live preview', (await p.textContent('.hint')).startsWith('= 3'), await p.textContent('.hint'));
  await p.click('text=Required: no'); ok('required toggled', await p.locator('text=Required: yes').count() === 1);
  await p.screenshot({ path: 'q-item.png' });
  await p.keyboard.press('Enter'); // back to points
  const note = await p.locator('.row', { hasText: 'Water bottles' }).locator('.detail').textContent();
  ok('points row note', note === 'required · × people * 2 + 1 · One litre each', note);
  // Save blocked on bad formula
  await p.locator('.row', { hasText: 'Tent' }).click();
  await p.keyboard.press('Enter'); await p.keyboard.type('nope'); await p.keyboard.press('Enter');
  await p.click('text=Save');
  ok('save blocked on bad formula', (await p.locator('.hint.err').textContent()).includes('Tent'), await p.locator('.hint.err').textContent());
  await p.locator('.row', { hasText: 'Tent' }).click(); await p.keyboard.press('Enter'); await p.fill('#field', ''); await p.keyboard.press('Enter');
  await p.click('text=Save');
  ok('saved after fix', await p.locator('.stack button', { hasText: 'Camping' }).count() === 1);
  await p.locator('.stack button', { hasText: 'Camping' }).click();
  await p.keyboard.type('4'); await p.keyboard.press('Enter');
  const c = await stackText(); console.log('camping run:', c);
  ok('camping quantity 9', c.includes('Water bottles ×9') && c.includes('required'));
  await p.click('text=Close');
  console.log('scroll', await p.evaluate(() => [document.documentElement.scrollHeight, innerHeight]));
  console.log('FAILS:', fails);
  await b.close();
})();
