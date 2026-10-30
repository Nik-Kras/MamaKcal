"""Build the app's food list (src/data/foods.json) from the sourced catalogue.

  items.json   - the list (python -I items.py)
  usda.json    - USDA FoodData Central values by FDC id      (python -I usda.py <csv dir>)
  labels.json  - Ukrainian product labels / DSTU
  recipes.json - home-style recipes: ingredient grams and cooked weight

A recipe dish is calculated the way food-composition tables do it: the sum of its
ingredients' kcal divided by the cooked weight of the batch. Each dish is compared
with its published reference values; a gap over FLAG is listed in REVIEW.md.
Run: python -I build.py   (writes ../../src/data/foods.json, renamed.json and REVIEW.md)
"""
import json
import pathlib
import statistics

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent.parent / "src" / "data" / "foods.json"
FLAG = 0.20
FREE = {"water", "salt"}


def load(name: str) -> dict:
    return json.loads((HERE / name).read_text())


def main() -> None:
    items = load("items.json")
    usda, labels, recipes = load("usda.json"), load("labels.json"), load("recipes.json")
    old = {}
    old_path = HERE / "old_foods.json"
    if old_path.exists():
        old = {f["id"]: f["kcal100"] for f in json.loads(old_path.read_text())}

    kcal: dict[str, float] = {}
    source: dict[str, dict] = {}
    for k, v in usda.items():
        kcal[k] = v["kcal100"]
        source[k] = {"type": "usda", "ref": f"FDC {v['fdcId']}: {v['description']}"}
    for k, v in labels.items():
        kcal[k] = v["kcal100"]
        source[k] = {"type": "label", "ref": v.get("basis", "")}

    missing = [it["id"] for it in items if it["source"] != "recipe" and it["id"] not in kcal]
    if missing:
        raise SystemExit(f"no value for: {missing}")

    review = []
    for it in items:
        if it["source"] != "recipe":
            continue
        r = recipes.get(it["id"])
        if not r:
            raise SystemExit(f"no recipe for {it['id']}")
        total = 0.0
        for ing in r["ingredients"]:
            iid, g = ing["id"], float(ing["g"])
            if iid in FREE:
                continue
            if iid not in kcal:
                raise SystemExit(f"{it['id']}: unknown ingredient {iid}")
            total += g * kcal[iid] / 100
        per100 = total * 100 / float(r["cooked_g"])
        kcal[it["id"]] = per100
        refs = [x["kcal100"] for x in r.get("references", []) if isinstance(x.get("kcal100"), (int, float))]
        ref = statistics.median(refs) if refs else None
        gap = (per100 - ref) / ref if ref else None
        source[it["id"]] = {"type": "recipe", "ref": r["recipe_source"]}
        review.append((it, per100, refs, gap))

    foods = []
    for it in items:
        f = {
            "id": it["id"],
            "name": it["name"],
            "nameEn": it["nameEn"],
            "aliases": it["aliases"],
            "aliasesUa": it["aliasesUa"],
            "kcal100": round(kcal[it["id"]]),
            "source": source[it["id"]],
        }
        if "pcGrams" in it:
            f["pcGrams"] = it["pcGrams"]
        foods.append(f)
    OUT.write_text(json.dumps(foods, ensure_ascii=False, indent=1) + "\n")
    (OUT.parent / "renamed.json").write_text((HERE / "renamed.json").read_text())

    lines = [
        "# Food list review",
        "",
        f"{len(foods)} foods: " + ", ".join(f"{t} {sum(1 for f in foods if f['source']['type'] == t)}" for t in ("usda", "label", "recipe")),
        "",
        "## Dishes calculated from recipes",
        "",
        "| Dish | Old | New | References | Gap |",
        "|---|---:|---:|---|---:|",
    ]
    for it, per100, refs, gap in sorted(review, key=lambda x: -abs(x[3] or 0)):
        flag = " ⚠" if gap is not None and abs(gap) > FLAG else ""
        lines.append(
            f"| {it['name']} | {old.get(it['id'], '')} | {round(per100)} | {', '.join(str(round(x)) for x in refs)} | "
            f"{'' if gap is None else f'{gap:+.0%}'}{flag} |"
        )
    lines += ["", "## Kept foods: old vs new", "", "| Food | Old | New | Source |", "|---|---:|---:|---|"]
    for f in foods:
        if f["id"] in old and f["source"]["type"] != "recipe":
            lines.append(f"| {f['name']} | {old[f['id']]} | {f['kcal100']} | {f['source']['type']} |")
    (HERE / "REVIEW.md").write_text("\n".join(lines) + "\n")
    flagged = sum(1 for *_, g in review if g is not None and abs(g) > FLAG)
    print(f"wrote {OUT.name}: {len(foods)} foods; {flagged} dishes off their references by > {FLAG:.0%}")


if __name__ == "__main__":
    main()
