const test = require('node:test'); const assert = require('node:assert');
globalThis.window = globalThis;
require('../tle-fallback.js');
const IssCore = require('../iss-core.js');

test('до setTle методы не падают и возвращают пусто', () => {
  assert.equal(IssCore.current(new Date()), null);
  assert.deepEqual(IssCore.groundTrack(new Date(), 10, 60), []);
  assert.deepEqual(IssCore.predictPasses({ lat: 0, lon: 0 }, new Date(), 1), []);
});

test('мусорный TLE отклоняется', () => {
  assert.equal(IssCore.setTle('garbage', 'garbage'), false);
  assert.equal(IssCore.setTle('', ''), false);
  assert.equal(IssCore.setTle('1 x', '2 y'), false);
  assert.equal(IssCore.current(new Date()), null, 'после мусора состояние не заведено');
});

test('валидный TLE после мусора принимается', () => {
  const F = globalThis.ORBIT_TLE_FALLBACK;
  assert.equal(IssCore.setTle(F.l1, F.l2), true);
  assert.ok(IssCore.current(new Date()).altKm > 350);
});
