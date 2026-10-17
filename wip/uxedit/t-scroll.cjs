// Item 3: viewport and inner scroll; hold-to-drag in a scrollable stack (mouse and CDP touch).
const L = require('./lib.cjs');
const { ok } = L;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const geo = p => p.evaluate(() => {
  const g = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height, left: r.left, right: r.right }; };
  const st = document.querySelector('.stack');
  const rows = [...document.querySelectorAll('.stack .row')].map(r => r.getBoundingClientRect().height);
  return { stack: g('.stack'), entry: g('.entry'), actions: g('.actions'), hint: g('.hint'), h1: g('.points > h1'),
    scrolls: st.scrollHeight > st.clientHeight + 1, minRow: Math.min(...rows), rows: rows.length,
    docScroll: document.documentElement.scrollHeight === innerHeight && document.documentElement.scrollWidth === innerWidth,
    inner: [innerWidth, innerHeight], screenH: document.querySelector('.screen').getBoundingClientRect().height, scrollTop: st.scrollTop,
    overflowY: getComputedStyle(st).overflowY, html: [document.documentElement.scrollTop, document.body.scrollTop, document.querySelector('.screen').scrollTop] };
});
const fits = (g, h) => g.actions.bottom <= h + 0.5 && g.entry.bottom <= g.actions.top && g.stack.bottom <= g.hint.top + 0.5 && g.stack.top >= -0.5;

(async () => {
  for (const [W, H] of [[390, 780], [320, 568], [320, 480]]) {
    for (const n of [3, 15, 40, 80]) {
      const { page: p, browser } = await L.open({ width: W, height: H, lists: [L.list(n, 'Lots')] });
      await L.edit(p, 'Lots');
      const g = await geo(p);
      const tag = `${W}x${H} ${n} items`;
      ok(tag + ': page does not scroll', g.docScroll && g.html.every(v => v === 0), JSON.stringify(g.html));
      ok(tag + ': screen is the viewport height', Math.abs(g.screenH - H) < 1, g.screenH);
      ok(tag + ': rows keep min height 48', g.minRow >= 47.99, g.minRow);
      ok(tag + ': entry and buttons stay on screen', fits(g, H), JSON.stringify(g));
      if (n >= 15 && H <= 568 || n >= 40) ok(tag + ': stack scrolls inside itself', g.scrolls && g.overflowY === 'auto', JSON.stringify({ s: g.scrolls, o: g.overflowY }));
      if (n === 3) ok(tag + ': short list does not scroll', !g.scrolls);
      if (g.scrolls) {
        // newest (top) row reachable, bottom row reachable
        const info = await p.evaluate(() => {
          const st = document.querySelector('.stack');
          const first = [...document.querySelectorAll('.stack .row')].find(r => r.textContent.includes('Point 1')); // order 0 = bottom
          const vis = el => { const r = el.getBoundingClientRect(), b = st.getBoundingClientRect(); return r.top >= b.top - 1 && r.bottom <= b.bottom + 1; };
          const res = { startFirstVisible: vis(first) };
          st.scrollTop = -(st.scrollHeight - st.clientHeight);
          const lastRow = [...document.querySelectorAll('.stack .row')].sort((a, b) => +b.style.order - +a.style.order)[0];
          res.topLastVisible = vis(lastRow);
          res.topScroll = st.scrollTop;
          st.scrollTop = 0;
          return res;
        });
        ok(tag + ': first row visible at start, last row reachable by scrolling', info.startFirstVisible && info.topLastVisible && info.topScroll < 0, JSON.stringify(info));
      }
      ok(tag + ': page still does not scroll after inner scroll', await L.noPageScroll(p));
      if (n === 80) {
        // the 81st is refused (limit), the page stays fine
        await p.fill('#draft', 'one more'); await p.press('#draft', 'Enter');
        ok(tag + ': 81st point refused with a message', (await p.textContent('.hint')) === 'A checklist can have up to 80 points.' && (await L.cssOrder(p)).length === 80, await p.textContent('.hint'));
        ok(tag + ': draft kept after refusal', (await p.inputValue('#draft')) === 'one more');
      }
      await browser.close();
    }
  }

  // adding at 15+ items scrolls the new row into view; page stays put
  {
    const { page: p } = await L.open({ width: 320, height: 480, lists: [L.list(15, 'Lots')] });
    await L.edit(p, 'Lots');
    await p.fill('#draft', 'Newest'); await p.press('#draft', 'Enter');
    const vis = await p.evaluate(() => { const st = document.querySelector('.stack'); const r = [...document.querySelectorAll('.stack .row')].find(x => x.textContent.includes('Newest')).getBoundingClientRect(), b = st.getBoundingClientRect(); return r.top >= b.top - 1 && r.bottom <= b.bottom + 1; });
    ok('new point is scrolled into view', vis);
    ok('no page scroll after add', await L.noPageScroll(p));
    // Alt+Arrow moves a row off-screen: it is scrolled back into view
    await p.evaluate(() => { document.querySelector('.stack').scrollTop = 0; });
    await p.locator('.row').first().focus();
    for (let i = 0; i < 12; i++) await p.keyboard.press('Alt+ArrowUp');
    const vis2 = await p.evaluate(() => { const st = document.querySelector('.stack'); const r = [...document.querySelectorAll('.stack .row')].find(x => x.textContent.includes('Point 1')).getBoundingClientRect(), b = st.getBoundingClientRect(); return r.top >= b.top - 1 && r.bottom <= b.bottom + 1; });
    ok('moved row stays in view while moving up the list with the keyboard', vis2);
    ok('no page scroll after keyboard moves', await L.noPageScroll(p));
  }

  // 200% root font size and larger text
  for (const [W, H] of [[320, 480], [390, 780]]) {
    const { page: p } = await L.open({ width: W, height: H, lists: [L.list(15, 'Lots')] });
    await L.edit(p, 'Lots');
    await p.addStyleTag({ content: 'html{font-size:200% !important} body{font-size:36px !important} input{font-size:max(16px,1em)}' });
    await sleep(100);
    const g = await geo(p);
    const tag = `${W}x${H} 200%`;
    ok(tag + ': page does not scroll', g.docScroll && g.html.every(v => v === 0));
    ok(tag + ': rows keep min height', g.minRow >= 47.99, g.minRow);
    ok(tag + ': buttons on screen, entry above buttons', g.actions.bottom <= H + 0.5 && g.entry.bottom <= g.actions.top + 0.5, JSON.stringify({ a: g.actions, e: g.entry }));
    ok(tag + ': stack scrolls inside', g.scrolls);
    // nothing sticks out horizontally
    const wide = await p.evaluate(() => [...document.querySelectorAll('.screen *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && !e.closest('.stack'); }).map(e => e.tagName + '.' + e.className));
    ok(tag + ': no control sticks out of the viewport horizontally', wide.length === 0, JSON.stringify(wide));
    // item step at 200%
    await p.locator('.row', { hasText: 'Point 3' }).click();
    const g2 = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { docScroll: document.documentElement.scrollHeight === innerHeight, bottom: r('.screen > .actions').bottom, up: r('#move-up').bottom, input: r('#field').bottom, h1: r('.points > h1').top, ih: innerHeight }; });
    ok(tag + ': item step does not scroll the page and keeps buttons on screen', g2.docScroll && g2.bottom <= H + 0.5 && g2.up <= g2.bottom, JSON.stringify(g2));
  }

  // safe-area insets (CDP) move the controls in, nothing is under the home indicator
  {
    const { page: p, ctx } = await L.open({ width: 390, height: 780, lists: [L.list(5, 'Five')] });
    const cdp = await ctx.newCDPSession(p);
    let supported = true;
    try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } }); } catch (e) { supported = false; console.log('safe-area emulation not supported:', e.message); }
    if (supported) {
      await sleep(200);
      const m = await p.evaluate(() => { const pad = getComputedStyle(document.querySelector('.screen')); return { pt: pad.paddingTop, pb: pad.paddingBottom, pr: pad.paddingRight }; });
      ok('safe-area: bottom padding follows env(safe-area-inset-bottom) (34px)', m.pb === '34px' && m.pt === '47px', JSON.stringify(m));
      await L.edit(p, 'Five');
      const b = await p.evaluate(() => document.querySelector('.actions').getBoundingClientRect().bottom);
      ok('safe-area: bottom row ends above the home indicator', b <= 780 - 34 + 0.5, b);
      await p.locator('.row', { hasText: 'Point 2' }).locator('.x').click();
      const tb = await p.evaluate(() => { const t = document.querySelector('.toast-box').getBoundingClientRect(), a = document.querySelector('.screen > .actions').getBoundingClientRect(); return t.bottom <= a.top; });
      ok('safe-area: toast above the bottom row', tb);
    }
  }
  await L.summary();
})().catch(e => { console.log('FAIL exception', e.stack); process.exit(1); });
