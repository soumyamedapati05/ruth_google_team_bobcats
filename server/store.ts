// Persistence. Today: one JSON file on disk with the same four "collections" the
// Firestore version will have. Listings stay in memory with their embeddings.
// TODO(next): swap this file for Firestore; keep the function signatures.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { Listing, StudentProfile, TrackerEvent, Invite, Student, Session } from "../shared/types";

// fileURLToPath (not .pathname) so folders with spaces or special characters work.
export const DATA_PATH = process.env.DATA_PATH ?? fileURLToPath(new URL("../data/db.json", import.meta.url));

type DB = {
  listings: Listing[];
  studentProfiles: StudentProfile[];
  trackerEvents: TrackerEvent[];
  invites: Invite[];
  students: Student[];
  sessions: Session[];
};

let db: DB = { listings: [], studentProfiles: [], trackerEvents: [], invites: [], students: [], sessions: [] };

export function load() {
  if (existsSync(DATA_PATH)) {
    db = { ...db, ...JSON.parse(readFileSync(DATA_PATH, "utf8")) };
    // Migrations for files written by earlier builds.
    let changed = false;
    for (const s of db.students) if (!s.role) { s.role = "student"; changed = true; }
    if (changed) save();
  }
  return db;
}

let saveTimer: NodeJS.Timeout | null = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    mkdirSync(dirname(DATA_PATH), { recursive: true });
    writeFileSync(DATA_PATH, JSON.stringify(db, null, 0));
  }, 150);
}

export function resetTo(next: Partial<DB>) { db = { listings: [], studentProfiles: [], trackerEvents: [], invites: [], students: [], sessions: [], ...next }; save(); }

// ----- students & sessions -----
export const students = {
  byId: (id: string) => db.students.find(s => s.id === id),
  byEmail: (email: string) => db.students.find(s => s.email === email.toLowerCase().trim()),
  insert(s: Omit<Student, "id" | "createdAt">) {
    const st: Student = { ...s, email: s.email.toLowerCase().trim(), id: randomUUID(), createdAt: new Date().toISOString() };
    db.students.push(st);
    save();
    return st;
  },
  update(id: string, patch: Partial<Student>) {
    const i = db.students.findIndex(s => s.id === id);
    if (i < 0) return undefined;
    db.students[i] = { ...db.students[i], ...patch };
    save();
    return db.students[i];
  },
};

export const sessions = {
  byToken: (token: string) => db.sessions.find(s => s.token === token),
  add(s: Session) { db.sessions.push(s); save(); },
  remove(token: string) { db.sessions = db.sessions.filter(s => s.token !== token); save(); },
};

// ----- listings -----
export const listings = {
  all: () => db.listings,
  byId: (id: string) => db.listings.find(l => l.id === id),
  byToken: (token: string) => db.listings.filter(l => l.manageToken === token),
  byOwner: (ownerId: string) => db.listings.filter(l => l.ownerId === ownerId),
  insertMany(rows: Omit<Listing, "id" | "createdAt">[]) {
    const created = rows.map(r => ({ ...r, id: randomUUID(), createdAt: new Date().toISOString() }));
    db.listings.push(...created);
    save();
    return created;
  },
  update(id: string, patch: Partial<Listing>) {
    const i = db.listings.findIndex(l => l.id === id);
    if (i < 0) return undefined;
    db.listings[i] = { ...db.listings[i], ...patch };
    save();
    return db.listings[i];
  },
  remove(id: string) {
    db.listings = db.listings.filter(l => l.id !== id);
    save();
  },
};

// ----- student profiles (opt-in only) -----
export const profiles = {
  discoverable: () => db.studentProfiles.filter(p => p.discoverable),
  upsert(p: StudentProfile) {
    const i = db.studentProfiles.findIndex(x => x.deviceId === p.deviceId);
    if (i >= 0) db.studentProfiles[i] = p; else db.studentProfiles.push(p);
    save();
  },
  remove(deviceId: string) {
    db.studentProfiles = db.studentProfiles.filter(x => x.deviceId !== deviceId);
    save();
  },
};

// ----- tracker -----
export const tracker = {
  forDevice: (deviceId: string) => db.trackerEvents.filter(e => e.deviceId === deviceId),
  countForListing: (listingId: string) => {
    const ev = db.trackerEvents.filter(e => e.listingId === listingId);
    return { saved: ev.filter(e => e.status === "saved").length, applied: ev.filter(e => e.status === "applied" || e.status === "attended").length };
  },
  add(e: Omit<TrackerEvent, "id" | "createdAt">) {
    const ev = { ...e, id: randomUUID(), createdAt: new Date().toISOString() };
    db.trackerEvents.push(ev);
    save();
    return ev;
  },
  // One progressive status per (device, listing): saved -> applied -> won | not_selected.
  // Outcomes keep the applied event so "applied this week" still counts.
  set(deviceId: string, listingId: string, status: TrackerEvent["status"] | "none", amountWon?: number) {
    const mine = (e: TrackerEvent) => e.deviceId === deviceId && e.listingId === listingId;
    const drop = (statuses: TrackerEvent["status"][]) => { db.trackerEvents = db.trackerEvents.filter(e => !(mine(e) && statuses.includes(e.status))); };
    if (status === "none") { drop(["saved", "applied", "won", "not_selected", "attended"]); save(); return undefined; }
    if (status === "saved") drop(["saved", "applied", "won", "not_selected", "attended"]);
    if (status === "applied" || status === "attended") drop(["saved", "won", "not_selected"]);
    if (status === "won" || status === "not_selected") { drop(["saved", "won", "not_selected"]); if (!db.trackerEvents.some(e => mine(e) && e.status === "applied")) db.trackerEvents.push({ id: randomUUID(), deviceId, listingId, status: "applied", createdAt: new Date().toISOString() }); }
    if (db.trackerEvents.some(e => mine(e) && e.status === status)) { save(); return undefined; }
    const ev = { id: randomUUID(), deviceId, listingId, status, amountWon, createdAt: new Date().toISOString() };
    db.trackerEvents.push(ev);
    save();
    return ev;
  },
  remove(deviceId: string, listingId: string, status: TrackerEvent["status"]) {
    db.trackerEvents = db.trackerEvents.filter(e => !(e.deviceId === deviceId && e.listingId === listingId && e.status === status));
    save();
  },
};

// ----- demo cleanup (wipe demo accounts on server restart so they re-onboard) -----
export function purgeDemoAccounts() {
  const isDemoEmail = (e: string) => e.startsWith("demo.") && e.endsWith("@example.com");
  const demoIds = new Set(db.students.filter(s => isDemoEmail(s.email)).map(s => s.id));
  if (demoIds.size === 0) return;
  db.students = db.students.filter(s => !demoIds.has(s.id));
  db.sessions = db.sessions.filter(s => !demoIds.has(s.studentId));
  db.trackerEvents = db.trackerEvents.filter(e => !demoIds.has(e.deviceId));
  db.studentProfiles = db.studentProfiles.filter(p => !demoIds.has(p.deviceId));
  db.invites = db.invites.filter(i => !demoIds.has(i.deviceId));
  save();
}

// ----- invites -----
export const invites = {
  forDevice: (deviceId: string) => db.invites.filter(i => i.deviceId === deviceId),
  forListing: (listingId: string) => db.invites.filter(i => i.listingId === listingId),
  add(listingId: string, deviceId: string) {
    const existing = db.invites.find(i => i.listingId === listingId && i.deviceId === deviceId);
    if (existing) return existing;
    const inv = { id: randomUUID(), listingId, deviceId, createdAt: new Date().toISOString() };
    db.invites.push(inv);
    save();
    return inv;
  },
};
