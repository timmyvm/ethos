/**
 * The reward layer — moments, everywhere, on every surface.
 *
 * Research behind each generator (docs/progression-research.md):
 *
 * - ANTICIPATION is a separate motivational system from delivery.
 *   Dopamine fires on cues that *predict* reward, not only on reward
 *   itself, and only when the cue carries new information. So we show
 *   what this rep will earn BEFORE the record button, not just after.
 * - The STREAK-END RULE (PNAS, 14,383 volunteers, 1.97M events): when
 *   people judge a sequence, the ENDING carries disproportionate
 *   weight, and hard endings drive quitting. So the last thing on the
 *   screen before they leave is always something true and good.
 */

import type { TraitId } from "@/content/traits";
import type { RepRow } from "./client-data";
import { pausesBetween } from "./metric-labels";
import { isScorable, type RepMetrics } from "./metrics";
import { heldPauseMarks } from "./pause-mark";
import type { Milestone } from "./progress";
import type { RepairState, StreakState } from "./streak";
import { measured } from "./trait-readings";

export interface RewardMoment {
  /** Short, coach register, never hype. */
  headline: string;
  /** The number underneath it. Always present. */
  detail: string;
  tone: "earned" | "neutral";
  /**
   * A game's best broken (M4), split for the eye so Moment can draw it
   * in the plaque's grammar (#421): the new number set large, the rest
   * of its words, and the best it beat. `detail` stays the sentence a
   * screen reader hears.
   */
  record?: { value: string; rest: string; past: string };
  /**
   * The trait a closing line reads (endNote), so the last step's closing
   * note sets its number in that trait's tone (lib/closing-note.ts, #423).
   */
  trait?: TraitId;
  /**
   * The line under Record is the missed day's repair (closure.md row 14):
   * it outranks today's scored recordings used (lib/rep-screen.ts
   * underRecord), because a capped take is still 20+ words and keeps it.
   */
  repair?: true;
}

/**
 * What one rep, right now, is likely to move. Shown BEFORE recording —
 * the anticipation cue, which the reward-prediction literature treats
 * as its own driver rather than a preview of the real thing.
 */
export function anticipation(
  milestones: Milestone[],
  streak: StreakState,
  /** The day after one missed, while two takes can still keep it (lib/streak.ts repairState). */
  repair: RepairState | null = null
): RewardMoment | null {
  const closest = milestones[0];
  /* A missed day two recordings of 20+ words can keep (closure.md row 14):
     said here, where you record, and nowhere else. Its number is the run
     it keeps, and the deadline is the day's own end, never a clock. */
  if (repair) {
    return {
      headline: repairCue(repair),
      detail: closest ? closest.line : "Five minutes, in and out.",
      tone: "earned",
      repair: true,
    };
  }
  if (!streak.didToday && streak.current > 0) {
    return {
      headline: `This one keeps a ${streak.current}-day streak alive`,
      // The next milestone's own line, whole: splicing a label into a
      // sentence of ours ("Ethos 700", "3★ on Kill 'like'") read as
      // broken copy.
      detail: closest ? closest.line : "Five minutes, in and out.",
      tone: "earned",
    };
  }
  if (!closest) return null;
  /* Its line, which passes the two-second test (#483): "Your best score
     is 704. Next: 800.", never "Ethos 800 · 96 to go". */
  return {
    headline: closest.line,
    detail: closest.detail,
    tone: "earned",
  };
}

/**
 * The line under Record on the day after a miss: "Two recordings of 20+
 * words keep a 5-day streak alive" before the first, "This one keeps a
 * 5-day streak alive" before the second, the same words the line uses on
 * any day a streak is on the line.
 */
export function repairCue(repair: Pick<RepairState, "run" | "counted">): string {
  return repair.counted === 0
    ? `Two recordings of 20+ words keep a ${repair.run}-day streak alive`
    : `This one keeps a ${repair.run}-day streak alive`;
}

/**
 * The take's composed pauses, as its own judged pauses tell them: a
 * pause before a sentence that the take judged "filled" (a sound in it,
 * #121) is not composure, so the closing line never counts what the
 * pause list and the Pause score call filled (#422). Pauses carrying no
 * verdict count by their kind alone, as `composedPauses` always has.
 */
export function composedHeard(m: Pick<RepMetrics, "pauses" | "composedPauses">): number {
  const ps = m.pauses as ReadonlyArray<{ kind: string; verdict?: string }> | undefined;
  if (!ps || !ps.some((p) => typeof p.verdict === "string")) return m.composedPauses;
  return ps.filter((p) => p.kind === "pre" && p.verdict !== "filled").length;
}

/**
 * The take's landed pauses (DECISIONS #427): the count the track, the
 * pause map's key and the glance all give, `heldPauseMarks(pauses).landed`,
 * so one take never says "3 landed" in one place and "3 composed" read
 * another way in the next. A pause before a sentence judged filled or
 * dead is not one; a pause carrying no verdict counts by its kind. A
 * metrics object with no pause list (an older shape) keeps its count.
 */
export function landedHeard(m: Pick<RepMetrics, "pauses" | "composedPauses">): number {
  const ps = m.pauses as RepMetrics["pauses"] | undefined;
  if (!ps || ps.length === 0) return m.composedPauses;
  return heldPauseMarks(ps).landed;
}

/**
 * The closing line — the last thing on the results screen.
 *
 * The streak-end rule says the ending of a sequence carries
 * disproportionate weight when someone decides whether to come back, so
 * this always finds something true and good to end on. It reads the
 * numbers in priority order and takes the first honest win; the
 * fallback is the fact that the rep exists, which is itself true.
 */
export function endNote(params: {
  metrics: RepMetrics;
  streak: StreakState;
  repCount: number;
}): RewardMoment {
  const { metrics: m, streak, repCount } = params;
  /* A take too short to score measured nothing, so it ends on no
     number: "Zero fillers, 5 seconds, clean." stood under "Not enough
     to score". Its streak and its count are still true. */
  const scored = isScorable(m.substance);
  const landed = landedHeard(m);

  /* One count for a good pause, as the track and the glance say it
     (#427), in the house's words since #490 ("3 landed pauses" and
     "composed" were the app's): a pause between sentences, and the
     detail says what that is. */
  if (scored && landed > 0) {
    return {
      headline: `${landed} pause${landed === 1 ? "" : "s"} between sentences`,
      detail: landed === 1 ? "A full sentence, then quiet." : "Each one after a full sentence.",
      tone: "earned",
      trait: "pause",
    };
  }
  if (scored && m.fillerCount === 0) {
    return {
      headline: "Zero fillers",
      detail: `${Math.round(m.durationS)} seconds, clean.`,
      tone: "earned",
      trait: "fillers",
    };
  }
  if (scored && m.wpm >= 130 && m.wpm <= 160) {
    return {
      headline: `${m.wpm} words a minute`,
      detail: "Inside the 130 to 160 zone.",
      tone: "earned",
      trait: "pace",
    };
  }
  if (streak.current > 1) {
    return {
      headline: `${streak.current} days running`,
      detail: "You showed up again.",
      tone: "earned",
    };
  }
  return {
    headline: `Recording ${repCount} logged`,
    detail: "Recorded, measured, kept.",
    tone: "neutral",
  };
}

/**
 * Personal bests worth calling out. A record is the least arguable
 * reward there is — it's a comparison against the user's own history.
 *
 * `prior` must be the reps from BEFORE this one, captured up front.
 * Deriving it by lopping the last row off a post-rep fetch looks
 * equivalent and isn't: when a rep fails to persist, that fetch never
 * contains it, and the slice silently discards a real prior rep —
 * understating the record the user is being congratulated on beating.
 */
/**
 * Whether Demos celebrates on the score step (D52): a new best Ethos
 * Index, or three stars. Nothing smaller, so the pose and its sparkles
 * keep their meaning: a two-star recording three points up is said in
 * the speaking pose. A first recording has no best to pass, so only
 * three stars celebrate it.
 */
export function celebrates(prior: RepRow[], stars: number, index: number | null): boolean {
  if (stars >= 3) return true;
  if (index === null) return false;
  const best = prior.reduce((a, r) => Math.max(a, r.ethos_index ?? 0), 0);
  return best > 0 && index > best;
}

/** The pause record's headline, which the glance's earned line matches on. */
export const MOST_PAUSES = "Most pauses yet";

export function personalBests(
  all: RepRow[],
  current: RepMetrics,
  currentIndex: number | null
): RewardMoment[] {
  /* Only takes that measured something hold or break a record: a
     two-word take read "Cleanest recording yet, 0/min", and a stored
     one would stand as a best nothing could beat. */
  if (!isScorable(current.substance)) return [];
  const prior = all.filter(measured);
  if (prior.length === 0) return [];
  const out: RewardMoment[] = [];

  const bestIndex = prior.reduce((a, r) => Math.max(a, r.ethos_index ?? 0), 0);
  if (currentIndex !== null && bestIndex > 0 && currentIndex > bestIndex) {
    out.push({
      headline: "Best Ethos yet",
      detail: `${currentIndex}, past your ${bestIndex}`,
      tone: "earned",
    });
  }

  const fpmOf = (r: RepRow) =>
    r.duration_s > 0 ? r.filler_count / (r.duration_s / 60) : Infinity;
  const bestFpm = Math.min(...prior.map(fpmOf));
  if (Number.isFinite(bestFpm) && current.fillersPerMin < bestFpm) {
    out.push({
      headline: "Cleanest recording yet",
      detail: `${current.fillersPerMin} ${current.fillersPerMin === 1 ? "filler" : "fillers"} a minute, under your ${Math.round(bestFpm * 100) / 100}`,
      tone: "earned",
    });
  }

  /* This take's pauses between sentences that landed, never an amount of
     silence (the review of #490). It counted every one-second pause, the
     ones inside a sentence too, and then every pause before a sentence,
     the dead ones past 3.5 seconds and the ones next to an um too, so a
     take with more of the fault Demos names could break the record (the
     review of build 6). Now it is the closing note's count (landedHeard),
     the glance's and the pauses Hear it back draws sage.
     Each earlier recording's best is read by the kinds it stored, every
     pause before a sentence (`pausesBetween`, the Log's count, #495), and
     never by its verdicts: no path that reads a stored recording moves
     with its stored verdicts (#422, lib/stored-scores.test.ts). That
     count is never below the pauses that landed on it, so a record is
     only ever withheld by it, never claimed. A recording with no pause
     list measured none, so it holds no best (unknown is never zero). The
     "Held the room" badge keeps its own rule. */
  const withPauses = prior.filter((r) => Array.isArray(r.pauses));
  const bestBetween = Math.max(...withPauses.map((r) => pausesBetween(r.pauses)));
  const between = landedHeard(current);
  if (withPauses.length > 0 && between > bestBetween) {
    out.push({
      headline: MOST_PAUSES,
      detail: `${between} ${between === 1 ? "pause" : "pauses"} between sentences, past your ${bestBetween}`,
      tone: "earned",
    });
  }

  return out;
}
