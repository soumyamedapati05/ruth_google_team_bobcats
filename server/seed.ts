// Seeds data/db.json with MOCK listings, opt-in student profiles, and two demo partner accounts.
// Run: npm run seed      (add --reset to wipe existing data first)
import { randomUUID } from "node:crypto";
import { load, resetTo, DATA_PATH } from "./store";
import { embed, listingText } from "./llm";
import { zipToState, zipPrefix } from "./zip";
import { hashPassword } from "./auth";
import { MOCK_SCHOLARSHIPS, MOCK_OPPORTUNITIES, MOCK_STUDENTS } from "../data/mock-listings";
import type { Listing, StudentProfile, Student } from "../shared/types";

export async function seedMockData() {
const now = new Date().toISOString();
const emptyProfile = { zip: "", level: "hs" as const, chips: [], discoverable: false };

// Demo partner accounts. Local NYC listings belong to the counselor; the rest to a foundation.
const DEMO_COUNSELOR = { email: "demo.counselor@example.com", password: "demo-password" };
const DEMO_FOUNDATION = { email: "demo.foundation@example.com", password: "demo-password" };
const counselor: Student = { id: randomUUID(), role: "partner", email: DEMO_COUNSELOR.email, passwordHash: hashPassword(DEMO_COUNSELOR.password), createdAt: now, onboarded: true, profile: emptyProfile, org: { orgName: "Baruch College Campus HS counseling office", orgType: "school", contactName: "Demo Counselor" } };
const foundation: Student = { id: randomUUID(), role: "partner", email: DEMO_FOUNDATION.email, passwordHash: hashPassword(DEMO_FOUNDATION.password), createdAt: now, onboarded: true, profile: emptyProfile, org: { orgName: "Empire Community Foundation (mock)", orgType: "foundation" } };

const rows = [...MOCK_SCHOLARSHIPS, ...MOCK_OPPORTUNITIES];
const vectors = await embed(rows.map(listingText));
const listings: Listing[] = rows.map((r, i) => {
  const owner = r.zipPrefixes?.length ? counselor : foundation;
  return { ...r, id: randomUUID(), url: r.url || "", embedding: vectors[i], ownerId: owner.id, uploadedBy: owner.org!.orgName, createdAt: now };
});

const studentVecs = await embed(MOCK_STUDENTS.map(s => [...s.chips, ...(s.school ? [`student at ${s.school}`] : [])].join("; ")));
const studentProfiles: StudentProfile[] = MOCK_STUDENTS.map((s, i) => ({
  deviceId: s.deviceId, chips: s.chips, state: zipToState(s.zip), zipPrefix: zipPrefix(s.zip), level: s.level,
  grade: s.grade, gpa: s.gpa, school: s.school, embedding: studentVecs[i], discoverable: true, updatedAt: now,
}));

resetTo({ listings, studentProfiles, students: [counselor, foundation], sessions: [], trackerEvents: [], invites: [] });
await new Promise(r => setTimeout(r, 300));
console.log(`seeded ${listings.length} listings, ${studentProfiles.length} opt-in student profiles, 2 partner accounts`);
console.log(`counselor login:   ${DEMO_COUNSELOR.email} / ${DEMO_COUNSELOR.password}  (${listings.filter(l => l.ownerId === counselor.id).length} listings)`);
console.log(`foundation login:  ${DEMO_FOUNDATION.email} / ${DEMO_FOUNDATION.password}  (${listings.filter(l => l.ownerId === foundation.id).length} listings)`);
}

// CLI: npm run seed [-- --reset]
if (process.argv[1] && /seed\.ts$/.test(process.argv[1])) {
  const reset = process.argv.includes("--reset");
  const db = load();
  if (db.listings.length && !reset) {
    console.log(`db already has ${db.listings.length} listings at ${DATA_PATH}; use --reset to overwrite`);
  } else {
    await seedMockData();
  }
}
