"use client";

import { useEffect, useRef, useState } from "react";
import { CountUp } from "@/components/CountUp";
import { PremiumMark } from "@/components/PremiumMark";
import { Disclosure } from "@/components/ui/Disclosure";
import type { DeliveryMetrics, DeliveryMoment } from "@/lib/presence";

/**
 * Presence on the results screen (decisions 11 Aug, §1–§2).
 *
 * Rendered beside the Ethos Index at the same size, with its own
 * history — two scores, not one score with an asterisk. The Index is
 * audio-only and stays that way, so a week of Voice reps and a week of
 * Voice + Video reps are still comparable.
 *
 * The free/Premium line is the COST line, not the feature line. Pose
 * detection is local and free to serve, so the live ring during the rep
 * is free for everyone. What Premium buys is this readout: the score, the
 * timestamped moments, the trendline, and playback with markers.
 */
export function PresenceScore({
  score,
  previous,
  premium,
  onUpgrade,
}: {
  score: number;
  previous: number | null;
  premium: boolean;
  onUpgrade: () => void;
}) {
  const delta = previous !== null ? score - previous : null;

  if (!premium) {
    return (
      <button
        onClick={onUpgrade}
        className="press card flex w-full items-baseline gap-3.5 p-4 text-left"
      >
        <div className="font-display text-num-l text-stone-400">
          ···
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-body font-semibold">
              your Presence{" "}
              <span className="font-normal text-stone-500">/1000</span>
            </div>
            {/* The ellipsis stays a placeholder rather than becoming a
                mark: what the tier is goes in the chip, and the number
                is still shown to be there (#73, #280). */}
            <PremiumMark variant="chip" />
          </div>
          <div className="text-caption text-stone-500">
            Measured on this device. Tap to read it.
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="flex items-baseline gap-3.5">
      <CountUp
        value={score}
        className="font-display text-num-hero tabular-nums"
      />
      <div>
        <div className="text-body font-semibold">
          your Presence <span className="font-normal text-stone-500">/1000</span>
        </div>
        {delta !== null && delta !== 0 && (
          <div
            className={`text-caption font-semibold ${
              delta > 0 ? "text-sage-700" : "text-stone-500"
            }`}
          >
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} since last video
          </div>
        )}
      </div>
    </div>
  );
}

export function PresenceDetail({
  metrics,
  moments,
  premium,
  videoUrl,
  onUpgrade,
}: {
  metrics: DeliveryMetrics;
  moments: DeliveryMoment[];
  premium: boolean;
  /** A local object URL. The clip was never uploaded and never will be. */
  videoUrl: string | null;
  onUpgrade: () => void;
}) {
  if (!premium) {
    return (
      /* A door, like the free Presence score above it: the whole card
         is the tap, PremiumMark names the tier, and the chevron says it
         goes somewhere. It wore a plum-50 wash with a terracotta button,
         a third plum surface and a second terracotta fill on a screen
         whose way forward is already terracotta (principle 2, #280). */
      <button
        onClick={onUpgrade}
        className="press card mt-7 block w-full p-4 text-left"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="eyebrow">Delivery</span>
          <PremiumMark variant="chip" />
        </span>
        <span className="mt-2 block text-body text-stone-600 text-pretty">
          Your camera measured posture, gesture, head movement and eye line
          for the whole recording, on this device.{" "}
          {moments.length > 0 && (
            <>
              There {moments.length === 1 ? "is" : "are"} {moments.length}{" "}
              timestamped moment{moments.length === 1 ? "" : "s"} in it.
            </>
          )}
        </span>
        <span className="mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-hairline pt-3">
          <span className="font-display text-row text-ink">See the readout</span>
          <Disclosure />
        </span>
      </button>
    );
  }

  return (
    <>
      {videoUrl && <VideoWithMarkers url={videoUrl} moments={moments} />}

      {moments.length > 0 && (
        <section className="mt-7">
          <h2 className="section-head">Delivery</h2>
          <ul className="mt-3 space-y-2">
            {moments.map((m, i) => (
              <li key={i} className="text-body text-stone-600">
                {m.note}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Three stats in one card, the results' metric grammar (log-7). */}
      <div className="card mt-3 grid grid-cols-3 divide-x divide-hairline">
        <Stat
          label="Eye line"
          value={`${metrics.eyeLinePct}%`}
          note="head up, facing"
        />
        <Stat
          label="Gestures"
          value={`${metrics.gestureRate}`}
          note="per minute"
        />
        <Stat
          label="Posture"
          value={metrics.postureDrift.toFixed(2)}
          note="drift, lower is steadier"
        />
      </div>
    </>
  );
}

/**
 * Playback with markers, from an object URL held in memory for this
 * screen only. The clip is never uploaded, so it genuinely goes away
 * when you leave — which the copy says out loud rather than letting
 * someone assume there's a video library somewhere.
 */
function VideoWithMarkers({
  url,
  moments,
}: {
  url: string;
  moments: DeliveryMoment[];
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onMeta = () =>
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    v.addEventListener("loadedmetadata", onMeta);
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, []);

  return (
    <div className="card mt-7 p-4">
      <div className="eyebrow">Playback</div>
      <video
        ref={ref}
        src={url}
        controls
        playsInline
        className="mt-3 w-full rounded-control bg-stage"
      />
      {duration > 0 && moments.length > 0 && (
        <div className="relative mt-3 h-2 bg-sand">
          {moments.map((m, i) => (
            <button
              key={i}
              onClick={() => {
                if (ref.current) ref.current.currentTime = m.t;
              }}
              aria-label={m.note}
              title={m.note}
              className="absolute top-1/2 h-3.5 w-1.5 -translate-y-1/2 bg-sage-500"
              style={{ left: `${Math.min(99, (m.t / duration) * 100)}%` }}
            />
          ))}
        </div>
      )}
      <p className="mt-3 text-caption leading-relaxed text-stone-500">
        This clip never left your device. Leave the screen and it&apos;s
        gone; the five numbers stay.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="min-w-0 px-3 py-4">
      <div className="label-micro whitespace-nowrap">{label}</div>
      <div className="font-display mt-1.5 text-num-m tabular-nums">{value}</div>
      <div className="mt-1 text-caption text-balance text-stone-500">{note}</div>
    </div>
  );
}
