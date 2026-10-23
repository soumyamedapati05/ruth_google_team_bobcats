import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { PartnerProfile as Org } from "../../../shared/types";

export default function PartnerProfile() {
  const nav = useNavigate();
  const { me, setMe, signOut } = useAuth();
  const [d, setD] = useState<Org>({ orgName: me?.org?.orgName ?? "", orgType: me?.org?.orgType ?? "school", contactName: me?.org?.contactName ?? "" });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<Org>) => { setD(x => ({ ...x, ...p })); setSaved(false); };

  async function save() {
    setBusy(true); setError(null);
    try { const r = await api.saveOrg(d); setMe(r.me); setSaved(true); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="page stack" style={{ gap: 16, maxWidth: 640 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="step-label">{me?.email}</div>
          <h1>Organization profile</h1>
          <p className="lede" style={{ margin: 0 }}>The organization name is shown to students as "Added by".</p>
        </div>
        <button className="small ghost" onClick={async () => { await signOut(); nav("/partner/login"); }}>Sign out</button>
      </div>
      <div className="card stack">
        <label className="field">School or organization name<input type="text" value={d.orgName} onChange={e => set({ orgName: e.target.value })} /></label>
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ width: 180 }}>Type
            <select value={d.orgType} onChange={e => set({ orgType: e.target.value as Org["orgType"] })}>
              <option value="school">School</option><option value="foundation">Foundation</option><option value="company">Company</option><option value="community">Community org</option><option value="other">Other</option>
            </select>
          </label>
          <label className="field" style={{ flex: 1, minWidth: 200 }}>Contact name (optional)<input type="text" value={d.contactName ?? ""} onChange={e => set({ contactName: e.target.value })} /></label>
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="small">{error ? <span style={{ color: "#a32d2d" }}>{error}</span> : saved ? <span className="muted">Saved ✓</span> : null}</span>
          <button className="primary" onClick={save} disabled={busy || !d.orgName.trim()}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
      <div className="small muted">
        What you can see about students: anonymous chips, state, school level, and GPA range, only for students who opted in. Never names, emails, ZIP codes, school names, or statements. Invites go to the student's in-app tracker.
      </div>
    </div>
  );
}
