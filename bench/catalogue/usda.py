"""kcal per 100 g for every "usda" row of items.json and for the raw recipe ingredients,
taken from USDA FoodData Central SR Legacy (CSV release 2018-04), with the FDC id as provenance.

Download (no API key needed):
  https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
  (sha256 b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0)
unzip it into its own directory, then:

  python3 -I usda.py <dir with food.csv, food_nutrient.csv, nutrient.csv>  [--out usda.json] [--items items.json]

The picks below are made by hand (fdcId + the exact FDC description, which the script checks against
food.csv so a typo in an id fails loudly). kcal is read from food_nutrient.csv, nutrient 1008
(Energy, KCAL). Everything is per 100 g of edible portion (bone/pit/peel refuse excluded).

Pick rules: the food that best matches the row's hint and how it is eaten in Ukraine; cooked forms as
served; "without salt" where SR Legacy has both; unenriched grain products where the request did not
say enriched (enrichment adds vitamins/iron, not energy - kcal are identical). Where there is no exact
match the closest food is used and "note" says why.

Foundation Foods (2026-04-30 CSV) was searched only for what SR Legacy lacks (potato starch); it has
none either, so every value here comes from SR Legacy.

Prints a sanity report: every value that differs by more than 25 % from a typical value I would expect
(EXPECTED below, common reference values, written down before reading the CSV values for most rows).
"""
import argparse
import csv
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
ENERGY_KCAL = "1008"

# id -> (fdcId, exact FDC description, note or None)
PICKS = {
    # ---- catalogue rows (source "usda") ----
    "fried-eggs": (173423, "Egg, whole, cooked, fried", None),
    "buckwheat-cooked": (170686, "Buckwheat groats, roasted, cooked", None),
    "white-rice-cooked": (169757, "Rice, white, long-grain, regular, unenriched, cooked without salt", None),
    "millet-porridge": (168871, "Millet, cooked", None),
    "pearl-barley-cooked": (170285, "Barley, pearled, cooked", None),
    "oatmeal-water": (173905, "Cereals, oats, regular and quick, unenriched, cooked with water (includes boiling and microwaving), without salt", None),
    "corn-porridge": (171672, "Cereals, corn grits, yellow, regular and quick, enriched, cooked with water, without salt",
                      "Yellow grits (Ukrainian corn grits are yellow; white grits 171655 = 71 kcal). US grits are cooked thinner than a thick "
                      "mamalyga, so a stiff Ukrainian porridge will be denser than this; SR Legacy has no thicker cooked form."),
    "pasta-cooked": (168928, "Pasta, cooked, unenriched, without added salt",
                     "Hint named the enriched entry; Ukrainian pasta is not enriched. Same energy: enriched 169737 is also 158 kcal."),
    "potato-boiled": (170440, "Potatoes, boiled, cooked without skin, flesh, without salt", None),
    "mashed-potatoes": (168555, "Potatoes, mashed, home-prepared, whole milk and butter added", None),
    "baked-potatoes": (170093, "Potatoes, baked, flesh and skin, without salt", None),
    "chicken-breast-cooked": (171477, "Chicken, broilers or fryers, breast, meat only, cooked, roasted", None),
    "chicken-leg-cooked": (173617, "Chicken, broilers or fryers, leg, meat and skin, cooked, roasted",
                           "USDA 'leg' = thigh + drumstick together. Thigh alone 173625 = 232 kcal, drumstick alone 173612 = 191 kcal."),
    "roast-chicken": (171450, "Chicken, broilers or fryers, meat and skin, cooked, roasted", None),
    "turkey-breast-cooked": (174516, "Turkey, retail parts, breast, meat only, cooked, roasted",
                             "Retail breast fillet without added solution (how it is bought in Ukraine). Breast from a whole bird, roasted (171496) = 147 kcal."),
    "pork-roast": (167821, "Pork, fresh, loin, whole, separable lean and fat, cooked, roasted", None),
    "pork-chop-cooked": (168292, "Pork, fresh, loin, center loin (chops), bone-in, separable lean and fat, cooked, pan-fried", None),
    "beef-cooked": (170626, "Beef, round, bottom round, steak, separable lean and fat, trimmed to 0\" fat, all grades, cooked, braised",
                    "Boiled/stewed beef as served in Ukraine is mostly lean round or shoulder; braised chuck pot roast (168667) is 302 kcal, "
                    "lean-only stew beef 191. Bottom round lean and fat (223) sits between them."),
    "kovbasa": (173878, "Kielbasa, fully cooked, pan-fried",
                "Fried form chosen because the row is 'домашня (смажена)'. Hint's 'Polish sausage, pork' (174577, as sold) = 326 kcal, within 2 %."),
    "beef-liver-fried": (168627, "Beef, variety meats and by-products, liver, cooked, pan-fried", None),
    "salo": (167811, "Pork, fresh, backfat, raw", "Fresh backfat. Salted salo carries a few % salt, so its energy is slightly lower (a few %). SR 'salt pork' (168287, 748) is belly-type, not backfat."),
    "bacon-cooked": (168322, "Pork, cured, bacon, pre-sliced, cooked, pan-fried", "SR Legacy's only pan-fried bacon entry (the hint's description without 'pre-sliced' does not exist)."),
    "hake-cooked": (173726, "Fish, pollock, Alaska, cooked", "Pollock stands for hake. This entry is analytical (3 samples, no additives) and pairs with ing-pollock-raw (173725). The hint's 'cooked, dry heat (may contain additives to retain moisture)' (173681, 111 kcal) is a recipe-approximated value (derivation RA) from additive-treated fish. True hake is slightly fattier: SR 'Fish, whiting, mixed species, cooked, dry heat' (175161, silver hake) = 116 kcal."),
    "salmon-cooked": (175168, "Fish, salmon, Atlantic, farmed, cooked, dry heat", None),
    "mackerel-smoked": (175120, "Fish, mackerel, Atlantic, cooked, dry heat", "SR Legacy has no smoked mackerel; cooked Atlantic mackerel used as the hint says. Hot-smoked is close to this; cold-smoked is wetter and lower."),
    "tuna-canned": (173709, "Fish, tuna, light, canned in water, drained solids (Includes foods for USDA's Food Distribution Program)", "Ukrainian canned tuna contains salt, so the regular entry. The 'without salt' entry (171986, 116 kcal) is an older, separate analysis, not just salt-free."),
    "shrimp-cooked": (175180, "Crustaceans, shrimp, cooked", None),
    "eggs-whole": (173424, "Egg, whole, cooked, hard-boiled", None),
    "whole-milk": (172217, "Milk, whole, 3.25% milkfat, without added vitamin A and vitamin D", None),
    "yogurt-natural": (171284, "Yogurt, plain, whole milk", None),
    "hard-cheese": (171241, "Cheese, gouda", None),
    "white-bread": (174924, "Bread, white, commercially prepared (includes soft bread crumbs)", None),
    "lavash": (172816, "Bread, pita, white, unenriched",
               "SR Legacy has no lavash; white pita is the closest flatbread. Enriched pita (174915) is also 275 kcal."),
    "oats-dry": (173904, "Cereals, oats, regular and quick, not fortified, dry", None),
    "sugar": (169655, "Sugars, granulated", None),
    "honey": (169640, "Honey", None),
    "milk-chocolate": (167587, "Candies, milk chocolate", None),
    "dark-chocolate-70": (170273, "Chocolate, dark, 70-85% cacao solids", None),
    "cabbage-raw": (169975, "Cabbage, raw", None),
    "sauerkraut": (169279, "Sauerkraut, canned, solids and liquids", None),
    "beet-boiled": (169146, "Beets, cooked, boiled, drained", None),
    "carrots-raw": (170393, "Carrots, raw", None),
    "onion": (170000, "Onions, raw", None),
    "cucumber": (168409, "Cucumber, with peel, raw", None),
    "pickled-cucumber": (168558, "Pickles, cucumber, dill or kosher dill",
                         "Brine-fermented 'sour' pickles (169379) = 11 kcal; same within 1 kcal."),
    "tomato": (170457, "Tomatoes, red, ripe, raw, year round average", None),
    "bell-pepper": (170108, "Peppers, sweet, red, raw", None),
    "zucchini": (169291, "Squash, summer, zucchini, includes skin, raw", None),
    "eggplant": (169228, "Eggplant, raw", None),
    "mushrooms-raw": (169251, "Mushrooms, white, raw", None),
    "mixed-greens": (169249, "Lettuce, green leaf, raw",
                     "Row also covers herbs: dill (172233) = 43, parsley (170416) = 36 kcal; lettuce value used."),
    "radish": (169276, "Radishes, raw", None),
    "green-peas": (170013, "Peas, green (includes baby and lesuer types), canned, drained solids, unprepared", None),
    "corn-canned": (169214, "Corn, sweet, yellow, canned, whole kernel, drained solids", None),
    "kidney-beans-cooked": (173740, "Beans, kidney, all types, mature seeds, cooked, boiled, without salt", None),
    "green-beans": (169141, "Beans, snap, green, cooked, boiled, drained, without salt", None),
    "pumpkin": (168448, "Pumpkin, raw", None),
    "cauliflower": (170397, "Cauliflower, cooked, boiled, drained, without salt", None),
    "broccoli-cooked": (169967, "Broccoli, cooked, boiled, drained, without salt", None),
    "apple": (171688, "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)", None),
    "pear": (169118, "Pears, raw", None),
    "plum": (169949, "Plums, raw", None),
    "apricot": (171697, "Apricots, raw", None),
    "peach": (169928, "Peaches, yellow, raw", None),
    "cherries-sour": (173954, "Cherries, sour, red, raw", None),
    "sweet-cherries": (171719, "Cherries, sweet, raw", None),
    "strawberries": (167762, "Strawberries, raw", None),
    "raspberries": (167755, "Raspberries, raw", None),
    "blueberries": (171711, "Blueberries, raw", None),
    "currants": (173963, "Currants, european black, raw",
                 "Red and white currants (173964) = 56 kcal. Ukrainian/Soviet tables list black currant near 44 kcal because they count "
                 "only available sugars; USDA uses carbohydrate by difference (15.4 g), hence 63."),
    "grapes": (174683, "Grapes, red or green (European type, such as Thompson seedless), raw", None),
    "watermelon": (167765, "Watermelon, raw", None),
    "melon": (169092, "Melons, cantaloupe, raw", "Ukrainian melons are mostly honeydew-like; honeydew (169911) = 36 kcal."),
    "banana": (173944, "Bananas, raw", None),
    "orange": (169097, "Oranges, raw, all commercial varieties", None),
    "mandarin": (169105, "Tangerines, (mandarin oranges), raw", None),
    "lemon": (167746, "Lemons, raw, without peel", None),
    "kiwi": (168153, "Kiwifruit, green, raw", None),
    "persimmon": (169941, "Persimmons, japanese, raw", None),
    "raisins": (168165, "Raisins, dark, seedless (Includes foods for USDA's Food Distribution Program)",
                "SR Legacy has no generic 'Raisins, seedless'; dark used. Golden (168164) = 301 kcal."),
    "prunes": (168162, "Plums, dried (prunes), uncooked", None),
    "dried-apricots": (173941, "Apricots, dried, sulfured, uncooked", None),
    "walnuts": (170187, "Nuts, walnuts, english", None),
    "hazelnuts": (170581, "Nuts, hazelnuts or filberts", None),
    "almonds": (170567, "Nuts, almonds", None),
    "peanuts": (173806, "Peanuts, all types, dry-roasted, without salt", None),
    "sunflower-seeds": (170563, "Seeds, sunflower seed kernels, dry roasted, without salt", None),
    "pumpkin-seeds": (170557, "Seeds, pumpkin and squash seed kernels, roasted, without salt", None),
    "sunflower-oil": (171025, "Oil, sunflower, linoleic, (approx. 65%)", "High-linoleic type (Ukrainian sunflower oil); every sunflower oil entry is 884 kcal."),
    "olive-oil": (171413, "Oil, olive, salad or cooking", None),
    "juice": (173933, "Apple juice, canned or bottled, unsweetened, without added ascorbic acid", None),
    "black-coffee": (171890, "Beverages, coffee, brewed, prepared with tap water", None),
    "green-tea": (173227, "Beverages, tea, black, brewed, prepared with tap water",
                  "Row is 'Чай без цукру' (any tea); black tea is the usual one in Ukraine. Green tea (171917) is also 1 kcal."),
    # ---- raw recipe ingredients (raw / dry, as bought) ----
    "ing-potato-raw": (170026, "Potatoes, flesh and skin, raw", None),
    "ing-pork-shoulder-raw": (167843, "Pork, fresh, shoulder, whole, separable lean and fat, raw", None),
    "ing-pork-loin-raw": (167818, "Pork, fresh, loin, whole, separable lean and fat, raw", None),
    "ing-pork-belly-raw": (167812, "Pork, fresh, belly, raw", None),
    "ing-pork-ground-raw": (167902, "Pork, fresh, ground, raw", None),
    "ing-beef-chuck-raw": (169491, "Beef, chuck, arm pot roast, separable lean and fat, trimmed to 1/8\" fat, all grades, raw",
                           "Lean-and-fat chuck (18 % fat). Fat-trimmed 'chuck for stew' raw (171206) is 128 kcal."),
    "ing-beef-ground-raw": (174036, "Beef, ground, 80% lean meat / 20% fat, raw", None),
    "ing-chicken-whole-raw": (171447, "Chicken, broilers or fryers, meat and skin, raw", "Per 100 g meat and skin (bones excluded)."),
    "ing-chicken-breast-raw": (171077, "Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw", None),
    "ing-chicken-liver-raw": (171060, "Chicken, liver, all classes, raw", None),
    "ing-beef-liver-raw": (169451, "Beef, variety meats and by-products, liver, raw", None),
    "ing-pork-hock-raw": (167859, "Pork, fresh, variety meats and by-products, feet, raw",
                          "SR Legacy has no fresh hock; pork feet are the classic kholodets cut. Leg shank half, lean and fat, raw "
                          "(168226) = 193 kcal. Per 100 g edible portion (bones excluded)."),
    "ing-smoked-pork-ribs": (168288, "Pork, cured, shoulder, blade roll, separable lean and fat, unheated",
                             "SR Legacy has no smoked ribs. Blade roll is cured and smoked pork shoulder with a rib-like fat level (22 % fat); "
                             "fresh spareribs, raw (167853) = 277 kcal. Per 100 g edible portion (bones excluded)."),
    "ing-pollock-raw": (173725, "Fish, pollock, Alaska, raw",
                        "Stands for hake. Analytical, no additives. Hake is slightly fattier: 'Fish, whiting, mixed species, raw' (173713) = 90 kcal."),
    "ing-carp-raw": (171952, "Fish, carp, raw", None),
    "ing-wheat-flour": (168936, "Wheat flour, white, all-purpose, enriched, unbleached",
                        "Unbleached, like Ukrainian flour. Bleached (168894) and unenriched (169761) are also 364 kcal."),
    "ing-semolina-dry": (168933, "Semolina, unenriched",
                         "Ukrainian 'манка М' is soft-wheat, closer to farina: 'Cereals, farina, unenriched, dry' (173916) = 369 kcal."),
    "ing-corn-grits-dry": (171670, "Cereals, corn grits, yellow, regular and quick, unenriched, dry", None),
    "ing-millet-dry": (169702, "Millet, raw", None),
    "ing-rice-dry": (169756, "Rice, white, long-grain, regular, raw, unenriched", None),
    "ing-buckwheat-dry": (170685, "Buckwheat groats, roasted, dry", None),
    "ing-pearl-barley-dry": (170284, "Barley, pearled, raw", None),
    "ing-wheat-berries-dry": (168890, "Wheat, hard red winter",
                              "Hard red winter is Ukraine's main wheat. Other classes range 327-342 kcal (hard white 169719 = 342, durum 169721 = 339)."),
    "ing-split-peas-dry": (172428, "Peas, green, split, mature seeds, raw", None),
    "ing-pasta-dry": (168927, "Pasta, dry, unenriched", None),
    "ing-egg-noodles-dry": (169755, "Noodles, egg, dry, unenriched", None),
    "ing-beet-raw": (169145, "Beets, raw", None),
    "ing-garlic-raw": (169230, "Garlic, raw", None),
    "ing-tomato-paste": (170459, "Tomato products, canned, paste, without salt added (Includes foods for USDA's Food Distribution Program)", None),
    "ing-sorrel-raw": (170076, "Dock, raw", "Dock = Rumex species, the genus of garden sorrel; SR Legacy has no separate sorrel."),
    "ing-egg-raw": (171287, "Egg, whole, raw, fresh", None),
    "ing-poppy-seeds": (171330, "Spices, poppy seed", None),
    "ing-yeast-dry": (175043, "Leavening agents, yeast, baker's, active dry", None),
    "ing-breadcrumbs": (174928, "Bread, crumbs, dry, grated, plain", None),
    "ing-dried-apples": (171691, "Apples, dried, sulfured, uncooked", "Only uncooked dried-apple entry (sulfuring does not change energy); home-dried apples vary with moisture."),
    "ing-dried-pears": (169121, "Pears, dried, sulfured, uncooked", None),
    "ing-potato-starch": (169698, "Cornstarch",
                          "No potato starch in SR Legacy or Foundation Foods (2026-04-30). Cornstarch is the closest pure starch, but it is "
                          "drier (~8 % water) than potato starch (~16-20 % water), so real potato starch is about 330 kcal, ~13 % lower. "
                          "'Potato flour' (168446, 357 kcal) is whole dried potato, not starch."),
    "ing-gelatin": (169599, "Gelatins, dry powder, unsweetened", None),
    "ing-lard": (171401, "Lard", "The fat poured off when salo is rendered into shkvarky (entered as a negative amount)."),
    "ing-egg-white-raw": (172183, "Egg, white, raw, fresh", None),
    "ing-powdered-sugar": (169656, "Sugars, powdered", None),
    "ing-olives": (169094, "Olives, ripe, canned (small-extra large)", None),
    "ing-vinegar": (172237, "Vinegar, distilled", None),
    "ing-baking-soda": (175040, "Leavening agents, baking soda", None),
}

# Mean of several SR Legacy foods: id -> (description, [fdcIds], note)
COMPOSITES = {
    "berries-mix": ("Mean of: Strawberries, raw; Raspberries, raw; Blueberries, raw", [167762, 167755, 171711],
                    "Unweighted mean of three SR Legacy foods: 167762 Strawberries, raw; 167755 Raspberries, raw; 171711 Blueberries, raw."),
}

# Raw recipe ingredients that must be present (they are not rows of items.json).
INGREDIENTS = [
    "ing-potato-raw", "ing-pork-shoulder-raw", "ing-pork-loin-raw", "ing-pork-belly-raw", "ing-pork-ground-raw",
    "ing-beef-chuck-raw", "ing-beef-ground-raw", "ing-chicken-whole-raw", "ing-chicken-breast-raw", "ing-chicken-liver-raw",
    "ing-beef-liver-raw", "ing-pork-hock-raw", "ing-smoked-pork-ribs", "ing-pollock-raw", "ing-carp-raw", "ing-wheat-flour",
    "ing-semolina-dry", "ing-corn-grits-dry", "ing-millet-dry", "ing-rice-dry", "ing-buckwheat-dry", "ing-pearl-barley-dry",
    "ing-wheat-berries-dry", "ing-split-peas-dry", "ing-pasta-dry", "ing-egg-noodles-dry", "ing-beet-raw", "ing-garlic-raw",
    "ing-tomato-paste", "ing-sorrel-raw", "ing-egg-raw", "ing-poppy-seeds", "ing-yeast-dry", "ing-breadcrumbs",
    "ing-dried-apples", "ing-dried-pears", "ing-potato-starch", "ing-gelatin",
    "ing-lard", "ing-egg-white-raw", "ing-powdered-sugar", "ing-olives", "ing-vinegar", "ing-baking-soda",
]

# Typical kcal/100 g one would expect (common reference values, incl. Ukrainian tables) - for the sanity report only.
EXPECTED = {
    "fried-eggs": 190, "buckwheat-cooked": 110, "white-rice-cooked": 130, "millet-porridge": 100, "pearl-barley-cooked": 110,
    "oatmeal-water": 85, "corn-porridge": 85, "pasta-cooked": 150, "potato-boiled": 87, "mashed-potatoes": 110,
    "baked-potatoes": 93, "chicken-breast-cooked": 160, "chicken-leg-cooked": 200, "roast-chicken": 230,
    "turkey-breast-cooked": 140, "pork-roast": 250, "pork-chop-cooked": 230, "beef-cooked": 250, "beef-liver-fried": 175,
    "salo": 800, "bacon-cooked": 470, "kovbasa": 320, "hake-cooked": 95, "salmon-cooked": 200,
    "mackerel-smoked": 250, "tuna-canned": 100, "shrimp-cooked": 100, "eggs-whole": 155, "whole-milk": 60,
    "yogurt-natural": 62, "hard-cheese": 356, "white-bread": 260, "lavash": 260, "oats-dry": 370,
    "sugar": 390, "honey": 305, "milk-chocolate": 535, "dark-chocolate-70": 590, "cabbage-raw": 25, "sauerkraut": 20,
    "beet-boiled": 45, "carrots-raw": 41, "onion": 40, "cucumber": 15, "pickled-cucumber": 12, "tomato": 18,
    "bell-pepper": 27, "zucchini": 17, "eggplant": 25, "mushrooms-raw": 22, "mixed-greens": 15, "radish": 16,
    "green-peas": 65, "corn-canned": 70, "kidney-beans-cooked": 125, "green-beans": 35, "pumpkin": 26, "cauliflower": 25,
    "broccoli-cooked": 35, "apple": 52, "pear": 57, "plum": 46, "apricot": 48, "peach": 40, "cherries-sour": 50,
    "sweet-cherries": 63, "strawberries": 32, "raspberries": 52, "blueberries": 57, "currants": 45, "berries-mix": 47,
    "grapes": 69, "watermelon": 30, "melon": 35, "banana": 89, "orange": 47, "mandarin": 53, "lemon": 29, "kiwi": 61,
    "persimmon": 70, "raisins": 300, "prunes": 240, "dried-apricots": 241, "walnuts": 654, "hazelnuts": 628,
    "almonds": 579, "peanuts": 585, "sunflower-seeds": 580, "pumpkin-seeds": 560, "sunflower-oil": 884, "olive-oil": 884,
    "juice": 46, "black-coffee": 1, "green-tea": 1,
    "ing-potato-raw": 77, "ing-pork-shoulder-raw": 230, "ing-pork-loin-raw": 200, "ing-pork-belly-raw": 500,
    "ing-pork-ground-raw": 263, "ing-beef-chuck-raw": 220, "ing-beef-ground-raw": 254, "ing-chicken-whole-raw": 215,
    "ing-chicken-breast-raw": 115, "ing-chicken-liver-raw": 119, "ing-beef-liver-raw": 135, "ing-pork-hock-raw": 220,
    "ing-smoked-pork-ribs": 300, "ing-pollock-raw": 75, "ing-carp-raw": 120, "ing-wheat-flour": 364,
    "ing-semolina-dry": 360, "ing-corn-grits-dry": 360, "ing-millet-dry": 370, "ing-rice-dry": 360,
    "ing-buckwheat-dry": 345, "ing-pearl-barley-dry": 350, "ing-wheat-berries-dry": 335, "ing-split-peas-dry": 345,
    "ing-pasta-dry": 370, "ing-egg-noodles-dry": 385, "ing-beet-raw": 43, "ing-garlic-raw": 149, "ing-tomato-paste": 82,
    "ing-sorrel-raw": 22, "ing-egg-raw": 143, "ing-poppy-seeds": 525, "ing-yeast-dry": 325, "ing-breadcrumbs": 395,
    "ing-dried-apples": 245, "ing-dried-pears": 262, "ing-potato-starch": 330, "ing-gelatin": 335,
    "ing-lard": 900, "ing-egg-white-raw": 52, "ing-powdered-sugar": 389, "ing-olives": 115, "ing-vinegar": 18, "ing-baking-soda": 0,
}


def number(s):
    v = float(s)
    return int(v) if v.is_integer() else v


def load(sr_dir):
    with open(sr_dir / "nutrient.csv", newline="", encoding="utf-8") as f:
        unit = {r["id"]: (r["name"], r["unit_name"]) for r in csv.DictReader(f)}
    if unit.get(ENERGY_KCAL) != ("Energy", "KCAL"):
        sys.exit(f"nutrient {ENERGY_KCAL} is {unit.get(ENERGY_KCAL)}, expected ('Energy', 'KCAL')")
    with open(sr_dir / "food.csv", newline="", encoding="utf-8") as f:
        foods = {int(r["fdc_id"]): (r["description"], r["data_type"]) for r in csv.DictReader(f)}
    kcal = {}
    with open(sr_dir / "food_nutrient.csv", newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["nutrient_id"] == ENERGY_KCAL:
                fid = int(r["fdc_id"])
                if fid in kcal:
                    sys.exit(f"two energy rows for fdc_id {fid}")
                kcal[fid] = number(r["amount"])
    return foods, kcal


def lookup(fid, want_desc, foods, kcal, errors, who):
    if fid not in foods:
        errors.append(f"{who}: fdcId {fid} not in food.csv")
        return None
    desc, dtype = foods[fid]
    if dtype != "sr_legacy_food":
        errors.append(f"{who}: fdcId {fid} is {dtype}, not sr_legacy_food")
    if want_desc is not None and desc != want_desc:
        errors.append(f"{who}: fdcId {fid} is {desc!r}, script says {want_desc!r}")
    if fid not in kcal:
        errors.append(f"{who}: fdcId {fid} has no energy (1008) value")
        return None
    return desc, kcal[fid]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("sr_dir", type=pathlib.Path, help="unzipped SR Legacy CSV directory")
    ap.add_argument("--items", type=pathlib.Path, default=HERE / "items.json")
    ap.add_argument("--out", type=pathlib.Path, default=HERE / "usda.json")
    a = ap.parse_args()

    items = json.loads(a.items.read_text(encoding="utf-8"))
    usda_ids = [r["id"] for r in items if r["source"] == "usda"]
    wanted = usda_ids + INGREDIENTS
    errors = []
    if len(set(wanted)) != len(wanted):
        errors.append("duplicate ids in items.json usda rows + INGREDIENTS")
    missing = [i for i in wanted if i not in PICKS and i not in COMPOSITES]
    extra = [i for i in list(PICKS) + list(COMPOSITES) if i not in wanted]
    if missing:
        errors.append(f"no pick for: {missing}")
    if extra:
        errors.append(f"picks for ids that are neither usda rows nor ingredients: {extra}")

    foods, kcal = load(a.sr_dir)
    out = {}
    for i in wanted:
        if i in PICKS:
            fid, want_desc, note = PICKS[i]
            got = lookup(fid, want_desc, foods, kcal, errors, i)
            if got:
                out[i] = {"fdcId": fid, "description": got[0], "kcal100": got[1], "dataset": "sr_legacy"}
                if note:
                    out[i]["note"] = note
        elif i in COMPOSITES:
            desc, fids, note = COMPOSITES[i]
            parts = [lookup(f, None, foods, kcal, errors, i) for f in fids]
            if all(parts):
                mean = round(sum(p[1] for p in parts) / len(parts), 1)
                out[i] = {"fdcId": None, "fdcIds": fids, "description": desc, "kcal100": mean, "dataset": "sr_legacy",
                          "note": note + " Values: " + ", ".join(f"{f} = {p[1]}" for f, p in zip(fids, parts)) + " kcal."}
    if errors:
        sys.exit("ERRORS:\n  " + "\n  ".join(errors))

    a.out.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {a.out}: {len(out)} foods ({len(usda_ids)} catalogue rows + {len(INGREDIENTS)} ingredients), "
          f"{sum('note' in v for v in out.values())} with notes")

    print("\nsanity check: |value - expected| > 25 % of expected")
    flagged = 0
    for i, v in out.items():
        exp = EXPECTED.get(i)
        if exp is None:
            print(f"  {i}: no expected value")
            continue
        if exp and abs(v["kcal100"] - exp) / exp > 0.25:
            flagged += 1
            print(f"  {i}: {v['kcal100']} vs ~{exp} ({(v['kcal100'] - exp) / exp:+.0%})  [{v['fdcId']}] {v['description']}")
    print(f"  {flagged} flagged")


if __name__ == "__main__":
    main()
