"""Score model answers against the benchmark ground truth.

Usage: python -I score.py <bench.jsonl> <foods.json> <answers.jsonl> [--show N] [--matcher match|match_v1]

Per plate, each answer line becomes (food id, grams): ids are checked against the
list, names go through match.py. Then:
  found / missed   required foods matched by an answer (any accepted id counts)
  extra            answers that match nothing on the plate (she taps ×)
  unknown          names that map to no food in the list (she has to pick one)
  edits            missed + extra + unknown: taps she needs beyond re-weighing
  gram error       on found foods, |answer − truth| / truth
  kcal error       |kcal from answers − kcal from truth| / kcal from truth, both
                   with OUR kcal values (kcal_list), so it measures the model only
Baseline for kcal: answering every plate with the set's average kcal.
"""
import json
import re
import statistics as st
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # run with -I: our own modules only
import importlib

BULLET = re.compile(r"^\s*(?:[-*•]\s+|\d+[.)]\s*)?\|?\s*")
SPLIT = re.compile(r"^(.+?)(?:\s*:\s*|\s+[-–—]\s+)(.*)$")
NUM = re.compile(r"(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?")


def parse(raw: str) -> list[tuple[str, float | None]]:
    """'Carrots | 150g' lines → [(name, grams)]. A range '30-40' gives its middle."""
    out = []
    for line in raw.replace("**", "").splitlines():
        # Split at the bar; failing that at a colon or a spaced dash ("Deep-fried chicken" stays whole).
        s = BULLET.sub("", line, count=1)
        if "|" in s:
            name, rest = s.split("|", 1)
        else:
            m = SPLIT.match(s)
            if not m:
                continue
            name, rest = m.group(1), m.group(2)
        name = name.strip().strip(" *")
        n = NUM.search(rest)
        grams = None
        if n:
            lo = float(n.group(1).replace(",", "."))
            hi = float(n.group(2).replace(",", ".")) if n.group(2) else lo
            grams = (lo + hi) / 2
        if name:
            out.append((name, grams))
    return out


def pct(x: list[float], q: float) -> float:
    xs = sorted(x)
    return xs[min(len(xs) - 1, int(q * len(xs)))] if xs else float("nan")


def main(bench_path, foods_path, answers_path, show=0, matcher="match"):
    foods = {f["id"]: f for f in json.load(open(foods_path))}
    match = importlib.import_module(matcher).load(foods_path)
    truth = {d["dish"]: d for d in map(json.loads, open(bench_path))}
    answers = [json.loads(l) for l in open(answers_path)]
    answers = [a for a in answers if a["dish"] in truth]

    found = missed = extra = unknown = req_total = 0
    mass_found = mass_total = 0.0
    gram_err, kcal_err, kcal_err_true, secs, edits, failed = [], [], [], [], [], 0
    examples = []
    for a in answers:
        d = truth[a["dish"]]
        secs.append(a["seconds"])
        if a.get("error"):
            failed += 1
        preds: dict[str, float] = {}
        unk = 0
        for name, grams in parse(a.get("raw") or ""):
            fid = match(name)
            if fid == "ignore":
                continue
            if fid is None:
                unk += 1
                continue
            preds[fid] = preds.get(fid, 0.0) + (grams if grams is not None else 100.0)
        used = set()
        f_here = m_here = 0
        for g in d["required"]:
            req_total += 1
            mass_total += g["grams"]
            hit = next((p for p in preds if p in g["accept"] and p not in used), None)
            if hit:
                used.add(hit)
                f_here += 1
                mass_found += g["grams"]
                gram_err.append(abs(preds[hit] - g["grams"]) / g["grams"])
            else:
                m_here += 1
        for g in d["optional"]:
            hit = next((p for p in preds if p in g["accept"] and p not in used), None)
            if hit:
                used.add(hit)
        x_here = len([p for p in preds if p not in used])
        found += f_here
        missed += m_here
        extra += x_here
        unknown += unk
        edits.append(m_here + x_here + unk)
        kcal_pred = sum(g * foods[fid]["kcal100"] / 100 for fid, g in preds.items())
        kcal_err.append(abs(kcal_pred - d["kcal_list"]) / d["kcal_list"])
        kcal_err_true.append(abs(kcal_pred - d["kcal_true"]) / max(d["kcal_true"], 1))
        if len(examples) < show:
            examples.append((a["dish"], [(g["id"], g["grams"]) for g in d["required"]], [(k, round(v)) for k, v in preds.items()], (a.get("raw") or "")[:160]))

    n = len(answers)
    mean_kcal = st.mean(truth[a["dish"]]["kcal_list"] for a in answers)
    base_err = [abs(mean_kcal - truth[a["dish"]]["kcal_list"]) / truth[a["dish"]]["kcal_list"] for a in answers]
    r = lambda x: f"{100 * x:.0f}%"
    print(f"plates {n}  (failed calls {failed})")
    print(f"foods found      {found}/{req_total} = {r(found / req_total)}   by weight {r(mass_found / mass_total)}")
    print(f"precision        {r(found / max(1, found + extra + unknown))}   extra {extra}, unknown names {unknown}")
    print(f"edits per plate  median {st.median(edits):.0f}, mean {st.mean(edits):.1f}  (plates needing none: {sum(e == 0 for e in edits)})")
    print(f"gram error       median {r(st.median(gram_err))}, p75 {r(pct(gram_err, 0.75))}  (on {len(gram_err)} found foods)")
    print(f"kcal error       median {r(st.median(kcal_err))}, p75 {r(pct(kcal_err, 0.75))}   vs Nutrition5k kcal: median {r(st.median(kcal_err_true))}")
    print(f"kcal baseline    median {r(st.median(base_err))} (always answer the average plate, {mean_kcal:.0f} kcal)")
    print(f"seconds          median {st.median(secs):.1f}, p90 {pct(secs, 0.9):.1f}")
    for dish, gt, pr, raw in examples:
        print(f"\n{dish}\n  truth  {gt}\n  answer {pr}\n  raw    {raw!r}")


if __name__ == "__main__":
    a = sys.argv
    show = int(a[a.index("--show") + 1]) if "--show" in a else 0
    matcher = a[a.index("--matcher") + 1] if "--matcher" in a else "match"
    main(a[1], a[2], a[3], show, matcher)
