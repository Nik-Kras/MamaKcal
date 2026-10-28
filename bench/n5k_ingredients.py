"""Count Nutrition5k ingredients over dishes that have an overhead photo.

Usage: python -I n5k_ingredients.py <n5k dir> <out.tsv>
Writes: ingredient, dishes it appears in, total grams (sorted by grams).
"""
import collections
import csv
import sys
from pathlib import Path


def dishes(n5k: Path):
    """Yield (dish_id, total_kcal, total_mass, [(ingredient, grams, kcal), ...])."""
    for name in ("dish_metadata_cafe1.csv", "dish_metadata_cafe2.csv"):
        with open(n5k / name, newline="") as f:
            for row in csv.reader(f):
                if not row or not row[0].startswith("dish_"):
                    continue
                ingr = []
                for i in range(6, len(row) - 6, 7):
                    ingr.append((row[i + 1].strip(), float(row[i + 2]), float(row[i + 3])))
                yield row[0], float(row[1]), float(row[2]), ingr


def main(n5k_dir: str, out: str) -> None:
    n5k = Path(n5k_dir)
    overhead = set((n5k / "overhead_ids.txt").read_text().split())
    count, grams = collections.Counter(), collections.Counter()
    n = 0
    for dish_id, _, _, ingr in dishes(n5k):
        if dish_id not in overhead:
            continue
        n += 1
        for name, g, _ in ingr:
            count[name] += 1
            grams[name] += g
    total = sum(grams.values())
    with open(out, "w") as f:
        cum = 0.0
        for name, g in grams.most_common():
            cum += g
            f.write(f"{name}\t{count[name]}\t{g:.0f}\t{cum / total:.3f}\n")
    print(f"{n} dishes, {len(grams)} ingredients → {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
