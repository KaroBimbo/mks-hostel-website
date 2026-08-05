// node orbit/tools/promo-list.cjs 2026-09 -> коды на месяц
globalThis.window = globalThis;
const P = require('../promo.js');
const [y, m] = (process.argv[2] || new Date().toISOString().slice(0, 7)).split('-').map(Number);
for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
  const date = new Date(Date.UTC(y, m - 1, d));
  console.log(date.toISOString().slice(0, 10), P.codeFor(date));
}
