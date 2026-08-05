// node orbit/tools/promo-list.cjs 2026-09 -> недельные коды, покрывающие месяц
globalThis.window = globalThis;
const P = require('../promo.js');
const [y, m] = (process.argv[2] || new Date().toISOString().slice(0, 7)).split('-').map(Number);
const fmt = (d) => String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0');
const seen = new Set();
for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
  const mon = P.weekMonday(new Date(Date.UTC(y, m - 1, d)));
  const key = mon.toISOString().slice(0, 10);
  if (seen.has(key)) continue;
  seen.add(key);
  const sun = new Date(mon.getTime() + 6 * 86400000);
  console.log('пн ' + fmt(mon) + ' — вс ' + fmt(sun) + '   ' + P.codeFor(mon));
}
