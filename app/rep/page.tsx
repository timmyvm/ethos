"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { RepResult } from "@/components/RepResult";
import { StreakCelebration } from "@/components/StreakCelebration";
import { fetchReps } from "@/lib/client-data";
import { computeStreak } from "@/lib/streak";
import { DRILLS, todaysDrill } from "@/lib/drills";
import { ensureSession } from "@/lib/supabase-browser";
import type { AnalyzeResponse } from "@/app/api/analyze/route";

const MAX_SECONDS = 90;
const METER_BARS = 36;

/** Haptics — opt-out lives in settings; silently absent on desktop. */
function buzz(pattern: number | number[]) {
  try {
    const raw = localStorage.getItem("ethos.prefs");
    if (raw && JSON.parse(raw).haptics === false) return;
    navigator.vibrate?.(pattern);
  } catch {}
}

type Phase = "idle" | "recording" | "analyzing" | "results" | "error";

export default function RepPage() {
  return (
    <Suspense fallback={<main className="px-5 pt-7" />}>
      <RepScreen />
    </Suspense>
  );
}

function RepScreen() {
  const searchParams = useSearchParams();
  // The path can request a specific lesson; otherwise the daily rotation.
  const lessonId = searchParams.get("lesson");
  const drill = DRILLS.find((d) => d.id === lessonId) ?? todaysDrill();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array(METER_BARS).fill(0.05));
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<number | null>(null);

  const recRef = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    ctx: AudioContext;
    raf: number;
    chunks: Blob[];
  } | null>(null);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const drillRef = useRef(drill);
  drillRef.current = drill;

  const stopRep = useCallback(async () => {
    const r = recRef.current;
    if (!r || phaseRef.current !== "recording") return;
    buzz([20, 40, 20]);
    setPhase("analyzing");

    const blob = await new Promise<Blob>((resolve) => {
      r.recorder.onstop = () =>
        resolve(new Blob(r.chunks, { type: r.recorder.mimeType }));
      r.recorder.stop();
    });

    cancelAnimationFrame(r.raf);
    r.stream.getTracks().forEach((t) => t.stop());
    void r.ctx.close().catch(() => {});
    recRef.current = null;

    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      form.append("audio", blob, `rep.${ext}`);
      form.append("lessonId", drillRef.current.id);
      // Anonymous-first (DECISIONS #15): attribute the rep if a session
      // exists or can be minted; never block the rep on auth.
      const token = await ensureSession();
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Analysis failed (${res.status})`);
      setResult(data as AnalyzeResponse);
      setPhase("results");
      // Streak is derived from stored reps, so read it back rather than
      // guessing — a rep that failed to persist shouldn't celebrate.
      fetchReps()
        .then((reps) => {
          const s = computeStreak(reps.map((r) => new Date(r.created_at)));
          if (s.current > 0) setCelebrate(s.current);
        })
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
      setPhase("error");
    }
  }, []);

  const startRep = useCallback(async () => {
    setError(null);
    setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : undefined;
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined
      );
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.start(1000);

      // Level meter. iOS Safari creates AudioContexts suspended even
      // inside a user gesture — resume explicitly.
      const ctx = new AudioContext();
      void ctx.resume().catch(() => {});
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let rms = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          rms += v * v;
        }
        rms = Math.sqrt(rms / data.length);
        setLevels((prev) => [...prev.slice(1), Math.min(1, rms * 4)]);
        if (recRef.current) {
          recRef.current.raf = requestAnimationFrame(tick);
        }
      };

      recRef.current = { recorder, stream, ctx, raf: 0, chunks };
      recRef.current.raf = requestAnimationFrame(tick);
      buzz(30);
      setPhase("recording");
    } catch {
      setError(
        "Mic unavailable. Check browser permissions and try again."
      );
      setPhase("error");
    }
  }, []);

  // Timer + 90s hard cap
  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) void stopRep();
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, stopRep]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const r = recRef.current;
      if (r) {
        try {
          r.recorder.stop();
        } catch {}
        cancelAnimationFrame(r.raf);
        r.stream.getTracks().forEach((t) => t.stop());
        void r.ctx.close().catch(() => {});
      }
    };
  }, []);

  if (phase === "results" && result) {
    return (
      <>
        <Results result={result} />
        {celebrate !== null && (
          <StreakCelebration
            streak={celebrate}
            onDone={() => setCelebrate(null)}
          />
        )}
      </>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-8 pt-7">
      <Link href="/" className="self-start text-sm text-stone-500">
        ← back
      </Link>
      <div className="label-data mt-6">{drill.unit}</div>
      <h1 className="font-display mt-1.5 text-2xl font-bold">{drill.title}</h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-stone-500">
        {drill.prompt}
      </p>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        {phase === "recording" && (
          <>
            <div
              className={`font-display text-[54px] font-bold leading-none ${
                MAX_SECONDS - seconds <= 10 ? "text-terracotta-600" : ""
              }`}
            >
              {fmt(seconds)}
              <span className="font-body text-[15px] font-medium text-stone-500">
                {" "}
                / 1:30
              </span>
            </div>
            <div className="flex h-12 items-end gap-[3px]" aria-hidden>
              {levels.map((v, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-stone-400"
                  style={{ height: `${Math.max(8, v * 100)}%` }}
                />
              ))}
            </div>
          </>
        )}

        {phase === "analyzing" && (
          <div className="text-center">
            <div className="font-display text-xl font-bold">
              Scoring the rep…
            </div>
            <p className="mt-2 text-sm text-stone-500">
              Transcribing, counting, measuring silence.
            </p>
            <p className="mt-1 text-[12.5px] text-stone-400">
              Ten seconds or so. The numbers are computed, not guessed.
            </p>
          </div>
        )}

        {phase === "recording" && (
          <Image
            src="/demos-listening.webp"
            alt=""
            width={84}
            height={84}
            className="w-[84px] opacity-90"
          />
        )}

        {phase === "idle" && (
          <p className="max-w-[260px] text-center text-[13.5px] text-stone-500">
            Aim for 60–90 seconds. Pauses are allowed — they&apos;re scored in
            your favor.
          </p>
        )}

        {phase === "error" && (
          <div className="w-full rounded-[18px] border border-black/5 bg-white p-5 text-center">
            <div className="font-semibold">Rep didn&apos;t score.</div>
            <p className="mt-1.5 text-sm text-stone-500">{error}</p>
          </div>
        )}

        {phase !== "analyzing" && (
          <button
            onClick={phase === "recording" ? () => void stopRep() : () => void startRep()}
            className={`h-24 w-24 rounded-full text-[15px] font-bold text-cream transition-colors ${
              phase === "recording"
                ? "bg-stone-900 ring-[10px] ring-terracotta-100"
                : "bg-terracotta-500 hover:bg-terracotta-600"
            }`}
          >
            {phase === "recording" ? "Stop" : "Rec"}
          </button>
        )}
      </div>
    </main>
  );
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Results — the shared view, so a fresh rep and a logged rep are
// literally the same screen.
function Results({ result }: { result: AnalyzeResponse }) {
  return (
    <main className="px-5 pb-10 pt-7">
      <div className="label-data">Rep complete</div>
      <RepResult result={result} />
      <Link
        href="/"
        className="mt-6 block w-full rounded-[14px] bg-terracotta-500 px-6 py-4 text-center text-base font-semibold text-cream transition-colors hover:bg-terracotta-600"
      >
        Done — same time tomorrow
      </Link>
    </main>
  );
}
