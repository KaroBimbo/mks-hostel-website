(function (root) {
  'use strict';
  var ALPHA = 'ABCEHKMPTXY23456789'; // без похожих символов
  var SALT = 'MKS-ORBIT-2026';
  function codeFor(d) {
    var key = d.toISOString().slice(0, 10) + SALT;
    var hsh = 2166136261;
    for (var i = 0; i < key.length; i++) { hsh ^= key.charCodeAt(i); hsh = Math.imul(hsh, 16777619) >>> 0; }
    var out = '';
    for (var j = 0; j < 4; j++) { out += ALPHA[hsh % ALPHA.length]; hsh = Math.floor(hsh / ALPHA.length); }
    return 'ORBIT-' + out;
  }
  function icsDate(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function esc(s) { return String(s).replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n'); }
  function ics(ev) {
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MKS Hostel//Orbit//RU', 'BEGIN:VEVENT',
      'UID:' + icsDate(ev.start) + '@mkshostel.ru',
      'DTSTAMP:' + icsDate(new Date()), 'DTSTART:' + icsDate(ev.start), 'DTEND:' + icsDate(ev.end),
      'SUMMARY:' + esc(ev.title), 'DESCRIPTION:' + esc(ev.description || ''),
      'LOCATION:' + esc(ev.location || ''), 'BEGIN:VALARM', 'TRIGGER:-PT5M', 'ACTION:DISPLAY',
      'DESCRIPTION:' + esc(ev.title), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }
  function buttonState(now, pass) {
    if (!pass) return 'waiting';
    var t = now.getTime();
    if (t < pass.rise.getTime() - 120000) return 'waiting';
    if (t <= pass.set.getTime()) return 'open';
    return 'passed';
  }
  root.OrbitPromo = { codeFor: codeFor, ics: ics, buttonState: buttonState };
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis.OrbitPromo;
