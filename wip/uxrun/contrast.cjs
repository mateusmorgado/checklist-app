const { openApp, closeAll } = require('/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/harness.cjs');
const F = '/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/work/uxrun/index.html';
const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
(async () => {
  let bad = 0;
  for (const [design, cs] of [['classic', 'light'], ['classic', 'dark'], ['airplane', 'dark'], ['modern', 'light'], ['modern', 'dark']]) {
    const { page } = await openApp(F, { settings: { design, mode: cs === 'dark' ? 'dark' : 'light' }, colorScheme: cs, storage: { checklists: [{ id: 'a', title: 'T', items: [{ text: 'one', detail: 'dd', required: true }, 'two'] }] } });
    await page.click('.stack button.open'); await page.locator('.item').first().click(); await page.waitForTimeout(200);
    const r = await page.evaluate(() => { const bg = getComputedStyle(document.body).backgroundColor; const out = {}; const done = document.querySelector('.item.done'); out.done = getComputedStyle(done).color; out.detail = getComputedStyle(done.querySelector('.detail')).color; out.prog = getComputedStyle(document.querySelector('.progress-text')).color; out.bg = bg; out.op = getComputedStyle(done).opacity; return out; });
    const vals = ['done', 'detail', 'prog'].map(k => cr(r[k], r.bg).toFixed(2));
    console.log(design, cs, vals.join(' '), 'opacity', r.op);
    if (vals.some(v => v < 4.5)) bad++;
    await closeAll();
  }
  console.log('LOW CONTRAST', bad);
})();
