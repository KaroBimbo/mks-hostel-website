// Живая орбита — каркас: карта, терминатор, огни городов, станция, трасса, факты.
// TLE-логика, живой пересчёт города/сигнала/промокода и аналитика — Task 7.
(function () {
  'use strict';

  var TLE_CACHE_KEY = 'orbit_tle';
  var TLE_CACHE_MS = 24 * 3600000;
  var TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
  var VIEW_Y0 = 30; // соответствует viewBox карты "0 30 800 300"
  var VIEW_H = 300;

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function worldSize() {
    var W = window.ORBIT_WORLD;
    return { w: (W && W.w) || 800, h: (W && W.h) || 400 };
  }

  function project(lat, lon) {
    var s = worldSize();
    return { x: (lon + 180) / 360 * s.w, y: (90 - lat) / 180 * s.h };
  }

  // ── карта суши ──────────────────────────────────────────────────────
  function drawMap() {
    var land = document.getElementById('orbit-land');
    if (land && window.ORBIT_WORLD && window.ORBIT_WORLD.path) {
      land.setAttribute('d', window.ORBIT_WORLD.path);
    }
  }

  // ── терминатор ──────────────────────────────────────────────────────
  function updateNight() {
    var path = document.getElementById('orbit-night');
    if (!path || !window.OrbitSun) return;
    var s = worldSize();
    path.setAttribute('d', window.OrbitSun.nightPathD(new Date(), s.w, s.h));
  }

  // ── станция и трасса ────────────────────────────────────────────────
  function buildTrackPath(points) {
    var d = '', prevLon = null;
    for (var i = 0; i < points.length; i++) {
      var pt = points[i];
      var p = project(pt.lat, pt.lon);
      if (prevLon === null || Math.abs(pt.lon - prevLon) > 180) {
        d += 'M' + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
      } else {
        d += 'L' + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
      }
      prevLon = pt.lon;
    }
    return d;
  }

  function updateStation() {
    if (!window.IssCore) return;
    var now = new Date();
    var g = document.getElementById('orbit-iss');
    if (g) {
      var pos = window.IssCore.current(now);
      if (pos) {
        var p = project(pos.lat, pos.lon);
        g.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
        g.style.display = '';
      } else {
        g.style.display = 'none';
      }
    }
    var track = document.getElementById('orbit-track');
    if (track) {
      var from = new Date(now.getTime() - 46 * 60000);
      var pts = window.IssCore.groundTrack(from, 92, 60);
      track.setAttribute('d', buildTrackPath(pts));
    }
  }

  // ── TLE: фолбэк сразу, затем кэш/сеть ──────────────────────────────
  function readTleCache() {
    try {
      var raw = window.localStorage && localStorage.getItem(TLE_CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.l1 || !obj.l2 || !obj.ts) return null;
      if (Date.now() - obj.ts > TLE_CACHE_MS) return null;
      return obj;
    } catch (e) { return null; }
  }

  function writeTleCache(l1, l2) {
    try {
      if (window.localStorage) {
        localStorage.setItem(TLE_CACHE_KEY, JSON.stringify({ l1: l1, l2: l2, ts: Date.now() }));
      }
    } catch (e) {}
  }

  function fetchLiveTle() {
    if (typeof fetch !== 'function') return;
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 5000) : null;
    fetch(TLE_URL, ctrl ? { signal: ctrl.signal } : undefined).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.text();
    }).then(function (txt) {
      if (timer) clearTimeout(timer);
      var lines = txt.split(/\r?\n/).filter(function (s) { return s.trim().length > 0; });
      var l1 = null, l2 = null;
      for (var i = 0; i < lines.length; i++) {
        if (!l1 && lines[i].indexOf('1 ') === 0) l1 = lines[i];
        else if (!l2 && lines[i].indexOf('2 ') === 0) l2 = lines[i];
      }
      if (l1 && l2 && window.IssCore && window.IssCore.setTle(l1, l2)) {
        writeTleCache(l1, l2);
      }
      // если setTle вернул false — остаёмся на уже установленном фолбэке
    }).catch(function () {
      if (timer) clearTimeout(timer);
      // сеть недоступна/таймаут — остаёмся на фолбэке
    });
  }

  function initTle() {
    var F = window.ORBIT_TLE_FALLBACK;
    if (F && window.IssCore) window.IssCore.setTle(F.l1, F.l2);
    var cached = readTleCache();
    if (cached && window.IssCore) {
      window.IssCore.setTle(cached.l1, cached.l2);
      return;
    }
    fetchLiveTle();
  }

  // ── огни городов на canvas ──────────────────────────────────────────
  function initLights() {
    var canvas = document.getElementById('orbit-canvas');
    var cities = window.ORBIT_CITIES;
    if (!canvas || !cities || !cities.length) return;
    var ctx = canvas.getContext('2d');
    var s = worldSize();
    var pts = new Array(cities.length);
    for (var i = 0; i < cities.length; i++) {
      var c = cities[i];
      pts[i] = {
        x: (c[3] + 180) / 360 * s.w,
        y: (90 - c[2]) / 180 * s.h,
        r: 0.6 + (i % 7) / 6 * 1.0,
        phase: i % 4,
        night: 0
      };
    }

    var reduced = reducedMotion();
    var scale = 1, dpr = window.devicePixelRatio || 1;
    var PERIOD = [2600, 3400, 2100, 3900];
    var OFFSET = [0, 800, 1400, 400];

    function resize() {
      var rect = canvas.parentElement.getBoundingClientRect();
      if (!rect.width) return;
      scale = rect.width / s.w;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round((rect.width * (VIEW_H / s.w)) * dpr));
    }

    function recomputeNight() {
      var sub = window.OrbitSun ? window.OrbitSun.subsolar(new Date()) : { lon: 0 };
      for (var i = 0; i < pts.length; i++) {
        var lon = cities[i][3];
        var diff = Math.abs(((lon - sub.lon + 540) % 360) - 180); // 0..180
        var t = (diff - 75) / 30; // ширина размытия 75..105
        pts[i].night = t <= 0 ? 0 : (t >= 1 ? 1 : t);
      }
    }

    var BUCKETS = 16; // квантуем прозрачность, чтобы не менять fillStyle на каждую точку
    var buckets = [];
    for (var bi = 0; bi <= BUCKETS; bi++) buckets.push([]);

    function draw(t) {
      if (!canvas.width || !canvas.height) return;
      for (var bi2 = 0; bi2 <= BUCKETS; bi2++) buckets[bi2].length = 0;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (p.night <= 0) continue;
        var twk = reduced ? 0.62 :
          0.30 + 0.65 * (0.5 + 0.5 * Math.sin((t + OFFSET[p.phase]) / PERIOD[p.phase] * 2 * Math.PI));
        var op = p.night * twk;
        if (op <= 0.03) continue;
        var b = Math.round(op * BUCKETS);
        buckets[b].push(p);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var k = dpr * scale;
      ctx.setTransform(k, 0, 0, k, 0, -VIEW_Y0 * k);
      for (var b2 = 1; b2 <= BUCKETS; b2++) {
        var group = buckets[b2];
        if (!group.length) continue;
        ctx.fillStyle = 'rgba(255,201,122,' + (b2 / BUCKETS).toFixed(2) + ')';
        for (var j = 0; j < group.length; j++) {
          var gp = group[j];
          ctx.fillRect(gp.x - gp.r, gp.y - gp.r, gp.r * 2, gp.r * 2);
        }
      }
    }

    resize();
    recomputeNight();
    window.addEventListener('resize', resize);
    setInterval(recomputeNight, 60000);

    if (reduced) {
      draw(0);
    } else {
      var FRAME_MS = 1000 / 24; // throttle: мерцание не требует 60fps
      var last = 0;
      (function loop(ts) {
        if (ts - last >= FRAME_MS) { last = ts; draw(ts); }
        requestAnimationFrame(loop);
      })(0);
    }
  }

  // ── факты по одному ─────────────────────────────────────────────────
  function initFacts() {
    var el = document.getElementById('orbit-fact');
    var I18N = window.ORBIT_I18N;
    var facts = I18N && I18N.facts;
    if (!el || !facts || !facts.length) return;
    var i = 0;
    el.textContent = facts[0];
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('show'); });
    });
    setInterval(function () {
      el.classList.remove('show');
      setTimeout(function () {
        i = (i + 1) % facts.length;
        el.textContent = facts[i];
        el.classList.add('show');
      }, 500);
    }, 6000);
  }

  // ── единая точка входа ──────────────────────────────────────────────
  function init() {
    var root = document.getElementById('orbit');
    if (!root) return;
    initTle();
    drawMap();
    updateNight();
    setInterval(updateNight, 60000);
    updateStation();
    setInterval(updateStation, 5000);
    initLights();
    initFacts();
  }

  init();
})();
