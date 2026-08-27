"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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

  const isTake = take.current === null;
  const cap = isTake ? TAKE_SECONDS : ANSWER_SECONDS;

  const teardown = useCallback(() => {
    const r = rec.current;
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
        if (res.ok) setBanked(true);
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
    <main className="flex min-h-dvh flex-col px-5 pb-10 pt-7">
      <Link href="/boss" className="self-start text-sm text-stone-500">
        ← back
      </Link>

      {phase === "intro" && (
        <>
          <div className="label-data mt-6">Boss · Hostile Q&amp;A</div>
          <h1 className="font-display mt-1.5 text-[27px] leading-tight">
            Hold a claim while Demos comes at it.
          </h1>
          <p className="mt-2.5 text-[14px] leading-relaxed text-stone-500">
            Sixty seconds on the claim. Then two questions about what you
            actually said, 45 seconds each. Scored on whether the position
            held, whether you answered, and how steady it sounded.
          </p>

          <div className="mt-5 rounded-[26px] border border-hairline bg-surface p-6 lift-hero">
            <div className="label-data">The claim · argue either side</div>
            <div className="font-display mt-3 min-h-[4.2rem] text-[26px] leading-[1.12]">
              {prompt.claim}
            </div>
            <div className="mt-4 flex gap-2.5">
              <button
                onClick={() =>
                  setPrompt((p) => {
                    const pool = HOSTILE_PROMPTS.filter((x) => x.id !== p.id);
                    return pool[Math.floor(Math.random() * pool.length)] ?? p;
                  })
                }
                className="press shrink-0 rounded-full border border-stone-200 bg-surface px-5 py-4 text-[15px] font-semibold"
              >
                Another
              </button>
              <button
                onClick={() => void startRecording()}
                className="press flex-1 rounded-full bg-terracotta-500 px-6 py-4 text-center text-[16.5px] font-semibold text-cream transition-colors hover:bg-terracotta-600"
              >
                Take the floor · 60s
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-[20px] bg-terracotta-50 px-4 py-3 text-[13.5px] leading-relaxed text-terracotta-700">
              {error}
            </p>
          )}
        </>
      )}

      {phase === "recording" && (
        <div className="flex flex-1 flex-col">
          <div className="label-data mt-6">
            {isTake
              ? "Your take"
              : `Answer ${answeredSoFar + 1} of ${HOSTILE_ROUNDS}`}
          </div>
          <h1 className="font-display mt-1.5 text-[22px] leading-tight">
            {isTake ? prompt.claim : (pending?.question ?? "")}
          </h1>
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="font-display text-[64px] leading-none tabular-nums">
              {Math.max(0, cap - seconds)}
            </div>
            <div className="label-data mt-2">seconds left</div>
          </div>
          <button
            onClick={() => void stopRecording()}
            className="press w-full rounded-full bg-terracotta-500 px-6 py-4 text-base font-semibold text-cream"
          >
            Done
          </button>
        </div>
      )}

      {(phase === "thinking" || phase === "judging") && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Image
            src="/demos-listening.webp"
            alt=""
            width={140}
            height={140}
            className="demos w-[140px]"
          />
          <p className="mt-4 text-[15px] text-stone-500">
            {phase === "judging"
              ? "Demos is weighing it up."
              : "Demos is thinking."}
          </p>
        </div>
      )}

      {phase === "question" && pending && (
        <div className="flex flex-1 flex-col">
          <div className="label-data mt-6">
            Question {answeredSoFar + 1} of {HOSTILE_ROUNDS}
          </div>
          {pending.quoted && (
            <p className="mt-4 text-[14px] leading-relaxed text-stone-500">
              You said:{" "}
              <span className="font-semibold text-ink">
                &ldquo;{pending.quoted}&rdquo;
              </span>
            </p>
          )}
          <h1 className="font-display mt-3 text-[26px] leading-[1.15]">
            {pending.question}
          </h1>
          {error && (
            <p className="mt-3 rounded-[20px] bg-terracotta-50 px-4 py-3 text-[13.5px] leading-relaxed text-terracotta-700">
              {error}
            </p>
          )}
          <div className="mt-5 flex items-end gap-3">
            <Image
              src="/demos-speaking.webp"
              alt="Demos"
              width={62}
              height={62}
              className="demos w-[62px] rounded-[20px] border border-sand bg-surface"
            />
            <p className="text-[12.5px] leading-relaxed text-stone-400">
              He&apos;s arguing with the take, never with you.
            </p>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => void startRecording()}
            className="press w-full rounded-full bg-terracotta-500 px-6 py-4 text-base font-semibold text-cream"
          >
            Answer · {ANSWER_SECONDS}s
          </button>
        </div>
      )}

      {phase === "verdict" && verdict && (
        <>
          <div className="label-data mt-6">The verdict</div>
          <h1 className="font-display mt-1.5 text-[27px] leading-tight">
            {prompt.claim}
          </h1>

          <div className="mt-4 space-y-3">
            <VerdictRow name="Held the claim" dim={verdict.held} />
            <VerdictRow name="Answered the question" dim={verdict.answered} />
            <VerdictRow name="Stayed steady" dim={verdict.composed} />
          </div>

          <div className="mt-5 flex items-end gap-3">
            <Image
              src="/demos-speaking.webp"
              alt="Demos"
              width={62}
              height={62}
              className="demos w-[62px] rounded-[20px] border border-sand bg-surface"
            />
            <div className="rounded-[20px] rounded-bl-[6px] bg-terracotta-50 px-4 py-3 text-sm leading-relaxed">
              <div className="label-data !text-terracotta-600 mb-0.5">
                Demos
              </div>
              {verdict.coachLine}
              <div className="mt-1.5 text-[11px] text-stone-400">
                AI-generated feedback
              </div>
            </div>
          </div>

          <p className="mt-4 text-[12.5px] leading-relaxed text-stone-400">
            {banked
              ? "Your take banked to the log as a recording. This debrief lives here only."
              : "This debrief lives here only."}
          </p>

          <div className="flex-1" />
          <Link
            href="/"
            className="press mt-6 block w-full rounded-full bg-terracotta-500 px-6 py-4 text-center text-base font-semibold text-cream"
          >
            Done
          </Link>
        </>
      )}

      {phase === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="max-w-[300px] text-[15px] leading-relaxed text-stone-600">
            {error}
          </p>
          <button
            onClick={() => {
              if (lastBlob.current) void submit(lastBlob.current);
              else setPhase("intro");
            }}
            className="press mt-6 w-full max-w-[320px] rounded-full bg-terracotta-500 px-6 py-4 text-base font-semibold text-cream"
          >
            Try again
          </button>
        </div>
      )}

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
    </main>
  );
}

function VerdictRow({ name, dim }: { name: string; dim: VerdictDim }) {
  return (
    <div className="rounded-[24px] border border-hairline bg-surface lift p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[14.5px] font-semibold">{name}</div>
        <div className="font-display text-[22px] leading-none">
          {dim.score}
          <span className="text-[12px] text-stone-400">/100</span>
        </div>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">
        {dim.citedMoment}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
        {dim.improve}
      </p>
    </div>
  );
}
