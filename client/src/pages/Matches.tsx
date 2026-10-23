import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRoomStatus } from "../components/Chrome";
import { api, type MatchResult, type Listing } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Results, TrackerBar, type Status } from "../components/Results";
import type { TrackerEvent, Invite } from "../../../shared/types";

// Matches are recomputed on every visit (and therefore on every login) against the listings that exist right now.
export default function Matches() {
  const { me } = useAuth();
  const nav = useNavigate();
  const [results, setResults] = useState<MatchResult | null>(null);
  const [events, setEvents] = useState<TrackerEvent[]>([]);
  const [invites, setInvites] = useState<(Invite & { listing?: Listing })[]>([]);
  const [tracked, setTracked] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true); setError(null);
    try {
      const [m, t] = await Promise.all([api.match(), api.tracker()]);
      setResults(m); setEvents(t.events); setInvites(t.invites); setTracked(t.listings);
    } catch (e: any) { setError(e.message); }
    finally { setRefreshing(false); }
  }
  useEffect(() => { refresh(); }, [me?.id]);
  useEffect(() => { const t = setInterval(() => api.tracker().then(r => { setEvents(r.events); setInvites(r.invites); setTracked(r.listings); }).catch(() => {}), 15000); return () => clearInterval(t); }, []);

  async function setStatus(listingId: string, status: Status, amountWon?: number) {
    const r = await api.track({ listingId, status, amountWon });
    setEvents(r.events);
  }

  const chips = me?.profile.chips ?? [];
  useRoomStatus(results ? "Done" : "Matching");
  return (
    <section className="results">
      <div className="results-head">
        <div className="mini-orb" aria-hidden="true" />
        <div className="titles">
          <p className="eyebrow">{results ? `Matched from your conversation · ${results.listingCount} listings · refreshed ${new Date(results.matchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Matching…"}</p>
          <h1>Your best fits</h1>
        </div>
        <div className="aside">
          <button className="small ghost" onClick={refresh} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button>
        </div>
      </div>

      <div className="heard">
        <p className="muted">What we heard {chips.length > 0 && <>· <Link to="/profile" className="textlink">edit</Link></>}</p>
        {chips.length > 0
          ? <div className="traits">{chips.map(c => <span key={c} className="trait">{c}</span>)}</div>
          : <p className="lede" style={{ fontSize: 17 }}>Nothing yet. <Link to="/onboarding" state={{ step: "talk" }}>Talk for a minute</Link> or <Link to="/profile">add a few traits</Link> to get specific matches.</p>}
      </div>

      {error && (
        <div className="card stack">
          <b className="error">Couldn't load matches: {error}</b>
          <span className="small muted">Try Refresh. If it keeps failing, sign out and back in, or check that the server is running (the badge in the top-right shows how many listings it has).</span>
        </div>
      )}
      {results && results.scholarships.length + results.opportunities.length === 0 && (
        <div className="card stack">
          <b>No listings match your profile yet.</b>
          <span className="small muted">The server has {results.listingCount} listings; your state resolved to "{results.state || "unknown"}". If the listing count is 0 or the data looks wrong, run <code>npm run seed -- --reset</code> and restart.</span>
        </div>
      )}
      <TrackerBar events={events} />
      {results && <Results results={results} events={events} invites={invites} tracked={tracked} setStatus={setStatus} />}

      <div className="results-foot">
        <button className="lift" onClick={() => nav("/onboarding", { state: { step: "talk" } })}>Talk again</button>
        <span className="muted small">Matches update as you tell us more.</span>
      </div>
    </section>
  );
}
