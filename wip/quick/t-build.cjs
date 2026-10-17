// Unit tests of buildQuickDraft / cleanQuick / quickUrl on the hostile answers from the mock presets.
const { FILE, openApp, closeAll, check, done } = require('./lib.cjs');
const { PRESETS } = require('./mock-anthropic.cjs');
(async () => {
  const { page } = await openApp(FILE, { settings: { ai: { key: 'k' } } });
  const build = (input) => page.evaluate(i => buildQuickDraft(i), input);
  const names = d => d.items.map(i => i.text);
  let d;

  d = await build(PRESETS.success);
  check('success: title, 4 items, 1 question', d && d.title === 'Weekend trip' && d.items.length === 4 && d.questions.length === 1, d);
  check('success: question shape', d.questions[0].name === 'nights' && d.questions[0].type === 'number' && d.questions[0].label === 'How many nights?' && d.questions[0].text === 'nights' && typeof d.questions[0].id === 'string', d.questions);
  check('success: flags', d.sound === false && d.voice === false && d.items[0].required === true && d.items[1].required === false && d.items[0].detail === 'Check the expiry date' && d.items[1].detail === '', d.items);
  check('success: keys only the editor shape', Object.keys(d).sort().join() === 'items,questions,sound,title,voice' && Object.keys(d.items[0]).sort().join() === 'detail,qty,required,text', Object.keys(d));

  d = await build(PRESETS.questions);
  check('questions: linked items carry the question name as qty', d.items.filter(i => i.qty === 'sauna').map(i => i.text).join() === 'Towel,Flip-flops' && d.items.find(i => i.text === 'Clean shirt').qty === 'days', d.items);
  check('questions: yesno label', d.questions[0].label === 'I go to the sauna?' && d.questions[0].type === 'yesno' && d.questions[0].name === 'sauna', d.questions);
  check('questions: top items first, then linked', names(d).join() === 'Shoes,Water bottle,Towel,Flip-flops,Clean shirt', names(d));
  check('questions: linked detail kept', d.items.find(i => i.text === 'Towel').detail === 'For the sauna');

  d = await build(PRESETS.tooMany);
  check('tooMany: 40 items max', d && d.items.length === 40, d && d.items.length);
  check('tooMany: 12 questions max (those used)', d.questions.length <= 12, d.questions.length);
  // questions beyond the cap must not leave their items behind
  const qn = new Set(d.questions.map(q => q.name));
  check('tooMany: every linked qty is a kept question', d.items.every(i => !i.qty || qn.has(i.qty)), d.items.filter(i => i.qty && !qn.has(i.qty)));

  d = await build(PRESETS.hugeStrings);
  check('hugeStrings: title capped at 60', d && Array.from(d.title).length === 60, d && d.title.length);
  check('hugeStrings: text 120, detail 200', d.items[0].text.length === 120 && d.items[0].detail.length === 200, d.items.map(i => [i.text.length, i.detail.length]));
  check('hugeStrings: a 5000-char formula drops the item', d.items.length === 1 && !d.items.some(i => i.text === 'Fine'), names(d));

  d = await build(PRESETS.htmlish);
  check('htmlish: kept as plain text', d.title === '<img src=x onerror=alert(1)>Trip' && d.items[0].text === '<script>window.__pwned=1</script>Keys', d);

  d = await build(PRESETS.controlChars);
  check('control: title cleaned', d.title === 'Trip rtl', JSON.stringify(d.title));
  check('control: item text', d.items[0].text === 'Passport now', JSON.stringify(d.items[0].text));
  check('control: detail', d.items[0].detail === 'abcd'.replace('d', ' d').replace('c ', 'c') || d.items[0].detail === 'abc d', JSON.stringify(d.items[0].detail));
  check('control: hidden tag characters removed', d.items[1].text === 'Hidden', JSON.stringify(d.items[1].text));
  check('control: all-invisible item dropped', d.items.length === 2, names(d));

  d = await build(PRESETS.badFormulas);
  check('formulas: bad ones dropped', names(d).join() === 'Good,Max ok,Number,Plain', names(d));
  check('formulas: number qty becomes string', d.items.find(i => i.text === 'Number').qty === '3');

  d = await build(PRESETS.dupQuestions);
  console.log(JSON.stringify(d));
  check('dups: duplicate question merged (same text)', d.questions.filter(q => q.text.toLowerCase() === 'i go to the sauna').length === 1, d.questions);
  check('dups: names unique', new Set(d.questions.map(q => q.name)).size === d.questions.length, d.questions.map(q => q.name));
  check('dups: second distinct sauna question gets sauna2', d.questions.some(q => q.name === 'sauna2'), d.questions.map(q => q.name));
  check('dups: item names de-duplicated case-insensitively', d.items.filter(i => i.text.toLowerCase() === 'a').length === 1);
  check('dups: function-name question renamed', !d.questions.some(q => q.name === 'ceil'), d.questions.map(q => q.name));
  check('dups: invalid type / blank text questions dropped, their items too', !d.items.some(i => i.text === 'Z') && !d.questions.some(q => q.text === 'wrong type'));
  check('dups: unused question dropped', !d.questions.some(q => q.text === 'Unused question'));
  check('dups: "How many 2" gets a q name', d.questions.some(q => q.text === '2' && q.name === 'q2'), d.questions);

  d = await build(PRESETS.emptyStrings);
  check('emptyStrings -> null', d === null, d);
  d = await build(PRESETS.emptyItems);
  check('emptyItems -> null', d === null, d);
  d = await build(PRESETS.wrongTypes);
  check('wrongTypes -> null', d === null, d);
  check('string input -> null', (await build(PRESETS.notObject)) === null);
  check('null/array/number -> null', (await build(null)) === null && (await build([1])) === null && (await build(5)) === null);
  d = await build(PRESETS.nested);
  check('nested: null (no usable title)', d === null, d);
  d = await build({ ...PRESETS.nested, title: 'Fine' });
  check('nested garbage items skipped, strings accepted', d && names(d).join() === 'Plain string item,Ok' && d.items[1].required === false && d.items[1].detail === '', d);
  d = await build(PRESETS.quotes);
  check('quotes: title collapsed, duplicate item dropped, required only for true', d.title === 'Camp out' && names(d).join() === 'Tent,Sleeping bag,Lighter' && d.items.map(i => i.required).join() === 'false,true,false', d);
  d = await build(PRESETS.unicode);
  check('unicode: emoji, RTL and ZWJ handling', d.title === 'Reise \u{1F9F3}' && d.items[0].text === '\u05D3\u05E8\u05DB\u05D5\u05DF' && d.items[1].text === '\u{1F468}\u{1F469}\u{1F467} family', JSON.stringify(d.items));
  check('unicode: lone surrogates removed', d.items[2].text === 'lone' && d.items[3].text === 'also', JSON.stringify(d.items));
  check('JSON string input parsed', (await build(JSON.stringify(PRESETS.success))).title === 'Weekend trip');
  // prototype names
  d = await build({ title: 'P', items: [{ text: 'x', qty: 'constructor' }, { text: 'y', qty: '__proto__' }, { text: 'z', qty: 'hasownproperty' }] });
  check('prototype-looking formula names are unknown names', d === null, d);
  d = await build({ title: 'P', items: [{ text: 'x' }], questions: [{ type: 'number', text: 'constructor', items: ['k'] }] });
  check('a question named constructor works', d && d.questions[0].name === 'constructor_q' && d.items[1].qty === 'constructor_q', d);
  d = await build({ title: 'P', items: [{ text: 'x' }], questions: [{ type: 'yesno', text: '\u0421\u0430\u0443\u043D\u0430', items: ['\u041F\u043E\u043B\u043E\u0442\u0435\u043D\u0446\u0435'] }, { type: 'yesno', text: '\u6851\u62FF', items: ['\u6BDB\u5DFE'] }] });
  check('non-latin question texts get q1, q2', d && d.questions.map(q => q.name).join() === 'q1,q2' && d.items.map(i => i.qty).join() === ',q1,q2', d);

  const url = u => page.evaluate(x => { try { return quickUrl(x); } catch (e) { return 'ERR ' + e.message; } }, u);
  check('url default', (await url('')) === 'https://api.anthropic.com/v1/messages');
  check('url trailing slash and /v1', (await url('https://x.example/anthropic/')) === 'https://x.example/anthropic/v1/messages' && (await url('https://x.example/v1')) === 'https://x.example/v1/messages' && (await url('https://x.example/v1/messages')) === 'https://x.example/v1/messages');
  check('url http only for localhost', /^ERR/.test(await url('http://example.com')) && (await url('http://localhost:8080')) === 'http://localhost:8080/v1/messages' && (await url('http://127.0.0.1:9')) === 'http://127.0.0.1:9/v1/messages');
  check('url junk and credentials rejected', /^ERR/.test(await url('not a url')) && /^ERR/.test(await url('ftp://x.example')) && /^ERR/.test(await url('https://u:p@x.example')) && /^ERR/.test(await url('javascript:alert(1)')));
  check('url query and hash dropped', (await url('https://x.example/?a=1#b')) === 'https://x.example/v1/messages');
  const retry = v => page.evaluate(x => quickRetry(x), v);
  check('retry-after formats', (await retry('17')) === ' Try again in 17 seconds.' && (await retry('1')) === ' Try again in 1 second.' && (await retry('0')) === ' Try again in 1 second.' && (await retry('300')) === ' Try again in about 5 minutes.' && (await retry('abc')) === '' && (await retry('-5')) === '' && (await retry('99999999')) === '' && (await retry(null)) === '', [await retry('17'), await retry('300'), await retry('abc')]);
  const dt = new Date(Date.now() + 45000).toUTCString();
  check('retry-after as an HTTP date', /Try again in (4[4-6]|45) seconds/.test(await retry(dt)), await retry(dt));
  await closeAll();
  process.exit(done() ? 1 : 0);
})().catch(e => { console.log('FAIL crash', e); process.exit(1); });
