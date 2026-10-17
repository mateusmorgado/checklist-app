// Item 2: Undo toast instead of confirmation.
const L = require('./lib.cjs');
const { ok } = L;
const gym = { id: 'gym', title: 'Gym', questions: [{ id: 'q2', name: 'sauna', type: 'yesno', text: 'I go to the sauna', label: 'I go to the sauna?' }, { id: 'q3', name: 'nights', type: 'number', text: 'nights', label: 'How many nights?' }],
  items: [{ text: 'Shoes' }, { text: 'Towel', qty: 'sauna' }, { text: 'Soap', qty: 'sauna' }, { text: 'Shirts', qty: 'nights + 1' }, { text: 'Bag', qty: 'nights' }] };
const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('checklists')));
const toast = p => p.locator('.toast-box').count();
const del = (p, t) => p.locator('.row', { hasText: t }).locator('.x').click();
(async () => {
  const { page: p } = await L.open({ lists: [L.list(5, 'Five'), L.list(1, 'Solo'), gym, L.list(3, 'Three'), L.list(2, 'Two')] });
  await L.edit(p, 'Five');

  // toast anatomy
  ok('no toast before a delete', (await toast(p)) === 0);
  await del(p, 'Point 1');
  ok('toast appears', (await toast(p)) === 1 && (await p.textContent('.toast')).includes('Point deleted'));
  ok('toast is role=status polite', await p.locator('.toast').getAttribute('role') === 'status' && await p.locator('.toast').getAttribute('aria-live') === 'polite');
  const ub = await p.locator('#undo').boundingBox();
  ok('#undo is at least 48x48', ub.width >= 48 && ub.height >= 48, JSON.stringify(ub));
  ok('toast is right-aligned (right edge near the content edge)', await p.evaluate(() => { const b = document.querySelector('.toast-box').getBoundingClientRect(); return Math.abs(b.right - (innerWidth - 20)) <= 1; }));
  // layout: toast between entry and actions, no overlap with any control
  const overlap = () => p.evaluate(() => {
    const t = document.querySelector('.toast-box').getBoundingClientRect(), bad = [];
    for (const e of document.querySelectorAll('.screen button, .screen input, .screen .row, .screen .hint')) {
      if (e.closest('.toast')) continue;
      const r = e.getBoundingClientRect();
      if (r.width && r.height && r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top) bad.push((e.id || e.className || e.tagName) + ':' + e.textContent.slice(0, 12));
    }
    return bad;
  });
  ok('toast overlaps no control (390x780)', (await overlap()).length === 0, JSON.stringify(await overlap()));
  ok('page does not scroll with toast', await L.noPageScroll(p));
  await p.click('#undo');
  ok('undo first point restores it at index 0', JSON.stringify(await L.cssOrder(p)) === JSON.stringify(['Point 1', 'Point 2', 'Point 3', 'Point 4', 'Point 5']), JSON.stringify(await L.cssOrder(p)));
  ok('toast gone after undo', (await toast(p)) === 0);
  ok('focus goes to the entry field after undo', await p.evaluate(() => document.activeElement.id) === 'draft');

  await del(p, 'Point 3'); await p.click('#undo');
  ok('undo middle point', JSON.stringify(await L.cssOrder(p)) === JSON.stringify(['Point 1', 'Point 2', 'Point 3', 'Point 4', 'Point 5']), JSON.stringify(await L.cssOrder(p)));
  await del(p, 'Point 5'); await p.click('#undo');
  ok('undo last point', JSON.stringify(await L.cssOrder(p)) === JSON.stringify(['Point 1', 'Point 2', 'Point 3', 'Point 4', 'Point 5']));

  // two quick deletes: only the last can be undone
  await del(p, 'Point 2'); await del(p, 'Point 4');
  ok('two deletes leave three points', (await L.cssOrder(p)).length === 3);
  ok('single toast', (await toast(p)) === 1);
  await p.click('#undo');
  ok('undo brings back only the last delete', JSON.stringify(await L.cssOrder(p)) === JSON.stringify(['Point 1', 'Point 3', 'Point 4', 'Point 5']), JSON.stringify(await L.cssOrder(p)));
  ok('no second undo offered', (await toast(p)) === 0);

  // undo after later adds: index clamped, no crash
  await del(p, 'Point 5');
  await p.fill('#draft', 'New A'); await p.press('#draft', 'Enter');
  await p.click('#undo');
  ok('undo after an add puts the point back at its old index', JSON.stringify(await L.cssOrder(p)) === JSON.stringify(['Point 1', 'Point 3', 'Point 4', 'Point 5', 'New A']), JSON.stringify(await L.cssOrder(p)));
  // undo deleted point the same time as list shrinks (delete several then undo last)
  await del(p, 'New A'); await del(p, 'Point 5'); await del(p, 'Point 4'); await p.click('#undo');
  ok('undo restores at old index after earlier deletes', JSON.stringify(await L.cssOrder(p)) === JSON.stringify(['Point 1', 'Point 3', 'Point 4']), JSON.stringify(await L.cssOrder(p)));
  // Cancel drops the editor toast
  await del(p, 'Point 1');
  ok('toast shown', (await toast(p)) === 1);
  await p.click('text=Cancel');
  ok('toast gone after leaving the editor', (await toast(p)) === 0);
  ok('cancelled editor changes not saved', (await saved(p)).find(l => l.id === 'L5').items.length === 5);

  // delete the only point
  await L.edit(p, 'Solo');
  await del(p, 'Point 1');
  ok('only point deleted', (await L.cssOrder(p)).length === 0);
  ok('hint empty with no points', (await p.textContent('.hint')) === '', JSON.stringify(await p.textContent('.hint')));
  await p.click('#undo');
  ok('undo the only point', JSON.stringify(await L.cssOrder(p)) === JSON.stringify(['Point 1']));
  await p.click('text=Cancel');

  // question with linked items
  await L.edit(p, 'Gym');
  await p.click('text=Questions');
  ok('two questions listed', await p.locator('.stack > div').count() === 2);
  const qNames = () => p.evaluate(() => [...document.querySelectorAll('.stack > div .label > span:first-child')].map(e => e.textContent));
  const before = await qNames();
  await p.locator('.stack > div', { hasText: 'sauna' }).locator('.x').click();
  ok('question removed', (await qNames()).length === 1);
  ok('toast says question deleted', (await p.textContent('.toast')).includes('Question deleted'));
  await L.back(p);
  const noteOf = t => p.evaluate(t => { const r = [...document.querySelectorAll('.row')].find(x => x.textContent.includes(t)); const d = r && r.querySelector('.detail'); return d ? d.textContent : ''; }, t);
  ok('linked items lost the quantity', !(await noteOf('Towel')).includes('sauna') && !(await noteOf('Soap')).includes('sauna'), await noteOf('Towel'));
  ok('toast survives the step change', (await toast(p)) === 1);
  await p.click('#undo');
  ok('linked quantities restored', (await noteOf('Towel')).includes('× sauna') && (await noteOf('Soap')).includes('× sauna'), await noteOf('Towel'));
  ok('other formulas untouched', (await noteOf('Shirts')).includes('nights + 1'));
  await p.click('text=Questions');
  const after = await qNames();
  ok('question back at its old index', JSON.stringify(after) === JSON.stringify(before), JSON.stringify(after) + ' vs ' + JSON.stringify(before));
  // delete the second question (index 1) and undo -> index 1
  await p.locator('.stack > div', { hasText: 'nights' }).locator('.x').click();
  await p.click('#undo');
  ok('second question restored at index 1', JSON.stringify(await qNames()) === JSON.stringify(before));
  // delete + user edits qty meanwhile: undo must not overwrite
  await p.locator('.stack > div', { hasText: 'sauna' }).locator('.x').click();
  await L.back(p);
  await p.locator('.row', { hasText: 'Towel' }).click();
  await p.click('.prop >> text=Quantity');
  await p.fill('#field', '2');
  await L.back(p);
  await p.click('#undo');
  ok('undo keeps a quantity typed in the meantime', (await noteOf('Towel')).includes('× 2') && (await noteOf('Soap')).includes('× sauna'), await noteOf('Towel') + ' | ' + await noteOf('Soap'));
  // adding a question withdraws a pending question-undo (name could clash)
  await p.click('text=Questions');
  await p.locator('.stack > div', { hasText: 'nights' }).locator('.x').click();
  ok('toast for nights', (await toast(p)) === 1);
  await p.click('#add-question'); await p.click('#type-number'); await p.fill('#qdraft', 'nights'); await p.press('#qdraft', 'Enter');
  ok('adding a question withdraws the question undo', (await toast(p)) === 0);
  await p.click('text=Done'); await L.back(p);
  await p.click('text=Cancel');

  // save keeps deletions and drops the toast
  await L.edit(p, 'Three');
  await del(p, 'Point 2');
  await p.click('text=Save');
  ok('toast gone after Save', (await toast(p)) === 0);
  ok('saved without the deleted point', JSON.stringify((await saved(p)).find(l => l.id === 'L3').items.map(i => i.text)) === JSON.stringify(['Point 1', 'Point 3']));

  // delete checklist: applies at once, undo restores at the same index
  const titles = async () => (await saved(p)).map(l => l.title);
  const homeTitles = () => p.evaluate(() => [...document.querySelectorAll('.home-item .open')].map(e => e.textContent));
  const t0 = await titles();
  console.log('lists:', t0.join(','));
  await L.edit(p, 'Solo');
  await p.click('text=Delete');
  ok('checklist removed at once (home)', !(await homeTitles()).includes('Solo') && (await p.locator('#new').count()) === 1);
  ok('removed in storage at once', !(await titles()).includes('Solo'));
  ok('toast on home says Checklist deleted', (await p.textContent('.toast')).includes('Checklist deleted'));
  ok('toast overlaps nothing on home', (await overlap()).length === 0, JSON.stringify(await overlap()));
  ok('home: page does not scroll', await L.noPageScroll(p));
  await p.click('#undo');
  ok('restored at index 1', JSON.stringify(await homeTitles()) === JSON.stringify(t0), JSON.stringify(await homeTitles()));
  ok('restored in storage', JSON.stringify(await titles()) === JSON.stringify(t0));
  // first and last
  await L.edit(p, 'Five'); await p.click('text=Delete'); await p.click('#undo');
  ok('restored at index 0', JSON.stringify(await homeTitles()) === JSON.stringify(t0));
  await L.edit(p, 'Two'); await p.click('text=Delete'); await p.click('#undo');
  ok('restored at the last index', JSON.stringify(await homeTitles()) === JSON.stringify(t0));
  // delete two checklists in a row: only the last undoable
  await L.edit(p, 'Solo'); await p.click('text=Delete');
  await L.edit(p, 'Gym'); await p.click('text=Delete');
  ok('two checklists removed', (await homeTitles()).length === t0.length - 2);
  await p.click('#undo');
  ok('only the last deleted checklist comes back (Gym at its index)', JSON.stringify(await homeTitles()) === JSON.stringify(t0.filter(t => t !== 'Solo')), JSON.stringify(await homeTitles()));
  ok('no second undo', (await toast(p)) === 0);
  // toast survives home -> edit, ends when going to run or settings
  await L.edit(p, 'Five'); await p.click('text=Delete');
  await L.edit(p, 'Two');
  ok('checklist toast stays while another list is opened for editing', (await toast(p)) === 1);
  await p.click('text=Cancel');
  ok('toast stays on home after cancel', (await toast(p)) === 1);
  await p.click('#settings');
  ok('toast ends when another screen opens', (await toast(p)) === 0);
  await p.click('#settings-back');
  // undo with the list list changed meanwhile: id clash is ignored
  await L.edit(p, 'Two'); await p.click('text=Delete');
  await p.click('#new'); await p.keyboard.type('Fresh'); await p.keyboard.press('Enter'); await p.click('#fb-next'); await p.keyboard.type('x'); await p.keyboard.press('Enter');
  ok('toast still shown while a new list is created', (await toast(p)) === 1);
  await p.click('text=Save');
  await p.click('#undo');
  const th = await homeTitles();
  ok('undo after saving a new list: both present, no duplicates', th.filter(t => t === 'Two').length === 1 && th.includes('Fresh'), JSON.stringify(th));

  // keyboard: Escape dismisses a toast that has focus
  await L.edit(p, 'Two'); await p.click('text=Delete');
  await p.focus('#undo'); await p.keyboard.press('Escape');
  ok('Escape dismisses the toast', (await toast(p)) === 0);
  await L.summary();
})().catch(e => { console.log('FAIL exception', e.stack); process.exit(1); });
