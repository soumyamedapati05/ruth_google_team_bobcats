// Page chrome ported from the bobcats mockups:
//   SiteHeader + light pages  ← index.html (two-tier header, numbered section nav)
//   Room + RoomHeader         ← talk.html (dark warm room, brand left, mono status right)
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { landingFor } from "./LoginForm";

// Warm light that follows the cursor (cursor-light.js). The room uses a slightly bigger, paler light.
const LIGHTS = {
  light: "radial-gradient(420px circle at 50% 35%, rgba(255,190,120,0.18) 0%, rgba(255,190,120,0.06) 40%, rgba(255,190,120,0) 70%)",
  room: "radial-gradient(460px circle at 50% 35%, rgba(255,214,160,0.2) 0%, rgba(255,214,160,0.07) 35%, rgba(255,214,160,0) 70%)",
};
export function useCursorLight(kind: keyof typeof LIGHTS = "light") {
  useEffect(() => {
    const light = document.getElementById("cursor-light");
    if (!light) return;
    const base = LIGHTS[kind];
    light.style.background = base;
    light.style.zIndex = kind === "room" ? "50" : "40";
    let frame: number | null = null, x = 0, y = 0;
    const paint = () => { frame = null; light.style.background = base.replace(/at [^,]+?,/, `at ${x}px ${y}px,`); };
    const move = (e: MouseEvent) => { x = e.clientX; y = e.clientY; light.style.opacity = "1"; if (!frame) frame = requestAnimationFrame(paint); };
    const leave = () => { light.style.opacity = "0"; };
    document.addEventListener("mousemove", move);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => { document.removeEventListener("mousemove", move); document.documentElement.removeEventListener("mouseleave", leave); light.style.opacity = "0"; };
  }, [kind]);
}

function useHealth() {
  const [health, setHealth] = useState<{ mock: boolean; listings: number } | null>(null);
  useEffect(() => { api.health().then(setHealth).catch(() => {}); }, []);
  return health;
}
function MockBadge() {
  const health = useHealth();
  return health?.mock ? <span className="mock-badge" title="No GEMINI_API_KEY set: extraction, embeddings and why-lines use offline mocks">mock LLM · {health.listings} listings</span> : null;
}

// ---------- light pages ----------

type Section = { label: string; to: string; hash?: boolean };

function SiteHeader() {
  const { me, loading } = useAuth();
  const loc = useLocation();
  const isPartner = me?.role === "partner";
  const onLanding = loc.pathname === "/";

  const sections: Section[] = isPartner
    ? [{ label: "My listings", to: "/partner/listings" }, { label: "Add listings", to: "/partner/add" }, { label: "Profile", to: "/partner/profile" }]
    : onLanding
      ? [{ label: "Talk", to: "#talk", hash: true }, { label: "Listen", to: "#listen", hash: true }, { label: "Match", to: "#match", hash: true }, { label: "Privacy", to: "#privacy", hash: true }]
      : [{ label: "Students", to: "/student/login" }, { label: "Counselors & providers", to: "/partner/login" }, { label: "How it works", to: "/" }];
  const sup = (i: number) => <sup>{String(i + 1).padStart(2, "0")}</sup>;

  return (
    <header className="site-head">
      <div className="wrap">
        <div className="head-top">
          <Link to={me ? landingFor(me) : "/"} className="brand">MyOpps</Link>
          <div className="head-links">
            <MockBadge />
            {isPartner && <span>{me.org?.orgName}</span>}
            {!me && !loading && <NavLink to="/partner/login">For schools</NavLink>}
            {!me && !loading && <NavLink to="/student/login">Sign in</NavLink>}
          </div>
        </div>
        <nav aria-label="Sections" className="head-sections">
          {sections.map((s, i) => s.hash
            ? <a key={s.to} href={s.to}>{s.label}{sup(i)}</a>
            : <NavLink key={s.to} to={s.to} end>{s.label}{sup(i)}</NavLink>)}
        </nav>
      </div>
    </header>
  );
}

export function LightLayout() {
  useEffect(() => { document.body.classList.remove("is-room"); }, []);
  return <><SiteHeader /><Outlet /></>;
}

// ---------- the room ----------

// Pages inside the room can put a short status in the top-right corner ("1 / 3", "Matching", "Done").
const StatusCtx = createContext<(s: ReactNode) => void>(() => {});
export const useRoomStatus = (s: ReactNode) => {
  const set = useContext(StatusCtx);
  useEffect(() => { set(s); return () => set(null); }, [s, set]);
};

export function RoomLayout() {
  useCursorLight("room");
  const { me } = useAuth();
  const [status, setStatus] = useState<ReactNode>(null);
  useEffect(() => { document.body.classList.add("is-room"); return () => document.body.classList.remove("is-room"); }, []);
  const onboarded = !!me?.onboarded;
  return (
    <StatusCtx.Provider value={setStatus}>
      <div className="room">
        <header className="room-top">
          <Link to={onboarded ? "/matches" : "/onboarding"} className="room-brand">MyOpps</Link>
          <nav className="room-links" aria-label="Your account">
            <MockBadge />
            {status && <span className="room-status">{status}</span>}
            {onboarded && <NavLink to="/matches">Matches</NavLink>}
            {onboarded && <NavLink to="/profile">Profile</NavLink>}
          </nav>
        </header>
        <Outlet />
      </div>
    </StatusCtx.Provider>
  );
}
