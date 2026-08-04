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
