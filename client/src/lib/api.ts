import type { Chips, MatchCard, TrackerEvent, Invite, TrackStatus, Me, StudentProfileInput, PartnerProfile, PartnerListingView, Role } from "../../../shared/types";

// ---- session token (local accounts; swap for Firebase Auth later) ----
const TOKEN_KEY = "myops.token";
export function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }
export function setToken(t: string | null) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }

export function ls<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
export function lsSet(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

export class ApiError extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json", ...(init?.headers as any) };
  const t = getToken(); if (t) headers.authorization = `Bearer ${t}`;
  const r = await fetch(url, { ...init, headers });
  if (!r.ok) {
    const msg = (await r.json().catch(() => ({})))?.error ?? `${r.status}`;
    if (r.status === 401) { setToken(null); window.dispatchEvent(new Event("myops:signout")); }
    throw new ApiError(r.status, msg);
  }
  return r.json();
}

export type Listing = MatchCard["listing"];
export type ExtractedListing = Omit<Listing, "id">;
export type MatchResult = { scholarships: MatchCard[]; opportunities: MatchCard[]; state: string; matchedAt: string; listingCount: number };

export const api = {
  health: () => j<{ ok: boolean; listings: number; mock: boolean }>("/api/health"),
  // accounts
  signup: (email: string, password: string, role: Role = "student", org?: Partial<PartnerProfile>) => j<{ token: string; me: Me }>("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password, role, org }) }),
  login: (email: string, password: string) => j<{ token: string; me: Me }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => j<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => j<{ me: Me }>("/api/me"),
  saveProfile: (p: Partial<StudentProfileInput>) => j<{ me: Me }>("/api/me/profile", { method: "PUT", body: JSON.stringify(p) }),
  saveOrg: (o: Partial<PartnerProfile>) => j<{ me: Me }>("/api/me/org", { method: "PUT", body: JSON.stringify(o) }),
  // student
  extract: (text: string) => j<{ chips: Chips; flat: string[] }>("/api/extract", { method: "POST", body: JSON.stringify({ text }) }),
  match: () => j<MatchResult>("/api/match", { method: "POST" }),
  explain: (listingIds: string[]) => j<{ why: Record<string, string> }>("/api/explain", { method: "POST", body: JSON.stringify({ listingIds }) }),
  track: (body: { listingId: string; status: TrackStatus | "none"; amountWon?: number }) => j<{ events: TrackerEvent[] }>("/api/track", { method: "POST", body: JSON.stringify(body) }),
  tracker: () => j<{ events: TrackerEvent[]; invites: (Invite & { listing?: Listing })[]; listings: Listing[] }>("/api/track"),
  // partner (counselors & providers)
  uploadText: (text: string) => j<{ listings: ExtractedListing[] }>("/api/upload", { method: "POST", body: JSON.stringify({ text }) }),
  uploadFile: async (file: File) => {
    const fd = new FormData(); fd.append("file", file);
    const headers: Record<string, string> = {}; const t = getToken(); if (t) headers.authorization = `Bearer ${t}`;
    const r = await fetch("/api/upload", { method: "POST", body: fd, headers });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `${r.status}`);
    return r.json() as Promise<{ listings: ExtractedListing[] }>;
  },
  publish: (listings: ExtractedListing[]) => j<{ ids: string[] }>("/api/listings", { method: "POST", body: JSON.stringify({ listings }) }),
  myListings: () => j<{ listings: PartnerListingView[] }>("/api/partner/listings"),
  updateListing: (id: string, patch: Partial<Listing>) => j<PartnerListingView>(`/api/partner/listings/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  removeListing: (id: string) => j<{ ok: boolean }>(`/api/partner/listings/${id}`, { method: "DELETE" }),
  invite: (listingId: string, ref: string) => j<{ ok: boolean }>("/api/partner/invite", { method: "POST", body: JSON.stringify({ listingId, ref }) }),
};

export const money = (n?: number) => (n == null ? "" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }));
export const fmtDate = (s?: string) => (s ? new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
export const effortLabel: Record<string, string> = { none: "No application", short_form: "Short form", essay: "Essay", essay_plus_recs: "Essay + recs" };
