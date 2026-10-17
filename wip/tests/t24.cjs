const { chromium } = require('./pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  let fails = 0; const ok = (n, c, x='') => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, x); };
  for (const [w, h] of [[390, 780], [360, 560]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', e => console.log('PAGEERR', e.message));
    await p.route('https://cdnjs.cloudflare.com/**', r => { const u=r.request().url(); const f = u.includes('react-dom') ? 'react-dom/umd/react-dom.production.min.js' : 'react/umd/react.production.min.js'; r.fulfill({ path: process.cwd()+'/pw/node_modules/'+f, contentType:'text/javascript' }); });
    await p.goto('file:///home/user/checklist-app/index.html');
    await p.click('text=+ New'); await p.keyboard.type('Gym'); await p.keyboard.press('Enter');
    const hint = await p.textContent('.hint');
    ok(`[${w}] settings hint in APA`, hint === 'When you tick an item: the Confirmation cue repeats the item out loud (MacLeod et al., 2010). The Attention tone plays a short sound to keep you focused on the task (Posner & Petersen, 1990).', hint);
    await p.click('#fb-refs');
    const t = await p.evaluate(() => document.querySelector('.refs-in').innerText);
    const items = await p.evaluate(() => [...document.querySelectorAll('.refs-in li')].map(l => l.innerText.replace(/\s+/g, ' ')));
    if (w === 390) console.log(items.join('\n'));
    ok(`[${w}] no ABNT leftovers`, !/MACLEOD|POSNER|SÖDERLUND|DEGANI|NIGG|Bibliography| et al\.;|;\s*PETERSEN/.test(t), '');
    for (const k of ['(MacLeod et al., 2010)', '(Degani & Wiener, 1993)', '(Posner & Petersen, 1990)', '(Nigg et al., 2024; Söderlund et al., 2007)', '(Söderlund et al., 2007)', '(Szalma & Hancock, 2011)', 'Reference list']) ok(`[${w}] text has ${k}`, t.includes(k));
    ok(`[${w}] six entries, alphabetical`, items.length === 6 && JSON.stringify(items.map(i => i.split(',')[0])) === JSON.stringify(['Degani','MacLeod','Nigg','Posner','Söderlund','Szalma']), items.map(i => i.split(',')[0]).join('|'));
    ok(`[${w}] APA format of a full entry`, items[1] === 'MacLeod, C. M., Gopie, N., Hourihan, K. L., Neary, K. R., & Ozubko, J. D. (2010). The production effect: Delineation of a phenomenon. Journal of Experimental Psychology: Learning, Memory, and Cognition, 36(3), 671–685. https://doi.org/10.1037/a0018785', items[1]);
    ok(`[${w}] entry with no DOI has none`, items[0] === 'Degani, A., & Wiener, E. L. (1993). Cockpit checklists: Concepts, design, and use. Human Factors, 35(2), 28–43.' && items[3] === 'Posner, M. I., & Petersen, S. E. (1990). The attention system of the human brain. Annual Review of Neuroscience, 13, 25–42.', items[0]);
    ok(`[${w}] title ending in ? has no extra period`, items[2].includes('elevated attention problems? Journal of the American') , items[2].slice(150, 260));
    ok(`[${w}] italics on journal + volume`, await p.evaluate(() => [...document.querySelectorAll('.refs-in li em')].map(e => e.textContent).join('|') === 'Human Factors, 35|Journal of Experimental Psychology: Learning, Memory, and Cognition, 36|Journal of the American Academy of Child and Adolescent Psychiatry, 63|Annual Review of Neuroscience, 13|Journal of Child Psychology and Psychiatry, 48|Psychological Bulletin, 137'));
    ok(`[${w}] four DOI links, new tab`, await p.locator('.refs-in a[target=_blank]').count() === 4 && (await p.locator('.refs-in a').first().getAttribute('href')).startsWith('https://doi.org/10.'));
    const m = await p.evaluate(() => { const r = document.querySelector('.refs'); return { page: document.documentElement.scrollHeight === innerHeight, top: Math.round(document.querySelector('.refs-in h1').getBoundingClientRect().top), scrolls: r.scrollHeight > r.clientHeight }; });
    ok(`[${w}] page fixed, heading at top`, m.page && m.top >= 0 && m.top < 60, JSON.stringify(m));
    await p.evaluate(() => { const r = document.querySelector('.refs'); r.scrollTop = r.scrollHeight; });
    ok(`[${w}] last line reachable`, await p.evaluate(() => { const last = [...document.querySelectorAll('.refs-in p')].pop().getBoundingClientRect(), box = document.querySelector('.refs').getBoundingClientRect(); return last.bottom <= box.bottom + 1 && last.top >= box.top; }));
    await p.screenshot({ path: `apa-${w}.png` });
    await p.close();
  }
  console.log('FAILS:', fails);
  await b.close();
})();
