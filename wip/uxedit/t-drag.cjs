// Hold-to-drag still works (mouse and CDP touch), also with a scrollable stack; swipe scrolls; autoscroll while dragging.
const L = require('./lib.cjs');
const { ok } = L;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const idx = async (p, t) => (await L.cssOrder(p)).indexOf(t);
(async () => {
  for (const mode of ['mouse', 'touch']) {
    for (const [W, H, n, tag] of [[390, 780, 5, 'short list'], [320, 480, 15, 'scrollable'], [320, 568, 40, 'scrollable 40']]) {
      const { page: p, ctx } = await L.open({ width: W, height: H, touch: mode === 'touch', lists: [L.list(n, 'Lots')] });
      await L.edit(p, 'Lots');
      const cdp = mode === 'touch' ? await ctx.newCDPSession(p) : null;
      const pt = async t => { const r = await p.locator('.row', { hasText: new RegExp(t + '(?!\\d)') }).first().boundingBox(); return { x: r.x + r.width / 2 + 40, y: r.y + r.height / 2, h: r.height }; };
      const down = async (x, y) => mode === 'mouse' ? (await p.mouse.move(x, y), await p.mouse.down()) : cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      const move = async (x, y) => mode === 'mouse' ? p.mouse.move(x, y) : cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      const up = async () => mode === 'mouse' ? p.mouse.up() : cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const name = `${mode} ${tag}`;

      // drag Point 1 (bottom) up over the next two rows
      const a = await pt('Point 1'), c = await pt('Point 3');
      await down(a.x, a.y); await sleep(500);
      for (let k = 1; k <= 12; k++) { await move(a.x, a.y + (c.y - 6 - a.y) * k / 12); await sleep(16); }
      await up(); await sleep(100);
      let o = await L.cssOrder(p);
      ok(name + ': drag moves Point 1 up two places', o.slice(0, 4).join() === 'Point 2,Point 3,Point 1,Point 4', o.slice(0, 5).join());
      ok(name + ': dragging does not open the item step', await p.locator('#draft').count() === 1);
      ok(name + ': no lifted row left, page does not scroll', (await p.locator('.row.lifted').count()) === 0 && await L.noPageScroll(p));

      // drag back down by two
      const b = await pt('Point 1'), d = await pt('Point 2');
      await down(b.x, b.y); await sleep(500);
      for (let k = 1; k <= 12; k++) { await move(b.x, b.y + (d.y + 6 - b.y) * k / 12); await sleep(16); }
      await up(); await sleep(100);
      o = await L.cssOrder(p);
      ok(name + ': drag moves it back down', o.slice(0, 4).join() === 'Point 1,Point 2,Point 3,Point 4', o.slice(0, 5).join());

      // quick tap still opens the item (not a drag)
      const t = await pt('Point 2');
      if (mode === 'mouse') await p.mouse.click(t.x, t.y); else await p.touchscreen.tap(t.x, t.y);
      ok(name + ': a tap opens the item', await p.locator('#field').count() === 1 && (await p.textContent('h1')) === 'Point 2');
      await L.back(p);

      if (n >= 15) {
        // autoscroll: hold Point 1, drag to the top edge of the stack and wait
        const s = await p.evaluate(() => { const r = document.querySelector('.stack').getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
        const e = await pt('Point 1');
        await down(e.x, e.y); await sleep(500);
        for (let k = 1; k <= 10; k++) { await move(e.x, e.y + (s.top + 4 - e.y) * k / 10); await sleep(16); }
        await sleep(2500); // finger held still at the top edge: the stack keeps scrolling and the row keeps moving
        await up(); await sleep(150);
        const i1 = await idx(p, 'Point 1'), sc = await p.evaluate(() => document.querySelector('.stack').scrollTop);
        ok(name + ': holding at the top edge auto-scrolls and carries the row past the visible rows (index ' + i1 + ', scrollTop ' + Math.round(sc) + ')', i1 >= 8 && sc < 0, i1);
        ok(name + ': order is a permutation (nothing lost)', (await L.cssOrder(p)).length === n && new Set(await L.cssOrder(p)).size === n);
        ok(name + ': page still never scrolls', await L.noPageScroll(p));
        // and back down: scroll to where the row is, hold it at the bottom edge
        await p.evaluate(() => { const r = [...document.querySelectorAll('.stack .row')].find(x => x.textContent.includes('Point 1') && !/Point 1\d/.test(x.textContent)); r.scrollIntoView({ block: 'center' }); });
        await sleep(100);
        const from = await idx(p, 'Point 1');
        const e2 = await pt('Point 1');
        await down(e2.x, e2.y); await sleep(500);
        for (let k = 1; k <= 10; k++) { await move(e2.x, e2.y + (s.bottom - 4 - e2.y) * k / 10); await sleep(16); }
        await sleep(3000);
        await up(); await sleep(150);
        const to = await idx(p, 'Point 1');
        ok(name + ': holding at the bottom edge carries it back down (index ' + from + ' -> ' + to + ')', to <= 3 && to < from, to);
        ok(name + ': still a permutation', new Set(await L.cssOrder(p)).size === n);
      }
      if (mode === 'touch' && n >= 15) {
        // a swipe on a row scrolls the stack (no hold): content follows the finger
        await p.evaluate(() => { document.querySelector('.stack').scrollTop = 0; });
        const before = await L.cssOrder(p);
        const r = await pt('Point 2');
        await down(r.x, r.y);
        for (let k = 1; k <= 8; k++) { await move(r.x, r.y + 14 * k); await sleep(20); }
        await up(); await sleep(400);
        const sc2 = await p.evaluate(() => document.querySelector('.stack').scrollTop);
        ok(name + ': swiping on a row scrolls the stack (scrollTop ' + Math.round(sc2) + ')', sc2 < -20, sc2);
        ok(name + ': swipe did not reorder or open anything', JSON.stringify(await L.cssOrder(p)) === JSON.stringify(before) && await p.locator('#draft').count() === 1);
        ok(name + ': swipe leaves the page unscrolled', await L.noPageScroll(p));
      }
      await p.context().browser().close();
    }
  }
  await L.summary();
})().catch(e => { console.log('FAIL exception', e.stack); process.exit(1); });
