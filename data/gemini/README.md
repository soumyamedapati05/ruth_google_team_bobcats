# Gemini-extracted listings

A second, larger set of real NYC listings, extracted by Gemini and quote-checked by code (spec §7.3). Built 2026-10-23. Rachel's curated set (with samples, pool estimates and "almost eligible" links) is in `data/` one level up; these are kept separate so nothing overwrites it.

| File | What's in it |
|---|---|
| `scholarships.json` | Scholarships that passed every check (30) |
| `opportunities.json` | Free opportunities that passed every check (27) |
| `needs_review.json` | Probably fine, but a person must check first; each has `review_reasons` (10) |
| `reviewed.json` | Manual corrections checked against the official pages (dates with years, cost, exact quotes), each with a note; applied on top of Gemini's output |
| `rejects.json` | Broke a rule (deadline passed, paid, application fee, unreachable…), with reasons |
| `sources.json` | Every official page a listing came from |

## How it was built

1. **Sources found by hand-style research** (Claude research agents), following the sourcing rules in spec §7.4: official .edu / .gov / sponsor pages only, NYC, free opportunities, current-cycle deadlines.
2. **Gemini extracted every listing** from those pages (`scripts/gemini_extract.py`, prompt in `prompts/extract_listings.md`, model `gemini-flash-latest`, temperature 0). Each listing has `extracted_by`.
3. **Manual review** of 9 high school programs that Gemini left incomplete (College Now ×4, SEO Scholars, Cooper Union, SSRP, MSK, Congressional App Challenge): `reviewed.json` records each correction, its quotes and why. Those listings carry a `review` field.
4. **Code checked every listing** (`scripts/build_lists.py`): dates after today, free, NYC borough or online, no duplicates, and every `evidence` quote found word for word on the live source page (or on the page named in `evidence_pages`; PDFs need `pdftotext`).

Every listing in the two main files has `trust: "web_verified"` and `human_reviewed: false`. A teammate still needs to spot-check ~15 of them (spec §7.3 step 7) and set `human_reviewed: true`.

## Rebuild

```
export GEMINI_API_KEY=...            # from AI Studio; never commit it
python3 scripts/gemini_extract.py <research files...> -o gemini_out.json
python3 scripts/build_lists.py gemini_out.json     # writes into data/gemini/
```

Gemini responses are cached in `.cache/` (gitignored), so re-runs are free unless the prompt or page changes.

## Known gaps

- **Scholarships skew to college students** (24 of 30), mostly CUNY campus awards for enrolled students. Many high school senior awards open their 2027 cycle in January–March; re-check then (see `rejects.json`, stage `research`).
- **Few hackathons:** most NYC student hackathons hadn't posted 2026–27 dates or blocked automated reading.
- **Campus visits** often don't state a cost; those listings carry a `cost_note` instead of a quote.
- Several listings close within days of the build date; re-run before the demo.
