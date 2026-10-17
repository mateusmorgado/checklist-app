const L = require('./lib.cjs');
(async () => {
  const qs = Array.from({ length: 12 }, (_, i) => ({ id: 'q' + i, name: 'n' + i, type: 'yesno', text: 'topic' + i, label: 'topic' + i + '?' }));
  for (const [W, base] of [[320, 'base'], [360, 'x']]) {
    const { page: p } = await L.open({ width: W, height: 568, lists: [{ id: 'a', title: 'A', questions: qs, items: [{ text: 'x' }] }] });
    await L.edit(p, 'A');
    console.log(W, await p.evaluate(() => [...document.querySelectorAll('.actions button')].map(b => { const r = b.getBoundingClientRect(); return b.textContent + ':' + Math.round(r.left) + '-' + Math.round(r.right); })));
  }
  await L.summary();
})();
