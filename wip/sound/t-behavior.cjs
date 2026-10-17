// Start/stop/mute/hidden/preview behaviour, failure modes and persistence, with the recording fake AudioContext.
const L = require('./lib.cjs');
const { open, runLoud, runQuiet, starts, now, gaps, ok, sleep } = L;
const HEART = { choice: 'heart', volume: 'medium' };
const nStarts = page => page.evaluate(() => __au.starts.length);
const live = page => page.evaluate(() => __au.intervals.live.size);
// starts that would still sound after time t (scheduled later and not cancelled before they begin)
const audibleAfter = (page, t) => page.evaluate(t => __au.starts.filter(s => s.t > t + 0.001 && !s.node.stops.some(x => x.t <= s.t)).length, t);
const masterNow = page => page.evaluate(() => { const m = __au.masterNode(); return m.gain.value; });

(async () => {
  // 1. sound off for the checklist: nothing at all
  {
    const { page, errors } = await open({ tone: HEART });
    await runQuiet(page);
    ok('sound off: no mute button', await page.locator('#mute').count() === 0);
    await page.locator('.stack button').nth(0).click(); await page.locator('.stack button').nth(1).click();
    await sleep(1500);
    ok('sound off: no context, no voices', await page.evaluate(() => __au.ctxs.length + __au.starts.length) === 0);
    ok('sound off: no timers', await page.evaluate(() => __au.intervals.set) === 0);
    ok('sound off: no errors', errors.length === 0);
  }
  // 2. tick: exactly one tick per tick, nothing continuous, no mute button
  {
    const { page, errors } = await open({ tone: { choice: 'tick', volume: 'high' } });
    await runLoud(page);
    ok('tick: run start makes no context', await page.evaluate(() => __au.ctxs.length) === 0);
    ok('tick: no mute button', await page.locator('#mute').count() === 0);
    const items = page.locator('.stack button');
    await items.nth(0).click(); ok('tick: one oscillator for one tick', await nStarts(page) === 1);
    await items.nth(1).click(); ok('tick: two for two', await nStarts(page) === 2);
    await items.nth(1).click(); ok('tick: unticking is silent', await nStarts(page) === 2);
    await sleep(1500);
    ok('tick: nothing continuous', await nStarts(page) === 2 && await page.evaluate(() => __au.intervals.set) === 0 && await page.evaluate(() => __au.starts.every(s => s.kind === 'osc')));
    ok('tick: master at the high cap', Math.abs(await masterNow(page) - 0.22) < 1e-6, await masterNow(page));
    ok('tick: no errors', errors.length === 0);
  }
  // 3. start twice does not double the beat; stop twice and with nothing started is safe
  {
    const { page, errors } = await open({ tone: HEART });
    await page.evaluate(() => { toneStop(); toneStop(); });
    ok('stop with nothing started: fine', await page.evaluate(() => __au.ctxs.length) === 0);
    await page.evaluate(() => { toneStart({ choice: 'heart', volume: 'medium' }); toneStart({ choice: 'heart', volume: 'medium' }); });
    await sleep(4200);
    const b = await starts(page, 900, 1100); const g = gaps(b);
    ok('start twice: still one beat per 833 ms', b.length >= 5 && g.every(x => Math.abs(x - 60 / 72) < 0.015), g);
    ok('start twice: one timer', await live(page) === 1);
    await page.evaluate(() => { toneStop(); toneStop(); });
    ok('stop twice: timers cleared', await live(page) === 0);
    ok('stop: no errors', errors.length === 0);
  }
  // 4. Close, Done: nothing scheduled after stop
  for (const how of ['Close', 'Done']) {
    const { page, errors } = await open({ tone: HEART, items: 3 });
    await runLoud(page);
    await sleep(1300);
    if (how === 'Done') for (let i = 0; i < 3; i++) await page.locator('.stack button').nth(i).click();
    ok(how + ': button label', (await page.locator('.bar button').first().textContent()) === how);
    await page.locator('.bar button').first().click();
    const t = await now(page);
    await sleep(120);
    const n1 = await nStarts(page);
    await sleep(2500);
    ok(how + ': no new voices after stop', await nStarts(page) === n1);
    ok(how + ': nothing audible scheduled after stop', await audibleAfter(page, t) === 0);
    ok(how + ': timers cleared', await live(page) === 0);
    ok(how + ': master faded to 0', Math.abs(await masterNow(page)) < 1e-6);
    ok(how + ': no errors', errors.length === 0);
  }
  // 5. mute / unmute from the button
  {
    const { page, errors } = await open({ tone: HEART });
    await runLoud(page);
    await sleep(1200);
    const mute = page.locator('#mute');
    ok('mute: button present, label Sound off, not pressed', (await mute.textContent()) === 'Sound off' && (await mute.getAttribute('aria-pressed')) === 'false' && (await mute.getAttribute('class')).includes('muted'));
    await mute.click();
    const t = await now(page);
    ok('mute: label Sound on, pressed', (await mute.textContent()) === 'Sound on' && (await mute.getAttribute('aria-pressed')) === 'true');
    await sleep(220);
    ok('mute: master silent within 200 ms', (await masterNow(page)) < 1e-6, await masterNow(page));
    const n1 = await nStarts(page);
    await sleep(2200);
    ok('mute: no beats while muted', await nStarts(page) === n1);
    ok('mute: scheduler stopped', await live(page) === 0);
    await mute.click();
    ok('unmute: label Sound off', (await mute.textContent()) === 'Sound off' && (await mute.getAttribute('aria-pressed')) === 'false');
    await sleep(1600);
    ok('unmute: beats resume', (await nStarts(page)) >= n1 + 2, await nStarts(page));
    ok('unmute: master back at the cap', Math.abs(await masterNow(page) - 0.12) < 1e-6, await masterNow(page));
    // a new run starts unmuted
    await mute.click();
    await page.locator('.bar button').first().click();
    await runLoud(page);
    ok('new run starts unmuted', (await page.locator('#mute').textContent()) === 'Sound off');
    const n2 = await nStarts(page);
    await sleep(1800);
    ok('new run beats', (await nStarts(page)) > n2);
    ok('mute: no errors', errors.length === 0);
  }
  // 6. document.hidden pauses; visible resumes only if a run is active and not muted
  {
    const { page, errors } = await open({ tone: HEART });
    const setHidden = h => page.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, h);
    await runLoud(page);
    await sleep(1300);
    await setHidden(true);
    await sleep(250);
    ok('hidden: master silent', (await masterNow(page)) < 1e-6);
    const n1 = await nStarts(page);
    await sleep(2000);
    ok('hidden: no beats', await nStarts(page) === n1 && await live(page) === 0);
    await setHidden(false);
    await sleep(1700);
    ok('visible again: beats resume', (await nStarts(page)) >= n1 + 1);
    await page.locator('#mute').click();
    await setHidden(true); await setHidden(false);
    const n2 = await nStarts(page);
    await sleep(1500);
    ok('visible while muted: stays silent', await nStarts(page) === n2);
    await page.locator('#mute').click();
    await page.locator('.bar button').first().click();
    await setHidden(true); await setHidden(false);
    await sleep(300);
    const n3 = await nStarts(page);
    await sleep(1600);
    ok('visible with no run: stays silent', await nStarts(page) === n3);
    // a run that starts while hidden waits for the page to be visible
    await setHidden(true);
    await runLoud(page);
    await sleep(700);
    const n4 = await nStarts(page);
    await setHidden(false);
    await sleep(1500);
    ok('started while hidden: plays once visible', (await nStarts(page)) > n4 && n4 === n3);
    ok('hidden: no errors', errors.length === 0);
  }
  // 7. a stalled tab does not bunch beats up
  {
    const { page, errors } = await open({ tone: HEART });
    await runLoud(page);
    await sleep(1500);
    await page.evaluate(() => { const e = performance.now() + 1800; while (performance.now() < e); });
    await sleep(3200);
    const b = await starts(page, 900, 1100); const g = gaps(b);
    ok('stall: no bunched beats (all gaps >= 0.8 s)', g.length >= 4 && g.every(x => x > 0.8), g);
    ok('stall: phase kept (gaps are whole beats)', g.every(x => Math.abs(x / (60 / 72) - Math.round(x / (60 / 72))) < 0.02), g);
    ok('stall: no errors', errors.length === 0);
  }
  // 8. rapid tick and untick
  for (const choice of ['tick', 'heart']) {
    const { page, errors } = await open({ tone: { choice, volume: 'medium' } });
    await runLoud(page);
    await page.evaluate(async () => { const bs = [...document.querySelectorAll('.stack button')]; for (let k = 0; k < 60; k++) { bs[k % 5].click(); await new Promise(r => setTimeout(r, 0)); } });
    await sleep(500);
    ok('rapid ticking (' + choice + '): no errors, still running', errors.length === 0 && await page.locator('.stack button').count() === 12);
    if (choice === 'tick') ok('rapid ticking: one tick per tick, not per untick', await nStarts(page) === 30, await nStarts(page));
  }
  // 9. preview in Settings: 3 s, replacement, stops on Back; persistence
  {
    const { page, errors } = await open({ tone: { choice: 'tick', volume: 'medium' }, seedOnce: true });
    await page.click('#settings'); await page.click('#set-tone');
    ok('tone screen markup', await page.locator('.screen.settings .settings-scroll .settings-in h1').count() === 1
      && await page.locator('.choices[role=radiogroup] button.choice[role=radio]').count() === 6 && await page.locator('#tone-volume.srow').count() === 1
      && await page.locator('.actions #tone-preview').count() === 1 && await page.locator('.actions #tone-back').count() === 1);
    ok('tone screen: tick selected', (await page.getAttribute('#tone-tick', 'aria-checked')) === 'true' && (await page.getAttribute('#tone-heart', 'aria-checked')) === 'false');
    await page.click('#tone-tick');
    ok('preview tick: exactly one tick', await nStarts(page) === 1);
    await page.click('#tone-heart');
    ok('select heart: saved', await page.evaluate(() => JSON.parse(localStorage.getItem('settings')).tone.choice) === 'heart' && (await page.getAttribute('#tone-heart', 'aria-checked')) === 'true');
    await sleep(1500);
    const tSon = await page.click('#tone-sonar').then(() => now(page));
    await sleep(300);
    const heartAfter = await page.evaluate(t => __au.starts.filter(s => s.freq === 1000 && s.t > t + 0.2).length, tSon);
    ok('preview replaced: heart stops when sonar is picked', heartAfter === 0, heartAfter);
    ok('preview replaced: sonar pings', await page.evaluate(() => __au.starts.filter(s => s.freq === 1400).length) >= 1);
    ok('preview replaced: one timer', await live(page) === 1);
    await sleep(3300);
    ok('preview stops itself after about 3 s', await live(page) === 0);
    const nEnd = await nStarts(page); await sleep(1500);
    ok('preview over: no further voices', await nStarts(page) === nEnd);
    // heart preview length: about 3 s of beats
    const t0 = await page.click('#tone-heart').then(() => now(page));
    await sleep(3500);
    const hb = (await starts(page, 900, 1100)).filter(t => t > t0);
    ok('heart preview: about 3 s of beats (3-5 beeps)', hb.length >= 3 && hb.length <= 5 && hb[hb.length - 1] - t0 < 3.1, hb.map(t => (t - t0).toFixed(2)));
    // Preview button, volume cycling, leaving
    await page.click('#tone-preview');
    await sleep(700);
    const lv = await live(page);
    await page.click('#tone-back');
    const tb = await now(page);
    await sleep(300);
    ok('Back stops the preview: timer cleared', lv === 1 && await live(page) === 0);
    ok('Back stops the preview: nothing audible scheduled', await audibleAfter(page, tb) === 0);
    ok('Back returns to Settings', await page.locator('#design-classic').count() === 1);
    await page.click('#set-tone');
    ok('volume row shows Medium', (await page.textContent('#tone-volume')).includes('Medium'));
    await page.click('#tone-volume'); ok('volume cycles to High', (await page.textContent('#tone-volume')).includes('High'));
    ok('volume High previews at the high cap', await page.evaluate(() => Math.abs(__au.masterNode().gain.valueAt(__au.ctxs[0].currentTime + 0.5) - 0.22) < 1e-6));
    await page.click('#tone-volume'); ok('volume cycles to Low', (await page.textContent('#tone-volume')).includes('Low'));
    await page.click('#tone-volume'); ok('volume cycles back to Medium', (await page.textContent('#tone-volume')).includes('Medium'));
    // unmount via App navigation (Settings home's own Back is not on this screen): reload keeps the choice
    await page.click('#tone-sonar');
    await page.reload(); await page.waitForSelector('#new');
    ok('choice persists across reload', await page.evaluate(() => JSON.parse(localStorage.getItem('settings')).tone.choice) === 'sonar');
    await page.click('#settings');
    ok('Settings shows the saved choice', (await page.textContent('#set-tone')).includes('Sonar'));
    await page.click('#set-tone');
    ok('saved choice is selected on the tone screen', (await page.getAttribute('#tone-sonar', 'aria-checked')) === 'true');
    ok('preview: no errors', errors.length === 0, errors.join('|'));
  }
  // 10. broken audio: the app stays usable
  for (const [name, au] of [['no AudioContext', { noAC: true }], ['constructor throws', { throwCtor: true }], ['createOscillator throws', { throwOsc: true }], ['resume throws', { resumeThrows: true }]]) {
    const { page, errors } = await open({ tone: HEART, au });
    await runLoud(page);
    await page.locator('.stack button').nth(0).click(); await page.locator('.stack button').nth(1).click();
    await sleep(400);
    if (await page.locator('#mute').count()) { await page.click('#mute'); await page.click('#mute'); }
    await page.locator('.bar button').first().click();
    await page.click('#settings'); await page.click('#set-tone');
    for (const c of ['cabin', 'alarm', 'tick']) await page.click('#tone-' + c);
    await page.click('#tone-preview'); await page.click('#tone-volume');
    await page.click('#tone-back'); await page.click('#settings-back');
    // editor toggle still works
    await page.click('#new'); await page.keyboard.type('X'); await page.keyboard.press('Enter');
    await page.click('#fb-sound');
    ok(name + ': app works, toggle flips', (await page.textContent('#fb-sound')).includes('on') && errors.length === 0, errors.join('|'));
  }
  // 11. compressor missing: still plays
  {
    const { page, errors } = await open({ tone: HEART, au: { noCompressor: true } });
    await runLoud(page); await sleep(1500);
    ok('no DynamicsCompressor: still beats', (await starts(page, 900, 1100)).length >= 1 && errors.length === 0);
  }
  // 12. editor toggle keeps working (one tick as a preview, at the saved volume)
  {
    const { page, errors } = await open({ tone: { choice: 'cabin', volume: 'low' } });
    await page.click('#new'); await page.keyboard.type('Pre'); await page.keyboard.press('Enter');
    await page.click('#fb-sound');
    ok('editor toggle on: shows on, plays exactly one tick', (await page.textContent('#fb-sound')).includes('on') && await nStarts(page) === 1);
    ok('editor toggle: tick at the low cap even when the chosen sound is cabin', await page.evaluate(() => Math.abs(__au.masterNode().gain.valueAt(__au.ctxs[0].currentTime + 0.5) - 0.06) < 1e-6));
    await page.click('#fb-sound');
    ok('editor toggle off: silent, shows off', (await page.textContent('#fb-sound')).includes('off') && await nStarts(page) === 1);
    ok('editor: no errors', errors.length === 0);
  }
  // 13. ToneControls only for continuous choices
  for (const [choice, expect] of [['tick', 0], ['heart', 1], ['cabin', 1], ['sonar', 1], ['metronome', 1], ['alarm', 1]]) {
    const { page } = await open({ tone: { choice, volume: 'low' } });
    await runLoud(page);
    ok('mute button for ' + choice + ': ' + expect, await page.locator('.bar #mute').count() === expect);
  }
  process.exit(L.report() ? 1 : 0);
})().catch(e => { console.log('FAIL crashed', e); process.exit(1); });
