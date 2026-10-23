# MyOpps

Scholarships and free opportunities, matched to students, sourced by the community.
Counselors and providers upload what they already have (a PDF handout, a spreadsheet, pasted text); students paste a statement and get ranked matches; providers see which opted-in students match and can invite them.

**Everything runs with no API key** using offline mocks. Set `GEMINI_API_KEY` and the same code uses Gemini for extraction, embeddings, and why-lines.

## Run it

```bash
npm install
npm run seed          # writes data/db.json with MOCK listings + 10 opt-in students
npm run dev           # API on :3030, Vite client on :5173 (proxies /api)
```

Open http://localhost:5173. The seed prints two private provider links (`/provider/<token>`); open one to see the provider side.

Production-style (single port, serves the built client):

```bash
npm run build && npm start      # http://localhost:3030
```

### Environment

| var | default | notes |
|---|---|---|
| `GEMINI_API_KEY` | unset → mock mode | Server-side only. Never ship it to the client. |
| `GEMINI_CHAT_MODEL` | `gemini-2.5-flash` | |
| `GEMINI_EMBED_MODEL` | `gemini-embedding-001` | 768 dims (`EMBED_DIM` in `server/llm.ts`) |
| `MOCK_LLM=1` | | Force mocks even with a key |
| `DATA_PATH` | `data/db.json` | JSON "database" |
| `PORT` | `3030` | |

If you switch between mock and Gemini embeddings, run `npm run seed -- --reset` so listing vectors and student vectors come from the same model.

## Pages

Landing `/` offers two doors. Accounts are local mock accounts (email + hashed password in `data/db.json`, no email verification).

Students:
- `/student/login` sign in / create account. "Use demo account" creates `demo.student@example.com`.
- `/onboarding` 01 basics (ZIP, level, grade, GPA, school) → 02 Talk: three spoken questions, mic + Web Speech in Chrome, scripted demo elsewhere (or "prefer to type" → paste) → 03 review traits. Audio never leaves the browser; only the transcript is sent to `/api/extract`.
- `/matches` recomputed on every visit, so every login re-matches against the listings that exist right now. Tabs: Scholarships, Opportunities, My list (saved/applied/won, invitations, next deadline).
- `/profile` edit basics, statement, chips, discoverability; save re-runs matches. Sign out lives here.

Counselors & providers ("partners"):
- `/partner/login` sign in / create account with an organization name. "Use demo account" signs in as the seeded `demo.counselor@example.com` (owns the local NYC listings). A second seeded account, `demo.foundation@example.com` / `demo-password`, owns the state and national ones.
- `/partner/listings` every listing you've added: student match counts, anonymized matching students with Invite, Edit (re-matches on save), Remove.
- `/partner/add` drop PDF / CSV / XLSX or paste text → review table → Publish (credited to your organization).
- `/partner/profile` organization name and type; sign out.

## Design

Matches the team mockups in `soumyamedapati05/ruth_google_team_bobcats` (`scholarship-site/`). Two themes, both in `client/src/styles.css`:

- **Light / editorial** (`index.html`): landing, sign-in and all partner pages. DM Sans, white field, hairlines, two-tier header with numbered section links, drifting warm gradient hero, giant numbered sections, floating "Tell me about yourself…" voice bar.
- **Dark room** (`talk.html` + `talk.css`): every student page after sign-in (onboarding, matches, profile). Inter on warm near-black, cream type, the dome/orb/halo that reacts to your voice (ask → listening → heard → matching), "Your best fits" header with the mini orb, "What we heard" trait pills, rounded beige match cards with a gradient art band, fit pill, "Why you" block and "View details" button.

Page chrome (`SiteHeader`, `RoomLayout`, cursor light) lives in `client/src/components/Chrome.tsx`.

## Layout

```
shared/types.ts      shared shapes
shared/scoring.ts    the only place match %, odds, eligibility live; symmetric (student→listings, listing→students)
server/llm.ts        all Gemini calls + the offline mocks (extractChips, extractListings, embed, explain)
server/auth.ts       local accounts: scrypt password hashes, bearer sessions, requireStudent middleware
server/store.ts      JSON-file persistence shaped like the Firestore collections (listings, students, sessions, student_profiles, tracker_events, invites)
server/routes.ts     /api/upload /listings /extract /match /explain /track /provider /invite
server/seed.ts       loads data/mock-listings.ts
client/src/pages     Login (landing + both sign-ins), Onboarding, Matches, Profile, Add, PartnerListings, PartnerProfile
client/src/components  Talk.tsx (voice flow), Results.tsx (cards, tracker, status control), ProfileForm.tsx, LoginForm.tsx
data/mock-listings.ts   MOCK DATA (see TODO.md)
```

## Privacy rules (don't soften these)

- Discoverability is **off by default**; the student ticks a box.
- Providers see chips, state, level, GPA band. Never deviceId, ZIP, name, or free text. `rankStudents` + `/api/provider` enforce this; provider refs are per-token hashes.
- Invites are in-app only. The student sees it in their tracker. No contact info is exchanged.
- Turning discoverability off deletes the stored profile.

## Importing into Google AI Studio (Build mode)

1. Push this folder to GitHub.
2. In AI Studio → Build → **+ → Import from GitHub**.
3. Add `GEMINI_API_KEY` under Settings → Secrets (AI Studio usually does this for you).
4. Ask the agent: *"Run `npm run seed` then `npm run build && npm start`. Keep all Gemini calls in `server/llm.ts`."*
5. Later: *"Replace `server/store.ts` with Firestore, keeping the same exported functions (`listings`, `profiles`, `tracker`, `invites`)."*

The AI Studio runtime is Node + React, which is exactly what this is, so nothing needs translating.

## Demo script (mock data, New York City)

1. `/partner/login` → "Use demo account" → My listings shows 31 listings with match counts.
2. Add listings → "Use sample" → Extract → review three listings → Publish → back to My listings.
3. Sign out → `/student/login` → "Use demo account" → onboarding: ZIP `10016`, grade 12, GPA 3.8, school "Baruch College Campus High School" → Continue → "Use sample" → Extract → tick the opt-in → See my matches. Local robotics and first-gen awards are in the top five with why-lines. Switch to Opportunities: MIT open day, Seaport robotics tour, all free.
4. The BCCHS-only awards are at the top with a "Your school" pill. Save two, mark one applied; the tracker bar moves.
5. Sign out → partner demo account → open the BCCHS Alumni Leadership Award → Invite the matching card.
6. Sign back in as the student → My list tab: "You've been invited to apply."
