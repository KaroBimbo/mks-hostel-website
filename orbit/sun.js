(function (root) {
  'use strict';
  var RAD = Math.PI / 180;
  function dayOfYear(d) {
    return (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
            Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000;
  }
  function subsolar(d) {
    var N = dayOfYear(d);
    var decl = -23.44 * Math.cos(2 * Math.PI * (N + 10) / 365.24);
    var B = 2 * Math.PI * (N - 81) / 364;
    var eqt = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // минуты
    var utcH = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    var lon = -15 * (utcH - 12 + eqt / 60);
    lon = ((lon + 540) % 360) - 180;
    return { lat: decl, lon: lon };
  }
  function nightPathD(d, w, h) {
    var s = subsolar(d);
    var px = function (lon) { return (lon + 180) / 360 * w; };
    var py = function (lat) { return (90 - lat) / 180 * h; };
    var pts = [];
    for (var lon = -180; lon <= 180; lon += 3) {
      var tanLat = -Math.cos((lon - s.lon) * RAD) / Math.tan(s.lat * RAD || 1e-9);
      pts.push([px(lon), py(Math.atan(tanLat) / RAD)]);
    }
    // ночь лежит с полюса, противоположного знаку склонения
    var edgeY = s.lat >= 0 ? h : 0;
    var dstr = 'M' + pts[0][0].toFixed(1) + ' ' + edgeY;
    for (var i = 0; i < pts.length; i++) dstr += 'L' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1);
    dstr += 'L' + pts[pts.length - 1][0].toFixed(1) + ' ' + edgeY + 'Z';
    return dstr;
  }
  root.OrbitSun = { subsolar: subsolar, nightPathD: nightPathD };
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis.OrbitSun;
