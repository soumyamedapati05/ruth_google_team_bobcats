// Email + password accounts with scrypt hashing and bearer-token sessions.
// TODO(next): replace with Firebase Auth; keep `requireStudent` so routes don't change.
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { students, sessions } from "./store.js";
import type { Student } from "../shared/types.js";

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(pw: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = scryptSync(pw, salt, 64);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function newSession(studentId: string) {
  const token = randomBytes(24).toString("base64url");
  sessions.add({ token, studentId, createdAt: new Date().toISOString() });
  return token;
}

export type AuthedRequest = Request & { student: Student };

function authed(req: Request): Student | undefined {
  const h = req.headers.authorization ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const s = token ? sessions.byToken(token) : undefined;
  const a = s ? students.byId(s.studentId) : undefined;
  // Accounts created before roles existed are students.
  return a ? { ...a, role: a.role ?? "student" } : undefined;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const a = authed(req);
  if (!a) return res.status(401).json({ error: "Please sign in" });
  (req as AuthedRequest).student = a;
  next();
}

export function requireStudent(req: Request, res: Response, next: NextFunction) {
  const a = authed(req);
  if (!a) return res.status(401).json({ error: "Please sign in" });
  if (a.role !== "student") return res.status(403).json({ error: "This is a student feature. Sign in with a student account." });
  (req as AuthedRequest).student = a;
  next();
}

export function requirePartner(req: Request, res: Response, next: NextFunction) {
  const a = authed(req);
  if (!a) return res.status(401).json({ error: "Please sign in" });
  if (a.role !== "partner") return res.status(403).json({ error: "This is for counselors and providers. Sign in with a partner account." });
  (req as AuthedRequest).student = a;
  next();
}

export const publicStudent = (s: Student) => ({ id: s.id, role: s.role ?? "student", email: s.email, onboarded: s.onboarded, profile: s.profile, org: s.org, createdAt: s.createdAt });
