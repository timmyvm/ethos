"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
    <div className="elev-1 rounded-card border border-card-edge bg-raised p-4">
      {/*
       * The legend is the header's right half (feedback round, 25 Sep):
       * a swatch and a word per mark, only for the marks this recording
       * actually has. It replaces the caption that used to explain the
       * track in a sentence under the chips, which a first-time user
       * said she would not read, and which the chips now say by looking
       * like what they are: buttons that play.
       */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="label-data">Hear it back</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-stone-500">
          {fillers.length > 0 && (
            <Key mark={FILLER_MARK} thin>
              filler
            </Key>
          )}
          {pauses.some((p) => p.kind === "pre") && (
            <Key mark={PAUSE_MARK.pre}>held pause</Key>
          )}
          {pauses.some((p) => p.kind === "mid") && (
            <Key mark={PAUSE_MARK.mid}>mid-sentence</Key>
          )}
        </div>
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={ref} src={src} preload="metadata" />

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={toggle}
          className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-terracotta-500 text-[15px] text-on-accent"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>

        <div className="relative flex-1">
          {/* Track with pause bands and filler ticks */}
          <div className="relative h-8 overflow-hidden bg-sand">
            {pauses
              .filter((p) => p.kind !== "beat")
              .map((p, i) => (
                <span
                  key={`p${i}`}
                  className={`absolute top-0 h-full ${
                    p.kind === "pre" ? PAUSE_MARK.pre : PAUSE_MARK.mid
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
                className={`absolute top-0 h-full w-[3px] ${FILLER_MARK}`}
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

        <span className="w-11 shrink-0 text-right text-caption tabular-nums text-stone-500">
          {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, "0")}
        </span>
      </div>

      {fillers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {fillers.map((f, i) => (
            <button
              key={i}
              onClick={() => seek(f.t - 0.4)}
              aria-label={`Play ${f.word} at ${Math.floor(f.t / 60)}:${String(Math.floor(f.t % 60)).padStart(2, "0")}`}
              className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-edge bg-surface py-1 pl-2.5 pr-3 text-[13px] font-semibold text-ink"
            >
              <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className="text-terracotta-600">
                <path d="M2 1l7 4-7 4z" fill="currentColor" />
              </svg>
              {f.word}
              <span className="font-normal tabular-nums text-stone-500">
                {Math.floor(f.t / 60)}:
                {String(Math.floor(f.t % 60)).padStart(2, "0")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* One class per mark, shared by the track and its key, so the key is
   the mark rather than a picture of it (review, 25 Sep). */
const FILLER_MARK = "bg-terracotta-600";
const PAUSE_MARK = { pre: "bg-sage-500/40", mid: "bg-stone-400/30" } as const;

/** A key entry: the mark on a scrap of the track's own ground. */
function Key({
  mark,
  thin = false,
  children,
}: {
  mark: string;
  thin?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="relative grid h-3 w-3 place-items-center overflow-hidden bg-sand">
        <span className={`${thin ? "h-full w-[3px]" : "absolute inset-0"} ${mark}`} />
      </span>
      {children}
    </span>
  );
}
