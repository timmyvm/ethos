import { DemosArt } from "@/components/DemosArt";
import { EthosScore } from "@/components/ui/EthosScore";
import { HeroStage } from "@/components/ui/HeroStage";
import { TrendMark } from "@/components/ui/TrendMark";
import { ethosLine, linePath } from "@/lib/log";
import { DURATION } from "@/lib/motion";

/**
 * The Log's stage (#506, Timothy 18 Nov: "what am I even looking at when
 * I see the log?"). Three things on the house sky and nothing else: the
 * Ethos number now, large; one quiet pill that answers "am I getting
 * better?" ("▲ 51 since you started"); and one line from a ring where
 * you started to a dot where you are, with no axes, dates, fill or
 * legend. It replaced the score card's hill, its "22 recordings" foot
 * and its two end dates, and the What moved table under it.
 *
 * The number is the results' 72 (num-xl, until now the results' alone),
 * 56 on a short or narrow phone, where the line gives up height before
 * the number does. The line (`ethosLine`) starts on the first scored
 * Ethos and ends on today's, so the ring and the dot are the two numbers
 * the pill subtracts, and it is drawn on at least 100 points, so a
 * 51-point rise climbs and a small dip stays small.
 *
 * States: no recording (a dash, "Your first recording starts the line."
 * and Demos, the empty state's one moment, the stage taking the spare
 * height); recordings with none scored (a dash, "Your next scored
 * recording starts the line."); one scored recording (the number, "Your
 * next recording starts the line."); two or more (number, pill, line).
 * With exactly one recording Demos stands on the stage too, and it takes
 * the height its one row leaves. A fall says ▼ in the same stage ink: a
 * fact, not an alarm, and never rust.
 */
/** The most Demos grows to on a tall empty or first-recording stage, and the height he leaves the number. */
const DEMOS_MAX = 208;
const DEMOS_RESERVE = 210;

export function LogStage({
  index,
  first,
  series,
  recordings,
  from,
  to,
  draw = true,
}: {
  /** Today's Ethos: the latest scored recording's. Null with none scored. */
  index: number | null;
  /** The first scored recording's Ethos, the start the pill counts from. */
  first: number | null;
  /** Every scored Ethos, oldest first. */
  series: number[];
  /** How many recordings the account holds, scored or not. */
  recordings: number;
  /** The first and latest scored recordings' days, for the line's spoken name. */
  from?: string;
  to?: string;
  /** False when the page drew what the visit held: the line is already there. */
  draw?: boolean;
}) {
  const points = ethosLine(series);
  const delta = points && index !== null && first !== null ? index - first : null;
  const empty = recordings === 0;
  /* The first recording (#506 review): one row under the stage left
     about 200px of bare ground at 390x844 (DESIGN 7), and a first
     recording is one of Demos's moments, so he stands on its floor and
     the stage takes the spare height, as on the empty Log. */
  const lone = recordings === 1;
  return (
    <HeroStage
      eyebrow="Your Ethos"
      /* With nothing recorded the stage takes the screen's spare height
         (the empty state's one moment, Demos on its floor), so no band
         of bare ground is left under its one tap (DESIGN 7). */
      className={`log-stage ${empty ? "log-stage-empty" : lone ? "log-stage-lone" : ""}`}
      data-look="log-stage"
      /* He grows with the height the stage takes (132 to DEMOS_MAX), as
         on the boss's stage, so the room is his and not bare sky. */
      artGrow={empty || lone ? DEMOS_MAX : undefined}
      artReserve={DEMOS_RESERVE}
      art={
        empty || lone ? (
          <DemosArt
            pose={empty ? "hello" : "celebrate"}
            size={DEMOS_MAX}
            fit
            grounded
            halo={{ tone: "sky", kind: "stage" }}
          />
        ) : undefined
      }
      chart={
        points && delta !== null ? (
          <LogLine
            points={points}
            draw={draw}
            label={`Ethos ${first}${from ? ` on ${from}` : ""} to ${index}${to ? ` on ${to}` : ""}, ${
              delta === 0 ? "level" : `${delta > 0 ? "up" : "down"} ${Math.abs(delta)}`
            }`}
          />
        ) : undefined
      }
    >
      {/* The number drawn one way (#493): EthosScore, "/1000" one word on its baseline. */}
      <EthosScore value={index} size="log" count durationMs={DURATION.max} onStage className="mt-1" />
      {delta !== null ? (
        /* A label on the stage, never a tap: no press, no chevron. */
        <p className="log-change font-display text-body font-bold tabular-nums">
          {delta === 0 ? (
            "Level with your first recording"
          ) : (
            <>
              <span className="log-change-mark">
                <TrendMark up={delta > 0} />
              </span>
              {Math.abs(delta)} since you started
            </>
          )}
        </p>
      ) : (
        <p className="stage-ink font-display mt-auto pt-3 text-link font-bold">
          {empty
            ? "Your first recording starts the line."
            : index === null
              ? /* Recordings, none long enough to score. */ "Your next scored recording starts the line."
              : "Your next recording starts the line."}
        </p>
      )}
    </HeroStage>
  );
}

/**
 * The line itself: a monotone curve through the smoothed points, in the
 * stage's ink, stretched to the band `.log-chart` gives it (the stroke
 * keeps its width), with the ring and the dot as their own round marks
 * at its ends so neither stretches. One image to a screen reader, named
 * with its two numbers and their days.
 */
function LogLine({ points, label, draw }: { points: [number, number][]; label: string; draw: boolean }) {
  const W = 1000;
  const H = 100;
  const d = linePath(points.map(([x, y]) => [x * W, y * H]));
  const [, y0] = points[0];
  const [, y1] = points[points.length - 1];
  return (
    <div role="img" aria-label={label} data-draw={draw || undefined} className="log-chart">
      <svg
        aria-hidden
        focusable="false"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block size-full overflow-visible"
      >
        <path d={d} pathLength={1} className="log-path" />
      </svg>
      <span aria-hidden className="log-ring" style={{ left: "0%", top: `${y0 * 100}%` }} />
      <span aria-hidden className="log-dot" style={{ left: "100%", top: `${y1 * 100}%` }} />
    </div>
  );
}
