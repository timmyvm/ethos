import type { TakeAudio } from "@/components/TakeAudio";

/** What a chip plays: a stretch of the take, its clock, and its name. */
export interface ChipMoment {
  /** Where playback starts, on the take's clock. */
  from: number;
  /** Where it stops. */
  until: number;
  /** "0:15", as the chip shows it. */
  clock: string;
  /** The chip's accessible name: its visible text, then what it does. */
  label: string;
}

/**
 * One moment: plays its stretch of the take, or stops it while it plays.
 * Hear it back's chip grammar: surface, edge and ink, the glyph in the
 * warm mark's terracotta like the filler chips' and the play key's beside it.
 * The Pause row's moments (#424) and the glance's one moment (#427) are
 * this chip; `marker` names which, for the cameras.
 */
export function MomentChip({
  moment,
  take,
  marker = "pause",
}: {
  moment: ChipMoment;
  take: TakeAudio;
  marker?: "pause" | "glance";
}) {
  const playing =
    take.span !== null && take.span.from === moment.from && take.span.until === moment.until;
  return (
    <button
      type="button"
      data-pause-moment={marker === "pause" ? "" : undefined}
      data-glance-chip={marker === "glance" ? "" : undefined}
      aria-label={moment.label}
      aria-pressed={playing}
      onClick={() => (playing ? take.pause() : take.play(moment.from, moment.until))}
      className="moment-chip align-baseline"
    >
      <span className="moment-pill" data-playing={playing || undefined}>
        <svg aria-hidden width="8" height="8" viewBox="0 0 10 10" className="shrink-0 text-terracotta-500">
          {playing ? (
            <path d="M1.5 1h2.5v8H1.5zM6 1h2.5v8H6z" fill="currentColor" />
          ) : (
            <path d="M2 1l7 4-7 4z" fill="currentColor" />
          )}
        </svg>
        {moment.clock}
      </span>
    </button>
  );
}
