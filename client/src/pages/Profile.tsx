import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useRoomStatus } from "../components/Chrome";
import { BasicsFields, AboutFields, toDraft, fromDraft, basicsValid, type Draft } from "../components/ProfileForm";

export default function Profile() {
  const nav = useNavigate();
  const { me, setMe, signOut } = useAuth();
  const [d, setD] = useState<Draft>(() => toDraft(me!.profile));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<Draft>) => { setD(x => ({ ...x, ...p })); setSaved(false); };

  async function save(thenMatches: boolean) {
    setBusy(true); setError(null);
    try {
      const r = await api.saveProfile(fromDraft(d));
      setMe(r.me); setSaved(true);
      if (thenMatches) nav("/matches");
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  useRoomStatus(me?.email);
  return (
    <section className="results">
      <div className="results-head">
        <div className="mini-orb" aria-hidden="true" />
        <div className="titles">
          <p className="eyebrow">Your profile · saving re-runs your matches</p>
          <h1>About you</h1>
        </div>
        <div className="aside">
          <button className="small ghost" onClick={async () => { await signOut(); nav("/student/login"); }}>Sign out</button>
        </div>
      </div>

      <div className="panel stack" style={{ gap: 20 }}>
        <p className="eyebrow">01 · The basics</p>
        <BasicsFields d={d} set={set} />
      </div>
      <div className="panel stack" style={{ gap: 20 }}>
        <p className="eyebrow">02 · What we heard</p>
        <AboutFields d={d} set={set} traitsFirst />
      </div>

      <div className="results-foot">
        <button className="primary lift" onClick={() => save(true)} disabled={busy || !basicsValid(d)}>{busy ? "Saving…" : "Save and see matches →"}</button>
        <button className="lift" onClick={() => save(false)} disabled={busy || !basicsValid(d)}>Save</button>
        <span className="small">{error ? <span className="error">{error}</span> : saved ? <span className="muted">Saved ✓</span> : <span className="muted">Unsaved changes</span>}</span>
      </div>

      <p className="small muted" style={{ margin: 0 }}>
        What providers can see if you're discoverable: your traits, state, school level, and GPA range. Never your name, email, ZIP, school name, or statement.
      </p>
    </section>
  );
}
