"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FooterShelf } from "@/components/ui/FooterShelf";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ACTION_CLASS, DISABLED_CLASS } from "@/lib/ui";
import { loadPose, samplePose, type PoseSampler } from "@/lib/pose-client";
import {
  PRESENCE_CONSTANTS,
  scorePresence,
  type PoseFrame,
  type PresenceResult,
} from "@/lib/presence";
import {
  proposeConstants,
  type LabeledTake,
  type TakeLabel,
} from "@/lib/presence-fit";

/**
 * The Presence calibration bench (DECISIONS #187). Every constant in
 * lib/presence.ts is a v1 guess that has never met a real body; this
 * page runs four labeled 20-second takes through the REAL sampler and
 * the REAL scorer, then proposes a constant set from what was measured.
 * Off the nav on purpose: it's a bench, not a screen. Settings links it.
 */

const TAKE_SECONDS = 20;

/** A failure or a warning in the error grammar (system-10, #246): the
 *  control surface with rust words, as the auth forms and Upload draw
 *  it. Terracotta means tap. */
const NOTICE_CLASS =
  "rounded-control border border-edge bg-surface px-4 py-3 text-caption leading-relaxed text-rust";

/** The setup, as the ordered steps they are (modes-18). */
const SETUP = [
  "Prop the phone at face height.",
  "Step back until your head, shoulders and hands are in frame.",
  "Put look-away notes off to one side.",
];

const TAKES: { label: TakeLabel; name: string; brief: string }[] = [
  {
    label: "composed",
    name: "Composed",
    brief:
      "Speak naturally about anything. Gesture like you mean it. Eyes at the lens.",
  },
  {
    label: "slouch",
    name: "Slouch",
    brief: "Deliberately slumped. Lean, shift, sag. Keep talking.",
  },
  {
    label: "look-away",
    name: "Look away",
    brief: "Eyes on notes or a second screen the whole time. Off the lens.",
  },
  {
    label: "hands-hidden",
    name: "Hands hidden",
    brief: "Hands in pockets or under the desk. Hold still. Keep talking.",
  },
];

interface DoneTake {
  label: TakeLabel;
  result: PresenceResult;
  frames: PoseFrame[];
}

export default function CalibratePage() {
  const [status, setStatus] = useState<
    "idle" | "starting" | "ready" | "recording" | "unavailable"
  >("idle");
  const [current, setCurrent] = useState(0);
  const [left, setLeft] = useState(TAKE_SECONDS);
  const [done, setDone] = useState<DoneTake[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplerRef = useRef<PoseSampler | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const teardown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    samplerRef.current?.stop();
    samplerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  async function startCamera() {
    setStatus("starting");
    setNote(null);
    try {
      const [stream, landmarker] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        }),
        loadPose(),
      ]);
      if (!landmarker) {
        stream.getTracks().forEach((t) => t.stop());
        setStatus("unavailable");
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        // Shouldn't happen now the element is always mounted; refusing
        // beats a bench that records nothing and blames your framing.
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStatus("unavailable");
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {});
      setStatus("ready");
    } catch {
      setStatus("unavailable");
    }
  }

  async function record() {
    const video = videoRef.current;
    const landmarker = await loadPose();
    if (!video || !landmarker || !streamRef.current) return;
    setNote(null);
    setLeft(TAKE_SECONDS);
    setStatus("recording");
    samplerRef.current = samplePose(video, landmarker);
    timerRef.current = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          finishTake();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function finishTake() {
    if (timerRef.current) clearInterval(timerRef.current);
    const frames = samplerRef.current?.stop() ?? [];
    samplerRef.current = null;
    const result = scorePresence(frames);
    setStatus("ready");
    if (!result.scorable) {
      // Zero RAW frames is our failure (the video never delivered), not
      // the user's framing. Say which one happened.
      setNote(
        frames.length === 0
          ? "The camera stream never reached the engine. Reload the page and try again."
          : `Only ${result.usableFrames} usable frames. Fill the frame (head and shoulders) and go again.`
      );
      return;
    }
    const take = TAKES[current];
    setDone((d) => [
      ...d.filter((x) => x.label !== take.label),
      { label: take.label, result, frames },
    ]);
    // Wander this size on ANY take usually means the phone moved, and a
    // handheld take poisons the fit. Said now, while redoing is cheap.
    if (result.metrics.postureDrift > 0.08) {
      setNote(
        `That take's torso wander (${result.metrics.postureDrift}) usually means the phone itself moved. Prop it and redo the take.`
      );
    }
    if (current < TAKES.length - 1) setCurrent(current + 1);
  }

  function redo(label: TakeLabel) {
    setDone((d) => d.filter((x) => x.label !== label));
    setCurrent(TAKES.findIndex((t) => t.label === label));
    setNote(null);
  }

  const labeled: LabeledTake[] = done.map((d) => ({
    label: d.label,
    metrics: d.result.metrics,
  }));
  const proposal = done.length === TAKES.length ? proposeConstants(labeled) : null;

  const proposalText = proposal
    ? [
        `const GESTURE_ZONE: [number, number] = [${proposal.gestureZone[0]}, ${proposal.gestureZone[1]}];`,
        `const POSTURE_GOOD = ${proposal.postureGood};`,
        `const POSTURE_BAD = ${proposal.postureBad};`,
        `const HEAD_GOOD = ${proposal.headGood};`,
        `const HEAD_BAD = ${proposal.headBad};`,
        `const EYE_GOOD = ${proposal.eyeGood};`,
        `const EYE_BAD = ${proposal.eyeBad};`,
        `const NECK_GOOD = ${proposal.neckGood};`,
        `const NECK_BAD = ${proposal.neckBad};`,
      ].join("\n")
    : "";

  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            recordedAt: new Date().toISOString(),
            current: PRESENCE_CONSTANTS,
            proposal,
            takes: done.map((d) => ({
              label: d.label,
              metrics: d.result.metrics,
              usableFrames: d.result.usableFrames,
              frames: d.frames,
            })),
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "presence-calibration.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const take = TAKES[current];
  /* The stream is up: the bench (the self-view, the take card, the
     table) replaces the setup screen's frame and shelf. */
  const live = status === "ready" || status === "recording";

  return (
    <main className={`flex min-h-dvh flex-col px-5 pt-7 ${live ? "pb-16" : ""}`}>
      {/* Settings' own header, one push in (modes-17): the 34/800 large
          title that hands over to the bar, not a 26/700 one under a
          back link. */}
      <ScreenHeader
        title="Calibrate the camera"
        back={{ href: "/settings", label: "Settings" }}
      />
      <p className="mt-3 text-read text-stone-800 text-pretty">
        {TAKES.length} takes of {TAKE_SECONDS} seconds through the real
        engine set the Presence thresholds. Nothing leaves this page.
      </p>

      {/* The model assumes a static camera. The first real session was
          shot handheld and every number came out polluted, so the setup
          is stated before the mic, not diagnosed after. */}
      <div className="card mt-7 p-4">
        <p className="eyebrow">Set up first</p>
        <ol className="mt-3 space-y-2.5 text-body text-ink">
          {SETUP.map((step, i) => (
            <li key={step} className="flex gap-2.5">
              <span
                aria-hidden
                className="font-display w-4 shrink-0 font-extrabold tabular-nums text-stone-400"
              >
                {i + 1}
              </span>
              <span className="text-pretty">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/*
       * R3 (principle 7): the frame the camera will fill takes the free
       * height while the camera is off, and the one tap is docked at the
       * foot (B6's offer, which C1 rejected), so the setup and the place
       * you are about to stand in read as one screen instead of a list
       * over 400px of blank. The frame is the self-view's own box: the
       * video is always mounted in it (startCamera attaches the stream to
       * this ref, and an element that only renders AFTER the camera opens
       * was not there to attach to: no preview, and the sampler read a
       * dead video as zero frames). Until the stream is up it shows where
       * to stand, head and shoulders in frame; once it is up it wears the
       * recording screen's frame (the stage behind it, a hairline ring,
       * the sheet radius) at the stream's own shape.
       */}
      <div
        className={`relative mt-7 overflow-hidden rounded-sheet ${
          live ? "bg-stage ring-2 ring-hairline" : "min-h-[200px] flex-1 bg-surface"
        }`}
      >
        {!live && <FrameGuide />}
        {status === "starting" && (
          <p
            role="status"
            className="absolute inset-x-0 bottom-4 text-center text-caption text-stone-500"
          >
            Opening the camera…
          </p>
        )}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`block w-full -scale-x-100 ${live ? "" : "hidden"}`}
        />
      </div>

      {!live && (
        <FooterShelf hairline={false}>
          {status === "unavailable" ? (
            <>
              <p role="alert" className={`mb-3 ${NOTICE_CLASS}`}>
                The camera or the pose engine didn&apos;t load. Check the
                permission, or try Chrome.
              </p>
              {/* A failure always offers the retry, in the control
                  grammar rather than the tap colour (ErrorState, #146). */}
              <button
                type="button"
                onClick={() => void startCamera()}
                className="press font-display min-h-12 w-full rounded-control border border-edge bg-surface px-4 text-row"
              >
                Try again
              </button>
            </>
          ) : (
            /* Held in place, disabled, while the camera opens, so the
               shelf does not change under the finger that tapped it. */
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={status === "starting"}
              className={`${ACTION_CLASS} ${DISABLED_CLASS}`}
            >
              Start the camera
            </button>
          )}
        </FooterShelf>
      )}

      {live && (
        <>
          {done.length < TAKES.length && (
            <div className="card elev-2 mt-3 p-4">
              {/* One idea per eyebrow (M05): the count over the take's
                  name, never "Take 1 of 4 · Composed". */}
              <p className="eyebrow">
                Take {current + 1} of {TAKES.length}
              </p>
              <h2 className="detail-head mt-1">{take.name}</h2>
              <p className="mt-2 text-read text-stone-800 text-pretty">
                {take.brief}
              </p>
              {note && (
                <p role="alert" className={`mt-3 ${NOTICE_CLASS}`}>
                  {note}
                </p>
              )}
              {status === "ready" ? (
                <button
                  onClick={() => void record()}
                  className={`${ACTION_CLASS} mt-4`}
                >
                  Record {TAKE_SECONDS}s
                </button>
              ) : (
                <div
                  role="timer"
                  className="font-display mt-4 text-center text-num-hero tabular-nums"
                >
                  {left}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {done.length > 0 && (
        <div className="mt-7">
          <h2 className="section-head">Measured</h2>
          {/* Column heads are the micro register: at 11/0.10em these
              were wider than the numbers under them (#234). */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-caption">
              <thead>
                <tr className="text-left">
                  <th scope="col" className="label-micro pb-2 pr-3">take</th>
                  <th scope="col" className="label-micro pb-2 pr-3">gest/min</th>
                  <th scope="col" className="label-micro pb-2 pr-3">drift</th>
                  <th scope="col" className="label-micro pb-2 pr-3">head</th>
                  <th scope="col" className="label-micro pb-2 pr-3">eyes %</th>
                  <th scope="col" className="label-micro pb-2 pr-3">lift</th>
                  <th scope="col" className="label-micro pb-2 pr-3">neck</th>
                  <th scope="col" className="label-micro pb-2 pr-3">score</th>
                  <th scope="col" className="pb-2" aria-label="Redo" />
                </tr>
              </thead>
              <tbody>
                {done.map((d) => (
                  <tr key={d.label} className="border-t border-hairline">
                    <td className="font-display py-3 pr-3 font-bold">
                      {d.label}
                    </td>
                    <td className="py-3 pr-3 tabular-nums">
                      {d.result.metrics.gestureRate}
                    </td>
                    <td className="py-3 pr-3 tabular-nums">
                      {d.result.metrics.postureDrift}
                    </td>
                    <td className="py-3 pr-3 tabular-nums">
                      {d.result.metrics.headStability}
                    </td>
                    <td className="py-3 pr-3 tabular-nums">
                      {d.result.metrics.eyeLinePct}
                    </td>
                    <td className="py-3 pr-3 tabular-nums">
                      {d.result.metrics.headLift ?? "–"}
                    </td>
                    <td className="py-3 pr-3 tabular-nums">
                      {d.result.metrics.neckGap ?? "–"}
                    </td>
                    <td className="font-display py-3 pr-3 font-extrabold tabular-nums">
                      {d.result.metrics.presenceScore}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => redo(d.label)}
                        className="text-link press min-h-11 px-1"
                      >
                        redo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {proposal && (
        <div className="mt-7">
          <h2 className="section-head">Proposed constants</h2>
          {proposal.warnings.map((w, i) => (
            <p key={i} role="alert" className={`mt-3 ${NOTICE_CLASS}`}>
              {w}
            </p>
          ))}
          {/* Code is the deep material the loop uses for its own panels:
              stage, never ink-on-ground. */}
          <pre className="elev-1 mt-3 overflow-x-auto rounded-card bg-stage p-4 text-caption leading-relaxed text-cream">
            {proposalText}
          </pre>
          <div className="mt-3 flex gap-2.5">
            <button
              onClick={() => {
                navigator.clipboard
                  ?.writeText(proposalText)
                  .then(() => setCopied(true))
                  .catch(() => {});
              }}
              className="press font-display min-h-12 flex-1 rounded-control border border-edge bg-surface px-4 text-row"
            >
              {copied ? "Copied" : "Copy for lib/presence.ts"}
            </button>
            <button
              onClick={download}
              className="press font-display min-h-12 flex-1 rounded-control border border-edge bg-surface px-4 text-row"
            >
              Download takes
            </button>
          </div>
          <p className="mt-3 text-caption leading-relaxed text-stone-400">
            Paste the block over the constants in lib/presence.ts, or hand
            the download to a build session. The raw frames are included,
            so candidate constants can be re-scored offline.
          </p>
        </div>
      )}
    </main>
  );
}

/**
 * Where to stand, drawn in the frame while the camera is off (R3): the
 * viewfinder's four corners and a head and shoulders, the setup's
 * second step as a picture. The figure scales with the frame (a size
 * container over the flex-grown box, the `.demos-fit` pattern) and
 * keeps a 2px line at any size.
 */
function FrameGuide() {
  const corner = "absolute size-6 border-stone-400";
  return (
    <div aria-hidden className="absolute inset-0">
      <span className={`${corner} left-4 top-4 rounded-tl-lg border-l-2 border-t-2`} />
      <span className={`${corner} right-4 top-4 rounded-tr-lg border-r-2 border-t-2`} />
      <span className={`${corner} bottom-4 left-4 rounded-bl-lg border-b-2 border-l-2`} />
      <span className={`${corner} bottom-4 right-4 rounded-br-lg border-b-2 border-r-2`} />
      <div className="absolute inset-0 flex items-end justify-center [container-type:size]">
        <svg
          viewBox="0 0 120 132"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-[72cqh] max-h-[260px] w-auto text-stone-300"
        >
          <circle cx="60" cy="40" r="26" vectorEffect="non-scaling-stroke" />
          <path
            d="M8 132 C8 98 30 80 60 80 C90 80 112 98 112 132"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}
