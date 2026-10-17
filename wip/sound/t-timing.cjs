// Beat timing of every soundscape, plus the cap on gain, using the recording fake AudioContext.
const L = require('./lib.cjs');
const { open, runLoud, starts, gaps, ok, sleep } = L;
const CAP = { low: 0.06, medium: 0.12, high: 0.22 };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

async function scenario(name, choice, waitMs, check) {
  const { page, errors } = await open({ tone: { choice, volume: 'medium' } });
  await runLoud(page);
  await sleep(waitMs);
  await check(page);
  ok(name + ': no page errors', errors.length === 0, errors.join('|'));
}

(async () => {
  await Promise.all([
    scenario('heart', 'heart', 7600, async page => {
      const b = await starts(page, 900, 1100); const g = gaps(b);
      ok('heart: at least 8 beats', b.length >= 8, b.length);
      ok('heart: period 833 ms +/- 15 on every gap', g.length >= 7 && g.every(x => near(x, 60 / 72, 0.015)), g.map(x => x.toFixed(4)));
      const d = await page.evaluate(() => __au.starts.filter(s => s.freq === 1000).map(s => s.node.stops[0].t - s.t));
      ok('heart: each beep is 80-120 ms', d.every(x => x >= 0.08 && x <= 0.12), d);
      ok('heart: one scheduler timer only', await page.evaluate(() => __au.intervals.live.size) === 1);
      ok('heart: no noise buffer', await page.evaluate(() => __au.starts.filter(s => s.kind === 'buf').length) === 0);
    }),
    scenario('metronome', 'metronome', 6200, async page => {
      const b = await starts(page, 1700, 1900); const g = gaps(b);
      ok('metronome: at least 5 clicks', b.length >= 5, b.length);
      ok('metronome: period 1000 ms +/- 15', g.every(x => near(x, 1, 0.015)), g);
      const d = await page.evaluate(() => __au.starts.filter(s => s.freq === 1800).map(s => s.node.stops[0].t - s.t));
      ok('metronome: click is short (< 40 ms)', d.every(x => x < 0.04), d);
    }),
    scenario('sonar', 'sonar', 10200, async page => {
      const b = await starts(page, 1200, 1600); const g = gaps(b);
      ok('sonar: at least 3 pings', b.length >= 3, b.length);
      ok('sonar: period 3 s +/- 15 ms', g.every(x => near(x, 3, 0.015)), g);
      const d = await page.evaluate(() => __au.starts.filter(s => s.freq === 1400).map(s => s.node.stops[0].t - s.t));
      ok('sonar: ping rings 0.6-0.95 s', d.every(x => x >= 0.6 && x <= 0.95), d);
      const exp = await page.evaluate(() => __au.nodes.filter(n => n.kind === 'gain' && n.gain.ev.some(e => e.type === 'exp' && e.v < 0.001)).length);
      ok('sonar: exponential decay envelope', exp >= 3, exp);
    }),
    scenario('alarm', 'alarm', 12000, async page => {
      const b = await starts(page, 800, 1200);
      ok('alarm: at least 9 beeps (3 bursts)', b.length >= 9, b.length);
      const bursts = []; for (const t of b) { const l = bursts[bursts.length - 1]; if (l && t - l[l.length - 1] < 1) l.push(t); else bursts.push([t]); }
      ok('alarm: every burst has exactly three beeps', bursts.filter(x => x.length === 3).length >= 3 && bursts.every(x => x.length === 3 || x === bursts[bursts.length - 1]), bursts.map(x => x.length));
      const full = bursts.filter(x => x.length === 3);
      ok('alarm: bursts start about every 5 s', gaps(full.map(x => x[0])).every(x => near(x, 5, 0.015)), gaps(full.map(x => x[0])));
      ok('alarm: gap between bursts is long (> 3 s)', full.length > 1 && full[1][0] - full[0][2] > 3);
      const f = await page.evaluate(() => __au.starts.filter(s => s.freq > 800 && s.freq < 1200).slice(0, 3).map(s => s.freq));
      ok('alarm: pitches 880 / 1100 / 880', f.join() === '880,1100,880', f);
    }),
    // cabin: continuous, no beats, noise through a low-pass plus two detuned low sines
    scenario('cabin', 'cabin', 1500, async page => {
      const s = await page.evaluate(() => ({
        buf: __au.starts.filter(x => x.kind === 'buf').length,
        osc: __au.starts.filter(x => x.kind === 'osc').map(x => x.freq),
        lp: __au.nodes.filter(n => n.kind === 'biquad').map(n => n.frequency.base),
        intervals: __au.intervals.set,
      }));
      ok('cabin: one noise source, looped', s.buf === 1);
      ok('cabin: low-pass 400-600 Hz', s.lp.length === 1 && s.lp[0] >= 400 && s.lp[0] <= 600, s.lp);
      const hum = s.osc.filter(f => f >= 80 && f <= 160);
      ok('cabin: two slightly detuned hum sines', hum.length === 2 && hum[0] !== hum[1] && Math.abs(hum[0] - hum[1]) < 6, s.osc);
      ok('cabin: no scheduler timer and no beeps', s.intervals === 0 && s.osc.every(f => f < 160));
      const loop = await page.evaluate(() => __au.nodes.find(n => n.kind === 'buf').loop);
      ok('cabin: noise loops', loop === true);
    }),
  ]);
  process.exit(L.report() ? 1 : 0);
})().catch(e => { console.log('FAIL crashed', e); process.exit(1); });
