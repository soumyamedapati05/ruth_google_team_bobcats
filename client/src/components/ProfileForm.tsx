import { useState } from "react";
import { api } from "../lib/api";
import type { StudentProfileInput } from "../../../shared/types";

export const SAMPLE_STATEMENT = `I'm a senior at Baruch College Campus High School and president of our student council. I also run our DECA chapter and placed at the state business competition last year. For the past two years I've volunteered every Saturday at the Food Bank For New York City, over 120 hours total. I'll be the first in my family to go to college and I plan to major in finance.`;

const CHIP_PICKER = ["student council", "DECA", "debate", "robotics", "coding club", "soccer", "band", "food bank volunteer", "hospital volunteer", "tutoring", "first-gen", "low-income", "immigrant", "women in stem", "business", "finance", "engineering", "nursing", "computer science", "pre-med", "teaching", "art", "journalism", "environment", "leadership"];

export type Draft = {
  zip: string; level: "hs" | "college"; grade: string; gpa: string; school: string;
  statement: string; chips: string[]; discoverable: boolean;
};

export function toDraft(p: StudentProfileInput): Draft {
  return { zip: p.zip ?? "", level: p.level ?? "hs", grade: p.grade ?? "12", gpa: p.gpa != null ? String(p.gpa) : "", school: p.school ?? "", statement: p.statement ?? "", chips: p.chips ?? [], discoverable: !!p.discoverable };
}
export function fromDraft(d: Draft): Partial<StudentProfileInput> {
  return { zip: d.zip, level: d.level, grade: d.level === "hs" ? d.grade : undefined, gpa: d.gpa ? Number(d.gpa) : undefined, school: d.school || undefined, statement: d.statement, chips: d.chips, discoverable: d.discoverable };
}
export const basicsValid = (d: Draft) => d.zip.replace(/\D/g, "").length === 5;

export function BasicsFields({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  return (
    <div className="stack">
      <div className="row" style={{ gap: 14 }}>
        <label className="field" style={{ width: 110 }}>ZIP code<input type="text" inputMode="numeric" value={d.zip} onChange={e => set({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })} placeholder="10016" /></label>
        <label className="field" style={{ width: 150 }}>School level
          <select value={d.level} onChange={e => set({ level: e.target.value as "hs" | "college", grade: e.target.value === "hs" ? "12" : "" })}>
            <option value="hs">High school</option><option value="college">College</option>
          </select>
        </label>
        {d.level === "hs" && (
          <label className="field" style={{ width: 100 }}>Grade
            <select value={d.grade} onChange={e => set({ grade: e.target.value })}>{["9", "10", "11", "12"].map(g => <option key={g}>{g}</option>)}</select>
          </label>
        )}
        <label className="field" style={{ width: 120 }}>GPA (optional)<input type="number" step="0.01" min="0" max="5" value={d.gpa} onChange={e => set({ gpa: e.target.value })} placeholder="3.8" /></label>
      </div>
      <label className="field" style={{ maxWidth: 420 }}>{d.level === "hs" ? "High school" : "College"} (optional)
        <input type="text" value={d.school} onChange={e => set({ school: e.target.value })} placeholder={d.level === "hs" ? "e.g. Baruch College Campus High School" : "e.g. Hunter College"} />
        <span className="field-note">Some awards are only for students at a specific school. Providers never see your school name.</span>
      </label>
    </div>
  );
}

export function AboutFields({ d, set, traitsFirst = false }: { d: Draft; set: (p: Partial<Draft>) => void; traitsFirst?: boolean }) {
  const [extracting, setExtracting] = useState(false);
  const [newChip, setNewChip] = useState("");
  const [note, setNote] = useState<string | null>(null);

  async function extract() {
    if (!d.statement.trim()) return;
    setExtracting(true); setNote(null);
    try {
      const { flat } = await api.extract(d.statement);
      const merged = [...new Set([...flat, ...d.chips])];
      set({ chips: merged });
      if (!flat.length) setNote("Couldn't find much in that text. Add chips by hand below.");
    } catch (e: any) { setNote(e.message); }
    finally { setExtracting(false); }
  }

  const statement = (
    <div className="stack" key="statement">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="mono">{traitsFirst ? "What you said. Edit it and re-extract if we missed something." : "Paste a personal statement, resume, or activities list. Optional, but it makes matches much better."}</span>
        <button className="small ghost" type="button" onClick={() => set({ statement: SAMPLE_STATEMENT })}>Use sample</button>
      </div>
      <textarea placeholder="Paste here…" value={d.statement} onChange={e => set({ statement: e.target.value })} />
      <div className="row">
        <button type="button" className="small" onClick={extract} disabled={extracting || !d.statement.trim()}>{extracting ? "Reading…" : "Extract my profile"}</button>
        <span className="muted small">No document? Pick traits instead.</span>
        {note && <span className="small error">{note}</span>}
      </div>
    </div>
  );
  const traits = (
    <div className="stack" style={{ gap: 12 }} key="traits">
      <span className="mono">Your traits (edit freely). These are what we match on.</span>
      <div className="chips">
        {d.chips.map(c => (
          <span key={c} className="chip">{c}<button type="button" aria-label={`remove ${c}`} onClick={() => set({ chips: d.chips.filter(x => x !== c) })}>×</button></span>
        ))}
        <form onSubmit={e => { e.preventDefault(); const v = newChip.trim(); if (v && !d.chips.includes(v)) set({ chips: [...d.chips, v] }); setNewChip(""); }}>
          <input type="text" className="chip-input" value={newChip} onChange={e => setNewChip(e.target.value)} placeholder="+ add a trait" />
        </form>
      </div>
      <div className="chips">
        {CHIP_PICKER.filter(c => !d.chips.includes(c)).map(c => (
          <span key={c} className="chip add" onClick={() => set({ chips: [...d.chips, c] })}>+ {c}</span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="stack" style={{ gap: 24 }}>
      {traitsFirst ? [traits, statement] : [statement, traits]}
      <label className="row small" style={{ gap: 10, alignItems: "flex-start" }}>
        <input type="checkbox" checked={d.discoverable} onChange={e => set({ discoverable: e.target.checked })} style={{ marginTop: 3 }} />
        <span>Let scholarship providers see an <b>anonymous</b> version of my profile (traits, state, level, GPA range) and invite me to apply. Off by default; you can turn it off any time.</span>
      </label>
    </div>
  );
}
