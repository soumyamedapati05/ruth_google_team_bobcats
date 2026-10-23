# Spec: Personalized Scholarship & Opportunity Finder

> Working name: **TBD** (placeholder: "Scout"). Status: **draft v0.5, 2026-10-23.**
> v0.5 descopes the project to a **5-hour prototype built in Google AI Studio with Gemini**, adds Common App as the main competitor, and moves the trained odds model, goals/tracker, and database to the roadmap.
> Scrapers, data and the v0.4 full design live in [rachelchen24/ruth-google-team-10](https://github.com/rachelchen24/ruth-google-team-10) (`scrapers/`, `data/`, `rachel-progress.md`; v0.4 is `git show fa67d7b:spec.md` there).

## 1. The idea in one line

> **Common App answers "which scholarships fit the form you filled out?" We answer "what should I do this year to win money for college?"**

A student pastes a few sentences about themselves and gets **local scholarships ranked by realistic odds**, plus the **free opportunities that unlock more scholarships** ("almost eligible").

## 2. Problem

Everyone we interviewed (and everyone on the team) had a bad experience with scholarship sites. That isn't because nobody tried. The market is broken in ways better AI alone doesn't fix:

1. **The money doesn't come from the student.** Students can't pay, so sites earn money from selling leads, from ads, or from being owned by a loan company (Sallie Mae owns Scholly). That rewards signups and page views, not wins. "No-essay" sweepstakes awards exist to collect leads.
2. **Winnable money is hard to index.** Local awards are online, but **scattered** across school counseling PDFs, club pages, Facebook posts and foundation portals, in no standard format, with eligibility buried in prose. (They are not "only on paper"; don't claim that.)
3. **Nobody knows who won**, so no tool learns what actually works.
4. **Tools solve the wrong problem.** Finding isn't the hard part. Deciding what's worth applying to, writing essays, getting recommendations, tracking deadlines and starting early are.
5. **Students use these tools for one season, then leave,** so nobody invests in quality.
6. **Providers can't reach eligible students** either, and nobody serves them.

Profiles on most sites are also shallow (GPA, state, major), so a fencer who volunteers at a food bank gets the same list as everyone else in their state, and **no scholarship site shows the free opportunities** (hackathons, STEM days, company visits) that build the record that wins scholarships.

## 3. Competitors

| Product | Strength | Gap |
|---|---|---|
| Fastweb, Scholarships.com, Niche, Cappex | Huge databases, free | Checkbox filters, noisy, stale, lead-gen business model |
| College Board BigFuture | Trusted, vetted (~23K) | Small catalog, basic personalization, stops at a list |
| Bold.org | Verified awards it hosts itself, clean interface | Mostly its own awards, competitive, many small no-essay prizes |
| ScholarshipOwl | Auto-apply, AI essay drafts | Paywalled; generic drafts |
| Scholly (now on Sallie.com) | Free mobile search | Owned by a loan company; 2026 lawsuit alleging data sales (Sallie Mae denies) |
| Going Merry | n/a | One source says it shut down March 2026 (unconfirmed) |
| Extracurrify | Free AI "counselor," ~250 curated activities | Small curated list; not local |
| MLH, Devpost | Hackathon listings | Hackathons only; nothing aimed at "free things near me for a teen" |
| **Common App scholarship matching** | **Closest rival.** In the Financial Aid section; reuses profile data students already entered, so no extra work; ~1,950 programs (2025–26); median 8 matches; reportedly ~86% local; partners Scholarship America + NSPA; doesn't share student contact info | Only Common App users, mostly seniors, US/CA/MX only; form fields only; matches arrive as notifications with no ranking or explanation; scholarships only; no help after the match |

### How we differ from Common App

| | Common App | Us |
|---|---|---|
| Who | Common App users, mostly seniors | 9th grade through college, incl. community college, transfer, non-Common App students |
| When | One application season | Multiple years: build the record, then apply |
| What | Scholarships | Scholarships **+ free opportunities that build eligibility** |
| How it matches | Structured form fields | The student's own words (catches niche hooks: parent's union, fencing, 4-H) |
| Output | Notifications (median 8) | Ranked by expected value, with "why you match" and odds |
| After the match | "Apply on their site" | "Almost eligible" paths, essay reuse, deadline plan |

**Don't claim as unique** (Common App does these too): no data selling, local awards, reusing a profile, provider partnerships.

**Positioning:** pitch *around* Common App, not against it. We cover the years before it, the students it doesn't reach, and the steps after a match. Students can paste their Common App activities section as the intake.

## 4. Users

- **Primary:** high school students and undergrads (~14–22), especially first-generation and low-income students without a counselor doing this for them.
- **Secondary (supply side):** school counselors and local providers who want their scholarships to reach eligible students.

## 5. Prototype scope (5 hours)

**The demo must prove:** paste a story → local scholarships ranked by realistic odds → the free opportunity that unlocks more of them → a counselor flyer turned into cards live.

| Keep (real, working) | Fake (hardcoded but believable) | Cut (roadmap, §12) |
|---|---|---|
| Paste → Gemini extracts profile chips (structured JSON output) | Applicant pool sizes (estimated by hand when not published) | Live scraping inside the app (Rachel's scrapers run offline, §7) |
| Confirm chips + 2–3 gap questions (ZIP, grade, optional GPA) | Trust badges (set by hand) | Embeddings, pgvector, database |
| Hard eligibility filter | Demo persona | Synthetic students + trained odds model |
| Gemini ranking + "why you matched" | | Goals, progress bars, tracker, reminders |
| Odds band from a formula (§6.2) | | Accounts and auth |
| **"Almost eligible" card** (opportunity → scholarships it unlocks) | | Essay clustering, map, voice intake |
| **Counselor upload:** PDF or flyer photo → Gemini → listing cards | | URL grounding "verify" button (stretch only) |
| Scholarships and Opportunities tabs | | Counselor view for many students |

### 5.1 Intake: "paste, don't fill out"
- **Optional paste:** personal statement, resume, activities list, or a few sentences. No document? Fall back to a chip picker.
- **Gemini extraction** returns profile JSON: activities, sports, clubs, leadership, volunteering, awards, interests/major, background the student chose to share (first-gen, heritage), and connections where niche awards hide (parent's employer or union, church, Scouts/4-H/FFA).
- **Confirm, don't type:** show editable chips. One click to remove or add.
- **Ask only the gaps:** ZIP and grade (required), GPA range (optional), optional "any of these apply?" checklist.
- **Privacy:** users may be minors. The raw document is discarded; only chips are kept. Every sensitive field is optional and says why we ask.

### 5.2 Results
- **Two tabs:** Scholarships and Opportunities (equal weight; opportunities are a key differentiator).
- **Each card:** title, provider, amount (or cost and what's covered), deadline, effort (essay / recs / short form), **odds band**, **"why you matched"** line, **trust badge** (§7.4), source credit, apply link.
- **Default sort by expected value:** amount × odds ÷ effort. This pushes a $500 county award with 15 applicants above a $10K national lottery.
- **Sweepstakes / lead-gen awards hidden by default** (`is_sweepstakes`).

### 5.3 "Almost eligible" (the demo's big moment)
An opportunity card that links to scholarships it unlocks: *"Attend this free engineering day Nov 15 → qualifies you for 3 more scholarships worth $4,500."* For the prototype, these links are hand-authored in the data (3–4 of them). This joins the two tabs into one idea: the app doesn't just find money, it helps build the record that wins it.

### 5.4 Counselor upload (supply side)
A counselor uploads a scholarship PDF or a photo of a flyer. Gemini reads it (multimodal input + structured output) and returns `Listing` records (§7.2) that appear as cards immediately. This is how the product gets the local data nobody else has. In the demo, **we play the counselor**.

## 6. Matching

### 6.1 Pipeline
1. **Eligibility filter (code):** location, class year, GPA minimum, citizenship, deadline not passed. **Unknown fields never disqualify.**
2. **Gemini ranking:** send the filtered listings (~60 total, so no embeddings needed) plus the profile; get back a relevance score and a one-line "why you matched" per listing. This is what makes "fencing" match an "Olympic-sport athlete" award, and a parent's credit union job surface an employer scholarship.
3. **Odds + expected value (code):** §6.2, then sort.

### 6.2 Odds (formula, no training)
- **Estimated pool:** use `published_applicants` when present (Devpost registrations, provider-published counts). Otherwise start by scope (county ~40, state ~800, national ~5,000) and shrink for each extra restriction (specific activity, major, identity group, GPA floor).
- `p ≈ num_awards / est_pool × fit adjustment` (default `num_awards = 1`).
- **Show labels only:** Long shot / Fair / Good / High, e.g. *"High (~1 in 10)"*. Never a precise-looking %. Tooltip: *"Rough estimate from pool size and fit. Not a guarantee."*
- First-come or no-selection opportunities show "Open: apply early" instead of odds.

The v0.4 plan (synthetic applicants + trained, calibrated model) moves to the roadmap. A model trained on simulated data only learns the simulator's assumptions, which invites "so the odds are made up?" from judges. The formula shows the same idea transparently.

## 7. Data

### 7.1 What exists already (Rachel; see `rachel-progress.md`)
- **Schema:** `scrapers/schema.py` → `Listing`. Scholarships and opportunities share one model, told apart by `kind`. Null / `[]` = unknown.
- **Real data:** `data/listings.json`, 233 hackathons (70 MLH + 163 Devpost).
- **Mock data:** `data/sample_listings.json`, 20 listings (12 fake, labeled "(FAKE)", plus 8 real hackathons).
- **In progress:** Pathways to Science (105 pages scraped, waiting on LLM key), CareerOneStop (adapter written, needs token), hand-picked local pages (waiting on demo city).
- **LLM provider decision:** **Gemini.** The extractor is OpenAI-compatible, so set `LLM_BASE_URL` to Gemini's OpenAI-compatible endpoint and `LLM_API_KEY` to an AI Studio key.

The scrapers stay an **offline pipeline**: they produce JSON, and the AI Studio app loads that JSON. Nothing scrapes at runtime.

### 7.2 Prototype dataset

We have no counselor partner, so the team assembles the data. **Use real listings wherever possible:**
- **Opportunities (all real):** MLH + Devpost (done), Pathways to Science, outreach/event pages at 2–3 universities near the demo city. Filter to free and to HS-eligible where possible.
- **Scholarships (~70% real):** search Google for public school lists (`"[county] high school" local scholarships pdf 2026`, `"scholarship bulletin" counseling [city]`), run them through Gemini extraction, plus national awards.
- Keep only **upcoming deadlines (Nov 2026 to spring 2027)**. Skip CareerOneStop if the token hasn't arrived.

**Made-up listings, done honestly** (only to fill the demo story, e.g. the "almost eligible" chain):
- **Made-up provider names** ("Riverside Community Foundation"). Never attach fake awards to real organizations.
- Labeled **"Sample listing"** (keep Rachel's `(FAKE)` / `source: "sample"` convention).
- Realistic details: local amounts $500–$2,500, real-looking eligibility, upcoming deadlines.
- **No dead links:** sample listings point to a placeholder page.
- The **demo flyer** for the counselor upload is made by us in Google Docs or Canva with an obviously fictional sponsor. Gemini's extraction of it is still real.

**Target:** ~40 scholarships + ~20 local/online opportunities curated for the demo (plus the hackathon set), with 3–4 "almost eligible" links. **Only synthesize** the persona and pool estimates (say they're estimated).

### 7.3 Pipeline steps (one pipeline, not alternatives)

```
STEP 1: Starting data        STEP 2: Adding listings       STEP 3: Keeping them current
(team, before launch)        (counselors, ongoing)         (automatic)

Scrapers + Google Sheet ──►  PDF / photo upload     ──►    URL context / grounding
team curates listings        Gemini turns a flyer          Gemini checks provider pages
                             into cards                    for this year's deadline
                                     │
                                     ▼
                   ONE LIST OF LISTINGS → students paste their story → matches
```

- **Google Sheet:** a shared place for the team to hand-curate local listings (`data/manual_listings.json` after export). Not a user feature.
- **Grounding** checks whether a listing is **current and complete** (this year's deadline, full eligibility, application link). It does **not** check whether a listing is publicly posted. Never drop a listing for having no web presence. If grounding conflicts with a counselor's upload, flag it; don't overwrite.

### 7.4 Trust badges

| Badge | Meaning |
|---|---|
| ✓ Provider confirmed | Sponsor confirmed this cycle's details |
| ✓ Web verified | Matched to the provider's live page |
| ● Counselor listed | From a school's list (upload date shown) |
| ⚠ Unverified | Older than this cycle or flagged |

For offline-only listings, trust comes from the source: counselor upload date, provider reconfirming each cycle, and a "deadline wrong / link broken?" flag on every card.

## 8. Build: Google AI Studio

- **Build mode** generates the web app. Gemini calls run server-side with the key stored as a hidden secret.
- **Publish to Cloud Run** for a live URL (free Starter tier: up to 2 apps, no billing). **Export to GitHub** into this repo.
- **Three Gemini calls**, each with a JSON schema (structured output):
  1. Pasted story → profile JSON
  2. Filtered listings + profile → relevance + "why" per listing
  3. Counselor PDF / flyer image → `Listing` JSON
- **Data:** listings JSON bundled into the app.

**Build mode tips**
- **One small change per prompt.** Long prompts get shrunk or ignored, and big prompts break working parts.
- **Checkpoint / export to GitHub after each working feature.**
- **Never let Gemini make up listings at runtime**; it only reads the bundled data.
- **Cache the demo persona's results** as a fallback for rate limits, and record a backup video.
- AI Studio is built for **one person editing at a time**. One driver owns the app; everyone else prepares prompts, data and designs. Check in the first 10 minutes whether shared editing exists.

## 9. Privacy and safety

- Users may be minors. Collect the minimum, keep every identity field optional, never sell or share data.
- No account needed to see matches.
- Link out to official applications; collect no application materials or payment info.
- Flag application fees, SSN requests and lead-gen "no essay" awards as scam signals.

## 10. Team

| Who | Owns |
|---|---|
| **Bianca:** design | Sketches of the 3 screens (intake, results with two tabs, counselor upload); UI prompts for the driver; card design incl. odds band, trust badge, "almost eligible" card |
| **Rachel:** data | Running the scrapers with a Gemini key; demo-city curation (Sheet → `manual_listings.json`); a real local PDF; the demo flyer; "almost eligible" links; pool estimates; trust badges |
| **Person 3:** matching | Eligibility filter, ranking prompt + JSON schema, odds formula, expected-value sort, "almost eligible" logic. Tests prompts in AI Studio's prompt playground first |
| **Person 4:** AI Studio driver | Owns the Build mode app; applies prompts, data and designs; Cloud Run publish; GitHub export; cached fallback |
| **Person 5:** AI intake | Profile extraction prompt + schema, gap-question logic, counselor-upload extraction prompt, the demo persona (realistic first-gen student paragraph) |

**Presentation is shared.** Each person makes the slide(s) and demo segment for their part; the team assembles and rehearses together.

**Contracts (first 30 minutes):** listing schema = `scrapers/schema.py` (done). Person 5 commits the profile schema + 2 sample profiles. Person 3 and Person 5 hand finished prompts to Person 4 as text.

### Timeline (5 hours)
- **0:00–0:30, all together:** pick the demo city, confirm schemas, write the persona. Driver gives Build mode the skeleton prompt: *"Scholarship matcher: paste-your-story intake → editable profile chips → ranked results with Scholarships and Opportunities tabs, using local JSON data."*
- **0:30–2:30:** driver builds screens; Rachel curates data; Persons 3 and 5 refine prompts in the playground.
- **2:30–3:30:** load real data and prompts; add "almost eligible" and counselor upload.
- **3:30:** publish to Cloud Run, export to GitHub.
- **4:00: FEATURE FREEZE.** Anything not working by 3:30 gets hardcoded.
- **4:00–5:00:** polish copy, record backup video, rehearse 3+ times.

## 11. Demo (3 minutes)

1. **Problem (30s):** a quote from our interviews + a screenshot of Fastweb's generic list.
2. **Intake (30s):** paste the persona → chips appear (robotics, food bank, first-gen, parent works at a credit union) → ZIP + grade.
3. **Results (45s):** local awards on top: *"High odds (~1 in 10), county-only, matches robotics."* Contrast with Common App's "8 notifications."
4. **Big moment (45s):** "almost eligible": free engineering day → 3 more scholarships worth $4,500.
5. **Supply side (20s):** upload the counselor flyer → cards appear live. *"This is how we get the data nobody else has."*
6. **Close (10s):** the one-liner from §1. *"Built on Google AI Studio and Gemini."*

### Judge Q&A
- **"How is this different from Common App?"** The one-liner + we cover 9th grade onward, opportunities, and the steps after a match.
- **"Where does the data come from at scale?"** Counselors and providers upload it (as shown), our scrapers cover public sources, and Gemini grounding keeps it current.
- **"Is this data real?"** *"The opportunities and most scholarships are real, current listings. A few local ones are illustrative so the demo shows the full flow, and they're labeled. The extraction you saw is live."*
- **"Are the odds real?"** *"A transparent estimate from eligible pool size; we never show a fake precise %. Real odds come from providers reporting winners, which is on the roadmap."*
- **"How do you know listings are current?"** Trust badges, providers reconfirming each cycle, student flags.
- **"How do you make money without selling data?"** Grants, school or district licenses, foundation funding. Free for students, always.
- **"Why AI and not filters?"** Fencing → Olympic-sport athlete award; parent's credit union job → employer scholarship. Filters miss both.

**Avoid:** "billions in scholarships go unclaimed" (widely called a myth) and "local awards only exist on paper."

## 12. Roadmap (pitch only, don't build)

- **Two-sided local scholarship network:** counselors and providers post for free → students matched → **providers report winners** → real odds data.
- **Trained odds model:** v0.4 §7.2 plan (synthetic pretraining, then real outcomes, calibrated), once outcome data exists.
- Goals, progress bars, pace check, applied/won tracker, deadline reminders.
- Scheduled scraping, CareerOneStop national data, database + embeddings for scale.
- Essay-prompt clustering ("one essay covers these 5 awards"), voice intake, resume upload.
- Counselor view for many students, Google Maps for nearby opportunities, grounding-based "verify" button.
- Predicting when yearly awards reopen, student-submitted listings, scam classifier.

## 13. Open questions

- Names for Persons 3–5.
- Demo city (blocks Rachel's local curation).
- Whose AI Studio account drives the app; Gemini key for the scrapers.
- Does AI Studio Build mode support shared editing?
- Name and branding.
