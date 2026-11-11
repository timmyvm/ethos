"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { DemosFigure } from "@/components/DemosClip";
import { Paywall } from "@/components/Paywall";
import { PremiumMark } from "@/components/PremiumMark";
import { RollNumber } from "@/components/premium/RollNumber";
import { Says } from "@/components/Says";
import { SpeechBubble } from "@/components/SpeechBubble";
import { IconShuffle } from "@/components/Icon";
import { Disclosure } from "@/components/ui/Disclosure";
import { FooterShelf } from "@/components/ui/FooterShelf";
import { BackLink } from "@/components/ui/ScreenHeader";
import { fetchProfile, fetchReps } from "@/lib/client-data";
import { weekStart } from "@/lib/level";
import { hostileKey } from "@/lib/client-key";
import { sendWithRetry } from "@/lib/rep-outbox";
import { ensureSession, sessionToken } from "@/lib/supabase-browser";
import { ACTION_CLASS } from "@/lib/ui";
import {
  ANSWER_SECONDS,
  HOSTILE_LINE,
  HOSTILE_PROMPTS,
  HOSTILE_ROUNDS,
  HOSTILE_TAKE_ID,
  TAKE_SECONDS,
  type HostilePrompt,
} from "@/lib/hostile";
import { ALL_FILLERS } from "@/lib/metric-labels";
import { WPM_ZONE } from "@/lib/log";
import { buzz, prefersReducedMotion } from "@/lib/prefs";
import type { AnalyzeResponse } from "@/app/api/analyze/route";
import { usePaywallReturn } from "@/lib/use-paywall-return";

/**
 * Hostile Q&A, the interrogation (DECISIONS #183). Sixty seconds on a
 * claim, then Demos comes back at the actual argument, twice, quoting
 * the speaker's own words. A verdict scores how the position held.
 *
 * The take banks through /api/analyze as a normal recording (streak,
 * coin, XP), fired in the background the moment it's transcribed. The
 * verdict is stored on that recording (`reps.round`, by /api/hostile,
 * only on the caller's own take), so a later screen can read it; the
 * Log names the take "Hostile Q&A".
 *
 * Delivery (the games plan, item 15; F8): the question is said, in
 * order. "You said" lands a word at a time, then, 300ms later, the
 * question as the screen's title, while Record is live from the first
 * frame. The verdict's three rows land one at a time, 300ms apart, each
 * number rolling, then Demos's line. Nothing chimes: they are a model's
 * read, and the screen labels them so. The end offers another claim
 * when a take is left, and goes back to Practice, never to Today.
 */

/** When "You said" starts landing, after the screen arrives. */
const QUOTE_LEAD_MS = 150;
/** Says lands any line in about this long (components/Says.tsx). */
const SAYS_LINE_MS = 220;
/** The beat between the quote and the question, and between verdict rows. */
const BEAT_MS = 300;
/** The verdict's first row, after the screen arrives. */
const ROW_LEAD_MS = 250;

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
  // then a random claim on mount: a random initializer would hydrate
  // against a different server pick.
  const [prompt, setPrompt] = useState<HostilePrompt>(HOSTILE_PROMPTS[0]);
  /* modes-26: the server's pick is never shown. The claim holds its
     space invisibly until the mount effect has chosen, so the first
     claim no longer flashes and swaps. */
  const [ready, setReady] = useState(false);
  /*
   * modes-6, #280: the allowance is said BEFORE the take. A free account
   * past its one a week used to speak for a minute into a refusal. The
   * same query the route runs (route.ts, lesson_id "hostile-take" since
   * this week's Monday), read on mount. Unknown stays unknown: if
   * either read fails nothing is locked here and the server decides,
   * which is the route's own degrade-open rule.
   */
  const [premium, setPremium] = useState<boolean | null>(null);
  const [usedThisWeek, setUsedThisWeek] = useState<boolean | null>(null);
  useEffect(() => {
    setPrompt(
      HOSTILE_PROMPTS[Math.floor(Math.random() * HOSTILE_PROMPTS.length)]
    );
    setReady(true);
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => setPremium(null));
    fetchReps()
      .then((reps) => {
        const since = weekStart();
        setUsedThisWeek(
          reps.some(
            (r) =>
              r.lesson_id === HOSTILE_TAKE_ID && new Date(r.created_at) >= since
          )
        );
      })
      .catch(() => setUsedThisWeek(null));
  }, []);
  const locked = premium === false && usedThisWeek === true;
  const [phase, setPhase] = useState<Phase>("intro");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);
  // Back from the paywall's account doors or Checkout's back arrow
  // (paywall=1): the sheet opens again where it was.
  usePaywallReturn(() => setPaywall("Hostile Q&A · once a week free"));
  const [pending, setPending] = useState<{
    question: string;
    quoted: string;
  } | null>(null);
  const [verdict, setVerdict] = useState<VerdictView | null>(null);
  /* How much of the verdict has landed: 1 to 3 rows, then 4 is Demos's
     line. Reduced motion shows the end state at once. */
  const [landed, setLanded] = useState(0);
  /* Reduced motion (or lite): the numbers stand at their value, unrolled. */
  const [still, setStill] = useState(false);
  const [banked, setBanked] = useState(false);
  /** The take's full engine result: the speech numbers the daily
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
  /** The banked take's id, once /api/analyze has stored it: the verdict is filed on it. */
  const bank = useRef<Promise<string | null> | null>(null);
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
    /* The take's own key (#436), made once and sent with both tries: a
       bank whose answer was lost and goes again stores one recording.
       The second try is what the key buys, for a dropped connection or
       a gateway 5xx. */
    const key = hostileKey();
    bank.current = (async (): Promise<string | null> => {
      try {
        const form = new FormData();
        form.append("audio", blob, "rep.webm");
        form.append("lessonId", HOSTILE_TAKE_ID);
        form.append("captureMode", "voice");
        form.append("tzOffset", String(new Date().getTimezoneOffset()));
        form.append("clientId", key);
        const out = await sendWithRetry(
          form,
          (force) => (force ? sessionToken(true) : ensureSession()),
          undefined,
          2
        );
        if (out.ok) {
          setBanked(true);
          setUsedThisWeek(true);
          const data = out.data as AnalyzeResponse | null;
          if (data?.metrics) setTakeResult(data);
          return data?.repId ?? null;
        }
      } catch {
        // The interrogation stands on its own; a failed bank only means
        // the log shows nothing, and the debrief doesn't claim it does.
      }
      return null;
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
        // The server counts the free week on this phone's calendar, as the screen does.
        form.append("tzOffset", String(new Date().getTimezoneOffset()));
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
      /* The take was banked two answers ago; its id files the verdict.
         A bank still out after a few seconds is not waited on: the
         verdict is shown either way, and only its storing is skipped. */
      const repId = await Promise.race([
        bank.current ?? Promise.resolve(null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
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
            quoted: r.quoted,
          })),
          roundNumbers: roundNumbers.current,
          repId: repId ?? undefined,
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
      // No buzz and no sound: the rows are a model's read (F8).
      setPhase("verdict");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through.");
      setPhase("error");
    }
  }

  async function startRecording() {
    setError(null);
    // The take is the gated part; an answer mid-session never is.
    if (take.current === null && locked) {
      setPaywall("Hostile Q&A · once a week free");
      return;
    }
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

  /* The verdict lands in order: each row 300ms after the last, its
     number rolling, then Demos's line. Reduced motion shows the end. */
  useEffect(() => {
    if (phase !== "verdict" || !verdict) return;
    if (prefersReducedMotion()) {
      setStill(true);
      setLanded(4);
      return;
    }
    setLanded(0);
    const timers = [1, 2, 3, 4].map((n) =>
      setTimeout(() => setLanded(n), ROW_LEAD_MS + (n - 1) * BEAT_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [phase, verdict]);

  /* Another claim is offered while a take is left this week: always on
     Premium, and on a free account until its one is banked. Unknown
     offers it, and the server decides, its own degrade-open rule. */
  const takeLeft = !(premium === false && usedThisWeek === true);

  /** A fresh claim, the session cleared, back to the intro. */
  function anotherClaim() {
    teardown();
    take.current = null;
    rounds.current = [];
    roundNumbers.current = [];
    lastBlob.current = null;
    bank.current = null;
    setPending(null);
    setVerdict(null);
    setLanded(0);
    setBanked(false);
    setTakeResult(null);
    setError(null);
    setPrompt((p) => {
      const pool = HOSTILE_PROMPTS.filter((x) => x.id !== p.id);
      return pool[Math.floor(Math.random() * pool.length)] ?? p;
    });
    setPhase("intro");
    window.scrollTo(0, 0);
  }

  const answeredSoFar = rounds.current.length;

  /** The shape of the boss as numbers, not a paragraph (modes-13). */
  const shape: { label: string; seconds: number }[] = [
    { label: "Your take", seconds: TAKE_SECONDS },
    ...Array.from({ length: HOSTILE_ROUNDS }, (_, i) => ({
      label: `Question ${i + 1}`,
      seconds: ANSWER_SECONDS,
    })),
  ];

  return (
    <main
      className={`flex min-h-dvh flex-col px-5 pt-[env(safe-area-inset-top)] ${
        /* The intro's shelf clears the home indicator itself. */
        phase === "intro" ? "" : "pb-safe"
      }`}
    >
      {/* Practice is where this door lives (modes-1): back never lands
          on /boss for someone who came in from the Premium grid. */}
      <BackLink href="/games" label="Practice" />

      {phase === "intro" && (
        <>
          <p className="eyebrow mt-4">Hostile Q&amp;A</p>
          <h1 className="font-display mt-1.5 text-title">{HOSTILE_LINE}</h1>
          <p className="mt-2 text-read text-stone-800 text-pretty">
            Argue the claim, then answer Demos on what you said.
          </p>

          {/* R3 (principle 7): the free height is Demos's. He stands on
              the claim card's top edge, as he does on the recording
              screen's topic card (TopicCard), the full-body render with
              its contact shadow and his idle clip, as big as the room
              between the line and the card allows (112 at the least, 264
              at the most), so the screen has no band of empty ground and
              the title's "Demos" is the biggest thing on it. The room is
              a size container over a flex-grown slot (the `.demos-fit`
              pattern), so he reads its height. */}
          <div aria-hidden className="relative mt-3 min-h-[100px] flex-1">
            <div className="absolute inset-0 [container-type:size]">
              <div className="topic-demos pointer-events-none absolute -bottom-3 left-1/2 w-[clamp(112px,calc(100cqh+12px),264px)] -translate-x-1/2">
                <span className="rep-ground" />
                <DemosFigure
                  pose="speaking"
                  src="/demos-onboard-speaking.webp"
                  width={528}
                  height={528}
                  delayMs={900}
                  className="demos relative block h-auto w-full"
                />
              </div>
            </div>
          </div>

          {/* The claim card no longer holds the tap (it is docked at the
              foot below), so it is the standard card at level 1 at the
              headliner's sheet radius (/boss). Another claim is a bare
              glyph on its eyebrow row, Today's floor-card grammar. */}
          <section aria-label="The claim" className="card relative rounded-sheet p-5">
            <div className="flex min-h-[22px] items-center gap-2">
              <p className="eyebrow min-w-0 flex-1">The claim</p>
              <button
                type="button"
                aria-label="Another claim"
                onClick={() =>
                  setPrompt((p) => {
                    const pool = HOSTILE_PROMPTS.filter((x) => x.id !== p.id);
                    return pool[Math.floor(Math.random() * pool.length)] ?? p;
                  })
                }
                className="press -my-3 -mr-3 grid size-11 shrink-0 place-items-center rounded-control text-stone-500"
              >
                <IconShuffle size={20} />
              </button>
            </div>
            <div className="font-display mt-2 min-h-[3.75rem] text-title font-extrabold">
              <span
                key={prompt.id}
                className={`arrive dur-fast block text-balance ${
                  ready ? "" : "invisible"
                }`}
              >
                {prompt.claim}
              </span>
            </div>
            {/* The one rule that changes how you answer, at reading
                size rather than in a caps rider (modes-25). The
                allowance shares its line: named by the mark, counted
                in words, said before the take (modes-6). */}
            <div className="mt-2 flex min-h-6 items-center justify-between gap-3">
              <p className="text-caption text-stone-500">Argue either side.</p>
              {premium === false && (
                <p className="arrive flex shrink-0 items-center gap-2 text-caption tabular-nums text-stone-500">
                  {usedThisWeek === false && "1 free this week"}
                  {usedThisWeek === true && "Free again Monday"}
                  <PremiumMark variant="chip" />
                </p>
              )}
            </div>
          </section>

          <ErrorNote>{error}</ErrorNote>

          {/* The boss's shape, flat on the ground: three numbers and
              their stat labels, no card. */}
          <dl className="mt-7 grid grid-cols-3 gap-3 pb-4">
            {shape.map((s) => (
              <div key={s.label} className="flex flex-col-reverse">
                <dt className="label-micro mt-1">{s.label}</dt>
                <dd className="font-display text-num-m tabular-nums">
                  {s.seconds}s
                </dd>
              </div>
            ))}
          </dl>

          {/* R3: the one tap docked at the foot, as on every flow (B6's
              offer): the shelf holds it at one y whatever the claim's
              length, and it clears the home indicator itself. */}
          <FooterShelf hairline={false}>
            <button
              type="button"
              onClick={() => void startRecording()}
              aria-haspopup={locked ? "dialog" : undefined}
              className={ACTION_CLASS}
            >
              Record my take
            </button>
          </FooterShelf>
        </>
      )}

      {phase === "recording" && (
        <div className="flex flex-1 flex-col">
          <p className="eyebrow mt-4">
            {isTake
              ? "Your take"
              : `Answer ${answeredSoFar + 1} of ${HOSTILE_ROUNDS}`}
          </p>
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
            <div className="font-display mt-3 text-num-hero tabular-nums">
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
            type="button"
            onClick={() => void stopRecording()}
            className={`${ACTION_CLASS} mt-7`}
          >
            Done
          </button>
        </div>
      )}

      {(phase === "thinking" || phase === "judging") && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-1 flex-col items-center justify-center text-center"
        >
          {/* Demos's sprite matches what he's DOING (#194): listening
              while you speak, working while he thinks. There is no
              thinking pose in the set; the working pose is the honest
              stand-in, and it's the app's idea of thinking anyway. */}
          <Image
            src="/demos-practice.webp"
            alt=""
            width={140}
            height={140}
            className="demos w-[140px]"
          />
          <p className="mt-4 text-body text-stone-500">
            {phase === "judging"
              ? "Demos is weighing it up…"
              : "Demos is thinking…"}
          </p>
        </div>
      )}

      {phase === "question" && pending && (
        <div className="flex flex-1 flex-col">
          <p className="eyebrow mt-4">
            Question {answeredSoFar + 1} of {HOSTILE_ROUNDS}
          </p>
          {/* Said in order (F8): what you said lands first, then, a beat
              later, his question as the screen's title. Record is live
              from the first frame; nothing waits on the words. */}
          {pending.quoted && (
            <QuoteLine
              key={`q:${pending.question}`}
              quoted={pending.quoted}
              lead={QUOTE_LEAD_MS}
              className="mt-3 text-body text-stone-500"
            />
          )}
          <Says
            key={pending.question}
            as="h1"
            text={pending.question}
            lead={pending.quoted ? QUOTE_LEAD_MS + SAYS_LINE_MS + BEAT_MS : QUOTE_LEAD_MS}
            className="font-display mt-3 text-title text-balance"
          />
          <ErrorNote>{error}</ErrorNote>
          {/* The free height is his (principle 7), as on the intro: Demos
              speaking, 140 at the least so his clip plays, as big as the
              room allows up to 330 (the column, at most), standing on the
              claim you are defending. The question has no shape row and a
              shorter claim under it than the intro, so at 264 he left a
              band of about 200pt of bare ground under the question at
              390x844 (the games look loop). */}
          <div aria-hidden className="relative mt-3 min-h-[128px] flex-1">
            <div className="absolute inset-0 [container-type:size]">
              <div className="topic-demos pointer-events-none absolute -bottom-3 left-1/2 w-[clamp(140px,calc(100cqh+12px),min(330px,100cqw))] -translate-x-1/2">
                <span className="rep-ground" />
                <DemosFigure
                  pose="speaking"
                  src="/demos-onboard-speaking.webp"
                  width={528}
                  height={528}
                  className="demos relative block h-auto w-full"
                />
              </div>
            </div>
          </div>
          <section aria-label="The claim" className="card relative rounded-sheet px-5 py-4">
            <p className="eyebrow">The claim</p>
            <p className="font-display mt-1 text-detail font-bold text-balance">{prompt.claim}</p>
          </section>
          <button
            type="button"
            onClick={() => void startRecording()}
            className={`${ACTION_CLASS} mt-4`}
          >
            Record my answer · {ANSWER_SECONDS}s
          </button>
        </div>
      )}

      {phase === "verdict" && verdict && (
        <>
          <p className="eyebrow mt-4">The verdict</p>
          <h1 className="font-display mt-1.5 text-title">{prompt.claim}</h1>

          {/* Three judged dimensions, so the dimension card's grammar:
              one card, rows under hairlines (#234). They are a model's
              read, never a measurement, and the label over them says
              whose read it is (map 2.4). The rows land one at a time,
              each number rolling up from zero. */}
          <p className="mt-7 text-caption text-stone-500">Demos&apos;s read, out of 100</p>
          <div className="card mt-2 px-4 py-1">
            <VerdictRow name="Held the claim" dim={verdict.held} shown={landed >= 1} still={still} />
            <VerdictRow name="Answered the question" dim={verdict.answered} shown={landed >= 2} still={still} />
            <VerdictRow name="Stayed steady" dim={verdict.composed} shown={landed >= 3} still={still} />
          </div>

          {/* Demos speaks the way he does on results (A4): his voice in
              the one bubble, beside him, with no terracotta wash. He
              comes in after the rows, and his line lands a word at a
              time; the bubble holds its size from the first frame. */}
          <div className={`mt-7 flex items-start gap-3 ${landed >= 4 ? "arrive" : "opacity-0"}`}>
            <Image
              src="/demos-speaking.webp"
              alt="Demos"
              width={62}
              height={62}
              className="demos w-[62px] shrink-0"
            />
            <div className="min-w-0 flex-1">
              <SpeechBubble tail="left">
                {landed >= 4 ? (
                  <Says text={verdict.coachLine} lead={120} />
                ) : (
                  <p className="invisible">{verdict.coachLine}</p>
                )}
              </SpeechBubble>
              <p className="mt-2 pl-1 text-caption text-stone-400">
                AI-generated feedback
              </p>
            </div>
          </div>

          {/* The speech numbers the daily debrief gets (#194): the take
              ran the full engine, so its measurements belong here too. */}
          {takeResult && (
            <div className="card mt-7 p-4">
              <p className="eyebrow">Your take, measured</p>
              <div className="mt-3 flex gap-3">
                <TakeStat
                  label={ALL_FILLERS}
                  value={String(takeResult.metrics.fillerCount)}
                  note={`${takeResult.metrics.fillersPerMin}/min`}
                />
                {/* The results walk's own words for the pace band, one
                    line in a column of four ("target 130-160" broke at
                    its hyphen at 390). */}
                <TakeStat
                  label="WPM"
                  value={String(takeResult.metrics.wpm)}
                  note={
                    takeResult.metrics.wpm > WPM_ZONE.high
                      ? "sprinting"
                      : takeResult.metrics.wpm >= WPM_ZONE.low
                        ? "in the zone"
                        : "strolling"
                  }
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
              {/* A door, so the row's chevron, never a typed arrow and
                  never the tap colour: the foot holds this screen's tap. */}
              <Link
                href="/history"
                className="text-link press mt-1 inline-flex min-h-11 items-center gap-1.5"
              >
                Full debrief in the log
                <Disclosure />
              </Link>
            </div>
          )}

          <p className="mt-3 text-caption leading-relaxed text-stone-500">
            {banked
              ? "Your take banked to the log as a recording."
              : "This debrief lives here only."}
          </p>

          <div className="flex-1" />
          {/* The end (F8): another claim while a take is left, with
              Practice as the quiet way out; with none left, Practice is
              the tap. Never Today: you came from Practice. */}
          {takeLeft ? (
            <>
              <button
                type="button"
                onClick={anotherClaim}
                className={`${ACTION_CLASS} mt-7`}
              >
                Another claim
              </button>
              <Link
                href="/games"
                className="text-link press mx-auto mt-1 inline-flex min-h-11 items-center"
              >
                Back to Practice
              </Link>
            </>
          ) : (
            <Link href="/games" className={`${ACTION_CLASS} mt-7`}>
              Back to Practice
            </Link>
          )}
        </>
      )}

      {phase === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p role="alert" className="max-w-[300px] text-body text-stone-600">
            {error}
          </p>
          <button
            type="button"
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
 * A failure in the error grammar (system-10, #246): the control surface
 * with rust words, as the auth forms and Upload draw it. Never
 * terracotta, which means tap, and never the coach's wash, which reads
 * as Demos talking.
 */
function ErrorNote({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="mt-3 rounded-control border border-edge bg-surface px-4 py-3 text-caption leading-relaxed text-rust"
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
        className={`font-display mt-1 text-num-m leading-none tabular-nums ${earned ? "text-sage-700" : ""}`}
      >
        {value}
      </div>
      {/* The note reserves two lines so a wrapping one never leaves
          the row of four ragged. */}
      <div className="mt-1.5 min-h-[34px] text-caption leading-snug text-stone-500">
        {note}
      </div>
    </div>
  );
}

function VerdictRow({
  name,
  dim,
  shown,
  still = false,
}: {
  name: string;
  dim: VerdictDim;
  /** Landed: the row arrives and its number rolls up from zero. */
  shown: boolean;
  /** Reduced motion: the number is simply there. */
  still?: boolean;
}) {
  return (
    <div
      className={`border-b border-hairline py-3 last:border-b-0 ${shown ? "arrive" : "opacity-0"}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display text-row leading-tight">{name}</div>
        <div className="font-display shrink-0 text-num-m leading-none tabular-nums">
          <RollNumber text={shown ? String(dim.score) : "0"} value={shown ? dim.score : 0} instant={still} />
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

/**
 * "You said: “…”", landing a word at a time on Says's clock
 * (components/Says.tsx, the same `.says-word` and its variables), with
 * the quote in ink: Says sets one style for a line, and this one has
 * two. Screen readers get the sentence once, whole.
 */
function QuoteLine({
  quoted,
  lead,
  className,
}: {
  quoted: string;
  lead: number;
  className?: string;
}) {
  const words = [
    ...["You", "said:"].map((w) => ({ w, quote: false })),
    ...`“${quoted}”`.split(" ").map((w) => ({ w, quote: true })),
  ];
  const step = Math.min(30, SAYS_LINE_MS / words.length);
  return (
    <p
      className={className}
      style={
        {
          "--says-step": `${step.toFixed(1)}ms`,
          "--says-lead": `${lead}ms`,
        } as CSSProperties
      }
    >
      <span className="sr-only">You said: “{quoted}”</span>
      <span aria-hidden>
        {words.map(({ w, quote }, i) => (
          <Fragment key={i}>
            {i > 0 && " "}
            <span
              className={`says-word ${quote ? "font-semibold text-ink" : ""}`}
              style={{ "--i": i } as CSSProperties}
            >
              {w}
            </span>
          </Fragment>
        ))}
      </span>
    </p>
  );
}
