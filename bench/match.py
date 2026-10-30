"""Map a free-text food name ("Roasted squash cubes") onto a food in our list.

Exact name/alias matches win; otherwise the food sharing the most words wins,
with cooking/shape words worth less than the food itself. A plain generic word
("rice", "fish") falls back to the everyday default in GENERIC. Returns None
when nothing shares a food word — the app then asks her to pick — and IGNORE
for seasonings and herbs. v2: berries, arugula, seasonings, cooked over raw. v3: a single food word
never lands on a dish with extra food words when it has a generic default.
"""
import json
import re

# Words that describe form or cooking, not the food: they break ties only.
MINOR = {
    "cooked", "raw", "fresh", "sliced", "slices", "slice", "cubes", "cube", "cubed", "chunks", "chunk",
    "pieces", "piece", "florets", "floret", "wedges", "wedge", "strips", "strip", "diced", "chopped",
    "roasted", "grilled", "fried", "baked", "boiled", "steamed", "sauteed", "mashed", "scrambled",
    "whole", "plain", "small", "large", "mixed", "baby", "cherry", "red", "yellow",
    "white", "brown", "of", "and", "with", "in", "a", "the", "style", "patty", "fries",
}
# A bare generic word → the everyday food it most likely is.
GENERIC = {
    "rice": "white-rice-cooked", "potato": "potato-boiled", "chicken": "chicken-breast-cooked",
    "fish": "cod-cooked", "egg": "eggs-whole", "bread": "white-bread", "cheese": "cheddar-cheese",
    "salad": "mixed-greens", "greens": "mixed-greens", "green": "mixed-greens", "lettuce": "mixed-greens", "squash": "zucchini",
    "beef": "beef-steak-raw", "pork": "pork-chop-cooked", "berries": "berries-mix", "berry": "berries-mix",
    "yogurt": "greek-yogurt-full-fat", "milk": "whole-milk", "beans": "kidney-beans-cooked", "bean": "kidney-beans-cooked",
    "oil": "olive-oil", "sausage": "pork-sausage", "noodles": "pasta-cooked", "spaghetti": "pasta-cooked",
    "melon": "watermelon", "cantaloupe": "watermelon", "turkey": "turkey-breast-cooked", "pepper": "bell-pepper",
    "peppers": "bell-pepper", "tomatoes": "tomato", "carrot": "carrots-raw", "nuts": "almonds",
    "varenyky": "varenyky-potato", "dumplings": "varenyky-potato", "pancakes": "mlyntsi",
    "raspberry": "berries-mix", "raspberries": "berries-mix", "blackberry": "berries-mix", "blackberries": "berries-mix",
    "arugula": "mixed-greens", "rocket": "mixed-greens",
}
# Not logged: seasonings and herbs. A name made only of these maps to IGNORE.
SEASONING = {"onion", "onions", "garlic", "parsley", "cilantro", "coriander", "dill", "basil", "chive", "chives",
             "herb", "herbs", "lemon", "lime", "salt", "mint", "thyme", "rosemary", "ginger", "scallion", "scallions"}
IGNORE = "ignore"


def stem(w: str) -> str:
    for suf, rep in (("ies", "y"), ("oes", "o"), ("es", "e"), ("s", "")):
        if len(w) > 3 and w.endswith(suf) and not w.endswith("ss"):
            return w[: -len(suf)] + rep
    return w


def words(s: str) -> list[str]:
    return [stem(w) for w in re.findall(r"[a-z]+", s.lower())]


class Matcher:
    def __init__(self, foods: list[dict]):
        self.ids = {f["id"] for f in foods}
        self.exact: dict[str, str] = {}
        self.cands: list[tuple[str, set[str], set[str], bool]] = []  # id, food words, minor words, name (not alias)
        for f in foods:
            for li, label in enumerate([f["name"], f["id"].replace("-", " "), *f.get("aliases", [])]):
                key = " ".join(words(label))
                # Food on a plate is cooked: when raw and cooked share a name, cooked wins.
                if key not in self.exact or (self.exact[key].endswith("-raw") and "cooked" in f["id"]):
                    self.exact[key] = f["id"]
                ws = set(words(label))
                self.cands.append((f["id"], ws - {stem(m) for m in MINOR}, ws & {stem(m) for m in MINOR}, li < 2))
        self.minor = {stem(m) for m in MINOR}
        self.generic = {stem(k): v for k, v in GENERIC.items()}
        self.ignore = {stem(w) for w in SEASONING}

    def __call__(self, name: str) -> str | None:
        if name.strip().lower().replace(" ", "-") in self.ids:
            return name.strip().lower().replace(" ", "-")
        ws = words(name)
        if not ws:  # no English words at all
            return None
        key = " ".join(ws)
        if key in self.exact:
            return self.exact[key]
        core = {w for w in ws if w not in self.minor}
        if not core:
            return None
        # Seasonings and herbs are not logged (the ground truth ignores them too).
        if core <= self.ignore:
            return IGNORE
        # A name that is just one generic word ("cheese", "rice") means the everyday
        # food, not whichever dish happens to contain the word. "Varenyky with
        # cherries" is not just one word, so it goes on to the full match.
        content = [w for w in ws if w not in {"of", "and", "with", "in", "a", "the"}]
        if len(content) == 1 and content[0] in self.generic:
            return self.generic[content[0]]
        best, best_score, best_core, best_primary = None, 0.0, set(), False
        for fid, fcore, fminor, primary in self.cands:
            shared = len(core & fcore)
            if not shared:
                continue
            # Share of both sides' food words, plus a little for matching form words;
            # raw versions lose ties against cooked ones.
            score = shared / len(core | fcore) + 0.1 * len(set(ws) & fminor) - (0.05 if fid.endswith("-raw") else 0)
            if score > best_score:
                best, best_score, best_core, best_primary = fid, score, fcore, primary
        # One food word with a generic default ("fried potatoes") must not land on a
        # dish that has more food words than the name, or only lists it as an alias
        # ("potato with beans", whose alias is "baked potato").
        if len(core) == 1 and (best_core != core or not best_primary):
            w = next(iter(core))
            if w in self.generic:
                return self.generic[w]
        if best and best_score >= 0.5:
            return best
        # In word order (a set's order changes between runs).
        for w in ws:
            if w in core and w in self.generic:
                return self.generic[w]
        return best


def load(foods_path: str) -> Matcher:
    return Matcher(json.load(open(foods_path)))
