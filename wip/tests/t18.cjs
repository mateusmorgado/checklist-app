const { chromium } = require('./pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => { const u=r.request().url(); const f = u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : 'react/umd/react.production.min.js'; r.fulfill({ path: process.cwd()+'/pw/node_modules/'+f, contentType:'text/javascript' }); });
  // old saved question without a type must still work (treated as number)
  await p.addInitScript(() => { if (!localStorage.getItem('checklists')) localStorage.setItem('checklists', JSON.stringify([
    { id: 'o', title: 'Old trip', questions: [{ id: 'q', name: 'nights', label: 'Nights?' }], items: [{ text: 'Shirts', qty: 'nights' }] }])); });
  await p.goto('file:///home/user/checklist-app/index.html');
  let fails = 0; const ok = (n, c, x='') => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, x); };
  const stackText = () => p.evaluate(() => [...document.querySelectorAll('.stack button')].map(e => e.innerText.replace(/\s+/g,' ').trim()).reverse().join(' | '));

  await p.locator('.stack button', { hasText: 'Old trip' }).click();
  ok('old untyped question is a number question', await p.locator('#answer').count() === 1);
  await p.keyboard.type('2'); await p.keyboard.press('Enter');
  ok('old list quantity', (await stackText()).includes('Shirts ×2'), await stackText());
  await p.click('text=Close');

  // build "Pool" list in the editor with a yes/no question
  await p.click('text=+ New');
  await p.keyboard.type('Pool'); await p.keyboard.press('Enter'); await p.click('#fb-next');
  await p.keyboard.type('Goggles'); await p.keyboard.press('Enter');
  await p.click('text=Questions');
  await p.click('#add-question');
  ok('type stage has no entry field', await p.locator('input').count() === 0 && (await p.textContent('.hint')) === 'Question type');
  await p.click('#type-yesno');
  ok('cond stage hint', (await p.textContent('.hint')) === 'Question: if…', await p.textContent('.hint'));
  ok('cond field focused with placeholder', await p.evaluate(() => document.activeElement.id + '|' + document.activeElement.placeholder) === 'qdraft|I go to the sauna');
  await p.keyboard.type('I go to the sauna'); await p.keyboard.press('Enter');
  ok('then stage heading + hint', (await p.textContent('h1')) === 'If I go to the sauna' && (await p.textContent('.hint')) === 'then… (add ____)', await p.textContent('h1') + ' / ' + await p.textContent('.hint'));
  ok('then field focused', await p.evaluate(() => document.activeElement.id) === 'qthen');
  await p.keyboard.type('Towel'); await p.keyboard.press('Enter');
  await p.keyboard.type('Flip flops'); await p.keyboard.press('Enter');
  ok('added items listed under the sentence', (await p.locator('.stack > div').allTextContents()).join('|').includes('Towel') && (await p.locator('.stack > div').count()) === 2);
  await p.keyboard.press('Enter'); // empty enter finishes
  const row = await p.locator('.stack > div').first().textContent();
  ok('list row shows sentence and linked items', row.includes('If I go to the sauna') && row.includes('then add Towel, Flip flops'), row);
  await p.click('text=Back');
  const note = await p.locator('.row', { hasText: 'Towel' }).locator('.detail').textContent();
  ok('linked item quantity is the answer', note === '× sauna', note);
  await p.click('text=Save');

  // run: answer No, then Yes
  await p.locator('.stack button', { hasText: 'Pool' }).click();
  ok('yes/no screen shows buttons, no input', await p.locator('#yes').count() === 1 && await p.locator('#no').count() === 1 && await p.locator('#answer').count() === 0);
  ok('question label', (await p.textContent('h1')) === 'I go to the sauna?', await p.textContent('h1'));
  await p.screenshot({ path: 'y-ask.png' });
  await p.click('#no');
  const no = await stackText(); console.log('No :', no);
  ok('No drops the towel and flip flops', no.includes('Goggles') && !no.includes('Towel') && !no.includes('Flip'));
  await p.click('text=Close');
  await p.locator('.stack button', { hasText: 'Pool' }).click();
  await p.click('#yes');
  const yes = await stackText(); console.log('Yes:', yes);
  ok('Yes shows towel + flip flops without ×1', yes.includes('Towel') && yes.includes('Flip flops') && !yes.includes('×'));
  await p.click('text=Close');

  // mixed: number + yes/no in one list, Back works
  await p.click('text=+ New');
  await p.keyboard.type('Mix'); await p.keyboard.press('Enter'); await p.click('#fb-next');
  await p.keyboard.type('Thing'); await p.keyboard.press('Enter');
  await p.click('text=Questions');
  await p.click('#add-question'); await p.click('#type-number'); await p.keyboard.type('days'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  await p.click('#add-question'); await p.click('#type-yesno'); await p.keyboard.type('rain'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  await p.click('text=Back');
  await p.click('text=Save');
  await p.locator('.stack button', { hasText: 'Mix' }).click();
  ok('first question is the number', (await p.textContent('h1')) === 'How many days?' && await p.locator('#answer').count() === 1);
  await p.keyboard.press('Enter');
  ok('second question is yes/no', (await p.textContent('h1')) === 'Rain?' && await p.locator('#yes').count() === 1);
  await p.click('text=Back');
  ok('Back returns to the number question', (await p.textContent('h1')) === 'How many days?');
  await p.keyboard.press('Enter'); await p.click('#yes');
  ok('run starts after last answer', (await stackText()).includes('Thing'), await stackText());
  console.log('scroll', await p.evaluate(() => [document.documentElement.scrollHeight, innerHeight]), 'FAILS:', fails);
  await b.close();
})();
