/* Dumps what the mock actually draws (?dump=1), so it can be compared with docs/design.md and plain-theme.ts. */
(() => {
  const phone = document.querySelector('.phone'), rows = [];
  const seen = new Set();
  const take = (sel, props) => {
    for (const e of phone.querySelectorAll(sel)) {
      const cs = getComputedStyle(e);
      const v = props.map(p => p + '=' + cs[p]).join(' | ');
      const key = sel + v; if (seen.has(key)) continue; seen.add(key);
      rows.push(sel + ' [' + (e.textContent || '').trim().slice(0, 18) + '] ' + v);
    }
  };
  const T = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'];
  take('.label', T); take('.big', T); take('.num', T); take('.mid', T); take('.num small, .mid small, .big small', T);
  take('.note', T); take('.sub', T); take('.btn', [...T, 'backgroundColor', 'borderRadius', 'padding']);
  take('.switch', ['fontSize', 'letterSpacing', 'height']); take('.switch .on', ['backgroundColor', 'color']);
  take('.tile', ['backgroundColor', 'borderRadius', 'padding', 'boxShadow', 'borderTopColor']);
  take('.badge', ['backgroundColor', 'color', 'fontSize']); take('.av', ['backgroundColor', 'color', 'width']);
  take('.plusb', ['backgroundColor', 'width']); take('.round', ['width', 'backgroundColor']);
  take('svg', ['stroke', 'strokeWidth', 'width']);
  const scr = phone.querySelector('.screen'), cs = getComputedStyle(scr);
  rows.push('screen padding=' + cs.padding + ' gap=' + cs.gap + ' phoneW=' + getComputedStyle(phone).width + ' screenInnerW=' + scr.clientWidth);
  for (const r of phone.querySelectorAll('.second .row, .second')) rows.push('second/row W=' + r.clientWidth + ' wrap=' + getComputedStyle(r).flexWrap);
  const tiles = [...phone.querySelectorAll('.screen > *')].map(e => e.getBoundingClientRect());
  rows.push('heights=' + tiles.map(r => Math.round(r.height)).join(',') + ' screenTop=' + Math.round(scr.getBoundingClientRect().top) + ' phoneH=' + Math.round(phone.getBoundingClientRect().height) + ' padB=' + cs.paddingBottom);
  rows.push('vertical gaps=' + tiles.slice(1).map((r, i) => Math.round(r.top - tiles[i].bottom)).join(','));
  const pre = document.createElement('pre'); pre.id = 'measure'; pre.style.display = 'none'; pre.textContent = rows.join('\n');
  document.body.append(pre);
})();
