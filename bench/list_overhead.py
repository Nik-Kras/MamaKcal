"""List Nutrition5k dishes that have an overhead RGB photo.

Usage: python -I list_overhead.py <out.txt>
"""
import json
import sys
import urllib.parse
import urllib.request

BASE = "https://storage.googleapis.com/storage/v1/b/nutrition5k_dataset/o"
PREFIX = "nutrition5k_dataset/imagery/realsense_overhead/"


def main(out_path: str) -> None:
    ids, token = [], None
    while True:
        q = {"prefix": PREFIX, "delimiter": "/", "maxResults": "1000"}
        if token:
            q["pageToken"] = token
        with urllib.request.urlopen(f"{BASE}?{urllib.parse.urlencode(q)}", timeout=60) as r:
            page = json.load(r)
        ids += [p[len(PREFIX):].strip("/") for p in page.get("prefixes", [])]
        token = page.get("nextPageToken")
        if not token:
            break
    with open(out_path, "w") as f:
        f.write("\n".join(sorted(ids)) + "\n")
    print(f"{len(ids)} dishes with an overhead photo")


if __name__ == "__main__":
    main(sys.argv[1])
