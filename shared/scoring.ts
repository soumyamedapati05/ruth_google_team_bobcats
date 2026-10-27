// The only place match %, odds, and eligibility are computed.
// Used in both directions: student -> listings and listing -> students.
import type { Listing, Profile } from "./types.js";

export function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// "Boston Latin School" ~ "boston latin"; strips punctuation and generic words.
export function normalizeSchool(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\b(the|high school|hs|school|academy of|public)\b/g, " ").replace(/\s+/g, " ").trim();
}
export function schoolMatches(l: Listing, p: Profile): boolean | undefined {
  if (!l.schools?.length) return undefined;           // listing isn't school-restricted
  if (!p.school) return undefined;                     // student didn't say; unknown
  const mine = normalizeSchool(p.school);
  if (mine.length < 3) return undefined;
  return l.schools.some(s => { const t = normalizeSchool(s); return t === mine || t.includes(mine) || mine.includes(t); });
}

// null = disqualified; otherwise 0-1 confidence. Unknown fields never disqualify.
export function eligibility(l: Listing, p: Profile): number | null {
  let met = 0, unknown = 0;
  const check = (known: boolean, ok: boolean) => {
    if (!known) { unknown++; return true; }
    if (ok) { met++; return true; }
    return false;
  };
  const cutoff = l.deadline ?? l.eventDate;
  if (cutoff && new Date(cutoff) < new Date()) return null;
  if (!check(!!l.schoolLevels?.length, !!l.schoolLevels?.includes(p.level))) return null;
  if (!check(!!l.states?.length, !!l.states?.includes(p.state))) return null;
  if (!check(l.minGpa != null && p.gpa != null, (p.gpa ?? 0) >= (l.minGpa ?? 0))) return null;
  const sm = schoolMatches(l, p);
  if (!check(sm !== undefined, sm === true)) return null;
  const total = met + unknown;
  return total === 0 ? 0.5 : (met + 0.5 * unknown) / total;
}

export function matchPct(elig: number, relevance01: number) {
  return Math.round(100 * (0.4 * elig + 0.6 * relevance01));
}

export function isLocal(l: Listing, p: Profile) {
  return !!l.zipPrefixes?.includes(p.zipPrefix) || schoolMatches(l, p) === true;
}

export function estApplicants(l: Listing) {
  if (l.estApplicants) return l.estApplicants;
  let n = l.schools?.length ? 25 : l.zipPrefixes?.length ? 40 : l.states?.length ? 800 : 5000;
  if (l.focusTags?.length) n *= 0.5;
  if ((l.minGpa ?? 0) >= 3.5) n *= 0.5;
  if (l.effort === "essay_plus_recs") n *= 0.4;
  else if (l.effort === "essay") n *= 0.7;
  else if (l.effort === "none") n *= 3;
  return Math.max(5, Math.round(n));
}

export function estimateOdds(l: Listing, relevance01: number) {
  const p = Math.min(0.9, Math.max(0.002, ((l.numAwards ?? 1) / estApplicants(l)) * (0.5 + relevance01)));
  const band = p < 0.05 ? "Long shot" : p < 0.15 ? "Fair" : p < 0.35 ? "Good" : "High";
  // Events with open capacity aren't a lottery; say so instead of "1 in 1".
  if (l.kind === "opportunity" && p >= 0.6) return { p, band: "Open", label: "Open (spots available)" };
  const denom = Math.max(2, Math.round(1 / p));
  return { p, band, label: `${band} (~1 in ${denom})` };
}

export function rescale(scores: number[]) {
  if (scores.length === 0) return scores;
  const min = Math.min(...scores), max = Math.max(...scores);
  return scores.map(s => (max === min ? 0.5 : (s - min) / (max - min)));
}

export function gpaBand(gpa?: number) {
  return gpa == null ? "n/a" : gpa >= 3.7 ? "3.7+" : gpa >= 3.3 ? "3.3–3.7" : gpa >= 3.0 ? "3.0–3.3" : "<3.0";
}

// Student -> listings
export function rankListings(p: Profile, listings: Listing[]) {
  const kept = listings
    .map(l => ({ l, e: eligibility(l, p) }))
    .filter((x): x is { l: Listing; e: number } => x.e !== null);
  const rel = rescale(kept.map(x => cosine(p.embedding, x.l.embedding)));
  return kept
    .map((x, i) => ({
      listing: x.l,
      matchPct: matchPct(x.e, rel[i]),
      odds: estimateOdds(x.l, rel[i]),
      isLocal: isLocal(x.l, p),
    }))
    .sort((a, b) => b.matchPct - a.matchPct || Number(b.isLocal) - Number(a.isLocal));
}

// Listing -> students (provider view). Same math, roles swapped.
export function rankStudents<P extends Profile>(l: Listing, profiles: P[]) {
  const kept = profiles
    .map(p => ({ p, e: eligibility(l, p) }))
    .filter((x): x is { p: P; e: number } => x.e !== null);
  const rel = rescale(kept.map(x => cosine(l.embedding, x.p.embedding)));
  return kept
    .map((x, i) => ({ profile: x.p, matchPct: matchPct(x.e, rel[i]), isLocal: isLocal(l, x.p), schoolMatch: schoolMatches(l, x.p) === true }))
    .sort((a, b) => b.matchPct - a.matchPct);
}
