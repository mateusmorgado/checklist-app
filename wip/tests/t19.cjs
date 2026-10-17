const { chromium } = require('./pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 360, height: 640 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('https://cdnjs.cloudflare.com/**', r => { const u=r.request().url(); const f = u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : 'react/umd/react.production.min.js'; r.fulfill({ path: process.cwd()+'/pw/node_modules/'+f, contentType:'text/javascript' }); });
  await p.goto('file:///home/user/checklist-app/index.html');
  let fails = 0; const ok = (n, c, x='') => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, x); };
  const stackText = () => p.evaluate(() => [...document.querySelectorAll('.stack button')].map(e => e.innerText.replace(/\s+/g,' ').trim()).reverse().join(' | '));
  const noScroll = async n => ok('no scroll: ' + n, await p.evaluate(() => document.documentElement.scrollHeight === innerHeight));

  // edit the sample Gym list: existing questions render as sentences
  await p.locator('.stack > div', { hasText: 'Gym' }).locator('text=edit').click();
  await p.click('text=Questions');
  const row = await p.locator('.stack > div').first().textContent();
  ok('sample question row', row.includes('If I go to the sauna') && row.includes('then add Towel'), row);
  await noScroll('questions list');
  await p.screenshot({ path: 'z-list.png' });
  // cancel on type and cond leaves nothing behind
  await p.click('#add-question'); await noScroll('type stage'); await p.screenshot({ path: 'z-type.png' }); await p.click('text=Cancel');
  ok('cancel at type: still 1 question', await p.locator('.stack > div').count() === 1);
  await p.click('#add-question'); await p.click('#type-number'); await p.keyboard.type('x'); await p.click('text=Cancel');
  ok('cancel at cond: still 1 question', await p.locator('.stack > div').count() === 1);
  // number question with "how many" prefix typed by the user, then add an item
  await p.click('#add-question'); await p.click('#type-number');
  ok('number hint', (await p.textContent('.hint')) === 'Question: how many…');
  await p.keyboard.type('How many Nights'); await p.keyboard.press('Enter');
  ok('prefix stripped, name = nights, hint shows quantity', (await p.textContent('h1')) === 'How many Nights' && (await p.textContent('.hint')).includes('quantity = nights'), await p.textContent('h1') + ' / ' + await p.textContent('.hint'));
  await p.keyboard.type('Shirts'); await p.keyboard.press('Enter');
  await noScroll('then stage'); await p.screenshot({ path: 'z-then.png' });
  await p.click('text=Done');
  // same last word -> unique name
  await p.click('#add-question'); await p.click('#type-yesno'); await p.keyboard.type('I go swimming at night'); await p.keyboard.press('Enter'); await p.keyboard.type('Cap'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  await p.click('#add-question'); await p.click('#type-yesno'); await p.keyboard.type('a late night'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  // 'night' used twice -> second becomes night2; 'min' style word gets a suffix
  await p.click('#add-question'); await p.click('#type-number'); await p.keyboard.type('min'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  await p.click('text=Back');
  await p.click('text=Save');
  // run gym: answers sauna yes, nights 2 ...
  await p.locator('.stack button', { hasText: 'Gym' }).click();
  const asked = []; 
  for (let k = 0; k < 6; k++) {
    const h1 = await p.textContent('h1').catch(() => null);
    if (!h1 || !(await p.locator('#answer, #yes').count())) break;
    asked.push(h1);
    if (await p.locator('#yes').count()) await p.click('#yes'); else { await p.keyboard.type('2'); await p.keyboard.press('Enter'); }
  }
  console.log('asked:', asked.join(' | '));
  ok('all five questions asked', asked.length === 5);
  const run = await stackText(); console.log('run:', run);
  ok('quantity from number question, yes items shown', run.includes('Shirts ×2') && run.includes('Towel') && run.includes('Cap'), run);
  await p.click('text=Close');

  // removing a question clears its linked quantity, items stay
  await p.locator('.stack > div', { hasText: 'Gym' }).locator('text=edit').click();
  await p.click('text=Questions');
  await p.locator('.stack > div', { hasText: 'I go to the sauna' }).locator('.x').click();
  ok('question removed', await p.locator('.stack > div', { hasText: 'I go to the sauna' }).count() === 0);
  await p.click('text=Back');
  const note = await p.locator('.row', { hasText: 'Towel' }).locator('.detail').textContent().catch(() => '');
  ok('towel stays as a plain item (no formula, only its detail)', !note.includes('×'), JSON.stringify(note));
  await p.click('text=Save');
  await p.locator('.stack button', { hasText: 'Gym' }).click();
  for (let k = 0; k < 6 && await p.locator('#answer, #yes').count(); k++) { if (await p.locator('#yes').count()) await p.click('#no'); else { await p.keyboard.type('1'); await p.keyboard.press('Enter'); } }
  ok('towel still in run even when every answer is No', (await stackText()).includes('Towel'), await stackText());
  console.log('FAILS:', fails);
  await b.close();
})();
