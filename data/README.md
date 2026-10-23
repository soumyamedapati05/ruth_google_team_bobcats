# Data: NYC scholarships & free opportunities

Owner: Rachel. Last import: **2026-10-23**. Spec sections: §5.3, §5.4, §6.2, §7.

## What's here

| File | What it is | Who uses it |
|---|---|---|
| `schema/scholarship.schema.json` | Scholarship schema (§7.2) plus shared `$defs` | Person 5 (import prompt), Person 3 (filter), driver |
| `schema/opportunity.schema.json` | Opportunity schema (§7.2) | same |
| `scholarships.json` | 18 listings: **6 real**, 12 samples (1 is a sweepstakes, to show the hide-by-default filter) | the app |
| `opportunities.json` | 8 listings: **6 real**, 2 samples | the app |
| `contract/*.sample5.json` | The 30-minute contract: 5 listings of each kind | everyone, first 30 min |
| `sources.csv` | Source list for the Google Sheet: 12 imported, 30+ **watch**, 9 excluded (with the rule they break) | Rachel, spot-checker |
| `spot-check.csv` | Every real listing with its quotes and blank ✓ columns for the second teammate | spot-checker |
| `demo/flyer.png` / `.pdf` / `.html` | Counselor flyer for the live Scout import (fictional sponsor) | Person 4, demo |
| `demo/flyer.expected.json` | What a correct import of the flyer returns (2 scholarships, 2 opportunities, 1 almost-eligible link) | Person 5: test the import prompt against it |
| `scripts/check.mjs` | The automatic checks from §7.3 step 4 | anyone: `node data/scripts/check.mjs` |
| `scripts/verify-quotes.mjs` | Confirms every evidence quote is on the live source page → `test-results/quotes.md` | evidence of testing |
| `scripts/score-import.mjs` | Grades Gemini's flyer import against `flyer.expected.json` | Person 5, slide number |

## Read this first: what's real tonight (demo: Oct 23, 2026)

The spec targets ~40 scholarships (~70% real) and ~25 opportunities (all real). Tonight we have **6 real scholarships and 6 real opportunities**, all from official pages with quotes.

The reason is timing, not effort. In late October most NYC-local awards (UFT Shanker, New Visions, Live Out Loud, Delta Sigma Theta Bronx, credit-union scholarships, Harlem YMCA…) still show their *2026* cycle. Their 2027 forms open between mid-November and January. We kept the sourcing rule ("last year's dates only → skip"), so these 31 programs are on the **watch list** in `sources.csv`, each with a `recheck_on` date, not in the data.

**Don't use the spec's planned judge answer** ("the opportunities and most scholarships are real"); it isn't true tonight. Say this instead:

> "Every listing marked real comes from the sponsor's own page, and a script confirmed 45 of its 55 quotes word-for-word on the live pages; we checked the rest by hand. Six scholarships and six opportunities are real and current. It's October, so most NYC local scholarships haven't opened their 2027 forms yet. The local award cards you see are labeled samples showing how they'll look. Thirty-one real programs are queued to import the day they open, and nine we found were excluded on purpose: fees, paid programs, expired."

## Real vs. sample

- **Real:** `is_sample: false`, id starts `sch-` / `opp-`, `source_url` is the official page, and every deadline/amount/eligibility value has a quote in `evidence`. Fields without a quote are left empty (e.g. Belle Zeller's GPA rule, which is only on last year's page).
- **Sample:** `is_sample: true`, id starts `smp-`, made-up provider names only (Riverside Community Foundation, Kestrel Credit Union League, Brightwater Engineers Guild, …), and `url` points to the `/sample-listing` placeholder page. The app must show a **"Sample listing"** tag. No fake award is attached to a real organization. Two samples are *unlocked by* real events (any hackathon, any free pre-college art course), which is a generic eligibility rule, not a claim about those organizations.
- The quotes were captured with a web-fetch tool. The spot-check (step 7) confirms each one against the live page.

## "Almost eligible" links (§5.3)

Opportunities carry `unlocks: [{scholarship_id, reason}]`. Scholarships list the matching `eligibility.prerequisites`.

| Opportunity | Unlocks | Worth |
|---|---|---|
| Riverside Engineering Discovery Day, **Nov 15** (sample) | Young Engineers $2,000 · STEM Pathways $1,500 · Bronx River Builders $1,000 | **$4,500** (the demo line) |
| NASA Space Apps NYC, Nov 13–15 (**real**) | Gowanus Hackathon Builder Award (sample) | $750 |
| Cooper Union Saturday Program, spring 2027 (**real**) | Ellery Arts Portfolio Scholarship (sample) | $1,000 |
| Kestrel Money Smart Workshop, Dec 5 (sample) | Kestrel Financial Futures Scholarship (sample) | $750 |

All dates are valid for tonight's demo: `check.mjs --today=2026-10-23` passes 26/26. Before any later re-run, use `--today=<date>` to see what will have expired. Soros, NYU DURF and the CCNY open house expire within a week.

## Pool estimates and odds inputs (§6.2)

Every competitive scholarship has `est_pool` plus a written `est_pool_basis`, so "are the odds made up?" has an answer on every card.

- Uses `published_applicants` (or a published count, as with Belle Zeller's "over 250 applications") when one exists.
- Otherwise starts from the scope default: borough/county **40**, city **~300**, state **800**, national **5,000**. It then shrinks for each extra restriction (activity, identity group, major, GPA), and the basis string says by how much.
- `num_awards: null` means not published; the formula then uses 1.
- `selection: "entitlement"` (TAP) means no odds; show "Open: if you qualify, you get it".
- For the demo, `smp-sch-riverside-robotics` is set to 20 applicants / 2 awards → **"High (~1 in 10)", Bronx-only, robotics**, matching the §11 script.
- `smp-sch-futureward-national` is the "$10K national lottery" (1 in 5,000) that the county award should beat on expected value.

## Trust badges (§7.7)

`trust.badge` is one of `provider_confirmed` ✓, `web_verified` ✓, `counselor_listed` ●, `unverified` ⚠.

- Real listings read from the sponsor's page today: `web_verified`.
- Fordham: `unverified`, because its page sends scripts to a login and the quote came from a search copy.
- Samples: `unverified`.
- Flyer imports: `counselor_listed`.
- No listing is `provider_confirmed` (no sponsor has confirmed anything to us).

## Demo persona this data assumes (Person 5 owns the persona)

Bronx high school **senior**, U.S. citizen, robotics team, volunteers at a food bank, **first-gen**, parent works at a **credit union**, ZIP in the Bronx. With that profile, the hits should be:

- Riverside Robotics (High)
- Kestrel Credit Union Family Scholarship (the "parent's employer" hook)
- Lantern Hill Food Justice Award
- Northgate First-Gen
- **Jackie Robinson Foundation** (real)
- Riverside Engineering Day as the almost-eligible card

**If the persona changes borough or grade, tell Rachel**, since several samples are Bronx-only or seniors-only.

## Schema additions beyond spec §7.2

The spec fields are all present. Added because matching, odds or almost-eligible needed them:

- `eligibility.geo_scope` and `geo_areas`: borough-only awards need more than `nyc_only`.
- `eligibility.max_age`
- `eligibility.prerequisites`: what "almost eligible" points at.
- `amount_period`: one-time vs. per year vs. total over several years, so $35K-over-4-years isn't read as $35K now.
- `selection`
- `est_pool` and `est_pool_basis`
- `requirements.other`
- `trust` is an object (`badge`, `checked_at`, `note`), not a bare string.
- Opportunities: `unlocks`, `stipend_amount`, and `project` / `transcript` in `apply_effort`.

Class years use `hs_9`…`hs_12`, `college_1`…`college_5plus`, `grad`. Citizenship is a list of statuses that may apply; `[]` means not stated, which never disqualifies.

For Gemini structured output, convert `type: ["string","null"]` to `nullable: true` if AI Studio rejects union types.

## Automatic checks

```
node data/scripts/check.mjs                      # all checks, today's date
node data/scripts/check.mjs --today=2026-11-14   # rehearse demo day
node data/scripts/check.mjs --links              # also request every real link
node data/scripts/check.mjs --export             # rewrite contract/ and spot-check.csv
```

It checks:

- required fields
- dates after today, end ≥ start
- five boroughs or online
- cost 0
- no application fee
- a quote for every deadline/amount/eligibility value
- duplicates (URL + title)
- sample rules
- every `unlocks` target exists

Failures print with the reason and exit 1. Status today: **26 passed, 0 failed**. Link check: Space Apps, Fordham and CCNY block scripts (TLS/login/403), so open those in a browser.

## Evidence of testing (rubric: "Working prototype … with evidence of testing")

| Test | Command | Result tonight |
|---|---|---|
| Automatic checks on every listing | `node data/scripts/check.mjs` | 26/26 pass |
| Every quote is on the live source page | `node data/scripts/verify-quotes.mjs` → `test-results/quotes.md` | **45/55 found word-for-word, 0 mismatches**; 10 on script-blocking pages (TAP, CCNY, Fordham) for the hand check. The first run caught 2 paraphrased Space Apps quotes, which we fixed. |
| Gemini flyer import vs. the right answer | `node data/scripts/score-import.mjs gemini-output.json` | Scorer tested: perfect input → 40/40. A planted bad import (wrong year, invented address, fake quote, missed listing) → all 4 caught. **Run it on the real Gemini output and put the number on a slide.** |
| Person spot-check | `spot-check.csv` | To do tonight (see checklist) |
| Demo-day expiry rehearsal | `check.mjs --today=<date>` | Nothing expires before tonight |

## How this data maps to the rubric

| Criterion | What the data contributes |
|---|---|
| **Social impact 30%** | Free opportunities that build eligibility. Local awards with realistic odds. Need-based, first-gen, immigrant/DREAM Act (TAP) and CUNY options. Persona is a first-gen Bronx student. |
| **Working prototype 30%** | Real, current, schema-valid data the app loads. The test results above. |
| **Google AI use 20%** | The flyer is Gemini's live moment: photo → structured listings with quotes → human approves. `score-import.mjs` shows *how well* Gemini did, and checks Gemini's quotes against the flyer so invented text gets caught. |
| **Usability 10%** | Plain-language one-line summaries; clear "Sample listing" tags; `school_levels` / `enrolled_at` so students only see what they can apply to. |
| **Responsible design 10%** | Official sources only, no aggregators. No personal data scraped (no staff names or emails). Every claim has a quote. A person approves every listing. Fee-charging awards excluded and sweepstakes hidden as scam signals. Samples labeled. Odds shown as bands with the pool math written down. The limitation (few local awards open in October) is stated openly, not hidden. |

## Re-import calendar (from `sources.csv`)

| When | What |
|---|---|
| **After the demo, by Oct 26** | NCWIT AiC (closes Oct 27/28), Congressional App Challenge NYC districts (Oct 26), American Legion oratorical, MakeCU (Nov 7–8: confirm free + who can attend), NYT Learning Network contests (screenshot import; nytimes.com blocks the fetch tool), Fordham (confirm in a browser), campus-visit calendars (screenshot import) |
| Nov 1–21 | CUNY College Now spring windows, Live Out Loud, New Visions, Harlem YMCA, BMI Kavi Ohri, Elie Wiesel Prize, Cooper Saturday Program application dates, NYCUA credit-union scholarship, USACO, MIT THINK |
| Dec 1–15 | UFT Shanker, Watson JK Fellowship, Horatio Alger NY, 32BJ, Belle Zeller form, DST Bronx, AMNH SRMP, NYU ARISE, Ascend Fund |
| Jan 15, 2027 | SYEP, Girls Who Code, MCU, Polish & Slavic FCU, LDF Lehman, Gilman, NYU DURF spring |
| Before any later demo | `check.mjs --today=<demo>` and re-import anything expiring (§7.3 step 8) |

## Tonight's checklist (Rachel)

1. **Hand-check the 10 quotes the script couldn't read** (TAP page on hesc.ny.gov, CCNY open house, Fordham visit page) in a browser. Fill the ✓ columns in `spot-check.csv` for all 12 real listings, so the pitch can say "a person checked 12 of 12 real listings, X errors". If the Fordham quote checks out, change its badge to `web_verified`.
2. **Give Person 4 the files:** `scholarships.json`, `opportunities.json`, and `demo/flyer.png` (also in Downloads as `scout-demo-flyer.png`) for the live import.
3. **Score Gemini's flyer import:** save the JSON the app returns for the flyer, run `node data/scripts/score-import.mjs <file>`, and put the result on your slide (e.g. "Gemini: 4/4 listings, 39/40 fields, every quote on the flyer").
4. **Confirm the persona with Person 5:** Bronx senior, robotics, food bank, first-gen, parent at a credit union. Several samples are Bronx-only or seniors-only.
5. **Your slide:** "Where the data comes from". Show official sources only, quotes on every claim, a person approves, the test numbers, and 31 programs queued for when 2027 forms open. Use the judge answer at the top of this file word-for-word.
