import { useState, useEffect, useRef } from "react";

// ─── Brand tokens (brand.md) ─────────────────────────────────────
const C = {
  t500: "#E76F51", t600: "#D5563A", t700: "#B2432C", t900: "#752C1F",
  t100: "#FBE5DC", t50: "#FDF3EF",
  a500: "#F59E0B", a400: "#FBBF24",
  cream: "#FAF7F2", sand: "#F5F0E8",
  s300: "#D6D3D1", s500: "#78716C", s800: "#292524", s900: "#1C1917",
};
const DEMOS_IMG =
  "https://d8j0ntlcm91z4.cloudfront.net/user_3B6GJ2qFPzJeS439soyfKOK3IXx/hf_20260809_020418_7a7b9582-7512-4f7b-ab25-bd2f3669cd9b.png";

const FILLERS = ["um", "uh", "like", "you know", "sort of", "kind of", "basically", "actually", "literally"];

// ─── The path (mechanics.md: units → lessons → stars) ────────────
const INITIAL_UNITS = [
  { id: "filler", name: "Filler Elimination", icon: "✂️", lessons: [
    { id: "f1", title: "The baseline rep", prompt: "Introduce yourself and what you're building — 60 seconds, no notes.", stars: 3 },
    { id: "f2", title: "Kill 'like'", prompt: "Explain your favorite app to someone who's never used a phone.", stars: 2 },
    { id: "f3", title: "Silence beats 'um'", prompt: "Describe your morning routine. Every time you'd say a filler — pause instead.", stars: 0 },
  ]},
  { id: "pace", name: "Pace Control", icon: "⏱", lessons: [
    { id: "p1", title: "The 140 zone", prompt: "Tell the story of how you learned to code, at a walking pace.", stars: 0 },
    { id: "p2", title: "Slow is smooth", prompt: "Explain compound interest to a 10-year-old. Slower than feels natural.", stars: 0 },
  ]},
  { id: "pause", name: "The Pause", icon: "🤫", lessons: [
    { id: "h1", title: "Hold one second", prompt: "Argue for your most controversial food opinion. Pause a full second before each new point.", stars: 0 },
    { id: "h2", title: "Land the ending", prompt: "Pitch your app in 45 seconds. End on a sentence, then hold the silence.", stars: 0 },
  ]},
  { id: "boss", name: "Cold Topic", icon: "🔥", boss: true, lessons: [
    { id: "b1", title: "Boss: unknown territory", prompt: "You'll get a topic you've never studied. 4 minutes to research, 90 seconds to explain it.", stars: 0 },
  ]},
];

const COACH_LINES = [
  (r) => `${r.fillers} fillers. ${r.prevFillers ? `Down from ${r.prevFillers}.` : "That's your baseline."} Tomorrow: kill "${r.topFiller || "um"}."`,
  (r) => `${r.heldPauses} held pause${r.heldPauses === 1 ? "" : "s"}. Silence is starting to work for you.`,
  (r) => `WPM ${r.wpm}. ${r.wpm > 165 ? "You're sprinting. Walk." : r.wpm < 125 ? "Room to pick up pace." : "In the zone."}`,
];

// ─── Demo rep (fallback when mic is unavailable) ─────────────────
const DEMO_TRANSCRIPT =
  "so um my name is tim and i'm like building an app called ethos which is um basically a gym for speaking " +
  "the idea is you do like one rep a day just sixty seconds and it um measures your fillers your pace and " +
  "actually how you use silence which is kind of the thing nobody else scores you know";

export default function EthosMVP() {
  const [screen, setScreen] = useState("home"); // home | rep | results | path
  const [units, setUnits] = useState(INITIAL_UNITS);
  const [streak, setStreak] = useState(12);
  const [activeLesson, setActiveLesson] = useState(null);
  const [recState, setRecState] = useState("idle"); // idle | recording | analyzing
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState(null);
  const [paywall, setPaywall] = useState(false);
  const [liveMic, setLiveMic] = useState(null); // null unknown, true, false
  const recRef = useRef({});

  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&family=Space+Mono&display=swap";
    document.head.appendChild(l);
    return () => document.head.removeChild(l);
  }, []);

  useEffect(() => {
    let t;
    if (recState === "recording") t = setInterval(() => setSeconds((s) => {
      if (s >= 89) { stopRep(); return s; }
      return s + 1;
    }), 1000);
    return () => clearInterval(t);
  }, [recState]);

  // ─── Analysis engine (deterministic layer, mechanics.md) ───────
  function analyze(transcript, durationSec, pauseSegs) {
    const words = transcript.trim().split(/\s+/).filter(Boolean);
    const wpm = Math.round(words.length / (durationSec / 60)) || 0;
    let fillers = 0; const counts = {};
    const lower = " " + transcript.toLowerCase() + " ";
    FILLERS.forEach((f) => {
      const m = lower.split(" " + f + " ").length - 1;
      if (m > 0) { counts[f] = m; fillers += m; }
    });
    const topFiller = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const heldPauses = pauseSegs.filter((p) => p.type === "pause" && p.len >= 0.8).length;
    const fpm = fillers / (durationSec / 60);
    const stars = fpm < 3 ? 3 : fpm < 6 ? 2 : 1;
    return { wpm, fillers, topFiller, heldPauses, stars, durationSec, pauseSegs, counts };
  }

  function demoPauses() {
    const segs = [];
    for (let i = 0; i < 9; i++) {
      segs.push({ type: "speech", len: 3 + Math.random() * 4 });
      if (i === 2 || i === 5 || i === 7) segs.push({ type: "pause", len: 0.8 + Math.random() * 1.2 });
    }
    return segs;
  }

  async function startRep() {
    setSeconds(0);
    // try real mic + speech recognition
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) throw new Error("no SR");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 2048; src.connect(an);
      const data = new Uint8Array(an.fftSize);
      const segs = []; let cur = null; let lastT = performance.now();
      const poll = setInterval(() => {
        an.getByteTimeDomainData(data);
        let rms = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; rms += v * v; }
        rms = Math.sqrt(rms / data.length);
        const now = performance.now(); const dt = (now - lastT) / 1000; lastT = now;
        const kind = rms < 0.02 ? "pause" : "speech";
        if (cur && cur.type === kind) cur.len += dt;
        else { cur = { type: kind, len: dt }; segs.push(cur); }
      }, 100);
      const rec = new SR();
      rec.continuous = true; rec.interimResults = true; rec.lang = "en-AU";
      let transcript = "";
      rec.onresult = (e) => {
        transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ");
        recRef.current.transcript = transcript;
      };
      rec.start();
      recRef.current = { stream, ctx, poll, rec, segs, transcript: "", live: true, start: Date.now() };
      setLiveMic(true);
    } catch {
      recRef.current = { live: false, start: Date.now() };
      setLiveMic(false);
    }
    setRecState("recording");
  }

  function stopRep() {
    const r = recRef.current;
    setRecState("analyzing");
    const dur = Math.max(8, Math.round((Date.now() - r.start) / 1000));
    setTimeout(() => {
      let res;
      if (r.live) {
        try { r.rec.stop(); clearInterval(r.poll); r.stream.getTracks().forEach((t) => t.stop()); r.ctx.close(); } catch {}
        const tx = (r.transcript || "").trim();
        res = analyze(tx || DEMO_TRANSCRIPT, dur, r.segs?.length > 3 ? r.segs : demoPauses());
        res.live = !!tx;
      } else {
        res = analyze(DEMO_TRANSCRIPT, 58, demoPauses());
        res.live = false;
      }
      res.prevFillers = res.fillers + 3 + Math.floor(Math.random() * 5);
      // award stars
      if (activeLesson) {
        setUnits((us) => us.map((u) => ({
          ...u,
          lessons: u.lessons.map((l) => l.id === activeLesson.id ? { ...l, stars: Math.max(l.stars, res.stars) } : l),
        })));
      }
      setStreak((s) => s + (result ? 0 : 1));
      setResult(res);
      setRecState("idle");
      setScreen("results");
    }, 1400);
  }

  const totalStars = units.flatMap((u) => u.lessons).reduce((a, l) => a + l.stars, 0);
  const nextLesson = units.flatMap((u) => u.lessons.map((l) => ({ ...l, unit: u }))).find((l) => l.stars === 0 && !l.unit.boss);

  // ─── shared UI bits ────────────────────────────────────────────
  const S = {
    page: { minHeight: "100vh", background: C.cream, color: C.s800, fontFamily: "'Inter', sans-serif", maxWidth: 430, margin: "0 auto", position: "relative", paddingBottom: 84 },
    grotesk: { fontFamily: "'Space Grotesk', sans-serif" },
    mono: { fontFamily: "'Space Mono', monospace", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: C.s500 },
    card: { background: "#fff", border: "1px solid rgba(0,0,0,.06)", borderRadius: 18, padding: 20 },
    cta: { background: C.t500, color: "#fff", border: "none", borderRadius: 14, padding: "16px 24px", fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 16, width: "100%", cursor: "pointer" },
    chip: { display: "inline-flex", alignItems: "center", gap: 6, background: C.sand, borderRadius: 99, padding: "7px 13px", fontSize: 13, fontWeight: 600 },
  };

  const Nav = () => (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#fff", borderTop: `1px solid ${C.sand}`, display: "flex", zIndex: 20 }}>
      {[["home", "Today"], ["path", "Path"]].map(([k, label]) => (
        <button key={k} onClick={() => setScreen(k)} style={{ flex: 1, padding: "14px 0 18px", border: "none", background: "none", cursor: "pointer", fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 13, color: screen === k ? C.t600 : C.s500 }}>
          {label}
        </button>
      ))}
    </div>
  );

  const Stars = ({ n, size = 15 }) => (
    <span style={{ fontSize: size, letterSpacing: 1 }}>
      {[1, 2, 3].map((i) => <span key={i} style={{ color: i <= n ? C.a500 : C.s300 }}>★</span>)}
    </span>
  );

  // ─── HOME — "The Floor" layout ─────────────────────────────────
  if (screen === "home") return (
    <div style={S.page}>
      <div style={{ padding: "26px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ ...S.grotesk, fontWeight: 700, fontSize: 22 }}>ethos</div>
          <span style={S.chip}><span style={{ color: C.a500 }}>🔥</span> {streak}-day streak</span>
        </div>

        <div style={{ ...S.mono, marginTop: 30 }}>Today's rep · {nextLesson ? nextLesson.unit.name : "Free rep"}</div>
        <div style={{ ...S.card, marginTop: 10, position: "relative", overflow: "hidden" }}>
          <div style={{ ...S.grotesk, fontWeight: 700, fontSize: 22, lineHeight: 1.25, maxWidth: "78%" }}>
            {nextLesson ? nextLesson.title : "The baseline rep"}
          </div>
          <p style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.55, color: C.s500, maxWidth: "72%" }}>
            {nextLesson ? nextLesson.prompt : "Introduce yourself and what you're building — 60 seconds."}
          </p>
          <div style={{ marginTop: 18, position: "relative", zIndex: 2 }}>
            <button style={S.cta} onClick={() => { setActiveLesson(nextLesson); setScreen("rep"); }}>
              Take the floor
            </button>
          </div>
          <img src={DEMOS_IMG} alt="Demos" style={{ position: "absolute", right: -28, bottom: -34, width: 150, opacity: 0.97, pointerEvents: "none" }} />
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <div style={{ ...S.card, flex: 1, padding: 16 }}>
            <div style={S.mono}>Stars</div>
            <div style={{ ...S.grotesk, fontWeight: 700, fontSize: 30, marginTop: 2 }}>{totalStars}<span style={{ fontSize: 15, color: C.s500 }}> / {units.flatMap(u=>u.lessons).length * 3}</span></div>
          </div>
          <div style={{ ...S.card, flex: 1, padding: 16 }}>
            <div style={S.mono}>Last rep</div>
            <div style={{ ...S.grotesk, fontWeight: 700, fontSize: 30, marginTop: 2 }}>{result ? result.fillers : "—"}<span style={{ fontSize: 15, color: C.s500 }}> fillers</span></div>
          </div>
        </div>

        <button onClick={() => setPaywall(true)} style={{ ...S.card, width: "100%", marginTop: 14, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, border: `1px solid ${C.t100}`, background: C.t50 }}>
          <span style={{ fontSize: 22 }}>🔥</span>
          <span>
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>Sunday boss: Cold Topic</span>
            <span style={{ display: "block", fontSize: 12.5, color: C.s500 }}>A topic you've never studied. 4 min research, 90s to explain.</span>
          </span>
          <span style={{ marginLeft: "auto", fontSize: 13 }}>🔒</span>
        </button>
      </div>
      <Nav />
      {paywall && <Paywall close={() => setPaywall(false)} S={S} />}
    </div>
  );

  // ─── REP — record screen ───────────────────────────────────────
  if (screen === "rep") return (
    <div style={S.page}>
      <div style={{ padding: "26px 20px", display: "flex", flexDirection: "column", minHeight: "92vh" }}>
        <button onClick={() => { setRecState("idle"); setScreen("home"); }} style={{ background: "none", border: "none", color: C.s500, fontSize: 14, cursor: "pointer", alignSelf: "flex-start", padding: 0 }}>← back</button>
        <div style={{ ...S.mono, marginTop: 22 }}>{activeLesson ? activeLesson.unit?.name || "Rep" : "Rep"}</div>
        <div style={{ ...S.grotesk, fontWeight: 700, fontSize: 24, marginTop: 6 }}>{activeLesson?.title || "The baseline rep"}</div>
        <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.6, color: C.s500 }}>{activeLesson?.prompt || "Introduce yourself and what you're building — 60 seconds, no notes."}</p>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
          {recState === "recording" && (
            <div style={{ ...S.grotesk, fontWeight: 700, fontSize: 54 }}>
              0:{String(seconds).padStart(2, "0")}
              <span style={{ fontSize: 15, color: C.s500, fontFamily: "'Inter',sans-serif", fontWeight: 500 }}> / 1:30</span>
            </div>
          )}
          {recState === "analyzing" && <div style={{ ...S.grotesk, fontSize: 20, fontWeight: 700 }}>Scoring the rep…</div>}
          {recState === "idle" && (
            <p style={{ fontSize: 13.5, color: C.s500, textAlign: "center", maxWidth: 260 }}>
              Aim for 60–90 seconds. Pauses are allowed — they're scored in your favor.
            </p>
          )}
          <button
            onClick={recState === "recording" ? stopRep : startRep}
            disabled={recState === "analyzing"}
            style={{
              width: 96, height: 96, borderRadius: "50%", border: "none", cursor: "pointer",
              background: recState === "recording" ? C.s900 : C.t500,
              color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "'Inter',sans-serif",
              boxShadow: recState === "recording" ? `0 0 0 10px ${C.t100}` : "none",
            }}>
            {recState === "recording" ? "Stop" : recState === "analyzing" ? "…" : "Rec"}
          </button>
          {liveMic === false && recState !== "idle" && (
            <div style={{ ...S.mono, color: C.a500 }}>demo mode — mic unavailable here</div>
          )}
        </div>
      </div>
    </div>
  );

  // ─── RESULTS — Elevate-style metrics + Ethos pause bar ─────────
  if (screen === "results" && result) {
    const coach = COACH_LINES[result.heldPauses >= 3 ? 1 : result.wpm > 165 || result.wpm < 125 ? 2 : 0](result);
    return (
      <div style={S.page}>
        <div style={{ padding: "26px 20px" }}>
          <div style={S.mono}>Rep complete {result.live ? "· live audio" : "· demo data"}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 12 }}>
            <div style={{ ...S.grotesk, fontWeight: 700, fontSize: 64, lineHeight: 1 }}>{result.fillers}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>fillers</div>
              <div style={{ fontSize: 13, color: C.t600, fontWeight: 600 }}>▼ from {result.prevFillers} last rep</div>
            </div>
            <div style={{ marginLeft: "auto" }}><Stars n={result.stars} size={22} /></div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
            <div style={{ ...S.card, flex: 1, padding: 14 }}>
              <div style={S.mono}>WPM</div>
              <div style={{ ...S.grotesk, fontWeight: 700, fontSize: 26 }}>{result.wpm}</div>
              <div style={{ fontSize: 11.5, color: C.s500 }}>{result.wpm >= 125 && result.wpm <= 165 ? "in the zone" : result.wpm > 165 ? "sprinting" : "strolling"}</div>
            </div>
            <div style={{ ...S.card, flex: 1, padding: 14 }}>
              <div style={S.mono}>Held pauses</div>
              <div style={{ ...S.grotesk, fontWeight: 700, fontSize: 26, color: C.a500 }}>{result.heldPauses}</div>
              <div style={{ fontSize: 11.5, color: C.s500 }}>≥0.8s, on purpose</div>
            </div>
            <div style={{ ...S.card, flex: 1, padding: 14 }}>
              <div style={S.mono}>Length</div>
              <div style={{ ...S.grotesk, fontWeight: 700, fontSize: 26 }}>{result.durationSec}s</div>
              <div style={{ fontSize: 11.5, color: C.s500 }}>target 60–90</div>
            </div>
          </div>

          {/* Signature: the pause bar */}
          <div style={{ background: C.s900, borderRadius: 16, padding: "18px 16px 14px", marginTop: 16 }}>
            <div style={{ ...S.mono, color: "#A8A29E" }}>Pause bar · amber = silence you held</div>
            <div style={{ display: "flex", alignItems: "center", gap: 3, height: 54, marginTop: 12 }}>
              {result.pauseSegs.slice(0, 40).map((s, i) =>
                s.type === "pause" ? (
                  s.len >= 0.8
                    ? <span key={i} style={{ width: Math.min(34, 12 + s.len * 10), height: 12, borderRadius: 6, background: C.a500, flexShrink: 0 }} />
                    : <span key={i} style={{ width: 6, height: 6, borderRadius: 3, background: "#57534E", flexShrink: 0 }} />
                ) : (
                  <span key={i} style={{ width: 5, height: 14 + Math.min(36, s.len * 7), borderRadius: 3, background: "#57534E", flexShrink: 0 }} />
                )
              )}
            </div>
          </div>

          {/* Coach line — Demos, coach register */}
          <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "flex-end" }}>
            <img src={DEMOS_IMG} alt="Demos" style={{ width: 62, borderRadius: 14, background: "#fff", border: `1px solid ${C.sand}` }} />
            <div style={{ background: C.t50, borderRadius: "14px 14px 14px 4px", padding: "12px 15px", fontSize: 14, lineHeight: 1.5 }}>
              <div style={{ ...S.mono, color: C.t600, marginBottom: 3 }}>Demos</div>
              {coach}
            </div>
          </div>

          <button style={{ ...S.cta, marginTop: 20 }} onClick={() => setScreen("home")}>Done — same time tomorrow</button>
        </div>
        <Nav />
      </div>
    );
  }

  // ─── PATH — Duolingo-style ─────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={{ padding: "26px 20px" }}>
        <div style={{ ...S.grotesk, fontWeight: 700, fontSize: 24 }}>The path</div>
        <p style={{ fontSize: 13.5, color: C.s500, marginTop: 4 }}>Stars are earned by numbers, never by showing up.</p>
        {units.map((u) => (
          <div key={u.id} style={{ marginTop: 22 }}>
            <div style={S.mono}>{u.icon} {u.name}{u.boss ? " · weekly boss" : ""}</div>
            {u.lessons.map((l, i) => {
              const locked = u.boss;
              const isNext = nextLesson && l.id === nextLesson.id;
              return (
                <button key={l.id}
                  onClick={() => locked ? setPaywall(true) : (setActiveLesson({ ...l, unit: u }), setScreen("rep"))}
                  style={{
                    ...S.card, width: "100%", marginTop: 10, display: "flex", alignItems: "center", gap: 14,
                    cursor: "pointer", textAlign: "left", padding: 16,
                    border: isNext ? `2px solid ${C.t500}` : "1px solid rgba(0,0,0,.06)",
                    opacity: locked ? 0.85 : 1,
                  }}>
                  <span style={{
                    width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                    background: l.stars > 0 ? C.t50 : C.sand, fontSize: 17,
                  }}>{locked ? "🔒" : l.stars > 0 ? "✓" : i + 1}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 14.5, display: "block" }}>{l.title}</span>
                    {isNext && <span style={{ fontSize: 12, color: C.t600, fontWeight: 600 }}>up next</span>}
                    {locked && <span style={{ fontSize: 12, color: C.s500 }}>Premium boss mode</span>}
                  </span>
                  <Stars n={l.stars} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <Nav />
      {paywall && <Paywall close={() => setPaywall(false)} S={S} />}
    </div>
  );
}

// ─── Paywall (mechanics.md: annual pushed, after value not install) ──
function Paywall({ close, S }) {
  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.cream, borderRadius: "22px 22px 0 0", padding: "26px 20px 30px", width: "100%", maxWidth: 430 }}>
        <div style={{ ...S.grotesk, fontWeight: 700, fontSize: 22 }}>Ethos Premium</div>
        <p style={{ fontSize: 14, color: C.s500, marginTop: 6, lineHeight: 1.55 }}>
          Boss modes (Cold Topic, Debate, Hostile Q&A), full pause analytics, day-1 vs day-30 cards, unlimited retries.
        </p>
        <div style={{ ...S.card, marginTop: 16, border: `2px solid ${C.t500}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Annual</div>
            <div style={{ fontSize: 12.5, color: C.s500 }}>A$6.67/mo, billed A$79.99</div>
          </div>
          <span style={{ ...S.mono, color: C.t600 }}>save 55%</span>
        </div>
        <div style={{ ...S.card, marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Monthly</div>
            <div style={{ fontSize: 12.5, color: C.s500 }}>A$14.99/mo</div>
          </div>
        </div>
        <button style={{ ...S.cta, marginTop: 16 }} onClick={close}>Start with annual</button>
        <button onClick={close} style={{ width: "100%", background: "none", border: "none", color: C.s500, fontSize: 13.5, marginTop: 12, cursor: "pointer" }}>Not yet</button>
      </div>
    </div>
  );
}
