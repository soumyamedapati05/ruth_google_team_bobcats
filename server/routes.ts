import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { createHash } from "node:crypto";
import { listings, profiles, tracker, invites, students, sessions } from "./store.js";
import { hashPassword, verifyPassword, newSession, requireAuth, requireStudent, requirePartner, publicStudent, type AuthedRequest } from "./auth.js";
import { embed, extractChips, extractListings, explain, listingText, type ExtractedListing } from "./llm.js";
import { rankListings, rankStudents, gpaBand } from "../shared/scoring.js";
import { zipToState, zipPrefix } from "./zip.js";
import type { Listing, Profile, MatchCard, AnonStudent, Chips, TrackStatus, Student, StudentProfileInput, Role, PartnerProfile } from "../shared/types.js";

export const api = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const publicListing = (l: Listing) => {
  const { embedding, manageToken, ...rest } = l;
  return rest;
};

function flattenChips(c: Chips): string[] {
  return [
    ...c.activities, ...c.volunteering, ...c.awards, ...c.interests,
    ...(c.major ? [c.major] : []), ...c.backgroundFlags, ...c.connections,
  ].map(s => s.trim()).filter(Boolean);
}

// ---------- Upload & publish ----------

// POST /api/upload  (multipart "file" = pdf/csv/xlsx, or JSON { text })
api.post("/upload", requirePartner, upload.single("file"), async (req, res) => {
  try {
    let extracted: ExtractedListing[] = [];
    const file = req.file;
    if (file && /spreadsheet|excel|csv|text\/plain/.test(file.mimetype) || file?.originalname.match(/\.(csv|xlsx|xls)$/i)) {
      const wb = XLSX.read(file!.buffer, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      // Batches of 10 rows -> one extraction call each. Rows are rendered as "Header: value" text.
      for (let i = 0; i < rows.length; i += 10) {
        const batch = rows.slice(i, i + 10);
        const text = batch.map(r => Object.entries(r).map(([k, v]) => `${k}: ${v}`).join("\n")).join("\n\n");
        extracted.push(...await extractListings({ text: `Each block below is one spreadsheet row.\n\n${text}` }));
      }
    } else if (file) {
      extracted = await extractListings({ file: { buffer: file.buffer, mimeType: file.mimetype || "application/pdf" } });
    } else if (typeof req.body?.text === "string" && req.body.text.trim()) {
      extracted = await extractListings({ text: req.body.text });
    } else {
      return res.status(400).json({ error: "Send a file or { text }" });
    }
    res.json({ listings: extracted });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message ?? "extraction failed" });
  }
});

// POST /api/listings  { listings: ExtractedListing[], uploadedBy? }  -> publish
api.post("/listings", requirePartner, async (req, res) => {
  const st = (req as AuthedRequest).student;
  const rows = (req.body?.listings ?? []) as ExtractedListing[];
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "No listings" });
  const vectors = await embed(rows.map(listingText));
  const created = listings.insertMany(rows.map((r, i) => ({
    ...r,
    url: r.url || "",
    embedding: vectors[i],
    ownerId: st.id,
    uploadedBy: st.org?.orgName ?? "community",
  })));
  res.json({ ids: created.map(l => l.id) });
});

api.get("/listings", (_req, res) => {
  res.json({ listings: listings.all().map(publicListing) });
});

// ---------- Student side ----------

api.post("/extract", async (req, res) => {
  const text = String(req.body?.text ?? "");
  if (!text.trim()) return res.status(400).json({ error: "No text" });
  try {
    const chips = await extractChips(text);
    res.json({ chips, flat: flattenChips(chips) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Accounts ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

api.post("/auth/signup", (req, res) => {
  const { email, password, role, org } = req.body as { email?: string; password?: string; role?: Role; org?: Partial<PartnerProfile> };
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email" });
  if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  if (students.byEmail(email)) return res.status(409).json({ error: "An account with that email already exists. Sign in instead." });
  const isPartner = role === "partner";
  if (isPartner && !org?.orgName?.trim()) return res.status(400).json({ error: "Enter your school or organization name" });
  const st = students.insert({
    role: isPartner ? "partner" : "student",
    email, passwordHash: hashPassword(password),
    onboarded: isPartner,   // partners have no onboarding steps
    profile: { zip: "", level: "hs", grade: "12", chips: [], discoverable: false },
    org: isPartner ? { orgName: org!.orgName!.trim().slice(0, 120), orgType: (org!.orgType as any) ?? "other", contactName: org!.contactName?.trim().slice(0, 80) } : undefined,
  });
  res.json({ token: newSession(st.id), me: publicStudent(st) });
});

api.post("/auth/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const st = email ? students.byEmail(email) : undefined;
  if (!st || !password || !verifyPassword(password, st.passwordHash)) return res.status(401).json({ error: "Email or password didn't match" });
  students.update(st.id, { lastLoginAt: new Date().toISOString() });
  res.json({ token: newSession(st.id), me: publicStudent(st) });
});

api.post("/auth/logout", requireAuth, (req, res) => {
  const token = (req.headers.authorization ?? "").slice(7);
  sessions.remove(token);
  res.json({ ok: true });
});

api.get("/me", requireAuth, (req, res) => {
  res.json({ me: publicStudent((req as AuthedRequest).student) });
});

// Save profile (onboarding or profile page). Re-embeds and refreshes discoverability.
api.put("/me/profile", requireStudent, async (req, res) => {
  const st = (req as AuthedRequest).student;
  const b = (req.body ?? {}) as Partial<StudentProfileInput>;
  const zip = String(b.zip ?? st.profile.zip).replace(/\D/g, "").slice(0, 5);
  if (zip.length !== 5) return res.status(400).json({ error: "Enter a 5-digit ZIP code" });
  const level = b.level === "college" ? "college" : "hs";
  const chips = Array.isArray(b.chips) ? b.chips.map(c => String(c).trim()).filter(Boolean).slice(0, 40) : st.profile.chips;
  const profile: StudentProfileInput = {
    zip, level,
    grade: level === "hs" ? (b.grade ?? st.profile.grade ?? "12") : undefined,
    gpa: b.gpa == null || b.gpa === ("" as any) ? undefined : Number(b.gpa),
    school: typeof b.school === "string" && b.school.trim() ? b.school.trim().slice(0, 80) : undefined,
    statement: typeof b.statement === "string" ? b.statement.slice(0, 8000) : st.profile.statement,
    chips,
    discoverable: !!b.discoverable,
  };
  const updated = students.update(st.id, { profile, onboarded: true })!;
  await syncDiscoverable(updated);
  res.json({ me: publicStudent(updated) });
});

api.put("/me/org", requirePartner, (req, res) => {
  const st = (req as AuthedRequest).student;
  const b = (req.body ?? {}) as Partial<PartnerProfile>;
  if (!b.orgName?.trim()) return res.status(400).json({ error: "Organization name is required" });
  const updated = students.update(st.id, { org: { orgName: b.orgName.trim().slice(0, 120), orgType: (b.orgType as any) ?? st.org?.orgType ?? "other", contactName: b.contactName?.trim().slice(0, 80) } })!;
  // Keep the display name on existing listings in sync.
  for (const l of listings.byOwner(st.id)) listings.update(l.id, { uploadedBy: updated.org!.orgName });
  res.json({ me: publicStudent(updated) });
});

api.delete("/me", requireStudent, (req, res) => {
  const st = (req as AuthedRequest).student;
  profiles.remove(st.id);
  students.update(st.id, { profile: { zip: "", level: "hs", chips: [], discoverable: false }, onboarded: false, email: `deleted-${st.id}@invalid`, passwordHash: "x" });
  res.json({ ok: true });
});

async function buildProfile(p: StudentProfileInput): Promise<Profile> {
  // School name goes into the embedding text so neighborhood listings that mention it rank higher.
  const [vec] = await embed([[...p.chips, ...(p.school ? [`student at ${p.school}`] : [])].join("; ") || "student"]);
  return { chips: p.chips, state: zipToState(p.zip), zipPrefix: zipPrefix(p.zip), level: p.level, grade: p.grade, gpa: p.gpa, school: p.school, embedding: vec };
}

// Keep the provider-visible pool in sync with the student's discoverability choice.
async function syncDiscoverable(st: Student) {
  if (st.profile.discoverable && st.profile.zip) {
    const prof = await buildProfile(st.profile);
    profiles.upsert({ ...prof, deviceId: st.id, discoverable: true, updatedAt: new Date().toISOString() });
  } else {
    profiles.remove(st.id);
  }
}

// ---------- Matching ----------

// Runs against the student's saved profile and whatever listings exist right now.
api.post("/match", requireStudent, async (req, res) => {
  const st = (req as AuthedRequest).student;
  if (!st.onboarded || !st.profile.zip) return res.status(400).json({ error: "Finish setting up your profile first" });
  const profile = await buildProfile(st.profile);
  const ranked = rankListings(profile, listings.all());
  const toCard = (r: ReturnType<typeof rankListings>[number]): MatchCard => ({
    listing: publicListing(r.listing), matchPct: r.matchPct, odds: { band: r.odds.band, label: r.odds.label }, isLocal: r.isLocal,
  });
  const scholarships = ranked.filter(r => r.listing.kind === "scholarship").slice(0, 30).map(toCard);
  const opportunities = ranked.filter(r => r.listing.kind === "opportunity").slice(0, 30).map(toCard);
  res.json({ scholarships, opportunities, state: profile.state, matchedAt: new Date().toISOString(), listingCount: listings.all().length });
});

const explainCache = new Map<string, Record<string, string>>();
api.post("/explain", requireStudent, async (req, res) => {
  const chips = (req as AuthedRequest).student.profile.chips;
  const ids = (req.body?.listingIds ?? []) as string[];
  const key = createHash("sha1").update(JSON.stringify([chips, [...ids].sort()])).digest("hex");
  if (explainCache.has(key)) return res.json({ why: explainCache.get(key) });
  const ls = ids.map(id => listings.byId(id)).filter((l): l is Listing => !!l).slice(0, 12);
  try {
    const why = await explain(chips, ls);
    explainCache.set(key, why);
    res.json({ why });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Tracker ----------

api.get("/track", requireStudent, (req, res) => {
  const id = (req as AuthedRequest).student.id;
  const events = tracker.forDevice(id);
  // Listing snapshots so saved items still show in "My list" even if they fall out of today's matches.
  const seen = new Set<string>();
  const listingsForEvents = events.map(e => e.listingId).filter(x => !seen.has(x) && seen.add(x)).map(x => listings.byId(x)).filter((l): l is Listing => !!l).map(publicListing);
  const inv = invites.forDevice(id).map(i => ({ ...i, listing: listings.byId(i.listingId) && publicListing(listings.byId(i.listingId)!) }));
  res.json({ events, invites: inv, listings: listingsForEvents });
});

api.post("/track", requireStudent, (req, res) => {
  const id = (req as AuthedRequest).student.id;
  const { listingId, status, amountWon } = req.body as { listingId: string; status: TrackStatus | "none"; amountWon?: number };
  if (!listingId || !status) return res.status(400).json({ error: "listingId, status required" });
  tracker.set(id, listingId, status, amountWon);
  res.json({ events: tracker.forDevice(id) });
});

// ---------- Partner side (counselors & providers) ----------

// Opaque per-owner refs so a partner never sees a student id.
const refFor = (ownerId: string, studentId: string) => createHash("sha256").update(`${ownerId}:${studentId}`).digest("hex").slice(0, 16);

function partnerView(ownerId: string, l: Listing) {
  const pool = profiles.discoverable();
  const ranked = rankStudents(l, pool);
  const invited = new Set(invites.forListing(l.id).map(i => i.deviceId));
  const students: AnonStudent[] = ranked.slice(0, 20).map(r => ({
    ref: refFor(ownerId, r.profile.deviceId),
    chips: r.profile.chips.slice(0, 8),
    state: r.profile.state,
    level: r.profile.level,
    gpaBand: gpaBand(r.profile.gpa),
    matchPct: r.matchPct,
    isLocal: r.isLocal,
    schoolMatch: r.schoolMatch,   // true/false only; the school name itself is never sent
    invited: invited.has(r.profile.deviceId),
  }));
  const saves = tracker.countForListing(l.id);
  return { listing: publicListing(l), matchCount: ranked.length, localCount: ranked.filter(r => r.isLocal).length, students, saves };
}

api.get("/partner/listings", requirePartner, (req, res) => {
  const st = (req as AuthedRequest).student;
  const mine = listings.byOwner(st.id).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  res.json({ listings: mine.map(l => partnerView(st.id, l)) });
});

api.patch("/partner/listings/:id", requirePartner, async (req, res) => {
  const st = (req as AuthedRequest).student;
  const l = listings.byId(req.params.id);
  if (!l || l.ownerId !== st.id) return res.status(403).json({ error: "Not your listing" });
  const { embedding, manageToken, ownerId, id, createdAt, ...patch } = req.body ?? {};
  const next = { ...l, ...patch };
  const [vec] = await embed([listingText(next)]);
  const updated = listings.update(l.id, { ...patch, embedding: vec })!;
  res.json(partnerView(st.id, updated));
});

api.delete("/partner/listings/:id", requirePartner, (req, res) => {
  const st = (req as AuthedRequest).student;
  const l = listings.byId(req.params.id);
  if (!l || l.ownerId !== st.id) return res.status(403).json({ error: "Not your listing" });
  listings.remove(l.id);
  res.json({ ok: true });
});

api.post("/partner/invite", requirePartner, (req, res) => {
  const st = (req as AuthedRequest).student;
  const { listingId, ref } = req.body as { listingId: string; ref: string };
  const l = listings.byId(listingId);
  if (!l || l.ownerId !== st.id) return res.status(403).json({ error: "Not your listing" });
  const student = profiles.discoverable().find(p => refFor(st.id, p.deviceId) === ref);
  if (!student) return res.status(404).json({ error: "Student not found or no longer discoverable" });
  invites.add(listingId, student.deviceId);
  res.json({ ok: true });
});

api.get("/health", (_req, res) => res.json({ ok: true, listings: listings.all().length, mock: process.env.GEMINI_API_KEY ? false : true }));
