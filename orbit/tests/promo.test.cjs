const test = require('node:test'); const assert = require('node:assert');
globalThis.window = globalThis;
const P = require('../promo.js');

test('код недельный, детерминирован и в формате', () => {
  // неделя 03.08.2026 (пн) — 09.08.2026 (вс): один код с понедельника по воскресенье
  const mon = new Date('2026-08-03T00:00:00Z');
  const wed = new Date('2026-08-05T18:00:00Z');
  const sun = new Date('2026-08-09T23:59:59Z');
  assert.equal(P.codeFor(mon), P.codeFor(wed));
  assert.equal(P.codeFor(wed), P.codeFor(sun));
  assert.match(P.codeFor(wed), /^ORBIT-[ABCEHKMPTXY23456789]{4}$/);
  assert.notEqual(P.codeFor(sun), P.codeFor(new Date('2026-08-10T00:00:00Z'))); // следующий пн — новый код
  assert.equal(P.weekMonday(wed).toISOString().slice(0, 10), '2026-08-03');
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
