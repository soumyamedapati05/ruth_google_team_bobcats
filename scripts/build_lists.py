"""Merge researched listings, validate them, and write the two lists (spec §7.3).

  python3 scripts/build_lists.py raw1.json raw2.json ...

Each input file is {"listings": [...], "rejects": [...]}. Writes:
  data/gemini/scholarships.json, opportunities.json -- listings that passed every check
  data/gemini/needs_review.json                     -- probably fine, but a person must check (with reasons)
  data/gemini/rejects.json                          -- broke a rule (passed, paid, fee, duplicate...), with reasons

Checks: required fields, valid dates after today, NYC borough or online, free opportunities,
no duplicates, and every evidence quote found verbatim on the live source page.
Standard library only.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import subprocess
import sys
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

TODAY = date.today()
DATA = Path(__file__).resolve().parent.parent / "data" / "gemini"
BOROUGHS = {"Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"}
UA = "Mozilla/5.0 (compatible; ScoutStudentListings/0.1; student hackathon project)"
_page_cache: dict[str, str | None] = {}


def page_text(url: str) -> str | None:
    """Fetch a page and return normalized visible text, or None if it can't be fetched."""
    if url in _page_cache:
        return _page_cache[url]
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            body, ctype = r.read(), r.headers.get("Content-Type", "")
    except Exception:
        _page_cache[url] = None
        return None
    if "pdf" in ctype or url.lower().endswith(".pdf"):
        # PDFs (e.g. course flyers) need pdftotext from poppler; skip if it isn't installed.
        try:
            out = subprocess.run(["pdftotext", "-layout", "-", "-"], input=body, capture_output=True, timeout=30)
            text = norm(out.stdout.decode("utf-8", errors="replace"))
        except (OSError, subprocess.SubprocessError):
            text = None
        _page_cache[url] = text
        return text
    raw = body.decode("utf-8", errors="replace")
    raw = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", raw)
    text = norm(html.unescape(re.sub(r"(?s)<[^>]+>", " ", raw)))
    _page_cache[url] = text
    return text


def norm(s: str) -> str:
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = s.replace("–", "-").replace("—", "-").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip().lower()


def parse_date(v) -> date | None:
    if not v:
        return None
    return datetime.strptime(v, "%Y-%m-%d").date()


def check(item: dict) -> tuple[list[str], list[str]]:
    """Return (hard, soft) problems. Hard = breaks a rule -> rejects. Soft = something the page
    doesn't clearly state, or a quote that doesn't match -> needs a person to look."""
    hard, soft = [], []
    kind = item.get("kind")
    if kind not in ("scholarship", "opportunity"):
        return [f"bad kind {kind!r}"], []
    for f in ("title", "url", "source_url"):
        if not item.get(f):
            hard.append(f"missing {f}")
    if not set(item.get("school_levels") or []) <= {"HS", "college"}:
        soft.append("bad school_levels")

    try:
        if kind == "scholarship":
            d = parse_date(item.get("deadline"))
            if d and d <= TODAY:
                hard.append(f"deadline {d} has passed")
            if not d and not item.get("rolling"):
                soft.append("no deadline on the page (or no year) and not rolling")
            if item.get("is_sweepstakes"):
                hard.append("sweepstakes")
            if (item.get("requirements") or {}).get("application_fee"):
                hard.append("application fee")
        else:
            start, end = parse_date(item.get("start_date")), parse_date(item.get("end_date"))
            app = parse_date(item.get("application_deadline"))
            latest = max([x for x in (start, end, app) if x], default=None)
            if latest and latest <= TODAY and not item.get("recurring"):
                hard.append(f"dates passed ({latest})")
            if not latest and not item.get("recurring"):
                soft.append("no date on the page (or no year) and not recurring")
            if start and end and end < start:
                hard.append("end before start")
            cost = item.get("cost")
            if cost is None and item.get("type") == "campus_visit":
                # College admissions visits are free by convention but pages rarely say so.
                item["cost_note"] = "Cost not stated on the page; college admissions visits are normally free."
            elif cost is None:
                soft.append("cost not stated on the page")
            elif cost not in (0, 0.0):
                hard.append(f"not free (cost={cost!r})")
            borough = (item.get("location") or {}).get("borough")
            if not item.get("is_online") and borough not in BOROUGHS and not (item.get("location") or {}).get("citywide"):
                soft.append(f"borough not identified (borough={borough!r})")
    except ValueError as e:
        hard.append(f"bad date: {e}")

    # Evidence: every quote must appear word for word on the live source page.
    evidence = {k: v for k, v in (item.get("evidence") or {}).items() if v}
    if not evidence:
        soft.append("no evidence quotes")
    else:
        # A quote can live on a different official page than source_url (evidence_pages).
        pages = {k: (item.get("evidence_pages") or {}).get(k) or item.get("source_url") or item.get("url") for k in evidence}
        texts = {k: page_text(u) for k, u in pages.items()}
        if any(t is None for t in texts.values()):
            item["evidence_check"] = "page_unreachable"
            soft.append("source page unreachable, quotes not checked")
        else:
            missing = [k for k, q in evidence.items() if norm(q) not in texts[k]]
            item["evidence_check"] = "all_found" if not missing else f"not_found: {', '.join(missing)}"
            if missing:
                soft.append(f"quote not found word for word on the page: {', '.join(missing)}")
    return hard, soft


def main(paths: list[str]):
    listings, rejects, review, seen = [], [], [], set()
    for p in paths:
        blob = json.loads(Path(p).read_text(encoding="utf-8"))
        rejects += [{**r, "stage": "research", "file": Path(p).name} for r in blob.get("rejects", [])]
        listings += blob.get("listings", [])

    # Manual review (spec §7.3 step 5): corrections checked against the official pages, kept
    # separate from Gemini's output so it's clear what was changed by hand and why.
    reviewed_path = DATA / "reviewed.json"
    overrides = {r["title"]: r for r in json.loads(reviewed_path.read_text(encoding="utf-8"))} if reviewed_path.exists() else {}
    for item in listings:
        r = overrides.get(item.get("title"))
        if not r:
            continue
        for k, v in r.get("set", {}).items():
            if isinstance(v, dict) and isinstance(item.get(k), dict):
                item[k] = {**item[k], **v}
            else:
                item[k] = v
        item["review"] = {"by": r["reviewed_by"], "on": r["reviewed_on"], "note": r["note"]}

    passed = {"scholarship": [], "opportunity": []}
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for item in listings:
        key = (item.get("url", "").rstrip("/").lower(), norm(item.get("title", "")))
        if key in seen:
            rejects.append({"title": item.get("title"), "url": item.get("url"), "reason": "duplicate", "stage": "validate"})
            continue
        seen.add(key)
        hard, soft = check(item)
        if hard:
            rejects.append({"title": item.get("title"), "url": item.get("url"), "reason": "; ".join(hard + soft), "stage": "validate"})
            continue
        if soft:
            review.append({**item, "review_reasons": soft})
            continue
        item["id"] = hashlib.sha1(f"{item['url']}|{item['title']}".encode()).hexdigest()[:12]
        item.setdefault("is_sample", False)
        item.setdefault("extracted_at", now)
        # Extracted from an official page; a teammate still has to spot-check it (spec §7.3 step 7).
        item.setdefault("trust", "web_verified")
        item.setdefault("human_reviewed", False)
        passed[item["kind"]].append(item)

    DATA.mkdir(exist_ok=True)
    for kind, fname in (("scholarship", "scholarships.json"), ("opportunity", "opportunities.json")):
        rows = sorted(passed[kind], key=lambda x: (x.get("deadline") or x.get("application_deadline") or x.get("start_date") or "9999", x["title"]))
        (DATA / fname).write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (DATA / "rejects.json").write_text(json.dumps(rejects, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (DATA / "needs_review.json").write_text(json.dumps(review, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    checks = [i.get("evidence_check") for k in passed for i in passed[k]]
    print(f"scholarships: {len(passed['scholarship'])}  opportunities: {len(passed['opportunity'])}  "
          f"needs review: {len(review)}  rejects: {len(rejects)}")
    print("evidence:", {c: checks.count(c) for c in sorted(set(checks), key=str)})


if __name__ == "__main__":
    main(sys.argv[1:])
