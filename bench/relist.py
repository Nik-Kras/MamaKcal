"""Recompute a benchmark set's ground truth for a new food list, keeping the same plates.

n5k_prepare.py picks plates and downloads their images; when only the food list (and
n5k_to_list.json) change, this rebuilds required/optional/kcal_list for the plates
already in a set with the same rules, so scores stay comparable across lists.
Usage: python -I relist.py <n5k dir> <foods.json> <n5k_to_list.json> <set.jsonl> <out.jsonl>
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from n5k_prepare import MIN_VISIBLE_G, dishes  # noqa: E402


def main(n5k_dir, foods_path, mapping_path, set_path, out_path):
    foods = {f["id"]: f for f in json.load(open(foods_path))}
    mapping = {k: v for k, v in json.load(open(mapping_path)).items() if not k.startswith("_")}
    old = [json.loads(line) for line in open(set_path)]
    want = {d["dish"] for d in old}
    found = {}
    for dish_id, _kcal_true, _mass_true, ingr in dishes(Path(n5k_dir)):
        if dish_id not in want:
            continue
        req, opt = defaultdict(float), defaultdict(float)
        accept: dict[str, set] = defaultdict(set)
        kcal_list = visible = covered = 0.0
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
        for fid in [f for f, g in req.items() if g < MIN_VISIBLE_G]:
            opt[fid] += req.pop(fid)
        found[dish_id] = {
            "required": [{"id": f, "grams": round(g, 1), "accept": sorted(accept[f])} for f, g in sorted(req.items(), key=lambda x: -x[1])],
            "optional": [{"id": f, "grams": round(g, 1), "accept": sorted(accept[f])} for f, g in sorted(opt.items(), key=lambda x: -x[1])],
            "kcal_list": round(kcal_list, 1),
            "cover": covered / visible if visible else 0,
        }
    dropped, low = [], 0
    with open(out_path, "w") as f:
        for d in old:
            new = found.get(d["dish"])
            if not new or not new["required"] or new["kcal_list"] <= 0:
                dropped.append(d["dish"])
                continue
            low += new["cover"] < 0.85
            d = {**d, **{k: v for k, v in new.items() if k != "cover"}}
            f.write(json.dumps(d, ensure_ascii=False) + "\n")
    print(f"{set_path}: {len(old) - len(dropped)} of {len(old)} plates kept; {low} now under 85 % covered; dropped {dropped}")


if __name__ == "__main__":
    main(*sys.argv[1:6])
