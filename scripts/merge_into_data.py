"""Merge the Gemini-extracted listings (data/gemini/) into data/scholarships.json and
data/opportunities.json, converting them to the schema in data/schema/.

  python3 scripts/merge_into_data.py          # then: node data/scripts/check.mjs

Rachel's listings and samples are kept as they are. A Gemini listing is skipped when the
same program is already in data/ (Rachel's version wins). Pool estimates follow the method
in data/README.md (scope default, shrunk per extra restriction) and say how they were reached.
Standard library only.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA, GEM = ROOT / "data", ROOT / "data" / "gemini"
BOROUGHS = {"Bronx", "Brooklyn", "Manhattan", "Queens", "Staten Island"}
STOP = {"the", "of", "and", "for", "scholarship", "scholarships", "program", "2026", "2027", "new", "york",
        "nyc", "university", "college", "fund", "award", "undergraduate", "a", "in", "at", "s"}
# Same program already in data/ under a different title (Gemini title -> existing id).
KNOWN_OVERLAPS = {
    "Jackie Robinson Foundation Scholarship": "sch-jackie-robinson-foundation",
    "Belle Zeller Scholarship (Undergraduate)": "sch-belle-zeller",
    "Paul & Daisy Soros Fellowships for New Americans": "sch-paul-daisy-soros",
    "Tuition Assistance Program (TAP)": "sch-nys-tap",
    "City College of New York 2026 Undergraduate Open House": "opp-ccny-open-house-2026",
    "MSK Summer Student Program 2027": "opp-msk-summer-student-program",
    "The Cooper Union Saturday Program (Spring 2027 semester)": "opp-cooper-union-saturday-program",
}
# National awards from organizations confirmed to be NYC-based (data/README.md convention:
# "(New York, NY)" in the provider name).
NYC_BASED = {"Overseas Press Club Foundation", "Equitable", "Spencer Educational Foundation", "Columbus Citizens Foundation"}
# HESC awards where everyone eligible who applies receives it.
ENTITLEMENTS = {"NYS Memorial Scholarship", "NYS World Trade Center Memorial Scholarship", "Aid to Native Americans"}
# Location facts confirmed on the official pages during review (quote + page).
EXTRA = {
    "SEO Scholars New York (Class of 2030 application)": {
        "location": {"venue": "Baruch College (Manhattan) and LIU Brooklyn", "borough": "Manhattan", "address": None},
        "evidence": [{"field": "location", "quote": "Saturday and Summer Academy are held at Baruch College and LIU Brooklyn.",
                      "page": "https://www.seo-usa.org/scholars/faqs/"}],
        "url": "https://scholars.seo-usa.org/apply-new-york/",
    },
}


def slug(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")[:48].rstrip("-")


def toks(t: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", t.lower()) if w not in STOP}


def class_years(vals: list[str]) -> list[str]:
    out = []
    for v in vals or []:
        v = v.lower()
        if m := re.search(r"hs\D*(9|10|11|12)", v):
            out.append(f"hs_{m.group(1)}")
        elif m := re.search(r"college\D*([1-4])", v):
            out.append(f"college_{m.group(1)}")
        elif "grad" in v:
            out.append("grad")
    return sorted(set(out), key=out.index)


def citizenship(vals: list[str]) -> list[str]:
    out = []
    for v in vals or []:
        v = v.lower()
        for key, enum in (("citizen", "us_citizen"), ("permanent", "permanent_resident"), ("daca", "daca"),
                          ("undocumented", "undocumented"), ("international", "international")):
            if key in v and enum not in out:
                out.append(enum)
    return out


def geo(el: dict, item: dict) -> tuple[str, list[str]]:
    res = (el.get("residency") or "").lower()
    statewide = "hesc.ny.gov" in item.get("source_url", "") or "statewide" in item["title"].lower()
    if statewide:
        return "state", ["NYS"]
    if el.get("enrolled_at") or el.get("nyc_only"):
        return "city", ["NYC"]
    if "new york state" in res or "nys" in res or re.search(r"\bny\b", res):
        return "state", ["NYS"]
    if item["kind"] == "opportunity":
        return "city", ["NYC"]
    return "national", ["US"]


def evidence(item: dict) -> list[dict]:
    pages = item.get("evidence_pages") or {}
    out = []
    for field, quote in (item.get("evidence") or {}).items():
        if not quote:
            continue
        name = field
        if item["kind"] == "opportunity" and field == "date":
            # check.mjs wants a "deadline" quote whenever application_deadline is set.
            has_deadline_quote = "deadline" in (item.get("evidence") or {})
            name = "deadline" if item.get("application_deadline") and not has_deadline_quote else "dates"
        e = {"field": name, "quote": quote[:400]}
        if pages.get(field):
            e["page"] = pages[field]
        out.append(e)
    return out


def trust_note(item: dict) -> str:
    parts = [f"Extracted by Gemini ({item.get('extracted_by', 'gemini').split(':')[-1]}) from the official page; "
             "every quote confirmed word for word on the live page by scripts/build_lists.py."]
    if item.get("review"):
        parts.append(f"Manual check: {item['review']['note']}")
    if item.get("cost_note"):
        parts.append(item["cost_note"])
    if item.get("notes"):
        parts.append(item["notes"])
    return " ".join(parts)


def amount_period(item: dict) -> str | None:
    if item.get("amount_max") is None and item.get("amount_min") is None:
        return None
    text = " ".join([item.get("summary") or "", (item.get("evidence") or {}).get("amount") or ""]).lower()
    if re.search(r"over (two|three|four|2|3|4) years|total", text):
        return "total_multi_year"
    if re.search(r"per year|annually|a year|/yr|each year|renewable", text):
        return "per_year"
    return "one_time"


def pool(item: dict, el: dict, scope: str) -> tuple[int | None, str | None]:
    if item["title"] in ENTITLEMENTS:
        return None, None
    if item.get("published_applicants"):
        return item["published_applicants"], "Provider published the applicant count."
    if el.get("enrolled_at"):
        start, why = 40, f"single-school award ({', '.join(el['enrolled_at'])[:60]}): starts at 40"
    else:
        start, why = {"city": 300, "state": 800, "national": 5000}.get(scope, 5000), f"{scope} scope: starts at " + \
            str({"city": 300, "state": 800, "national": 5000}.get(scope, 5000))
    n, cuts = start, []
    for label, hit in (("identity group", el.get("identity_groups")), ("major/field", el.get("majors")),
                       ("GPA floor", el.get("min_gpa")), ("specific class years", el.get("class_years"))):
        if hit:
            n, cuts = max(10, n // 2), cuts + [label]
    basis = why + (f", halved for each restriction ({', '.join(cuts)})" if cuts else ", no extra restrictions") + \
        f" -> {n}. Estimate, not a published count."
    return n, basis


def convert(item: dict, existing_ids: set[str]) -> dict:
    kind = item["kind"]
    prefix = "sch-" if kind == "scholarship" else "opp-"
    base = prefix + slug(item["title"])
    lid, i = base, 2
    while lid in existing_ids:
        lid, i = f"{base}-{i}", i + 1
    existing_ids.add(lid)

    g = item.get("eligibility") or {}
    scope, areas = geo(g, item)
    levels = [lv for lv in item.get("school_levels") or [] if lv in ("HS", "college")]
    if not levels:
        # Undergraduate admissions events are for prospective first-years and transfers.
        levels = ["college"] if "transfer" in item["title"].lower() else ["HS", "college"]
    el = {
        "class_years": class_years(g.get("class_years")),
        "min_gpa": g.get("min_gpa") if isinstance(g.get("min_gpa"), (int, float)) and g["min_gpa"] <= 4.0 else None,
        "max_age": g.get("max_age"),
        "citizenship": citizenship(g.get("citizenship")),
        "majors": g.get("majors") or [],
        "identity_groups": g.get("identity_groups") or [],
        "need_based": g.get("need_based"),
        "nyc_only": g.get("nyc_only") if kind == "scholarship" else True,
        "geo_scope": scope,
        "geo_areas": areas,
        "enrolled_at": g.get("enrolled_at") or [],
        "prerequisites": [],
    }
    url = item["url"].replace("http://", "https://", 1)
    provider = item.get("provider") or urlparse(url).netloc
    if any(name.lower() in provider.lower() for name in NYC_BASED) and "New York, NY" not in provider:
        provider += " (New York, NY)"
    out = {
        "id": lid, "title": item["title"], "provider": provider,
        "url": url, "source_url": item["source_url"], "summary": (item.get("summary") or "")[:400],
        "school_levels": levels, "eligibility": el,
        "focus_tags": sorted({re.sub(r"\s+", "-", t.strip().lower()) for t in item.get("focus_tags") or [] if t.strip()}),
        "evidence": evidence(item),
        "trust": {"badge": "web_verified", "checked_at": (item.get("extracted_at") or "2026-10-23")[:10], "note": trust_note(item)},
        "is_sample": False, "extracted_at": (item.get("extracted_at") or "2026-10-23")[:10],
    }
    if kind == "scholarship":
        req = item.get("requirements") or {}
        est, basis = pool(item, el, scope)
        out.update({
            "amount_min": item.get("amount_min"), "amount_max": item.get("amount_max"),
            "amount_period": amount_period(item), "num_awards": item.get("num_awards"),
            "deadline": item.get("deadline") or ("rolling" if item.get("rolling") else None),
            "requirements": {k: req.get(k) for k in ("essay", "recommendations", "transcript", "interview", "application_fee")} | {"other": []},
            "is_sweepstakes": bool(item.get("is_sweepstakes")), "published_applicants": item.get("published_applicants"),
            "selection": "entitlement" if item["title"] in ENTITLEMENTS else "competitive",
            "est_pool": est, "est_pool_basis": basis,
        })
    else:
        loc = item.get("location") or {}
        borough = loc.get("borough") if loc.get("borough") in BOROUGHS else None
        start, end = item.get("start_date"), item.get("end_date")
        deadline = item.get("application_deadline")
        if start and not end and not item.get("recurring"):
            end = start  # one-day event
        if not deadline and not end:
            deadline = "rolling"  # recurring tours / drop-in advising: register any time
        covers = [c for c in item.get("covers") or [] if c in ("travel", "food", "lodging", "stipend")]
        out.update({
            "type": item.get("type"), "start_date": start, "end_date": end, "application_deadline": deadline,
            "location": None if item.get("is_online") and not borough else {"venue": loc.get("venue"), "borough": borough, "address": loc.get("address")},
            "is_online": bool(item.get("is_online")), "cost": 0, "covers": covers, "stipend_amount": None,
            "apply_effort": [a for a in item.get("apply_effort") or [] if a in ("short_form", "essay", "rec", "first_come", "interview", "transcript", "project")],
            "capacity": item.get("capacity"), "unlocks": [],
        })
    extra = EXTRA.get(item["title"], {})
    for k, v in extra.items():
        out[k] = out[k] + v if k == "evidence" else v
    return out


def main():
    added, skipped = {"scholarship": 0, "opportunity": 0}, []
    for kind, fname in (("scholarship", "scholarships.json"), ("opportunity", "opportunities.json")):
        current = json.loads((DATA / fname).read_text(encoding="utf-8"))
        ids = {x["id"] for x in current}
        real = [x for x in current if not x.get("is_sample")]
        for item in json.loads((GEM / fname).read_text(encoding="utf-8")):
            dup = KNOWN_OVERLAPS.get(item["title"])
            if not dup:
                for x in real:  # fuzzy fallback: same site and similar title
                    same_host = urlparse(x["url"]).netloc.replace("www.", "") == urlparse(item["url"]).netloc.replace("www.", "")
                    if same_host and len(toks(x["title"]) & toks(item["title"])) >= 2:
                        dup = x["id"]
            if dup or any(x.get("source_url") == item["source_url"] and x["title"] == item["title"] for x in current):
                skipped.append(f"{item['title']}  (already in data/ as {dup})")
                continue
            current.append(convert(item, ids))
            added[kind] += 1
        (DATA / fname).write_text(json.dumps(current, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"added {added['scholarship']} scholarships, {added['opportunity']} opportunities")
    print("skipped (Rachel's version kept):", *skipped, sep="\n  ")


if __name__ == "__main__":
    main()
