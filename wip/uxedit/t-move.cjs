// Item 1: non-drag reorder (buttons, Alt+Arrow, status message, ends, duplicates, save then run).
const L = require('./lib.cjs');
const { ok } = L;
const runOrder = p => p.evaluate(() => [...document.querySelectorAll('.stack button.item')].sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top).map(e => e.querySelector('.label > span').textContent));
(async () => {
  const { page: p } = await L.open({ lists: [L.list(5, 'Five'), { id: 'dup', title: 'Dups', items: [{ text: 'Same' }, { text: 'Same' }, { text: 'Same' }, { text: 'Other' }] }] });
  await L.edit(p, 'Five');
  const status = () => p.textContent('#move-status');
  const open = async t => { await p.locator('.row', { hasText: t }).click(); await p.waitForSelector('#move-up'); };

  // buttons exist, 48px, in the item step
  await open('Point 3');
  for (const id of ['#move-up', '#move-down']) {
    const b = await p.locator(id).boundingBox();
    ok(id + ' is at least 48x48', b.width >= 48 && b.height >= 48, JSON.stringify(b));
  }
  ok('status starts as position', (await status()) === 'Position 3 of 5', await status());
  ok('status is a polite live region', await p.locator('#move-status').getAttribute('role') === 'status');
  await p.click('#move-up');
  ok('move up -> position 4', (await status()) === 'Moved to position 4 of 5', await status());
  ok('item step stays open after move', await p.locator('#field').count() === 1 && (await p.textContent('h1')) === 'Point 3');
  ok('input keeps focus after move click', await p.evaluate(() => document.activeElement.id) === 'field');
  await p.click('#move-up');
  ok('move up -> position 5', (await status()) === 'Moved to position 5 of 5');
  ok('move-up looks disabled at the top end', await p.locator('#move-up').getAttribute('aria-disabled') === 'true' && await p.locator('#move-up').isDisabled());
  ok('move-down enabled at top end', await p.locator('#move-down').getAttribute('aria-disabled') === 'false');
  await p.click('#move-up', { force: true });
  ok('extra move up at the end changes nothing and says so', (await status()) === 'Already at position 5 of 5', await status());
  await p.click('#move-down'); await p.click('#move-down'); await p.click('#move-down'); await p.click('#move-down');
  ok('moved to position 1', (await status()) === 'Moved to position 1 of 5', await status());
  ok('move-down disabled at the bottom end', await p.locator('#move-down').getAttribute('aria-disabled') === 'true');
  await p.click('#move-down', { force: true });
  ok('extra move down at the end says so', (await status()) === 'Already at position 1 of 5', await status());
  ok('focus is not lost when a move button reaches its end', await p.evaluate(() => document.activeElement.id) === 'field');
  // keyboard in the field
  await p.focus('#field');
  await p.keyboard.press('Alt+ArrowUp');
  ok('Alt+ArrowUp in the field moves up', (await status()) === 'Moved to position 2 of 5', await status());
  await p.keyboard.press('Alt+ArrowDown'); await p.keyboard.press('Alt+ArrowDown');
  ok('Alt+ArrowDown stops at the bottom', (await status()) === 'Already at position 1 of 5', await status());
  await L.back(p);
  ok('order after moves: Point 3 first', JSON.stringify(await L.cssOrder(p)) === JSON.stringify(['Point 3', 'Point 1', 'Point 2', 'Point 4', 'Point 5']), JSON.stringify(await L.cssOrder(p)));

  // Alt+Arrow on a focused row (points step)
  await p.locator('.row', { hasText: 'Point 4' }).focus();
  await p.keyboard.press('Alt+ArrowUp');
  let o = await L.cssOrder(p);
  ok('row Alt+ArrowUp moves visually up (later in run)', JSON.stringify(o) === JSON.stringify(['Point 3', 'Point 1', 'Point 2', 'Point 5', 'Point 4']), JSON.stringify(o));
  ok('row keeps focus after Alt+Arrow', await p.evaluate(() => document.activeElement.classList.contains('row') && document.activeElement.textContent.includes('Point 4')));
  ok('status message in the points step', (await p.textContent('.hint')) === 'Moved to position 5 of 5', await p.textContent('.hint'));
  ok('points hint is a live region', await p.locator('.hint').first().getAttribute('role') === 'status');
  await p.keyboard.press('Alt+ArrowUp');
  ok('row at the top: nothing moves, says so', (await p.textContent('.hint')) === 'Already at position 5 of 5' && JSON.stringify(await L.cssOrder(p)) === JSON.stringify(o));
  await p.keyboard.press('Alt+ArrowDown'); await p.keyboard.press('Alt+ArrowDown');
  o = await L.cssOrder(p);
  ok('row Alt+ArrowDown moves down twice', JSON.stringify(o) === JSON.stringify(['Point 3', 'Point 1', 'Point 4', 'Point 2', 'Point 5']), JSON.stringify(o));
  // plain arrows move focus, Enter opens
  await p.keyboard.press('ArrowUp');
  ok('plain ArrowUp focuses the row above', await p.evaluate(() => document.activeElement.textContent.includes('Point 2')));
  await p.keyboard.press('Enter');
  ok('Enter on a focused row opens the item step', await p.locator('#move-up').count() === 1 && (await p.textContent('h1')) === 'Point 2');
  await L.back(p);
  // roving tab stop: exactly one row is tabbable
  ok('one row tab stop', await p.evaluate(() => [...document.querySelectorAll('.row')].filter(r => r.tabIndex === 0).length) === 1);
  ok('row has name and position for screen readers', (await p.locator('.row').first().getAttribute('aria-label')).includes('position'));

  // save, then the run shows the new order
  await p.click('text=Save');
  await p.locator('.stack button', { hasText: 'Five' }).click();
  ok('run shows the moved order', JSON.stringify(await runOrder(p)) === JSON.stringify(['Point 3', 'Point 1', 'Point 4', 'Point 2', 'Point 5']), JSON.stringify(await runOrder(p)));
  await p.click('text=Close');

  // duplicate texts: moves go by item, not by text
  await L.edit(p, 'Dups');
  await open('Other');
  await p.click('#move-down'); await p.click('#move-down');
  await L.back(p);
  ok('Other moved down two places among duplicates', JSON.stringify(await L.cssOrder(p)) === JSON.stringify(['Same', 'Other', 'Same', 'Same']), JSON.stringify(await L.cssOrder(p)));
  await open('Other');
  await p.fill('#field', 'marked'); // detail on Other so its identity can be told apart
  await L.back(p);
  await p.locator('.row', { hasText: 'Same' }).first().focus();
  await p.keyboard.press('Alt+ArrowUp');
  o = await L.cssOrder(p);
  ok('first of three equal items moved up one place, others untouched', JSON.stringify(o) === JSON.stringify(['Other', 'Same', 'Same', 'Same']), JSON.stringify(o));
  const details = await p.evaluate(() => [...document.querySelectorAll('.row')].sort((a, b) => +a.style.order - +b.style.order).map(e => e.textContent));
  ok('detail stays with its own item after moves', details[0].includes('marked') && details.slice(1).every(t => !t.includes('marked')), JSON.stringify(details));
  await p.click('text=Save');
  await p.locator('.stack button', { hasText: 'Dups' }).click();
  ok('run order with duplicates', JSON.stringify(await runOrder(p)) === JSON.stringify(['Other', 'Same', 'Same', 'Same']), JSON.stringify(await runOrder(p)));
  await p.click('text=Close');

  // single item: both buttons disabled
  await p.evaluate(() => {});
  const { page: q } = await L.open({ lists: [{ id: 's', title: 'Solo', items: [{ text: 'Only' }] }] });
  await L.edit(q, 'Solo');
  await q.locator('.row').click();
  ok('single item: both buttons disabled-looking', await q.locator('#move-up').getAttribute('aria-disabled') === 'true' && await q.locator('#move-down').getAttribute('aria-disabled') === 'true');
  await q.click('#move-up', { force: true });
  ok('single item message', (await q.textContent('#move-status')) === 'Already at position 1 of 1', await q.textContent('#move-status'));

  // moved status is replaced by the position text when leaving and opening another item
  ok('page never scrolls', await L.noPageScroll(q));
  await L.summary();
})().catch(e => { console.log('FAIL exception', e.stack); process.exit(1); });
