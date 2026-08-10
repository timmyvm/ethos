/**
 * The reward layer — moments, everywhere, on every surface.
 *
 * Research behind each generator (docs/progression-research.md):
 *
 * - ANTICIPATION is a separate motivational system from delivery.
 *   Dopamine fires on cues that *predict* reward, not only on reward
 *   itself, and only when the cue carries new information. So we show
 *   what this rep will earn BEFORE the record button, not just after.
 * - NEAR-MISS outcomes recruit win-related circuitry and raise
 *   motivation to try again. "3 points off 700" is worth saying.
 * - The ZEIGARNIK effect: unfinished tasks stay mentally active.
 *   Naming the half-done thing pulls people back to it.
 * - The FRESH START effect (Dai, Milkman & Riis, Management Science
 *   2014): temporal landmarks relegate past imperfection to a closed
 *   chapter. People are 33% more likely to exercise at the start of a
 *   week. So Mondays and month starts get their own framing.
 * - The STREAK-END RULE (PNAS, 14,383 volunteers, 1.97M events): when
 *   people judge a sequence, the ENDING carries disproportionate
 *   weight, and hard endings drive quitting. So the last thing on the
 *   screen before they leave is always something true and good.
 */

import type { RepRow } from "./client-data";
import type { RepMetrics } from "./metrics";
import type { Milestone, RepGain } from "./progress";
import type { StreakState } from "./streak";

export interface RewardMoment {
  /** Short, coach register, never hype. */
  headline: string;
  /** The number underneath it. Always present. */
  detail: string;
  tone: "amber" | "neutral";
}

/** A milestone this close counts as within reach of one rep. */
const NEAR_MISS_RATIO = 0.85;

/**
 * What one rep, right now, is likely to move. Shown BEFORE recording —
 * the anticipation cue, which the reward-prediction literature treats
 * as its own driver rather than a preview of the real thing.
 */
export function anticipation(
  milestones: Milestone[],
  streak: StreakState
): RewardMoment | null {
  const closest = milestones[0];
  if (!streak.didToday && streak.current > 0) {
    return {
      headline: `This rep keeps a ${streak.current}-day streak alive`,
      // Two clauses, not one forced sentence: milestone labels are
      // nouns of every shape ("Ethos 700", "3★ on Kill 'like'") and
      // splicing them mid-sentence reads as broken copy.
      detail: closest
        ? `Closest after that: ${closest.label} — ${closest.remainingLabel}.`
        : "One rep. Five minutes.",
      tone: "amber",
    };
  }
  if (!closest) return null;
  return {
    headline: `${closest.label} — ${closest.remainingLabel}`,
    detail: closest.detail,
    tone: "amber",
  };
}

/**
 * Milestones sitting just out of reach. Near-misses read as almost-wins
 * and raise the pull to go again — the honest version is simply not
 * hiding how close the number is.
 */
export function nearMisses(milestones: Milestone[]): Milestone[] {
  return milestones.filter((m) => m.progress >= NEAR_MISS_RATIO);
}

/**
 * Zeigarnik: name the thing that is started and unfinished. An open
 * loop stays mentally active in a way a fresh one does not.
 */
export function openLoop(
  starMap: Record<string, number>,
  lessons: { id: string; title: string }[]
): RewardMoment | null {
  const started = lessons.find((l) => {
    const s = starMap[l.id] ?? 0;
    return s > 0 && s < 3;
  });
  if (!started) return null;
  const stars = starMap[started.id] ?? 0;
  return {
    headline: `${started.title} is ${stars} of 3`,
    detail: `${3 - stars} star${3 - stars === 1 ? "" : "s"} left on it`,
    tone: "neutral",
  };
}

export type Landmark = "monday" | "month" | "year" | null;

export function landmark(now = new Date()): Landmark {
  if (now.getMonth() === 0 && now.getDate() === 1) return "year";
  if (now.getDate() === 1) return "month";
  if (now.getDay() === 1) return "monday";
  return null;
}

/**
 * Fresh-start framing. The effect comes from the landmark closing the
 * previous chapter, so the copy points forward and never re-litigates
 * what the user did or didn't do last week.
 */
export function freshStart(now = new Date()): RewardMoment | null {
  switch (landmark(now)) {
    case "year":
      return {
        headline: "First day of the year",
        detail: "New page. The reps start counting again today.",
        tone: "amber",
      };
    case "month":
      return {
        headline: `First of ${now.toLocaleDateString(undefined, { month: "long" })}`,
        detail: "Clean month. One rep opens it.",
        tone: "amber",
      };
    case "monday":
      return {
        headline: "Monday",
        detail: "New week, new league. Take the first rep in it.",
        tone: "amber",
      };
    default:
      return null;
  }
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
  gains: RepGain[];
  metrics: RepMetrics;
  streak: StreakState;
  repCount: number;
}): RewardMoment {
  const { metrics: m, streak, repCount } = params;

  if (m.composedPauses > 0) {
    return {
      headline: `${m.composedPauses} composed pause${m.composedPauses === 1 ? "" : "s"}`,
      detail: "Silence you chose, before a new point. That's the hard one.",
      tone: "amber",
    };
  }
  if (m.fillerCount === 0) {
    return {
      headline: "Zero fillers",
      detail: `${Math.round(m.durationS)} seconds, clean.`,
      tone: "amber",
    };
  }
  if (m.wpm >= 130 && m.wpm <= 160) {
    return {
      headline: `${m.wpm} words a minute`,
      detail: "Dead in the zone.",
      tone: "amber",
    };
  }
  if (streak.current > 1) {
    return {
      headline: `${streak.current} days running`,
      detail: "You showed up again. That's the whole mechanism.",
      tone: "amber",
    };
  }
  return {
    headline: `Rep ${repCount} logged`,
    detail: "Recorded, measured, kept. Same time tomorrow.",
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
export function personalBests(
  prior: RepRow[],
  current: RepMetrics,
  currentIndex: number | null
): RewardMoment[] {
  if (prior.length === 0) return [];
  const out: RewardMoment[] = [];

  const bestIndex = prior.reduce((a, r) => Math.max(a, r.ethos_index ?? 0), 0);
  if (currentIndex !== null && bestIndex > 0 && currentIndex > bestIndex) {
    out.push({
      headline: "Best Ethos yet",
      detail: `${currentIndex}, past your ${bestIndex}`,
      tone: "amber",
    });
  }

  const fpmOf = (r: RepRow) =>
    r.duration_s > 0 ? r.filler_count / (r.duration_s / 60) : Infinity;
  const bestFpm = Math.min(...prior.map(fpmOf));
  if (Number.isFinite(bestFpm) && current.fillersPerMin < bestFpm) {
    out.push({
      headline: "Cleanest rep yet",
      detail: `${current.fillersPerMin}/min, under your ${Math.round(bestFpm * 100) / 100}`,
      tone: "amber",
    });
  }

  const bestHeld = Math.max(
    ...prior.map((r) => (r.pauses ?? []).filter((p) => p.kind !== "beat").length)
  );
  if (current.heldPauses > bestHeld) {
    out.push({
      headline: "Most silence you've held",
      detail: `${current.heldPauses} held pauses, past ${bestHeld}`,
      tone: "amber",
    });
  }

  return out;
}
