# TODO

## Data (do this first)
- [ ] **Replace mock listings with real ones.** `data/mock-listings.ts` is invented (example.org URLs, made-up providers, deadlines relative to today). Get a real counseling-office scholarship handout (PDF) and a foundation spreadsheet for the demo city, upload them through `/add`, fix the review table, publish. Then delete `data/mock-listings.ts` and the `MOCK_*` imports in `server/seed.ts`.
- [ ] **Replace mock student profiles.** `MOCK_STUDENTS` are invented personas so the provider page isn't empty. For the demo, run intake 8–10 times with varied statements and tick the opt-in instead.
- [ ] `server/zip.ts` is a coarse 3-digit-prefix → state table. Verify the demo ZIPs map correctly; swap in a full table if any are wrong.
- [ ] `estApplicants()` constants in `shared/scoring.ts` are guesses (local 40, state 800, national 5000, modifiers). Tune until the demo persona's top five look right and the odds bands feel honest.

## Before the demo
- [ ] Set `GEMINI_API_KEY` and re-run `npm run seed -- --reset` so embeddings come from Gemini, not the mock hasher.
- [ ] Try a real PDF through `/add` with Gemini (the mock only handles pasted text, one listing per paragraph).
- [ ] Add a `DEMO_MODE` that serves cached `/api/upload` and `/api/explain` responses for the two demo files if Gemini is slow on stage.
- [ ] Mobile pass on `/` and `/provider`.
- [ ] Screenshot a Fastweb search for the demo persona for the opening slide.

## Next steps (post-hackathon, in order)
1. Firestore in place of `server/store.ts` (same exported functions).
2. Firebase Auth in place of `server/auth.ts` (Google sign-in for students; keep `requireStudent`). Then Google sign-in for uploaders; listings owned by an account; replace manage tokens.
2b. Password reset / email verification (needs an email provider). Account deletion is a soft wipe today (`DELETE /api/me`).
3. Email/push for invites and deadline reminders, with student consent.
4. Trust & safety: scam flags on upload (fees, SSN), duplicate detection across uploads, report button, provider verification badge.
5. Odds model Stage 1: Python simulate → train → calibrate → `model.json`; `estimateOdds()` evaluates it when present.
6. "Almost eligible" teaser, LLM rerank of the top 30 inside `/api/explain`.
7. Odds model Stage 2: retrain on real `tracker_events` outcomes.
