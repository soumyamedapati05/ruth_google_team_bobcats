import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type ExtractedListing } from "../lib/api";
import { useAuth } from "../lib/auth";

const SAMPLE_TEXT = `Kips Bay Lions Club Community Scholarship
$1,000 for one graduating senior from Kips Bay or Murray Hill who has volunteered in the neighborhood. Essay required. Deadline: April 15, 2027. https://example.org/kips-bay-lions

Baruch College Campus HS Tech Pathways Award
Two awards of $1,500 for seniors at Baruch College Campus High School entering a computer science, engineering, or robotics program. Minimum GPA 3.0. No essay, short form only. Deadline: March 31, 2027.

Hudson River Youth Sailing Day
Free one-day sailing and marine science event for high school students, Saturday June 12, 2027 at Pier 40 in Manhattan. Lunch provided. Register by June 1, 2027. https://example.org/hudson-sailing`;

type Row = ExtractedListing & { _key: string };

export default function Add() {
  const nav = useNavigate();
  const { me } = useAuth();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<{ count: number } | null>(null);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ingest = (listings: ExtractedListing[]) => {
    setRows(r => [...r, ...listings.map((l, i) => ({ ...l, _key: `${Date.now()}-${i}` }))]);
    if (listings.length === 0) setError("No listings found. Try pasting the text instead, one listing per paragraph.");
  };

  async function fromText() {
    if (!text.trim()) return;
    setBusy("Reading text…"); setError(null);
    try { ingest((await api.uploadText(text)).listings); setText(""); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  }
  async function fromFile(file: File) {
    setBusy(`Reading ${file.name}…`); setError(null);
    try { ingest((await api.uploadFile(file)).listings); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  }
  async function publish() {
    if (rows.length === 0) return;
    setBusy("Publishing…"); setError(null);
    try {
      const clean = rows.map(({ _key, ...l }) => l);
      const r = await api.publish(clean);
      setPublished({ count: r.ids.length });
      setRows([]);
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  }

  const edit = (key: string, patch: Partial<ExtractedListing>) => setRows(rs => rs.map(r => (r._key === key ? { ...r, ...patch } : r)));
  const list = (v?: string[]) => (v ?? []).join(", ");
  const toList = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);

  if (published) {
    return (
      <div className="page stack">
        <div className="card stack">
          <h1>Published {published.count} listing{published.count === 1 ? "" : "s"}</h1>
          <p>Students will see these in their matches right away, credited to <b>{me?.org?.orgName}</b>. You can edit or remove them any time from My listings, and see which students match.</p>
          <div className="row"><button className="primary" onClick={() => nav("/partner/listings")}>Go to My listings →</button><button onClick={() => setPublished(null)}>Add more</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page stack" style={{ gap: 20 }}>
      <div>
        <div className="step-label">{me?.org?.orgName}</div>
        <h1>Add listings</h1>
        <p className="lede" style={{ margin: 0 }}>Upload the handout or spreadsheet you already have; we'll pull out the listings for you to check before they go live. They'll be credited to <b>{me?.org?.orgName}</b>.</p>
      </div>

      <div className="grid2">
        <div
          className={`drop ${over ? "over" : ""}`}
          onDragOver={e => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) fromFile(f); }}
          onClick={() => fileRef.current?.click()}
          role="button"
        >
          <div style={{ fontSize: 18, color: "var(--ink)", fontWeight: 500 }}>Drop a PDF, CSV, or XLSX</div>
          <div className="mono">or click to choose a file</div>
          <input ref={fileRef} type="file" accept=".pdf,.csv,.xlsx,.xls,text/plain" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) fromFile(f); e.target.value = ""; }} />
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <textarea placeholder="…or paste text here, one listing per paragraph" value={text} onChange={e => setText(e.target.value)} style={{ minHeight: 110 }} />
          <div className="row">
            <button className="primary" onClick={fromText} disabled={!!busy || !text.trim()}>Extract listings</button>
            <button className="small" onClick={() => setText(SAMPLE_TEXT)}>Use sample</button>
          </div>
        </div>
      </div>
      {busy && <div className="muted small">{busy}</div>}
      {error && <div className="small" style={{ color: "#a32d2d" }}>{error}</div>}

      {rows.length > 0 && (
        <div className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>Review {rows.length} listing{rows.length === 1 ? "" : "s"}</h2>
            <span className="mono">Fix anything we got wrong, then publish.</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="review">
              <thead><tr><th>Title</th><th>Kind</th><th>Amount / cost</th><th>Deadline</th><th>States</th><th>Schools</th><th>Levels</th><th>Min GPA</th><th>Tags</th><th>URL</th><th></th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r._key}>
                    <td style={{ minWidth: 200 }}>
                      <input type="text" value={r.title} onChange={e => edit(r._key, { title: e.target.value })} />
                      <input type="text" value={r.provider ?? ""} placeholder="Provider" onChange={e => edit(r._key, { provider: e.target.value })} style={{ marginTop: 4 }} />
                      {!!r.extra?.deadlineInferred && <div className="small" style={{ color: "var(--warn-ink)" }}>Deadline year was inferred; please confirm.</div>}
                    </td>
                    <td><select value={r.kind} onChange={e => edit(r._key, { kind: e.target.value as any })}><option value="scholarship">scholarship</option><option value="opportunity">opportunity</option></select></td>
                    <td style={{ minWidth: 110 }}>
                      {r.kind === "scholarship"
                        ? <input type="number" value={r.amountMax ?? ""} placeholder="$" onChange={e => edit(r._key, { amountMax: e.target.value ? Number(e.target.value) : undefined, amountMin: r.amountMin ?? (e.target.value ? Number(e.target.value) : undefined) })} />
                        : <input type="number" value={r.cost ?? ""} placeholder="0 = free" onChange={e => edit(r._key, { cost: e.target.value ? Number(e.target.value) : undefined })} />}
                    </td>
                    <td><input type="date" value={r.deadline ?? ""} onChange={e => edit(r._key, { deadline: e.target.value || undefined })} /></td>
                    <td style={{ minWidth: 70 }}><input type="text" value={list(r.states)} placeholder="any" onChange={e => edit(r._key, { states: toList(e.target.value.toUpperCase()) })} /></td>
                    <td style={{ minWidth: 130 }}><input type="text" value={list(r.schools)} placeholder="any school" title="Only if restricted to named schools" onChange={e => edit(r._key, { schools: toList(e.target.value) })} /></td>
                    <td style={{ minWidth: 90 }}><input type="text" value={list(r.schoolLevels)} placeholder="hs, college" onChange={e => edit(r._key, { schoolLevels: toList(e.target.value) as any })} /></td>
                    <td style={{ width: 70 }}><input type="number" step="0.1" value={r.minGpa ?? ""} placeholder="—" onChange={e => edit(r._key, { minGpa: e.target.value ? Number(e.target.value) : undefined })} /></td>
                    <td style={{ minWidth: 140 }}><input type="text" value={list(r.focusTags)} onChange={e => edit(r._key, { focusTags: toList(e.target.value) })} /></td>
                    <td style={{ minWidth: 140 }}><input type="text" value={r.url ?? ""} placeholder="https://…" onChange={e => edit(r._key, { url: e.target.value })} /></td>
                    <td><button className="small" onClick={() => setRows(rs => rs.filter(x => x._key !== r._key))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="primary" onClick={publish} disabled={!!busy}>Publish {rows.length} listing{rows.length === 1 ? "" : "s"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
