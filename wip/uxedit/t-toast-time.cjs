// Item 2: toast timing. Real timers: 7 s, paused by focus and by touch, restarted by a newer delete.
const L = require('./lib.cjs');
const { ok } = L;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const alive = p => p.locator('.toast-box').count().then(n => n === 1);
(async () => {
  const { page: p, ctx } = await L.open({ touch: true, lists: [L.list(6, 'Six')] });
  await L.edit(p, 'Six');
  const del = t => p.locator('.row', { hasText: t }).locator('.x').click();

  // 1. plain: dismissed at about 7 s
  let t0 = Date.now(); await del('Point 1');
  await sleep(6300); ok('still there at 6.3 s', await alive(p));
  await p.waitForSelector('.toast-box', { state: 'detached', timeout: 3000 });
  const el = Date.now() - t0;
  ok('auto-dismissed at about 7 s (' + el + ' ms)', el >= 6900 && el <= 7600, el);
  ok('after dismissal the delete is final (no toast, no undo)', (await p.locator('#undo').count()) === 0 && (await L.cssOrder(p)).length === 5);

  // 2. focus pauses it
  await del('Point 2');
  await p.focus('#undo');
  await sleep(9000);
  ok('focus on the toast pauses the countdown (9 s)', await alive(p));
  await p.evaluate(() => document.activeElement.blur());
  t0 = Date.now();
  await p.waitForSelector('.toast-box', { state: 'detached', timeout: 9000 });
  const after = Date.now() - t0;
  ok('after blur it resumes and ends within the remaining time, at least 2 s (' + after + ' ms)', after >= 1800 && after <= 7500, after);

  // 3. a touch pauses it (CDP touch, held on the message text)
  await del('Point 3');
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const m = await p.locator('.toast-msg').boundingBox();
  await sleep(1000);
  await touch('touchStart', m.x + m.width / 2, m.y + m.height / 2);
  await sleep(8500);
  ok('touch on the toast pauses the countdown (8.5 s)', await alive(p));
  await touch('touchEnd');
  t0 = Date.now();
  await sleep(1000);
  ok('still there just after release (at least 2 s left)', await alive(p));
  await p.waitForSelector('.toast-box', { state: 'detached', timeout: 9000 });
  ok('then it ends', true);

  // 4. a newer delete restarts the countdown for the new toast
  await del('Point 4');
  await sleep(5000);
  await del('Point 5');
  const t1 = Date.now();
  await sleep(4000);
  ok('second delete got a fresh 7 s (alive 9 s after the first)', await alive(p));
  await p.waitForSelector('.toast-box', { state: 'detached', timeout: 5000 });
  const el2 = Date.now() - t1;
  ok('second toast lasted about 7 s (' + el2 + ' ms)', el2 >= 6800 && el2 <= 7700, el2);
  ok('page never scrolled', await L.noPageScroll(p));
  await L.summary();
})().catch(e => { console.log('FAIL exception', e.stack); process.exit(1); });
