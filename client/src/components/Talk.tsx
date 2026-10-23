// Voice conversation (ported from talk.js): asks three questions, listens, and lights the orb with your voice.
// Real microphone when available (Web Audio for loudness, Web Speech API for the transcript);
// otherwise a scripted demo so the flow still works. Audio never leaves the browser; only text does.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRoomStatus } from "./Chrome";
import { MicIcon } from "./Icons";

export const QUESTIONS = [
  "Tell me about yourself.",
  "What do you want to study, and why?",
  "What's something you've done that you're proud of?",
];
const DEMO_ANSWERS = [
  "I'm a senior at Baruch College Campus High School and president of our student council. I also run our DECA chapter and placed at the state business competition last year.",
  "Finance. I want to understand how money works so I can help families like mine make better decisions. I'll be the first in my family to go to college.",
  "For the past two years I've volunteered every Saturday at the Food Bank For New York City, over 120 hours total.",
];

type Phase = "ask" | "listening" | "heard" | "matching";
const LOOKS: Record<Phase, { sky: string; glow: string | null; skyCls: string; dome: number; halo: number | null; haloCls: string }> = {
  ask:       { sky: "#8DC0EF", glow: "0 0 0 1px rgba(255,255,255,0.15), 0 0 80px rgba(255,220,180,0.35)", skyCls: "sky-idle", dome: 1, halo: 0.35, haloCls: "halo-drift" },
  listening: { sky: "#F3BFA4", glow: null, skyCls: "", dome: 1.04, halo: null, haloCls: "" },
  heard:     { sky: "#F6E3B0", glow: "0 0 0 1px rgba(255,255,255,0.2), 0 0 100px 10px rgba(255,226,170,0.45)", skyCls: "", dome: 1, halo: 0.55, haloCls: "halo-drift" },
  matching:  { sky: "#FFFFFF", glow: "0 0 0 1px rgba(255,255,255,0.3), 0 0 200px 70px rgba(255,240,210,0.7)", skyCls: "sky-open", dome: 1.25, halo: 1, haloCls: "halo-spin" },
};

// When the last answer is in, Talk switches to the "matching" look and calls onDone; the parent decides what comes next.
export default function Talk({ onDone, aside }: { onDone: (answers: string[]) => void; aside?: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("ask");
  const [turn, setTurn] = useState(0);
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const answers = useRef<string[]>([]);
  const mode = useRef<"live" | "demo" | null>(null);
  const audio = useRef<{ ctx: AudioContext; analyser: AnalyserNode; buf: Uint8Array<ArrayBuffer> } | null>(null);
  const recog = useRef<any>(null);
  const finalText = useRef(""); const interimText = useRef("");
  const demoTimer = useRef<number | null>(null); const demoWords = useRef(0);
  const raf = useRef<number | null>(null); const level = useRef(0); const angle = useRef(0);
  const phaseRef = useRef<Phase>("ask"); const turnRef = useRef(0); const textRef = useRef("");
  const sky = useRef<HTMLDivElement>(null); const orb = useRef<HTMLDivElement>(null); const haloWrap = useRef<HTMLDivElement>(null); const halo = useRef<HTMLDivElement>(null); const dome = useRef<HTMLDivElement>(null);
  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const setT = (t: string) => { textRef.current = t; setText(t); };

  // Look per phase
  useEffect(() => {
    const look = LOOKS[phase];
    if (sky.current) { sky.current.style.backgroundColor = look.sky; sky.current.className = `sky ${look.skyCls}`; if (look.glow) sky.current.style.boxShadow = look.glow; }
    if (halo.current) halo.current.className = `halo ${look.haloCls}`;
    if (dome.current) dome.current.style.transform = `scale(${look.dome})`;
    if (haloWrap.current && look.halo !== null) { haloWrap.current.style.opacity = String(look.halo); haloWrap.current.style.transform = phase === "matching" ? "scale(1.35)" : "scale(1)"; }
    if (orb.current && phase !== "listening") orb.current.style.transform = "scale(1)";
  }, [phase]);

  function paintLevel() {
    const lv = level.current;
    if (sky.current) sky.current.style.boxShadow = `0 0 0 1px rgba(255,255,255,0.2), 0 0 ${Math.round(50 + lv * 160)}px ${Math.round(lv * 46)}px rgba(255,205,150,${(0.3 + lv * 0.45).toFixed(2)})`;
    if (orb.current) orb.current.style.transform = `scale(${(1 + lv * 0.07).toFixed(3)})`;
    if (haloWrap.current) { haloWrap.current.style.opacity = (0.45 + lv * 0.55).toFixed(2); haloWrap.current.style.transform = `scale(${(1 + lv * 0.28).toFixed(3)})`; }
    if (halo.current) halo.current.style.setProperty("--angle", `${Math.round(angle.current)}deg`);
  }
  function loop() {
    if (phaseRef.current !== "listening") return;
    let target = 0.05;
    if (mode.current === "live" && audio.current) {
      const a = audio.current; a.analyser.getByteTimeDomainData(a.buf);
      let sum = 0; for (let i = 0; i < a.buf.length; i++) { const v = (a.buf[i] - 128) / 128; sum += v * v; }
      target = Math.min(1, Math.sqrt(sum / a.buf.length) * 5);
    } else if (demoWords.current < DEMO_ANSWERS[turnRef.current].split(" ").length) {
      target = 0.25 + Math.random() * 0.75;
    }
    level.current = level.current * 0.8 + target * 0.2;
    angle.current = (angle.current + 1 + level.current * 9) % 360;
    paintLevel();
    raf.current = requestAnimationFrame(loop);
  }

  async function setupLive() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("no mic api");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();
    const analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audio.current = { ctx, analyser, buf: new Uint8Array(new ArrayBuffer(analyser.fftSize)) };
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = "en-US";
      r.onresult = (e: any) => {
        interimText.current = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText.current += e.results[i][0].transcript + " ";
          else interimText.current += e.results[i][0].transcript;
        }
        if (phaseRef.current === "listening") setT((finalText.current + interimText.current).trim());
      };
      r.onerror = () => {};
      recog.current = r;
    } else {
      setNote("Your browser can't transcribe speech, but the light still follows your voice. Try Chrome for transcripts.");
    }
    mode.current = "live";
  }
  async function ensureMode() {
    if (mode.current) return;
    try { await setupLive(); }
    catch { mode.current = "demo"; setNote("Demo mode: no microphone access, so this plays a sample answer."); }
  }

  async function start() {
    if (phaseRef.current !== "ask") return;
    setP("listening"); setT("");
    await ensureMode();
    if ((phaseRef.current as Phase) !== "listening") return;
    if (mode.current === "live" && audio.current) {
      if (audio.current.ctx.state === "suspended") audio.current.ctx.resume();
      finalText.current = ""; interimText.current = "";
      try { recog.current?.start(); } catch { /* already started */ }
    } else {
      demoWords.current = 0;
      const words = DEMO_ANSWERS[turnRef.current].split(" ");
      if (demoTimer.current) clearInterval(demoTimer.current);
      demoTimer.current = window.setInterval(() => {
        if (demoWords.current < words.length) { demoWords.current++; setT(words.slice(0, demoWords.current).join(" ")); }
      }, 170);
    }
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(loop);
  }

  function stop() {
    if (phaseRef.current !== "listening") return;
    if (demoTimer.current) clearInterval(demoTimer.current);
    if (raf.current) cancelAnimationFrame(raf.current);
    try { recog.current?.stop(); } catch { /* ignore */ }
    const t = mode.current === "demo" ? DEMO_ANSWERS[turnRef.current] : textRef.current;
    setT(t);
    answers.current[turnRef.current] = t;
    level.current = 0;
    setP("heard");
    const cur = turnRef.current;
    window.setTimeout(() => {
      if (cur < QUESTIONS.length - 1) { turnRef.current = cur + 1; setTurn(cur + 1); setT(""); setP("ask"); }
      else { setP("matching"); onDone(answers.current.filter(Boolean)); }
    }, 1500);
  }

  // Hold Space anywhere to talk; let go to finish.
  useEffect(() => {
    const isSpace = (e: KeyboardEvent) => e.code === "Space" || e.key === " ";
    const typing = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); };
    const down = (e: KeyboardEvent) => { if (!isSpace(e) || typing(e)) return; e.preventDefault(); if (!e.repeat) start(); };
    const up = (e: KeyboardEvent) => { if (!isSpace(e) || typing(e)) return; e.preventDefault(); stop(); };
    document.addEventListener("keydown", down); document.addEventListener("keyup", up);
    return () => {
      document.removeEventListener("keydown", down); document.removeEventListener("keyup", up);
      if (demoTimer.current) clearInterval(demoTimer.current); if (raf.current) cancelAnimationFrame(raf.current);
      try { recog.current?.stop(); } catch { /* ignore */ }
      audio.current?.ctx.close().catch(() => {});
    };
  }, []);

  useRoomStatus(phase === "matching" ? "Matching" : `${turn + 1} / ${QUESTIONS.length}`);
  const eyebrow = ({ listening: "Listening", heard: "Got it", matching: "Matching" } as Record<string, string>)[phase] ?? `Question ${turn + 1} of ${QUESTIONS.length}`;
  const question = phase === "matching" ? "Reading what you shared" : QUESTIONS[turn];
  const transcript = phase === "ask" ? (turn === 0 ? "Talk for as long as you like. A minute is plenty." : "")
    : phase === "listening" ? (text ? `“${text}` : "")
    : phase === "heard" ? (text ? `“${text}”` : "")
    : "Pulling out what matters, then checking it against every listing.";

  return (
    <main className="conversation">
      <div className="dome" ref={dome} aria-hidden="true">
        <div className="orb" ref={orb}>
          <div className="halo-wrap" ref={haloWrap}><div className="halo halo-drift" ref={halo} /></div>
          <div className="sky sky-idle" ref={sky} />
        </div>
      </div>

      <p className="eyebrow">{eyebrow}</p>
      <h1 className="question" aria-live="polite">{question}</h1>
      <p className="transcript" aria-live="polite">{transcript}</p>

      {(phase === "ask" || phase === "listening") && (
        <div className="controls">
          <button type="button" className="talk-btn lift" aria-pressed={phase === "listening"} onClick={() => (phase === "ask" ? start() : stop())}>
            <MicIcon size={18} />
            <span>{phase === "listening" ? "I'm done" : "Start talking"}</span>
          </button>
          <p className="hint">or hold <kbd>Space</kbd> to talk</p>
          {note && <p className="hint small">{note}</p>}
        </div>
      )}
      {aside && phase !== "matching" && <div className="talk-aside">{aside}</div>}
    </main>
  );
}
