// Every failure mode: message, prompt kept, retry, abort, timeout, network / preview-frame failure.
const { check, done, closeAll, mock, mkApp, lists, text, html } = require('./lib.cjs');
(async () => {
  const m = await mock.start({ slowMs: 60000 });
  const KEY = 'test-key';
  const PROMPT = 'weekend trip with the kids';
  let { page, errors } = await mkApp(m);
  await page.click('#quick');
  await page.fill('#quick-prompt', PROMPT);
  const hint = async () => (await page.locator('.hint.err').count()) ? page.locator('.hint.err').innerText() : null;
  const MODES = [
    ['401', /API key was rejected/],
    ['403', /API key was rejected/],
    ['404', /model or the endpoint was not found/],
    ['429', /Rate limit reached\. Try again in 17 seconds\./],
    ['429none', /Rate limit reached\. Try again in a moment\./],
    ['500', /busy or not working/],
    ['502html', /busy or not working/],
    ['529', /busy or not working/],
    ['400', /request was rejected \(400\)\. messages: something is wrong/],
    ['400key', /request was rejected \(400\)\./],
    ['toolchoice', /does not accept a forced tool call/],
    ['errorbody', /busy or not working/],
    ['malformed', /did not answer in the expected format/],
    ['html', /did not answer in the expected format/],
    ['notool', /did not contain a checklist/],
    ['maxtokens', /cut off/],
    ['refusal', /declined/],
    ['emptyStrings', /no usable checklist/],
    ['emptyItems', /no usable checklist/],
    ['wrongTypes', /no usable checklist/],
    ['nested', /no usable checklist/],
    ['notObject', /no usable checklist/],
  ];
  const seen = new Set();
  for (const [mode, re] of MODES) {
    m.reset(); m.setMode(mode);
    await page.click('#quick-create');
    await page.waitForSelector('.hint.err', { timeout: 10000 });
    const msg = await hint();
    check(mode + ': message', re.test(msg), msg);
    check(mode + ': prompt kept', await page.inputValue('#quick-prompt') === PROMPT);
    check(mode + ': retry button, still on Quick list', (await page.locator('#quick-create').innerText()) === 'Try again' && await page.locator('#quick-back').count() === 1);
    check(mode + ': one request', m.posts().length === 1);
    check(mode + ': no key in the message or DOM', !msg.includes(KEY) && !(await html(page)).includes(KEY), msg);
    check(mode + ': no draft opened', await page.locator('#draft').count() === 0);
    check(mode + ': message is plain text (no exclamation, no emoji)', !/[!\u{1F300}-\u{1FAFF}]/u.test(msg), msg);
    seen.add(msg);
  }
  check('400key: key scrubbed to [key]', (await (async () => { m.reset(); m.setMode('400key'); await page.click('#quick-create'); await page.waitForSelector('.hint.err'); return hint(); })()).includes('[key]'));
  check('messages are distinct per kind', seen.size >= 13, seen.size);
  check('alert role on the error', await page.getAttribute('.hint.err', 'role') === 'alert');
  // retry works and the error goes away
  m.reset(); m.setMode('success');
  await page.click('#quick-create');
  await page.waitForSelector('#draft');
  check('retry after errors succeeds and opens the draft', (await text(page)).includes('Weekend trip'));
  check('retry used the same prompt', m.posts()[0].json.messages[0].content === PROMPT);
  await page.click('text=Cancel');
  await page.click('#quick');
  check('a new Quick list visit starts clean (no stale error)', (await page.locator('.hint.err').count()) === 0 && await page.inputValue('#quick-prompt') === '');

  // --- abort
  m.reset(); m.setMode('slow');
  await page.fill('#quick-prompt', PROMPT);
  await page.click('#quick-create');
  await page.waitForSelector('#quick-cancel');
  check('busy state: Creating..., no input, no create', (await text(page)).includes('Creating...') && await page.locator('#quick-prompt').count() === 0 && await page.locator('#quick-create').count() === 0);
  check('busy state: status role', await page.getAttribute('[role=status]', 'role') === 'status');
  await page.waitForTimeout(200);
  await page.click('#quick-cancel');
  await page.waitForSelector('#quick-prompt');
  check('cancel: back to the input with the prompt kept, no error', await page.inputValue('#quick-prompt') === PROMPT && (await page.locator('.hint.err').count()) === 0 && (await page.locator('#quick-create.muted').count()) === 0);
  await page.waitForTimeout(300);
  check('cancel: the request was aborted on the wire', m.posts().length === 1 && m.posts()[0].aborted === true, m.posts().map(p => p.aborted));
  check('cancel: no draft appears', await page.locator('#draft').count() === 0 && await page.locator('#quick-prompt').count() === 1);
  // a late answer after cancel is ignored
  m.reset(); m.setMode('delay');
  await page.click('#quick-create'); await page.waitForSelector('#quick-cancel'); await page.click('#quick-cancel');
  await page.waitForTimeout(1500);
  check('late answer after cancel does not open the editor', await page.locator('#draft').count() === 0 && await page.locator('#quick-prompt').count() === 1);
  // start again after cancel works
  m.reset(); m.setMode('success');
  await page.click('#quick-create'); await page.waitForSelector('#draft');
  check('create again after cancel works', m.posts().length === 1);
  await page.click('text=Cancel');
  m.reset(); m.setMode('slow');
  await page.click('#quick'); await page.fill('#quick-prompt', 'x'); await page.click('#quick-create'); await page.waitForSelector('#quick-cancel');
  check('no page errors', errors.length === 0, errors);
  await closeAll();

  // --- timeout (fake clock)
  m.reset(); m.setMode('slow');
  ({ page, errors } = await mkApp(m));
  await page.clock.install();
  await page.click('#quick'); await page.fill('#quick-prompt', PROMPT); await page.click('#quick-create');
  await page.waitForSelector('#quick-cancel');
  await page.clock.runFor(29000);
  check('before 30 s: still waiting', await page.locator('#quick-cancel').count() === 1);
  await page.clock.runFor(2000);
  await page.waitForSelector('.hint.err');
  const tm = await hint();
  check('timeout message', /No answer after 30 seconds\. Try again\./.test(tm), tm);
  check('timeout: prompt kept, retry available, request aborted', await page.inputValue('#quick-prompt') === PROMPT && (await page.locator('#quick-create').innerText()) === 'Try again');
  await page.waitForTimeout(300);
  check('timeout: aborted on the wire', m.posts()[0].aborted === true);
  m.reset(); m.setMode('success');
  await page.click('#quick-create'); await page.waitForSelector('#draft');
  check('retry after timeout works', m.posts().length === 1);
  await closeAll();

  // --- network: closed port, route abort (preview frame style), no CORS headers, redirect
  const NET = /Could not reach the endpoint\..*claude\.ai preview frame blocks requests to other sites.*standalone page/;
  ({ page } = await mkApp(m, { ai: { endpoint: 'http://127.0.0.1:1' } }));
  await page.click('#quick'); await page.fill('#quick-prompt', PROMPT); await page.click('#quick-create');
  await page.waitForSelector('.hint.err');
  check('closed port: network message', NET.test(await hint()), await hint());
  await closeAll();

  m.reset(); m.setMode('success');
  ({ page } = await mkApp(m));
  await page.route(m.url + '/**', r => r.abort('blockedbyclient'));
  await page.click('#quick'); await page.fill('#quick-prompt', PROMPT); await page.click('#quick-create');
  await page.waitForSelector('.hint.err');
  check('preview-frame style block (route abort): standalone page message', NET.test(await hint()), await hint());
  check('route abort: prompt kept + retry', await page.inputValue('#quick-prompt') === PROMPT);
  await page.unroute(m.url + '/**');
  await page.click('#quick-create'); await page.waitForSelector('#draft');
  check('route abort: works once unblocked', (await text(page)).includes('Weekend trip'));
  await closeAll();

  m.reset(); m.setMode('nocors');
  ({ page } = await mkApp(m));
  await page.click('#quick'); await page.fill('#quick-prompt', PROMPT); await page.click('#quick-create');
  await page.waitForFunction(() => document.querySelector('.hint.err') || document.querySelector('#draft'), null, { timeout: 10000 });
  const nc = await page.locator('.hint.err').count() ? await hint() : 'DRAFT OPENED';
  console.log('   (nocors under Playwright routing:', nc.slice(0, 60), ')');
  await closeAll();

  m.reset(); m.setMode('redirect');
  ({ page } = await mkApp(m));
  await page.click('#quick'); await page.fill('#quick-prompt', PROMPT); await page.click('#quick-create');
  await page.waitForSelector('.hint.err');
  check('redirect is not followed (key is not forwarded)', NET.test(await hint()) && m.posts().length === 1, m.log.map(r => r.url));
  await closeAll();

  // --- settings problems caught before any request
  m.reset(); m.setMode('success');
  for (const [name, ai, re] of [
    ['bad endpoint', { endpoint: 'not a url' }, /not a valid web address/],
    ['ftp endpoint', { endpoint: 'ftp://x.example' }, /not a valid web address/],
    ['plain http to a remote host', { endpoint: 'http://example.com' }, /must start with https/],
    ['credentials in the endpoint', { endpoint: 'https://u:p@example.com' }, /not a valid web address/],
    ['key with non-ASCII', { key: 'tést' }, /characters that cannot be sent/],
    ['key with a space inside', { key: 'te st' }, /characters that cannot be sent/],
  ]) {
    ({ page } = await mkApp(m, { ai }));
    await page.click('#quick'); await page.fill('#quick-prompt', PROMPT); await page.click('#quick-create');
    await page.waitForSelector('.hint.err');
    const msg = await hint();
    check(name + ': message', re.test(msg), msg);
    check(name + ': nothing sent', m.posts().length === 0 && (await page.locator('#quick-prompt').inputValue()) === PROMPT);
    await closeAll();
  }
  // whitespace around the key is trimmed
  ({ page } = await mkApp(m, { ai: { key: '  test-key  ' } }));
  await page.click('#quick'); await page.fill('#quick-prompt', PROMPT); await page.click('#quick-create'); await page.waitForSelector('#draft');
  check('key with surrounding spaces is trimmed when sent', m.posts()[0].headers['x-api-key'] === 'test-key');
  await closeAll();
  await m.close();
  process.exit(done() ? 1 : 0);
})().catch(e => { console.log('FAIL crash', e); process.exit(1); });
