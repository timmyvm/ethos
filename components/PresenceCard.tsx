"use client";

import { useEffect, useRef, useState } from "react";
import { CountUp } from "@/components/CountUp";
import type { DeliveryMetrics, DeliveryMoment } from "@/lib/presence";

/**
 * Presence on the results screen (decisions 11 Aug, §1–§2).
 *
 * Rendered beside the Ethos Index at the same size, with its own
 * history — two scores, not one score with an asterisk. The Index is
 * audio-only and stays that way, so a week of Voice reps and a week of
 * Voice + Video reps are still comparable.
 *
 * The free/Pro line is the COST line, not the feature line. Pose
 * detection is local and free to serve, so the live ring during the rep
 * is free for everyone. What Pro buys is this readout: the score, the
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
        className="press mt-3 flex w-full items-baseline gap-3.5 rounded-[18px] border border-hairline bg-surface lift p-4 text-left"
      >
        <div className="font-display text-[44px] font-bold leading-none text-stone-300">
          ···
        </div>
        <div>
          <div className="text-[15px] font-semibold">
            your Presence{" "}
            <span className="font-normal text-stone-500">/1000</span>
          </div>
          <div className="text-[13px] text-stone-500">
            Measured on this device. Tap to read it.
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="mt-3 flex items-baseline gap-3.5">
      <CountUp
        value={score}
        className="font-display text-[64px] font-bold leading-none"
      />
      <div>
        <div className="text-[15px] font-semibold">
          your Presence <span className="font-normal text-stone-500">/1000</span>
        </div>
        {delta !== null && delta !== 0 && (
          <div
            className={`text-[13px] font-semibold ${
              delta > 0 ? "text-amber-500" : "text-stone-500"
            }`}
          >
            {delta > 0 ? "▲ +" : "▼ "}
            {delta} since last video
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
      <div className="mt-4 rounded-[18px] border border-terracotta-100 bg-terracotta-50 p-5">
        <div className="label-data !text-terracotta-600">
          Delivery · measured, not yet read out
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-stone-600">
          Your camera measured posture, gesture, head movement and eye line
          for the whole recording, on this device.{" "}
          {moments.length > 0 && (
            <>
              There {moments.length === 1 ? "is" : "are"} {moments.length}{" "}
              timestamped moment{moments.length === 1 ? "" : "s"} in it.
            </>
          )}
        </p>
        <button
          onClick={onUpgrade}
          className="press mt-3 w-full rounded-[13px] bg-terracotta-500 px-4 py-3 text-[15px] font-semibold text-cream"
        >
          See the readout
        </button>
      </div>
    );
  }

  return (
    <>
      {videoUrl && <VideoWithMarkers url={videoUrl} moments={moments} />}

      {moments.length > 0 && (
        <div className="mt-4 rounded-[18px] border border-hairline bg-surface lift p-5">
          <div className="label-data">Delivery · with timestamps</div>
          <ul className="mt-2.5 space-y-2">
            {moments.map((m, i) => (
              <li key={i} className="text-[13.5px] leading-relaxed text-stone-600">
                {m.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex gap-3">
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
    <div className="mt-4 rounded-[18px] border border-hairline bg-surface lift p-4">
      <div className="label-data">Playback · this device only</div>
      <video
        ref={ref}
        src={url}
        controls
        playsInline
        className="mt-2.5 w-full rounded-[12px] bg-stage"
      />
      {duration > 0 && moments.length > 0 && (
        <div className="relative mt-2 h-2 rounded-full bg-sand">
          {moments.map((m, i) => (
            <button
              key={i}
              onClick={() => {
                if (ref.current) ref.current.currentTime = m.t;
              }}
              aria-label={m.note}
              title={m.note}
              className="absolute top-1/2 h-3.5 w-1.5 -translate-y-1/2 rounded-full bg-amber-500"
              style={{ left: `${Math.min(99, (m.t / duration) * 100)}%` }}
            />
          ))}
        </div>
      )}
      <p className="mt-2.5 text-[12px] leading-relaxed text-stone-500">
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
    <div className="flex-1 rounded-[18px] border border-hairline bg-surface lift p-3.5">
      <div className="label-data">{label}</div>
      <div className="font-display text-[26px] font-bold">{value}</div>
      <div className="text-[11.5px] text-stone-500">{note}</div>
    </div>
  );
}
