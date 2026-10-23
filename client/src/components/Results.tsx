import { useEffect, useMemo, useState } from "react";
import { api, money, fmtDate, effortLabel, ls, lsSet } from "../lib/api";
import type { MatchCard, TrackerEvent, Invite, TrackStatus } from "../../../shared/types";

// Art bands for cards (from match.js), picked deterministically per listing.
const ART = [
  "radial-gradient(circle at 50% 30%, #A9D0F4 0%, #A9D0F4 14%, #E2A066 16%, #B8653A 40%, #4A1E0F 100%)",
  "radial-gradient(ellipse at 50% 0%, #D9B6EE 0%, #9FB2F2 30%, #3E63D8 55%, #0A1030 100%)",
  "linear-gradient(90deg, #8FB8B4 0%, #DDEFEC 50%, #8FB8B4 100%)",
  "linear-gradient(90deg, #B7C8D2 0%, #F4C26A 40%, #E6743A 100%)",
  "radial-gradient(circle at 30% 70%, #F6E3B0 0%, #EFA458 45%, #6E2D17 100%)",
  "linear-gradient(135deg, #E9CB8C 0%, #D9A48C 50%, #B7C8D2 100%)",
];
export function artFor(id: string, kind: string) {
  let h = kind === "opportunity" ? 3 : 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ART[h % ART.length];
}
export const fitLabel = (pct: number) => (pct >= 80 ? "Strong fit" : pct >= 60 ? "Good fit" : "Possible fit");

// Current status per listing from the event log. Outcomes outrank applied, which outranks saved.
export type Status = TrackStatus | "none";
const RANK: Record<string, number> = { saved: 1, applied: 2, attended: 2, won: 3, not_selected: 3 };
function statusMap(events: TrackerEvent[]) {
  const m: Record<string, { status: Status; amountWon?: number; at: string }> = {};
  for (const e of events) {
    const cur = m[e.listingId];
    if (!cur || RANK[e.status] >= RANK[cur.status]) m[e.listingId] = { status: e.status, amountWon: e.amountWon ?? cur?.amountWon, at: e.createdAt };
  }
  return m;
}

// ---------- Tracker bar ----------

export function TrackerBar({ events }: { events: TrackerEvent[] }) {
  const [goals, setGoals] = useState(() => ls("myops.goals", { money: 5000, weekly: 2 }));
  useEffect(() => { lsSet("myops.goals", goals); }, [goals]);
  const weekAgo = Date.now() - 7 * 864e5;
  const appliedThisWeek = events.filter(e => e.status === "applied" && new Date(e.createdAt).getTime() > weekAgo).length;
  const won = events.filter(e => e.status === "won").reduce((s, e) => s + (e.amountWon ?? 0), 0);
  const saved = events.filter(e => e.status === "saved").length;
  const applied = events.filter(e => e.status === "applied").length;
  return (
    <div className="tracker">
      <div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="mono">Money won</span>
          <span className="goal small muted">goal <input type="number" value={goals.money} onChange={e => setGoals({ ...goals, money: Number(e.target.value) })} /></span>
        </div>
        <div className="big">{money(won)}</div>
        <div className="bar"><div style={{ width: `${Math.min(100, goals.money ? (won / goals.money) * 100 : 0)}%` }} /></div>
      </div>
      <div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="mono">Applied this week · {applied} total · {saved} saved</span>
          <span className="goal small muted">goal <input type="number" value={goals.weekly} onChange={e => setGoals({ ...goals, weekly: Number(e.target.value) })} /></span>
        </div>
        <div className="big">{appliedThisWeek} / {goals.weekly}</div>
        <div className="bar"><div style={{ width: `${Math.min(100, goals.weekly ? (appliedThisWeek / goals.weekly) * 100 : 0)}%` }} /></div>
      </div>
    </div>
  );
}

// ---------- Status control ----------

const STATUS_LABEL: Record<string, string> = { none: "", saved: "Saved", applied: "Applied", attended: "Attended", won: "Won", not_selected: "Not selected" };

function StatusControl({ listing, current, amountWon, onChange }: { listing: MatchCard["listing"]; current: Status; amountWon?: number; onChange: (s: Status, amount?: number) => void }) {
  const [askAmount, setAskAmount] = useState(false);
  const [amount, setAmount] = useState(String(listing.amountMax ?? ""));
  const isOpp = listing.kind === "opportunity";
  const doneLabel = isOpp ? "Attended" : "Applied";
  const doneStatus: Status = isOpp ? "attended" : "applied";

  if (askAmount) {
    return (
      <form className="row" style={{ gap: 6 }} onSubmit={e => { e.preventDefault(); onChange("won", Number(amount) || 0); setAskAmount(false); }}>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="$ amount" style={{ width: 110, padding: "5px 8px", fontSize: 13 }} autoFocus />
        <button className="primary small" type="submit">Won</button>
        <button className="small" type="button" onClick={() => setAskAmount(false)}>Cancel</button>
      </form>
    );
  }
  if (current === "won") return <div className="row" style={{ gap: 6 }}><span className="pill fit">Won {amountWon ? money(amountWon) : ""}</span><button className="small ghost" onClick={() => onChange("none")}>Reset</button></div>;
  if (current === "not_selected") return <div className="row" style={{ gap: 6 }}><span className="pill">Not selected</span><button className="small ghost" onClick={() => onChange("none")}>Reset</button></div>;
  if (current === "applied" || current === "attended") {
    return (
      <div className="row" style={{ gap: 6 }}>
        <span className="pill match">{STATUS_LABEL[current]} ✓</span>
        {!isOpp && <button className="small" onClick={() => setAskAmount(true)}>Won?</button>}
        {!isOpp && <button className="small" onClick={() => onChange("not_selected")}>Not selected</button>}
        <button className="small" title="Undo" onClick={() => onChange("saved")}>↩</button>
      </div>
    );
  }
  return (
    <div className="row" style={{ gap: 6 }}>
      <button className={`small ${current === "saved" ? "on" : ""}`} onClick={() => onChange(current === "saved" ? "none" : "saved")}>{current === "saved" ? "★ Saved" : "☆ Save"}</button>
      <button className="small" onClick={() => onChange(doneStatus)}>Mark {doneLabel.toLowerCase()}</button>
    </div>
  );
}

// ---------- Results ----------

type Tab = "scholarships" | "opportunities" | "mine";

export function Results({ results, events, invites, tracked = [], setStatus }: {
  results: { scholarships: MatchCard[]; opportunities: MatchCard[]; state: string }; tracked?: MatchCard["listing"][];
  events: TrackerEvent[]; invites: (Invite & { listing?: MatchCard["listing"] })[]; setStatus: (id: string, s: Status, amount?: number) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("scholarships");
  const [why, setWhy] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState({ localOnly: false, freeOnly: false, byDeadline: false });
  const statuses = useMemo(() => statusMap(events), [events]);
  const mineCount = Object.keys(statuses).length;

  const all = useMemo(() => [...results.scholarships, ...results.opportunities], [results]);
  const cards = useMemo(() => {
    if (tab === "mine") {
      // Everything with a status, sorted by status then deadline. Cards not in current results still show via invites' listing data.
      const byId = new Map(all.map(c => [c.listing.id, c]));
      // Saved items that aren't in today's matches (eligibility changed, deadline passed) still show, without a score.
      for (const l of tracked) if (!byId.has(l.id)) byId.set(l.id, { listing: l, matchPct: 0, odds: { band: "", label: "" }, isLocal: false });
      const order = { saved: 0, applied: 1, attended: 1, won: 2, not_selected: 3, none: 9 };
      return Object.entries(statuses)
        .map(([id, s]) => byId.get(id))
        .filter((c): c is MatchCard => !!c)
        .sort((a, b) => order[statuses[a.listing.id].status] - order[statuses[b.listing.id].status] || (a.listing.deadline ?? a.listing.eventDate ?? "9").localeCompare(b.listing.deadline ?? b.listing.eventDate ?? "9"));
    }
    let c = results[tab];
    if (filters.localOnly) c = c.filter(x => x.isLocal || x.listing.isOnline);
    if (filters.freeOnly) c = c.filter(x => tab === "scholarships" || !x.listing.cost);
    if (filters.byDeadline) c = [...c].sort((a, b) => (a.listing.deadline ?? a.listing.eventDate ?? "9").localeCompare(b.listing.deadline ?? b.listing.eventDate ?? "9"));
    return c.slice(0, 15);
  }, [results, tab, filters, statuses, all, tracked]);

  useEffect(() => {
    const missing = cards.map(c => c.listing.id).filter(id => !why[id]);
    if (missing.length === 0) return;
    api.explain(missing.slice(0, 12)).then(r => setWhy(w => ({ ...w, ...r.why }))).catch(() => {});
  }, [cards]);

  const nextDeadline = cards.length && tab === "mine" ? cards.map(c => c.listing.deadline).filter(Boolean).sort()[0] : undefined;

  const amountLine = (l: MatchCard["listing"]) => {
    const parts: string[] = [];
    if (l.kind === "scholarship" && l.amountMax != null) parts.push((l.amountMin && l.amountMin !== l.amountMax ? `${money(l.amountMin)}–${money(l.amountMax)}` : money(l.amountMax)) + (l.numAwards && l.numAwards > 1 ? ` × ${l.numAwards}` : ""));
    if (l.kind === "opportunity") parts.push(l.cost ? `Cost ${money(l.cost)}` : "Free");
    if (l.eventDate) parts.push(`Event ${fmtDate(l.eventDate)}`);
    if (l.deadline) parts.push(`Due ${fmtDate(l.deadline)}`);
    return parts.join(" · ");
  };

  return (
    <div id="results" className="stack" style={{ gap: 24 }}>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "scholarships"} className={tab === "scholarships" ? "active" : ""} onClick={() => setTab("scholarships")}>Scholarships · {results.scholarships.length}</button>
        <button role="tab" aria-selected={tab === "opportunities"} className={tab === "opportunities" ? "active" : ""} onClick={() => setTab("opportunities")}>Opportunities · {results.opportunities.length}</button>
        <button role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}>My list · {mineCount}{invites.length ? ` · ${invites.length} invite${invites.length === 1 ? "" : "s"}` : ""}</button>
      </div>

      {tab !== "mine" && (
        <div className="row filters">
          <button className={`small ${filters.localOnly ? "on" : ""}`} onClick={() => setFilters(f => ({ ...f, localOnly: !f.localOnly }))}>Local or online</button>
          {tab === "opportunities" && <button className={`small ${filters.freeOnly ? "on" : ""}`} onClick={() => setFilters(f => ({ ...f, freeOnly: !f.freeOnly }))}>Free only</button>}
          <button className={`small ${filters.byDeadline ? "on" : ""}`} onClick={() => setFilters(f => ({ ...f, byDeadline: !f.byDeadline }))}>Sort by deadline</button>
          <span className="mono" style={{ marginLeft: "auto" }}>Showing {cards.length} · {results.state || "?"}</span>
        </div>
      )}

      {tab === "mine" && invites.length > 0 && (
        <div className="card invites stack" style={{ gap: 10 }}>
          <p className="eyebrow">Invitations</p>
          <h3>You've been invited to apply</h3>
          {invites.map(i => (
            <div key={i.id} className="row small" style={{ justifyContent: "space-between" }}>
              <span><b>{i.listing?.title ?? "A listing"}</b>{i.listing?.provider ? ` · ${i.listing.provider}` : ""} invited you based on your anonymous profile.</span>
              {i.listing?.url && <a href={i.listing.url} target="_blank" rel="noreferrer">Open →</a>}
            </div>
          ))}
        </div>
      )}
      {tab === "mine" && nextDeadline && <p className="muted small" style={{ margin: 0 }}>Next deadline on your list: <b>{fmtDate(nextDeadline)}</b></p>}
      {tab === "mine" && cards.length === 0 && <div className="card muted">Nothing here yet. Save a few from the other tabs and they'll collect here, sorted by deadline.</div>}
      {tab !== "mine" && cards.length === 0 && <div className="card muted">Nothing matches these filters. Try removing one.</div>}

      <div className="matches">
      {cards.map(c => {
        const l = c.listing; const s = statuses[l.id] ?? { status: "none" as Status };
        const w = why[l.id];
        const whyText = w ? w.replace(/^Matches:\s*/i, "") : null;
        const where = c.isLocal ? (l.schools?.length ? "Your school" : "Local") : l.isOnline ? "Online" : "";
        const sub = [l.provider, l.oppType ? l.oppType.replace("_", " ") : "", l.effort ? effortLabel[l.effort] : "", l.isSweepstakes ? "sweepstakes" : ""].filter(Boolean).join(" · ");
        return (
          <article key={l.id} className="mcard">
            <div className="card-art" aria-hidden="true" style={{ background: artFor(l.id, l.kind) }}>
              {c.matchPct > 0
                ? <span className="card-fit">{fitLabel(c.matchPct)}{where ? ` · ${where}` : ""}</span>
                : <span className="card-fit" title="Your profile no longer meets this listing's stated requirements, or its deadline passed">Not in today's matches</span>}
              {s.status !== "none" && <span className="card-status">{STATUS_LABEL[s.status]}{s.status === "won" && s.amountWon ? ` ${money(s.amountWon)}` : ""}</span>}
            </div>
            <div className="card-body">
              <div>
                <h2>{l.title}</h2>
                <p className="card-meta">{amountLine(l)}</p>
                <p className="card-meta" style={{ marginTop: 2 }}>{sub}</p>
              </div>
              {l.summary && <p className="card-sub">{l.summary}</p>}
              {c.matchPct > 0 && c.odds.label && <p className="card-meta" style={{ margin: 0 }} title="Rough estimate from how many people are likely eligible and how well you fit. Not a guarantee.">Est. odds: {c.odds.label}</p>}
              <div className={`card-why ${whyText ? "" : "pending"}`}>
                <span>Why you</span>
                <span>{whyText ? `${whyText[0].toUpperCase()}${whyText.slice(1)}.` : "Working out why this fits…"}</span>
              </div>
              <div className="card-actions">
                {l.url ? <a className="card-link" href={l.url} target="_blank" rel="noreferrer">View details</a> : <span className="card-link disabled">No link yet</span>}
                <StatusControl listing={l} current={s.status} amountWon={s.amountWon} onChange={(st, amt) => setStatus(l.id, st, amt)} />
              </div>
            </div>
          </article>
        );
      })}
      </div>
    </div>
  );
}
