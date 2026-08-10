"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GainsRow } from "@/components/GainsRow";
import { Moment } from "@/components/Moment";
import { RepResult } from "@/components/RepResult";
import { StreakCelebration } from "@/components/StreakCelebration";
import { achievements } from "@/lib/achievements";
import {
  fetchProfile,
  fetchReps,
  fetchXp,
  type RepRow,
} from "@/lib/client-data";
import { startCrowdNoise, type CrowdNoise } from "@/lib/crowd-noise";
import { syncFreezes } from "@/lib/freeze-sync";
import { starsByLesson, totalStars, unitStates } from "@/lib/path";
import { buzz, readPrefs } from "@/lib/prefs";
import { nextMilestones, repGains, type RepGain } from "@/lib/progress";
import {
  anticipation,
  endNote,
  personalBests,
  type RewardMoment,
} from "@/lib/rewards";
import { computeStreak } from "@/lib/streak";
import { resolveRepConfig, type RepConfig } from "@/lib/rep-config";
import { ensureSession } from "@/lib/supabase-browser";
import type { AnalyzeResponse } from "@/app/api/analyze/route";

const METER_BARS = 36;
const FRAME_SECONDS = 30;

/** Demos' one interruption. Short, specific, never insulting. */
const INTERRUPTIONS = [
  "So what?",
  "Says who?",
  "Give me an example.",
  "Why does that matter?",
  "Get to the point.",
];

type Phase =
  | "idle"
  | "frame"
  | "recording"
  | "analyzing"
  | "results"
  | "error";

export default function RepPage() {
  return (
    <Suspense fallback={<main className="px-5 pt-7" />}>
      <RepScreen />
    </Suspense>
  );
}

function RepScreen() {
  const searchParams = useSearchParams();
  const [premium, setPremium] = useState(false);

  useEffect(() => {
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => {});
  }, []);

  // The path can request a lesson, the boss screen a topic, and either
  // can stack stress mods. One resolver answers all of it.
  const config = useMemo(
    () =>
      resolveRepConfig({
        lesson: searchParams.get("lesson"),
        boss: searchParams.get("boss"),
        mods: searchParams.get("mods"),
        premium,
      }),
    [searchParams, premium]
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [frameLeft, setFrameLeft] = useState(FRAME_SECONDS);
  const [levels, setLevels] = useState<number[]>(Array(METER_BARS).fill(0.05));
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [interruption, setInterruption] = useState<string | null>(null);
  const [gains, setGains] = useState<RepGain[]>([]);
  const [anticipate, setAnticipate] = useState<RewardMoment | null>(null);
  const [closing, setClosing] = useState<RewardMoment | null>(null);
  const [bests, setBests] = useState<RewardMoment[]>([]);

  /**
   * Snapshot of where the user stood BEFORE this rep, captured on
   * mount. Without it the results screen can't say what changed, and
   * "what changed" is the only reward worth showing (DECISIONS #46).
   */
  const baselineRef = useRef<{
    stars: number;
    unitsOpen: string[];
    reps: RepRow[];
  } | null>(null);

  useEffect(() => {
    fetchReps()
      .then(async (rows) => {
        const map = starsByLesson(rows);
        baselineRef.current = {
          stars: totalStars(map),
          unitsOpen: unitStates(map)
            .filter((u) => !u.locked)
            .map((u) => u.name),
          reps: rows,
        };
        const streak = computeStreak(rows.map((r) => new Date(r.created_at)));
        const xp = await fetchXp().catch(() => ({ total: 0, week: 0 }));
        setAnticipate(
          anticipation(
            nextMilestones({
              reps: rows,
              starMap: map,
              streak,
              xp: xp.total,
              freezesEquipped: 0,
              achievements: achievements(rows),
            }),
            streak
          )
        );
      })
      .catch(() => {});
  }, []);

  const recRef = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    ctx: AudioContext;
    raf: number;
    chunks: Blob[];
    crowd: CrowdNoise | null;
    interruptTimer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const configRef = useRef<RepConfig>(config);
  configRef.current = config;

  const teardown = useCallback(() => {
    const r = recRef.current;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    if (r.interruptTimer) clearTimeout(r.interruptTimer);
    r.crowd?.stop();
    r.stream.getTracks().forEach((t) => t.stop());
    // The context outlives the fade-out of the crowd bed by design.
    setTimeout(() => void r.ctx.close().catch(() => {}), 400);
    recRef.current = null;
  }, []);

  const stopRep = useCallback(async () => {
    const r = recRef.current;
    if (!r || phaseRef.current !== "recording") return;
    buzz([20, 40, 20]);
    setPhase("analyzing");
    setInterruption(null);

    const blob = await new Promise<Blob>((resolve) => {
      r.recorder.onstop = () =>
        resolve(new Blob(r.chunks, { type: r.recorder.mimeType }));
      r.recorder.stop();
    });

    const cfg = configRef.current;
    teardown();

    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      form.append("audio", blob, `rep.${ext}`);
      form.append("lessonId", cfg.lessonId);
      form.append("mode", cfg.kind);
      form.append("mods", cfg.mods.map((m) => m.id).join(","));
      form.append("xpMultiplier", String(cfg.xpMultiplier));
      if (cfg.topic) form.append("bossTopicId", cfg.topic.id);
      // Anonymous-first (DECISIONS #15): attribute the rep if a session
      // exists or can be minted; never block the rep on auth.
      const token = await ensureSession();
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? `Analysis failed (${res.status})`);
      setResult(data as AnalyzeResponse);
      setPhase("results");
      // Streak is derived from stored reps, so read it back rather than
      // guessing — a rep that failed to persist shouldn't celebrate.
      const analyzed = data as AnalyzeResponse;
      fetchReps()
        .then(async (reps) => {
          const { streak } = await syncFreezes(
            reps.map((x) => new Date(x.created_at))
          );
          if (streak.current > 0) setCelebrate(streak.current);

          const before = baselineRef.current;
          if (before) {
            const map = starsByLesson(reps);
            const openNow = unitStates(map)
              .filter((u) => !u.locked)
              .map((u) => u.name);
            const nextGains = repGains({
              starsBefore: before.stars,
              starsAfter: totalStars(map),
              indexBefore: analyzed.previousIndex,
              indexAfter: analyzed.ethosIndex,
              streakAfter: streak.current,
              unlockedUnit:
                openNow.find((n) => !before.unitsOpen.includes(n)) ?? null,
            });
            setGains(nextGains);
            // before.reps is the history captured on mount — the true
            // "before", independent of whether this rep persisted.
            setBests(
              personalBests(before.reps, analyzed.metrics, analyzed.ethosIndex)
            );
            // Streak-end rule: the last thing on screen decides whether
            // they come back, so it is always something true and good.
            setClosing(
              endNote({
                gains: nextGains,
                metrics: analyzed.metrics,
                streak,
                repCount: reps.length,
              })
            );
          }
        })
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
      setPhase("error");
    }
  }, [teardown]);

  const startRep = useCallback(async () => {
    setError(null);
    setSeconds(0);
    const cfg = configRef.current;
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

      const crowd = cfg.crowdNoise ? startCrowdNoise(ctx) : null;

      recRef.current = {
        recorder,
        stream,
        ctx,
        raf: 0,
        chunks,
        crowd,
        interruptTimer: null,
      };
      recRef.current.raf = requestAnimationFrame(tick);

      if (cfg.interrupt) {
        // Somewhere in the middle third — early enough to recover from,
        // late enough that you're committed to a thread.
        const at = Math.round(cfg.maxSeconds * (0.4 + Math.random() * 0.2));
        recRef.current.interruptTimer = setTimeout(() => {
          if (phaseRef.current !== "recording") return;
          setInterruption(
            INTERRUPTIONS[Math.floor(Math.random() * INTERRUPTIONS.length)]
          );
          buzz([40, 60, 40]);
          setTimeout(() => setInterruption(null), 2600);
        }, at * 1000);
      }

      buzz(30);
      setPhase("recording");
    } catch {
      setError("Mic unavailable. Check browser permissions and try again.");
      setPhase("error");
    }
  }, []);

  /** Frame step (DECISIONS #35): opt-in think time before the clock. */
  const begin = useCallback(() => {
    if (readPrefs().frameStep) {
      setFrameLeft(FRAME_SECONDS);
      setPhase("frame");
    } else {
      void startRep();
    }
  }, [startRep]);

  // Frame countdown
  useEffect(() => {
    if (phase !== "frame") return;
    const t = setInterval(() => {
      setFrameLeft((s) => {
        if (s <= 1) {
          setPhase("idle");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Timer + hard cap (90s, or 45s with the tight-timer mod)
  useEffect(() => {
    if (phase !== "recording") return;
    const cap = config.maxSeconds;
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= cap) void stopRep();
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, stopRep, config.maxSeconds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const r = recRef.current;
      if (r) {
        try {
          r.recorder.stop();
        } catch {}
        cancelAnimationFrame(r.raf);
        if (r.interruptTimer) clearTimeout(r.interruptTimer);
        r.crowd?.stop();
        r.stream.getTracks().forEach((t) => t.stop());
        void r.ctx.close().catch(() => {});
      }
    };
  }, []);

  if (phase === "results" && result) {
    return (
      <>
        <Results
          result={result}
          config={config}
          gains={gains}
          bests={bests}
          closing={closing}
        />
        {celebrate !== null && (
          <StreakCelebration
            streak={celebrate}
            onDone={() => setCelebrate(null)}
          />
        )}
      </>
    );
  }

  const capLabel = fmt(config.maxSeconds);
  const promptHidden = config.hidePrompt && phase !== "idle";

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-8 pt-7">
      <Link href={config.kind === "boss" ? "/boss" : "/"} className="self-start text-sm text-stone-500">
        ← back
      </Link>
      <div className="label-data mt-6">{config.unit}</div>
      <h1 className="font-display mt-1.5 text-2xl font-bold">{config.title}</h1>

      {promptHidden ? (
        <p className="mt-2.5 text-[15px] italic leading-relaxed text-stone-400">
          Prompt hidden — that&apos;s the mod.
        </p>
      ) : (
        <p className="mt-2.5 text-[15px] leading-relaxed text-stone-500">
          {config.prompt}
        </p>
      )}

      {config.mods.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {config.mods.map((m) => (
            <span
              key={m.id}
              className="rounded-full bg-stone-900 px-2.5 py-1 text-[11.5px] font-semibold text-cream"
            >
              {m.name}
            </span>
          ))}
          <span className="label-data">×{config.xpMultiplier} XP</span>
        </div>
      )}

      {config.crowdNoise && phase === "idle" && (
        <p className="mt-2 text-[12.5px] text-stone-500">
          Headphones on — through speakers the café bleeds into your mic and
          the transcript stops being yours.
        </p>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        {phase === "frame" && (
          <div className="text-center">
            <div className="font-display text-[54px] font-bold leading-none">
              {frameLeft}
            </div>
            <div className="label-data mt-1">seconds to think</div>
            <p className="mt-3 max-w-[280px] text-[13.5px] leading-relaxed text-stone-500">
              Decide your first sentence and your last one. The middle
              takes care of itself.
            </p>
          </div>
        )}

        {phase === "recording" && (
          <>
            <div
              className={`font-display text-[54px] font-bold leading-none ${
                config.maxSeconds - seconds <= 10 ? "text-terracotta-600" : ""
              }`}
            >
              {fmt(seconds)}
              <span className="font-body text-[15px] font-medium text-stone-500">
                {" "}
                / {capLabel}
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
              {config.kind === "boss"
                ? "Transcribing, measuring, checking your claims."
                : "Transcribing, counting, measuring silence."}
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
          <>
            {/* Anticipation cue — what this rep is about to earn. The
                reward-prediction literature treats this as its own
                driver, not a preview of the reward. */}
            {anticipate && (
              <div className="w-full">
                <Moment moment={anticipate} emphasis />
              </div>
            )}
            <p className="max-w-[260px] text-center text-[13.5px] text-stone-500">
              {config.maxSeconds < 60
                ? `${config.maxSeconds} seconds. Pauses still score in your favor — spend them deliberately.`
                : "Aim for 60–90 seconds. Pauses are allowed — they're scored in your favor."}
            </p>
          </>
        )}

        {phase === "error" && (
          <div className="w-full rounded-[18px] border border-black/5 bg-white lift p-5 text-center">
            <div className="font-semibold">Rep didn&apos;t score.</div>
            <p className="mt-1.5 text-sm text-stone-500">{error}</p>
          </div>
        )}

        {phase !== "analyzing" && phase !== "frame" && (
          <button
            onClick={
              phase === "recording" ? () => void stopRep() : () => begin()
            }
            className={`h-24 w-24 rounded-full text-[15px] font-bold text-cream transition-colors ${
              phase === "recording"
                ? "bg-stone-900 ring-[10px] ring-terracotta-100"
                : "bg-terracotta-500 hover:bg-terracotta-600"
            }`}
          >
            {phase === "recording" ? "Stop" : "Rec"}
          </button>
        )}

        {phase === "frame" && (
          <button
            onClick={() => void startRep()}
            className="rounded-[14px] border border-black/10 bg-white px-6 py-3.5 text-[15px] font-semibold"
          >
            I&apos;m ready
          </button>
        )}
      </div>

      {interruption && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-5">
          <div className="flex max-w-[340px] items-center gap-3 rounded-[18px] bg-stage px-4 py-3 text-cream lift-stage">
            <Image
              src="/demos-speaking.webp"
              alt=""
              width={36}
              height={36}
              className="w-9 shrink-0"
            />
            <span className="font-display text-[17px] font-bold">
              {interruption}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Results — the shared view, so a fresh rep and a logged rep are
// literally the same screen.
function Results({
  result,
  config,
  gains,
  bests,
  closing,
}: {
  result: AnalyzeResponse;
  config: RepConfig;
  gains: RepGain[];
  bests: RewardMoment[];
  closing: RewardMoment | null;
}) {
  return (
    <main className="px-5 pb-10 pt-7">
      <div className="label-data">
        {config.kind === "boss" ? "Boss complete" : "Rep complete"}
      </div>
      <GainsRow gains={gains} />
      <RepResult result={result} topic={config.topic} />

      {bests.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="label-data">Records broken</div>
          {bests.map((b, i) => (
            <Moment key={i} moment={b} />
          ))}
        </div>
      )}

      {/* The ending carries disproportionate weight when someone decides
          whether to come back (streak-end rule), so it goes last. */}
      {closing && (
        <div className="mt-5">
          <Moment moment={closing} emphasis />
        </div>
      )}

      <Link
        href="/"
        className="mt-5 block w-full rounded-[14px] bg-terracotta-500 px-6 py-4 text-center text-base font-semibold text-cream transition-colors hover:bg-terracotta-600 press"
      >
        Done — same time tomorrow
      </Link>
    </main>
  );
}
