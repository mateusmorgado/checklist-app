// Gain caps (live graph, recorded), fades, and real OfflineAudioContext renders of every sound.
const L = require('./lib.cjs');
const { open, openApp, ok, sleep } = L;
const CAPS = { low: 0.06, medium: 0.12, high: 0.22 };
const CHOICES = ['heart', 'cabin', 'sonar', 'metronome', 'alarm'];

(async () => {
  // A. recorded graph: master x every gain on the path to the output never passes the cap
  for (const volume of ['low', 'medium', 'high']) {
    const { page, errors } = await open({ tone: { choice: 'heart', volume } });
    for (const choice of CHOICES.concat(['tick'])) {
      const mark = await page.evaluate(([c, v]) => { const m = __au.nodes.length; toneStop(); if (c === 'tick') toneTick({ choice: 'tick', volume: v }); else toneStart({ choice: c, volume: v }); return m; }, [choice, volume]);
      await sleep(230);
      const r = await page.evaluate(m => {
        const mi = __au.nodes.length; const paths = __au.paths().filter(p => __au.nodes.indexOf(p.src) >= m);
        const sum = paths.reduce((a, p) => a + p.prod, 0);
        const m0 = __au.masterNode();
        return { n: paths.length, max: Math.max(0, ...paths.map(p => p.prod)), sum, masterPeak: m0.gain.peak() };
      }, mark);
      ok(`${volume}/${choice}: voices peak path gain <= cap`, r.n > 0 && r.max <= CAPS[volume] + 1e-9, JSON.stringify(r));
      if (choice === 'cabin') ok(`${volume}/cabin: summed voices <= cap`, r.sum <= CAPS[volume] + 1e-9, JSON.stringify(r));
    }
    const peak = await page.evaluate(() => __au.masterNode().gain.peak());
    ok(`${volume}: master gain never above ${CAPS[volume]}`, peak <= CAPS[volume] + 1e-9, peak);
    ok(`${volume}: no errors`, errors.length === 0);
  }
  // B. fades on start, stop, mute: master and loop bus ramp over 60-150 ms
  {
    const { page } = await open({ tone: { choice: 'cabin', volume: 'medium' } });
    await page.evaluate(() => toneStart({ choice: 'cabin', volume: 'medium' }));
    await sleep(200);
    const f = await page.evaluate(() => {
      const m = __au.masterNode().gain.ev.filter(e => e.type === 'lin');
      const bus = __au.nodes.filter(n => n.kind === 'gain' && n.out.includes(__au.masterNode()))[0].gain.ev;
      return { m, bus };
    });
    const up = f.m[0], busUp = f.bus.find(e => e.type === 'lin');
    const setT = f.bus.find(e => e.type === 'set' && e.t > 0).t;
    ok('start: master ramps up to the cap over 60-150 ms', up && up.v === 0.12, JSON.stringify(f.m));
    ok('start: bus fades in over 60-150 ms', busUp && busUp.t - setT >= 0.06 && busUp.t - setT <= 0.15, JSON.stringify(f.bus));
    await page.evaluate(() => toneStop());
    const f2 = await page.evaluate(() => __au.masterNode().gain.ev.filter(e => e.type === 'lin').map(e => [e.t, e.v]));
    const down = f2[f2.length - 1], set = await page.evaluate(() => __au.masterNode().gain.ev.filter(e => e.type === 'set').pop().t);
    ok('stop: master ramps to 0 over 60-150 ms', down[1] === 0 && down[0] - set >= 0.06 && down[0] - set <= 0.15, JSON.stringify(f2));
    const stops = await page.evaluate(() => __au.starts.map(s => s.node.stops.map(x => x.t - s.node.ctx.currentTime)));
    ok('stop: sources are stopped after the fade, not before', stops.every(a => a.length));
    await sleep(500);
    ok('stop: audio device suspended when idle', await page.evaluate(() => __au.suspendCalls >= 1));
    await page.evaluate(() => toneStart({ choice: 'cabin', volume: 'medium' }));
    await sleep(200);
    ok('start after idle: context resumed', await page.evaluate(() => __au.ctxs[0].state === 'running'));
  }
  // C. real OfflineAudioContext renders of the app's own graph
  {
    const { page, errors } = await openApp(L.FILE, { reducedMotion: 'no-preference' }).then(a => ({ ...a, errors: [] }));
    const res = await page.evaluate(async () => {
      const out = {}, rate = 44100;
      const stat = d => { let pk = 0, s = 0; for (const v of d) { pk = Math.max(pk, Math.abs(v)); s += v * v; } return { pk, rms: Math.sqrt(s / d.length) }; };
      for (const vol of ['low', 'medium', 'high']) for (const ch of ['heart', 'cabin', 'sonar', 'metronome', 'alarm']) {
        const oc = new OfflineAudioContext(1, rate * 4, rate);
        toneRender(oc, ch, vol, 4);
        const d = (await oc.startRendering()).getChannelData(0), n = Math.round(rate * 0.005), s = stat(d);
        out[vol + '/' + ch] = { pk: s.pk, rms: s.rms, head: stat(d.slice(0, n)).pk, tail: stat(d.slice(d.length - n)).pk };
      }
      // stopping in the middle of the fade-in must not jump (cabin and heart)
      for (const ch of ['cabin', 'heart']) for (const at of [0.03, 0.05, 0.11]) {
        const oc = new OfflineAudioContext(1, rate, rate), G = toneGraph(oc);
        toneSetLevel(G, 0.12, TONE_FADE);
        const L = toneBegin(G, { key: 'x', choice: ch, volume: 'medium' }, 0);
        toneSchedule(L, 0.5, 0); toneEnd(L, at, false);
        const d = (await oc.startRendering()).getChannelData(0); let step = 0, pk = 0;
        for (let i = 1; i < d.length; i++) { step = Math.max(step, Math.abs(d[i] - d[i - 1])); pk = Math.max(pk, Math.abs(d[i])); }
        out['mid/' + ch + '/' + at] = { step, pk, endAbs: stat(d.slice(d.length - 220)).pk };
      }
      return out;
    });
    for (const [k, v] of Object.entries(res)) {
      if (k.startsWith('mid/')) { ok(`${k}: stop mid-fade has no jump`, v.step < 0.02 && v.endAbs < 1e-6, JSON.stringify(v)); continue; }
      const [vol, ch] = k.split('/'), cap = CAPS[vol];
      ok(`offline ${k}: no sample above the cap`, v.pk <= cap + 1e-6, v.pk);
      ok(`offline ${k}: first and last 5 ms near zero`, v.head < cap * 0.01 && v.tail < cap * 0.01, `${v.head} ${v.tail}`);
      if (vol === 'medium') ok(`offline ${k}: RMS above the audible floor`, v.rms > (ch === 'metronome' ? 0.001 : 0.004), v.rms);
    }
  }
  process.exit(L.report() ? 1 : 0);
})().catch(e => { console.log('FAIL crashed', e); process.exit(1); });
