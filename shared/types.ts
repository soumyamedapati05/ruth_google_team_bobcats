export type Kind = "scholarship" | "opportunity";
export type OppType = "hackathon" | "outreach_event" | "company_visit" | "competition" | "program";
export type Level = "hs" | "college";
export type Effort = "none" | "short_form" | "essay" | "essay_plus_recs";

export type Listing = {
  id: string;
  kind: Kind;
  oppType?: OppType;
  title: string;
  provider?: string;
  url: string;
  summary?: string;
  amountMin?: number;
  amountMax?: number;
  cost?: number;
  whatsCovered?: string;
  deadline?: string;
  eventDate?: string;
  states?: string[];
  zipPrefixes?: string[];
  schools?: string[];      // restricted to students at these schools (names as written)
  isOnline?: boolean;
  schoolLevels?: Level[];
  minGpa?: number;
  numAwards?: number;
  estApplicants?: number;
  focusTags?: string[];
  effort?: Effort;
  isSweepstakes?: boolean;
  embedding: number[];
  ownerId?: string;        // partner account that owns this listing
  manageToken?: string;    // legacy link-based ownership (seed/demo only)
  uploadedBy?: string;     // display name, e.g. "BCCHS counseling office"
  createdAt?: string;
  extra?: Record<string, unknown>;
};

export type Chips = {
  activities: string[];
  volunteering: string[];
  awards: string[];
  interests: string[];
  major?: string;
  backgroundFlags: string[];
  connections: string[];
};

export type Profile = {
  chips: string[];
  state: string;
  zipPrefix: string;
  level: Level;
  grade?: string;
  gpa?: number;
  school?: string;         // optional; never shown to providers
  flags?: string[];
  embedding: number[];
};

export type StudentProfile = Profile & {
  deviceId: string;        // = student id for logged-in students (name kept for storage compatibility)
  discoverable: boolean;
  updatedAt: string;
};

export type Role = "student" | "partner";

// Account record (students and partners share one table, split by role).
// Never sent to providers; never includes passwordHash in API responses.
export type Student = {
  id: string;
  role: Role;
  email: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt?: string;
  onboarded: boolean;
  profile: StudentProfileInput;     // students
  org?: PartnerProfile;             // partners
};

export type PartnerProfile = {
  orgName: string;
  orgType: "school" | "foundation" | "company" | "community" | "other";
  contactName?: string;
};

// What the student edits in onboarding / profile.
export type StudentProfileInput = {
  zip: string;
  level: Level;
  grade?: string;
  gpa?: number;
  school?: string;
  statement?: string;      // kept for the student to edit; never shown to providers
  chips: string[];
  discoverable: boolean;
};

export type Session = { token: string; studentId: string; createdAt: string };

export type Me = { id: string; role: Role; email: string; onboarded: boolean; profile: StudentProfileInput; org?: PartnerProfile; createdAt: string };

export type TrackStatus = "saved" | "applied" | "won" | "not_selected" | "attended";

export type TrackerEvent = {
  id: string;
  deviceId: string;
  listingId: string;
  status: TrackStatus;
  amountWon?: number;
  createdAt: string;
};

export type Invite = {
  id: string;
  listingId: string;
  deviceId: string;
  createdAt: string;
};

export type MatchCard = {
  listing: Omit<Listing, "embedding" | "manageToken">;
  matchPct: number;
  odds: { band: string; label: string };
  isLocal: boolean;
};

export type PartnerListingView = {
  listing: Omit<Listing, "embedding" | "manageToken">;
  matchCount: number;
  localCount: number;
  students: AnonStudent[];
  saves: { saved: number; applied: number };
};

export type AnonStudent = {
  ref: string;
  chips: string[];
  state: string;
  level: Level;
  gpaBand: string;
  matchPct: number;
  isLocal: boolean;
  schoolMatch: boolean;    // listing is school-restricted and this student attends one of them
  invited: boolean;
};
