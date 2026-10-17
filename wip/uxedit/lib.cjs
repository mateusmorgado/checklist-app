// Shared helpers for the uxedit tests.
const { openApp, closeAll } = require('/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/harness.cjs');
const FILE = '/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/work/uxedit/index.html';
const DIR = '/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad/work/uxedit/';
let fails = 0, passes = 0;
const ok = (name, cond, extra) => { if (cond) { passes++; console.log('ok   ' + name); } else { fails++; console.log('FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); } };
const list = (n, title = 'Many', prefix = 'Point ') => ({ id: 'L' + n, title, items: Array.from({ length: n }, (_, i) => ({ text: prefix + (i + 1) })) });
// Visible order of rows, first item (bottom) first.
const order = p => p.evaluate(() => [...document.querySelectorAll('.stack .row')].sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top).map(e => e.querySelector('.label > span').textContent));
// Order as stored by the editor (CSS order), independent of scrolling.
const cssOrder = p => p.evaluate(() => [...document.querySelectorAll('.stack .row')].sort((a, b) => +a.style.order - +b.style.order).map(e => e.querySelector('.label > span').textContent));
const open = async (o = {}) => {
  const lists = o.lists || [list(5, 'Five')];
  const r = await openApp(FILE, { width: 390, height: 780, reducedMotion: 'reduce', ...o, storage: { checklists: lists, ...(o.storage || {}) } });
  r.page.on('pageerror', e => { fails++; console.log('FAIL pageerror ' + e.message); });
  return r;
};
const edit = async (p, title) => { await p.locator('.stack > div', { hasText: title }).locator('text=edit').click(); await p.waitForSelector('#draft'); };
// 'text=Back' would also hit hint text that mentions Back, so click the button only.
const back = p => p.locator('.screen > .actions button', { hasText: /^Back$/ }).click();
const noPageScroll = p => p.evaluate(() => document.documentElement.scrollHeight === innerHeight && document.documentElement.scrollWidth === innerWidth && document.body.scrollHeight <= innerHeight);
const summary = async () => { console.log('PASSED', passes, 'FAILED', fails); await closeAll(); process.exit(fails ? 1 : 0); };
module.exports = { openApp, closeAll, FILE, DIR, ok, list, order, cssOrder, open, edit, back, noPageScroll, summary, get fails() { return fails; } };
