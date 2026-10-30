# Food-photo benchmark: Gemma 3n on our food list

Question: can an on-device model look at a plate and return **foods from our list
with grams**, well enough to pre-fill the check screen?

## Setup

- **Model:** `google/gemma-3n-E2B-it-litert-lm`, file `gemma-3n-E2B-it-int4.litertlm` (3.7 GB), run with
  LiteRT-LM (`litert-lm-api` 0.18.1), the same runtime and file the phone would use. Its image encoder
  only runs on a GPU (LiteRT rejects a CPU vision backend). Greedy decoding.
- **Food list:** until 2026-10-30 the MacroTrack spreadsheet (202 foods); since then the Ukrainian list in
  `catalogue/` (195 foods, sourced values; `data/foods.json` is a copy of `../src/data/foods.json`).
- **Photos with weighed ground truth:** [Nutrition5k](https://github.com/google-research-datasets/Nutrition5k)
  overhead photos, where every ingredient on the plate was weighed.
  - `n5k_to_list.json` maps each of the 241 Nutrition5k ingredients onto our list. Several ids may count
    as correct (cantaloupe → watermelon or mango); seasonings are ignored; cooking oil and butter are
    "hidden" (counted in calories, never required); ingredients with nothing close are null.
  - A plate is eligible when ≥ 85 % of its visible food (by weight) maps onto the list: 2 413 of 3 490.
    Foods under 10 g become optional.
  - **Test set:** 150 plates (seed 7, 399 required foods). **Dev set:** 12 other plates, used for all
    prompt and matcher tuning. The matcher was frozen before the test set was scored.
- Nutrition5k is US cafeteria food, not her cooking: these numbers say how well the model sees and maps
  food in general. A re-run on her own photographed and weighed meals is the real test.

## Variants

| Variant | Prompt | Answer |
|---|---|---|
| `--variant list` | the 202 food ids are in the prompt | `id \| grams` lines |
| `--variant names` | no list | `food name \| grams` lines; `match.py` maps each name onto the list (names, aliases, generic defaults) |
| `--format json` | either | constrained JSON decoding (llguidance) |

Constrained JSON was dropped after the dev run: the model returned empty names or copied ids from the
top of the list. Free text in a fixed line format reads the same photos well.

## Metrics (`score.py`)

- **found**: required foods matched by an answer (any accepted id).
- **edits per plate**: missed + extra + unrecognised names, i.e. the taps she needs beyond re-weighing.
- **gram error**: on found foods, |answer − truth| / truth. She re-weighs anyway; this is the pre-fill.
- **kcal error**: |kcal from answers − kcal from truth| / truth, both with our kcal values, so it measures
  the model and not our table. Baseline: answering every plate with the set's average kcal.
- **seconds**: per photo on this Mac (Apple Silicon, GPU). Phone speed has to be measured on the S21.

## Reproduce

```bash
cd bench
uv venv .venv -p 3.11 && uv pip install --python .venv/bin/python litert-lm-api openpyxl pillow huggingface_hub
cp ../src/data/foods.json data/foods.json          # the app's list (catalogue/README.md)
.venv/bin/python -I list_overhead.py data/n5k/overhead_ids.txt        # after downloading the metadata CSVs
.venv/bin/python -I n5k_prepare.py data/n5k data/foods.json n5k_to_list.json 150 7 data/n5k/bench.jsonl
.venv/bin/python -I run_gemma.py --model data/models/gemma-3n-E2B-it-int4.litertlm --bench data/n5k/bench.jsonl \
    --foods data/foods.json --out data/out/test_names_lines.jsonl --backend gpu --variant names --format lines
.venv/bin/python -I score.py data/n5k/bench.jsonl data/foods.json data/out/test_names_lines.jsonl --show 5
```

## Results (2026-10-28)

All runs: LiteRT-LM on this Mac's GPU, greedy decoding. Test set scored with the frozen matcher
`match_v1.py`; the holdout set (150 further plates, never looked at) with `match.py` (v2, fixes found in
the test-set error analysis). Baseline kcal error, answering every plate with the average plate: 58 % (test), 57 % (holdout).

| Model, variant | Set | Found | Precision | Edits / plate (mean) | No edits needed | Gram error (median) | kcal error (median) | s / photo |
|---|---|---|---|---|---|---|---|---|
| E2B, list in prompt | test | 40 % | 10 % | 11.4 | 24 / 150 | 48 % | 259 % | 8.7 |
| **E2B, name → map** | test | 55 % | 49 % | 2.7 | 39 / 150 | 47 % | 44 % | 2.0 |
| **E2B, name → map** | holdout | 58 % | 53 % | 2.3 | 41 / 150 | 47 % | 45 % | 1.7 |
| E4B, name → map | test | 56 % | 53 % | 2.5 | 43 / 150 | 41 % | 42 % | 2.4 |
| E4B, name → map | holdout | 58 % | 55 % | 2.2 | 45 / 150 | 39 % | 35 % | 2.4 |

Findings:
- **The list in the prompt fails.** On 46 of 150 test plates the answer is the top of the list
  (borscht, green-borscht, varenyky…). It is also 4× slower: 1 360 prompt tokens instead of ~300.
- **Name → map works best.** The model describes the plate well in its own words and code does the mapping.
  It finds about 55–58 % of foods; about a quarter of plates need no change; the rest need 2–3 taps
  (add a missed food, remove an extra one).
- **Grams are a rough pre-fill** (median 47 % off). Re-weighing stays essential, as designed.
- **E4B ≈ E2B** at finding foods; better grams; 1.3× the size and slower. E2B fits the S21 better.
- **Constrained JSON decoding broke the answers** (empty names, list recitation); free text in a fixed
  line format does not.
- **Common model mistakes:** meat called "meat patty"/"chicken", melon missed, sweet potato read as potato,
  extra tomato/cucumber that is not there.
- **Not measured yet:** speed and memory on the Galaxy S21 itself, and accuracy on her own food.

## New food list (2026-10-30)

The list became Ukrainian home food (`catalogue/`, decision D22). The same plates and the same saved model answers,
re-scored on it: `relist.py` rebuilds each set's ground truth for the new list (same plates; quinoa, couscous, bulgur,
tofu, avocado and other foods no longer in the list are left out of the truth), then `score.py`.

| Set | Foods found | Precision | Edits per plate | Unknown names |
|---|---:|---:|---:|---:|
| test (149 plates) | 60 % | 54 % | 2.4 | 28 |
| holdout (150 plates) | 60 % | 51 % | 2.3 | 28 |

On par with the old list (holdout 58 % found, 2.3 edits) although these are American plates. The matcher now ignores
garnish even where the list has the food (onion and lemon are recipe ingredients) and, on a tie, prefers the everyday
food («Potato cubes» → boiled potatoes, not the fried-potato dish).

```bash
for s in bench holdout dev; do .venv/bin/python -I relist.py data/n5k data/foods.json n5k_to_list.json data/n5k/$s.jsonl data/n5k/ua/$s.jsonl; done
.venv/bin/python -I score.py data/n5k/ua/holdout.jsonl data/foods.json data/out/holdout_E2B_names.jsonl
```

