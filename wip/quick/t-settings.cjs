// Missing key flow, Quick list settings (persistence, masking, clear), layout in the three designs with screenshots.
const { check, done, closeAll, mock, mkApp, lists, text, html, openApp, FILE } = require('./lib.cjs');
const DIR = __dirname + '/shots/';
(async () => {
  const m = await mock.start();
  const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('settings')));
  const overflowX = page => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth || document.body.scrollWidth > document.body.clientWidth);
  const pageScrolls = page => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight || document.body.scrollHeight > window.innerHeight);
  const small = page => page.evaluate(() => [...document.querySelectorAll('button, input')].map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.textContent, w: r.width, h: r.height }; }).filter(r => (r.h < 47.5 || r.w < 47.5) && r.w > 0));

  // --- no key
  let { page, errors } = await mkApp(m, { ai: { key: '' } });
  await page.click('#quick');
  const t0 = await text(page);
  check('no key: explanation and the two buttons', /API key/.test(t0) && await page.locator('#quick-open-settings').count() === 1 && await page.locator('#quick-back').count() === 1 && await page.locator('#quick-prompt').count() === 0 && await page.locator('#quick-create').count() === 0, t0);
  check('no key: primary button is not muted, Back is', await page.locator('#quick-open-settings.muted').count() === 0 && await page.locator('#quick-back.muted').count() === 1);
  check('no key: hit areas', (await small(page)).length === 0, await small(page));
  await page.screenshot({ path: DIR + 'classic-nokey.png' });
  await page.click('#quick-open-settings');
  check('open settings goes to Quick list settings', await page.locator('#ai-key').count() === 1);
  await page.keyboard.type('sk-ant-typed-1234');
  await page.fill('#ai-key', 'sk-ant-typed-1234');
  check('key stored on typing', (await stored(page)).ai.key === 'sk-ant-typed-1234');
  await page.click('#ai-back');
  check('back goes to Settings with "Key saved"', /Key saved/.test(await text(page)));
  await page.click('#settings-back');
  await page.click('#quick');
  check('with a key the prompt is shown', await page.locator('#quick-prompt').count() === 1 && await page.locator('#quick-open-settings').count() === 0);
  await page.click('#quick-back');
  check('Back returns home', await page.locator('#new').count() === 1);
  check('no requests were made', m.log.length === 0);
  check('no page errors', errors.length === 0, errors);
  await closeAll();

  // --- settings persistence, masking, clear
  ({ page, errors } = await mkApp(m, { ai: { key: '', endpoint: 'https://api.anthropic.com' }, seedOnce: true }));
  await page.click('#settings'); await page.click('#set-ai');
  check('settings screen markup', await page.locator('div.screen.settings > .settings-scroll > .settings-in').count() === 1 && await page.locator('.settings-in h1').innerText() === 'Quick list' && await page.locator('.settings-in .sec').count() >= 4);
  check('labels tied to inputs', await page.locator('label[for=ai-key]').count() === 1 && await page.locator('label[for=ai-model]').count() === 1 && await page.locator('label[for=ai-endpoint]').count() === 1);
  check('key input: password, autocomplete off, no spellcheck', await page.getAttribute('#ai-key', 'type') === 'password' && await page.getAttribute('#ai-key', 'autocomplete') === 'off' && await page.getAttribute('#ai-key', 'spellcheck') === 'false');
  check('model default shown', await page.inputValue('#ai-model') === 'claude-haiku-5-5');
  check('endpoint placeholder', await page.getAttribute('#ai-endpoint', 'placeholder') === 'https://api.anthropic.com' && await page.inputValue('#ai-endpoint') === '');
  const warn = await text(page);
  check('warnings present', /stored in this browser only and is sent only to the endpoint above/.test(warn) && /description you type is sent to the API provider/.test(warn) && /restricted key or your own proxy/.test(warn) && /standalone page/.test(warn) && /preview frame blocks outside requests/.test(warn), warn);
  check('buttons Clear key and Back', await page.locator('#ai-clear').count() === 1 && await page.locator('#ai-back').count() === 1);
  await page.click('#ai-key');
  await page.keyboard.type('sk-secret-abc');
  await page.fill('#ai-model', 'claude-sonnet-5-5');
  await page.fill('#ai-endpoint', ' https://proxy.example.com/anthropic ');
  let st = await stored(page);
  check('persisted key, model, endpoint (trimmed)', st.ai.key === 'sk-secret-abc' && st.ai.model === 'claude-sonnet-5-5' && st.ai.endpoint === 'https://proxy.example.com/anthropic', st.ai);
  check('key not in the DOM or page text', !(await html(page)).includes('sk-secret-abc') && !(await text(page)).includes('sk-secret-abc'));
  check('typing did not drop focus/characters (typed char by char)', await page.inputValue('#ai-key') === 'sk-secret-abc');
  await page.reload();
  await page.waitForSelector('#settings');
  await page.click('#settings'); await page.click('#set-ai');
  check('reload: values restored', await page.inputValue('#ai-key') === 'sk-secret-abc' && await page.inputValue('#ai-model') === 'claude-sonnet-5-5' && await page.inputValue('#ai-endpoint') === 'https://proxy.example.com/anthropic');
  check('reload: key still not in DOM', !(await html(page)).includes('sk-secret-abc'));
  check('reload: Settings row says Key saved', true);
  // empty model/endpoint fall back to defaults
  await page.fill('#ai-model', ''); await page.fill('#ai-endpoint', '');
  st = await stored(page);
  check('empty model/endpoint store the defaults', st.ai.model === 'claude-haiku-5-5' && st.ai.endpoint === 'https://api.anthropic.com' && st.ai.key === 'sk-secret-abc', st.ai);
  check('empty fields stay empty while editing (placeholder shows)', await page.inputValue('#ai-model') === '' && await page.inputValue('#ai-endpoint') === '');
  // 300 char limit
  await page.fill('#ai-key', 'k'.repeat(400));
  check('key capped at 300', (await stored(page)).ai.key.length === 300 && await page.getAttribute('#ai-key', 'maxlength') === '300');
  // clear
  await page.fill('#ai-key', 'sk-secret-abc');
  await page.click('#ai-clear');
  check('clear key: field empty, storage empty, other fields kept', await page.inputValue('#ai-key') === '' && (await stored(page)).ai.key === '');
  await page.click('#ai-back');
  check('settings row says No key', /No key/.test(await text(page)));
  await page.click('#settings-back'); await page.click('#quick');
  check('after clear the no-key screen shows', await page.locator('#quick-open-settings').count() === 1);
  check('no page errors (settings)', errors.length === 0, errors);
  await closeAll();

  // --- screens in the three designs
  const longErr = 'Could not reach the endpoint.';
  for (const design of ['classic', 'airplane', 'modern']) {
    for (const [mode, scheme] of design === 'classic' ? [['light', 'light'], ['dark', 'dark']] : design === 'modern' ? [['light', 'light'], ['dark', 'dark']] : [['dark', 'dark']]) {
      for (const width of [320, 360, 390]) {
        const tag = `${design}-${mode}-${width}`;
        m.reset();
        ({ page, errors } = await mkApp(m, { width, height: 560, colorScheme: scheme, settings: { design, mode }, ai: { key: 'test-key' }, seedOnce: true }));
        await page.click('#quick');
        const rec = async (name) => {
          check(`${tag} ${name}: no horizontal overflow, page does not scroll`, !(await overflowX(page)) && !(await pageScrolls(page)));
          check(`${tag} ${name}: hit areas >= 48`, (await small(page)).length === 0, await small(page));
          if (width === 360) await page.screenshot({ path: DIR + `${design}-${mode}-${name}.png` });
        };
        await rec('idle');
        await page.fill('#quick-prompt', 'Leaving for a long weekend hiking trip in the mountains with two children and a dog');
        await rec('filled');
        m.setMode('nocors');
        await page.click('#quick-create'); await page.waitForSelector('.hint.err');
        await rec('error');
        m.setMode('slow'); await page.click('#quick-create'); await page.waitForSelector('#quick-cancel');
        await rec('busy');
        await page.click('#quick-cancel');
        await page.click('#quick-back'); await page.click('#settings'); await page.click('#set-ai');
        await rec('settings');
        if (width === 360) {
          await page.evaluate(() => { const s = document.querySelector('.settings-scroll'); s.scrollTop = s.scrollHeight; });
          await page.screenshot({ path: DIR + `${design}-${mode}-settings-bottom.png` });
        }
        check(`${tag}: settings scroll area scrolls only inside`, await page.evaluate(() => { const s = document.querySelector('.settings-scroll'); return s.scrollHeight >= s.clientHeight; }));
        await page.fill('#ai-key', 'abc');
        await page.click('#ai-back'); await page.click('#settings-back');
        // no key screen
        await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('settings')); s.ai.key = ''; localStorage.setItem('settings', JSON.stringify(s)); });
        await page.reload(); await page.waitForSelector('#quick'); await page.click('#quick');
        await rec('nokey');
        check(`${tag}: no page errors`, errors.length === 0, errors);
        await closeAll();
      }
    }
  }
  await m.close();
  process.exit(done() ? 1 : 0);
})().catch(e => { console.log('FAIL crash', e); process.exit(1); });
