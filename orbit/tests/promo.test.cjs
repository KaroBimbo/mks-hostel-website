const test = require('node:test'); const assert = require('node:assert');
globalThis.window = globalThis;
const P = require('../promo.js');

test('код детерминирован и в формате', () => {
  const d = new Date('2026-08-05T18:00:00Z');
  assert.equal(P.codeFor(d), P.codeFor(new Date('2026-08-05T02:00:00Z'))); // один день = один код
  assert.match(P.codeFor(d), /^ORBIT-[ABCEHKMPTXY23456789]{4}$/);
  assert.notEqual(P.codeFor(d), P.codeFor(new Date('2026-08-06T18:00:00Z')));
});
test('ics: CRLF, обязательные поля', () => {
  const s = P.ics({ start: new Date('2026-08-05T18:47:00Z'), end: new Date('2026-08-05T18:53:00Z'), title: 'МКС в вашем небе' });
  assert.ok(s.includes('\r\n')); assert.ok(/DTSTART:20260805T184700Z?/.test(s));
  assert.ok(s.startsWith('BEGIN:VCALENDAR') && s.endsWith('END:VCALENDAR'));
});
test('состояния кнопки', () => {
  const pass = { rise: new Date('2026-08-05T18:47:00Z'), set: new Date('2026-08-05T18:53:00Z') };
  assert.equal(P.buttonState(new Date('2026-08-05T17:00:00Z'), pass), 'waiting');
  assert.equal(P.buttonState(new Date('2026-08-05T18:45:30Z'), pass), 'open'); // за 2 мин уже открыта
  assert.equal(P.buttonState(new Date('2026-08-05T18:50:00Z'), pass), 'open');
  assert.equal(P.buttonState(new Date('2026-08-05T19:00:00Z'), pass), 'passed');
  assert.equal(P.buttonState(new Date(), null), 'waiting');
});
