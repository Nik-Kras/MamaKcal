"""Turn the MacroTrack food spreadsheet into foods.json (the closed list the model maps onto).

Usage: python -I foods_from_xlsx.py <spreadsheet.xlsx> <out.json>
"""
import json
import re
import sys

import openpyxl


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def split(v) -> list[str]:
    return [a.strip() for a in str(v or "").split(";") if a.strip()]


def main(xlsx: str, out: str) -> None:
    rows = list(openpyxl.load_workbook(xlsx, read_only=True, data_only=True)["Products"].iter_rows(values_only=True))
    head_i = next(i for i, r in enumerate(rows) if r and r[1] == "category")
    cols = {name: j for j, name in enumerate(rows[head_i]) if name}
    foods, seen = [], set()
    for r in rows[head_i + 1 :]:
        if not r or not r[cols["product_name"]]:
            continue
        name = str(r[cols["product_name"]]).strip()
        fid = slug(name)
        if fid in seen:
            raise SystemExit(f"duplicate id {fid}")
        seen.add(fid)
        foods.append(
            {
                "id": fid,
                "kind": r[cols["category"]],
                "name": name,
                "name_ua": str(r[cols["product_name_ua"]] or "").strip(),
                "aliases": split(r[cols["aliases"]]),
                "aliases_ua": split(r[cols["aliases_ua"]]),
                "kcal100": float(r[cols["kcal"]]),
                "protein100": float(r[cols["protein_g"]]),
                "fat100": float(r[cols["fat_g"]]),
                "carbs100": float(r[cols["carbs_g"]]),
            }
        )
    with open(out, "w") as f:
        json.dump(foods, f, ensure_ascii=False, indent=1)
    print(f"{len(foods)} foods → {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
