// Settings > Attention tone in all three designs at phone sizes (real AudioContext), plus the run bar with the mute button.
const L = require('./lib.cjs');
const { openApp, ok, sleep, list } = L;
(async () => {
  for (const design of ['classic', 'airplane', 'modern']) for (const [w, h] of [[360, 560], [320, 480]]) {
    const errs = [];
    const { page } = await openApp(L.FILE, { width: w, height: h, reducedMotion: 'no-preference', errors: e => errs.push(e), settings: { design, tone: { choice: 'cabin', volume: 'medium' } },
      storage: { checklists: [list('L', 'Loud', 6, true)] } });
    await page.click('#settings'); await page.click('#set-tone');
    await sleep(300);
    const m = await page.evaluate(() => {
      const r = e => { const b = document.querySelector(e).getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      const sc = document.querySelector('.settings-scroll');
      const bad = [...document.querySelectorAll('.screen *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.left < -0.5 || b.right > innerWidth + 0.5) && !sc.contains(e) || (sc.contains(e) && b.width > 0 && (b.left < -0.5 || b.right > innerWidth + 0.5)); }).map(e => e.tagName + '.' + e.className);
      const act = r('.actions');
      return { docScroll: [document.documentElement.scrollWidth, innerWidth, document.documentElement.scrollHeight, innerHeight], bad, actBottom: act.b, scroll: [sc.scrollHeight, sc.clientHeight, sc.scrollWidth, sc.clientWidth], choiceH: document.querySelector('#tone-heart').getBoundingClientRect().height, previewHit: [document.querySelector('#tone-preview').getBoundingClientRect().width, document.querySelector('#tone-preview').getBoundingClientRect().height] };
    });
    ok(`${design} ${w}x${h}: page does not scroll`, m.docScroll[0] <= m.docScroll[1] && m.docScroll[2] <= m.docScroll[3], JSON.stringify(m.docScroll));
    ok(`${design} ${w}x${h}: nothing wider than the screen`, m.bad.length === 0 && m.scroll[2] <= m.scroll[3], JSON.stringify(m));
    ok(`${design} ${w}x${h}: buttons inside the viewport`, m.actBottom <= h + 0.5, m.actBottom);
    ok(`${design} ${w}x${h}: hit areas >= 48`, m.choiceH >= 47.5 && m.previewHit[0] >= 47.5 && m.previewHit[1] >= 47.5, JSON.stringify(m));
    await page.screenshot({ path: `${__dirname}/shot-tone-${design}-${w}.png` });
    // scroll to the bottom to see Volume
    await page.evaluate(() => { const s = document.querySelector('.settings-scroll'); s.scrollTop = s.scrollHeight; });
    await page.screenshot({ path: `${__dirname}/shot-tone-${design}-${w}-bottom.png` });
    ok(`${design} ${w}x${h}: no errors`, errs.length === 0, errs.join('|'));
    if (w === 360) {
      await page.click('#tone-back'); await page.click('#settings-back');
      await page.locator('.home-item .open').first().click(); await sleep(600);
      await page.screenshot({ path: `${__dirname}/shot-run-${design}.png` });
      const bar = await page.evaluate(() => [...document.querySelectorAll('.bar button')].map(b => { const r = b.getBoundingClientRect(); return [b.textContent, Math.round(r.width), Math.round(r.height), r.left >= 0 && r.right <= innerWidth]; }));
      ok(`${design}: run bar buttons fit and are 48+`, bar.length === 2 && bar.every(x => x[1] >= 48 && x[2] >= 48 && x[3]), JSON.stringify(bar));
      await page.click('#mute'); await sleep(200);
      await page.screenshot({ path: `${__dirname}/shot-run-${design}-muted.png` });
      ok(`${design}: real AudioContext, no errors through a muted run`, errs.length === 0, errs.join('|'));
    }
  }
  process.exit(L.report() ? 1 : 0);
})().catch(e => { console.log('FAIL crashed', e); process.exit(1); });
