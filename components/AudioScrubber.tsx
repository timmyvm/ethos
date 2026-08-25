"use client";

import { useEffect, useRef, useState } from "react";
import type { FillerHit, Pause } from "@/lib/metrics";

/**
 * Play the rep back with its own timeline marked up: tap any filler to
 * jump to the moment you said it. This is the honest version of
 * feedback — the user hears the evidence rather than taking our word
 * for it (vision.md: every claim traces to a timestamp).
 */
export function AudioScrubber({
  src,
  durationS,
  fillers,
  pauses,
}: {
  src: string;
  durationS: number;
  fillers: FillerHit[];
  pauses: Pause[];
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setT(a.currentTime);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  function seek(to: number) {
    const a = ref.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(durationS - 0.05, to));
    void a.play();
    setPlaying(true);
  }

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play();
      setPlaying(true);
    }
  }

  const pct = (n: number) => (durationS > 0 ? (n / durationS) * 100 : 0);

  return (
    <div className="rounded-[24px] border border-hairline bg-surface lift p-5">
      <div className="label-data">Hear it back</div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={ref} src={src} preload="metadata" />

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={toggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracotta-500 text-cream"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>

        <div className="relative flex-1">
          {/* Track with pause bands and filler ticks */}
          <div className="relative h-8 overflow-hidden rounded-lg bg-sand">
            {pauses
              .filter((p) => p.kind !== "beat")
              .map((p, i) => (
                <span
                  key={`p${i}`}
                  className={`absolute top-0 h-full ${
                    p.kind === "pre" ? "bg-sage-500/40" : "bg-stone-400/30"
                  }`}
                  style={{ left: `${pct(p.t)}%`, width: `${pct(p.len)}%` }}
                />
              ))}
            {fillers.map((f, i) => (
              <button
                key={`f${i}`}
                onClick={() => seek(f.t - 0.4)}
                title={`${f.word} at ${f.t.toFixed(1)}s`}
                aria-label={`Jump to ${f.word}`}
                className="absolute top-0 h-full w-[3px] bg-terracotta-600"
                style={{ left: `${pct(f.t)}%` }}
              />
            ))}
            <span
              className="absolute top-0 h-full w-[2px] bg-ink"
              style={{ left: `${pct(t)}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(durationS, 0.1)}
            step={0.1}
            value={t}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Scrub"
            className="absolute inset-0 h-8 w-full cursor-pointer opacity-0"
          />
        </div>

        <span className="w-11 shrink-0 text-right text-[12px] tabular-nums text-stone-500">
          {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, "0")}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {fillers.map((f, i) => (
          <button
            key={i}
            onClick={() => seek(f.t - 0.4)}
            className="rounded-full bg-sand px-2.5 py-1 text-[12.5px] transition-colors hover:bg-terracotta-100"
          >
            {f.word}{" "}
            <span className="text-stone-500">
              {Math.floor(f.t / 60)}:
              {String(Math.floor(f.t % 60)).padStart(2, "0")}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-stone-400">
        Amber bands are silence you held. Tap a word to hear the moment.
      </p>
    </div>
  );
}
