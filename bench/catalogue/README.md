# The food list

`src/data/foods.json` — 195 foods of Ukrainian home cooking, kcal per 100 g as eaten. It replaces the MacroTrack
spreadsheet (2026-10-30): that list was made for a UK/US gym user (32 Ukrainian dishes among fish & chips, burritos and
protein powders), and its values had no sources — its dishes were round guesses (банош 150, when banosh cooked on sour
cream with bryndza is about 260).

Every value now names where it comes from (`source` in foods.json):

| Source | Foods | How |
|---|---:|---|
| **USDA FoodData Central**, SR Legacy (lab-analysed, public domain) | 94 | By FDC id: `usda.py` reads the official CSV and checks each description and value. Cooked forms as eaten. |
| **Ukrainian product labels** | 32 | Shop products whose fat levels differ from US food (сметана 15/20 %, сир 5/9 %, масло 82,5 %, майонез 67 %, ковбаси, бринза, халва…): 3–8 Ukrainian brands each from retailer listings (zakaz.ua: Novus, Metro, Auchan…), labels that don't add up by 4/9/4 dropped, median taken. `labels.json` lists every source. |
| **Recipe calculation** | 69 | Ukrainian dishes, calculated as food-composition tables do: a home-style recipe's ingredients (grams, from the two sources above) ÷ the cooked weight of the batch. Fried food counts only the oil it absorbs. `recipes.json` has each recipe's source, the cooked-weight basis and 1–3 independent published values for comparison (USDA FNDDS, Estonian NutriData, Ukrainian school-menu tables, recipe authors). |

`REVIEW.md` compares every dish with its references and the old value. A gap over 20 % is flagged; most come from the
references being another version of the dish (oil, fat level, how thick a soup is). Weak spots, by design or for lack
of data: шкварки (yield of the cracklings), холодець (bone share), млинці з м'ясом (fatty home version), currants
(USDA counts all carbohydrate, Ukrainian tables only sugars).

## Rebuild

```bash
python3 -I items.py                       # the list itself (names, aliases, pieces, source of each value) -> items.json, renamed.json
python3 -I usda.py <SR Legacy CSV dir>    # -> usda.json (download: fdc.nal.usda.gov, FoodData_Central_sr_legacy_food_csv_2018-04)
python3 -I build.py                       # -> ../../src/data/foods.json, ../../src/data/renamed.json, REVIEW.md
```

`pnpm foods` runs `items.py` and `build.py`. Ids of foods kept from the old list are unchanged; `renamed.json` maps the
old ids that went to the closest new food, so her learned corrections and «Нещодавні» follow (`migrateLearned`).
Meals she already logged keep the kcal they were logged with.
