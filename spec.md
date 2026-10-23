# Spec: Personalized Scholarship & Opportunity Finder

> Working name: **TBD** (placeholder: "Scout"). Status: **draft v0.5, 2026-10-23.**
> v0.5 descopes the project to a **5-hour prototype built in Google AI Studio with Gemini**, adds Common App as the main competitor, and moves the trained odds model, goals/tracker, and database to the roadmap.
> Prototype scope: **New York City only.** This repo is a fresh start; no code or data carries over from earlier repos.

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

- **Prototype geography:** New York City (plus online opportunities).

- **Primary:** high school students and undergrads (~14–22), especially first-generation and low-income students without a counselor doing this for them.
- **Scouts (supply side):** trusted people who add listings in the Scout view: our team for the prototype, then school counselors and local providers who want their scholarships and events to reach eligible students.

## 5. Prototype scope (5 hours)

**The demo must prove:** paste a story → local scholarships ranked by realistic odds → the free opportunity that unlocks more of them → a counselor flyer turned into cards live.

| Keep (real, working) | Fake (hardcoded but believable) | Cut (roadmap, §12) |
|---|---|---|
| Paste → Gemini extracts profile chips (structured JSON output) | Applicant pool sizes (estimated by hand when not published) | Bulk Python scraping (optional, §7.3) |
| Confirm chips + 2–3 gap questions (ZIP, grade, optional GPA) | Trust badges (set by hand) | Embeddings, pgvector, database |
| Hard eligibility filter | Demo persona | Synthetic students + trained odds model |
| Gemini ranking + "why you matched" | | Goals, progress bars, tracker, reminders |
| Odds band from a formula (§6.2) | | Accounts and auth |
| **"Almost eligible" card** (opportunity → scholarships it unlocks) | | Essay clustering, map, voice intake |
| **Scout view importer:** URL, PDF or flyer photo → Gemini → review → listing cards | | URL grounding "verify" button (stretch only) |
| Scholarships and Opportunities tabs | | Counselor view for many students |

### 5.1 Intake: "paste, don't fill out"
- **Optional paste:** personal statement, resume, activities list, or a few sentences. No document? Fall back to a chip picker.
- **Gemini extraction** returns profile JSON: activities, sports, clubs, leadership, volunteering, awards, interests/major, background the student chose to share (first-gen, heritage), and connections where niche awards hide (parent's employer or union, church, Scouts/4-H/FFA).
- **Confirm, don't type:** show editable chips. One click to remove or add.
- **Ask only the gaps:** ZIP and grade (required), GPA range (optional), optional "any of these apply?" checklist.
- **Privacy:** users may be minors. The raw document is discarded; only chips are kept. Every sensitive field is optional and says why we ask.

### 5.2 Results
- **Two tabs:** Scholarships and Opportunities (equal weight; opportunities are a key differentiator).
- **Each card:** title, provider, amount (or cost and what's covered), deadline, effort (essay / recs / short form), **odds band**, **"why you matched"** line, **trust badge** (§7.7), source credit, apply link.
- **Default sort by expected value:** amount × odds ÷ effort. This pushes a $500 county award with 15 applicants above a $10K national lottery.
- **Sweepstakes / lead-gen awards hidden by default** (`is_sweepstakes`).

### 5.3 "Almost eligible" (the demo's big moment)
An opportunity card that links to scholarships it unlocks: *"Attend this free engineering day Nov 15 → qualifies you for 3 more scholarships worth $4,500."* For the prototype, these links are hand-authored in the data (3–4 of them). This joins the two tabs into one idea: the app doesn't just find money, it helps build the record that wins it.

### 5.4 Scout view: import listings (supply side)
The website has two views: the **student view** (§5.1–5.3) and the **Scout view**, where trusted people add listings. Scouts are our team today, and counselors and local providers later.

- **Import button:** paste a URL, or upload a PDF or a photo of a flyer.
- **Gemini reads it** (URL context for links, multimodal input for files) and returns scholarship or opportunity records (§7.2), each with `evidence` quotes.
- **Review before publish:** the Scout sees each extracted listing next to its quotes, edits or rejects it, then approves. Only approved listings reach students.
- This is both **how our team builds the NYC dataset** (§7.3) and **how counselors would add local awards nobody else has**. In the demo, **we are the Scouts**.

## 6. Matching

### 6.1 Pipeline
1. **Eligibility filter (code):** location, class year, GPA minimum, citizenship, deadline not passed. **Unknown fields never disqualify.**
2. **Gemini ranking:** send the filtered listings (~60 total, so no embeddings needed) plus the profile; get back a relevance score and a one-line "why you matched" per listing. This is what makes "fencing" match an "Olympic-sport athlete" award, and a parent's credit union job surface an employer scholarship.
3. **Odds + expected value (code):** §6.2, then sort.

### 6.2 Odds (formula, no training)
- **Estimated pool:** use `published_applicants` when present (provider-published applicant or registration counts). Otherwise start by scope (county ~40, state ~800, national ~5,000) and shrink for each extra restriction (specific activity, major, identity group, GPA floor).
- `p ≈ num_awards / est_pool × fit adjustment` (default `num_awards = 1`).
- **Show labels only:** Long shot / Fair / Good / High, e.g. *"High (~1 in 10)"*. Never a precise-looking %. Tooltip: *"Rough estimate from pool size and fit. Not a guarantee."*
- First-come or no-selection opportunities show "Open: apply early" instead of odds.

An earlier plan (synthetic applicants + trained, calibrated model) moves to the roadmap. A model trained on simulated data only learns the simulator's assumptions, which invites "so the odds are made up?" from judges. The formula shows the same idea transparently.

## 7. Data

### 7.1 Scope and the two lists

- **Fresh start.** This repo starts from zero; no code or data carries over from earlier repos.
- **Geography: New York City only** for the prototype (plus online opportunities open to NYC students).
- **Two separate lists**, each its own file and schema:
  - `data/scholarships.json`
  - `data/opportunities.json`: hackathons, campus visits and open houses, free pre-college / STEM programs, workshops, info sessions, company student events, competitions
- **Trusted sources only:** every listing comes from a page a teammate picked by hand from an official source: a university (.edu), government (.gov), or the program or sponsor's own site. Starting institutions: Columbia, NYU, Fordham, The New School / Parsons, CUNY, Cooper Union, plus NY State and NYC programs.
- **Out of reach:** on-campus recruiting on Handshake needs a student login and is only for enrolled students, so we don't scrape it. Use companies' public "students / events" career pages instead.

### 7.2 Schemas

Unknown = `null` or `[]`. **Unknown never disqualifies** a student. Every listing records where it came from.

**Shared fields (both lists):** `id`, `title`, `provider`, `url` (the listing's own page), `source_url` (the page we extracted it from), `summary` (1–2 sentences), `school_levels` (`HS` / `college`), `eligibility` (`class_years`, `min_gpa`, `citizenship`, `majors`, `identity_groups`, `need_based`, `nyc_only`), `focus_tags`, `evidence` (short quotes from the page supporting the deadline and eligibility), `trust` (badge, §7.7), `is_sample` (true for made-up listings), `extracted_at`.

**Scholarship-only:** `amount_min`, `amount_max`, `num_awards`, `deadline`, `requirements` (`essay`, `recommendations`, `transcript`, `interview`, `application_fee`), `is_sweepstakes`, `published_applicants`.

**Opportunity-only:** `type` (`hackathon`, `campus_visit`, `program`, `workshop`, `info_session`, `company_event`, `competition`), `start_date`, `end_date`, `application_deadline`, `location` (venue, borough, address) or `is_online`, `cost` (0 = free), `covers` (`travel`, `food`, `lodging`, `stipend`), `apply_effort` (`short_form`, `essay`, `rec`, `first_come`, `interview`), `capacity`.

### 7.3 Data pipeline: the Scout importer

The dataset is built **inside the AI Studio app** with the Scout view importer (§5.4), so all data work uses Gemini in AI Studio. Nothing scrapes in the student view.

1. **Pick sources by hand** following the sourcing rules (§7.4). Track them in a shared list (Google Sheet): URL, kind, institution, teammate, date added. Target ~25 sources.
2. **Import each source** in the Scout view: a URL, or for pages that load content with JavaScript (many event calendars), a PDF or screenshot of the page, or the calendar's iCal/RSS export.
3. **Gemini extracts** with structured output (the §7.2 schema, temperature 0) and these rules: use only what is on the page, no outside knowledge; unknown = empty; exact dates only (never guess the year); one listing per scholarship or event; `evidence` quotes required for deadline, amount, and eligibility, or the field stays empty.
4. **Automatic checks** before review: required fields present, dates after today, end ≥ start, NYC or online, link works, no duplicates (URL + title). Failures are shown with the reason, not silently dropped.
5. **Scout reviews and approves** each listing against its quotes and the source page.
6. **Saved** to the scholarships or opportunities list. For the prototype, approved listings are stored in the app and exported as `data/scholarships.json` / `data/opportunities.json`, which are committed to this repo.
7. **Spot-check:** a second teammate re-checks ~15 random listings plus every demo listing. Report the result in the pitch ("a person checked 15 of 15 listings, X errors"). Fix wrong results by changing a rule or the prompt and re-importing, not by hand-editing.
8. **Re-import right before the demo** so deadlines are current.

**Optional bulk path:** if organizers confirm outside code is allowed, a Python script (`httpx` + `BeautifulSoup`, `Playwright` for JavaScript pages, the `google-genai` SDK) can run the same extraction in bulk, save a copy of every page, and check that each quote appears in it. Not needed for the prototype.

### 7.4 Sourcing rules

**Which pages we can use**
- **Allowed:** official sites of NYC schools and colleges, government sites (NY State HESC, NYC public schools, CUNY), and the sponsor's or event's own official site.
- **Not allowed:** aggregators (Fastweb, Bold.org, Scholarships.com, Niche), blog roundups, social media, Reddit, anything behind a login (Handshake).
- **Finding vs. sourcing:** Google, MLH or Eventbrite can help *find* something, but the listing must come from the official page (e.g. HackNYU's own site, not MLH's page about it).
- **Read each site's robots.txt and terms by hand** before adding it; skip sites that forbid automated access. Never get around logins or CAPTCHAs, and don't collect personal info (staff names or emails), only listing details.

**Scholarships: include only if**
- A student can actually **apply** (not aid every admitted student is automatically considered for).
- It's limited to NYC or NY students, or offered by an NYC institution or organization and open to NYC students.
- There's a **current deadline** (after today) or a rolling one. Last year's dates only → skip.
- No application fee, not a sweepstakes or "no-essay" giveaway, no SSN or bank details asked.

**Opportunities: include only if**
- It's a hackathon, campus visit / open house / info session, pre-college or summer program, workshop, company student event, or competition.
- It's **in the five boroughs or online**, and **open to outside students** (HS or college); not current-students-only, alumni or donor events.
- It's **free or has full financial aid.** (Most Columbia and Parsons pre-college programs are expensive, so many will be excluded.)
- The event date or application deadline is after today.

**Undecided (see §13):** a cost limit for opportunities beyond free / full aid; scholarships only for students already enrolled at one school; national scholarships from NYC organizations.

### 7.5 Prototype dataset

We have no counselor partner, so the team assembles the data from the sources above. **Use real listings wherever possible:**
- **Opportunities (all real):** NYC hackathons, campus visit / open house pages, free pre-college and STEM programs, public university event calendars, company student-event pages. Filter to free or low-cost and open to outside students.
- **Scholarships (~70% real):** NY State and NYC programs, CUNY, universities' "outside scholarships" pages, NYC community foundations, public NYC high school scholarship lists.
- Keep only **upcoming deadlines (Nov 2026 to spring 2027)**.

**Made-up listings, done honestly** (only to fill the demo story, e.g. the "almost eligible" chain):
- **Made-up provider names** ("Riverside Community Foundation"). Never attach fake awards to real organizations.
- Set `is_sample: true` and show a **"Sample listing"** tag.
- Realistic details: local amounts $500–$2,500, real-looking eligibility, upcoming deadlines.
- **No dead links:** sample listings point to a placeholder page.
- The **demo flyer** for the Scout import demo is made by us in Google Docs or Canva with an obviously fictional sponsor. Gemini's extraction of it is still real.

**Target:** ~40 scholarships + ~25 opportunities, with 3–4 "almost eligible" links. **Only synthesize** the persona and pool estimates (say they're estimated).

### 7.6 How listings get in and stay current

```
STUDENT VIEW                                   SCOUT VIEW
                                               Import: URL / PDF / flyer photo
                                                         │
                                               Gemini extracts listings + evidence quotes
                                                         │
                                               Automatic checks → Scout reviews → approve
                                                         │
students paste their story → matches  ◄──  ONE LIST OF APPROVED LISTINGS
                                                         ▲
                                               Later: URL context / grounding re-checks
                                               provider pages for this year's deadline
```

- **Google Sheet:** the team's shared tracker of sources (§7.3 step 1). Not a user feature.
- **Grounding** checks whether a listing is **current and complete** (this year's deadline, full eligibility, application link). It does **not** check whether a listing is publicly posted. Never drop a listing for having no web presence. If grounding conflicts with a counselor's upload, flag it; don't overwrite.

### 7.7 Trust badges

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
  3. Scout import: URL (URL context) or PDF / image → scholarship or opportunity JSON with evidence quotes
- **Data:** approved listings stored in the app; exported to `data/*.json` in this repo as the backup and source of truth for the demo.

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
| **Bianca:** design | Sketches of the 4 screens (intake, results with two tabs, Scout import, Scout review); UI prompts for the driver; card design incl. odds band, trust badge, "almost eligible" card |
| **Rachel:** data | The NYC source list following the sourcing rules (§7.4), importing and approving listings in the Scout view, exporting the two JSON files, organizing the spot-check; the demo flyer; "almost eligible" links; pool estimates; trust badges |
| **Person 3:** matching | Eligibility filter, ranking prompt + JSON schema, odds formula, expected-value sort, "almost eligible" logic. Tests prompts in AI Studio's prompt playground first |
| **Person 4:** AI Studio driver | Owns the Build mode app; applies prompts, data and designs; Cloud Run publish; GitHub export; cached fallback |
| **Person 5:** AI intake | Profile extraction prompt + schema, gap-question logic, Scout import extraction prompt, the demo persona (realistic first-gen student paragraph) |

**Presentation is shared.** Each person makes the slide(s) and demo segment for their part; the team assembles and rehearses together.

**Contracts (first 30 minutes):** Rachel commits both listing schemas (§7.2) + 5 sample listings of each kind. Person 5 commits the profile schema + 2 sample profiles. Person 3 and Person 5 hand finished prompts to Person 4 as text.

### Timeline (5 hours)
- **0:00–0:30, all together:** confirm schemas, write the persona. Driver gives Build mode the skeleton prompt: *"Scholarship matcher: paste-your-story intake → editable profile chips → ranked results with Scholarships and Opportunities tabs, using local JSON data."*
- **0:30–2:30:** driver builds screens; Rachel curates data; Persons 3 and 5 refine prompts in the playground.
- **2:30–3:30:** load real data and prompts; add "almost eligible" and the Scout view importer.
- **3:30:** publish to Cloud Run, export to GitHub.
- **4:00: FEATURE FREEZE.** Anything not working by 3:30 gets hardcoded.
- **4:00–5:00:** polish copy, record backup video, rehearse 3+ times.

## 11. Demo (3 minutes)

1. **Problem (30s):** a quote from our interviews + a screenshot of Fastweb's generic list.
2. **Intake (30s):** paste the persona → chips appear (robotics, food bank, first-gen, parent works at a credit union) → ZIP + grade.
3. **Results (45s):** local awards on top: *"High odds (~1 in 10), county-only, matches robotics."* Contrast with Common App's "8 notifications."
4. **Big moment (45s):** "almost eligible": free engineering day → 3 more scholarships worth $4,500.
5. **Scout view (20s):** import a counselor flyer → listings with quotes appear → approve → they show up for students. *"We built our whole NYC dataset with this same tool. It's how we get the data nobody else has."*
6. **Close (10s):** the one-liner from §1. *"Built on Google AI Studio and Gemini."*

### Judge Q&A
- **"How is this different from Common App?"** The one-liner + we cover 9th grade onward, opportunities, and the steps after a match.
- **"Where does the data come from at scale?"** Scouts (counselors and providers) import it in the Scout view, as shown; every listing comes from an official page with quotes a person reviewed; Gemini grounding keeps it current.
- **"Is this data real?"** *"The opportunities and most scholarships are real, current listings. A few local ones are illustrative so the demo shows the full flow, and they're labeled. The extraction you saw is live."*
- **"Are the odds real?"** *"A transparent estimate from eligible pool size; we never show a fake precise %. Real odds come from providers reporting winners, which is on the roadmap."*
- **"How do you know listings are current?"** Trust badges, providers reconfirming each cycle, student flags.
- **"How do you make money without selling data?"** Grants, school or district licenses, foundation funding. Free for students, always.
- **"Why AI and not filters?"** Fencing → Olympic-sport athlete award; parent's credit union job → employer scholarship. Filters miss both.

**Avoid:** "billions in scholarships go unclaimed" (widely called a myth) and "local awards only exist on paper."

## 12. Roadmap (pitch only, don't build)

- **Two-sided local scholarship network:** counselors and providers post for free → students matched → **providers report winners** → real odds data.
- **Trained odds model:** pretrain on simulated application rounds, then retrain and calibrate on real reported outcomes, once outcome data exists.
- Goals, progress bars, pace check, applied/won tracker, deadline reminders.
- Scheduled scraping, CareerOneStop national data, database + embeddings for scale.
- Essay-prompt clustering ("one essay covers these 5 awards"), voice intake, resume upload.
- Counselor view for many students, Google Maps for nearby opportunities, grounding-based "verify" button.
- Predicting when yearly awards reopen, student-submitted listings, scam classifier.

## 13. Open questions

- Names for Persons 3–5.
- Whose AI Studio account drives the app.
- Do the hackathon rules allow outside code (the optional Python bulk path, §7.3)?
- Opportunities: free / full aid only, or also low-cost (e.g. under $50)?
- Include scholarships only for students already enrolled at one school (labeled), or leave them out?
- Include national scholarships from NYC organizations?
- Does AI Studio Build mode support shared editing?
- Name and branding.
