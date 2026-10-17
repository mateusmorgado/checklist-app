const { openApp, closeAll } = require('/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/harness.cjs');
const F = '/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/work/uxrun/index.html';
const D = __dirname;
(async () => {
  for (const [w, hh] of [[390, 780], [320, 568]]) for (const cs of ['light', 'dark']) {
    const { page } = await openApp(F, { width: w, height: hh, colorScheme: cs });
    const tag = `${w}-${cs}`;
    await page.click('text=Weekend trip');
    await page.screenshot({ path: `${D}/ask-num-${tag}.png` });
    await page.keyboard.type('abc'); await page.keyboard.press('Enter');
    await page.screenshot({ path: `${D}/ask-err-${tag}.png` });
    await page.fill('#answer', '3'); await page.keyboard.press('Enter');
    await page.screenshot({ path: `${D}/run0-${tag}.png` });
    await page.click('text=Shirts'); await page.waitForTimeout(300);
    await page.click('text=Charger'); await page.waitForTimeout(300);
    await page.screenshot({ path: `${D}/run2-${tag}.png` });
    await page.click('.bar button'); 
    await page.screenshot({ path: `${D}/confirm-${tag}.png` });
    console.log(tag, await page.evaluate(() => [document.documentElement.scrollHeight, innerHeight]));
    await page.click('#keep-going'); await page.click('text=Close'); await page.click('text=Close anyway').catch(()=>{});
    await page.click('text=Gym');
    await page.screenshot({ path: `${D}/ask-yn-${tag}.png` });
    await closeAll();
  }
})();
