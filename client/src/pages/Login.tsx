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

// Ported 1:1 from scholarship-site/index.html.
export function Landing() {
  useCursorLight();
  const nav = useNavigate();
  // Space on the landing page starts the conversation (cursor-light.js).
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName));
      if ((e.code === "Space" || e.key === " ") && !typing && !e.repeat) { e.preventDefault(); nav("/student/login", { state: { mode: "signup" } }); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [nav]);

  return (
    <div>
      {/* HERO: light field */}
      <section id="top" className="hero" aria-label="MyOpps">
        <div className="bloom" aria-hidden="true" />
        <p className="word">MyOpps</p>
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
            <li><a href="#talk"><span>01</span> Talk</a></li>
            <li><a href="#listen"><span>02</span> We listen</a></li>
            <li><a href="#match"><span>03</span> Your matches</a></li>
            <li><a href="#privacy"><span>04</span> Privacy</a></li>
          </ol>
        </div>
      </section>

      {/* 01 TALK */}
      <section id="talk" className="section">
        <h2 className="lhs sec-h"><span className="num">01</span>&nbsp; Talk</h2>
        <div className="rhs">
          <p>Hold Space, or tap the mic, and answer three questions: who you are, what you want to study, something you're proud of. Say whatever feels true. Prefer typing? Paste a statement instead.</p>
          <div className="photo">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#8A8377" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
            </svg>
          </div>
        </div>
      </section>

      {/* 02 LISTEN */}
      <section id="listen" className="section">
        <h2 className="lhs sec-h"><span className="num">02</span>&nbsp; We listen</h2>
        <div className="rhs">
          <p>The light responds while you speak. When you finish, we pull out what matters: your activities, what you've done for others, where you're headed.</p>
          <div className="listen-art" aria-hidden="true"><div><div /></div></div>
        </div>
      </section>

      {/* 03 MATCH */}
      <section id="match" className="section">
        <h2 className="lhs sec-h"><span className="num">03</span>&nbsp; Your matches</h2>
        <div className="rhs">
          <p>You get a short list, not a database. Every match comes with the reason it fits, pulled from what you said, plus an honest estimate of your odds.</p>
          <article className="listing">
            <div className="art" aria-hidden="true" style={{ background: "linear-gradient(90deg, #B7C8D2 0%, #F4C26A 40%, #E6743A 100%)" }} />
            <div className="body">
              <div className="head">
                <h3>BCCHS Alumni Leadership Award</h3>
                <span className="fit">Strong fit</span>
              </div>
              <p className="meta">$1,500 · Due Feb 15, 2027</p>
              <p className="why"><span>Why you:</span> you're student council president and run your DECA chapter.</p>
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
          <span>© 2026 MyOpps</span>
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
