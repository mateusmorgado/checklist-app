// Rendered-page audits. Usage: const A = require('<scratchpad>/audit.cjs'); await A.contrast(page); await A.targets(page); await A.overflow(page);
// contrast(page): every visible text node vs its effective background (alpha composited up the ancestor chain).
//   Elements whose background involves an image/gradient are returned in `unknown` (check by screenshot sampling).
// targets(page): every interactive element's rendered box (CSS px); reports those below 48 (soft) and 24 (hard).
// overflow(page): page scroll (must be none), elements sticking out of the viewport, clipped text candidates.
exports.contrast = (page) => page.evaluate(() => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (top, bot) => { const a = top[3] + bot[3] * (1 - top[3]); if (a === 0) return [0, 0, 0, 0]; return [0, 1, 2].map(i => (top[i] * top[3] + bot[i] * bot[3] * (1 - top[3])) / a).concat(a); };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };
  const out = [], unknown = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.trim(); if (!t) continue;
    const el = n.parentElement; if (!el) continue;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || cs.display === 'none' || r.width === 0 || r.height === 0) continue;
    let op = 1, e = el; while (e) { op *= parseFloat(getComputedStyle(e).opacity); e = e.parentElement; }
    let fg = parse(cs.color); fg = [fg[0], fg[1], fg[2], fg[3] * op];
    let bg = [0, 0, 0, 0], img = false; e = el;
    const layers = [];
    while (e) { const s = getComputedStyle(e); if (s.backgroundImage && s.backgroundImage !== 'none') img = true; layers.push(parse(s.backgroundColor)); e = e.parentElement; }
    let acc = [0, 0, 0, 0]; for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc);
    const html = parse(getComputedStyle(document.documentElement).backgroundColor); acc = over(acc, html[3] ? html : [255, 255, 255, 1]);
    const bgc = [acc[0], acc[1], acc[2]];
    const fgc = over(fg, [acc[0], acc[1], acc[2], 1]);
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const rec = { text: t.slice(0, 40), fg: fgc.slice(0, 3).map(Math.round).join(','), bg: bgc.map(Math.round).join(','), ratio: Math.round(ratio(fgc, bgc) * 100) / 100, size, weight, need: large ? 3 : 4.5 };
    rec.pass = rec.ratio >= rec.need;
    (img ? unknown : out).push(rec);
  }
  return { checked: out.length, failures: out.filter(x => !x.pass), worst: out.slice().sort((a, b) => a.ratio / a.need - b.ratio / b.need).slice(0, 5), unknown };
});
exports.targets = (page, soft = 48, hard = 24) => page.evaluate(([soft, hard]) => {
  const els = [...document.querySelectorAll('button, a[href], input, select, textarea, [role=checkbox], [role=radio], [role=button], .row')];
  const rows = [];
  for (const el of els) {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    rows.push({ el: (el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).split(' ').join('.')).slice(0, 50), text: (el.textContent || el.value || el.placeholder || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) });
  }
  return { checked: rows.length, belowSoft: rows.filter(x => x.w < soft || x.h < soft), belowHard: rows.filter(x => x.w < hard || x.h < hard) };
}, [soft, hard]);
exports.overflow = (page) => page.evaluate(() => {
  const de = document.documentElement, W = innerWidth, H = innerHeight;
  const out = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('.settings-scroll, .refs, .stack')) { if (r.right > W + 1 || r.left < -1) out.push({ el: el.tagName + '.' + el.className, left: Math.round(r.left), right: Math.round(r.right), why: 'horizontal' }); continue; }
    if (r.right > W + 1 || r.left < -1 || r.bottom > H + 1 || r.top < -1) out.push({ el: el.tagName + '.' + el.className, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), why: 'outside viewport' });
  }
  const clipped = [];
  for (const el of document.body.querySelectorAll('*')) { const cs = getComputedStyle(el); if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) clipped.push({ el: el.tagName + '.' + el.className, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }); }
  return { pageScrolls: de.scrollHeight > H || de.scrollWidth > W, scrollHeight: de.scrollHeight, innerHeight: H, scrollWidth: de.scrollWidth, innerWidth: W, outside: out.slice(0, 12), horizontallyClipped: clipped.slice(0, 8) };
});
