// Items 5 and 6 plus hit areas, focus rings, forced colors, prefers-contrast, headings of live regions.
const L = require('./lib.cjs');
const { ok } = L;
const gym = { id: 'gym', title: 'Gym', questions: [{ id: 'q2', name: 'sauna', type: 'yesno', text: 'I go to the sauna', label: 'I go to the sauna?' }],
  items: [{ text: 'Shoes' }, { text: 'Towel', detail: 'For the sauna', qty: 'sauna' }] };
const outline = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); const cs = getComputedStyle(e); return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor, bg: cs.backgroundColor, bs: cs.borderTopStyle, bw: parseFloat(cs.borderTopWidth) }; }, sel);
const hit = p => p.evaluate(() => [...document.querySelectorAll('.screen button, .screen input, .screen .row, .screen .prop')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && !e.closest('.stack') || e.matches('.stack .row, .stack .prop, .stack .x'); }).map(e => { const r = e.getBoundingClientRect(); return { n: (e.id || e.className || e.tagName) + ':' + e.textContent.slice(0, 10), w: r.width, h: r.height }; }).filter(x => x.w < 47.99 || x.h < 47.99));
const inView = p => p.evaluate(() => [...document.querySelectorAll('.screen > .actions button, .moves .actions button')].filter(b => { const r = b.getBoundingClientRect(); return r.left < -0.5 || r.right > innerWidth + 0.5; }).map(b => b.textContent));
(async () => {
  // hit areas in every editor step at 320x568 and 390x780
  for (const [W, H] of [[320, 568], [390, 780]]) {
    const { page: p } = await L.open({ width: W, height: H, lists: [gym] });
    const tag = W + 'x' + H;
    await L.edit(p, 'Gym');
    ok(tag + ' points: hit areas >= 48', (await hit(p)).length === 0, JSON.stringify(await hit(p)));
    ok(tag + ' points: all buttons in view', (await inView(p)).length === 0, JSON.stringify(await inView(p)));
    await p.locator('.row', { hasText: 'Towel' }).click();
    ok(tag + ' item: hit areas >= 48 (move buttons, props, required, back)', (await hit(p)).length === 0, JSON.stringify(await hit(p)));
    ok(tag + ' item: buttons in view', (await inView(p)).length === 0, JSON.stringify(await inView(p)));
    await L.back(p);
    await p.click('text=Questions');
    ok(tag + ' questions: hit areas >= 48', (await hit(p)).length === 0, JSON.stringify(await hit(p)));
    await p.locator('.stack .x').click();
    ok(tag + ' toast: undo >= 48 and the toast leaves buttons clear', (await hit(p)).length === 0, JSON.stringify(await hit(p)));
    const ov = await p.evaluate(() => { const t = document.querySelector('.toast-box').getBoundingClientRect(); return [...document.querySelectorAll('.screen button, .screen .hint, .screen h1, .screen .stack > *')].filter(e => !e.closest('.toast') && (() => { const r = e.getBoundingClientRect(); return r.width && r.height && r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top; })()).map(e => e.textContent.slice(0, 15)); });
    ok(tag + ' questions + toast: nothing under the toast', ov.length === 0, JSON.stringify(ov));
    ok(tag + ' toast inside the viewport', await p.evaluate(() => { const t = document.querySelector('.toast-box').getBoundingClientRect(); return t.left >= 0 && t.right <= innerWidth && t.bottom <= innerHeight; }));
    ok(tag + ' page does not scroll', await L.noPageScroll(p));
    await p.close();
  }

  // 12 questions + Delete + count at 320: whole button row visible
  {
    const qs = Array.from({ length: 12 }, (_, i) => ({ id: 'q' + i, name: 'n' + i, type: 'yesno', text: 'topic' + i, label: 'topic' + i + '?' }));
    const { page: p } = await L.open({ width: 320, height: 568, lists: [{ id: 'a', title: 'A', questions: qs, items: [{ text: 'x' }] }] });
    await L.edit(p, 'A');
    ok('320: Delete, Cancel, Questions 12, Save all inside the viewport', (await inView(p)).length === 0, JSON.stringify(await inView(p)));
  }

  // forced colors
  {
    const { page: p } = await L.open({ forcedColors: 'active', lists: [gym] });
    await L.edit(p, 'Gym');
    await p.locator('.row', { hasText: 'Towel' }).focus(); await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab');
    const f = await outline(p, '.row:focus');
    ok('forced-colors: focused row has a visible outline (>= 2px, solid)', f.style !== 'none' && f.width >= 2, JSON.stringify(f));
    await p.locator('.row', { hasText: 'Towel' }).click();
    const sel = await outline(p, '.prop.selected');
    ok('forced-colors: selected row has an outline, not only a background', sel.style === 'solid' && sel.width >= 2, JSON.stringify(sel));
    const un = await outline(p, '.prop:not(.selected)');
    ok('forced-colors: unselected row has no outline (so the difference is visible)', un.style === 'none' || un.width === 0, JSON.stringify(un));
    await p.focus('#move-up'); await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab');
    const ib = await outline(p, '#move-up');
    ok('forced-colors: focused button outline visible', ib.style !== 'none' && ib.width >= 2, JSON.stringify(ib));
    ok('forced-colors: disabled-looking move button differs by more than color (line-through or GrayText)', await p.evaluate(() => { const e = document.querySelector('#move-down'); return e.getAttribute('aria-disabled') === 'true' ? getComputedStyle(e).textDecorationLine.includes('line-through') : true; }));
    await L.back(p);
    await p.locator('.row', { hasText: 'Shoes' }).locator('.x').click();
    const tb = await outline(p, '.toast-box');
    ok('forced-colors: toast has a border', tb.bs !== 'none' && tb.bw >= 2, JSON.stringify(tb));
    await p.screenshot({ path: L.DIR + 'forced-toast.png' });
    await L.back(p).catch(() => {});
  }
  // prefers-contrast: more
  {
    const { page: p } = await L.open({ lists: [gym] });
    await p.emulateMedia({ contrast: 'more' });
    await L.edit(p, 'Gym');
    await p.locator('.row', { hasText: 'Towel' }).click();
    const sel = await outline(p, '.prop.selected');
    ok('prefers-contrast: selected row has an outline', sel.style === 'solid' && sel.width >= 2, JSON.stringify(sel));
    await p.focus('#move-up'); await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab');
    const ib = await outline(p, '#move-up');
    ok('prefers-contrast: focused button outline visible (>= 2px)', ib.style !== 'none' && ib.width >= 2, JSON.stringify(ib));
    ok('prefers-contrast: end-of-list button gets a non-color cue', await p.evaluate(() => { const e = document.querySelector('#move-down'); return e.getAttribute('aria-disabled') === 'false' || getComputedStyle(e).textDecorationLine.includes('line-through'); }));
    await L.back(p);
    await p.locator('.row', { hasText: 'Shoes' }).locator('.x').click();
    const tb = await outline(p, '.toast-box');
    ok('prefers-contrast: toast has a 2px border', tb.bs !== 'none' && tb.bw >= 2, JSON.stringify(tb));
    await p.screenshot({ path: L.DIR + 'contrast-toast.png' });
  }
  // focus ring on rows in normal mode and the row focus ring is not clipped by the scroll area
  {
    const { page: p } = await L.open({ lists: [gym] });
    await L.edit(p, 'Gym');
    await p.locator('.row').first().focus();
    await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab');
    const f = await outline(p, '.row:focus');
    ok('focused row: 2px outline', f.style === 'solid' && f.width >= 2, JSON.stringify(f));
    const clipped = await p.evaluate(() => { const r = document.querySelector('.row:focus'), st = document.querySelector('.stack'); const o = parseFloat(getComputedStyle(r).outlineOffset); return o < 0; });
    ok('row outline is drawn inside the row (not clipped by the stack)', clipped);
    ok('page does not scroll', await L.noPageScroll(p));
  }
  // keyboard delete keeps focus in the list; undo returns focus to the entry field
  {
    const { page: p } = await L.open({ lists: [L.list(4, 'Four')] });
    await L.edit(p, 'Four');
    await p.locator('.row', { hasText: 'Point 2' }).focus();
    await p.keyboard.press('Tab');
    ok('Tab from the row reaches its remove button', await p.evaluate(() => document.activeElement.classList.contains('x')));
    await p.keyboard.press('Enter');
    ok('keyboard delete: point removed', (await L.cssOrder(p)).join() === 'Point 1,Point 3,Point 4');
    ok('keyboard delete: focus stays on a row (not lost to the page)', await p.evaluate(() => document.activeElement.classList.contains('row')), await p.evaluate(() => document.activeElement.tagName + '.' + document.activeElement.className));
    ok('keyboard delete: toast offered', await p.locator('#undo').count() === 1);
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); // x, then on to the entry field
    await p.focus('#undo'); await p.keyboard.press('Enter');
    ok('keyboard undo: restored and focus on the entry field', (await L.cssOrder(p)).join() === 'Point 1,Point 2,Point 3,Point 4' && await p.evaluate(() => document.activeElement.id) === 'draft');
    // delete all by keyboard: focus goes to the entry field
    for (let i = 0; i < 4; i++) { await p.locator('.row').first().focus(); await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); }
    ok('keyboard delete of the last row moves focus to the entry field', await p.evaluate(() => document.activeElement.id) === 'draft' && (await L.cssOrder(p)).length === 0);
  }
  // dark mode and designs: toast and buttons readable (visual check by screenshot, token based)
  for (const design of ['classic', 'airplane', 'modern']) {
    for (const scheme of ['light', 'dark']) {
      const { page: p } = await L.open({ colorScheme: scheme, settings: { design, mode: 'system', effects: 'full' }, lists: [gym] });
      await L.edit(p, 'Gym');
      await p.locator('.row', { hasText: 'Shoes' }).locator('.x').click();
      await p.screenshot({ path: `${L.DIR}design-${design}-${scheme}-toast.png` });
      await p.locator('.row', { hasText: 'Towel' }).click();
      await p.screenshot({ path: `${L.DIR}design-${design}-${scheme}-item.png` });
      const ok1 = await L.noPageScroll(p);
      ok(design + ' ' + scheme + ': no page scroll', ok1);
      await p.close();
    }
  }
  await L.summary();
})().catch(e => { console.log('FAIL exception', e.stack); process.exit(1); });
