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

  // ── Task 7: город гостя, отсчёты, сигнал, промокод, .ics, Метрика ────
  var HOTEL_OBS = { lat: 59.95, lon: 30.3 };
  var RUMBS = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ']; // фолбэк, если в i18n нет rumbs
  var DEMO = /(?:^|[?&])orbitDemo=1(?:&|$)/.test(window.location.search);
  var LOAD_TIME = new Date();

  var live = {
    hotelPasses: [], hotelPass: null,
    guestObs: null, guestLabel: null, guestPasses: [], guestPass: null,
    caught: false, code: null,
    lastWhereFor: null
  };

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function i18n() { return window.ORBIT_I18N || {}; }

  function goal(name) {
    if (typeof ym === 'function') ym(109025350, 'reachGoal', name);
  }

  function rumb(az) {
    var a = ((az % 360) + 360) % 360;
    var I = i18n();
    var R = (I.rumbs && I.rumbs.length === 8) ? I.rumbs : RUMBS;
    return R[Math.round(a / 45) % 8];
  }

  function fmtClock(d) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function dayWord(d, now) {
    var a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var diff = Math.round((a - b) / 86400000);
    var I = i18n();
    if (diff === 0) return I.today || 'сегодня';
    if (diff === 1) return I.tomorrow || 'завтра';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  }

  function fmtCountdown(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    var hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    return pad2(hh) + ':' + pad2(mm) + ':' + pad2(ss);
  }

  function pluralMin(n) {
    var I = i18n();
    var words = I.minuteWord || { one: 'минуту', few: 'минуты', many: 'минут', other: 'минут' };
    var cat = 'other';
    try {
      cat = new Intl.PluralRules(I.lang || 'ru').select(n);
    } catch (e) {}
    return words[cat] || words.other || words.many || words.few || words.one || '';
  }

  function todayKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function nextPass(passes, now) {
    for (var i = 0; i < passes.length; i++) {
      if (passes[i].set.getTime() >= now.getTime()) return passes[i];
    }
    return null;
  }

  function demoPass() {
    return {
      rise: new Date(LOAD_TIME.getTime() + 30000),
      peak: new Date(LOAD_TIME.getTime() + 60000),
      set: new Date(LOAD_TIME.getTime() + 90000),
      riseAz: 250, peakAz: 200, setAz: 150, maxElev: 45
    };
  }

  function computeHotelPasses() {
    if (!window.IssCore) return;
    live.hotelPasses = window.IssCore.predictPasses(HOTEL_OBS, new Date(), 48);
  }

  function computeGuestPasses() {
    if (!live.guestObs) { live.guestPasses = []; live.guestPass = null; return; }
    if (DEMO) {
      live.guestPasses = [demoPass()];
    } else if (window.IssCore) {
      live.guestPasses = window.IssCore.predictPasses(live.guestObs, new Date(), 48);
    }
  }

  function refreshHotelPass(now) {
    var p = nextPass(live.hotelPasses, now);
    if (!p) { computeHotelPasses(); p = nextPass(live.hotelPasses, now); }
    live.hotelPass = p;
  }

  function refreshGuestPass(now) {
    if (!live.guestObs) { live.guestPass = null; return; }
    if (DEMO) {
      var dp = live.guestPasses[0];
      if (dp && dp.set.getTime() >= now.getTime()) { live.guestPass = dp; return; }
      // фиктивный проход истёк — переходим на настоящий расчёт, чтобы демо не зависало
      if (window.IssCore) live.guestPass = nextPass(window.IssCore.predictPasses(live.guestObs, now, 48), now);
      return;
    }
    var p = nextPass(live.guestPasses, now);
    if (!p) { computeGuestPasses(); p = nextPass(live.guestPasses, now); }
    live.guestPass = p;
  }

  function activePass() {
    return live.guestObs ? live.guestPass : live.hotelPass;
  }

  // ── карта: маркер и линия связи гостя ─────────────────────────────
  function updateGuestMarker() {
    var line = document.getElementById('orbit-guest-line');
    var marker = document.getElementById('orbit-guest-marker');
    if (!live.guestObs) {
      if (line) line.classList.remove('show');
      if (marker) marker.classList.remove('show');
      return;
    }
    var hp = project(HOTEL_OBS.lat, HOTEL_OBS.lon);
    var gp = project(live.guestObs.lat, live.guestObs.lon);
    if (line) {
      line.setAttribute('d', 'M' + hp.x.toFixed(1) + ' ' + hp.y.toFixed(1) + ' L' + gp.x.toFixed(1) + ' ' + gp.y.toFixed(1));
      line.classList.add('show');
    }
    if (marker) {
      marker.setAttribute('transform', 'translate(' + gp.x.toFixed(1) + ' ' + gp.y.toFixed(1) + ')');
      marker.classList.add('show');
      var t = marker.querySelector('text');
      if (t) t.textContent = live.guestLabel || '';
    }
  }

  // ── компас «куда смотреть» ──────────────────────────────────────────
  function updateCompass(pass) {
    var path = document.getElementById('orbit-compass-path');
    var dot = document.getElementById('orbit-compass-dot');
    if (!path || !pass) return;
    var cx = 75, cy = 75, R = 50;
    function pt(az) {
      var rad = az * Math.PI / 180;
      return { x: cx + R * Math.sin(rad), y: cy - R * Math.cos(rad) };
    }
    var rise = pt(pass.riseAz), set = pt(pass.setAz), peak = pt(pass.peakAz);
    var ctrl = { x: 2 * peak.x - 0.5 * (rise.x + set.x), y: 2 * peak.y - 0.5 * (rise.y + set.y) };
    path.setAttribute('d', 'M' + rise.x.toFixed(1) + ',' + rise.y.toFixed(1) +
      ' Q' + ctrl.x.toFixed(1) + ',' + ctrl.y.toFixed(1) + ' ' + set.x.toFixed(1) + ',' + set.y.toFixed(1));
    if (dot) { dot.setAttribute('cx', rise.x.toFixed(1)); dot.setAttribute('cy', rise.y.toFixed(1)); }
  }

  function updateWhere(pass) {
    if (!pass) return;
    var step1 = document.getElementById('orbit-where-step1');
    var step3 = document.getElementById('orbit-where-step3');
    var I = i18n();
    if (step1) {
      var t1 = I.whereStep1 || 'Выйдите на улицу и встаньте лицом на <b>{R}</b> — оттуда она появится.';
      step1.innerHTML = t1.replace('{R}', rumb(pass.riseAz));
    }
    if (step3) {
      var mins = Math.max(1, Math.round((pass.set.getTime() - pass.rise.getTime()) / 60000));
      var t3 = I.whereStep3 || 'Она пройдёт через небо примерно за <b>{M}</b> и растает на стороне <b>{R}</b>.';
      step3.innerHTML = t3.replace('{M}', mins + ' ' + pluralMin(mins)).replace('{R}', rumb(pass.setAz));
    }
    updateCompass(pass);
  }

  // ── карточки отсчёта ────────────────────────────────────────────────
  function renderPassCell(pass, now, clockId, subId) {
    var clockEl = document.getElementById(clockId);
    var subEl = document.getElementById(subId);
    if (!clockEl || !subEl || !pass) return;
    var t = fmtClock(pass.rise).split(':');
    clockEl.innerHTML = (t[0] || '—') + '<span class="col">:</span>' + (t[1] || '—');
    var I = i18n();
    subEl.textContent = dayWord(pass.rise, now) + ' · ' + (I.inTime || 'через') + ' ' + fmtCountdown(pass.rise.getTime() - now.getTime());
  }

  function renderConnect() {
    var el = document.getElementById('orbit-connect');
    if (!el || !live.guestPass || !live.hotelPass) return;
    var I = i18n();
    var msg = (I.connect || '').replace('{A}', fmtClock(live.guestPass.rise)).replace('{B}', fmtClock(live.hotelPass.rise));
    if (msg) el.textContent = msg;
  }

  // ── кнопка сигнала ──────────────────────────────────────────────────
  function updateSignal(now) {
    var btn = document.getElementById('orbit-signal');
    var remindBtn = document.getElementById('orbit-remind');
    var toBooking = document.getElementById('orbit-tobooking');
    if (!btn || !window.OrbitPromo) return;
    var I = i18n();
    var pass = activePass();

    if (remindBtn) remindBtn.disabled = !pass;

    if (live.caught && localStorageGet('orbit_caught') !== todayKey(now)) {
      live.caught = false; live.code = null;
    }

    if (!pass) {
      btn.className = 'sig waiting';
      btn.disabled = true;
      btn.textContent = (I.btnWaiting || 'оживёт в {T}').replace('{T}', '--:--');
      if (toBooking) toBooking.classList.remove('show');
      return;
    }

    if (live.caught) {
      btn.className = 'sig caught';
      btn.disabled = true;
      btn.textContent = (I.btnCaught || 'Промокод: {C}').replace('{C}', live.code || '');
      if (toBooking) toBooking.classList.add('show');
      return;
    }

    var st = window.OrbitPromo.buttonState(now, pass);
    if (st === 'open') {
      btn.className = 'sig';
      btn.disabled = false;
      btn.textContent = I.btnOpen || '📡 ПОЙМАТЬ СИГНАЛ';
    } else {
      btn.className = 'sig waiting';
      btn.disabled = true;
      btn.textContent = (I.btnWaiting || 'оживёт в {T}').replace('{T}', fmtClock(pass.rise));
    }
    if (toBooking) toBooking.classList.remove('show');
  }

  function catchSignal() {
    var pass = activePass();
    if (!pass || !window.OrbitPromo) return;
    var now = new Date();
    if (window.OrbitPromo.buttonState(now, pass) !== 'open') return;
    // Защита от повторного срабатывания
    if (live.caught && localStorageGet('orbit_caught') === todayKey(now)) {
      return;
    }
    live.caught = true;
    live.code = window.OrbitPromo.codeFor(now);
    localStorageSet('orbit_caught', todayKey(now));
    goal('orbit_signal');
    updateSignal(now);
  }

  function remindClick() {
    var pass = activePass();
    if (!pass || !window.OrbitPromo) return;
    var I = i18n();
    var ics = window.OrbitPromo.ics({
      start: pass.rise, end: pass.set,
      title: I.icsTitle || 'МКС в вашем небе — поймать сигнал на mkshostel.ru',
      description: 'Выйдите на улицу и посмотрите в небо — а потом поймайте сигнал на mkshostel.ru',
      location: 'mkshostel.ru'
    });
    try {
      var blob = new Blob([ics], { type: 'text/calendar' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'mks-orbit.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) {}
  }

  // ── localStorage helpers ────────────────────────────────────────────
  function localStorageGet(key) {
    try { return window.localStorage ? localStorage.getItem(key) : null; } catch (e) { return null; }
  }
  function localStorageSet(key, val) {
    try { if (window.localStorage) localStorage.setItem(key, val); } catch (e) {}
  }

  // ── город гостя ──────────────────────────────────────────────────────
  function setGuest(obs, label, opts) {
    opts = opts || {};
    var changed = !live.guestObs || live.guestObs.lat !== obs.lat || live.guestObs.lon !== obs.lon;
    live.guestObs = obs;
    live.guestLabel = label;
    computeGuestPasses();
    refreshGuestPass(new Date());
    updateGuestMarker();
    renderConnect();
    if (live.guestPass) updateWhere(live.guestPass);
    updateSignal(new Date());
    if (opts.persist) {
      localStorageSet('orbit_city', JSON.stringify({ name: label, lat: obs.lat, lon: obs.lon }));
    }
    if (changed && opts.fireGoal) goal('orbit_city');
  }

  function cleanCityLabel(s) {
    // Trim leading/trailing whitespace
    s = s.trim();
    // Collapse multiple spaces
    s = s.replace(/\s+/g, ' ');
    // Truncate to 30 characters
    if (s.length > 30) s = s.substring(0, 30);
    // Capitalize first letter
    if (s.length > 0) s = s.charAt(0).toUpperCase() + s.slice(1);
    return s;
  }

  function resolveCity(query) {
    var citySub = document.getElementById('orbit-city-sub');
    var I = i18n();
    var q = (query || '').trim();
    if (!q || !window.OrbitCities) return;

    // Try full query first
    var res = window.OrbitCities.find(q);
    var useFirstToken = false;

    // If full query didn't find, try first token (fallback)
    if (!res) {
      var tokens = q.split(/\s+/);
      if (tokens.length > 1 || tokens[0].length < q.length) {
        res = window.OrbitCities.find(tokens[0]);
        useFirstToken = true;
      }
    }

    if (!res) {
      if (citySub) {
        citySub.textContent = I.notFound || 'не нашли такой город — попробуйте без сокращений';
        citySub.classList.add('err');
      }
      return;
    }
    if (citySub) {
      citySub.textContent = I.citySub || 'определим ваше небо';
      citySub.classList.remove('err');
    }
    // Use first token if fallback was used, otherwise use full query
    var labelBase = useFirstToken ? q.split(/\s+/)[0] : q;
    var label = cleanCityLabel(labelBase);
    setGuest({ lat: res.lat, lon: res.lon }, label, { persist: true, fireGoal: true });
  }

  function useGeo() {
    var cityInput = document.getElementById('orbit-city-input');
    if (!navigator.geolocation) { if (cityInput) cityInput.focus(); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var I = i18n();
      var label = I.guestPoint || 'ваша точка';
      if (cityInput) cityInput.value = label;
      var citySub = document.getElementById('orbit-city-sub');
      if (citySub) { citySub.textContent = I.citySub || 'определим ваше небо'; citySub.classList.remove('err'); }
      setGuest({ lat: pos.coords.latitude, lon: pos.coords.longitude }, label, { persist: true, fireGoal: true });
    }, function () {
      if (cityInput) cityInput.focus();
    }, { timeout: 8000 });
  }

  function restoreGuest() {
    var raw = localStorageGet('orbit_city');
    if (!raw) return;
    try {
      var obj = JSON.parse(raw);
      if (obj && typeof obj.lat === 'number' && typeof obj.lon === 'number') {
        var cityInput = document.getElementById('orbit-city-input');
        if (cityInput && obj.name) cityInput.value = obj.name;
        setGuest({ lat: obj.lat, lon: obj.lon }, obj.name || '', { persist: false, fireGoal: false });
      }
    } catch (e) {}
  }

  function restoreCaught() {
    var d = localStorageGet('orbit_caught');
    if (d && d === todayKey(new Date()) && window.OrbitPromo) {
      live.caught = true;
      live.code = window.OrbitPromo.codeFor(new Date());
    }
  }

  function tick() {
    var now = new Date();
    refreshHotelPass(now);
    refreshGuestPass(now);
    renderPassCell(live.hotelPass, now, 'orbit-hotel-clock', 'orbit-hotel-sub');
    if (live.guestPass) renderPassCell(live.guestPass, now, 'orbit-guest-clock', 'orbit-guest-sub');
    renderConnect();
    if (live.guestPass && live.guestPass !== live.lastWhereFor) {
      live.lastWhereFor = live.guestPass;
      updateWhere(live.guestPass);
    }
    updateSignal(now);
  }

  function initLive() {
    var cityInput = document.getElementById('orbit-city-input');
    var geoBtn = document.getElementById('orbit-geo');
    var signalBtn = document.getElementById('orbit-signal');
    var remindBtn = document.getElementById('orbit-remind');
    var toBooking = document.getElementById('orbit-tobooking');

    if (geoBtn) {
      geoBtn.disabled = !(navigator.geolocation);
      geoBtn.addEventListener('click', useGeo);
    }
    if (cityInput) {
      cityInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); resolveCity(cityInput.value); }
      });
      cityInput.addEventListener('blur', function () { resolveCity(cityInput.value); });
    }
    if (signalBtn) signalBtn.addEventListener('click', catchSignal);
    if (remindBtn) remindBtn.addEventListener('click', remindClick);
    if (toBooking) toBooking.addEventListener('click', function () { goal('orbit_to_booking'); });

    computeHotelPasses();
    restoreCaught();
    restoreGuest();
    tick();
    setInterval(tick, 1000);
  }

  // ── единая точка входа ──────────────────────────────────────────────
  function init() {
    var root = document.getElementById('orbit');
    if (!root) return;
    if (reducedMotion()) {
      document.querySelectorAll('#orbit svg').forEach(function (s) {
        if (s.pauseAnimations) s.pauseAnimations();
      });
    }
    initTle();
    drawMap();
    updateNight();
    setInterval(updateNight, 60000);
    updateStation();
    setInterval(updateStation, 5000);
    initLights();
    initFacts();
    initLive();
  }

  init();
})();
