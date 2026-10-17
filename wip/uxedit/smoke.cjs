const L = require('./lib.cjs');
(async () => {
  const { page: p } = await L.open();
  await L.edit(p, 'Five');
  await p.screenshot({ path: L.DIR + 'smoke-points.png' });
  console.log(await L.order(p));
  await p.locator('.row', { hasText: 'Point 3' }).locator('.x').click();
  await p.screenshot({ path: L.DIR + 'smoke-toast.png' });
  console.log(await L.order(p), await p.textContent('.toast'));
  await p.click('#undo');
  console.log(await L.order(p), await p.textContent('.toast'));
  await p.locator('.row', { hasText: 'Point 2' }).click();
  await p.screenshot({ path: L.DIR + 'smoke-item.png' });
  await p.click('#move-up');
  console.log(await p.textContent('#move-status'));
  await L.summary();
})();
