"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import RoomArt, { type RoomArtProps } from "@/components/room/RoomArt";

/**
 * The room's story page (#475; the workbench pattern, DECISIONS #255).
 * The art alone, full screen, every state a query away, so the camera
 * can photograph each mood and tilt and a person can tilt a phone at it.
 *
 *   ?mood=idle|listening|unimpressed|verdict
 *   &who=interviewer|you   &tx=-1..1 &ty=-1..1   &rm=1 (reduced motion)
 *   &say=Sell me this pen.   &ui=0 (no controls)   &live=1 (tilt the phone)
 *
 * The bubble here is a stand-in for the flow's, to judge where it sits.
 */

const MOODS: RoomArtProps["mood"][] = ["idle", "listening", "unimpressed", "verdict"];
const LINES = [
  "Sell me this pen.",
  "What are you even saying?",
  "Why would I need this pen?",
  "I'm sorry, but you're not who we're looking for.",
];

function num(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const bubbleStyle: CSSProperties = {
  position: "relative",
  background: "#ffffff",
  color: "#17142b",
  borderRadius: 20,
  padding: "12px 16px",
  fontFamily: "var(--font-figtree), system-ui, sans-serif",
  fontSize: 20,
  lineHeight: 1.3,
  boxShadow: "0 8px 24px rgba(8,6,26,0.35)",
};

const tailStyle: CSSProperties = {
  position: "absolute",
  left: -6,
  bottom: -2,
  width: 26,
  height: 22,
  background: "#ffffff",
  clipPath: "polygon(0 100%, 100% 0, 100% 70%)",
};

export default function RoomBench() {
  const [mood, setMood] = useState<RoomArtProps["mood"]>("idle");
  const [who, setWho] = useState<RoomArtProps["who"]>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [rm, setRm] = useState(false);
  const [say, setSay] = useState<string | null>(null);
  const [ui, setUi] = useState(true);
  const [live, setLive] = useState(false);
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const m = q.get("mood") as RoomArtProps["mood"] | null;
    if (m && MOODS.includes(m)) setMood(m);
    const w = q.get("who");
    if (w === "interviewer" || w === "you") setWho(w);
    setTilt({ x: num(q.get("tx")), y: num(q.get("ty")) });
    setRm(q.get("rm") === "1");
    setSay(q.get("say"));
    setUi(q.get("ui") !== "0");
    setLive(q.get("live") === "1");
  }, []);

  /* Live: the phone's tilt, or the pointer on a desktop, smoothed. */
  useEffect(() => {
    if (!live) return;
    let raf = 0;
    const cur = { x: 0, y: 0 };
    const onTilt = (e: DeviceOrientationEvent) => {
      target.current = {
        x: Math.max(-1, Math.min(1, (e.gamma ?? 0) / 25)),
        y: Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 25)),
      };
    };
    const onMove = (e: PointerEvent) => {
      target.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    };
    const step = () => {
      cur.x += (target.current.x - cur.x) * 0.12;
      cur.y += (target.current.y - cur.y) * 0.12;
      setTilt({ x: cur.x, y: cur.y });
      raf = requestAnimationFrame(step);
    };
    window.addEventListener("deviceorientation", onTilt);
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("deviceorientation", onTilt);
      window.removeEventListener("pointermove", onMove);
    };
  }, [live]);

  const bubble = say ? (
    <div style={bubbleStyle}>
      <span aria-hidden="true" style={tailStyle} />
      {say}
    </div>
  ) : undefined;

  return (
    <main style={{ position: "fixed", inset: 0, background: "#000" }}>
      <RoomArt tilt={tilt} who={who} mood={mood} reduceMotion={rm} bubble={bubble} />
      {ui ? (
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: "calc(12px + env(safe-area-inset-bottom))",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            padding: 8,
            borderRadius: 16,
            background: "rgba(10,8,24,0.72)",
            color: "#fff",
            fontSize: 13,
          }}
        >
          {MOODS.map((m) => (
            <button key={m} type="button" onClick={() => setMood(m)} style={chip(m === mood)}>
              {m}
            </button>
          ))}
          <button type="button" onClick={() => setWho(who === "interviewer" ? null : "interviewer")} style={chip(who === "interviewer")}>
            talking
          </button>
          <button
            type="button"
            onClick={() => setSay(say ? null : LINES[MOODS.indexOf(mood)] ?? LINES[0])}
            style={chip(Boolean(say))}
          >
            bubble
          </button>
          <button
            type="button"
            onClick={() => {
              /* An iPhone asks for motion only inside a tap. */
              const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
              if (!live && typeof D.requestPermission === "function") D.requestPermission().catch(() => {});
              setLive(!live);
            }}
            style={chip(live)}
          >
            live tilt
          </button>
          <button type="button" onClick={() => setRm(!rm)} style={chip(rm)}>
            still
          </button>
        </div>
      ) : null}
    </main>
  );
}

function chip(on: boolean): CSSProperties {
  return {
    minHeight: 44,
    padding: "0 12px",
    borderRadius: 999,
    background: on ? "#ffffff" : "rgba(255,255,255,0.12)",
    color: on ? "#17142b" : "#ffffff",
    fontWeight: 600,
  };
}
