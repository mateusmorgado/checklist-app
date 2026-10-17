const S = '/tmp/claude-0/-home-user-checklist-app/a8f6f7de-7937-5a3a-b611-cc4480139558/scratchpad';
const { openApp, closeAll } = require(S + '/harness.cjs');
const FILE = process.env.APP_FILE || S + '/work/quick/index.html';
let fails = 0, passes = 0;
function check(name, cond, extra) {
  if (cond) { passes++; console.log('ok   ' + name); }
  else { fails++; console.log('FAIL ' + name + (extra !== undefined ? '  -> ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); }
}
function done() { console.log(`PASSES: ${passes}  FAILS: ${fails}`); return fails; }
module.exports = { S, FILE, openApp, closeAll, check, done };
const mock = require('./mock-anthropic.cjs');
// Opens the app on 360x560 with Quick list pointed at the mock.
async function mkApp(m, o = {}) {
  const ai = { key: 'test-key', model: 'claude-haiku-5-5', endpoint: m.url, ...(o.ai || {}) };
  const errors = [];
  const r = await openApp(FILE, { width: 360, height: 560, ...o, errors: e => errors.push(e), settings: { ...(o.settings || {}), ai } });
  r.errors = errors;
  r.requests = [];
  r.page.on('request', q => { const u = q.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && !/cdnjs|fonts\.g/.test(u)) r.requests.push({ url: u, method: q.method(), headers: q.headers() }); });
  return r;
}
const lists = page => page.evaluate(() => JSON.parse(localStorage.getItem('checklists') || '[]'));
const text = page => page.evaluate(() => document.body.innerText);
const html = page => page.evaluate(() => document.documentElement.outerHTML);
module.exports = { ...module.exports, mock, mkApp, lists, text, html };
