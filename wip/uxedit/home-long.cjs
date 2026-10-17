const L = require('./lib.cjs');
(async () => {
  const { page: p } = await L.open({ lists: [L.list(2, 'Two'), { id: 'x', title: 'T'.repeat(60), items: [{ text: 'a' }] }, { id: 'y', title: 'T'.repeat(70), items: [{ text: 'a' }] }] });
  await p.screenshot({ path: L.DIR + 'home-long.png' });
  console.log(await p.evaluate(() => [...document.querySelectorAll('.home-item')].map(e => JSON.stringify(e.getBoundingClientRect()))));
  await L.summary();
})();
