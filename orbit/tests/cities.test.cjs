const test = require('node:test'); const assert = require('node:assert');
globalThis.window = globalThis;
require('../cities.js');
const C = globalThis.OrbitCities;
test('находит ключевые города по-русски и по-английски', () => {
  for (const q of ['мурманск', 'владивосток', 'moscow', 'beijing', 'санкт-петербург']) {
    const hit = C.find(q);
    assert.ok(hit, 'не найден: ' + q);
    assert.ok(Math.abs(hit.lat) <= 90 && Math.abs(hit.lon) <= 180);
  }
});
test('мусор не находит', () => { assert.equal(C.find('щщщ12'), null); });
