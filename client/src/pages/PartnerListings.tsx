import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, money, fmtDate, type Listing } from "../lib/api";
import type { PartnerListingView } from "../../../shared/types";

export default function PartnerListings() {
  const [blocks, setBlocks] = useState<PartnerListingView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = () => api.myListings().then(r => setBlocks(r.listings)).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  async function invite(listingId: string, ref: string) {
    await api.invite(listingId, ref);
    setBlocks(bs => bs && bs.map(b => (b.listing.id === listingId ? { ...b, students: b.students.map(s => (s.ref === ref ? { ...s, invited: true } : s)) } : b)));
  }
  async function remove(id: string) {
    await api.removeListing(id);
    setBlocks(bs => bs && bs.filter(b => b.listing.id !== id));
    setConfirmRemove(null);
  }
  async function save(id: string, patch: Partial<Listing>) {
    const updated = await api.updateListing(id, patch);
    setBlocks(bs => bs && bs.map(b => (b.listing.id === id ? updated : b)));
    setEditing(null);
  }

  if (error) return <div className="page"><div className="card">{error}</div></div>;
  if (!blocks) return <div className="page muted">Loading…</div>;

  const total = blocks.reduce((s, b) => s + b.matchCount, 0);
  const scholarships = blocks.filter(b => b.listing.kind === "scholarship").length;

  return (
    <div className="page stack" style={{ gap: 18 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="step-label">{blocks.length} listings · {scholarships} scholarships · {blocks.length - scholarships} opportunities</div>
          <h1>My listings</h1>
          <p className="lede" style={{ margin: 0 }}>
            {total} student match{total === 1 ? "" : "es"} right now. Students appear only if they opted in, and only as anonymous profiles. An invite shows up in their tracker; no contact details are exchanged.
          </p>
        </div>
        <Link to="/partner/add"><button className="primary">+ Add listings</button></Link>
      </div>

      {blocks.length === 0 && <div className="card muted">No listings yet. <Link to="/partner/add">Add your first</Link> from a PDF, spreadsheet, or pasted text.</div>}

      {blocks.map(b => {
        const l = b.listing; const isOpen = open === l.id;
        return (
          <div key={l.id} className="card stack">
            <div className="row" style={{ justifyContent: "space-between", cursor: "pointer" }} onClick={() => setOpen(isOpen ? null : l.id)}>
              <div>
                <div className="row" style={{ gap: 6 }}>
                  <span className="pill">{l.kind === "scholarship" ? "Scholarship" : (l.oppType ?? "opportunity").replace("_", " ")}</span>
                  {l.schools?.length ? <span className="pill local">{l.schools.length === 1 ? l.schools[0] : `${l.schools.length} schools`}</span> : l.zipPrefixes?.length ? <span className="pill local">Local</span> : null}
                  {b.saves.saved + b.saves.applied > 0 && <span className="pill match">{b.saves.saved} saved · {b.saves.applied} applied</span>}
                </div>
                <h3 style={{ marginTop: 6 }}>{l.title}</h3>
                <div className="mono" style={{ marginTop: 4 }}>
                  {l.kind === "scholarship" ? money(l.amountMax) : l.cost ? `Cost ${money(l.cost)}` : "Free"}
                  {l.deadline ? ` · deadline ${fmtDate(l.deadline)}` : ""}{l.eventDate ? ` · event ${fmtDate(l.eventDate)}` : ""}
                  {l.states?.length ? ` · ${l.states.join(", ")}` : " · any state"}
                  {l.minGpa ? ` · GPA ${l.minGpa}+` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="big">{b.matchCount}</div>
                <div className="mono">students match · {b.localCount} local</div>
              </div>
            </div>

            {isOpen && (
              <div className="stack">
                <div className="row" style={{ gap: 6 }}>
                  {l.url && <a href={l.url} target="_blank" rel="noreferrer"><button className="small">Open link ↗</button></a>}
                  <button className="small" onClick={() => setEditing(editing === l.id ? null : l.id)}>{editing === l.id ? "Cancel edit" : "Edit"}</button>
                  {confirmRemove === l.id
                    ? <><span className="small muted">Remove this listing for everyone?</span><button className="small" style={{ color: "#a32d2d" }} onClick={() => remove(l.id)}>Yes, remove</button><button className="small" onClick={() => setConfirmRemove(null)}>Keep</button></>
                    : <button className="small" onClick={() => setConfirmRemove(l.id)}>Remove</button>}
                </div>

                {editing === l.id && <EditListing listing={l} onSave={p => save(l.id, p)} />}

                <div>
                  <div className="mono" style={{ marginBottom: 4 }}>Matching students (anonymous)</div>
                  {b.students.length === 0 && <div className="muted small">No discoverable students match yet.</div>}
                  {b.students.map(s => (
                    <div key={s.ref} className="student">
                      <div>
                        <div className="row" style={{ gap: 6 }}>
                          <span className="pill match">{s.matchPct}% match</span>
                          {s.schoolMatch && <span className="pill local">School match</span>}
                          {s.isLocal && !s.schoolMatch && <span className="pill local">Local</span>}
                          <span className="pill">{s.level === "hs" ? "High school" : "College"} · {s.state || "state n/a"} · GPA {s.gpaBand}</span>
                        </div>
                        <div className="chips" style={{ marginTop: 8 }}>{s.chips.map(c => <span key={c} className="chip">{c}</span>)}</div>
                      </div>
                      <button className={`small ${s.invited ? "on" : "primary"}`} disabled={s.invited} onClick={() => invite(l.id, s.ref)}>{s.invited ? "Invited ✓" : "Invite to apply"}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EditListing({ listing: l, onSave }: { listing: Listing; onSave: (p: Partial<Listing>) => Promise<void> }) {
  const [d, setD] = useState({
    title: l.title, provider: l.provider ?? "", summary: l.summary ?? "", url: l.url ?? "",
    amountMax: l.amountMax != null ? String(l.amountMax) : "", cost: l.cost != null ? String(l.cost) : "",
    deadline: l.deadline ?? "", eventDate: l.eventDate ?? "", states: (l.states ?? []).join(", "), schools: (l.schools ?? []).join(", "),
    schoolLevels: (l.schoolLevels ?? []).join(", "), minGpa: l.minGpa != null ? String(l.minGpa) : "", focusTags: (l.focusTags ?? []).join(", "), numAwards: String(l.numAwards ?? 1),
  });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof d>) => setD(x => ({ ...x, ...p }));
  const toList = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
  async function save() {
    setBusy(true);
    await onSave({
      title: d.title, provider: d.provider || undefined, summary: d.summary || undefined, url: d.url,
      amountMax: d.amountMax ? Number(d.amountMax) : undefined, amountMin: d.amountMax ? (l.amountMin ?? Number(d.amountMax)) : undefined,
      cost: d.cost ? Number(d.cost) : undefined, deadline: d.deadline || undefined, eventDate: d.eventDate || undefined,
      states: toList(d.states.toUpperCase()), schools: toList(d.schools), schoolLevels: toList(d.schoolLevels) as any,
      minGpa: d.minGpa ? Number(d.minGpa) : undefined, focusTags: toList(d.focusTags), numAwards: Number(d.numAwards) || 1,
    });
    setBusy(false);
  }
  return (
    <div className="stack" style={{ background: "var(--field)", padding: 16 }}>
      <div className="grid2">
        <label className="field">Title<input type="text" value={d.title} onChange={e => set({ title: e.target.value })} /></label>
        <label className="field">Provider<input type="text" value={d.provider} onChange={e => set({ provider: e.target.value })} /></label>
      </div>
      <label className="field">Summary<textarea style={{ minHeight: 60 }} value={d.summary} onChange={e => set({ summary: e.target.value })} /></label>
      <label className="field">Link<input type="text" value={d.url} onChange={e => set({ url: e.target.value })} placeholder="https://…" /></label>
      <div className="row" style={{ gap: 10 }}>
        {l.kind === "scholarship"
          ? <><label className="field" style={{ width: 110 }}>Amount $<input type="number" value={d.amountMax} onChange={e => set({ amountMax: e.target.value })} /></label>
              <label className="field" style={{ width: 90 }}># awards<input type="number" value={d.numAwards} onChange={e => set({ numAwards: e.target.value })} /></label></>
          : <label className="field" style={{ width: 110 }}>Cost $ (0 = free)<input type="number" value={d.cost} onChange={e => set({ cost: e.target.value })} /></label>}
        <label className="field" style={{ width: 150 }}>Deadline<input type="date" value={d.deadline} onChange={e => set({ deadline: e.target.value })} /></label>
        {l.kind === "opportunity" && <label className="field" style={{ width: 150 }}>Event date<input type="date" value={d.eventDate} onChange={e => set({ eventDate: e.target.value })} /></label>}
        <label className="field" style={{ width: 90 }}>Min GPA<input type="number" step="0.1" value={d.minGpa} onChange={e => set({ minGpa: e.target.value })} placeholder="—" /></label>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <label className="field" style={{ width: 120 }}>States<input type="text" value={d.states} onChange={e => set({ states: e.target.value })} placeholder="any" /></label>
        <label className="field" style={{ width: 130 }}>Levels<input type="text" value={d.schoolLevels} onChange={e => set({ schoolLevels: e.target.value })} placeholder="hs, college" /></label>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>Only for these schools<input type="text" value={d.schools} onChange={e => set({ schools: e.target.value })} placeholder="leave blank if open to all" /></label>
      </div>
      <label className="field">Tags<input type="text" value={d.focusTags} onChange={e => set({ focusTags: e.target.value })} /></label>
      <div className="row"><button className="primary small" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button><span className="small muted">Saving re-matches students against the updated listing.</span></div>
    </div>
  );
}
