const test = require('node:test'); const assert = require('node:assert');
globalThis.window = globalThis;
require('../tle-fallback.js');
const IssCore = require('../iss-core.js');
const F = globalThis.ORBIT_TLE_FALLBACK;

test('TLE парсится', () => { assert.equal(IssCore.setTle(F.l1, F.l2), true); });

test('текущая позиция физична', () => {
  IssCore.setTle(F.l1, F.l2);
  const p = IssCore.current(new Date());
  assert.ok(Math.abs(p.lat) <= 52.5, 'широта в пределах наклонения');
  assert.ok(p.lon >= -180 && p.lon <= 180);
  assert.ok(p.altKm > 350 && p.altKm < 480, 'высота ~420 км: ' + p.altKm);
  assert.ok(p.velKms > 7 && p.velKms < 8.2, 'скорость ~7.66: ' + p.velKms);
});

test('трек за виток замыкает полный оборот по долготе', () => {
  IssCore.setTle(F.l1, F.l2);
  const tr = IssCore.groundTrack(new Date(), 93, 30);
  assert.ok(tr.length > 180);
  const lats = tr.map(p => p.lat);
  assert.ok(Math.max(...lats) > 45 && Math.min(...lats) < -45, 'синусоида до ±51.6');
});

test('проходы над Петербургом: 2–9 за сутки, rise<peak<set', () => {
  IssCore.setTle(F.l1, F.l2);
  const ps = IssCore.predictPasses({ lat: 59.95, lon: 30.3 }, new Date(), 24);
  assert.ok(ps.length >= 2 && ps.length <= 9, 'passes=' + ps.length);
  for (const p of ps) {
    assert.ok(p.rise < p.peak && p.peak < p.set);
    assert.ok(p.maxElev > 0 && p.maxElev <= 55, 'для СПб maxElev<~55: ' + p.maxElev);
    assert.ok((p.set - p.rise) / 60000 < 15, 'проход короче 15 мин');
  }
});
