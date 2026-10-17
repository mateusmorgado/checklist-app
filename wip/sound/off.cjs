const { openApp, closeAll } = require('../../harness.cjs');
(async () => {
  const { page } = await openApp(__dirname + '/index.html', {});
  const res = await page.evaluate(async () => {
    const out = {};
    const stat = d => { let pk = 0, s = 0; for (const v of d) { pk = Math.max(pk, Math.abs(v)); s += v * v; } return { pk, rms: Math.sqrt(s / d.length) }; };
    for (const vol of ['low', 'medium', 'high']) for (const ch of ['heart', 'cabin', 'sonar', 'metronome', 'alarm']) {
      const rate = 44100, oc = new OfflineAudioContext(1, rate * 4, rate);
      toneRender(oc, ch, vol, 4);
      const buf = await oc.startRendering(); const d = buf.getChannelData(0);
      const s = stat(d), n = Math.round(rate * 0.005);
      const head = stat(d.slice(0, n)).pk, tail = stat(d.slice(d.length - n)).pk;
      let maxStep = 0; for (let i = 1; i < d.length; i++) maxStep = Math.max(maxStep, Math.abs(d[i] - d[i - 1]));
      out[vol + '/' + ch] = { pk: +s.pk.toFixed(4), rms: +s.rms.toFixed(4), head: +head.toExponential(2), tail: +tail.toExponential(2), maxStep: +maxStep.toFixed(4) };
    }
    return out;
  });
  for (const [k, v] of Object.entries(res)) console.log(k, JSON.stringify(v));
  await closeAll();
})();
