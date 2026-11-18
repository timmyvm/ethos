"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DemosArt } from "@/components/DemosArt";
import { PermissionHelp } from "@/components/PermissionHelp";
import { SpeechBubble } from "@/components/SpeechBubble";
import { FooterShelf } from "@/components/ui/FooterShelf";
import { BackLink } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { TapTick } from "@/components/ui/TapTick";
import { MarkedSentence, SayArt, SwapPair } from "@/components/say/parts";
import { SayChip, useMoments } from "@/components/say/useMoments";
import { setAudioSession } from "@/lib/audio-session";
import { heldReps } from "@/lib/client-data";
import { todayHref } from "@/lib/home";
import { readable } from "@/lib/load";
import { poolHere } from "@/lib/pool";
import {
  afterTest,
  clock,
  dayOf,
  endLine,
  phraseAt,
  saidOn,
  sayLists,
  type LineCheck,
  type TestResult,
  type TimedWord,
} from "@/lib/say";
import { fetchSay, fetchTakeWords, heldSay, saveState, type SayItem } from "@/lib/say-store";
import { sessionToken } from "@/lib/supabase-browser";
import { ACTION_CLASS, DISABLED_CLASS } from "@/lib/ui";
import { holdAwake } from "@/lib/wake-lock";

/** A line is a sentence: fifteen seconds is room for one said slowly. */
const LINE_MAX_S = 15;
/** The ring around Stop, as the recorder draws its own (D51). */
const RING_R = 56;
const RING_C = 2 * Math.PI * RING_R;

type Phase = "ask" | "recording" | "checking" | "said" | "missed" | "shown" | "unheard" | "blocked" | "offline" | "failed";
const ANSWERED: ReadonlySet<Phase> = new Set(["said", "missed", "shown"]);

/**
 * Say it better's test (DECISIONS #507): a walk with the tab bar hidden,
 * three swaps at most, each your own sentence from your own recording.
 *
 * The stage shows what you said ("You said, Monday ▶0:14", playable) with
 * the weak phrase marked where the better one goes. "Say it again,
 * better" is answered OUT LOUD on the house Record control, and checked
 * by Whisper through its own short path (/api/say): said it, and the
 * phrase lands in sage; missed, and the screen says what you said, the
 * answer, and that it is back tomorrow. "Show it instead" is for a quiet
 * room. Nothing said here is stored: no recording in the Log, no XP, no
 * streak, no stars, and it never counts toward "you now say".
 *
 * The screen stays awake while a line is recorded (#440). Each answer is
 * kept as it is given (lib/say.ts afterTest: 1, 3, 7, then 14 days; a
 * miss tomorrow), so leaving part way keeps what was done.
 *
 * The end is a moment: Demos, what was said out loud, the pairs with sage
 * checks, then "Next, say one in today's practice." and the tap there.
 */
export default function SayTest() {
  const [queue, setQueue] = useState<SayItem[] | null>(() => {
    const held = heldSay();
    return held ? sayLists(held.items, dayOf(new Date())).due : null;
  });
  const [failedRead, setFailedRead] = useState(false);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("ask");
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [check, setCheck] = useState<LineCheck | null>(null);
  const [missing, setMissing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);
  const [words, setWords] = useState<Map<string, TimedWord[] | null>>(new Map());
  const [line, setLine] = useState<string | null>(null);
  const lineAudio = useRef<HTMLAudioElement | null>(null);
  const player = useMoments();
  const rec = useRef<{ stream: MediaStream; recorder: MediaRecorder; started: number; timer: number } | null>(null);
  /** The queue is fixed at the first read: answering never reshuffles the walk. */
  const fixed = useRef(queue !== null);

  useEffect(() => {
    void (async () => {
      const got = await readable(() => fetchSay());
      if (!got.ok) {
        if (!fixed.current) setFailedRead(true);
        return;
      }
      if (fixed.current) return;
      fixed.current = true;
      setQueue(sayLists(got.data.items, dayOf(new Date())).due);
    })();
  }, []);

  /* Your sentence's moment, from the recordings these came from. */
  useEffect(() => {
    if (!queue || queue.length === 0) return;
    const ids = queue.map((q) => q.swap.repId).filter((x): x is string => !!x);
    fetchTakeWords(ids).then(setWords, () => {});
  }, [queue]);

  /* The screen stays awake while a line is said (#440). */
  useEffect(() => (phase === "recording" ? holdAwake() : undefined), [phase]);

  /* Leaving mid-line lets the mic go. */
  useEffect(
    () => () => {
      const r = rec.current;
      if (!r) return;
      window.clearInterval(r.timer);
      r.recorder.onstop = null;
      if (r.recorder.state !== "inactive") r.recorder.stop();
      r.stream.getTracks().forEach((t) => t.stop());
    },
    []
  );

  useEffect(() => () => {
    if (line) URL.revokeObjectURL(line);
  }, [line]);

  const item = queue?.[i] ?? null;
  const today = dayOf(new Date());

  const answer = useCallback(
    (result: TestResult) => {
      if (!item) return;
      setResults((r) => ({ ...r, [item.swap.key]: result }));
      setPhase(result);
      /* Kept as it is given: on this phone at once, then the account. */
      void saveState(item.swap.key, afterTest(item.state, result, dayOf(new Date()))).catch(() => {});
    },
    [item]
  );

  const send = useCallback(
    async (blob: Blob) => {
      if (!item) return;
      setPhase("checking");
      setLine((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      try {
        const token = await sessionToken();
        const form = new FormData();
        form.append("audio", blob, blob.type.includes("mp4") ? "line.mp4" : "line.webm");
        form.append("better", item.swap.better);
        form.append("said", item.swap.said);
        const res = await fetch("/api/say", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        if (res.status === 502) return setPhase("unheard");
        if (!res.ok) return setPhase("failed");
        const body = (await res.json()) as LineCheck;
        if (!body.text.trim()) return setPhase("unheard");
        setCheck(body);
        answer(body.heard ? "said" : "missed");
      } catch {
        setPhase(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "failed");
      }
    },
    [item, answer]
  );

  const stop = useCallback(() => {
    const r = rec.current;
    if (!r) return;
    window.clearInterval(r.timer);
    if (r.recorder.state !== "inactive") r.recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (rec.current) return;
    player.stop();
    if (typeof navigator !== "undefined" && navigator.onLine === false) return setPhase("offline");
    setCheck(null);
    try {
      /* A moment played a breath ago asked the phone for its speaker;
         the mic needs the session back (lib/audio-session.ts). */
      setAudioSession("auto");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const mime =
        typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : undefined;
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        rec.current = null;
        void send(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      };
      const started = Date.now();
      const timer = window.setInterval(() => {
        const s = (Date.now() - started) / 1000;
        setSeconds(s);
        if (s >= LINE_MAX_S) stop();
      }, 200);
      rec.current = { stream, recorder, started, timer };
      recorder.start();
      setSeconds(0);
      setPhase("recording");
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setMissing(name === "NotFoundError" || name === "OverconstrainedError");
      setPhase("blocked");
    }
  }, [player, send, stop]);

  const next = () => {
    player.stop();
    setCheck(null);
    setLine(null);
    if (!queue || i + 1 >= queue.length) {
      setDone(true);
      return;
    }
    setI(i + 1);
    setPhase("ask");
  };

  const practice = () => todayHref(heldReps() ?? [], new Date(), poolHere());

  /* ---- the end, and the screens with nothing to test -------------------- */

  if (done && queue) {
    const said = queue.filter((q) => results[q.swap.key] === "said").length;
    return (
      <main data-trait="range" data-say-end className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-5">
        <div className="pt-[env(safe-area-inset-top)]">
          <BackLink href="/say" label="Say it better" />
        </div>
        <div className="flex min-h-[156px] flex-1 flex-col items-center justify-end">
          <SpeechBubble tail="down" className="text-center">
            {endLine(said, queue.length)}
          </SpeechBubble>
          <div className="demos-fit relative mt-2 w-full flex-1">
            <div className="demos-fit-room">
              <DemosArt pose={said > 0 ? "celebrate" : "speaking"} size={300} fit grounded />
            </div>
          </div>
        </div>
        {/* Each pair in the page's list shape (what you said, the better
            one under it), the check or the day it comes back at its right. */}
        <ul className="mt-4" data-say-end-list>
          {queue.map((q) => {
            const r = results[q.swap.key];
            return (
              <li key={q.swap.key} className="flex min-h-12 items-center gap-3 py-2 text-detail font-normal">
                <SwapPair said={q.swap.said} better={q.swap.better} stacked className="flex-1" />
                {r === "said" ? (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sage-600 text-white">
                    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7.4l2.6 2.6L11 4.4" />
                    </svg>
                    <span className="sr-only">Said out loud</span>
                  </span>
                ) : (
                  <span className="font-display shrink-0 text-row font-semibold text-stone-500">{r ? "Back tomorrow" : "Not yet"}</span>
                )}
              </li>
            );
          })}
        </ul>
        {/* The next step rides with its tap, so a short screen never
            hides it under the shelf. */}
        <FooterShelf hairline={false}>
          <p className="mb-3 text-center text-body text-stone-500">Next, say one in today&apos;s practice.</p>
          <Link href={practice()} className={ACTION_CLASS}>
            Today&apos;s practice
          </Link>
          <div className="mt-1 flex justify-center">
            <Link href="/say" className="press flex min-h-11 items-center rounded-tap px-4 text-link text-stone-500">
              Done
            </Link>
          </div>
        </FooterShelf>
      </main>
    );
  }

  if (failedRead || (queue && queue.length === 0)) {
    return (
      <main data-trait="range" className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-5">
        <div className="pt-[env(safe-area-inset-top)]">
          <BackLink href="/say" label="Say it better" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <SayArt className="size-[132px]" />
          <h1 className="font-display mt-4 text-title">{failedRead ? "The test didn't load" : "Nothing to test today"}</h1>
          <p className="mt-1 max-w-[30ch] text-body text-pretty text-stone-500">
            {failedRead ? "Check your connection and try again." : "Say one in today's practice."}
          </p>
        </div>
        <FooterShelf hairline={false}>
          <Link href={failedRead ? "/say/test" : practice()} className={ACTION_CLASS}>
            {failedRead ? "Try again" : "Today's practice"}
          </Link>
        </FooterShelf>
      </main>
    );
  }

  /* ---- one swap ---------------------------------------------------------- */

  const total = queue?.length ?? 3;
  const answered = ANSWERED.has(phase);
  const src = item?.swap.repId ? phraseAt(words.get(item.swap.repId), item.swap.said) : null;
  const mode = phase === "said" ? "said" : phase === "missed" || phase === "shown" ? "answer" : "weak";

  return (
    <main data-trait="range" data-say-walk={phase} className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-5">
      {player.element}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      {line && <audio ref={lineAudio} src={line} preload="auto" />}
      <div className="flex items-center justify-between pt-[env(safe-area-inset-top)]">
        <BackLink href="/say" label="Say it better" />
        <span className="font-display text-link tabular-nums text-stone-500" aria-live="polite">
          {queue ? `${i + 1} of ${total}` : ""}
        </span>
      </div>
      {/* The walk's segments, each its own answer: sage where it was
          said out loud (earned), stone where it comes back tomorrow,
          the trough until it is answered. */}
      <div aria-hidden className="mt-1 flex h-1 w-full gap-1">
        {queue &&
          Array.from({ length: total }, (_, k) => {
            const r = queue[k] ? results[queue[k].swap.key] : undefined;
            return <span key={k} className={`h-1 min-w-3 flex-1 ${r === "said" ? "bg-sage-600" : r ? "bg-stone-400" : "bg-sand"}`} />;
          })}
      </div>

      {/* The stage: the object in the free height, your own words at its foot. */}
      <section aria-label="What you said" className="say-stage relative mt-4 flex min-h-[208px] flex-1 flex-col rounded-sheet px-5 pb-5 pt-3">
        {/* A size container with a definite size (cq units read 0 in a
            container whose height comes from flex-grow, as the lesson
            page's art notes), so the object takes the free height: up to
            280 on a tall phone, never a band of empty stage (#368). */}
        <div aria-hidden className="relative min-h-[64px] flex-1">
          <div className="absolute inset-0 flex items-center justify-center [container-type:size]">
            <SayArt className="size-[min(100cqh,280px)]" />
          </div>
        </div>
        {item ? (
          <>
            <p className="font-display mt-2 flex min-h-6 flex-wrap items-center gap-x-2 text-link tone-ink">
              <span>You said, {saidOn(item.saidOn)}</span>
              {src && item.swap.repId && (
                <SayChip
                  moment={{ repId: item.swap.repId, from: Math.max(0, src.start - 1), until: src.end + 2 }}
                  clock={clock(src.start)}
                  label={`${clock(src.start)}, play where you said it`}
                  player={player}
                />
              )}
            </p>
            <p data-say-sentence className="font-display mt-2 text-lead font-bold text-pretty text-ink">
              “
              {item.swap.sentence ? (
                <MarkedSentence sentence={item.swap.sentence} said={item.swap.said} better={item.swap.better} mode={mode} />
              ) : (
                <span className={mode === "weak" ? "say-weak" : mode === "said" ? "say-said" : "say-answer"}>
                  {mode === "weak" ? item.swap.said : item.swap.better}
                </span>
              )}
              ”
            </p>
          </>
        ) : (
          <div aria-hidden>
            <Skeleton className="mt-2 h-4 w-32" />
            <Skeleton className="mt-3 h-6 w-full" />
            <Skeleton className="mt-2 h-6 w-2/3" />
          </div>
        )}
      </section>

      {/* What happened, under the stage, one block at a time. */}
      <div className="mt-5 min-h-[56px] text-center" role="status">
        {phase === "said" ? (
          <>
            <p className="font-display flex items-center justify-center gap-2 text-detail text-sage-700" data-say-result="said">
              <svg aria-hidden width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7.4l2.6 2.6L11 4.4" />
              </svg>
              Said it
            </p>
            {line && (
              <button
                type="button"
                onClick={() => {
                  const a = lineAudio.current;
                  if (!a) return;
                  setAudioSession("playback");
                  a.currentTime = 0;
                  void a.play().catch(() => {});
                }}
                className="press mt-1 min-h-11 rounded-tap px-3 text-link text-stone-500"
              >
                Hear it back
              </button>
            )}
          </>
        ) : phase === "missed" ? (
          <div data-say-result="missed">
            <p className="font-display text-detail text-ink">
              You said “{check?.old ? item?.swap.said : shortHeard(check?.text ?? "")}”
            </p>
            <p className="mt-1 text-body text-stone-500">Back tomorrow</p>
          </div>
        ) : phase === "shown" ? (
          <p className="text-body text-stone-500" data-say-result="shown">
            Back tomorrow
          </p>
        ) : phase === "blocked" ? (
          <PermissionHelp video={false} missing={missing} onRecheck={() => void start()} />
        ) : (
          <>
            <h1 className="font-display text-title">Say it again, better</h1>
            <p className="mt-1 text-body text-stone-500">
              {phase === "recording"
                ? "Say the whole line, then Stop."
                : phase === "checking"
                  ? "Listening back…"
                  : phase === "unheard"
                    ? "That didn't come through. Say it again, a little closer."
                    : phase === "offline"
                      ? "You're offline. Show it instead, or say it once you're back."
                      : phase === "failed"
                        ? "That didn't go through. Try again."
                        : "Out loud, the whole sentence."}
            </p>
          </>
        )}
      </div>

      {/* The mic help is long: on a short phone it scrolls whole, its
          way out after it, rather than under a shelf that cuts it. */}
      <FooterShelf hairline={false} sticky={phase !== "blocked"} className="flex flex-col items-center">
        {answered ? (
          <button type="button" onClick={next} className={`${ACTION_CLASS} w-full`} data-say-next>
            {i + 1 >= total ? "See how you did" : "Next"}
          </button>
        ) : phase === "blocked" ? (
          <button type="button" onClick={() => answer("shown")} className="press min-h-11 rounded-tap px-4 text-link text-stone-500">
            Show it instead
          </button>
        ) : (
          <>
            <div className="relative">
              <svg aria-hidden className="rec-ring" data-on={phase === "recording" || undefined} viewBox="0 0 120 120">
                <circle className="rec-ring-track" cx="60" cy="60" r={RING_R} fill="none" strokeWidth="4" />
                <circle
                  className="rec-ring-fill"
                  cx="60"
                  cy="60"
                  r={RING_R}
                  fill="none"
                  strokeWidth="4"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - (phase === "recording" ? Math.min(1, seconds / LINE_MAX_S) : 0))}
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <button
                type="button"
                disabled={phase === "checking" || !item}
                onClick={phase === "recording" ? stop : () => void start()}
                aria-label={phase === "recording" ? "Stop and check this line" : undefined}
                data-record={phase === "recording" ? "stop" : "start"}
                className={`press font-display elev-3 relative h-24 w-24 rounded-full text-body font-bold transition-colors dur-base ${
                  phase === "recording" ? "bg-terracotta-600 text-cream" : phase === "checking" || !item ? DISABLED_CLASS : "rec-wait tap"
                }`}
              >
                {phase === "recording" ? "Stop" : phase === "checking" ? "Checking" : "Record"}
                {phase !== "checking" && item && <TapTick />}
              </button>
            </div>
            <button
              type="button"
              disabled={phase === "recording" || phase === "checking" || !item}
              onClick={() => answer("shown")}
              className="press mt-2 min-h-11 rounded-tap px-4 text-link text-stone-500 disabled:opacity-0"
            >
              Show it instead
            </button>
          </>
        )}
      </FooterShelf>
    </main>
  );
}

/** What Whisper heard, as a miss says it: the first few words. */
function shortHeard(text: string): string {
  const words = text.replace(/[“”"]/g, "").trim().split(/\s+/);
  return words.length > 7 ? `${words.slice(0, 7).join(" ")}…` : words.join(" ").replace(/[.!?,]+$/, "");
}
