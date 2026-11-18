/* Design rule checker for plain.html (run with ?check=1). Checks the owner's saved rules on the rendered screen and
   writes every break into <pre id="rulecheck"> as JSON lines, so the checker, not the owner, finds them.
   Rules: text never coloured; colour only on surfaces, at most two colours; no bars; nothing cut off or squashed;
   no lone word or unit on its own line in a number; readable sizes and contrast; every label has its icon;
   Today (Activity) never scrolls. */
(() => {
  const out = [];
  const add = (rule, el, detail) => out.push({ rule, where: (el && (el.closest('.tile')?.querySelector('.label')?.textContent || el.className || el.tagName)) || '', text: (el?.textContent || '').trim().slice(0, 40), detail });
  const rgb = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const hsl = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: (h * 60 + 360) % 360, s, l }; };
  const lum = ({ r, g, b }) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const mix = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const bgOf = el => { const stack = []; for (let e = el; e && e !== document.body; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0) stack.push(c); if (c && c.a >= .99) break; }
    let base = { r: 240, g: 240, b: 241, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) base = mix(stack[i], base); return base; };
  const phone = document.querySelector('.phone'); const P = phone.getBoundingClientRect();
  const isActivity = phone.classList.contains('roomy');
  const textEls = [...phone.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && !e.closest('.status, .cap'));

  for (const e of textEls) {
    const cs = getComputedStyle(e), c = rgb(cs.color); if (!c) continue;
    const { s, l } = hsl(c);
    if (s > .18 && l < .92) add('Text must never take colour', e, cs.color);
    const size = parseFloat(cs.fontSize);
    if (size < 11) add('Words too small to read (under 11 px)', e, size + 'px');
    const bg = bgOf(e), L1 = lum(c), L2 = lum(bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const need = size >= 18 || (size >= 14 && +cs.fontWeight >= 600) ? 3 : 4.5;
    if (ratio < need) add('Low contrast (hard to read)', e, ratio.toFixed(2) + ' < ' + need);
    if (e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis') add('Text cut off', e, e.scrollWidth + ' > ' + e.clientWidth);
  }
  // Numbers: one line each; a unit may move down whole, but never a lone letter or the number split.
  for (const e of phone.querySelectorAll('.big, .num, .mid')) {
    const lh = parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2;
    const lines = Math.round(e.getBoundingClientRect().height / lh);
    if (lines > 1) { const sm = e.querySelector('small'); const lone = sm && sm.getBoundingClientRect().width < 20;
      if (!sm || lone || e.firstChild.textContent.trim().includes(' ')) add('Number or unit breaks onto a second line', e, lines + ' lines'); }
  }
  // Nothing sticks out of its tile or the phone sides; tiles not squashed.
  for (const t of phone.querySelectorAll('.tile')) {
    const T = t.getBoundingClientRect();
    for (const k of t.querySelectorAll('*')) { const K = k.getBoundingClientRect(); if (!K.width) continue;
      if (K.right > T.right + 1 || K.left < T.left - 1 || K.bottom > T.bottom + 1) { add('Sticks out of its tile', k, `${Math.round(K.right - T.right)}px right, ${Math.round(K.bottom - T.bottom)}px down`); break; } }
    if (t.scrollHeight > t.clientHeight + 2) add('Tile squashed, content hidden', t, t.scrollHeight + ' > ' + t.clientHeight);
  }
  for (const e of phone.querySelectorAll('.screen *')) { const R = e.getBoundingClientRect(); if (R.width && (R.right > P.right + 1 || R.left < P.left - 1)) { add('Runs off the side of the phone', e, ''); break; } }
  const last = [...phone.querySelectorAll('.screen > *')].filter(e => e.getBoundingClientRect().height > 0).pop();
  if (isActivity && !phone.classList.contains('lg') && last && last.getBoundingClientRect().bottom <= P.bottom + 1 && last.getBoundingClientRect().bottom > P.bottom - 12) add('Today touches the bottom edge (keep 12 dp)', last, Math.round(P.bottom - last.getBoundingClientRect().bottom) + 'px left');
  if (last && last.getBoundingClientRect().bottom > P.bottom + 1) add(isActivity && !phone.classList.contains('lg') ? 'Today must not scroll' : 'Screen scrolls (allowed off Today and with large text)', last, Math.round(last.getBoundingClientRect().bottom - P.bottom) + 'px below');
  // No bars: thin coloured strips.
  for (const e of phone.querySelectorAll('.screen *')) { const R = e.getBoundingClientRect(), c = rgb(getComputedStyle(e).backgroundColor);
    if (c && c.a > .2 && R.height > 0 && R.height <= 8 && R.width >= 30) add('Tracking bar found (no bars)', e, Math.round(R.width) + 'x' + Math.round(R.height)); }
  // Colour on surfaces: at most two colour families (icons excluded).
  const hues = [];
  for (const e of phone.querySelectorAll('.screen *')) { const c = rgb(getComputedStyle(e).backgroundColor); if (!c || c.a < .15) continue; const { h, s, l } = hsl(c);
    if (s > .12 && l < .97) { if (!hues.some(x => Math.min(Math.abs(x - h), 360 - Math.abs(x - h)) < 30)) hues.push(Math.round(h)); } }
  if (hues.length > 2) add('More than two colours on surfaces', null, 'hues ' + hues.join(', '));
  // Every tile label carries its icon.
  for (const l of phone.querySelectorAll('.tile .label:first-child, .tile .spread:first-child .label:first-child')) if (!l.querySelector('svg')) add('Label without its icon', l, '');
  // ---- Added 18 Nov 2026: one check per rule in .claude/rules/visual-design.md that the lines above did not cover. ----
  const isLg = phone.classList.contains('lg'), isSm = phone.classList.contains('sm');
  const zoomOf = el => { let z = 1; for (let e = el; e; e = e.parentElement) z *= parseFloat(getComputedStyle(e).zoom) || 1; return z; };
  const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const fam = e => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').trim();
  // Smallest text 11 dp as drawn (zoom = the app's scaled() on small phones).
  for (const e of textEls) { const drawn = parseFloat(getComputedStyle(e).fontSize) * zoomOf(e); if (drawn < 10.95) add('Text under 11 dp as drawn', e, drawn.toFixed(2) + 'dp'); }
  // Typography 1: Outfit for figures, labels and the switch; Figtree for words.
  for (const e of phone.querySelectorAll('.big, .num, .mid, .label, .switch')) if (fam(e) !== 'Outfit') add('Figures, labels and switch must be Outfit', e, fam(e));
  for (const e of phone.querySelectorAll('.note, .sub, .btn, .big small, .num small, .mid small')) if (fam(e) !== 'Figtree') add('Words must be Figtree', e, fam(e));
  // Typography 2: one type scale (approved sizes; 12.56 = the 11 dp floor on a small phone). Not checked in the large-text stress test.
  if (!isLg) { const scale = [96, 64, 38, 34, 22, 18, 16, 15, 14, 13, 12, 11.5, 11, 12.56]; // 18 and 16: avatar letters (approved base)
    for (const e of textEls) { if (e.closest('.ground')) continue; const s = parseFloat(getComputedStyle(e).fontSize);
      if (!scale.some(v => Math.abs(v - s) < 0.05)) add('Size not on the type scale', e, s + 'px'); } }
  // Typography 5: labels in capitals. Typography 6: units smaller and grey.
  for (const e of phone.querySelectorAll('.label')) { const t = e.textContent.trim(); if (getComputedStyle(e).textTransform !== 'uppercase' && t !== t.toUpperCase()) add('Label not in capitals', e, ''); }
  for (const u of phone.querySelectorAll('.big small, .num small, .mid small')) { const p = u.parentElement, cu = rgb(getComputedStyle(u).color), cp = rgb(getComputedStyle(p).color);
    if (parseFloat(getComputedStyle(u).fontSize) >= parseFloat(getComputedStyle(p).fontSize)) add('Unit not smaller than its figure', u, '');
    if (lum(cu) <= lum(cp)) add('Unit not grey (lighter than the figure)', u, getComputedStyle(u).color); }
  // Layout 5: an empty ad slot between tiles, mid-Today, a real 50 dp tall.
  if (isActivity) { const ad = phone.querySelector('.screen > .adslot');
    if (!ad) add('No ad space on Today', phone, '');
    else { const A = ad.getBoundingClientRect(), z = parseFloat(getComputedStyle(phone).zoom) || 1, mid = (A.top + A.bottom) / 2, rel = (mid - P.top) / P.height;
      const drawn = Math.abs(A.height - ad.offsetHeight) > .5 ? A.height : ad.offsetHeight * z; if (Math.abs(drawn - 50) > 1) add('Ad space is not 50 dp tall', ad, drawn.toFixed(1) + ' (rect ' + A.height.toFixed(1) + ', offset ' + ad.offsetHeight + ', zoom ' + z + ')');
      if (rel < .35 || rel > .65) add('Ad space is not mid-screen', ad, Math.round(rel * 100) + '% down');
      if (!document.body.classList.contains('admark') && (getComputedStyle(ad).borderTopStyle !== 'none' || ad.innerText.trim())) add('Ad space is not empty', ad, '');
      const sib = [ad.previousElementSibling, ad.nextElementSibling]; if (!sib.every(e => e && (e.classList.contains('tile') || e.classList.contains('pair')))) add('Ad space is not between tiles', ad, ''); } }
  // Layout 4: one gutter, one gap and one corner radius per screen.
  const sc = phone.querySelector('.screen'), scs = getComputedStyle(sc);
  if (parseFloat(scs.paddingLeft) !== 18 || parseFloat(scs.paddingRight) !== 18) add('Gutter is not 18', sc, scs.paddingLeft + ' / ' + scs.paddingRight);
  const wantGap = isActivity && !phone.querySelector('.screen > .adslot') ? 12 : 9; if (parseFloat(scs.rowGap) !== wantGap) add('Tile gap is not ' + wantGap, sc, scs.rowGap);
  for (const t of phone.querySelectorAll('.screen .tile:not(.round)')) if (parseFloat(getComputedStyle(t).borderTopLeftRadius) !== 24) add('Tile corner is not 24', t, getComputedStyle(t).borderTopLeftRadius);
  // Layout 7: no tile inside a tile; soft shadows only.
  for (const t of phone.querySelectorAll('.tile .tile')) add('Tile inside a tile', t, '');
  for (const t of phone.querySelectorAll('.screen .tile')) { const sh = getComputedStyle(t).boxShadow; const m = [...sh.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map(x => +x[1]);
    if (m.some(a => a > .12)) add('Shadow too heavy', t, sh); }
  // Colour 2: sage only on the selected pill, main buttons, the round + and the hero tint; sand only on second tiles, chips, avatars, badges.
  const fam2 = c => { const { h, s, l } = hsl(c); if (s < .08 || l > .985) return null; if (h >= 120 && h <= 180) return 'sage'; if (h >= 15 && h <= 45) return 'sand'; return 'other'; };
  let pills = 0;
  for (const e of phone.querySelectorAll('.screen *, .top *')) { const c = rgb(getComputedStyle(e).backgroundColor); if (!c || c.a < .15 || e.closest('.ground')) continue; const f = fam2(c); if (!f) continue;
    if (f === 'sage') { if (e.matches('.switch .on')) pills++; else if (!e.matches('.hero, .plusb, .btn, .round')) add('Sage on a surface the rules do not allow', e, hex(c)); }
    else if (f === 'sand') { if (!e.matches('.second, .btn, .av, .badge, .chip')) add('Sand on a surface the rules do not allow', e, hex(c)); }
    else add('A colour that is neither sage nor sand', e, hex(c)); }
  if (pills !== 1) add('Exactly one sage pill per screen', null, pills + ' found');
  // Colour 4: no black solids, no shine or gradients on the screen (only the ground wash may have them).
  for (const e of phone.querySelectorAll('.screen, .screen *, .top, .top *')) {
    const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > .5 && hsl(c).l < .15) add('Black solid fill', e, hex(c));
    for (const pseudo of [null, '::before', '::after']) { const bi = getComputedStyle(e, pseudo).backgroundImage; if (bi && bi.includes('gradient')) add('Shine or gradient on the screen', e, (pseudo || '') + ' ' + bi.slice(0, 40)); }
    if (getComputedStyle(e).animationName !== 'none' || getComputedStyle(e, '::after').animationName !== 'none') add('Movement on the screen (only the ground may move)', e, getComputedStyle(e).animationName); }
  // Icons 1: every icon one line style. Icons 2: the approved colour for its kind (PLAIN_ICON_COLOR); the calendar dark.
  const OK_ICON = ['#2F9A68', '#D0614E', '#D9962B', '#E07B39', '#5B5FC7', '#2F86C9', '#E0663A', '#5B6878', '#4C9A52', '#3E7CC4', '#2E918A', '#3E6888', '#7C6CC4', '#B08550', '#C9A23C', '#8E8E93'];
  const labelIcons = [...phone.querySelectorAll('.label svg')];
  for (const s of labelIcons) { const st = rgb(getComputedStyle(s).stroke); if (st && !OK_ICON.includes(hex(st))) add('Icon colour not the approved one', s.closest('.label'), hex(st)); }
  const widths = new Set(labelIcons.map(s => getComputedStyle(s).strokeWidth + '/' + Math.round(s.getBoundingClientRect().width / zoomOf(s))));
  if (widths.size > 1) add('Icons not one line style (stroke/size)', null, [...widths].join(' '));
  const cal = phone.querySelector('.top .round svg'); if (cal) { const st = rgb(getComputedStyle(cal).stroke); if (st && hex(st) !== '#2C2C2E') add('Calendar icon must stay dark', cal, hex(st)); }
  // Icons 3: no emoji.
  for (const e of textEls) if (/\p{Extended_Pictographic}/u.test(e.textContent)) add('Emoji found', e, '');
  // Motion 3: with "Remove animations" on, nothing moves.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { const run = document.getAnimations().filter(a => a.playState === 'running'); if (run.length) add('Moves although the phone asks for no animation', null, run.length + ' running'); }
  const pre = document.createElement('pre'); pre.id = 'rulecheck'; pre.style.display = 'none';
  pre.textContent = out.length ? out.map(o => JSON.stringify(o)).join('\n') : 'ALL RULES PASS';
  document.body.append(pre);
})();
