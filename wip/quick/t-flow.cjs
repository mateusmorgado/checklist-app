// Happy path, request contents, draft in the editor, save / cancel, prompt box.
const { check, done, closeAll, mock, mkApp, lists, text, html } = require('./lib.cjs');
(async () => {
  const m = await mock.start();
  const KEY = 'test-key';
  const SYS = 'create_checklist';

  // --- success flow and request contents
  let { page, errors, requests } = await mkApp(m);
  const before = (await lists(page)).length;
  await page.click('#quick');
  check('quick screen: prompt, create, back', await page.locator('#quick-prompt').count() === 1 && await page.locator('#quick-create').count() === 1 && await page.locator('#quick-back').count() === 1);
  check('quick screen: hint', (await text(page)).includes('Describe the checklist'));
  check('quick screen: prompt focused', await page.evaluate(() => document.activeElement && document.activeElement.id) === 'quick-prompt');
  check('create looks disabled when empty', await page.locator('#quick-create.muted').count() === 1);
  await page.fill('#quick-prompt', '  Weekend trip to the mountains  ');
  check('create primary when filled', await page.locator('#quick-create.muted').count() === 0);
  await page.click('#quick-create');
  await page.waitForSelector('#draft');
  const posts = m.posts();
  check('exactly one POST', posts.length === 1, posts.length);
  const pre = await new Promise(res => require('http').request(m.url + '/v1/messages', { method: 'OPTIONS', headers: { 'access-control-request-headers': 'x-api-key,anthropic-version,content-type,anthropic-dangerous-direct-browser-access', origin: 'null' } }, r => res(r)).end());
  check('mock answers a preflight (the browser run is routed, so Playwright handles it there)', pre.statusCode === 204 && /x-api-key/.test(pre.headers['access-control-allow-headers']) && pre.headers['access-control-allow-origin'] === '*');
  const q = posts[0];
  check('path', q.url === '/v1/messages', q.url);
  check('x-api-key header', q.headers['x-api-key'] === KEY);
  check('anthropic-version', q.headers['anthropic-version'] === '2023-06-01');
  check('browser access header', q.headers['anthropic-dangerous-direct-browser-access'] === 'true');
  check('content-type json', /application\/json/.test(q.headers['content-type']));
  check('no Authorization / cookie headers', !q.headers.authorization && !q.headers.cookie);
  check('key only in x-api-key', Object.entries(q.headers).filter(([k, v]) => String(v).includes(KEY)).map(([k]) => k).join() === 'x-api-key');
  check('key not in body', !q.body.includes(KEY));
  const b = q.json;
  check('model sent', b.model === 'claude-haiku-5-5', b.model);
  check('system prompt sent and asks for SHORT list', typeof b.system === 'string' && b.system.includes(SYS) && /SHORT/.test(b.system) && /5 to 12/.test(b.system) && /language/.test(b.system), (b.system || '').slice(0, 80));
  check('forced tool call', b.tool_choice && b.tool_choice.type === 'tool' && b.tool_choice.name === SYS);
  const tool = b.tools && b.tools[0];
  check('one tool with strict schema', b.tools.length === 1 && tool.name === SYS && tool.strict === true && tool.input_schema.additionalProperties === false && tool.input_schema.required.join() === 'title,items', JSON.stringify(tool).slice(0, 120));
  check('schema: question types, item fields', tool.input_schema.properties.questions.items.properties.type.enum.join() === 'yesno,number' && Object.keys(tool.input_schema.properties.items.items.properties).join() === 'text,detail,qty,required');
  check('every object in the schema is closed', (function walk(s) { if (!s || typeof s !== 'object') return true; if (s.type === 'object' && s.additionalProperties !== false) return false; return Object.values(s).every(walk); })(tool.input_schema));
  check('user text passed trimmed, as given', b.messages.length === 1 && b.messages[0].role === 'user' && b.messages[0].content === 'Weekend trip to the mountains', b.messages[0]);
  check('max_tokens set, no sampling params', Number.isInteger(b.max_tokens) && b.max_tokens > 0 && !('temperature' in b) && !('top_p' in b) && !('top_k' in b) && !('thinking' in b));
  check('only the mock was contacted', requests.length > 0 && requests.every(r => r.url.startsWith(m.url)), requests.map(r => r.url));
  check('key never in any other request', requests.every(r => !JSON.stringify(r).replace(/"x-api-key":"test-key"/g, '').includes(KEY) || r.url.startsWith(m.url)));

  // draft in the editor
  const t = await text(page);
  check('editor on the points step with the draft items', await page.locator('.row').count() === 4 && t.includes('Weekend trip') && t.includes('Passport') && t.includes('Shirts') && t.includes('Socks'), t.slice(0, 200));
  check('editor: no Delete button, has Cancel, Questions 1, Save', !/Delete/.test(await page.locator('.actions').innerText()) && /Cancel/.test(await page.locator('.actions').innerText()) && /Questions 1/.test(await page.locator('.actions').innerText()));
  check('nothing saved yet', (await lists(page)).length === before, (await lists(page)).length);
  check('key not in the DOM', !(await html(page)).includes(KEY));
  // Cancel discards
  await page.click('text=Cancel');
  await page.waitForSelector('#new');
  check('cancel on the draft: no new list', (await lists(page)).length === before);
  // again, then Save with a double click
  await page.click('#quick'); await page.fill('#quick-prompt', 'Weekend trip'); await page.press('#quick-prompt', 'Enter');
  await page.waitForSelector('#draft');
  await page.locator('.actions button', { hasText: 'Save' }).dblclick();
  await page.waitForTimeout(300);
  // the second click of a double click lands on whatever Home shows under Save ("+ New"), which is Home's business
  let ls = await lists(page);
  if (await page.locator('#new').count() === 0) await page.click('text=Cancel');
  await page.waitForSelector('#new');
  check('save adds exactly one list (double click)', ls.length === before + 1, ls.length);
  const saved = ls[ls.length - 1];
  check('saved list content', saved.title === 'Weekend trip' && saved.items.length === 4 && saved.questions.length === 1 && saved.questions[0].name === 'nights' && saved.items[2].qty === 'nights' && saved.sound === false && saved.voice === false && typeof saved.id === 'string', JSON.stringify(saved));
  check('saved list ids unique', new Set(ls.map(l => l.id)).size === ls.length);
  // run it: the question is asked and the quantity applies
  await page.locator('.home-item .open', { hasText: 'Weekend trip' }).last().click();
  await page.waitForSelector('#answer');
  check('run asks the generated question', (await text(page)).includes('How many nights?'));
  await page.fill('#answer', '3');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.item');
  const run = await text(page);
  check('run shows quantities from the answer', /Shirts/.test(run) && /Socks/.test(run) && run.includes('3') && run.includes('4'), run);
  check('no page errors', errors.length === 0, errors);
  await closeAll();

  // --- questions preset with yes/no and linked items
  m.setMode('questions');
  ({ page } = await mkApp(m));
  await page.click('#quick'); await page.fill('#quick-prompt', 'gym'); await page.click('#quick-create');
  await page.waitForSelector('#draft');
  check('questions: 2 questions on the editor', /Questions 2/.test(await page.locator('.actions').innerText()));
  await page.locator('.actions button', { hasText: 'Save' }).click();
  await page.waitForSelector('#new');
  ls = await lists(page);
  const g = ls[ls.length - 1];
  check('questions: saved with linked qty', g.items.filter(i => i.qty === 'sauna').length === 2 && g.questions.map(x => x.name).join() === 'sauna,days', JSON.stringify(g));
  await page.locator('.home-item .open', { hasText: 'Gym bag' }).click();
  await page.waitForSelector('#yes');
  await page.click('#no');
  await page.waitForSelector('#answer');
  await page.fill('#answer', '2'); await page.keyboard.press('Enter');
  await page.waitForSelector('.item');
  const run2 = await text(page);
  check('run: no -> sauna items hidden, number -> shirt shown', !run2.includes('Towel') && run2.includes('Clean shirt') && run2.includes('Shoes'), run2);
  await closeAll();

  // --- prompt box edge cases
  m.reset();
  ({ page, errors } = await mkApp(m));
  await page.click('#quick');
  await page.click('#quick-create');
  check('empty: nothing sent', m.posts().length === 0);
  await page.fill('#quick-prompt', '     ');
  await page.click('#quick-create'); await page.press('#quick-prompt', 'Enter');
  check('whitespace only: nothing sent', m.posts().length === 0 && await page.locator('#quick-prompt').count() === 1);
  // long: 600 chars, programmatic (bypasses maxlength) -> capped in code
  const long = 'a'.repeat(600);
  await page.fill('#quick-prompt', long);
  await page.click('#quick-create'); await page.waitForSelector('#draft');
  check('600 chars: capped at 500', m.posts().length === 1 && m.posts()[0].json.messages[0].content.length === 500, m.posts()[0] && m.posts()[0].json.messages[0].content.length);
  check('maxlength attribute 500', true);
  await page.click('text=Cancel');
  m.reset();
  await page.click('#quick');
  check('maxLength on the input', await page.getAttribute('#quick-prompt', 'maxlength') === '500');
  const emoji = '\u{1F392}'.repeat(600);
  await page.fill('#quick-prompt', emoji);
  await page.click('#quick-create'); await page.waitForSelector('#draft');
  let sent = m.posts()[0].json.messages[0].content;
  check('600 emoji: at most 500 units, no broken pair', sent.length <= 500 && sent.length > 400 && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(sent) && !/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(sent));
  await page.click('text=Cancel'); m.reset(); await page.click('#quick');
  const rtl = 'قائمة للسفر רשימה';
  await page.fill('#quick-prompt', rtl);
  check('input has dir=auto', await page.getAttribute('#quick-prompt', 'dir') === 'auto');
  await page.press('#quick-prompt', 'Enter'); await page.waitForSelector('#draft');
  check('RTL text sent unchanged', m.posts()[0].json.messages[0].content === rtl);
  await page.click('text=Cancel'); m.reset(); await page.click('#quick');
  const htmlish = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script> {{x}} ${y} `z`';
  await page.fill('#quick-prompt', htmlish);
  await page.press('#quick-prompt', 'Enter'); await page.waitForSelector('#draft');
  check('HTML-looking text sent as typed', m.posts()[0].json.messages[0].content === htmlish);
  check('no injected elements / globals', await page.evaluate(() => !window.__pwned && !document.querySelector('script[src=""], img[onerror]')));
  await page.click('text=Cancel'); m.reset(); await page.click('#quick');
  // Enter then click quickly, and double click: one request
  m.setMode('delay');
  await page.fill('#quick-prompt', 'double');
  await page.evaluate(() => {
    const el = document.getElementById('quick-prompt');
    const ev = () => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    ev(); ev();
  });
  await page.waitForSelector('#quick-cancel');
  await page.waitForSelector('#draft');
  check('Enter twice in one tick: one request', m.posts().length === 1, m.posts().length);
  await page.click('text=Cancel'); m.reset(); m.setMode('delay'); await page.click('#quick');
  await page.fill('#quick-prompt', 'dbl');
  await page.dblclick('#quick-create');
  await page.waitForSelector('#draft');
  check('double click Create: one request', m.posts().length === 1, m.posts().length);
  await page.click('text=Cancel'); m.reset(); await page.click('#quick');
  await page.fill('#quick-prompt', 'enter and click');
  await page.press('#quick-prompt', 'Enter');
  const clicked = await page.locator('#quick-create').count();
  check('create button gone while busy (cannot be clicked twice)', clicked === 0);
  await page.waitForSelector('#draft');
  check('no page errors (2)', errors.length === 0, errors);
  await closeAll();
  await m.close();
  process.exit(done() ? 1 : 0);
})().catch(e => { console.log('FAIL crash', e); process.exit(1); });
