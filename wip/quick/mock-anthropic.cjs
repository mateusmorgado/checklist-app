// Mock of the Anthropic Messages API for the Quick list tests.
// start() -> { port, url, log, reset(), setMode(name), setInput(obj, extra), close() }
// log: every request the server saw ({ method, url, headers, body (raw string), json (parsed or null) }).
// Modes answer POST /v1/messages; every response carries CORS headers and OPTIONS is answered as a preflight.
const http = require('http');

const OK_INPUT = {
  title: 'Weekend trip',
  items: [
    { text: 'Passport', detail: 'Check the expiry date', required: true },
    { text: 'Charger' },
    { text: 'Shirts', qty: 'nights' },
    { text: 'Socks', qty: 'nights + 1' },
  ],
  questions: [{ type: 'number', text: 'nights' }],
};
const Q_INPUT = {
  title: 'Gym bag',
  items: [{ text: 'Shoes' }, { text: 'Water bottle', required: true }],
  questions: [
    { type: 'yesno', text: 'I go to the sauna', items: [{ text: 'Towel', detail: 'For the sauna' }, { text: 'Flip-flops' }] },
    { type: 'number', text: 'days', items: ['Clean shirt'] },
  ],
};
const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const PRESETS = {
  success: OK_INPUT,
  questions: Q_INPUT,
  tooMany: { title: 'Big', items: many(100, i => ({ text: 'Item ' + i })), questions: many(30, i => ({ type: 'number', text: 'thing' + i + 'x', items: ['Linked ' + i] })) },
  hugeStrings: { title: 'T'.repeat(5000), items: [{ text: 'x'.repeat(5000), detail: 'd'.repeat(5000) }, { text: 'Fine', detail: 'y'.repeat(5000), qty: '1'.repeat(5000) }] },
  htmlish: { title: '<img src=x onerror=alert(1)>Trip', items: [{ text: '<script>window.__pwned=1</script>Keys', detail: '<b>bold</b> &amp; "quotes"' }, { text: 'javascript:alert(1)' }] },
  controlChars: { title: 'Tr\u0000ip\u200B\u200D\u202E rtl\u2066', items: [{ text: 'Pass\u0000port\u0007  \t\n  now', detail: 'a\u200Bb\uFEFFc\u0085d' }, { text: 'Hid\u{E0041}\u{E0042}den' }, { text: '\u200B\u200C\u0001' }] },
  badFormulas: {
    title: 'Formulas',
    items: [
      { text: 'Good', qty: 'nights + 1' }, { text: 'Unknown name', qty: 'foo + 1' }, { text: 'Div zero', qty: '1/0' }, { text: 'Syntax', qty: '2 +' },
      { text: 'Call', qty: 'alert(1)' }, { text: 'Max ok', qty: 'max(nights, 2)' }, { text: 'Words', qty: 'two nights' }, { text: 'Number', qty: 3 }, { text: 'Object qty', qty: { a: 1 } },
      { text: 'Proto', qty: 'constructor' }, { text: 'Plain' },
    ],
    questions: [{ type: 'number', text: 'nights' }],
  },
  dupQuestions: {
    title: 'Dups',
    items: [{ text: 'A', qty: 'sauna + sauna2 + q2' }, { text: 'A' }, { text: 'a' }],
    questions: [
      { type: 'yesno', text: 'I go to the sauna', items: ['S1'] }, { type: 'yesno', text: 'I go to the sauna?', items: ['S1 again', 'S2'] },
      { type: 'yesno', text: 'We use the sauna', items: ['S3'] }, { type: 'number', text: 'ceil', items: ['C'] }, { type: 'number', text: '   ' },
      { type: 'number', text: 'How many 2', items: ['Two'] },
      { type: 'yesno', text: 'Unused question', items: [] }, { type: 'maybe', text: 'wrong type', items: ['Z'] },
    ],
  },
  emptyStrings: { title: '   ', items: [{ text: '' }, { text: '   ' }, { text: '\u200B' }], questions: [] },
  emptyItems: { title: 'Has a title', items: [{ text: '' }, 5, null, {}] },
  nested: { title: { a: 1 }, items: [[1, 2], { text: { deep: ['x'] } }, 'Plain string item', { text: 'Ok', detail: ['x'], required: 'yes' }], questions: 'none' },
  wrongTypes: { title: 42, items: 'not an array', questions: { a: 1 } },
  notObject: 'just a string',
  quotes: { title: '  Camp   out  ', items: [{ text: 'Tent' }, { text: 'Tent' }, { text: 'Sleeping bag', required: true }, { text: 'Lighter', required: 'true' }] },
  unicode: { title: 'Reise \u{1F9F3}', items: [{ text: '\u05D3\u05E8\u05DB\u05D5\u05DF' }, { text: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467} family' }, { text: '\uD800 lone' }, { text: 'also \uDC00' }] },
};

function toolUse(input, extra) {
  return { id: 'msg_test', type: 'message', role: 'assistant', model: 'mock', stop_reason: 'tool_use', stop_sequence: null,
    content: [{ type: 'tool_use', id: 'toolu_1', name: 'create_checklist', input }], usage: { input_tokens: 10, output_tokens: 10 }, ...extra };
}
const errBody = (type, message) => ({ type: 'error', error: { type, message }, request_id: 'req_x' });

function start(opts = {}) {
  const log = [];
  let mode = 'success';
  let custom = null;
  const timers = new Set();
  const server = http.createServer((req, res) => {
    const cors = mode === 'nocors' ? {} : {
      'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': req.headers['access-control-request-headers'] || '*',
      'access-control-expose-headers': 'retry-after, request-id', 'access-control-max-age': '0',
    };
    if (req.method === 'OPTIONS') {
      log.push({ method: 'OPTIONS', url: req.url, headers: req.headers });
      res.writeHead(204, cors); res.end(); return;
    }
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      let json = null;
      try { json = JSON.parse(raw); } catch (e) {}
      const entry = { method: req.method, url: req.url, headers: req.headers, body: raw, json };
      log.push(entry);
      res.on('close', () => { entry.aborted = !res.writableFinished; });
      const send = (status, obj, headers = {}, text) => {
        res.writeHead(status, { 'content-type': text !== undefined ? 'text/html' : 'application/json', ...cors, ...headers });
        res.end(text !== undefined ? text : JSON.stringify(obj));
      };
      if (req.url.split('?')[0] !== '/v1/messages' || req.method !== 'POST') return send(404, errBody('not_found_error', 'Not found'));
      if (custom) return send(200, custom);
      switch (mode) {
        case 'nocors': return send(200, toolUse(OK_INPUT));
        case 'redirect': return send(307, null, { location: '/v1/messages?followed=1' }, '');
        case '401': return send(401, errBody('authentication_error', 'invalid x-api-key'));
        case '403': return send(403, errBody('permission_error', 'Not allowed'));
        case '404': return send(404, errBody('not_found_error', 'model: nope'));
        case '429': return send(429, errBody('rate_limit_error', 'Rate limit'), { 'retry-after': '17' });
        case '429none': return send(429, errBody('rate_limit_error', 'Rate limit'));
        case '500': return send(500, errBody('api_error', 'Internal error'));
        case '502html': return send(502, null, {}, '<html><body>Bad gateway</body></html>');
        case '529': return send(529, errBody('overloaded_error', 'Overloaded'));
        case '400': return send(400, errBody('invalid_request_error', 'messages: something is wrong'));
        case '400key': return send(400, errBody('invalid_request_error', 'bad request for key ' + (req.headers['x-api-key'] || '')));
        case 'toolchoice': return send(400, errBody('invalid_request_error', 'tool_choice: type "tool" and "any" are not supported for this model.'));
        case 'errorbody': return send(200, errBody('overloaded_error', 'Overloaded'));
        case 'malformed': return send(200, null, {}, '{"type":"message", "content": [');
        case 'html': return send(200, null, {}, '<!doctype html><title>proxy</title>');
        case 'notool': return send(200, { id: 'm', type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Here is a list: ...' }] });
        case 'maxtokens': return send(200, toolUse({ title: 'Cut off', items: [{ text: 'A' }] }, { stop_reason: 'max_tokens' }));
        case 'refusal': return send(200, { id: 'm', type: 'message', role: 'assistant', stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'general_harms' }, content: [] });
        case 'slow': {
          const t = setTimeout(() => { timers.delete(t); try { send(200, toolUse(OK_INPUT)); } catch (e) {} }, opts.slowMs || 60000);
          timers.add(t);
          req.on('close', () => { clearTimeout(t); timers.delete(t); });
          return undefined;
        }
        case 'delay': {
          const t = setTimeout(() => { timers.delete(t); send(200, toolUse(OK_INPUT)); }, opts.delayMs || 800);
          timers.add(t);
          return undefined;
        }
        case 'reflectkey': return send(200, toolUse({ title: 'Key ' + (req.headers['x-api-key'] || ''), items: [{ text: 'Echo ' + (req.headers['x-api-key'] || '') }] }));
        default:
          if (PRESETS[mode] !== undefined) return send(200, toolUse(PRESETS[mode]));
          return send(500, errBody('api_error', 'unknown mock mode ' + mode));
      }
    });
  });
  return new Promise(resolve => {
    server.listen(opts.port || 0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        port, url: 'http://127.0.0.1:' + port, log, PRESETS,
        reset() { log.length = 0; custom = null; mode = 'success'; },
        setMode(m) { mode = m; custom = null; },
        setInput(input, extra) { custom = toolUse(input, extra); },
        setRaw(body) { custom = body; },
        posts() { return log.filter(r => r.method === 'POST'); },
        close() { timers.forEach(clearTimeout); server.closeAllConnections && server.closeAllConnections(); return new Promise(r => server.close(r)); },
      });
    });
  });
}
module.exports = { start, PRESETS, toolUse };
if (require.main === module) start({ port: Number(process.argv[2]) || 8787 }).then(m => console.log('mock on', m.url));
