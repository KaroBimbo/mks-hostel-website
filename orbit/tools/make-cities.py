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
# Значения проверены по датасету simplemaps worldcities (basic v1.91.2).
RU_ALIASES = {
    "петербург": "saint petersburg",
    "спб": "saint petersburg",
    "шымкент": "shymkent",
    "астана": "astana",
    "атырау": "atyrau",
    "павлодар": "pavlodar",
    "тараз": "taraz",
    "семей": "semey",
    "уланудэ": "ulan-ude",
    "улан-удэ": "ulan-ude",
    "йошкарола": "yoshkar-ola",
    "йошкар-ола": "yoshkar-ola",
    "нижний тагил": "nizhniy tagil",
    "нижнийтагил": "nizhniy tagil",
    "набережные челны": "naberezhnyye chelny",
    "ростов": "rostov",
    "ростов-на-дону": "rostov",
    # Беларусь (национальные романизации; "витебск" в датасете отсутствует —
    # города нет среди simplemaps worldcities, алиас сознательно не добавлен).
    "гомель": "homyel'",
    "могилёв": "mahilyow",
    "могилев": "mahilyow",
    "гродно": "hrodna",
    # Казахстан (национальные романизации)
    "караганда": "qaraghandy",
    "усть-каменогорск": "oskemen",
    "оскемен": "oskemen",
    "костанай": "qostanay",
    "кустанай": "qostanay",
    "актобе": "aqtobe",
    "актюбинск": "aqtobe",
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
var TR=[['щ','shch'],['ж','zh'],['х','kh'],['ц','ts'],['ч','ch'],['ш','sh'],['ю','yu'],['я','ya'],
['а','a'],['б','b'],['в','v'],['г','g'],['д','d'],['е','e'],['з','z'],['и','i'],['й','y'],['к','k'],
['л','l'],['м','m'],['н','n'],['о','o'],['п','p'],['р','r'],['с','s'],['т','t'],['у','u'],['ф','f'],
['ы','y'],['э','e'],['ь',''],['ъ','']];
function translit(s){if(!/[а-я]/.test(s))return null;var r=s;for(var t=0;t<TR.length;t++){r=r.split(TR[t][0]).join(TR[t][1]);}return r;}
function norm(s){return s.replace(/ё/g,'е').replace(/[ьъ]/g,'');}
var qLat=translit(q);
var qN=norm(q),qLatN=qLat!==null?norm(qLat):null;
var C=window.ORBIT_CITIES,best=null;
for(var i=0;i<C.length;i++){var a=norm(C[i][0]),b=norm(C[i][1]);
if(a===qN||b===qN||(qLatN!==null&&(a===qLatN||b===qLatN)))return{nameRu:C[i][1],nameEn:C[i][0],lat:C[i][2],lon:C[i][3]};
// Префиксный поиск (автодополнение) — только для запросов от 5 символов,
// иначе короткие подстроки вроде "усть" ложно цепляют "усть-илимск" и т.п.
if(!best&&q.length>=5&&(a.indexOf(qN)===0||b.indexOf(qN)===0||(qLatN!==null&&(a.indexOf(qLatN)===0||b.indexOf(qLatN)===0))))best={nameRu:C[i][1],nameEn:C[i][0],lat:C[i][2],lon:C[i][3]};}
// Фолбэк по первому токену многословных/составных названий (напр. "ростов-на-дону" -> "ростов").
// Срабатывает только если первый токен достаточно длинный (>=5), и допускает
// исключительно ТОЧНОЕ совпадение — без префиксного поиска, который давал
// ложные срабатывания (напр. короткое "усть" ошибочно находило "усть-илимск").
if(!best&&/[ -]/.test(q)){var fst=q.split(/[ -]/)[0];
if(fst.length>=5){var fstLat=translit(fst);
var fstN=norm(fst),fstLatN=fstLat!==null?norm(fstLat):null;
for(var i=0;i<C.length;i++){var a=norm(C[i][0]),b=norm(C[i][1]);
if(a===fstN||b===fstN||(fstLatN!==null&&(a===fstLatN||b===fstLatN)))return{nameRu:C[i][1],nameEn:C[i][0],lat:C[i][2],lon:C[i][3]};}}}
return best;}};\n""")

print("cities:", len(rows))
