import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import { MicIcon } from "../components/Icons";
import { useCursorLight } from "../components/Chrome";

// Sign-in pages use the landing page's intro split: big headline left, copy + form right.
export function StudentLogin() {
  const loc = useLocation();
  useCursorLight();
  return (
    <main className="section intro auth">
      <h1 className="lhs"><span className="num">01</span>&nbsp; Find what fits you</h1>
      <div className="rhs">
        <p>Your matches refresh against the latest listings every time you sign in. New here? Create an account and we'll start with a short conversation.</p>
        <div className="card">
          <LoginForm role="student" initialMode={(loc.state as any)?.mode ?? "login"} demo={{ email: "demo.student@example.com", password: "demo-password" }} />
        </div>
        <p className="small muted">Counselor or provider? <Link to="/partner/login" className="textlink">Sign in here</Link>.</p>
      </div>
    </main>
  );
}

export function PartnerLogin() {
  const loc = useLocation();
  useCursorLight();
  return (
    <main className="section intro auth">
      <h1 className="lhs"><span className="num">02</span>&nbsp; Put your listings in front of the right students</h1>
      <div className="rhs">
        <p>Upload a handout or spreadsheet, see how many students match each award, and invite them to apply.</p>
        <div className="card">
          <LoginForm role="partner" initialMode={(loc.state as any)?.mode ?? "login"} demo={{ email: "demo.counselor@example.com", password: "demo-password", org: { orgName: "Baruch College Campus HS counseling office", orgType: "school" } }} />
        </div>
        <p className="small muted">Student? <Link to="/student/login" className="textlink">Sign in here</Link>.</p>
      </div>
    </main>
  );
}

// Ported from myops/index.html — skyspace hero with day/night cycle.
export function Landing() {
  useCursorLight();
  const nav = useNavigate();

  // Space on the landing page starts the conversation.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName));
      if ((e.code === "Space" || e.key === " ") && !typing && !e.repeat) { e.preventDefault(); nav("/student/login", { state: { mode: "signup" } }); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [nav]);

  // Start the day cycle at the visitor's real time of day.
  useEffect(() => {
    const DAY_SECONDS = 40;
    const d = new Date();
    const offset = -(((d.getHours() * 60 + d.getMinutes()) / 1440) * DAY_SECONDS);
    document.documentElement.style.setProperty("--offset", offset.toFixed(2) + "s");

    // Parallax on hero aperture
    const hero = document.getElementById("top");
    const aperture = document.getElementById("aperture");
    if (!hero || !aperture) return;
    const move = (e: MouseEvent) => {
      const r = hero.getBoundingClientRect();
      const hx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const hy = ((e.clientY - r.top) / r.height) * 2 - 1;
      aperture.style.transform = `translate(calc(-50% + ${Math.round(-hx * 14)}px), calc(-50% + ${Math.round(-hy * 8)}px))`;
    };
    const leave = () => { aperture.style.transform = "translate(-50%, -50%)"; };
    hero.addEventListener("mousemove", move);
    hero.addEventListener("mouseleave", leave);
    return () => { hero.removeEventListener("mousemove", move); hero.removeEventListener("mouseleave", leave); };
  }, []);

  return (
    <div>
      {/* HERO: skyspace with day/night cycle */}
      <section id="top" className="skyspace cycle c-dome" aria-label="myops">
        <div className="skyspace-atmo" aria-hidden="true" />
        <div className="skyspace-glow cycle c-glow" aria-hidden="true" />
        <div id="aperture" className="skyspace-aperture cycle c-sky" aria-hidden="true" />
        <div className="skyspace-cove cycle c-cove" aria-hidden="true" />
        <div className="skyspace-dusk cycle c-dusk" aria-hidden="true" />
        <svg className="skyspace-grain" aria-hidden="true" width="100%" height="100%">
          <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" /></filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
        <p className="skyspace-word cycle c-ink">
          myops
        </p>
      </section>

      {/* INTRO */}
      <section className="section intro">
        <h1 className="lhs">Scholarships that fit who you are</h1>
        <div className="rhs wide">
          <p>Most scholarship searches start with a form. This one starts with a conversation. You tell us about yourself out loud, we ask a couple of follow-up questions, and we show you the scholarships and free opportunities you actually qualify for.</p>
          <p>No fifty-field profile. Just talk for a minute.</p>
        </div>
      </section>

      {/* CONTENTS */}
      <section aria-label="Contents" className="band">
        <div className="section">
          <h2>How it works</h2>
          <ol className="contents">
            <li className="slide-l"><a href="#talk"><span>01</span> Talk</a></li>
            <li className="slide-l"><a href="#listen"><span>02</span> We listen</a></li>
            <li className="slide-l"><a href="#match"><span>03</span> Your matches</a></li>
            <li className="slide-l"><a href="#privacy"><span>04</span> Privacy</a></li>
          </ol>
        </div>
      </section>

      {/* 01 TALK */}
      <section id="talk" className="section">
        <h2 className="lhs sec-h"><span className="num">01</span>&nbsp; Talk</h2>
        <div className="rhs">
          <p>Hold Space, or tap the mic, and answer one question: tell me about yourself. Say whatever feels true. Where you're from, what you study, what you do after class.</p>
          <div className="talk-art slide-r" aria-hidden="true">
            <div className="talk-orb wander"><div className="talk-orb-inner speak" style={{ background: "radial-gradient(circle, rgba(244,160,96,0.95) 0%, rgba(226,112,92,0.55) 38%, rgba(226,112,92,0) 70%)" }} /></div>
            <div className="talk-orb wander" style={{ left: "22%", top: "34%", width: "60%", animationDuration: "11s", animationDelay: "-4s" }}><div className="talk-orb-inner speak" style={{ background: "radial-gradient(circle, rgba(255,226,180,0.95) 0%, rgba(250,190,130,0.5) 40%, rgba(250,190,130,0) 72%)", animationDuration: "2.9s", animationDelay: "-0.7s" }} /></div>
            <div className="talk-orb wander" style={{ left: "-10%", top: "46%", width: "70%", animationDuration: "17s", animationDelay: "-9s" }}><div className="talk-orb-inner speak" style={{ background: "radial-gradient(circle, rgba(196,92,140,0.8) 0%, rgba(140,70,150,0.4) 42%, rgba(140,70,150,0) 72%)", animationDuration: "4.1s", animationDelay: "-1.9s" }} /></div>
            <div className="talk-orb wander" style={{ left: "44%", top: "4%", width: "64%", animationDuration: "19s", animationDelay: "-3s" }}><div className="talk-orb-inner speak" style={{ background: "radial-gradient(circle, rgba(122,146,226,0.6) 0%, rgba(90,100,200,0.28) 45%, rgba(90,100,200,0) 72%)", animationDuration: "3.7s", animationDelay: "-2.6s" }} /></div>
            <svg className="talk-art-grain" width="100%" height="100%" aria-hidden="true">
              <filter id="grain-talk"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" /></filter>
              <rect width="100%" height="100%" filter="url(#grain-talk)" />
            </svg>
          </div>
        </div>
      </section>

      {/* 02 LISTEN */}
      <section id="listen" className="section">
        <h2 className="lhs sec-h"><span className="num">02</span>&nbsp; We listen</h2>
        <div className="rhs">
          <p>The light responds while you speak. When you finish, we ask one or two follow-ups to fill in what's missing, like your year or what you want to study.</p>
          <div className="listen-art slide-r" aria-hidden="true"><div><div /></div></div>
        </div>
      </section>

      {/* 03 MATCH */}
      <section id="match" className="section">
        <h2 className="lhs sec-h"><span className="num">03</span>&nbsp; Your matches</h2>
        <div className="rhs">
          <p>You get a short list, not a database. Every match comes with the reason it fits, pulled from what you said.</p>
          <article className="listing slide-r">
            <div className="art" aria-hidden="true" style={{ background: "radial-gradient(ellipse 120% 140% at 50% 120%, #F3B07C 0%, #D9708A 32%, #7A4FA0 62%, #2C2A62 100%)" }} />
            <div className="body">
              <div className="head">
                <h3>[Scholarship name]</h3>
                <span className="fit">Strong fit</span>
              </div>
              <p className="meta">[$ Amount] · Due [Date]</p>
              <p className="why"><span>Why you:</span> you want to go into public health.</p>
            </div>
          </article>
        </div>
      </section>

      {/* 04 PRIVACY */}
      <section id="privacy" className="section" style={{ paddingBottom: 200 }}>
        <h2 className="lhs sec-h"><span className="num">04</span>&nbsp; Privacy</h2>
        <div className="rhs">
          <p>Your voice is transcribed in your browser and never uploaded; only the text you confirm is sent. Providers only see you if you choose to be discoverable, and even then they get an anonymous profile: your interests, state, school level and GPA range. Never your name, email, ZIP code, school or statement.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="site-foot">
        <div>
          <span>© 2026 myops</span>
          <span><Link to="/partner/login">For schools and providers →</Link></span>
        </div>
      </footer>

      {/* FLOATING VOICE BAR */}
      <Link to="/student/login" state={{ mode: "signup" }} className="voice-bar" aria-label="Tell me about yourself. Start talking">
        <span className="prompt">Tell me about yourself…</span>
        <span className="hint">hold <kbd>Space</kbd></span>
        <span className="mic" aria-hidden="true"><MicIcon /></span>
      </Link>
    </div>
  );
}
