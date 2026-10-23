import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { BasicsFields, AboutFields, toDraft, fromDraft, basicsValid, type Draft } from "../components/ProfileForm";
import Talk from "../components/Talk";
import { useRoomStatus } from "../components/Chrome";

type Step = "basics" | "talk" | "type" | "review";
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function Onboarding() {
  const nav = useNavigate();
  const loc = useLocation();
  const { me, setMe } = useAuth();
  // "Talk again" on the matches page jumps straight to the conversation.
  const [step, setStep] = useState<Step>(() => ((loc.state as any)?.step === "talk" && me?.profile.zip ? "talk" : "basics"));
  const [d, setD] = useState<Draft>(() => toDraft(me?.profile ?? { zip: "", level: "hs", chips: [], discoverable: false }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<Draft>) => setD(x => ({ ...x, ...p }));

  // After the conversation: the transcript becomes the statement, then we extract traits for review.
  // The orb holds its "matching" glow for at least as long as the mockup does.
  async function heard(answers: string[]) {
    const statement = answers.join("\n\n");
    setBusy(true); setError(null);
    try {
      const [{ flat }] = await Promise.all([api.extract(statement), wait(2600)]);
      set({ statement, chips: [...new Set([...flat, ...d.chips])] });
      setStep("review");
    } catch (e: any) { setError(e.message); setStep("type"); }
    finally { setBusy(false); }
  }

  async function finish(skipAbout = false) {
    setBusy(true); setError(null);
    try {
      const r = await api.saveProfile(fromDraft(skipAbout ? { ...d, statement: "" } : d));
      setMe(r.me);
      nav("/matches", { replace: true });
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  const n = step === "basics" ? "01" : step === "review" ? "03" : "02";
  useRoomStatus(step === "talk" ? null : `Step ${n} / 03`);

  if (step === "talk") {
    return (
      <>
        <Talk onDone={heard} aside={<>
          <a href="#" className="textlink" onClick={e => { e.preventDefault(); setStep("basics"); }}>← Back</a>
          <a href="#" className="textlink" onClick={e => { e.preventDefault(); setStep("type"); }}>Prefer to type? Paste a statement instead</a>
          <a href="#" className="textlink" onClick={e => { e.preventDefault(); if (!busy) finish(true); }}>Skip for now</a>
        </>} />
        {error && <p className="hint error" style={{ textAlign: "center" }}>{error}</p>}
      </>
    );
  }

  const eyebrow = step === "basics" ? "Step 01 of 03 · The basics" : step === "type" ? "Step 02 of 03 · About you" : "Step 03 of 03 · Matched from your conversation";
  const title = step === "basics" ? "First, the basics." : step === "type" ? "Tell us about yourself." : "What we heard";
  const lede = step === "basics" ? "Where you are and where you are in school decide which awards you're eligible for."
    : step === "type" ? "Paste a personal statement, resume, or activities list, or pick a few traits."
    : "These are the traits we'll match on. Fix anything we got wrong.";

  return (
    <section className="results">
      <div className="results-head">
        <div className="mini-orb" aria-hidden="true" />
        <div className="titles">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </div>
      <p className="lede">{lede}</p>

      {step === "basics" && (
        <>
          <div className="panel"><BasicsFields d={d} set={set} /></div>
          <div className="results-foot">
            <button className="primary lift" onClick={() => setStep("talk")} disabled={!basicsValid(d)}>Continue to the conversation →</button>
            <span className="muted small">Next: three short questions, out loud or typed.</span>
          </div>
        </>
      )}

      {(step === "type" || step === "review") && (
        <>
          <div className="panel"><AboutFields d={d} set={set} traitsFirst={step === "review"} /></div>
          {error && <p className="small error" style={{ margin: 0 }}>{error}</p>}
          <div className="results-foot">
            <button className="primary lift" onClick={() => finish(false)} disabled={busy || d.chips.length === 0} title={d.chips.length === 0 ? "Add at least one trait, or skip" : ""}>{busy ? "Saving…" : "See my best fits →"}</button>
            <button className="lift" onClick={() => setStep("talk")} disabled={busy}>Talk again</button>
            <button className="ghost" onClick={() => finish(true)} disabled={busy}>Skip for now</button>
          </div>
        </>
      )}
    </section>
  );
}
