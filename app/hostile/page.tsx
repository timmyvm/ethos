"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ACTION_CLASS } from "@/components/LessonScreen";
import { Paywall } from "@/components/Paywall";
import { ensureSession } from "@/lib/supabase-browser";
import {
  ANSWER_SECONDS,
  HOSTILE_PROMPTS,
  HOSTILE_ROUNDS,
  TAKE_SECONDS,
  type HostilePrompt,
} from "@/lib/hostile";
import { buzz } from "@/lib/prefs";
import type { AnalyzeResponse } from "@/app/api/analyze/route";

/**
 * Hostile Q&A — the interrogation (DECISIONS #183). Sixty seconds on a
 * claim, then Demos comes back at the actual argument, twice, quoting
 * the speaker's own words. A verdict scores how the position held.
 *
 * The take banks through /api/analyze as a normal recording (streak,
 * coin, XP), fired in the background the moment it's transcribed; the
 * interrogation itself is the boss experience around it and lives on
 * this screen only, which the debrief says plainly.
 */

type Phase =
  | "intro"
  | "recording"
  | "thinking"
  | "question"
  | "judging"
  | "verdict"
  | "error";

interface RoundState {
  question: string;
  quoted: string;
  answer: string;
}

interface VerdictDim {
  score: number;
  citedMoment: string;
  improve: string;
}

interface VerdictView {
  held: VerdictDim;
  answered: VerdictDim;
  composed: VerdictDim;
  coachLine: string;
}

export default function HostilePage() {
  // Deterministic first render (the server prerenders this component),
  // then a random claim on mount — a random initializer would hydrate
  // against a different server pick.
  const [prompt, setPrompt] = useState<HostilePrompt>(HOSTILE_PROMPTS[0]);
  useEffect(() => {
    setPrompt(
      HOSTILE_PROMPTS[Math.floor(Math.random() * HOSTILE_PROMPTS.length)]
    );
  }, []);
  const [phase, setPhase] = useState<Phase>("intro");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    question: string;
    quoted: string;
  } | null>(null);
  const [verdict, setVerdict] = useState<VerdictView | null>(null);
  const [banked, setBanked] = useState(false);
  /** The take's full engine result — the speech numbers the daily
   *  debrief gets, reported missing here by Timothy. */
  const [takeResult, setTakeResult] = useState<AnalyzeResponse | null>(null);

  const take = useRef<string | null>(null);
  const rounds = useRef<RoundState[]>([]);
  const roundNumbers = useRef<
    { fillersPerMin: number; midSentencePauses: number }[]
  >([]);
  const rec = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    chunks: Blob[];
    timer: ReturnType<typeof setInterval>;
  } | null>(null);
  const lastBlob = useRef<Blob | null>(null);
  /** Live mic level 0–1 (#193): the proof on screen that it's
   *  listening. Reported by Timothy: a bare countdown read as
   *  think-time, and he prepped silently into a hot mic. */
  const audioCtx = useRef<AudioContext | null>(null);
  const [level, setLevel] = useState(0);

  const isTake = take.current === null;
  const cap = isTake ? TAKE_SECONDS : ANSWER_SECONDS;

  const teardown = useCallback(() => {
    const r = rec.current;
    void audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    setLevel(0);
    if (!r) return;
    rec.current = null;
    clearInterval(r.timer);
    try {
      if (r.recorder.state !== "inactive") r.recorder.stop();
    } catch {}
    r.stream.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => teardown, [teardown]);

  /** Bank the take as a normal recording, off the critical path. */
  function bankTake(blob: Blob) {
    void (async () => {
      try {
        const token = await ensureSession();
        const form = new FormData();
        form.append("audio", blob, "rep.webm");
        form.append("lessonId", "hostile-take");
        form.append("captureMode", "voice");
        form.append("tzOffset", String(new Date().getTimezoneOffset()));
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        });
        if (res.ok) {
          setBanked(true);
          const data = (await res.json().catch(() => null)) as
            | AnalyzeResponse
            | null;
          if (data?.metrics) setTakeResult(data);
        }
      } catch {
        // The interrogation stands on its own; a failed bank only means
        // the log shows nothing, and the debrief doesn't claim it does.
      }
    })();
  }

  const submit = useCallback(
    async (blob: Blob) => {
      lastBlob.current = blob;
      setPhase("thinking");
      setError(null);
      try {
        const token = await ensureSession();
        const form = new FormData();
        form.append("phase", "question");
        form.append("promptId", prompt.id);
        form.append("audio", blob, "hostile.webm");
        form.append(
          "context",
          JSON.stringify({
            take: take.current ?? undefined,
            rounds: rounds.current.map((r) => ({
              question: r.question,
              answer: r.answer,
            })),
            pendingQuestion: pending?.question,
            pendingQuoted: pending?.quoted,
          })
        );
        const res = await fetch("/api/hostile", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        });
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          locked?: boolean;
          tooShort?: boolean;
          transcript?: string;
          fillersPerMin?: number;
          midSentencePauses?: number;
          question?: { question: string; quoted: string } | null;
          finished?: boolean;
        } | null;

        if (!res.ok || !data) {
          if (data?.locked) {
            setPaywall("Hostile Q&A · once a week free");
            setPhase("intro");
            return;
          }
          throw new Error(data?.error ?? "The server didn't answer.");
        }

        if (data.tooShort) {
          setError(
            "Not enough said to interrogate. Give the claim a real 60 seconds."
          );
          setPhase(take.current === null ? "intro" : "question");
          return;
        }

        const wasTake = take.current === null;
        if (wasTake) {
          take.current = data.transcript ?? "";
          bankTake(blob);
        } else {
          rounds.current = [
            ...rounds.current,
            {
              question: pending?.question ?? "",
              quoted: pending?.quoted ?? "",
              answer: data.transcript ?? "",
            },
          ];
          roundNumbers.current = [
            ...roundNumbers.current,
            {
              fillersPerMin: data.fillersPerMin ?? 0,
              midSentencePauses: data.midSentencePauses ?? 0,
            },
          ];
        }

        if (data.finished || !data.question) {
          await judge();
          return;
        }
        setPending(data.question);
        buzz([10, 30, 10]);
        setPhase("question");
      } catch (e) {
        setError(e instanceof Error ? e.message : "That didn't go through.");
        setPhase("error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prompt.id, pending]
  );

  async function judge() {
    setPhase("judging");
    try {
      const token = await ensureSession();
      const form = new FormData();
      form.append("phase", "verdict");
      form.append("promptId", prompt.id);
      form.append(
        "context",
        JSON.stringify({
          take: take.current,
          rounds: rounds.current.map((r) => ({
            question: r.question,
            answer: r.answer,
          })),
          roundNumbers: roundNumbers.current,
        })
      );
      const res = await fetch("/api/hostile", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const data = (await res.json().catch(() => null)) as {
        verdict?: VerdictView;
        error?: string;
      } | null;
      if (!res.ok || !data?.verdict) {
        throw new Error(data?.error ?? "The verdict didn't come back.");
      }
      setVerdict(data.verdict);
      buzz([20, 40, 20]);
      setPhase("verdict");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through.");
      setPhase("error");
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
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
      setSeconds(0);
      const timer = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= cap) void stopRecording();
          return s + 1;
        });
      }, 1000);
      rec.current = { recorder, stream, chunks, timer };

      // The live level (#193). The dot and bar move with the actual
      // mic, which is the one signal a countdown can't fake.
      try {
        const ctx = new AudioContext();
        ctx.createMediaStreamSource(stream).connect(
          (() => {
            const an = ctx.createAnalyser();
            an.fftSize = 512;
            const data = new Uint8Array(an.frequencyBinCount);
            let last = 0;
            const loop = () => {
              if (!rec.current) return;
              requestAnimationFrame(loop);
              const now = performance.now();
              if (now - last < 90) return;
              last = now;
              an.getByteTimeDomainData(data);
              let sum = 0;
              for (let i = 0; i < data.length; i++) {
                const d = (data[i] - 128) / 128;
                sum += d * d;
              }
              setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
            };
            requestAnimationFrame(loop);
            return an;
          })()
        );
        audioCtx.current = ctx;
      } catch {
        // The meter is an affordance; its absence never blocks the boss.
      }

      buzz(20);
      setPhase("recording");
    } catch {
      setError(
        "The microphone didn't open. Check the permission and try again."
      );
    }
  }

  async function stopRecording() {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    void audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    setLevel(0);
    clearInterval(r.timer);
    const blob = await new Promise<Blob>((resolve) => {
      r.recorder.onstop = () =>
        resolve(new Blob(r.chunks, { type: r.recorder.mimeType }));
      r.recorder.stop();
    });
    r.stream.getTracks().forEach((t) => t.stop());
    buzz([20, 40, 20]);
    await submit(blob);
  }

  const answeredSoFar = rounds.current.length;

  return (
    <main className="pb-safe flex min-h-dvh flex-col px-5 pt-7">
      <Link
        href="/boss"
        className="press inline-flex min-h-11 items-center self-start text-[13px] font-semibold text-stone-500"
      >
        ← back
      </Link>

      {phase === "intro" && (
        <>
          <div className="label-data mt-4">Boss · Hostile Q&amp;A</div>
          <h1 className="font-display mt-1.5 text-title">
            Hold a claim while Demos comes at it.
          </h1>
          <p className="mt-2 text-body text-stone-500">
            Sixty seconds on the claim. Then two questions about what you
            actually said, 45 seconds each. Scored on whether the position
            held, whether you answered, and how steady it sounded.
          </p>

          {/* The claim card holds the tap, so it is this screen's one
              lifted thing: the wheel's grammar on /boss, to the class. */}
          <div className="elev-2 mt-5 rounded-sheet border border-card-edge bg-raised p-5">
            <div className="label-data">The claim · argue either side</div>
            <div className="font-display mt-3 min-h-[3.75rem] text-title">
              <span key={prompt.id} className="arrive dur-fast block">
                {prompt.claim}
              </span>
            </div>
            <div className="mt-4 flex gap-2.5">
              <button
                onClick={() =>
                  setPrompt((p) => {
                    const pool = HOSTILE_PROMPTS.filter((x) => x.id !== p.id);
                    return pool[Math.floor(Math.random() * pool.length)] ?? p;
                  })
                }
                className="press font-display min-h-12 shrink-0 rounded-control border border-edge bg-surface px-4 text-[14px] font-bold"
              >
                Another
              </button>
              <button
                onClick={() => void startRecording()}
                className={`${ACTION_CLASS} flex-1 !px-4`}
              >
                Record my take · 60s
              </button>
            </div>
          </div>

          <ErrorNote>{error}</ErrorNote>
        </>
      )}

      {phase === "recording" && (
        <div className="flex flex-1 flex-col">
          <div className="label-data mt-4">
            {isTake
              ? "Your take"
              : `Answer ${answeredSoFar + 1} of ${HOSTILE_ROUNDS}`}
          </div>
          {/* The clock is the hero while the mic is hot, so the claim
              steps back to the bold body line LessonBody uses when the
              name isn't the instruction. */}
          <h1 className="font-display mt-1.5 text-body font-bold">
            {isTake ? prompt.claim : (pending?.question ?? "")}
          </h1>
          <div className="flex flex-1 flex-col items-center justify-center">
            {/* The mic is HOT and the screen has to say so (#193): a
                bare countdown read as think-time. The dot and bar are
                driven by the live level, so they move when you speak,
                which is the only proof of listening a screen can give. */}
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full bg-terracotta-700"
                style={{
                  transform: `scale(${1 + level * 1.4})`,
                  opacity: 0.55 + level * 0.45,
                }}
              />
              <span className="label-micro !text-terracotta-700">
                recording
              </span>
            </div>
            <div className="font-display mt-3 text-[54px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">
              {Math.max(0, cap - seconds)}
            </div>
            <div className="label-micro mt-2">seconds left</div>
            {/* Bars are square, trough and fill (#234), and the level
                reads in the loop's own meter colour: terracotta-500 is
                the one tap on this screen and it is the Done button. */}
            <div className="mt-5 h-1.5 w-full max-w-[220px] overflow-hidden bg-sand">
              <div
                className="h-full bg-stone-400"
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </div>
            <Image
              src="/demos-listening.webp"
              alt="Demos is listening"
              width={72}
              height={72}
              className="demos mt-7 w-[72px]"
            />
          </div>
          <button
            onClick={() => void stopRecording()}
            className={`${ACTION_CLASS} mt-7`}
          >
            Done
          </button>
        </div>
      )}

      {(phase === "thinking" || phase === "judging") && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {/* Demos's sprite matches what he's DOING (#194): listening
              while you speak, working while he thinks. There is no
              thinking pose in the set; the working pose is the honest
              stand-in, and it's the app's idea of thinking anyway. */}
          <Image
            src="/demos-workout.webp"
            alt=""
            width={140}
            height={140}
            className="demos w-[140px]"
          />
          <p className="mt-4 text-body text-stone-500">
            {phase === "judging"
              ? "Demos is weighing it up."
              : "Demos is thinking."}
          </p>
        </div>
      )}

      {phase === "question" && pending && (
        <div className="flex flex-1 flex-col">
          <div className="label-data mt-4">
            Question {answeredSoFar + 1} of {HOSTILE_ROUNDS}
          </div>
          {pending.quoted && (
            <p className="mt-3 text-body text-stone-500">
              You said:{" "}
              <span className="font-semibold text-ink">
                &ldquo;{pending.quoted}&rdquo;
              </span>
            </p>
          )}
          <h1 className="font-display mt-3 text-title">{pending.question}</h1>
          <ErrorNote>{error}</ErrorNote>
          {/* Demos composites onto the ground: the art ships with a real
              alpha channel, and the tile it sat in was a box around a
              mascot (globals.css, `.demos`). */}
          <div className="mt-7 flex items-end gap-3">
            <Image
              src="/demos-speaking.webp"
              alt="Demos"
              width={62}
              height={62}
              className="demos w-[62px] shrink-0"
            />
            <p className="text-caption leading-relaxed text-stone-400">
              He&apos;s arguing with the take, never with you.
            </p>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => void startRecording()}
            className={`${ACTION_CLASS} mt-7`}
          >
            Record my answer · {ANSWER_SECONDS}s
          </button>
        </div>
      )}

      {phase === "verdict" && verdict && (
        <>
          <div className="label-data mt-4">The verdict</div>
          <h1 className="font-display mt-1.5 text-title">{prompt.claim}</h1>

          {/* Three judged dimensions, so the dimension card's grammar:
              one card, rows under hairlines (#234). Three separate cards
              at 12px was the 12px pile the results screen lost. */}
          <div className="elev-2 arrive-lift mt-7 rounded-card border border-card-edge bg-raised px-4 py-1">
            <VerdictRow name="Held the claim" dim={verdict.held} />
            <VerdictRow name="Answered the question" dim={verdict.answered} />
            <VerdictRow name="Stayed steady" dim={verdict.composed} />
          </div>

          {/* The coach bubble, exactly as the debrief draws it
              (components/RepResult.tsx): no tile behind Demos, no
              bracketed corner, the label at terracotta-700. */}
          <div className="mt-7 flex items-end gap-3">
            <Image
              src="/demos-speaking.webp"
              alt="Demos"
              width={62}
              height={62}
              className="demos w-[62px] shrink-0"
            />
            <div className="rounded-card bg-terracotta-50 p-4 text-body leading-relaxed">
              <div className="label-data !text-terracotta-700 mb-1.5">
                Demos
              </div>
              {verdict.coachLine}
              <div className="mt-2.5 text-caption text-stone-400">
                AI-generated feedback
              </div>
            </div>
          </div>

          {/* The speech numbers the daily debrief gets (#194): the take
              ran the full engine, so its measurements belong here too. */}
          {takeResult && (
            <div className="elev-1 mt-7 rounded-card border border-card-edge bg-raised p-4">
              <div className="label-data">Your take, measured</div>
              <div className="mt-3 flex gap-3">
                <TakeStat
                  label="Fillers"
                  value={String(takeResult.metrics.fillerCount)}
                  note={`${takeResult.metrics.fillersPerMin}/min`}
                />
                <TakeStat
                  label="WPM"
                  value={String(takeResult.metrics.wpm)}
                  note="target 130-160"
                />
                <TakeStat
                  label="Held pauses"
                  value={String(takeResult.metrics.heldPauses)}
                  note="≥0.8s"
                  earned
                />
                {takeResult.ethosIndex !== null && (
                  <TakeStat
                    label="Ethos"
                    value={String(takeResult.ethosIndex)}
                    note="/1000"
                  />
                )}
              </div>
              <Link
                href="/history"
                className="press mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-terracotta-700"
              >
                Full debrief in the log →
              </Link>
            </div>
          )}

          <p className="mt-3 text-caption leading-relaxed text-stone-400">
            {banked
              ? "Your take banked to the log as a recording."
              : "This debrief lives here only."}
          </p>

          <div className="flex-1" />
          <Link href="/" className={`${ACTION_CLASS} mt-7`}>
            Done
          </Link>
        </>
      )}

      {phase === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="max-w-[300px] text-body text-stone-600">{error}</p>
          <button
            onClick={() => {
              if (lastBlob.current) void submit(lastBlob.current);
              else setPhase("intro");
            }}
            className={`${ACTION_CLASS} mt-7 max-w-[320px]`}
          >
            Try again
          </button>
        </div>
      )}

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
    </main>
  );
}

/**
 * A failure, in the card grammar rather than a terracotta wash: that
 * wash is the coach bubble's material (#234), and an error wearing it
 * reads as Demos talking.
 */
function ErrorNote({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="elev-1 mt-3 rounded-card border border-card-edge bg-raised p-4 text-caption leading-relaxed text-terracotta-700"
    >
      {children}
    </p>
  );
}

/** A tile's label inside a card is the micro register, and its column
 *  reserves two lines so four numbers share one baseline. */
function TakeStat({
  label,
  value,
  note,
  earned = false,
}: {
  label: string;
  value: string;
  note: string;
  earned?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="label-micro block min-h-[26px] leading-[1.3]">
        {label}
      </div>
      <div
        className={`font-display mt-1 text-[20px] font-extrabold leading-none tabular-nums ${earned ? "text-sage-700" : ""}`}
      >
        {value}
      </div>
      {/* The note reserves two lines so a wrapping one ("target
          130-160") doesn't leave the row of four ragged. */}
      <div className="mt-1.5 min-h-[34px] text-caption leading-snug text-stone-500">
        {note}
      </div>
    </div>
  );
}

function VerdictRow({ name, dim }: { name: string; dim: VerdictDim }) {
  return (
    <div className="border-b border-hairline py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display text-[14px] font-bold leading-tight">
          {name}
        </div>
        <div className="font-display shrink-0 text-[24px] font-extrabold leading-none tabular-nums">
          {dim.score}
          <span className="text-caption font-bold text-stone-400">/100</span>
        </div>
      </div>
      <p className="mt-2 text-caption leading-relaxed text-stone-500">
        {dim.citedMoment}
      </p>
      <p className="mt-1 text-caption leading-relaxed text-stone-600">
        {dim.improve}
      </p>
    </div>
  );
}
