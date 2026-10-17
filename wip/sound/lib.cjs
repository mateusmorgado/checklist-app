const fs = require('fs');
const path = require('path');
const { openApp, closeAll } = require('../../harness.cjs');
const FILE = process.env.APP || path.join(__dirname, 'index.html');
const FAKE = fs.readFileSync(path.join(__dirname, 'fake.js'), 'utf8');
const list = (id, title, n, sound) => ({ id, title, sound, voice: false, questions: [], items: Array.from({ length: n }, (_, i) => ({ text: 'Item ' + (i + 1) })) });
let fails = 0, passes = 0;
const ok = (name, cond, extra = '') => { if (cond) passes++; else fails++; console.log(cond ? 'PASS' : 'FAIL', name, cond ? '' : String(extra)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Opens the app with the fake audio. o.tone = {choice, volume}; o.sound = checklist sound flag; o.au = fake options.
async function open(o = {}) {
  const errors = [];
  const app = await openApp(FILE, {
    width: o.width || 390, height: o.height || 780, reducedMotion: 'no-preference', errors: e => errors.push(e),
    settings: { design: o.design || 'classic', tone: o.tone || { choice: 'tick', volume: 'medium' } },
    storage: { checklists: [list('L', 'Loud', o.items || 12, o.sound !== false), list('Q', 'Quiet', 3, false)] },
    seedOnce: !!o.seedOnce,
    init: arg => { window.__auOpts = arg.opts; (0, eval)(arg.src); },
    initArg: { opts: { hold: !!process.env.AUHOLD, ...(o.au || {}) }, src: FAKE },
  });
  app.errors = errors;
  return app;
}
const runLoud = async page => { await page.locator('.home-item', { hasText: 'Loud' }).locator('.open').click(); };
const runQuiet = async page => { await page.locator('.home-item', { hasText: 'Quiet' }).locator('.open').click(); };
// beats = audio-clock start times of oscillators matching a predicate
const starts = (page, minFreq = 0, maxFreq = 1e9) => page.evaluate(([a, b]) => __au.starts.filter(s => s.kind === 'osc' && s.freq >= a && s.freq <= b).map(s => s.t), [minFreq, maxFreq]);
const now = page => page.evaluate(() => __au.ctxs[0] ? __au.ctxs[0].currentTime : -1);
const gaps = a => a.slice(1).map((x, i) => x - a[i]);
module.exports = { open, runLoud, runQuiet, starts, now, gaps, ok, sleep, closeAll, report: () => { console.log(`\n${passes} passed, ${fails} failed`); return fails; }, FILE, openApp, list };
