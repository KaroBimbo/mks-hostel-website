#!/usr/bin/env python3
"""simplemaps worldcities (free, CC BY 4.0) -> orbit/cities.js
Скачай архив с https://simplemaps.com/data/world-cities (кнопка Download у Basic Database),
распакуй worldcities.csv рядом и запусти: python3 orbit/tools/make-cities.py worldcities.csv

Примечание: в Basic-датасете колонка city для российских городов обычно совпадает
с city_ascii (латиница) — кириллицы там нет. Поэтому ниже задан словарь ручных
синонимов (по city_ascii в нижнем регистре) для отображения и поиска ключевых
городов РФ по-русски, плюс алиасы (сокращения) для find() в cities.js.
"""
import csv, json, sys, os

src = sys.argv[1]

# Ручные синонимы: city_ascii(lower) -> кириллическое имя для отображения/поиска.
RU_SYNONYMS = {
    "moscow": "москва",
    "saint petersburg": "санкт-петербург",
    "murmansk": "мурманск",
    "vladivostok": "владивосток",
    "yekaterinburg": "екатеринбург",
    "novosibirsk": "новосибирск",
    "kazan": "казань",
    "sochi": "сочи",
    "kaliningrad": "калининград",
}

# Алиасы-запросы (не меняют отображаемое имя, только помогают find() их находить):
# алиас -> city_ascii(lower), на который он должен указывать.
RU_ALIASES = {
    "петербург": "saint petersburg",
    "спб": "saint petersburg",
}

rows = []
with open(src, newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        pop = float(r["population"] or 0)
        keep = pop > 200000 or (r["iso2"] in ("RU", "BY", "KZ") and pop > 40000)
        if not keep:
            continue
        ascii_name = r["city_ascii"].lower()
        local_name = r["city"].lower()
        if ascii_name in RU_SYNONYMS:
            local_name = RU_SYNONYMS[ascii_name]
        rows.append([ascii_name, local_name, round(float(r["lat"]), 2), round(float(r["lng"]), 2)])

rows.sort(key=lambda x: x[0])

out = os.path.join(os.path.dirname(__file__), "..", "cities.js")
with open(out, "w", encoding="utf-8") as fh:
    fh.write("// Данные: simplemaps.com/data/world-cities (CC BY 4.0)\n")
    fh.write("window.ORBIT_CITIES=" + json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + ";\n")
    fh.write("window.ORBIT_CITY_ALIASES=" + json.dumps(RU_ALIASES, ensure_ascii=False, separators=(',', ':')) + ";\n")
    fh.write("""window.OrbitCities={find:function(q){q=(q||'').trim().toLowerCase().replace(/ё/g,'е');
if(q.length<2)return null;
var AL=window.ORBIT_CITY_ALIASES||{};
if(Object.prototype.hasOwnProperty.call(AL,q))q=AL[q];
var C=window.ORBIT_CITIES,best=null;
for(var i=0;i<C.length;i++){var a=C[i][0].replace(/ё/g,'е'),b=C[i][1].replace(/ё/g,'е');
if(a===q||b===q)return{nameRu:C[i][1],nameEn:C[i][0],lat:C[i][2],lon:C[i][3]};
if(!best&&(a.indexOf(q)===0||b.indexOf(q)===0))best={nameRu:C[i][1],nameEn:C[i][0],lat:C[i][2],lon:C[i][3]};}
return best;}};\n""")

print("cities:", len(rows))
