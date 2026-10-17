const { openApp, closeAll } = require('/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/harness.cjs');
const F = '/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/work/uxrun/index.html';
(async () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ text: 'Item ' + (i + 1), required: i % 7 === 0 }));
  const items24 = Array.from({ length: 24 }, (_, i) => ({ text: 'Item ' + (i + 1), required: i % 5 === 0 }));
  for (const [n, it, w, hh, design, cs] of [['30', items, 320, 568, 'classic', 'light'], ['24', items24, 320, 568, 'classic', 'dark'], ['30', items, 390, 780, 'classic', 'light'], ['24', items24, 320, 568, 'airplane', 'dark'], ['24', items24, 320, 568, 'modern', 'light']]) {
    const { page } = await openApp(F, { width: w, height: hh, colorScheme: cs, settings: { design }, storage: { checklists: [{ id: 'm', title: 'Many items', items: it }] } });
    await page.click('.stack button.open');
    for (const k of [1, 2, 3]) { await page.locator('.stack > button.item').nth(k - 1).click(); await page.waitForTimeout(300); }
    await page.screenshot({ path: `${__dirname}/many-${n}-${w}-${design}-${cs}.png` });
    await closeAll();
  }
})();
