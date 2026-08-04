# «Живая орбита» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Секция «Живая орбита» на mkshostel.ru: настоящее положение МКС на карте, персональные пролёты по городу гостя, кнопка «Поймать сигнал» с промокодом, «Напомнить» в календарь, цели Метрики.

**Architecture:** Статический сайт без сборки: новые файлы в `orbit/` (JS-глобалы через `window.*`, один CSS), секция вставляется в `index.html` (и en/zh) между галереей и FAQ. Орбита считается в браузере (satellite.js + TLE с кэшем и зашитым фолбэком), терминатор и субсолярная точка — своя математика, огни городов — canvas. Математика тестируется node:test (node v24 на маке есть).

**Tech Stack:** vanilla JS (ES2019, без модулей — `<script src>`), satellite.js (vendored), SVG + canvas, node:test для юнит-тестов, python3 для генераторов данных.

**Спека:** `docs/superpowers/specs/2026-08-05-living-orbit-design.md`.
**Макет-эталон (визуал, стили, тексты):** `.superpowers/brainstorm/62335-1785879665/content/orbit-hero-v8.html` — в Task 1 копируется в git.

## Global Constraints

- Терминология: «капсульный отель», никогда «хостел» (кроме SEO-тайтлов, их не трогаем).
- Формулировка: «в вашем небе», не «над вашим городом».
- Палитра сайта: `--bg:#070B14 --panel:#0F1526 --line:rgba(126,168,255,.16) --text:#E9EEF9 --muted:#8E99B4 --accent:#52C7FF --violet:#8F7BFF`. Тёплые цвета (золото `#D9A441`, огни `#FFC97A`) — только внутри карты.
- Заголовки секции — ЗАГЛАВНЫМИ, kicker моноширинный, как у остальных секций сайта.
- Никаких CDN: все библиотеки вендорятся в репозиторий.
- Без бэкенда. Внешние запросы только: TLE (celestrak.org), экипаж (api.open-notify.org) — оба с таймаутом и зашитым фолбэком; отказ сети не ломает секцию.
- ISS = NORAD 25544. Метрика 109025350, цели: `orbit_city`, `orbit_signal`, `orbit_to_booking`.
- `prefers-reduced-motion: reduce` → мерцание огней, пульсы и бегущие анимации выключены.
- Три языка: RU (`index.html`), EN (`en/index.html`), 中文 (`zh/index.html`). Правка одного — правка всех трёх.
- Деплой: `rsync -avz -e "ssh -i ~/.ssh/mks_deploy_ed25519" <файлы> --relative cw137707@vh470.timeweb.ru:public_html/`.
- Коммиты частые, сообщения на русском, как в истории репо.

---

### Task 1: Каркас файлов, карта мира, эталон в git

**Files:**
- Create: `orbit/tools/make-world.py`, `orbit/world-path.js`, `orbit/README.md`
- Create: `docs/superpowers/specs/assets/living-orbit-mockup-v8.html` (копия эталона)
- Test: визуальной проверки нет (данные), проверка node-однострочником

**Interfaces:**
- Produces: `window.ORBIT_WORLD = {path: "<svg d…>", w: 800, h: 400}` — контуры материков в экваторной проекции; проекция: `x=(lon+180)/360*800`, `y=(90-lat)/180*400`. Все последующие задачи используют эту проекцию.

- [ ] **Step 1: Скопировать эталон макета в git**

```bash
mkdir -p docs/superpowers/specs/assets orbit/tools orbit/vendor orbit/tests
cp ".superpowers/brainstorm/62335-1785879665/content/orbit-hero-v8.html" docs/superpowers/specs/assets/living-orbit-mockup-v8.html
```

- [ ] **Step 2: Написать генератор карты** — `orbit/tools/make-world.py`. Логика уже отработана в брейншторме; источник — `https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json`:

```python
#!/usr/bin/env python3
"""GeoJSON -> orbit/world-path.js. Запуск: python3 orbit/tools/make-world.py"""
import json, urllib.request, os
W, H = 800.0, 400.0
URL = "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json"
def proj(lon, lat): return ((lon+180)/360*W, (90-lat)/180*H)
raw = urllib.request.urlopen(URL, timeout=30).read()
data = json.loads(raw)
paths = []
for f in data["features"]:
    if f["id"] == "ATA": continue          # Антарктида вне кадра
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    for poly in polys:
        pts = []
        for lon, lat in poly[0]:
            x, y = proj(lon, lat); x, y = round(x), round(y)
            if not pts or pts[-1] != (x, y): pts.append((x, y))
        if len(pts) < 4: continue
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        if (max(xs)-min(xs))*(max(ys)-min(ys)) < 12: continue   # мелкие острова
        paths.append("M%d %d" % pts[0] + "".join("L%d %d" % p for p in pts[1:]) + "Z")
d = "".join(paths)
out = os.path.join(os.path.dirname(__file__), "..", "world-path.js")
with open(out, "w") as fh:
    fh.write("// Сгенерировано make-world.py из world.geo.json (johan/world.geo.json)\n")
    fh.write('window.ORBIT_WORLD={w:800,h:400,path:"%s"};\n' % d)
print("ok", len(d), "bytes of path")
```

- [ ] **Step 3: Запустить генератор**

Run: `python3 orbit/tools/make-world.py`
Expected: `ok 6XXXX bytes of path`, появился `orbit/world-path.js`

- [ ] **Step 4: Проверить, что файл валидный JS**

Run: `node -e "window={};require('./orbit/world-path.js');const w=window.ORBIT_WORLD;console.assert(w.path.length>40000&&w.w===800,'bad');console.log('world ok',w.path.length)"`
Expected: `world ok <число>`

- [ ] **Step 5: orbit/README.md** — 5 строк: что лежит в папке, как перегенерить карту и города, как запустить тесты (`node --test orbit/tests/`).

- [ ] **Step 6: Commit**

```bash
git add orbit docs/superpowers/specs/assets
git commit -m "Живая орбита: каркас orbit/, карта мира из GeoJSON, эталон макета в git"
```

---

### Task 2: satellite.js + орбитальное ядро IssCore

**Files:**
- Create: `orbit/vendor/satellite.min.js`, `orbit/tle-fallback.js`, `orbit/iss-core.js`
- Test: `orbit/tests/iss-core.test.cjs`

**Interfaces:**
- Produces (глобал `window.IssCore`, в node — `globalThis.IssCore`):
  - `IssCore.setTle(l1:string, l2:string):boolean` — false, если TLE не парсится;
  - `IssCore.current(d:Date) -> {lat:number, lon:number, altKm:number, velKms:number}` (lon в [-180,180]);
  - `IssCore.groundTrack(from:Date, minutes:number, stepSec:number) -> Array<{lat,lon,t:Date}>`;
  - `IssCore.predictPasses(obs:{lat,lon}, from:Date, hours:number) -> Array<{rise:Date, peak:Date, set:Date, riseAz:number, peakAz:number, setAz:number, maxElev:number}>` — проходы с elevation>0, шаг сканирования 30 с, уточнение границ до 1 с бинарным поиском; azimuth в градусах 0=север.

- [ ] **Step 1: Свендорить satellite.js**

```bash
curl -sL https://registry.npmjs.org/satellite.js/-/satellite.js-5.0.0.tgz | tar -xz -C /tmp package/dist/satellite.min.js
cp /tmp/package/dist/satellite.min.js orbit/vendor/satellite.min.js
node -e "const s=require('./orbit/vendor/satellite.min.js');console.log('satellite ok',typeof s.twoline2satrec)"
```
Expected: `satellite ok function`

- [ ] **Step 2: Зашить свежий TLE-фолбэк**

```bash
curl -s "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE" -o /tmp/iss.tle && cat /tmp/iss.tle
node -e "
const t=require('fs').readFileSync('/tmp/iss.tle','utf8').trim().split(/\r?\n/);
const l1=t.find(s=>s.startsWith('1 ')),l2=t.find(s=>s.startsWith('2 '));
require('fs').writeFileSync('orbit/tle-fallback.js',
'// Запасной TLE МКС, обновлён '+new Date().toISOString().slice(0,10)+'\n'+
'window.ORBIT_TLE_FALLBACK='+JSON.stringify({l1,l2,date:new Date().toISOString().slice(0,10)})+';\n');
console.log('fallback written')"
```

- [ ] **Step 3: Написать `orbit/iss-core.js`** (UMD-обёртка, чтобы работал и в браузере, и в node-тестах):

```js
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
```

- [ ] **Step 4: Написать падающий тест** `orbit/tests/iss-core.test.cjs`:

```js
const test = require('node:test'); const assert = require('node:assert');
globalThis.window = globalThis;
require('../tle-fallback.js');
const IssCore = require('../iss-core.js');
const F = globalThis.ORBIT_TLE_FALLBACK;

test('TLE парсится', () => { assert.equal(IssCore.setTle(F.l1, F.l2), true); });

test('текущая позиция физична', () => {
  IssCore.setTle(F.l1, F.l2);
  const p = IssCore.current(new Date());
  assert.ok(Math.abs(p.lat) <= 52.5, 'широта в пределах наклонения');
  assert.ok(p.lon >= -180 && p.lon <= 180);
  assert.ok(p.altKm > 350 && p.altKm < 480, 'высота ~420 км: ' + p.altKm);
  assert.ok(p.velKms > 7 && p.velKms < 8.2, 'скорость ~7.66: ' + p.velKms);
});

test('трек за виток замыкает полный оборот по долготе', () => {
  IssCore.setTle(F.l1, F.l2);
  const tr = IssCore.groundTrack(new Date(), 93, 30);
  assert.ok(tr.length > 180);
  const lats = tr.map(p => p.lat);
  assert.ok(Math.max(...lats) > 45 && Math.min(...lats) < -45, 'синусоида до ±51.6');
});

test('проходы над Петербургом: 2–9 за сутки, rise<peak<set', () => {
  IssCore.setTle(F.l1, F.l2);
  const ps = IssCore.predictPasses({ lat: 59.95, lon: 30.3 }, new Date(), 24);
  assert.ok(ps.length >= 2 && ps.length <= 9, 'passes=' + ps.length);
  for (const p of ps) {
    assert.ok(p.rise < p.peak && p.peak < p.set);
    assert.ok(p.maxElev > 0 && p.maxElev <= 55, 'для СПб maxElev<~55: ' + p.maxElev);
    assert.ok((p.set - p.rise) / 60000 < 15, 'проход короче 15 мин');
  }
});
```

- [ ] **Step 5: Прогнать тесты — сперва убедиться, что падают без iss-core.js** (если писал тест до Step 3 — иначе просто запустить)

Run: `node --test orbit/tests/`
Expected: `pass 4` (все четыре).

- [ ] **Step 6: Commit**

```bash
git add orbit/vendor orbit/tle-fallback.js orbit/iss-core.js orbit/tests
git commit -m "Живая орбита: орбитальное ядро IssCore (satellite.js, TLE-фолбэк, проходы) + тесты"
```

---

### Task 3: Солнце и терминатор

**Files:**
- Create: `orbit/sun.js`
- Test: `orbit/tests/sun.test.cjs`

**Interfaces:**
- Produces (`window.OrbitSun`):
  - `OrbitSun.subsolar(d:Date) -> {lat, lon}` — точка, где солнце в зените (упрощение: уравнение времени учтено грубой формулой, точность ±1°, для карты достаточно);
  - `OrbitSun.nightPathD(d:Date, w:number, h:number) -> string` — SVG-path ночной области в проекции Task 1 (терминатор + замыкание через тёмный полюс).

- [ ] **Step 1: Написать `orbit/sun.js`:**

```js
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
```

- [ ] **Step 2: Тест `orbit/tests/sun.test.cjs`:**

```js
const test = require('node:test'); const assert = require('node:assert');
globalThis.window = globalThis;
const OrbitSun = require('../sun.js');

test('равноденствие: склонение около нуля', () => {
  const s = OrbitSun.subsolar(new Date(Date.UTC(2026, 2, 20, 12, 0)));
  assert.ok(Math.abs(s.lat) < 2, 'lat=' + s.lat);
});
test('июньское солнцестояние: около +23.4', () => {
  const s = OrbitSun.subsolar(new Date(Date.UTC(2026, 5, 21, 12, 0)));
  assert.ok(Math.abs(s.lat - 23.4) < 1, 'lat=' + s.lat);
});
test('полдень UTC: субсолярная долгота около 0', () => {
  const s = OrbitSun.subsolar(new Date(Date.UTC(2026, 7, 5, 12, 0)));
  assert.ok(Math.abs(s.lon) < 6, 'lon=' + s.lon);
});
test('nightPathD — валидный замкнутый путь', () => {
  const d = OrbitSun.nightPathD(new Date(), 800, 400);
  assert.match(d, /^M[\d. ]+L/); assert.ok(d.endsWith('Z')); assert.ok(d.length > 500);
});
```

- [ ] **Step 3: Прогнать** — Run: `node --test orbit/tests/` → Expected: `pass 8`.

- [ ] **Step 4: Commit** — `git add orbit/sun.js orbit/tests/sun.test.cjs && git commit -m "Живая орбита: субсолярная точка и терминатор"`

---

### Task 4: Промокод, .ics, состояния кнопки (чистая логика)

**Files:**
- Create: `orbit/promo.js`, `orbit/tools/promo-list.cjs`
- Test: `orbit/tests/promo.test.cjs`

**Interfaces:**
- Produces (`window.OrbitPromo`):
  - `OrbitPromo.codeFor(d:Date) -> string` — детерминированный код дня, формат `ORBIT-XXXX` (X из A-Z2-9 без похожих символов);
  - `OrbitPromo.ics({start:Date, end:Date, title, description, location}) -> string` — валидный VCALENDAR (CRLF!);
  - `OrbitPromo.buttonState(now:Date, pass:{rise,set}|null) -> 'waiting'|'open'|'passed'` — open с (rise − 2 мин) до set.
- Consumes: pass из `IssCore.predictPasses`.

- [ ] **Step 1: `orbit/promo.js`:**

```js
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
```

- [ ] **Step 2: Тест `orbit/tests/promo.test.cjs`:**

```js
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
```

- [ ] **Step 3: Прогнать** — Run: `node --test orbit/tests/` → Expected: `pass 11`.

- [ ] **Step 4: `orbit/tools/promo-list.cjs`** — список кодов администраторам:

```js
// node orbit/tools/promo-list.cjs 2026-09 -> коды на месяц
globalThis.window = globalThis;
const P = require('../promo.js');
const [y, m] = (process.argv[2] || new Date().toISOString().slice(0, 7)).split('-').map(Number);
for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
  const date = new Date(Date.UTC(y, m - 1, d));
  console.log(date.toISOString().slice(0, 10), P.codeFor(date));
}
```

Run: `node orbit/tools/promo-list.cjs 2026-08 | head -3` → Expected: три строки `2026-08-0X ORBIT-....`

- [ ] **Step 5: Commit** — `git add orbit/promo.js orbit/tools/promo-list.cjs orbit/tests/promo.test.cjs && git commit -m "Живая орбита: промокод дня, .ics, состояния кнопки + тесты"`

---

### Task 5: Справочник городов

**Files:**
- Create: `orbit/tools/make-cities.py`, `orbit/cities.js`
- Test: `orbit/tests/cities.test.cjs`

**Interfaces:**
- Produces: `window.ORBIT_CITIES = [[nameRu, nameEn, lat, lon], ...]` (нижний регистр, ~1500–2500 записей) и `window.OrbitCities.find(query:string) -> {nameRu, nameEn, lat, lon}|null` (регистр/ё нечувствителен, префиксный поиск).

- [ ] **Step 1: `orbit/tools/make-cities.py`** — источник simplemaps World Cities Basic (CC BY 4.0, атрибуция в шапке cities.js):

```python
#!/usr/bin/env python3
"""simplemaps worldcities (free, CC BY 4.0) -> orbit/cities.js
Скачай архив: https://simplemaps.com/static/data/world-cities/basic/simplemaps_worldcities_basicv1.77.zip
Распакуй worldcities.csv рядом и запусти: python3 orbit/tools/make-cities.py worldcities.csv"""
import csv, json, sys, os
src = sys.argv[1]
rows = []
with open(src, newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        pop = float(r["population"] or 0)
        keep = pop > 200000 or (r["iso2"] in ("RU","BY","KZ") and pop > 40000)
        if not keep: continue
        rows.append([r["city_ascii"].lower(), r["city"].lower(), round(float(r["lat"]),2), round(float(r["lng"]),2)])
rows.sort(key=lambda x: x[0])
out = os.path.join(os.path.dirname(__file__), "..", "cities.js")
with open(out, "w", encoding="utf-8") as fh:
    fh.write("// Данные: simplemaps.com/data/world-cities (CC BY 4.0)\n")
    fh.write("window.ORBIT_CITIES=" + json.dumps(rows, ensure_ascii=False, separators=(',',':')) + ";\n")
    fh.write("""window.OrbitCities={find:function(q){q=(q||'').trim().toLowerCase().replace(/ё/g,'е');
if(q.length<2)return null;var C=window.ORBIT_CITIES,best=null;
for(var i=0;i<C.length;i++){var a=C[i][0].replace(/ё/g,'е'),b=C[i][1].replace(/ё/g,'е');
if(a===q||b===q)return{nameRu:C[i][1],nameEn:C[i][0],lat:C[i][2],lon:C[i][3]};
if(!best&&(a.indexOf(q)===0||b.indexOf(q)===0))best={nameRu:C[i][1],nameEn:C[i][0],lat:C[i][2],lon:C[i][3]};}
return best;}};\n""")
print("cities:", len(rows))
```

⚠️ В CSV simplemaps колонка `city` — локальное имя (для РФ обычно кириллица), `city_ascii` — латиница. Если после генерации у российских городов не окажется кириллических имён — добавить в скрипт словарь ручных синонимов минимум для: москва, санкт-петербург, петербург, спб, мурманск, владивосток, екатеринбург, новосибирск, казань, сочи, калининград (маппинг на city_ascii), и прогнать снова.

- [ ] **Step 2: Скачать CSV, сгенерировать, проверить руками**

Run: `python3 orbit/tools/make-cities.py ~/Downloads/worldcities.csv`
Expected: `cities: 15XX–4XXX`; размер `orbit/cities.js` < 400 КБ (иначе поднять порог населения до 300k).

- [ ] **Step 3: Тест `orbit/tests/cities.test.cjs`:**

```js
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
```

Run: `node --test orbit/tests/` → Expected: `pass 13`.

- [ ] **Step 4: Commit** — `git add orbit/tools/make-cities.py orbit/cities.js orbit/tests/cities.test.cjs && git commit -m "Живая орбита: справочник городов с поиском"`

---

### Task 6: Секция на странице — вёрстка и статика (RU)

**Files:**
- Create: `orbit/orbit.css`, `orbit/orbit.js` (пока каркас: карта, станция, огни; без пересчёта города)
- Modify: `index.html` — вставка секции перед строкой `<section id="faq" class="dock">` (сейчас ~строка 702+16 после фикса шапки) и подключение скриптов перед `</body>`

**Interfaces:**
- Consumes: `ORBIT_WORLD`, `IssCore`, `OrbitSun`, `ORBIT_TLE_FALLBACK`.
- Produces: DOM-структура с id: `#orbit`, `#orbit-map` (svg), `#orbit-canvas` (canvas огней), `#orbit-iss` (группа станции), `#orbit-track` (path), `#orbit-night` (path терминатора), `#orbit-fact` (контейнер факта), `#orbit-panel` (три ячейки), `#orbit-city-input`, `#orbit-geo`, `#orbit-signal` (кнопка), `#orbit-remind`, `#orbit-connect` (фраза-связка), `#orbit-where` (details-раскрывашка). `window.ORBIT_I18N` определяется инлайн-скриптом ДО orbit.js.

- [ ] **Step 1: Собрать `orbit/orbit.css`** — перенести стили из эталона `docs/superpowers/specs/assets/living-orbit-mockup-v8.html` (блок `<style>` целиком), с изменениями:
  1. все селекторы получают префикс `#orbit` (например `#orbit .pcell`);
  2. `.sec` переименовать в `#orbit .orbit-inner`, фон секции убрать (секция живёт на фоне сайта, рамку оставить);
  3. добавить стиль заголовка по образцу соседних секций сайта (посмотреть класс заголовка `#faq` в `index.html` и повторить: kicker + h2 ЗАГЛАВНЫМИ);
  4. кнопка `.sig` — размеры и радиус как у `.btn` сайта (padding 11px 22px, border-radius 10px), градиент оставить; добавить `.sig.waiting{background:rgba(142,153,180,.18);color:#8E99B4;animation:none}` и `.sig.caught{background:#52C7FF}`;
  5. `#orbit-where` — обернуть в `<details>`: стилизовать `summary` как пункт FAQ (взять стили аккордеона из `index.html`);
  6. в конец файла:
```css
@media (prefers-reduced-motion: reduce){
  #orbit .glow, #orbit .vglow{filter:none}
  #orbit *{animation:none !important}
}
@media (max-width:640px){
  #orbit .fact{font-size:11.5px}
  #orbit svg text{font-size:15px}
}
```

- [ ] **Step 2: Вставить секцию в `index.html`** перед `<section id="faq" class="dock">`. Разметка — копия структуры эталона (карта+панель+connect+where) с заменами: заголовок `<h2>СТАНЦИЯ СЕЙЧАС В ПОЛЁТЕ</h2>`, kicker «ЖИВАЯ ОРБИТА»; поверх карты — `<canvas id="orbit-canvas">` для огней (вместо SVG-кружков эталона); блок «куда смотреть» — в `<details id="orbit-where">`. Инлайн перед подключением скриптов:

```html
<script>
window.ORBIT_I18N = {
  lang: 'ru',
  overUs: 'Над нашим капсульным отелем', yourSky: 'В вашем небе',
  today: 'сегодня', tomorrow: 'завтра', inTime: 'через',
  connect: 'В вашем небе станция появится в {A}. Над нашим капсульным отелем — в {B}. Она нас уже связала 🛰',
  btnWaiting: 'оживёт в {T}', btnOpen: '📡 ПОЙМАТЬ СИГНАЛ', btnCaught: 'Промокод: {C}',
  toBooking: 'Применить промокод — выбрать даты', remind: '🔔 НАПОМНИТЬ · В КАЛЕНДАРЬ',
  cityPlaceholder: 'Введите свой город', whereTitle: 'Куда смотреть',
  icsTitle: 'МКС в вашем небе — поймать сигнал на mkshostel.ru',
  facts: [ /* массив из 30 фактов — скопировать ДОСЛОВНО из эталона living-orbit-mockup-v8.html, из блока factwrap, без HTML-тегов, вида "👨‍🚀 Сейчас на борту — 7 человек из 3 стран" */ ]
};
</script>
<script src="orbit/world-path.js" defer></script>
<script src="orbit/vendor/satellite.min.js" defer></script>
<script src="orbit/tle-fallback.js" defer></script>
<script src="orbit/iss-core.js" defer></script>
<script src="orbit/sun.js" defer></script>
<script src="orbit/promo.js" defer></script>
<script src="orbit/cities.js" defer></script>
<script src="orbit/orbit.js" defer></script>
<link rel="stylesheet" href="orbit/orbit.css">
```

- [ ] **Step 3: Каркас `orbit/orbit.js`** — на этом шаге: инициализация TLE (fallback сразу, затем попытка fetch celestrak с таймаутом 5 с и кэшем localStorage `orbit_tle` на 24 ч), отрисовка карты (`ORBIT_WORLD.path` в `#orbit-map`), терминатор (`OrbitSun.nightPathD`, обновление раз в 60 с), огни городов на canvas (точки из `ORBIT_CITIES` с фильтром «ночная сторона»: фактор из положения солнца — точка ночная, если угол между её долготой и субсолярной > 90°±размытие 15°; мерцание 4 фазами через requestAnimationFrame, при reduced-motion — статично), станция `#orbit-iss` (SVG-группа из эталона) на позиции `IssCore.current()`, обновление каждые 5 с, трасса — `IssCore.groundTrack(now-46мин, 92, 60)` линией через разрывы по антимеридиану (резать сегменты при |Δlon|>180), ротация фактов по одному (`setTimeout` цикл 6 с, обновление textContent с CSS-классом появления).

- [ ] **Step 4: Проверить визуально**

```bash
python3 -m http.server 8901 --directory "/Users/karolina/Desktop/МКС" &
```
Открыть `http://localhost:8901/index.html#orbit` в браузере (панель предпросмотра), проверить: карта с материками, терминатор в правдоподобном месте для текущего часа, станция на карте и совпадает по координатам с любым публичным ISS-трекером (±2°), трасса без горизонтальных «прострелов» через всю карту, факты сменяются, в консоли нет ошибок.

- [ ] **Step 5: Commit** — `git add orbit/orbit.css orbit/orbit.js index.html && git commit -m "Живая орбита: секция на главной — живая карта, станция, терминатор, огни, факты"`

---

### Task 7: Город гостя, отсчёты, сигнал, промокод, .ics, Метрика (RU)

**Files:**
- Modify: `orbit/orbit.js` (добавить блок UI-логики), `index.html` (если потребуются мелкие правки разметки панели)

**Interfaces:**
- Consumes: `OrbitCities.find`, `IssCore.predictPasses`, `OrbitPromo.*`, `ORBIT_I18N`.
- Produces: поведение (см. шаги); `reachGoal` вызывается как в существующем коде сайта: `if (typeof ym === 'function') ym(109025350, 'reachGoal', '<цель>')`.

- [ ] **Step 1: Отсчёты для отеля.** При загрузке: `predictPasses({lat:59.95,lon:30.3}, now, 48)`, первый видимый проход → в ячейку «Над нашим капсульным отелем»: локальное время `rise` (часовой пояс гостя, `toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})` + подпись «сегодня/завтра»), живой отсчёт `через ЧЧ:ММ:СС` тиком 1 с.

- [ ] **Step 2: Город гостя.** Ввод в `#orbit-city-input` (по Enter/blur) → `OrbitCities.find` → если найден: predictPasses по координатам, заполняется ячейка «В вашем небе», строится фиолетовая линия и маркер на карте (проекция Task 1), показывается `#orbit-connect` с фразой из i18n, отправляется `orbit_city`. Если не найден — подпись под полем «не нашли такой город — попробуйте без сокращений». Кнопка `#orbit-geo` → `navigator.geolocation.getCurrentPosition` (таймаут 8 с) → координаты напрямую (город не резолвим, подпись «ваша точка»), при отказе — фокус в поле ввода. Выбор сохраняется в `localStorage.orbit_city` и восстанавливается при следующем визите.

- [ ] **Step 3: Кнопка сигнала.** Тик 1 с: `OrbitPromo.buttonState(now, passГостя)` (пока город не введён — state по проходу отеля) → классы `waiting/open`. Клик в `open`: state `caught`, в кнопке `Промокод: ORBIT-XXXX` (`codeFor(new Date())`), под ней появляется ссылка-кнопка `toBooking` на модуль брони — взять точный href существующей кнопки «Забронировать» из шапки `index.html`; отправить `orbit_signal`; по клику на toBooking — `orbit_to_booking`. Состояние caught держится в localStorage до конца дня (второй клик не выдаёт новый код). При `passed` — автоматически пересчитать на следующий проход.

- [ ] **Step 4: «Напомнить».** `#orbit-remind` → `OrbitPromo.ics({start: rise, end: set, title: icsTitle, description: 'Выйдите на улицу и посмотрите в небо — а потом поймайте сигнал на mkshostel.ru', location: 'mkshostel.ru'})` → Blob `text/calendar` → временная ссылка `download="mks-orbit.ics"` → click.

- [ ] **Step 5: «Куда смотреть».** При выбранном проходе заполнить текст шагов данными: направление появления/исчезновения из `riseAz/setAz` (перевод азимута в 8 румбов: С, СВ, В, ЮВ, Ю, ЮЗ, З, СЗ — таблица диапазонов по 45°), длительность прохода в минутах; компас-SVG из эталона с дугой от riseAz к setAz.

- [ ] **Step 6: Ручная проверка сценария.** На локальном сервере: ввести «Мурманск» → появились два времени и фраза-связка; маркер и линия на карте; отсчёт тикает; в консоли `ym` не падает (на localhost ym отсутствует — обёртка `typeof ym === 'function'` обязана молчать). Для проверки состояний кнопки временно подменить в консоли `Date` не нужно — вместо этого добавить в orbit.js поддержку query-параметра `?orbitDemo=1`, который создаёт фиктивный проход через 30 с от загрузки (открытие кнопки можно дождаться) — параметр обязан работать и на проде, вреда нет.

- [ ] **Step 7: Commit** — `git add orbit/orbit.js index.html && git commit -m "Живая орбита: город гостя, отсчёты, поймать сигнал, промокод, ics, цели Метрики"`

---

### Task 8: Экипаж live + EN и 中文

**Files:**
- Modify: `orbit/orbit.js` (экипаж), `en/index.html`, `zh/index.html`

**Interfaces:**
- Consumes: всё готовое; страницы отличаются только инлайн-`ORBIT_I18N` и путями `../orbit/...`.

- [ ] **Step 1: Экипаж.** В `orbit/orbit.js`: fetch `http://api.open-notify.org/astros.json` — ВНИМАНИЕ: у open-notify нет HTTPS, с https-сайта запрос будет заблокирован как mixed content. Поэтому: использовать `https://corsproxy.io/?url=` НЕЛЬЗЯ (внешняя зависимость). Решение: константа `ORBIT_CREW = 7` в orbit.js + комментарий-инструкция обновлять при сменах экипажей (2–4 раза в год), факт «на борту N человек» берёт число из константы. Если позже найдётся https-источник с CORS — заменить одной строкой.

- [ ] **Step 2: EN-версия.** В `en/index.html`: та же секция (пути `../orbit/*.js`), `ORBIT_I18N` на английском: overUs `Above our capsule hotel`, yourSky `In your sky`, connect `The station will appear in your sky at {A}. Above our capsule hotel — at {B}. It has already connected us 🛰`, btnOpen `📡 CATCH THE SIGNAL`, remind `🔔 REMIND ME · ADD TO CALENDAR`, cityPlaceholder `Enter your city`, whereTitle `Where to look`, facts — 10 штук:

```
"👨‍🚀 7 people are on board right now",
"😴 Astronauts sleep in capsules — just like our guests",
"🌅 The crew sees 16 sunrises every day",
"⚡ 27,600 km/h — St. Petersburg to Vladivostok in 15 minutes",
"📏 As big as a football field — 109 meters",
"💧 93% of water is recycled — yesterday's sweat is tomorrow's coffee",
"🔭 Visible from Earth with the naked eye — brighter than any star",
"🌀 One full orbit around Earth every 92 minutes",
"🌍 Built by 15 countries working together",
"📦 A sleeping cabin the size of a phone booth — and it's enough"
```

- [ ] **Step 3: 中文-версия.** В `zh/index.html`: kicker «实时轨道», h2 «空间站正在飞行», overUs «在我们的太空舱酒店上空», yourSky «在您的天空中», connect «空间站将于 {A} 出现在您的天空。{B} 飞过我们的太空舱酒店。它已经把我们连在一起 🛰», btnOpen «📡 捕捉信号», remind «🔔 提醒我 · 加入日历», cityPlaceholder «输入您的城市», whereTitle «往哪里看», facts — 10 штук:

```
"👨‍🚀 目前有 7 名宇航员在空间站上",
"😴 宇航员睡在太空舱里——和我们的客人一样",
"🌅 乘组每天迎来 16 次日出",
"⚡ 时速 27,600 公里——圣彼得堡到符拉迪沃斯托克只需 15 分钟",
"📏 和一个足球场一样大——109 米",
"💧 93% 的水被回收利用",
"🔭 肉眼可见——比任何星星都亮",
"🌀 每 92 分钟绕地球一圈",
"🌍 由 15 个国家共同建造",
"📦 睡眠舱只有电话亭大小——但足够了"
```

- [ ] **Step 4: Проверить EN и ZH локально** — `http://localhost:8901/en/index.html#orbit` и `/zh/`: секция работает, тексты на своём языке, пути к скриптам не битые (консоль чистая).

- [ ] **Step 5: Commit** — `git add orbit/orbit.js en/index.html zh/index.html && git commit -m "Живая орбита: EN и 中文 версии, число экипажа"`

---

### Task 9: Производительность, полировка, деплой

**Files:**
- Modify: `orbit/orbit.js`, `orbit/orbit.css` (по итогам проверки), `СОСТОЯНИЕ-ПРОЕКТА.md`

- [ ] **Step 1: Ленивая инициализация.** Вся тяжёлая часть (satellite, canvas, тики) стартует только когда секция впервые попала во вьюпорт: `IntersectionObserver` на `#orbit` (rootMargin 200px). Скрипты уже с `defer` — этого мало, нужен именно отложенный старт расчётов.

- [ ] **Step 2: Бюджет производительности.** На мобильной ширине (панель предпросмотра 375px): в DevTools Performance при видимой секции нет длинных тасков >50 мс после инициализации; мерцание огней — один rAF-цикл, точек на canvas на мобильных ≤400 (при `matchMedia('(max-width:640px)')` брать каждую вторую). Вес новых файлов: `du -h orbit/` — суммарно < 600 КБ (satellite ~110К, cities < 400К, остальное мелочь); все `<script>` с `defer` — LCP главной не трогаем.

- [ ] **Step 3: Смок всех трёх страниц** на локальном сервере: RU/EN/ZH открыть, `?orbitDemo=1` — кнопка проходит waiting→open→caught, ics скачивается, ссылка на бронь ведёт в модуль. Горизонтального скролла нет ни на 375px, ни на 1280px (`document.documentElement.scrollWidth === clientWidth`).

- [ ] **Step 4: Обновить `СОСТОЯНИЕ-ПРОЕКТА.md`** — в свежий слой: секция «Живая орбита» на сайте (3 языка), промокоды ORBIT-XXXX по формуле (список: `node orbit/tools/promo-list.cjs ГГГГ-ММ`), скидку по коду настроить в Bnovo (открытый вопрос: номинал — к маме), цели Метрики orbit_*.

- [ ] **Step 5: Commit + деплой**

```bash
git add -A orbit index.html en/index.html zh/index.html СОСТОЯНИЕ-ПРОЕКТА.md
git commit -m "Живая орбита: производительность, ленивый старт, обновление сводки"
rsync -avz -e "ssh -i ~/.ssh/mks_deploy_ed25519" index.html en/index.html zh/index.html orbit --relative cw137707@vh470.timeweb.ru:public_html/
```

- [ ] **Step 6: Проверить прод**: открыть `https://mkshostel.ru/#orbit` — станция летит, TLE подтянулся (в консоли нет ошибок CORS — если celestrak не отдал, работает фолбэк и это ок), демо-режим `?orbitDemo=1` выдаёт код. В Метрике в течение суток появились визиты с целями.

---

## Порядок и зависимости

1 (карта) → 2 (ядро) → 3 (солнце) → 4 (промо) → 5 (города) — можно в любом порядке после 2 → 6 (вёрстка, нужны 1–3) → 7 (логика, нужны 4–6) → 8 (языки) → 9 (полировка+деплой).

## Что НЕ делаем (из спеки)

3D-глобус, WebGL, push-уведомления, секундная астрономическая точность, автоопределение города по IP.
