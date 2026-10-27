// Seeds data/db.json with real listings from data/scholarships.json + data/opportunities.json,
// opt-in student profiles, and two demo partner accounts.
// Run: npm run seed      (add --reset to wipe existing data first)
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { load, resetTo, DATA_PATH } from "./store.js";
import { embed, listingText } from "./llm.js";
import { zipToState, zipPrefix } from "./zip.js";
import { hashPassword } from "./auth.js";
import type { Listing, StudentProfile, Student } from "../shared/types.js";
import type { ExtractedListing } from "./llm.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../data");

// Convert spec-style JSON (snake_case) to the app's camelCase ExtractedListing.
function convertScholarship(s: any): ExtractedListing {
  const elig = s.eligibility ?? {};
  const geo = elig.geo_areas ?? [];
  // Derive zipPrefixes from geo_areas if NYC
  const NYC_PREFIXES = ["100", "101", "102", "103", "104", "110", "111", "112", "113", "114"];
  const isNYC = elig.nyc_only || geo.includes("NYC");
  // Derive states from geo_areas
  const states = geo.filter((g: string) => g.length === 2 && g !== "US").length
    ? geo.filter((g: string) => g.length === 2 && g !== "US")
    : elig.nyc_only ? ["NY"] : undefined;

  // Map requirements to effort
  let effort: string | undefined;
  const req = s.requirements;
  if (req) {
    if (req.recommendations && req.recommendations > 0 && req.essay) effort = "essay_plus_recs";
    else if (req.essay) effort = "essay";
    else if (req.application_fee === 0 || req.other?.length) effort = "short_form";
    else effort = "short_form";
  }

  return {
    kind: "scholarship",
    title: s.title,
    provider: s.provider,
    url: s.url ?? "",
    summary: s.summary,
    amountMin: s.amount_min ?? undefined,
    amountMax: s.amount_max ?? undefined,
    deadline: s.deadline,
    states,
    zipPrefixes: isNYC ? NYC_PREFIXES : undefined,
    schools: elig.enrolled_at?.length ? elig.enrolled_at : undefined,
    schoolLevels: s.school_levels?.map((l: string) => l.toLowerCase()),
    minGpa: elig.min_gpa ?? undefined,
    numAwards: s.num_awards ?? 1,
    estApplicants: s.published_applicants ?? s.est_pool ?? undefined,
    focusTags: s.focus_tags ?? [],
    effort: effort as any,
    isSweepstakes: !!s.is_sweepstakes,
  };
}

function convertOpportunity(o: any): ExtractedListing {
  const elig = o.eligibility ?? {};
  const geo = elig.geo_areas ?? [];
  const NYC_PREFIXES = ["100", "101", "102", "103", "104", "110", "111", "112", "113", "114"];
  const isNYC = elig.nyc_only || geo.includes("NYC");
  const states = geo.filter((g: string) => g.length === 2 && g !== "US").length
    ? geo.filter((g: string) => g.length === 2 && g !== "US")
    : elig.nyc_only ? ["NY"] : undefined;

  // Map type to oppType
  const typeMap: Record<string, string> = {
    hackathon: "hackathon",
    campus_visit: "outreach_event",
    program: "program",
    workshop: "outreach_event",
    info_session: "outreach_event",
    company_event: "company_visit",
    competition: "competition",
  };

  // Map apply_effort array to single effort
  const efforts = o.apply_effort ?? [];
  let effort: string | undefined;
  if (efforts.includes("essay") && efforts.includes("rec")) effort = "essay_plus_recs";
  else if (efforts.includes("essay")) effort = "essay";
  else if (efforts.includes("short_form") || efforts.includes("first_come")) effort = "short_form";
  else if (efforts.length) effort = "short_form";
  else effort = "none";

  return {
    kind: "opportunity",
    oppType: (typeMap[o.type] ?? o.type) as any,
    title: o.title,
    provider: o.provider,
    url: o.url ?? "",
    summary: o.summary,
    cost: o.cost ?? 0,
    whatsCovered: o.covers?.length ? o.covers.join(", ") : (o.stipend_amount ? `Stipend $${o.stipend_amount}` : undefined),
    eventDate: o.start_date,
    deadline: o.application_deadline ?? o.start_date,
    states,
    zipPrefixes: isNYC ? NYC_PREFIXES : undefined,
    schools: elig.enrolled_at?.length ? elig.enrolled_at : undefined,
    isOnline: o.is_online || undefined,
    schoolLevels: o.school_levels?.map((l: string) => l.toLowerCase()),
    minGpa: elig.min_gpa ?? undefined,
    numAwards: o.capacity ?? 1,
    focusTags: o.focus_tags ?? [],
    effort: effort as any,
  };
}

// Same mock students as before for demo purposes.
const MOCK_STUDENTS = [
  { deviceId: "mock-s1", zip: "10016", level: "hs" as const, grade: "12", gpa: 3.8, school: "Baruch College Campus High School", chips: ["student council president", "DECA chapter leader", "robotics team captain", "food bank volunteer", "first-gen", "parent works at municipal credit union", "fencing"] },
  { deviceId: "mock-s2", zip: "11201", level: "hs" as const, grade: "11", gpa: 3.5, school: "Brooklyn Technical High School", chips: ["FIRST robotics", "engineering club", "hackathon winner", "3D printing", "math team"] },
  { deviceId: "mock-s3", zip: "10451", level: "hs" as const, grade: "12", gpa: 3.2, school: undefined, chips: ["basketball", "community service", "church youth group", "first-gen", "bilingual Spanish"] },
  { deviceId: "mock-s4", zip: "10016", level: "college" as const, grade: "freshman", gpa: 3.6, school: "Baruch College", chips: ["business major", "finance club", "immigrant family", "small business", "tutoring"] },
  { deviceId: "mock-s5", zip: "11373", level: "hs" as const, grade: "12", gpa: 3.9, school: undefined, chips: ["science research", "biology", "hospital volunteer", "pre-med", "women in STEM"] },
  { deviceId: "mock-s6", zip: "10002", level: "hs" as const, grade: "12", gpa: 3.4, school: undefined, chips: ["journalism", "school newspaper editor", "debate team", "writing", "Model UN"] },
  { deviceId: "mock-s7", zip: "10301", level: "hs" as const, grade: "11", gpa: 3.1, school: undefined, chips: ["music", "piano", "orchestra", "arts", "volunteering at senior center"] },
  { deviceId: "mock-s8", zip: "10016", level: "hs" as const, grade: "12", gpa: 3.7, school: "Stuyvesant High School", chips: ["computer science", "cybersecurity club", "hackathons", "esports team captain", "coding"] },
  { deviceId: "mock-s9", zip: "10467", level: "college" as const, grade: "sophomore", gpa: 3.3, school: "Lehman College", chips: ["nursing major", "hospital CNA", "bilingual Spanish", "Bronx resident", "first-gen"] },
  { deviceId: "mock-s10", zip: "11201", level: "hs" as const, grade: "10", gpa: 3.6, school: undefined, chips: ["environmental club", "climate march organizer", "urban gardening", "sustainability"] },
];

export async function seedMockData() {
const now = new Date().toISOString();
const emptyProfile = { zip: "", level: "hs" as const, chips: [], discoverable: false };

// Load real data from JSON files
const rawScholarships = JSON.parse(readFileSync(resolve(dataDir, "scholarships.json"), "utf-8"));
const rawOpportunities = JSON.parse(readFileSync(resolve(dataDir, "opportunities.json"), "utf-8"));

const scholarships = rawScholarships.map(convertScholarship);
const opportunities = rawOpportunities.map(convertOpportunity);

// Demo partner accounts
const DEMO_COUNSELOR = { email: "demo.counselor@example.com", password: "demo-password" };
const DEMO_FOUNDATION = { email: "demo.foundation@example.com", password: "demo-password" };
const counselor: Student = { id: randomUUID(), role: "partner", email: DEMO_COUNSELOR.email, passwordHash: hashPassword(DEMO_COUNSELOR.password), createdAt: now, onboarded: true, profile: emptyProfile, org: { orgName: "Baruch College Campus HS counseling office", orgType: "school", contactName: "Demo Counselor" } };
const foundation: Student = { id: randomUUID(), role: "partner", email: DEMO_FOUNDATION.email, passwordHash: hashPassword(DEMO_FOUNDATION.password), createdAt: now, onboarded: true, profile: emptyProfile, org: { orgName: "Empire Community Foundation", orgType: "foundation" } };

const rawAll = [...rawScholarships, ...rawOpportunities];
const rows = [...scholarships, ...opportunities];
const vectors = await embed(rows.map(listingText));
const listings: Listing[] = rows.map((r, i) => {
  const owner = r.zipPrefixes?.length ? counselor : foundation;
  return { ...r, id: rawAll[i]?.id ?? randomUUID(), url: r.url || "", embedding: vectors[i], ownerId: owner.id, uploadedBy: owner.org!.orgName, createdAt: now };
});

const studentVecs = await embed(MOCK_STUDENTS.map(s => [...s.chips, ...(s.school ? [`student at ${s.school}`] : [])].join("; ")));
const studentProfiles: StudentProfile[] = MOCK_STUDENTS.map((s, i) => ({
  deviceId: s.deviceId, chips: s.chips, state: zipToState(s.zip), zipPrefix: zipPrefix(s.zip), level: s.level,
  grade: s.grade, gpa: s.gpa, school: s.school, embedding: studentVecs[i], discoverable: true, updatedAt: now,
}));

resetTo({ listings, studentProfiles, students: [counselor, foundation], sessions: [], trackerEvents: [], invites: [] });
await new Promise(r => setTimeout(r, 300));
console.log(`seeded ${listings.length} listings (${scholarships.length} scholarships + ${opportunities.length} opportunities), ${studentProfiles.length} opt-in student profiles, 2 partner accounts`);
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
