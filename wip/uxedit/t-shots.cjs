const L = require('./lib.cjs');
const gym = { id: 'gym', title: 'Gym', questions: [{ id: 'q2', name: 'sauna', type: 'yesno', text: 'I go to the sauna', label: 'I go to the sauna?' }],
  items: [{ text: 'Shoes' }, { text: 'Towel', detail: 'For the sauna', qty: 'sauna' }, { text: 'Water bottle', required: true }] };
(async () => {
  for (const [W, H] of [[390, 780], [320, 568]]) {
    const { page: p, browser } = await L.open({ width: W, height: H, lists: [L.list(5, 'Five'), L.list(15, 'Fifteen'), gym] });
    const s = n => p.screenshot({ path: `${L.DIR}shot-${W}-${n}.png` });
    await p.click('#new'); await s('1-name');
    await p.keyboard.type('x'.repeat(61)); await p.keyboard.press('Enter'); await s('2-name-error');
    await p.click('text=Cancel');
    await L.edit(p, 'Five'); await s('3-points');
    await p.locator('.row', { hasText: 'Point 2' }).locator('.x').click(); await s('4-points-toast');
    await p.click('#undo');
    await p.fill('#draft', 'x'.repeat(130)); await p.press('#draft', 'Enter'); await s('5-points-error');
    await p.fill('#draft', '');
    await p.locator('.row', { hasText: 'Point 3' }).click(); await s('6-item');
    await p.fill('#field', 'd'.repeat(210)); await s('7-item-error');
    await p.fill('#field', 'Both tanks'); await p.click('.prop >> text=Quantity'); await s('8-item-qty');
    await L.back(p); await p.click('text=Cancel');
    await L.edit(p, 'Fifteen'); await s('9-points-15');
    await p.locator('.row', { hasText: 'Point 2' }).locator('.x').click(); await s('10-points-15-toast');
    await p.click('text=Cancel');
    await L.edit(p, 'Gym'); await p.click('text=Questions'); await s('11-questions');
    await p.locator('.stack > div .x').click(); await s('12-questions-toast');
    await p.click('#undo');
    await p.click('#add-question'); await p.click('#type-yesno'); await s('13-cond-pre');
    await p.fill('#qdraft', '😀'); await p.press('#qdraft', 'Enter'); await s('14-cond-error');
    await browser.close();
  }
  await L.summary();
})();
