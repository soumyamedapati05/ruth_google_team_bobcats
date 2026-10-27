// All Gemini calls live here. With no GEMINI_API_KEY the mock implementations run,
// so the whole app works offline for development and demos.
import { GoogleGenAI, Type, type Schema } from "@google/genai";
import type { Chips, Listing } from "../shared/types.js";
import { createHash } from "node:crypto";

const apiKey = process.env.GEMINI_API_KEY;
export const MOCK = !apiKey || process.env.MOCK_LLM === "1";
const ai = MOCK ? null : new GoogleGenAI({ apiKey });

const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";
export const EMBED_DIM = 768;

// ---------- Embeddings ----------

// Mock embedding: hashed bag of words + bigrams into a fixed-dim vector.
// Deterministic, cheap, and good enough that related text lands nearby.
export function mockEmbed(text: string): number[] {
  const v = new Array(EMBED_DIM).fill(0);
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2);
  const toks = [...words, ...words.slice(1).map((w, i) => words[i] + "_" + w)];
  for (const t of toks) {
    const h = createHash("md5").update(t).digest();
    for (let k = 0; k < 4; k++) {
      const idx = h.readUInt16LE(k * 2) % EMBED_DIM;
      v[idx] += (h[8 + k] & 1 ? 1 : -1) * (t.includes("_") ? 0.5 : 1);
    }
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map(x => x / norm);
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (MOCK || !ai) return texts.map(mockEmbed);
  const res = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: texts,
    config: { outputDimensionality: EMBED_DIM },
  });
  return (res.embeddings ?? []).map(e => e.values ?? []);
}

export function listingText(l: Pick<Listing, "title" | "provider" | "summary" | "focusTags" | "whatsCovered" | "schools">) {
  return [l.title, l.provider, l.summary, l.whatsCovered, (l.focusTags ?? []).join(", "), (l.schools ?? []).join(", ")].filter(Boolean).join(". ");
}

// ---------- Structured extraction ----------

const chipsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    activities: { type: Type.ARRAY, items: { type: Type.STRING } },
    volunteering: { type: Type.ARRAY, items: { type: Type.STRING } },
    awards: { type: Type.ARRAY, items: { type: Type.STRING } },
    interests: { type: Type.ARRAY, items: { type: Type.STRING } },
    major: { type: Type.STRING, nullable: true },
    backgroundFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
    connections: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["activities", "volunteering", "awards", "interests", "backgroundFlags", "connections"],
};

const listingSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      kind: { type: Type.STRING, enum: ["scholarship", "opportunity"] },
      oppType: { type: Type.STRING, enum: ["hackathon", "outreach_event", "company_visit", "competition", "program"], nullable: true },
      title: { type: Type.STRING },
      provider: { type: Type.STRING, nullable: true },
      url: { type: Type.STRING, nullable: true },
      summary: { type: Type.STRING },
      amountMin: { type: Type.NUMBER, nullable: true },
      amountMax: { type: Type.NUMBER, nullable: true },
      cost: { type: Type.NUMBER, nullable: true },
      whatsCovered: { type: Type.STRING, nullable: true },
      deadline: { type: Type.STRING, nullable: true, description: "YYYY-MM-DD" },
      eventDate: { type: Type.STRING, nullable: true, description: "YYYY-MM-DD" },
      states: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
      zipPrefixes: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
      schools: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true, description: "Only when restricted to students of named schools" },
      isOnline: { type: Type.BOOLEAN, nullable: true },
      schoolLevels: { type: Type.ARRAY, items: { type: Type.STRING, enum: ["hs", "college"] }, nullable: true },
      minGpa: { type: Type.NUMBER, nullable: true },
      numAwards: { type: Type.NUMBER, nullable: true },
      focusTags: { type: Type.ARRAY, items: { type: Type.STRING } },
      effort: { type: Type.STRING, enum: ["none", "short_form", "essay", "essay_plus_recs"], nullable: true },
      isSweepstakes: { type: Type.BOOLEAN, nullable: true },
      deadlineInferred: { type: Type.BOOLEAN, nullable: true },
    },
    required: ["kind", "title", "summary", "focusTags"],
  },
};

const LISTING_RULES = `You extract scholarship and opportunity listings from documents that counselors and providers upload.
Rules:
- Output an array; a counselor handout usually has 10-30 listings.
- Only fill a field the document states. Leave states, schoolLevels, minGpa, deadline null when unstated.
- Never guess a deadline year. If only a month is given, use that month of the next upcoming year and set deadlineInferred=true.
- kind="opportunity" for events, programs, hackathons, company visits, competitions; set oppType. kind="scholarship" for money awards.
- isSweepstakes=true for no-essay random-draw awards.
- zipPrefixes: only when the document names a town, county, school, or district; map to 3-digit US ZIP prefixes.
- schools: only when eligibility is restricted to students of specific named schools (e.g. "seniors at Boston Latin School"); list the school names as written.
- states: two-letter codes.
- summary: one or two plain sentences a student would read on a card.
- focusTags: 2-6 short lowercase tags (e.g. "robotics", "first-gen", "nursing", "community service").
- Preserve the source url if present.`;

export async function extractChips(text: string): Promise<Chips> {
  if (MOCK || !ai) return mockExtractChips(text);
  const res = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: `Extract a student profile from this text as short noun-phrase chips (2-5 words each). backgroundFlags are things like "first-gen", "low-income", "rural", "military family". connections are organizations or employers the student or family is tied to.\n\n${text}`,
    config: { responseMimeType: "application/json", responseSchema: chipsSchema },
  });
  return JSON.parse(res.text ?? "{}");
}

export type ExtractedListing = Omit<Listing, "id" | "embedding">;

export async function extractListings(input: { text?: string; file?: { buffer: Buffer; mimeType: string } }): Promise<ExtractedListing[]> {
  if (MOCK || !ai) return mockExtractListings(input.text ?? "");
  const parts: any[] = [{ text: LISTING_RULES }];
  if (input.file) parts.push({ inlineData: { mimeType: input.file.mimeType, data: input.file.buffer.toString("base64") } });
  if (input.text) parts.push({ text: input.text });
  const res = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: [{ role: "user", parts }],
    config: { responseMimeType: "application/json", responseSchema: listingSchema },
  });
  const arr = JSON.parse(res.text ?? "[]") as any[];
  return arr.map(normalizeExtracted);
}

export async function explain(chips: string[], listings: Listing[]): Promise<Record<string, string>> {
  if (MOCK || !ai) return Object.fromEntries(listings.map(l => [l.id, mockWhy(chips, l)]));
  const res = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: `Student profile chips: ${chips.join("; ")}.\n\nFor each listing, write ONE short line (max 14 words) starting with "Matches:" naming the 2-3 specific things from the student's profile that fit. Be concrete, no fluff.\n\n${listings.map(l => `[${l.id}] ${l.title} — ${l.summary} (tags: ${(l.focusTags ?? []).join(", ")}; states: ${(l.states ?? []).join(",") || "any"}; levels: ${(l.schoolLevels ?? []).join(",") || "any"})`).join("\n")}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, why: { type: Type.STRING } }, required: ["id", "why"] },
      },
    },
  });
  const arr = JSON.parse(res.text ?? "[]") as { id: string; why: string }[];
  return Object.fromEntries(arr.map(x => [x.id, x.why]));
}

// ---------- Mocks ----------

const CHIP_LEXICON: Record<keyof Omit<Chips, "major">, string[]> = {
  activities: ["fencing", "robotics", "debate", "soccer", "basketball", "track", "swimming", "chess", "band", "orchestra", "theater", "student council", "newspaper", "yearbook", "coding club", "science olympiad", "math team", "model un", "FIRST robotics", "esports", "mock trial", "choir", "dance", "volleyball", "tennis", "cross country", "art club", "photography"],
  volunteering: ["food bank", "food pantry", "tutoring", "hospital volunteer", "animal shelter", "habitat for humanity", "soup kitchen", "library volunteer", "beach cleanup", "community garden", "red cross", "peer mentoring", "church youth group", "nursing home"],
  awards: ["honor roll", "national merit", "AP scholar", "dean's list", "science fair", "state champion", "regional finalist", "eagle scout", "gold award", "first place", "varsity letter", "all-state"],
  interests: ["engineering", "computer science", "nursing", "medicine", "pre-med", "business", "finance", "law", "education", "environmental science", "biology", "chemistry", "physics", "mathematics", "journalism", "art", "design", "architecture", "psychology", "public health", "social work", "music", "data science", "cybersecurity", "aerospace", "mechanical engineering", "electrical engineering", "marine biology", "economics", "political science"],
  backgroundFlags: ["first-gen", "first generation", "low-income", "pell", "immigrant", "rural", "military family", "veteran", "foster", "single parent", "undocumented", "daca", "disability", "women in stem", "black", "latino", "hispanic", "asian american", "native american", "lgbtq"],
  connections: ["union", "employee", "parent works at", "member of", "credit union", "rotary", "elks", "kiwanis", "lions club", "4-h", "boys and girls club", "ymca", "boy scouts", "girl scouts"],
};

export function mockExtractChips(text: string): Chips {
  const t = text.toLowerCase();
  const pick = (list: string[]) => list.filter(w => t.includes(w));
  const chips: Chips = {
    activities: pick(CHIP_LEXICON.activities),
    volunteering: pick(CHIP_LEXICON.volunteering),
    awards: pick(CHIP_LEXICON.awards),
    interests: pick(CHIP_LEXICON.interests),
    backgroundFlags: pick(CHIP_LEXICON.backgroundFlags),
    connections: pick(CHIP_LEXICON.connections),
  };
  if (/captain/.test(t)) chips.awards.push("team captain");
  if (/president|founder|founded|led|leader/.test(t)) chips.awards.push("leadership");
  if (/first[- ]gen|first (?:in my|of my|person in my) family|first (?:one )?to (?:go|attend)|neither of my parents (?:went|attended)/.test(t) && !chips.backgroundFlags.includes("first-gen")) chips.backgroundFlags.push("first-gen");
  if (/free (?:or )?reduced lunch|pell|low[- ]income|financial need/.test(t) && !chips.backgroundFlags.includes("low-income")) chips.backgroundFlags.push("low-income");
  const majorMatch = t.match(/(?:major(?:ing)? in|study|studying|pursue|pursuing)\s+([a-z ]{3,30}?)(?:[.,;]|\s+(?:at|and|because|to)\b)/);
  if (majorMatch) chips.major = majorMatch[1].trim();
  else if (chips.interests.length) chips.major = chips.interests[0];
  for (const k of Object.keys(chips) as (keyof Chips)[]) {
    if (Array.isArray(chips[k])) (chips as any)[k] = [...new Set(chips[k] as string[])].slice(0, 8);
  }
  return chips;
}

// Mock listing extraction: handles "one listing per paragraph" plain text or CSV-like rows.
export function mockExtractListings(text: string): ExtractedListing[] {
  const blocks = text.split(/\r?\n\s*\r?\n/).map(b => b.trim()).filter(b => b.length > 20);
  return blocks.map(b => {
    const lines = b.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const title = lines[0].replace(/^[-*#\d.)\s]+/, "").slice(0, 120);
    const body = lines.slice(1).join(" ");
    const amt = b.match(/\$\s?([\d,]+)/g)?.map(s => Number(s.replace(/[^\d]/g, ""))) ?? [];
    const deadline = b.match(/(?:deadline|due|by)[:\s]+([A-Za-z]+\.? \d{1,2},? \d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1];
    const gpa = b.match(/gpa[^\d]{0,12}(\d\.\d)/i)?.[1];
    const url = b.match(/https?:\/\/\S+/)?.[0];
    const isOpp = /hackathon|event|visit|workshop|summit|day\b|camp|program|competition|conference|tour/i.test(title);
    const states = b.match(/\b(MA|NY|CT|RI|NH|VT|ME|NJ|PA|CA|TX|FL|IL|WA|OR|OH|MI|GA|NC|VA|MD)\b/g);
    const schools = [...b.matchAll(/(?:students?|seniors?|juniors?|graduates?) (?:at|of|from) ((?:[A-Z][A-Za-z'.&-]+ ){1,5}(?:High School|School|Academy|HS))/g)].map(m => m[1].trim());
    const levels: ("hs" | "college")[] = [];
    if (/high school|seniors?|juniors?|grade 1[0-2]/i.test(b)) levels.push("hs");
    if (/college|undergrad|university student/i.test(b)) levels.push("college");
    return normalizeExtracted({
      kind: isOpp ? "opportunity" : "scholarship",
      oppType: isOpp ? (/hackathon/i.test(title) ? "hackathon" : /visit|tour/i.test(title) ? "company_visit" : /competition|challenge/i.test(title) ? "competition" : /program|camp/i.test(title) ? "program" : "outreach_event") : undefined,
      title,
      summary: body.slice(0, 220) || title,
      url: url ?? "",
      amountMin: !isOpp && amt.length ? Math.min(...amt) : undefined,
      amountMax: !isOpp && amt.length ? Math.max(...amt) : undefined,
      cost: isOpp ? (/free/i.test(b) ? 0 : amt[0]) : undefined,
      deadline: deadline ? toISO(deadline) : undefined,
      states: states ? [...new Set(states)] : undefined,
      schools: schools.length ? [...new Set(schools)] : undefined,
      schoolLevels: levels.length ? levels : undefined,
      minGpa: gpa ? Number(gpa) : undefined,
      focusTags: guessTags(b),
      effort: /essay/i.test(b) ? (/recommendation|rec letter/i.test(b) ? "essay_plus_recs" : "essay") : /no essay/i.test(b) ? "none" : "short_form",
      isSweepstakes: /no essay|sweepstakes|random draw/i.test(b),
    });
  });
}

function mockWhy(chips: string[], l: Listing) {
  const text = listingText(l).toLowerCase();
  const hits = chips.filter(c => c.split(/\s+/).some(w => w.length > 3 && text.includes(w.toLowerCase())));
  const parts = hits.slice(0, 3);
  if (l.states?.length) parts.push(`${l.states[0]} resident`);
  if (parts.length === 0) parts.push(...(l.focusTags ?? []).slice(0, 2));
  return `Matches: ${parts.slice(0, 3).join(", ") || "general eligibility"}`;
}

function guessTags(b: string) {
  const t = b.toLowerCase();
  const tags = ["robotics", "engineering", "nursing", "stem", "first-gen", "community service", "leadership", "arts", "business", "computer science", "women", "veterans", "trades", "teaching", "environment", "journalism", "athletics", "music", "health", "immigrant"];
  return tags.filter(x => t.includes(x)).slice(0, 5);
}

function toISO(s: string) {
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

export function normalizeExtracted(x: any): ExtractedListing {
  const clean = (v: any) => (v === null || v === "" ? undefined : v);
  return {
    kind: x.kind === "opportunity" ? "opportunity" : "scholarship",
    oppType: clean(x.oppType),
    title: String(x.title ?? "Untitled").trim(),
    provider: clean(x.provider),
    url: String(x.url ?? ""),
    summary: clean(x.summary),
    amountMin: clean(x.amountMin),
    amountMax: clean(x.amountMax),
    cost: clean(x.cost),
    whatsCovered: clean(x.whatsCovered),
    deadline: clean(x.deadline),
    eventDate: clean(x.eventDate),
    states: clean(x.states),
    zipPrefixes: clean(x.zipPrefixes),
    schools: clean(x.schools),
    isOnline: clean(x.isOnline),
    schoolLevels: clean(x.schoolLevels),
    minGpa: clean(x.minGpa),
    numAwards: clean(x.numAwards) ?? 1,
    focusTags: x.focusTags ?? [],
    effort: clean(x.effort),
    isSweepstakes: !!x.isSweepstakes,
    extra: x.deadlineInferred ? { deadlineInferred: true } : undefined,
  };
}
