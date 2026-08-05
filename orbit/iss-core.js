(function (root) {
  'use strict';
  var sat = root.satellite || (typeof require === 'function' ? require('./vendor/satellite.min.js') : null);
  var rec = null;
  function deg(r){ return r * 180 / Math.PI; }
  function normLon(l){ return ((l + 540) % 360) - 180; }
  function geo(d){
    var pv = sat.propagate(rec, d);
    if (!pv.position) return null;
    var gmst = sat.gstime(d), g = sat.eciToGeodetic(pv.position, gmst);
    var v = pv.velocity, vel = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
    return { lat: deg(g.latitude), lon: normLon(deg(g.longitude)), altKm: g.height, velKms: vel };
  }
  function elevAz(obs, d){
    var pv = sat.propagate(rec, d);
    if (!pv.position) return null;
    var gmst = sat.gstime(d);
    var op = { latitude: obs.lat*Math.PI/180, longitude: obs.lon*Math.PI/180, height: 0.05 };
    var ecf = sat.eciToEcf(pv.position, gmst);
    var la = sat.ecfToLookAngles(op, ecf);
    return { elev: deg(la.elevation), az: deg(la.azimuth) };
  }
  function refine(obs, t0, t1, rising){ // бинарный поиск нуля elevation до 1 с
    var a = t0.getTime(), b = t1.getTime();
    while (b - a > 1000) {
      var m = (a + b) / 2, e = elevAz(obs, new Date(m)).elev;
      if ((e > 0) === rising) b = m; else a = m;
    }
    return new Date(b);
  }
  root.IssCore = {
    setTle: function (l1, l2) {
      try { var r = sat.twoline2satrec(l1, l2); if (r.error) return false; rec = r; return true; }
      catch (e) { return false; }
    },
    current: function (d) { return geo(d || new Date()); },
    groundTrack: function (from, minutes, stepSec) {
      var out = [], n = Math.floor(minutes * 60 / stepSec);
      for (var i = 0; i <= n; i++) {
        var t = new Date(from.getTime() + i * stepSec * 1000), g = geo(t);
        if (g) out.push({ lat: g.lat, lon: g.lon, t: t });
      }
      return out;
    },
    predictPasses: function (obs, from, hours) {
      var passes = [], step = 30000, end = from.getTime() + hours * 3600000;
      var prev = elevAz(obs, from), rise = null, best = null;
      for (var t = from.getTime() + step; t <= end; t += step) {
        var d = new Date(t), cur = elevAz(obs, d);
        if (!cur) continue;
        if (prev.elev <= 0 && cur.elev > 0) { rise = refine(obs, new Date(t - step), d, true); best = { elev: -90 }; }
        if (rise && cur.elev > best.elev) best = { elev: cur.elev, az: cur.az, at: d };
        if (rise && prev.elev > 0 && cur.elev <= 0) {
          var setT = refine(obs, new Date(t - step), d, false);
          passes.push({ rise: rise, peak: best.at, set: setT,
            riseAz: elevAz(obs, rise).az, peakAz: best.az, setAz: elevAz(obs, setT).az,
            maxElev: best.elev });
          rise = null;
        }
        prev = cur;
      }
      return passes;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis.IssCore;
