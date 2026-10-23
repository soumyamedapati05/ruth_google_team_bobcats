import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Me, PartnerProfile, Role } from "../../../shared/types";

// Local mock accounts: email + password stored hashed in data/db.json. No email verification.
// TODO(next): swap for Firebase Auth; keep the same onSuccess routing.
export function landingFor(me: Me) {
  if (me.role === "partner") return "/partner/listings";
  return me.onboarded ? "/matches" : "/onboarding";
}

export default function LoginForm({ role, initialMode = "login", demo }: { role: Role; initialMode?: "login" | "signup"; demo?: { email: string; password: string; org?: PartnerProfile } }) {
  const nav = useNavigate();
  const { setMe } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState<PartnerProfile["orgType"]>("school");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function land(r: { token: string; me: Me }) {
    if (r.me.role !== role) {
      setToken(null);
      setError(r.me.role === "partner" ? "That's a counselor/provider account. Use the partner sign-in." : "That's a student account. Use the student sign-in.");
      return;
    }
    setToken(r.token); setMe(r.me);
    nav(landingFor(r.me), { replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email."); return; }
    if (password.length < 8) { setError("Password needs at least 8 characters."); return; }
    if (mode === "signup" && role === "partner" && !orgName.trim()) { setError("Enter your school or organization."); return; }
    setBusy(true); setError(null);
    try {
      const r = mode === "signup"
        ? await api.signup(email, password, role, role === "partner" ? { orgName, orgType } : undefined)
        : await api.login(email, password);
      land(r);
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function useDemo() {
    if (!demo) return;
    setBusy(true); setError(null);
    try {
      let r;
      try { r = await api.login(demo.email, demo.password); } catch { r = await api.signup(demo.email, demo.password, role, demo.org); }
      land(r);
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <form className="stack" onSubmit={submit} style={{ gap: 10 }}>
        {mode === "signup" && role === "partner" && (
          <div className="row" style={{ gap: 10 }}>
            <label className="field" style={{ flex: 1, minWidth: 200 }}>School or organization<input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. BCCHS counseling office" /></label>
            <label className="field" style={{ width: 150 }}>Type
              <select value={orgType} onChange={e => setOrgType(e.target.value as any)}>
                <option value="school">School</option><option value="foundation">Foundation</option><option value="company">Company</option><option value="community">Community org</option><option value="other">Other</option>
              </select>
            </label>
          </div>
        )}
        <label className="field">Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={role === "partner" ? "you@school.org" : "you@example.com"} /></label>
        <label className="field">Password<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="at least 8 characters" /></label>
        {error && <div className="small" style={{ color: "#a32d2d" }}>{error}</div>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}</button>
      </form>
      <div className="row small muted" style={{ justifyContent: "space-between" }}>
        {mode === "signup"
          ? <span>Already have an account? <a href="#" style={{ textDecoration: "underline" }} onClick={e => { e.preventDefault(); setMode("login"); setError(null); }}>Sign in</a></span>
          : <span>New here? <a href="#" style={{ textDecoration: "underline" }} onClick={e => { e.preventDefault(); setMode("signup"); setError(null); }}>Create an account</a></span>}
        {demo && <a href="#" style={{ textDecoration: "underline" }} onClick={e => { e.preventDefault(); useDemo(); }}>Use demo account</a>}
      </div>
    </div>
  );
}
