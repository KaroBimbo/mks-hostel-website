const test = require('node:test'); const assert = require('node:assert');
globalThis.window = globalThis;
const OrbitSun = require('../sun.js');

test('равноденствие: склонение около нуля', () => {
  const s = OrbitSun.subsolar(new Date(Date.UTC(2026, 2, 20, 12, 0)));
  assert.ok(Math.abs(s.lat) < 2, 'lat=' + s.lat);
});
test('июньское солнцестояние: около +23.4', () => {
  const s = OrbitSun.subsolar(new Date(Date.UTC(2026, 5, 21, 12, 0)));
  assert.ok(Math.abs(s.lat - 23.4) < 1, 'lat=' + s.lat);
});
test('полдень UTC: субсолярная долгота около 0', () => {
  const s = OrbitSun.subsolar(new Date(Date.UTC(2026, 7, 5, 12, 0)));
  assert.ok(Math.abs(s.lon) < 6, 'lon=' + s.lon);
});
test('nightPathD — валидный замкнутый путь', () => {
  const d = OrbitSun.nightPathD(new Date(), 800, 400);
  assert.match(d, /^M[\d. ]+L/); assert.ok(d.endsWith('Z')); assert.ok(d.length > 500);
});
