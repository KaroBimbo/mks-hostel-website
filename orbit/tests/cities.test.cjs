const test = require('node:test'); const assert = require('node:assert');
globalThis.window = globalThis;
require('../cities.js');
const C = globalThis.OrbitCities;
test('находит ключевые города по-русски и по-английски', () => {
  for (const q of ['мурманск', 'владивосток', 'moscow', 'beijing', 'berlin', 'санкт-петербург']) {
    const hit = C.find(q);
    assert.ok(hit, 'не найден: ' + q);
    assert.ok(Math.abs(hit.lat) <= 90 && Math.abs(hit.lon) <= 180);
  }
});
test('находит города Беларуси, Казахстана через кириллицу и нерегулярные написания', () => {
  const cities = ['улан-удэ', 'ростов-на-дону'];
  for (const q of cities) {
    const hit = C.find(q);
    assert.ok(hit, 'не найден: ' + q);
    assert.ok(Math.abs(hit.lat) <= 90 && Math.abs(hit.lon) <= 180, 'плохие координаты: ' + q);
  }
});
test('мусор не находит', () => { assert.equal(C.find('щщщ12'), null); });
test('русские областные центры находятся кириллицей', () => {
  const cities = ['тюмень', 'пермь', 'челябинск', 'омск', 'самара', 'уфа', 'воронеж',
    'краснодар', 'иркутск', 'хабаровск', 'псков', 'тверь', 'калуга', 'мурманск',
    'петрозаводск', 'нижний новгород', 'ярославль', 'орёл', 'владивосток',
    'санкт-петербург', 'спб'];
  for (const q of cities) {
    const hit = C.find(q);
    assert.ok(hit, 'не найден: ' + q);
    assert.ok(Math.abs(hit.lat) <= 90 && Math.abs(hit.lon) <= 180, 'плохие координаты: ' + q);
  }
});
