// Item 4: entry fields, limits with messages, odd inputs.
const L = require('./lib.cjs');
const { ok } = L;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hint = p => p.textContent('.hint');
const attrs = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); const cs = getComputedStyle(e); return { fs: parseFloat(cs.fontSize), ekh: e.getAttribute('enterkeyhint'), ac: e.getAttribute('autocomplete'), cap: e.getAttribute('autocapitalize'), sp: e.getAttribute('spellcheck'), al: e.getAttribute('aria-label') }; }, sel);
const rowsFit = p => p.evaluate(() => {
  const st = document.querySelector('.stack'), s = st.getBoundingClientRect(), bad = [];
  for (const r of st.querySelectorAll('.row')) {
    const b = r.getBoundingClientRect();
    if (b.right > s.right + 1 || b.left < s.left - 1) bad.push('row out ' + r.textContent.slice(0, 10));
    for (const c of r.querySelectorAll('.label, .label > span, .x, .mark')) { const q = c.getBoundingClientRect(); if (q.width && (q.right > b.right + 1 || q.left < b.left - 1)) bad.push('child out ' + c.className + ' ' + r.textContent.slice(0, 10)); }
    if (r.scrollWidth > r.clientWidth + 1) bad.push('row scrollWidth ' + r.textContent.slice(0, 10));
  }
  return bad;
});
(async () => {
  const lists = [L.list(2, 'Two'), { id: 'big', title: 'Big', items: Array.from({ length: 85 }, (_, i) => ({ text: 'B' + (i + 1) })) },
    { id: 'longtitle', title: 'word '.repeat(14).trim(), items: [{ text: 'a' }] },
    { id: 'longdetail', title: 'LD', items: [{ text: 'a', detail: 'd'.repeat(250) }] },
    { id: 'qs', title: 'Qs', questions: [{ id: 'q1', name: 'sauna', type: 'yesno', text: 'I go to the sauna', label: 'I go to the sauna?' }], items: [{ text: 'Towel', qty: 'sauna' }] }];
  const { page: p } = await L.open({ lists });

  // ---- name step
  await p.click('#new');
  let a = await attrs(p, '#title');
  ok('name: font-size >= 16', a.fs >= 16, a.fs);
  ok('name: enterkeyhint next, autocomplete off, autocapitalize sentences', a.ekh === 'next' && a.ac === 'off' && a.cap === 'sentences', JSON.stringify(a));
  await p.fill('#title', '   ​ \t  '); await p.press('#title', 'Enter');
  ok('name: whitespace/zero-width only does not advance', await p.locator('#title').count() === 1);
  ok('name: Next looks inactive when blank', await p.locator('.actions button').last().evaluate(e => e.classList.contains('muted')));
  await p.fill('#title', 'x'.repeat(61)); await p.press('#title', 'Enter');
  ok('name: 61 characters refused with a message', await p.locator('#title').count() === 1 && (await hint(p)) === 'Names can be up to 60 characters (now 61).', await hint(p));
  ok('name: message uses the error style', await p.locator('.hint.err').count() === 1);
  await p.fill('#title', 'x'.repeat(61) + ' ');
  await p.fill('#title', 'y'.repeat(60));
  ok('name: message clears when typing', (await hint(p)) === 'Name');
  await p.press('#title', 'Enter');
  ok('name: 60 characters accepted', await p.locator('#fb-next').count() === 1);
  await L.back(p);
  await p.fill('#title', '  Pre   flight   check  '); await p.press('#title', 'Enter');
  ok('name: whitespace collapsed', (await p.textContent('.points > h1')) === 'Pre flight check', await p.textContent('.points > h1'));
  await p.click('#fb-next');

  // ---- points step
  a = await attrs(p, '#draft');
  ok('draft: font-size >= 16', a.fs >= 16, a.fs);
  ok('draft: enterkeyhint next, autocomplete off, autocapitalize sentences', a.ekh === 'next' && a.ac === 'off' && a.cap === 'sentences' && !!a.al, JSON.stringify(a));
  const items = () => L.cssOrder(p);
  await p.fill('#draft', '   '); await p.press('#draft', 'Enter');
  ok('draft: spaces only adds nothing and clears the field', (await items()).length === 0 && (await p.inputValue('#draft')) === '');
  await p.fill('#draft', '​‍﻿'); await p.press('#draft', 'Enter');
  ok('draft: zero-width only adds nothing', (await items()).length === 0);
  await p.fill('#draft', '  Check   fuel \t now  '); await p.press('#draft', 'Enter');
  ok('draft: trimmed and collapsed', JSON.stringify(await items()) === JSON.stringify(['Check fuel now']), JSON.stringify(await items()));
  await p.fill('#draft', 'Check fuel now'); await p.press('#draft', 'Enter');
  ok('draft: duplicate text is allowed', (await items()).length === 2);
  await p.fill('#draft', 'e'.repeat(121)); await p.press('#draft', 'Enter');
  ok('item: 121 characters refused with a message', (await items()).length === 2 && (await hint(p)) === 'Items can be up to 120 characters (now 121).', await hint(p));
  ok('item: refusal keeps the draft and the focus', (await p.inputValue('#draft')).length === 121 && await p.evaluate(() => document.activeElement.id) === 'draft');
  ok('item: message uses the error style', await p.locator('.hint.err').count() === 1);
  await p.fill('#draft', 'e'.repeat(120)); 
  ok('item: message clears when typing', (await p.locator('.hint.err').count()) === 0);
  await p.press('#draft', 'Enter');
  ok('item: exactly 120 characters accepted', (await items()).length === 3);
  ok('item: 120 unbroken characters fit the row', (await rowsFit(p)).length === 0, JSON.stringify(await rowsFit(p)));
  const clamp = await p.evaluate(() => { const r = [...document.querySelectorAll('.row')].find(x => x.textContent.includes('eeeee')); const s = r.querySelector('.label > span'); return { rowH: r.getBoundingClientRect().height, lines: Math.round(s.getBoundingClientRect().height / parseFloat(getComputedStyle(s).lineHeight)) }; });
  ok('item: long unbroken text wraps and is cut at 3 lines', clamp.lines <= 3 && clamp.lines >= 2, JSON.stringify(clamp));
  await p.fill('#draft', '😀'.repeat(120)); await p.press('#draft', 'Enter');
  ok('emoji: 120 emoji count as 120 characters (accepted)', (await items()).length === 4);
  await p.fill('#draft', '😀'.repeat(121)); await p.press('#draft', 'Enter');
  ok('emoji: 121 emoji refused', (await items()).length === 4 && (await hint(p)).includes('(now 121)'), await hint(p));
  await p.fill('#draft', 'ZWJ family 👨‍👩‍👧‍👦 ok'); await p.press('#draft', 'Enter');
  ok('emoji sequence accepted', (await items()).length === 5);
  await p.fill('#draft', 'مرحبا بالعالم 123 abc'); await p.press('#draft', 'Enter');
  ok('RTL text accepted', (await items()).includes('مرحبا بالعالم 123 abc'));
  const dir = await p.evaluate(() => { const r = [...document.querySelectorAll('.row')].find(x => x.textContent.includes('مرحبا')); const s = r.querySelector('.label > span'); return { dir: s.getAttribute('dir'), right: r.getBoundingClientRect().right - r.querySelector('.mark').getBoundingClientRect().right }; });
  ok('RTL row keeps the layout (dir=auto on the text)', dir.dir === 'auto' && dir.right >= 0, JSON.stringify(dir));
  await p.fill('#draft', 'w'.repeat(60)); await p.press('#draft', 'Enter');
  ok('60-character unbroken word accepted', (await items()).includes('w'.repeat(60)));
  await p.fill('#draft', 'x'.repeat(5000)); await p.press('#draft', 'Enter');
  ok('5,000 characters refused with a message', (await hint(p)) === 'Items can be up to 120 characters (now 5000).' && (await items()).length === 7, await hint(p));
  ok('5,000 characters: input does not grow the layout', await L.noPageScroll(p) && (await p.locator('#draft').boundingBox()).width <= 390);
  ok('5,000 characters: rows still fit', (await rowsFit(p)).length === 0, JSON.stringify(await rowsFit(p)));
  await p.fill('#draft', '');
  // Save with a pending oversized draft
  await p.fill('#draft', 'q'.repeat(130));
  await p.click('text=Save');
  ok('Save with a too-long pending draft says so and stays', await p.locator('#draft').count() === 1 && (await hint(p)) === 'Items can be up to 120 characters (now 130).', await hint(p));
  await p.fill('#draft', '');
  // item text in h1 of item step is cut at 3 lines and fits
  await p.locator('.row', { hasText: 'eeeee' }).first().click();
  const h1 = await p.evaluate(() => { const e = document.querySelector('.points > h1'); const r = e.getBoundingClientRect(); return { h: r.height, lh: parseFloat(getComputedStyle(e).lineHeight) || 28, right: r.right }; });
  ok('item step: long title is cut at 3 lines', h1.h <= h1.lh * 3 + 6 && h1.right <= 390, JSON.stringify(h1));
  // ---- item step fields
  a = await attrs(p, '#field');
  ok('details field: >=16px, autocapitalize sentences, autocomplete off, spellcheck on', a.fs >= 16 && a.cap === 'sentences' && a.ac === 'off' && a.sp !== 'false' && a.ekh === 'next', JSON.stringify(a));
  await p.fill('#field', 'd'.repeat(201));
  ok('detail: 201 characters shows a message', (await hint(p)) === 'Details can be up to 200 characters (now 201).' && await p.locator('.hint.err').count() === 1, await hint(p));
  await L.back(p);
  ok('detail: Back is blocked while over the limit', await p.locator('#field').count() === 1);
  await p.press('#field', 'Escape');
  ok('detail: Escape is blocked too', await p.locator('#field').count() === 1);
  await p.fill('#field', 'd'.repeat(201));
  await p.click('.prop >> text=Quantity');
  ok('detail: the limit message stays visible when the Quantity field is selected', (await hint(p)) === 'Details can be up to 200 characters (now 201).', await hint(p));
  await L.back(p);
  ok('detail: Back still blocked from the Quantity field', await p.locator('#field').count() === 1);
  await p.click('.prop >> text=Details');
  await p.fill('#field', '  ' + 'd'.repeat(200) + '  ');
  ok('detail: spaces around 200 characters are not counted', await p.locator('.hint.err').count() === 0);
  await L.back(p);
  ok('detail: exactly 200 characters accepted', await p.locator('#draft').count() === 1);
  await p.locator('.row', { hasText: 'eeeee' }).first().click();
  await p.click('.prop >> text=Quantity');
  a = await attrs(p, '#field');
  ok('formula field: spellcheck false, autocapitalize none, autocomplete off, >=16px', a.sp === 'false' && a.cap === 'none' && a.ac === 'off' && a.fs >= 16 && a.ekh === 'done', JSON.stringify(a));
  await p.fill('#field', '1+'.repeat(61));
  ok('formula over 120 characters shows a message', (await hint(p)) === 'Quantities can be up to 120 characters (now 122).', await hint(p));
  await L.back(p);
  ok('formula: Back blocked while over', await p.locator('#field').count() === 1);
  await p.fill('#field', '');
  await L.back(p);
  await p.click('text=Cancel');

  // ---- save paths with legacy / imported values
  await L.edit(p, 'Big');
  await p.click('text=Save');
  ok('85 points: Save refused with a message that says how many to remove', (await hint(p)) === 'A checklist can have up to 80 points. Remove 5.', await hint(p));
  ok('85 points: still in the editor', await p.locator('#draft').count() === 1);
  for (let i = 0; i < 5; i++) await p.locator('.row .x').first().click();
  await p.click('text=Save');
  ok('after removing 5 the checklist saves', await p.locator('#new').count() === 1);
  await L.edit(p, 'word word');
  await p.click('text=Save');
  ok('legacy 69-char title: Save refused, tells how to fix', (await hint(p)).startsWith('Names can be up to 60 characters (now 69).') && (await hint(p)).includes('Tap the name'), await hint(p));
  await p.click('.points > h1');
  await p.fill('#title', 'Short'); await p.press('#title', 'Enter'); await p.click('#fb-next');
  await p.click('text=Save');
  ok('after shortening the name it saves', await p.locator('#new').count() === 1);
  await L.edit(p, 'LD');
  await p.click('text=Save');
  ok('legacy 250-char detail: Save refused naming the item', (await hint(p)).startsWith('"a": Details can be up to 200'), await hint(p));
  await p.locator('.row').first().click();
  ok('item step shows the detail limit message', (await hint(p)).includes('Details can be up to 200'));
  await p.fill('#field', 'ok'); await L.back(p); await p.click('text=Save');
  ok('after fixing the detail it saves', await p.locator('#new').count() === 1);
  // save with zero points
  await p.click('#new'); await p.keyboard.type('Empty'); await p.keyboard.press('Enter'); await p.click('#fb-next');
  await p.click('text=Save');
  ok('Save with no points says what is missing', (await hint(p)) === 'Add at least one point.' && await p.locator('#draft').count() === 1, await hint(p));
  await p.click('text=Cancel');

  // ---- 80 points through the UI incl. pending draft
  await p.click('#new'); await p.keyboard.type('Eighty'); await p.keyboard.press('Enter'); await p.click('#fb-next');
  for (let i = 1; i <= 80; i++) { await p.fill('#draft', 'P' + i); await p.press('#draft', 'Enter'); }
  ok('80 points accepted', (await items()).length === 80);
  await p.fill('#draft', 'P81'); await p.press('#draft', 'Enter');
  ok('81st refused with a message', (await items()).length === 80 && (await hint(p)) === 'A checklist can have up to 80 points.', await hint(p));
  await p.click('text=Save');
  ok('Save with a pending 81st point refuses', await p.locator('#draft').count() === 1 && (await hint(p)).startsWith('A checklist can have up to 80 points.'), await hint(p));
  await p.fill('#draft', '');
  await p.click('text=Save');
  ok('80 points save', await p.locator('#new').count() === 1);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('checklists')).find(l => l.title === 'Eighty').items.length);
  ok('80 points stored', saved === 80, saved);

  // ---- questions: limit 12, odd text, field attributes
  await L.edit(p, 'Qs');
  await p.click('text=Questions');
  await p.click('#add-question'); await p.click('#type-yesno');
  a = await attrs(p, '#qdraft');
  ok('question field: spellcheck false, autocapitalize none, autocomplete off, >=16px', a.sp === 'false' && a.cap === 'none' && a.ac === 'off' && a.fs >= 16, JSON.stringify(a));
  await p.fill('#qdraft', '😀😀😀'); await p.press('#qdraft', 'Enter');
  ok('question: no letters or digits gives a message', await p.locator('#qdraft').count() === 1 && (await hint(p)) === 'Use at least one letter (a-z) or number in the question.', await hint(p));
  await p.fill('#qdraft', 'word '.repeat(30));
  await p.press('#qdraft', 'Enter');
  ok('question: over 120 characters gives a message', (await hint(p)).startsWith('Questions can be up to 120 characters'), await hint(p));
  await p.fill('#qdraft', '   '); await p.press('#qdraft', 'Enter');
  ok('question: blank does nothing', await p.locator('#qdraft').count() === 1);
  await p.fill('#qdraft', 'I   take  the  bus'); await p.press('#qdraft', 'Enter');
  ok('question: whitespace collapsed in sentence', (await p.textContent('h1')) === 'If I take the bus', await p.textContent('h1'));
  a = await attrs(p, '#qthen');
  ok('then field: sentences, autocomplete off, >=16px', a.cap === 'sentences' && a.ac === 'off' && a.fs >= 16, JSON.stringify(a));
  await p.fill('#qthen', 'z'.repeat(121)); await p.click('text=Done');
  ok('then: over 120 refused, stays', await p.locator('#qthen').count() === 1 && (await hint(p)).startsWith('Items can be up to 120'), await hint(p));
  await p.fill('#qthen', '  Ticket   card  '); await p.click('text=Done');
  await L.back(p); 
  ok('linked item stored trimmed', (await items()).includes('Ticket card'));
  await p.click('text=Questions');
  for (let i = 3; i <= 12; i++) {
    await p.click('#add-question'); await p.click('#type-yesno'); await p.fill('#qdraft', 'topic' + String.fromCharCode(96 + i)); await p.press('#qdraft', 'Enter'); await p.click('text=Done');
  }
  ok('12 questions exist', await p.locator('.stack > div').count() === 12, await p.locator('.stack > div').count());
  ok('12 questions: page does not scroll and stack scrolls or fits', await L.noPageScroll(p));
  await p.click('#add-question');
  ok('13th question refused with a message', (await hint(p)) === 'A checklist can have up to 12 questions.' && await p.locator('#type-yesno').count() === 0, await hint(p));
  ok('message is error style', await p.locator('.hint.err').count() === 1);
  await p.locator('.stack > div').first().locator('.x').click();
  await p.click('#add-question');
  ok('after deleting one a question can be added again', await p.locator('#type-yesno').count() === 1);
  await L.summary();
})().catch(e => { console.log('FAIL exception', e.stack); process.exit(1); });
