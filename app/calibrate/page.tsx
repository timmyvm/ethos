"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
        `const SLUMP_GOOD = ${proposal.slumpGood};`,
        `const SLUMP_BAD = ${proposal.slumpBad};`,
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

  return (
    <main className="px-5 pb-16 pt-7">
      <Link href="/settings" className="text-sm text-stone-500">
        ← settings
      </Link>
      <h1 className="font-display mt-5 text-[27px]">Calibrate the camera</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-stone-500">
        Four takes, 20 seconds each, through the real engine. The numbers
        it measures become the proposed thresholds for the Presence score.
        Nothing recorded here leaves this page.
      </p>

      {/* The model assumes a static camera. The first real session was
          shot handheld and every number came out polluted, so the setup
          is stated before the mic, not diagnosed after. */}
      <div className="mt-4 rounded-[24px] border border-hairline bg-surface lift p-4">
        <div className="label-data">Set up first</div>
        <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-stone-600">
          <li>· Prop the phone at face height. Never in your hand.</li>
          <li>· Step back until head, shoulders and both hands are in frame.</li>
          <li>· Look-away notes go somewhere that isn&apos;t the phone.</li>
        </ul>
      </div>

      {status === "idle" && (
        <button
          onClick={() => void startCamera()}
          className="press mt-6 w-full rounded-full bg-terracotta-500 px-6 py-4 text-base font-semibold text-cream"
        >
          Start the camera
        </button>
      )}
      {status === "starting" && (
        <p className="mt-6 text-[14px] text-stone-500">Opening the camera…</p>
      )}
      {status === "unavailable" && (
        <p className="mt-6 rounded-[20px] bg-terracotta-50 px-4 py-3 text-[13.5px] leading-relaxed text-terracotta-700">
          The camera or the pose engine didn&apos;t load. Check the
          permission, or try Chrome.
        </p>
      )}

      {/* Always mounted: startCamera attaches the stream to this ref,
          and an element that only renders AFTER the camera opens is an
          element that wasn't there to attach to — no preview, and the
          sampler reads a dead video as zero frames. Hidden, not absent,
          until the stream is up. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`mt-5 w-full -scale-x-100 rounded-[24px] border border-hairline ${
          status === "ready" || status === "recording" ? "" : "hidden"
        }`}
      />

      {(status === "ready" || status === "recording") && (
        <>
          {done.length < TAKES.length && (
            <div className="mt-4 rounded-[24px] border border-hairline bg-surface lift p-5">
              <div className="label-data">
                Take {current + 1} of {TAKES.length} · {take.name}
              </div>
              <p className="mt-1.5 text-[14px] leading-relaxed text-stone-600">
                {take.brief}
              </p>
              {note && (
                <p className="mt-2 text-[13px] text-terracotta-700">{note}</p>
              )}
              {status === "ready" ? (
                <button
                  onClick={() => void record()}
                  className="press mt-4 w-full rounded-full bg-terracotta-500 px-6 py-3.5 text-[15px] font-semibold text-cream"
                >
                  Record {TAKE_SECONDS}s
                </button>
              ) : (
                <div className="font-display mt-4 text-center text-[40px] tabular-nums">
                  {left}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {done.length > 0 && (
        <div className="mt-6">
          <div className="section-title">Measured</div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left">
                  <th className="label-data pb-1.5 pr-3 font-normal">take</th>
                  <th className="label-data pb-1.5 pr-3 font-normal">gest/min</th>
                  <th className="label-data pb-1.5 pr-3 font-normal">drift</th>
                  <th className="label-data pb-1.5 pr-3 font-normal">head</th>
                  <th className="label-data pb-1.5 pr-3 font-normal">eyes %</th>
                  <th className="label-data pb-1.5 pr-3 font-normal">lift</th>
                  <th className="label-data pb-1.5 pr-3 font-normal">score</th>
                  <th className="pb-1.5" aria-label="Redo" />
                </tr>
              </thead>
              <tbody>
                {done.map((d) => (
                  <tr key={d.label} className="border-t border-hairline">
                    <td className="py-2 pr-3 font-semibold">{d.label}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {d.result.metrics.gestureRate}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {d.result.metrics.postureDrift}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {d.result.metrics.headStability}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {d.result.metrics.eyeLinePct}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {d.result.metrics.headLift ?? "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {d.result.metrics.presenceScore}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => redo(d.label)}
                        className="press min-h-11 px-1 text-[12px] font-semibold text-stone-500"
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
        <div className="mt-6">
          <div className="section-title">Proposed constants</div>
          {proposal.warnings.map((w, i) => (
            <p
              key={i}
              className="mt-2 rounded-[20px] bg-terracotta-50 px-4 py-3 text-[13px] leading-relaxed text-terracotta-700"
            >
              {w}
            </p>
          ))}
          <pre className="mt-3 overflow-x-auto rounded-[20px] bg-ink p-4 text-[12px] leading-relaxed text-ground">
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
              className="press flex-1 rounded-full border border-stone-200 bg-surface px-5 py-3 text-[14px] font-semibold"
            >
              {copied ? "Copied" : "Copy for lib/presence.ts"}
            </button>
            <button
              onClick={download}
              className="press flex-1 rounded-full border border-stone-200 bg-surface px-5 py-3 text-[14px] font-semibold"
            >
              Download takes
            </button>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-stone-400">
            Paste the block over the constants in lib/presence.ts, or hand
            the download to a build session. The raw frames are included,
            so candidate constants can be re-scored offline.
          </p>
        </div>
      )}
    </main>
  );
}
