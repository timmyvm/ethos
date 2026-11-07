"use client";

import { useEffect, useState, type ReactNode } from "react";
import { IconBubble, IconPauseSm, IconPlay } from "@/components/Icon";
import { LANDED_MARK } from "@/components/PauseBar";
import type { TakeAudio } from "@/components/TakeAudio";
import type { FillerHit, Pause } from "@/lib/metrics";
import { heldPauseMarks, landedAt, pauseMark, PAUSE_MARK_WORDS, type MarkedPause, type PauseMark } from "@/lib/pause-mark";

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
  /**
   * The take's pauses with the verdicts it stored and showed: each band
   * is marked by its verdict, as the pause map marks it, so a pause the
   * Pause row calls filled is never drawn as earned here (#424). A row
   * from before verdicts is marked by its kind.
   */
  pauses: (Pause & MarkedPause)[];
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
  const held = heldPauseMarks(pauses);
  const onLanded = landedAt(pauses, t);

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
          {held.landed > 0 && (
            <Key mark={PAUSE_MARK.landed}>{PAUSE_MARK_WORDS.landed}</Key>
          )}
          {held.searching > 0 && (
            <Key mark={PAUSE_MARK.searching}>{PAUSE_MARK_WORDS.searching}</Key>
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
              reach one, and each pill below already plays its filler.
              A band starts at its pause's second and is never under
              4px: a short pause on a long take grows to the right, so
              where it starts stays true (#425). */}
          <div className="relative h-8 overflow-hidden bg-sand">
            {pauses
              .filter((p) => p.kind !== "beat")
              .map((p, i) => {
                const mark = pauseMark(p);
                return (
                  <span
                    key={`p${i}`}
                    aria-hidden
                    data-pause-mark={mark}
                    className={`absolute top-0 h-full ${BAND_MIN} ${PAUSE_MARK[mark]}`}
                    style={{ left: `${pct(p.t)}%`, width: `${pct(p.len)}%` }}
                  />
                );
              })}
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
            {/* The playhead, as it always was, except inside a pause that
                landed: there the dark theme's light ink is 2.25:1 on the
                sage, so it turns to the ground's near-black (7.45:1) and
                the band still shows either side of it. A rim of sand
                around it read, but it covered a 4px band entirely, so the
                landing vanished while it played (#425). */}
            <span
              data-playhead
              data-on={onLanded ? "landed" : undefined}
              className={`absolute top-0 h-full w-[2px] ${onLanded ? PLAYHEAD_ON_LANDED : PLAYHEAD}`}
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
   the Fillers tone from the card's data-trait (recording-20). A held
   pause is sage only when it landed a point, by the verdict the take
   stored (lib/pause-mark.ts, the pause map's rule); every other held
   pause is the track's neutral stone, with the pause map's words in the
   key. Not the map's hollow outline: a band is drawn to the take's
   scale, a second of a minute is about 4px on a phone, and an ink
   outline that narrow reads as a solid rule beside the cut-in and the
   playhead.
   Since #425 (Timothy: a well-held pause barely showed beside the
   filler ticks) a landed band is the pause map's own solid sage-600,
   3.65:1 on the light sand and 5.02:1 on the dark (the ticks are 3.70
   and 5.30), and a searching band stays a quiet stone, 1.59 and 1.86:1,
   so the earned silence is the mark that reads. Both are measured in
   lib/today-colour.test.ts. */
const FILLER_MARK = "bg-[var(--tone)]";
export const PAUSE_MARK: Record<PauseMark, string> = { landed: LANDED_MARK, searching: "bg-stone-400/35" };
/** No band under 4px, grown rightward from its pause's start. */
export const BAND_MIN = "min-w-[4px]";
/* Demos's cut-in: ink, as on the pause map, at the filler's 3px so the
   2px playhead stays its own mark. */
const CUT_IN_MARK = "bg-ink/70";
/** The playhead: ink, and the ground's near-black over a landed band in dark. */
export const PLAYHEAD = "bg-ink";
export const PLAYHEAD_ON_LANDED = "bg-ink dark:bg-ground";

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
     (B05) still fit one line in a 320 card ("filler", "landed a point",
     "searching": 239 of 246pt, measured by scripts/look-pause-moments.mjs). */
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="relative grid h-3 w-3 place-items-center overflow-hidden bg-sand">
        <span className={`${thin ? "h-full w-[3px]" : "absolute inset-0"} ${mark}`} />
      </span>
      {children}
    </span>
  );
}
