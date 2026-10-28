"""Run Gemma 3n (LiteRT-LM, the runtime the phone would use) over the benchmark plates.

Usage: python -I run_gemma.py --model M.litertlm --bench bench.jsonl --foods foods.json --out out.jsonl
                              [--variant list|names] [--backend cpu|gpu] [--limit N]

Variants: --variant list (the food ids are in the prompt; the model answers with ids)
or names (no list; the model names foods, score.py maps names onto the list), and
--format lines (free text "food | grams", parsed by score.py) or json (constrained
decoding). Only the raw answer is saved; parsing lives in score.py. One fresh
conversation per photo; greedy decoding so a re-run gives the same answers.
Resumable: plates already in --out are skipped.
"""
import argparse
import json
import time
from pathlib import Path

import litert_lm as L

SYSTEM = (
    "You look at a photo of one plate of food and list what is on it, "
    "so that someone can log the calories."
)

# V1 "list": the whole food list is in the prompt and `id` is held to it.
PROMPT_LIST = """Food list (answer only with these ids):
{ids}

List every food you can see on the plate. For each one give the id from the list that matches it best, and your estimate of how many grams of it are on the plate. Use one entry per food; do not repeat an id. Ignore the plate, cutlery and anything that is not food."""

# V2 "names": no list; the model names each food and code maps the name onto the list.
PROMPT_NAMES = """List every food you can see on the plate. For each one give a short English name (1 to 3 words, for example "white rice", "grilled chicken", "broccoli") and your estimate of how many grams of it are on the plate. Use one entry per food. Ignore the plate, cutlery and anything that is not food."""

# Free-text answers in a fixed line format (constrained JSON decoding wrecks this
# model's answers: empty names, or ids copied from the top of the list).
LINES_LIST = """Food list:
{ids}

What foods are on this plate? For each food pick the id from the list above that matches it best. Answer with one line per food and nothing else, in the form:
<id> | <grams>
where <grams> is your best estimate of its weight on the plate. Ignore the plate, cutlery and anything that is not food."""

LINES_NAMES = """What foods are on this plate? Answer with one line per food and nothing else, in the form:
<food name> | <grams>
Use a short English name (1 to 3 words) and your best estimate of its weight on the plate in grams. Ignore the plate, cutlery and anything that is not food."""

MAX_ITEMS = 8
# Compact JSON: without this the model spends half its output on newlines and tabs.
COMPACT = {"x-guidance": {"whitespace_flexible": False}}


def schema(variant: str, ids: list[str]) -> dict:
    key = {"type": "string", "enum": ids} if variant == "list" else {"type": "string", "maxLength": 40}
    name = "id" if variant == "list" else "name"
    return {
        **COMPACT,
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "maxItems": MAX_ITEMS,
                "items": {
                    "type": "object",
                    "properties": {name: key, "grams": {"type": "integer", "minimum": 1, "maximum": 2000}},
                    "required": [name, "grams"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["items"],
        "additionalProperties": False,
    }


def text_of(message) -> str:
    """The reply's text, whatever shape this API version returns."""
    if isinstance(message, str):
        return message
    if isinstance(message, dict):
        parts = message.get("content", [])
    else:
        parts = getattr(message, "content", None) or getattr(message, "contents", None) or []
    out = []
    for p in parts if isinstance(parts, (list, tuple)) else [parts]:
        if isinstance(p, dict):
            out.append(p.get("text", ""))
        else:
            out.append(getattr(p, "text", "") or "")
    return "".join(out) or str(message)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--bench", required=True)
    ap.add_argument("--foods", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--backend", default="cpu", choices=["cpu", "gpu"])
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--variant", default="list", choices=["list", "names"])
    ap.add_argument("--format", default="lines", choices=["lines", "json"], help="json = constrained decoding")
    a = ap.parse_args()

    ids = [f["id"] for f in json.load(open(a.foods))]
    plates = [json.loads(l) for l in open(a.bench)]
    if a.limit:
        plates = plates[: a.limit]
    done = set()
    if Path(a.out).exists():
        done = {json.loads(l)["dish"] for l in open(a.out)}
    todo = [p for p in plates if p["dish"] not in done]
    print(f"{len(todo)} plates to run ({len(done)} already done)", flush=True)
    if not todo:
        return

    backend = L.Backend.GPU() if a.backend == "gpu" else L.Backend.CPU()
    # This model's image encoder only runs on a GPU (LiteRT refuses CPU for it),
    # so --backend picks where the language part runs.
    vision = L.Backend.GPU()
    if a.format == "json":
        prompt = PROMPT_LIST.format(ids="\n".join(ids)) if a.variant == "list" else PROMPT_NAMES
        fmt = L.ResponseFormat.json(schema(a.variant, ids))
    else:
        prompt = LINES_LIST.format(ids="\n".join(ids)) if a.variant == "list" else LINES_NAMES
        fmt = None
    t0 = time.time()
    with L.Engine(a.model, backend=backend, vision_backend=vision, max_num_tokens=4096, max_num_images=1, enable_benchmark=True) as engine:
        print(f"engine ready in {time.time() - t0:.1f}s ({a.backend})", flush=True)
        with open(a.out, "a") as out:
            for i, p in enumerate(todo, 1):
                conv = engine.create_conversation(
                    system_message=SYSTEM,
                    sampler_config=L.SamplerConfig(top_k=1, temperature=0.0, seed=0),
                    constrained_decoding_config=L.ConstrainedDecodingConfig(enable=True, provider=L.LiteRtLmConstraintProviderType.LL_GUIDANCE) if fmt else None,
                    max_output_tokens=200,
                )
                msg = L.Contents.of([L.Content.ImageFile(absolute_path=p["image"]), L.Content.Text(prompt)])
                t = time.time()
                try:
                    reply = conv.send_message(msg, response_format=fmt) if fmt else conv.send_message(msg)
                    raw, err = text_of(reply), None
                except Exception as e:  # keep going; the score counts it as a miss
                    raw, err = "", repr(e)
                secs = time.time() - t
                bench = None
                try:
                    info = conv.get_benchmark_info()
                    bench = {k: getattr(info, k) for k in dir(info) if not k.startswith("_") and not callable(getattr(info, k))}
                except Exception:
                    pass
                conv.close()
                rec = {"dish": p["dish"], "variant": a.variant, "format": a.format, "raw": raw, "error": err, "seconds": round(secs, 2), "bench": bench}
                out.write(json.dumps(rec, ensure_ascii=False, default=str) + "\n")
                out.flush()
                print(f"[{i}/{len(todo)}] {p['dish']} {secs:.1f}s {raw[:120]!r}", flush=True)


if __name__ == "__main__":
    main()
