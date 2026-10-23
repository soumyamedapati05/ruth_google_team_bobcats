"""Extract listings from official source pages with Gemini (spec §7.3, optional bulk path).

  GEMINI_API_KEY=... python3 scripts/gemini_extract.py sources1.json sources2.json ... -o out.json

Each input file is {"listings": [...]} from source research; only each listing's `source_url`
and `title` are used. Pages are grouped by source_url, the researched titles are passed as a
hint, and Gemini extracts the listing fields from the page text. The output has the same
shape as the input ({"listings", "rejects"}) and feeds scripts/build_lists.py, which checks
every evidence quote against the live page.

Env: GEMINI_API_KEY (required), GEMINI_MODEL (default gemini-flash-latest). Standard library only.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROMPT = (ROOT / "prompts" / "extract_listings.md").read_text(encoding="utf-8")
CACHE = ROOT / ".cache" / "gemini"
MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
UA = "Mozilla/5.0 (compatible; ScoutStudentListings/0.1; student hackathon project)"


def fetch_text(url: str) -> str | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read().decode("utf-8", errors="replace")
    except Exception:
        return None
    raw = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?i)<(br|/p|/div|/li|/h[1-6]|/tr)[^>]*>", "\n", raw)
    text = html.unescape(re.sub(r"(?s)<[^>]+>", " ", raw))
    text = re.sub(r"[ \t ]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n", text).strip()


def gemini(prompt: str) -> dict:
    key = hashlib.sha1(f"{MODEL}|{prompt}".encode()).hexdigest()
    cached = CACHE / f"{key}.json"
    if cached.exists():
        return json.loads(cached.read_text(encoding="utf-8"))
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
    }).encode()
    req = urllib.request.Request(API.format(model=MODEL), data=body, headers={
        "Content-Type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                resp = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and attempt < 4:
                time.sleep(5 * 2 ** attempt)
                continue
            raise
    out = json.loads(resp["candidates"][0]["content"]["parts"][0]["text"])
    CACHE.mkdir(parents=True, exist_ok=True)
    cached.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("-o", "--out", required=True)
    args = ap.parse_args()

    pages: dict[str, list[str]] = defaultdict(list)
    for p in args.inputs:
        for item in json.loads(Path(p).read_text(encoding="utf-8")).get("listings", []):
            src = item.get("source_url") or item.get("url")
            if src:
                pages[src].append(item["title"])

    listings, rejects = [], []
    for i, (url, titles) in enumerate(pages.items(), 1):
        text = fetch_text(url)
        if not text or len(text) < 300:
            rejects += [{"title": t, "url": url, "reason": "page unreachable or needs a browser"} for t in titles]
            print(f"[{i}/{len(pages)}] skip (no text) {url}", file=sys.stderr)
            continue
        hint = ("The team identified these listings on this page; extract exactly these if present, "
                "and nothing else: " + "; ".join(sorted(set(titles))) + ".")
        prompt = (PROMPT.replace("{today}", date.today().isoformat()).replace("{hint}", hint)
                  .replace("{url}", url).replace("{page_text}", text[:60000]))
        try:
            got = gemini(prompt).get("listings", [])
        except Exception as e:
            rejects += [{"title": t, "url": url, "reason": f"gemini error: {e}"} for t in titles]
            print(f"[{i}/{len(pages)}] error {url}: {e}", file=sys.stderr)
            continue
        for item in got:
            item["source_url"] = url
            item["url"] = item.get("url") or url
            item["extracted_by"] = f"gemini:{MODEL}"
        listings += got
        print(f"[{i}/{len(pages)}] {len(got)} listing(s) from {url}", file=sys.stderr)
        time.sleep(1)

    Path(args.out).write_text(json.dumps({"listings": listings, "rejects": rejects}, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"gemini ({MODEL}): {len(listings)} listings, {len(rejects)} rejects -> {args.out}")


if __name__ == "__main__":
    main()
