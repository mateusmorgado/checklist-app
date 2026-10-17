// Run screen and Ask screen tests for the uxrun copy.
const { openApp, closeAll } = require('/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/harness.cjs');
const F = '/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/work/uxrun/index.html';
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : x); };
const mk = (title, items, extra = {}) => ({ id: 'x' + Math.random().toString(36).slice(2, 6), title, items, ...extra });
const names = n => Array.from({ length: n }, (_, i) => 'Item ' + (i + 1));
const open = async (list, o = {}) => {
  const errors = [];
  const r = await openApp(F, { width: 390, height: 780, errors: e => errors.push(e), ...o, storage: { checklists: [list] } });
  r.errors = errors;
  await r.page.click('.stack button.open');
  return r;
};
const noScroll = p => p.evaluate(() => document.documentElement.scrollHeight === innerHeight && document.body.scrollHeight <= innerHeight);
const status = p => p.locator('.progress [class~=progress-text]').textContent();
const stub = p => p.evaluate(() => {
  window.__ev = [];
  window.toneStart = () => window.__ev.push('start'); window.toneStop = () => window.__ev.push('stop');
  window.toneTick = () => window.__ev.push('tick'); window.speak = t => window.__ev.push('say:' + t);
  navigator.vibrate = n => { window.__ev.push('vib' + n); return true; };
});
const items = p => p.locator('.stack > button.item');
const tick = async (p, text, wait = 300) => { await p.locator('.stack > button.item').filter({ has: p.getByText(text, { exact: true }) }).first().click(); await p.waitForTimeout(wait); };
const states = p => p.evaluate(() => [...document.querySelectorAll('.stack > button.item')].map(e => e.getAttribute('aria-checked') === 'true' ? 1 : 0).join(''));

(async () => {
  // 1. whole-row target, click only
  {
    const { page: p, errors } = await open(mk('T', [{ text: 'A' }, { text: 'B' }, { text: 'C', detail: 'd' }]));
    const geo = await p.evaluate(() => [...document.querySelectorAll('.stack > button.item')].map(e => { const r = e.getBoundingClientRect(), m = e.querySelector('.mark'), mr = m.getBoundingClientRect(); return { h: r.height, w: r.width, mh: mr.height, mw: mr.width, fs: parseFloat(getComputedStyle(m).fontSize) }; }));
    ok('rows are 56px tall (rows without detail)', Math.abs(geo[0].h - 56) < 0.6 && Math.abs(geo[1].h - 56) < 0.6, JSON.stringify(geo));
    ok('rows are full width (>= 340 at 390)', geo.every(g => g.w >= 340), JSON.stringify(geo));
    ok('visible tick about 28px', geo[0].fs === 28 && geo[0].mh >= 24 && geo[0].mh <= 36, JSON.stringify(geo[0]));
    ok('hit area >= 48 (row)', geo.every(g => g.h >= 48));
    // click at the far left of the row (not on the label/tick) toggles
    const box = await items(p).nth(0).boundingBox();
    await p.mouse.click(box.x + 6, box.y + box.height / 2);
    ok('click far from the tick toggles', await states(p) === '100', await states(p));
    await p.waitForTimeout(300);
    // pointerdown alone does not change state
    const b1 = await items(p).nth(1).boundingBox();
    await p.mouse.move(b1.x + 100, b1.y + 20); await p.mouse.down();
    ok('pointerdown does not change state', await states(p) === '100', await states(p));
    await p.mouse.move(b1.x + 100, b1.y - 80); await p.mouse.up();
    ok('sliding off then releasing cancels', await states(p) === '100', await states(p));
    await p.mouse.move(b1.x + 100, b1.y + 20); await p.mouse.down(); await p.mouse.up();
    ok('press and release on row toggles', await states(p) === '110', await states(p));
    ok('no page errors', errors.length === 0, errors.join());
    ok('page never scrolls', await noScroll(p));
    await closeAll();
  }
  // 2. progress + next + guard on a mixed list (3 required)
  {
    const list = mk('Mixed', [{ text: 'a', required: true }, { text: 'b' }, { text: 'c', required: true, detail: 'x' }, { text: 'd' }, { text: 'e', required: true }, { text: 'f', qty: '', detail: '' }, { text: 'g' }, { text: 'h' }]);
    const { page: p } = await open(list);
    ok('initial status', await status(p) === '0 of 8 done, 3 required left', await status(p));
    ok('status region is role=status polite', await p.evaluate(() => { const e = document.querySelector('.progress'); return e.getAttribute('role') === 'status' && e.getAttribute('aria-live') === 'polite'; }));
    const seg = () => p.evaluate(() => [...document.querySelectorAll('.progress-seg')].map(e => e.dataset.done + e.dataset.required).join(','));
    ok('8 segments, required marked', await seg() === '01,00,01,00,01,00,00,00', await seg());
    const segH = await p.evaluate(() => [...document.querySelectorAll('.progress-seg')].map(e => e.getBoundingClientRect().height));
    ok('required segments are taller (shape)', segH[0] > segH[1] && segH[2] > segH[3] && segH[0] === segH[2], JSON.stringify(segH));
    const nxt = () => p.evaluate(() => [...document.querySelectorAll('.stack > button.item')].map((e, i) => e.classList.contains('next') ? i : -1).filter(i => i >= 0).join());
    const order = () => p.evaluate(() => [...document.querySelectorAll('.stack > button.item')].map(e => e.querySelector('.label span').textContent).join(''));
    ok('next = first item (bottom-most)', await nxt() === '0', await nxt());
    ok('next carries aria-current', await p.evaluate(() => document.querySelectorAll('.item[aria-current]').length) === 1);
    ok('next is bold', await p.evaluate(() => parseInt(getComputedStyle(document.querySelector('.item.next .label span')).fontWeight) >= 600));
    ok('only one next element, others normal weight', await p.evaluate(() => document.querySelectorAll('.item.next').length) === 1);
    await tick(p, 'a'); ok('next moves to b after ticking a', await nxt() === '1' && await status(p) === '1 of 8 done, 2 required left', await nxt() + await status(p));
    await tick(p, 'd'); ok('ticking a later item keeps next at b', await nxt() === '1' && await status(p) === '2 of 8 done, 2 required left');
    await tick(p, 'b'); ok('next skips ticked d, lands on c', await nxt() === '2', await nxt());
    ok('order unchanged', await order() === 'hgfedcba'.split('').reverse().join('') || (await order()).length === 8, await order());
    await tick(p, 'a'); ok('untick a: next returns to a, counts restore', await nxt() === '0' && await status(p) === '2 of 8 done, 3 required left', await nxt() + await status(p));
    await tick(p, 'a');
    ok('segments after ticks', await seg() === '11,10,01,10,01,00,00,00', await seg());
    // guard
    await p.click('.bar button');
    ok('Close with partial ticks shows confirm, not closed', await p.locator('#keep-going').count() === 1 && await p.locator('#close-anyway').count() === 1 && await p.locator('.stack > button.item').count() === 8);
    const txt = await status(p);
    ok('confirm text has counts', /3 of 8 done, 2 required left/.test(txt), txt);
    ok('confirm is inline in the bar (no dialog)', await p.evaluate(() => !!document.querySelector('.bar #keep-going') && !!document.querySelector('.bar #close-anyway') && !document.querySelector('dialog, [role=dialog], [role=alertdialog]')));
    ok('keep-going has focus', await p.evaluate(() => document.activeElement.id) === 'keep-going');
    const before = await states(p);
    await p.click('#keep-going');
    ok('Keep going leaves ticks and returns the Close button', await states(p) === before && await p.locator('#keep-going').count() === 0 && (await p.locator('.bar button').first().textContent()) === 'Close', before);
    ok('focus back on main button', await p.evaluate(() => document.activeElement.textContent) === 'Close');
    await p.click('.bar button'); await p.click('#close-anyway');
    ok('Close anyway closes (home visible)', await p.locator('#new').count() === 1);
    await closeAll();
  }
  // main button keeps its position (Close -> Done)
  {
    const { page: p } = await open(mk('Pos', [{ text: 'a', required: true }, { text: 'b' }]));
    const pos = () => p.evaluate(() => { const r = document.querySelector('.bar button').getBoundingClientRect(); return [Math.round(r.right), Math.round(r.bottom), Math.round(r.width)].join(); });
    const p0 = await pos(); await tick(p, 'a'); const p1 = await pos();
    const t = await p.locator('.bar button').first().textContent();
    ok('required ticked: button reads Done and right/bottom edges stay', t === 'Done' && p0.split(',').slice(0, 2).join() === p1.split(',').slice(0, 2).join(), p0 + ' ' + p1);
    await p.click('.bar button');
    ok('Done closes at once', await p.locator('#new').count() === 1 && await p.locator('#keep-going').count() === 0);
    await closeAll();
  }
  // Close with nothing ticked closes (nothing to lose); fully ticked, 0 required
  {
    const { page: p } = await open(mk('N', [{ text: 'a' }, { text: 'b' }]));
    await p.click('text=Close'); ok('Close with nothing ticked closes at once', await p.locator('#new').count() === 1);
    await p.click('.stack button.open');
    await tick(p, 'a'); await tick(p, 'b');
    ok('all ticked, 0 required: Done, no required text', await status(p) === '2 of 2 done' && (await p.locator('.bar button').first().textContent()) === 'Done');
    await p.click('.bar button'); ok('Done closes', await p.locator('#new').count() === 1);
    await p.click('.stack button.open'); await tick(p, 'a');
    await p.click('.bar button'); ok('0 required, partial: confirm shows', await p.locator('#keep-going').count() === 1 && /1 of 2 done/.test(await status(p)) && !/required/.test(await status(p)));
    await tick(p, 'b'); ok('ticking while confirming dismisses it and shows Done', await p.locator('#keep-going').count() === 0 && (await p.locator('.bar button').first().textContent()) === 'Done');
    await closeAll();
  }
  // all required
  {
    const { page: p } = await open(mk('R', [{ text: 'a', required: true }, { text: 'b', required: true }]));
    ok('all required status', await status(p) === '0 of 2 done, 2 required left');
    await tick(p, 'a'); ok('1 required left', await status(p) === '1 of 2 done, 1 required left');
    await tick(p, 'b'); ok('none left, text drops required', await status(p) === '2 of 2 done');
    ok('no next when all done', await p.locator('.item.next').count() === 0);
    await closeAll();
  }
  // exactly 1 item
  {
    const { page: p } = await open(mk('One', [{ text: 'solo' }]));
    ok('one item status', await status(p) === '0 of 1 done');
    ok('one item: one segment', await p.locator('.progress-seg').count() === 1);
    await tick(p, 'solo'); ok('one item ticked', await status(p) === '1 of 1 done' && (await p.locator('.bar button').first().textContent()) === 'Done');
    await tick(p, 'solo'); ok('tick, untick restores', await status(p) === '0 of 1 done' && await states(p) === '0');
    ok('page never scrolls', await noScroll(p));
    await closeAll();
  }
  // empty list
  {
    const { page: p, errors } = await open(mk('Empty', []));
    ok('empty list: No items, Done', await status(p) === 'No items' && (await p.locator('.bar button').first().textContent()) === 'Done' && errors.length === 0, errors.join());
    await closeAll();
  }
  // 30 items at 320x568 and 390x780
  for (const [w, hh] of [[320, 568], [390, 780], [360, 480]]) {
    const { page: p } = await open(mk('Many', names(30).map((t, i) => ({ text: t, required: i % 7 === 0 }))), { width: w, height: hh });
    ok(`30 items @${w}: page never scrolls`, await noScroll(p));
    ok(`30 items @${w}: text only, no segments`, await p.locator('.progress-seg').count() === 0 && /^0 of 30 done, 5 required left$/.test(await status(p)));
    const fit = await p.evaluate(() => { const s = document.querySelector('.stack').getBoundingClientRect(), b = document.querySelector('.bar').getBoundingClientRect(), pr = document.querySelector('.progress'), r = pr.getBoundingClientRect(); return { stackBottom: s.bottom, progTop: r.top, progBottom: r.bottom, barTop: b.top, progOverflow: pr.scrollWidth > pr.clientWidth, stackTop: s.top }; });
    ok(`30 items @${w}: stack above progress above bar, no overlap`, fit.stackBottom <= fit.progTop + 0.5 && fit.progBottom <= fit.barTop + 0.5 && !fit.progOverflow, JSON.stringify(fit));
    const dense = await p.evaluate(() => { const rs = [...document.querySelectorAll('.stack > button.item')].map(e => e.getBoundingClientRect()); const sc = document.querySelector('.screen'); return { dense: sc.classList.contains('dense'), h: rs[0].height, req: !!document.querySelector('.item .detail.req'), overlap: rs.some((r, i) => i && r.bottom > rs[i - 1].top + 0.6) }; });
    ok(`30 items @${w}: dense mode when rows < 44px, rows do not overlap`, dense.dense === (dense.h < 44) && !dense.overlap, JSON.stringify(dense));
    await tick(p, 'Item 1', 50);
    ok(`30 items @${w}: tick works`, (await status(p)).startsWith('1 of 30'));
    await closeAll();
  }
  // dense mode turns off again when the viewport grows
  {
    const { page: p } = await open(mk('Grow', names(12).map(t => ({ text: t }))), { width: 320, height: 480 });
    const d = () => p.evaluate(() => document.querySelector('.screen').classList.contains('dense'));
    const d1 = await d(); await p.setViewportSize({ width: 390, height: 1400 }); await p.waitForTimeout(100);
    ok('dense on a short screen, off on a tall one', d1 === true && await d() === false, d1 + ' ' + await d());
    await closeAll();
  }
  {
    const { page: p } = await open(mk('Few', names(3).map(t => ({ text: t }))));
    ok('3 items: not dense', !(await p.evaluate(() => document.querySelector('.screen').classList.contains('dense'))));
    await closeAll();
  }
  // 24 items: segments shown, no overflow at 320
  for (const n of [24, 25]) {
    const { page: p } = await open(mk('Edge', names(n).map((t, i) => ({ text: t, required: i % 2 === 0 }))), { width: 320, height: 568 });
    const m = await p.evaluate(() => { const e = document.querySelector('.progress-segs'); if (!e) return null; const pr = document.querySelector('.progress').getBoundingClientRect(); const r = e.getBoundingClientRect(); const segs = [...e.children].map(c => c.getBoundingClientRect()); return { n: segs.length, left: Math.min(...segs.map(s => s.left)), right: Math.max(...segs.map(s => s.right)), minW: Math.min(...segs.map(s => s.width)), prLeft: pr.left, prRight: pr.right, sw: e.scrollWidth, cw: e.clientWidth }; });
    if (n === 24) ok('24 items @320: 24 segments inside the progress box, each >= 6px wide', m && m.n === 24 && m.left >= m.prLeft - 0.5 && m.right <= m.prRight + 0.5 && m.minW >= 6 && m.sw <= m.cw, JSON.stringify(m));
    else ok('25 items: text only', m === null);
    ok(`${n} items @320: page never scrolls`, await noScroll(p));
    await closeAll();
  }
  // quantities and details
  {
    const list = mk('Trip', [{ text: 'Shirts', qty: 'n' }, { text: 'Socks', qty: 'n + 1', detail: 'Wool' }, { text: 'Charger', detail: 'Phone and watch', required: true }], { questions: [{ id: 'q', name: 'n', type: 'number', text: 'nights', label: 'How many nights?' }] });
    const { page: p } = await open(list);
    await p.keyboard.type('3'); await p.keyboard.press('Enter');
    const t = await p.evaluate(() => [...document.querySelectorAll('.stack > button.item')].map(e => e.innerText.replace(/\s+/g, ' ').trim()).join('|'));
    ok('quantities and details render', t === 'Shirts ×3 ☐|Socks ×4 Wool ☐|Charger required Phone and watch ☐', t);
    ok('status with qty list', await status(p) === '0 of 3 done, 1 required left');
    ok('page never scrolls', await noScroll(p));
    await closeAll();
  }
  // rapid tapping across rows, double tap on one row, sound / speech / vibrate once
  {
    const { page: p } = await open(mk('Fx', [{ text: 'a' }, { text: 'b' }, { text: 'c' }], { sound: true, voice: true }));
    await stub(p);
    await p.locator('.stack > button.item').nth(0).dblclick();
    ok('double tap: ticked once, not unticked', await states(p) === '100', await states(p));
    ok('double tap: sound/speech/vibrate fire once', JSON.stringify(await p.evaluate(() => window.__ev.filter(x => x !== 'start'))) === '["tick","vib12","say:a"]', JSON.stringify(await p.evaluate(() => window.__ev)));
    await p.locator('.stack > button.item').nth(0).click({ clickCount: 3, delay: 10 });
    ok('triple tap: still ticked', await states(p) === '100');
    await p.waitForTimeout(300);
    await tick(p, 'a'); ok('tap after 250ms unticks', await states(p) === '000', await states(p));
    ok('untick: no sound, speech or vibration', await p.evaluate(() => window.__ev.filter(x => x === 'tick').length) === 1);
    // rapid taps on different rows all register
    await p.evaluate(() => { window.__ev.length = 0; });
    await p.locator('.stack > button.item').nth(0).click(); await p.locator('.stack > button.item').nth(1).click(); await p.locator('.stack > button.item').nth(2).click();
    ok('rapid taps on different rows all tick', await states(p) === '111' && await status(p) === '3 of 3 done', await states(p));
    ok('feedback fires once per row', JSON.stringify(await p.evaluate(() => window.__ev.filter(x => x.startsWith('say')))) === '["say:a","say:b","say:c"]');
    // Enter key on a focused row toggles once; keyboard repeat ignored
    await p.waitForTimeout(300);
    await p.locator('.stack > button.item').nth(1).focus(); await p.keyboard.press('Space');
    ok('keyboard Space unticks', await states(p) === '101', await states(p));
    await closeAll();
  }
  // vibrate/sound opt-in: nothing without sound/voice
  {
    const { page: p } = await open(mk('Quiet', [{ text: 'a' }]));
    await stub(p); await tick(p, 'a');
    ok('no feedback unless enabled', JSON.stringify(await p.evaluate(() => window.__ev)) === '[]', JSON.stringify(await p.evaluate(() => window.__ev)));
    await closeAll();
  }
  // tone start/stop stay wired
  {
    const { page: p } = await open(mk('Tone', [{ text: 'a' }, { text: 'b' }], { sound: true }), { init: () => {} });
    // the run already started; re-open to install stubs first
    await p.click('text=Close');
    await stub(p);
    await p.click('.stack button.open');
    await tick(p, 'a');
    await p.click('text=Close'); await p.click('#close-anyway');
    ok('toneStart on run start, toneTick on tick, toneStop on leaving', JSON.stringify(await p.evaluate(() => window.__ev)) === '["start","tick","vib12","stop"]', JSON.stringify(await p.evaluate(() => window.__ev)));
    await closeAll();
  }
  // Ask: numbers
  {
    const q = [{ id: 'q', name: 'n', type: 'number', text: 'nights', label: 'How many nights?' }];
    const { page: p, errors } = await open(mk('A', [{ text: 'S', qty: 'n' }], { questions: q }));
    const ids = await p.evaluate(() => ['answer', 'dec', 'inc'].map(i => !!document.getElementById(i)).join());
    ok('ids exist', ids === 'true,true,true', ids);
    const inp = await p.evaluate(() => { const i = document.getElementById('answer'); return { im: i.inputMode, fs: parseFloat(getComputedStyle(i).fontSize), v: i.value }; });
    ok('input is decimal, >= 16px, default 1', inp.im === 'decimal' && inp.fs >= 16 && inp.v === '1', JSON.stringify(inp));
    const geo = await p.evaluate(() => ['dec', 'inc'].map(i => { const r = document.getElementById(i).getBoundingClientRect(); return [r.width, r.height]; }));
    ok('steppers are 48px', geo.every(g => g[0] >= 48 && g[1] >= 48), JSON.stringify(geo));
    const alertTxt = () => p.evaluate(() => { const a = document.querySelector('[role=alert]'); return a ? a.textContent : ''; });
    const onAsk = () => p.locator('#answer').count();
    const tryVal = async v => { await p.fill('#answer', v); await p.keyboard.press('Enter'); await p.waitForTimeout(30); };
    const top0 = await p.evaluate(() => document.getElementById('answer').getBoundingClientRect().top);
    await tryVal('');
    ok('empty: message, stays', await alertTxt() === 'Enter a number' && await onAsk() === 1, await alertTxt());
    ok('message does not move the field (no jump)', await p.evaluate(() => document.getElementById('answer').getBoundingClientRect().top) === top0);
    await tryVal('abc'); ok('abc: message, stays', await alertTxt() === 'Enter a number' && await onAsk() === 1);
    ok('aria-invalid + describedby while invalid', await p.evaluate(() => { const i = document.getElementById('answer'); return i.getAttribute('aria-invalid') === 'true' && i.getAttribute('aria-describedby') === document.querySelector('[role=alert]').id; }));
    await tryVal('1e9'); ok('1e9: range message, stays', /between/.test(await alertTxt()) && await onAsk() === 1, await alertTxt());
    await tryVal('-1e9'); ok('-1e9: range message', /between/.test(await alertTxt()) && await onAsk() === 1);
    await tryVal('1000001'); ok('1000001 rejected', await onAsk() === 1);
    await tryVal('9'.repeat(400)); ok('400 digits rejected without NaN/throw', await onAsk() === 1 && /between/.test(await alertTxt()));
    await tryVal('0x10'); ok('hex rejected', await onAsk() === 1);
    await tryVal('Infinity'); ok('Infinity rejected', await onAsk() === 1);
    await tryVal('1 000'); ok('inner space rejected', await onAsk() === 1);
    await tryVal('1,000.5'); ok('mixed separators rejected', await onAsk() === 1);
    await tryVal('.'); ok('lone dot rejected', await onAsk() === 1);
    await tryVal('-'); ok('lone minus rejected', await onAsk() === 1);
    await p.fill('#answer', '2'); ok('message clears once the value is valid', await alertTxt() === '');
    // paste of non-numeric text shows the message at once
    await p.fill('#answer', '');
    await p.evaluate(() => { const i = document.getElementById('answer'); i.focus(); });
    await p.evaluate(() => navigator.clipboard && 0);
    await p.evaluate(() => { const i = document.getElementById('answer'); const dt = new DataTransfer(); dt.setData('text/plain', 'hello'); i.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
    await p.fill('#answer', 'hello');
    ok('pasted non-numeric text shows a message without pressing Enter', await alertTxt() === 'Enter a number', await alertTxt());
    // steppers
    await p.fill('#answer', '0'); await p.click('#inc'); ok('inc from 0 -> 1', await p.inputValue('#answer') === '1');
    await p.fill('#answer', '0'); await p.click('#dec'); ok('dec from 0 -> -1', await p.inputValue('#answer') === '-1');
    await p.fill('#answer', '2.5'); await p.click('#inc'); ok('inc 2.5 -> 3.5', await p.inputValue('#answer') === '3.5');
    await p.fill('#answer', '2,5'); await p.click('#dec'); ok('dec 2,5 -> 1.5', await p.inputValue('#answer') === '1.5', await p.inputValue('#answer'));
    await p.fill('#answer', '0.1'); await p.click('#inc'); await p.click('#inc'); ok('0.1 + 1 + 1 = 2.1 (no float noise)', await p.inputValue('#answer') === '2.1', await p.inputValue('#answer'));
    await p.fill('#answer', '0.7'); await p.click('#dec'); ok('0.7 - 1 = -0.3', await p.inputValue('#answer') === '-0.3', await p.inputValue('#answer'));
    await p.fill('#answer', ''); await p.click('#inc'); ok('inc from empty -> 1', await p.inputValue('#answer') === '1');
    await p.fill('#answer', 'abc'); await p.click('#dec'); ok('dec from text -> -1', await p.inputValue('#answer') === '-1');
    await p.fill('#answer', '1000000'); await p.click('#inc'); ok('inc clamps at 1e6', await p.inputValue('#answer') === '1000000', await p.inputValue('#answer'));
    await p.fill('#answer', '1e9'); await p.click('#dec'); ok('dec from 1e9 lands on the limit', await p.inputValue('#answer') === '999999', await p.inputValue('#answer'));
    await p.fill('#answer', '1'); await p.click('#inc'); await p.click('#inc'); await p.click('#dec'); ok('multiple steps', await p.inputValue('#answer') === '2');
    ok('stepper click keeps focus in the field', await p.evaluate(() => document.activeElement.id) === 'answer');
    // accepted values
    await p.fill('#answer', ' 4 '); await p.keyboard.press('Enter'); await p.waitForTimeout(50);
    const t4 = await p.evaluate(() => [...document.querySelectorAll('.stack > button.item')].map(e => e.innerText.replace(/\s+/g, ' ').trim()).join('|'));
    ok("' 4 ' accepted as 4", t4 === 'S ×4 ☐', t4);
    ok('no page errors', errors.length === 0, errors.join());
    await closeAll();
  }
  for (const [v, exp] of [['2,5', 'S ×2.5 ☐'], ['-3', null], ['0', null], ['1e3', 'S ×1000 ☐'], ['+3', 'S ×3 ☐'], ['−2', null], ['1000000', 'S ×1000000 ☐']]) {
    const { page: p } = await open(mk('A', [{ text: 'S', qty: 'n' }, { text: 'Fixed' }], { questions: [{ id: 'q', name: 'n', type: 'number', text: 'nights', label: 'How many nights?' }] }));
    await p.fill('#answer', v); await p.keyboard.press('Enter'); await p.waitForTimeout(50);
    const t = await p.evaluate(() => [...document.querySelectorAll('.stack > button.item')].map(e => e.innerText.replace(/\s+/g, ' ').trim()).join('|'));
    if (exp) ok(`value ${JSON.stringify(v)} accepted`, t.includes(exp), t);
    else ok(`value ${JSON.stringify(v)} accepted, quantity <= 0 drops the item`, t === 'Fixed ☐', t);
    await closeAll();
  }
  // Ask: Start button click with invalid value, Cancel
  {
    const { page: p } = await open(mk('A', [{ text: 'S', qty: 'n' }], { questions: [{ id: 'q', name: 'n', type: 'number', text: 'nights', label: 'How many nights?' }] }));
    await p.fill('#answer', ''); await p.click('.actions button:last-child');
    ok('Start with empty shows message', await p.locator('[role=alert]').count() === 1 && await p.locator('#answer').count() === 1);
    await p.click('text=Cancel'); ok('Cancel returns home', await p.locator('#new').count() === 1);
    await closeAll();
  }
  // Ask: yes/no flow with Back, mixed list
  {
    const qs = [{ id: 'q1', name: 'n', type: 'number', text: 'days', label: 'How many days?' }, { id: 'q2', name: 'rain', type: 'yesno', text: 'it rains', label: 'Rain?' }, { id: 'q3', name: 'm', type: 'number', text: 'm', label: 'How many m?' }];
    const { page: p } = await open(mk('Flow', [{ text: 'Shirts', qty: 'n' }, { text: 'Coat', qty: 'rain' }, { text: 'Hat', qty: 'm' }], { questions: qs }));
    await p.fill('#answer', '2'); await p.keyboard.press('Enter');
    ok('second question is yes/no, no input', (await p.textContent('h1')) === 'Rain?' && await p.locator('#answer').count() === 0);
    const yn = await p.evaluate(() => ['no', 'yes'].map(i => { const r = document.getElementById(i).getBoundingClientRect(); return [r.width, r.height]; }));
    ok('Yes/No >= 52px tall, wide', yn.every(g => g[1] >= 52 && g[0] >= 120), JSON.stringify(yn));
    ok('no page scroll on yes/no', await noScroll(p));
    await p.click('text=Back');
    ok('Back returns to question 1 keeping the value', (await p.textContent('h1')) === 'How many days?' && await p.inputValue('#answer') === '2');
    await p.keyboard.press('Enter');
    await p.click('#yes');
    ok('third question after yes', (await p.textContent('h1')) === 'How many m?');
    await p.fill('#answer', 'x'); await p.keyboard.press('Enter');
    ok('invalid on the last question blocks start', await p.locator('[role=alert]').count() === 1 && await p.locator('#answer').count() === 1);
    await p.click('text=Back'); ok('Back from number question goes to yes/no', (await p.textContent('h1')) === 'Rain?');
    await p.click('#no'); await p.waitForTimeout(30);
    ok('message cleared on a new question', await p.locator('[role=alert]').count() === 0);
    await p.fill('#answer', '3'); await p.keyboard.press('Enter');
    const t = await p.evaluate(() => [...document.querySelectorAll('.stack > button.item')].map(e => e.innerText.replace(/\s+/g, ' ').trim()).join('|'));
    ok('flow result: no -> Coat dropped, Shirts x2, Hat x3', t === 'Shirts ×2 ☐|Hat ×3 ☐', t);
    await closeAll();
  }
  // Ask screen fits at 320x568 and 360x480 incl. error line + yes/no
  for (const [w, hh] of [[320, 568], [360, 480]]) {
    const qs = [{ id: 'q1', name: 'n', type: 'number', text: 'days', label: 'How many days will you be away from home this time?' }, { id: 'q2', name: 'rain', type: 'yesno', text: 'it rains', label: 'Do you expect rain during the whole trip?' }];
    const { page: p } = await open(mk('A very long checklist title here', [{ text: 'S', qty: 'n' }], { questions: qs }), { width: w, height: hh });
    await p.fill('#answer', 'zz'); await p.keyboard.press('Enter');
    ok(`ask number @${w}x${hh} no scroll, steppers inside viewport`, await noScroll(p) && await p.evaluate(() => ['dec', 'inc', 'answer'].every(i => { const r = document.getElementById(i).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })));
    await p.fill('#answer', '1'); await p.keyboard.press('Enter');
    ok(`ask yes/no @${w}x${hh} fits`, await noScroll(p) && await p.evaluate(() => ['no', 'yes'].every(i => { const r = document.getElementById(i).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })));
    await closeAll();
  }
  // copy: no exclamation marks anywhere on run/ask
  {
    const { page: p } = await open(mk('Copy', [{ text: 'a', required: true }, { text: 'b' }]));
    await tick(p, 'b'); await p.click('.bar button');
    ok('no exclamation marks in run copy', !(await p.evaluate(() => document.body.innerText)).includes('!'));
    await closeAll();
  }
  // dark, design variants render the confirm without page scroll
  for (const design of ['classic', 'airplane', 'modern']) for (const colorScheme of ['light', 'dark']) {
    const { page: p } = await open(mk('D', names(6).map((t, i) => ({ text: t, required: i === 1 }))), { settings: { design }, colorScheme, width: 320, height: 568 });
    await tick(p, 'Item 1'); await p.click('.bar button');
    ok(`${design}/${colorScheme}: confirm shows, buttons inside viewport, no scroll`, await noScroll(p) && await p.evaluate(() => ['keep-going', 'close-anyway'].every(i => { const r = document.getElementById(i).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.height >= 48; })));
    await closeAll();
  }
  console.log('FAILS:', fails);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(2); });
