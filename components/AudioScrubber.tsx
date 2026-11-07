"use client";

import { useEffect, useState, type ReactNode } from "react";
import { IconBubble, IconPauseSm, IconPlay } from "@/components/Icon";
import type { TakeAudio } from "@/components/TakeAudio";
import type { FillerHit, Pause } from "@/lib/metrics";

/**
 * Play the rep back with its own timeline marked up: tap any filler to
 * jump to the moment you said it. This is the honest version of
 * feedback — the user hears the evidence rather than taking our word
 * for it (vision.md: every claim traces to a timestamp).
 */
export function AudioScrubber({
  take,
  durationS,
  fillers,
  pauses,
  marks = [],
}: {
  /**
   * The take's one audio element (components/TakeAudio.tsx, #424), held
   * by the screen rather than by this card, so the transcript's word
   * sheet ("Said at 0:14", #411) and the Pause row's moments play the
   * same recording through the same element, one sound at a time.
   */
  take: TakeAudio;
  durationS: number;
  fillers: FillerHit[];
  pauses: Pause[];
  /**
   * When Demos cut in (the games plan, item 4): a rule on the track and a
   * chip that plays from a second before him, so the moment can be found
   * from every view of the take.
   */
  marks?: { t: number; label: string }[];
}) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);

  /* The element outlives this card (the walk's other steps play it too),
     so the key and the playhead read it as it is when the card mounts,
     then follow its events: a moment played elsewhere stops itself, and
     the key turns back to play when it does. */
  useEffect(() => {
    const a = take.ref.current;
    if (!a) return;
    setT(a.currentTime);
    setPlaying(!a.paused && !a.ended);
    const onTime = () => setT(a.currentTime);
    const onPlay = () => setPlaying(true);
    const onStop = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onStop);
    a.addEventListener("ended", onStop);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onStop);
      a.removeEventListener("ended", onStop);
    };
  }, [take.ref]);

  /*
   * Every start names its position (#406): the take's play seeks first,
   * a millisecond in when it starts from the top, and the key shows
   * pause once the element says it is playing.
   */
  function seek(to: number) {
    take.play(to);
  }

  function toggle() {
    const a = take.ref.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      seek(a.ended || a.currentTime >= durationS - 0.1 ? 0 : a.currentTime);
    }
  }

  const pct = (n: number) => (durationS > 0 ? (n / durationS) * 100 : 0);

  return (
    /* The card is the Fillers trait's ground (recording-20, system-9):
       its tone is what the filler ticks and their key wear, so Fillers
       is the same colour here as on Today, Lessons and the Log. */
    <div data-trait="fillers" className="card p-4">
      {/*
       * The legend is the header's right half (feedback round, 25 Sep):
       * a swatch and a word per mark, only for the marks this recording
       * actually has. It replaces the caption that used to explain the
       * track in a sentence under the chips, which a first-time user
       * said she would not read, and which the chips now say by looking
       * like what they are: buttons that play.
       */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="eyebrow">Hear it back</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-stone-500">
          {marks.length > 0 && (
            <Key mark={CUT_IN_MARK} thin>
              cut-in
            </Key>
          )}
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
      <div className="mt-4 flex items-center gap-3">
        {/* A key in the pills' own grammar: surface, hairline, the tap's
            colour in the glyph. The screen's one terracotta FILL is its
            way forward, not this (principle 2). SVG glyphs, because iOS
            can draw the text ones as emoji (recording-19). */}
        <button
          onClick={toggle}
          className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-edge bg-surface text-terracotta-500"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <IconPauseSm size={16} /> : <IconPlay size={16} />}
        </button>

        {/* The range is invisible over the track, so the track draws its
            keyboard focus (recording-19). */}
        <div className="relative flex-1 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-terracotta-500">
          {/* Track with pause bands and filler ticks. The ticks are marks,
              not controls: the range lies over them, so no tap could
              reach one, and each pill below already plays its filler. */}
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
              <span
                key={`f${i}`}
                aria-hidden
                className={`absolute top-0 h-full w-[3px] ${FILLER_MARK}`}
                style={{ left: `${pct(f.t)}%` }}
              />
            ))}
            {marks.map((m, i) => (
              <span
                key={`m${i}`}
                aria-hidden
                className={`absolute top-0 h-full w-[3px] ${CUT_IN_MARK}`}
                style={{ left: `${pct(m.t)}%` }}
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
            aria-label="Playback position"
            className="absolute inset-0 h-8 w-full cursor-pointer opacity-0"
          />
        </div>

        <span className="w-11 shrink-0 text-right text-caption tabular-nums text-stone-500">
          {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, "0")}
        </span>
      </div>

      {(fillers.length > 0 || marks.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {/* The cut-in first, played from a second before he spoke, so
              you hear him land and how you came back. */}
          {marks.map((m, i) => (
            <button
              key={`m${i}`}
              onClick={() => seek(m.t - 1)}
              /* The chip's own words first, so "Says who? 0:17" is its
                 name to Voice Control (WCAG 2.5.3), then what it does. */
              aria-label={`${m.label} ${Math.floor(m.t / 60)}:${String(Math.floor(m.t % 60)).padStart(2, "0")}, play from a second before Demos cut in`}
              className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-edge bg-surface py-1 pl-2.5 pr-3 text-link text-ink"
            >
              <span aria-hidden className="inline-flex text-stone-500">
                <IconBubble size={14} />
              </span>
              {m.label}
              <span className="font-normal tabular-nums text-stone-500">
                {Math.floor(m.t / 60)}:
                {String(Math.floor(m.t % 60)).padStart(2, "0")}
              </span>
            </button>
          ))}
          {fillers.map((f, i) => (
            <button
              key={i}
              onClick={() => seek(f.t - 0.4)}
              aria-label={`Play ${f.word} at ${Math.floor(f.t / 60)}:${String(Math.floor(f.t % 60)).padStart(2, "0")}`}
              className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-edge bg-surface py-1 pl-2.5 pr-3 text-link text-ink"
            >
              <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className="text-terracotta-500">
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
   the mark rather than a picture of it (review, 25 Sep). A filler wears
   the Fillers tone from the card's data-trait (recording-20); a held
   pause stays sage, because it is earned. */
const FILLER_MARK = "bg-[var(--tone)]";
const PAUSE_MARK = { pre: "bg-sage-500/40", mid: "bg-stone-400/30" } as const;
/* Demos's cut-in: ink, as on the pause map, at the filler's 3px so the
   2px playhead stays its own mark. */
const CUT_IN_MARK = "bg-ink/70";

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
  /* gap-1: the swatch sits 4px from its word and 12px from the next key,
     so each pair reads as one, and the three keys at the 13px caption
     (B05) still fit one line in a 320 card (248pt: 242 used). */
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="relative grid h-3 w-3 place-items-center overflow-hidden bg-sand">
        <span className={`${thin ? "h-full w-[3px]" : "absolute inset-0"} ${mark}`} />
      </span>
      {children}
    </span>
  );
}
