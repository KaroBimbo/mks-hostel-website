# Живая орбита — каркас проекта

Папка содержит JavaScript-модули для живого отображения орбиты МКС и карты мира на главной странице сайта.

**Генерация данных:**
- Карта мира: `python3 orbit/tools/make-world.py` (источник: [world.geo.json](https://github.com/johan/world.geo.json))
- Города: `python3 orbit/tools/make-cities.py worldcities.csv` (обязательный аргумент —
  путь к CSV с городами, например [worldcities.csv (simplemaps)](https://simplemaps.com/data/world-cities))

**Запуск тестов:** `node --test orbit/tests/`
