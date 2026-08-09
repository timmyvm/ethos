"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PauseBar } from "@/components/PauseBar";
import { Stars } from "@/components/Stars";
import { todaysDrill } from "@/lib/drills";
import type { AnalyzeResponse } from "@/app/api/analyze/route";

const MAX_SECONDS = 90;
const METER_BARS = 36;

type Phase = "idle" | "recording" | "analyzing" | "results" | "error";

export default function RepPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array(METER_BARS).fill(0.05));
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    ctx: AudioContext;
    raf: number;
    chunks: Blob[];
  } | null>(null);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const stopRep = useCallback(async () => {
    const r = recRef.current;
    if (!r || phaseRef.current !== "recording") return;
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
      form.append("lessonId", todaysDrill().id);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Analysis failed (${res.status})`);
      setResult(data as AnalyzeResponse);
      setPhase("results");
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

      // Level meter
      const ctx = new AudioContext();
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

  if (phase === "results" && result) return <Results result={result} />;

  const drill = todaysDrill();

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
            <div className="font-display text-[54px] font-bold leading-none">
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
          </div>
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

// ─── Results — ported from prototype: numbers are the hero ─────────
function Results({ result }: { result: AnalyzeResponse }) {
  const { metrics: m, coach } = result;
  const zone =
    m.wpm >= 125 && m.wpm <= 165
      ? "in the zone"
      : m.wpm > 165
        ? "sprinting"
        : "strolling";

  // Coach layer is best-effort; the deterministic fallback keeps the
  // register (short, numbers, no hype) when it's unavailable.
  const coachLine =
    coach?.coachLine ??
    `${m.fillerCount} filler${m.fillerCount === 1 ? "" : "s"} in ${Math.round(
      m.durationS
    )}s.${m.topFiller ? ` Tomorrow: kill "${m.topFiller}."` : " Clean rep."}`;

  return (
    <main className="px-5 pb-10 pt-7">
      <div className="label-data">Rep complete</div>

      <div className="mt-3 flex items-baseline gap-3.5">
        <div className="font-display text-[64px] font-bold leading-none">
          {m.fillerCount}
        </div>
        <div>
          <div className="text-[15px] font-semibold">
            filler{m.fillerCount === 1 ? "" : "s"}
          </div>
          <div className="text-[13px] text-stone-500">
            {m.fillersPerMin}/min
          </div>
        </div>
        <div className="ml-auto">
          <Stars n={m.stars} size={22} />
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <Metric label="WPM" value={String(m.wpm)} note={zone} />
        <Metric
          label="Held pauses"
          value={String(m.heldPauses)}
          note="≥0.8s, on purpose"
          amber
        />
        <Metric
          label="Length"
          value={`${Math.round(m.durationS)}s`}
          note="target 60–90"
        />
      </div>

      <div className="mt-4">
        <PauseBar pauses={m.pauses} durationS={m.durationS} />
      </div>

      <div className="mt-4 flex items-end gap-3">
        <Image
          src="/demos.webp"
          alt="Demos"
          width={62}
          height={62}
          className="w-[62px] rounded-[14px] border border-sand bg-white"
        />
        <div className="rounded-[14px] rounded-bl-[4px] bg-terracotta-50 px-4 py-3 text-sm leading-relaxed">
          <div className="label-data !text-terracotta-600 mb-0.5">Demos</div>
          {coachLine}
          {coach?.focus && (
            <div className="mt-1.5 text-[13px] text-stone-500">
              Tomorrow&apos;s focus: {coach.focus}
            </div>
          )}
        </div>
      </div>

      {coach?.supply && (
        <div className="mt-4 rounded-[18px] border border-black/5 bg-white p-5">
          <div className="label-data">Supply · one upgrade, yours to keep</div>
          <div className="mt-2.5 flex items-center gap-3 text-[15px]">
            <span className="text-stone-500 line-through">
              {coach.supply.original}
            </span>
            <span aria-hidden>→</span>
            <span className="font-semibold">{coach.supply.upgrade}</span>
          </div>
          {coach.supply.note && (
            <p className="mt-1.5 text-[13px] text-stone-500">
              {coach.supply.note}
            </p>
          )}
        </div>
      )}

      <details className="mt-4 rounded-[18px] border border-black/5 bg-white px-5 py-4">
        <summary className="label-data cursor-pointer select-none">
          Transcript
        </summary>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          {result.transcript}
        </p>
      </details>

      <Link
        href="/"
        className="mt-6 block w-full rounded-[14px] bg-terracotta-500 px-6 py-4 text-center text-base font-semibold text-cream transition-colors hover:bg-terracotta-600"
      >
        Done — same time tomorrow
      </Link>
    </main>
  );
}

function Metric({
  label,
  value,
  note,
  amber = false,
}: {
  label: string;
  value: string;
  note: string;
  amber?: boolean;
}) {
  return (
    <div className="flex-1 rounded-[18px] border border-black/5 bg-white p-3.5">
      <div className="label-data">{label}</div>
      <div
        className={`font-display text-[26px] font-bold ${amber ? "text-amber-500" : ""}`}
      >
        {value}
      </div>
      <div className="text-[11.5px] text-stone-500">{note}</div>
    </div>
  );
}
