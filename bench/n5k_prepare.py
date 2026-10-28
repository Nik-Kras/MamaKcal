"""Build the benchmark set: Nutrition5k plates expressed in our food list.

Usage: python -I n5k_prepare.py <n5k dir> <foods.json> <mapping.json> <n dishes> <seed> <out.jsonl>

A plate is kept when at least 85 % of its visible food (by weight) maps onto the
list. Its ground truth is then a list of our foods with grams:
  required  — visible, mapped, ≥ 10 g: the model should find these
  optional  — mapped but under 10 g, or cooking fat (hidden): no penalty either way
kcal_list is the plate's calories computed with OUR kcal values for the mapped
foods (what a perfect answer would give in the app); kcal_true is Nutrition5k's.
"""
import json
import random
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I: our own modules only
from n5k_ingredients import dishes

IMG_URL = "https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset/imagery/realsense_overhead/{}/rgb.png"
MIN_COVER = 0.85
MIN_VISIBLE_G = 10.0


def main(n5k_dir, foods_path, mapping_path, n, seed, out_path):
    n5k = Path(n5k_dir)
    foods = {f["id"]: f for f in json.load(open(foods_path))}
    mapping = {k: v for k, v in json.load(open(mapping_path)).items() if not k.startswith("_")}
    for name, m in mapping.items():
        if isinstance(m, dict):
            bad = [i for i in m["ids"] if i not in foods]
            if bad:
                raise SystemExit(f"mapping for {name!r} names unknown ids {bad}")
    overhead = set((n5k / "overhead_ids.txt").read_text().split())

    kept, skipped = [], defaultdict(int)
    for dish_id, kcal_true, mass_true, ingr in dishes(n5k):
        if dish_id not in overhead:
            continue
        missing = [name for name, _, _ in ingr if name not in mapping]
        if missing:
            raise SystemExit(f"{dish_id}: ingredients without a mapping entry: {missing}")
        visible = covered = 0.0
        req, opt = defaultdict(float), defaultdict(float)
        accept: dict[str, set] = defaultdict(set)
        kcal_list = 0.0
        for name, grams, _ in ingr:
            m = mapping[name]
            if m == "ignore":
                continue
            visible += grams
            if m is None:
                continue
            covered += grams
            primary = m["ids"][0]
            kcal_list += grams * foods[primary]["kcal100"] / 100
            accept[primary].update(m["ids"])
            (opt if m.get("hidden") else req)[primary] += grams
        if visible < 30:
            skipped["under 30 g of visible food"] += 1
            continue
        if covered / visible < MIN_COVER:
            skipped["under 85 % maps onto the list"] += 1
            continue
        # Required items under 10 g become optional: too small to judge from a photo.
        for fid in [f for f, g in req.items() if g < MIN_VISIBLE_G]:
            opt[fid] += req.pop(fid)
        if not req:
            skipped["no visible item of 10 g or more"] += 1
            continue
        kept.append(
            {
                "dish": dish_id,
                "required": [{"id": f, "grams": round(g, 1), "accept": sorted(accept[f])} for f, g in sorted(req.items(), key=lambda x: -x[1])],
                "optional": [{"id": f, "grams": round(g, 1), "accept": sorted(accept[f])} for f, g in sorted(opt.items(), key=lambda x: -x[1])],
                "kcal_list": round(kcal_list, 1),
                "kcal_true": round(kcal_true, 1),
                "mass_true": round(mass_true, 1),
            }
        )

    print(f"eligible plates: {len(kept)}; skipped: {dict(skipped)}")
    random.Random(seed).shuffle(kept)
    sample = kept[:n]

    img_dir = n5k / "img"
    img_dir.mkdir(exist_ok=True)
    for d in sample:
        dest = img_dir / f"{d['dish']}.png"
        if not dest.exists():
            with urllib.request.urlopen(IMG_URL.format(d["dish"]), timeout=60) as r:
                dest.write_bytes(r.read())
        d["image"] = str(dest.resolve())
    with open(out_path, "w") as f:
        for d in sample:
            f.write(json.dumps(d, ensure_ascii=False) + "\n")
    n_items = sum(len(d["required"]) for d in sample)
    print(f"sampled {len(sample)} plates ({n_items} required items) → {out_path}")


if __name__ == "__main__":
    a = sys.argv
    main(a[1], a[2], a[3], int(a[4]), int(a[5]), a[6])
