/**
 * Pause QUALITY — what the pause dimension should have been measuring.
 *
 * The old `pauseScore` handed out a baseline 60 and +8 for every
 * pre-sentence gap between 0.8s and 2.5s. It measured that pauses
 * EXISTED, not whether they were any good, so five slow starts scored
 * the same 100 as five landed points. Reported by Timothy after a rep
 * that scored full marks on pauses he knew were bad.
 *
 * What the evidence actually says:
 *
 * - **Placement is the signal, not presence.** Goldman-Eisler, and
 *   Boomer after her, split silences into JUNCTURE pauses (at a
 *   grammatical boundary — the mark of fluent production) and
 *   HESITATION pauses (inside a clause — the mark of planning
 *   difficulty). Same silence, opposite meaning, and only the boundary
 *   tells you which. That distinction is this file.
 * - **A pause has to be long enough to be rhetorical.** Coaching
 *   practice converges on one to two seconds after a point: long enough
 *   for a listener to absorb it, short enough not to read as lost.
 *   Under ~0.8s at a boundary is a breath, not a beat.
 * - **Silence REPLACES the filler.** The whole technique is swapping
 *   "um" for nothing at all. So a held pause with an "um" leaning
 *   against it earned nothing — you bought the silence back.
 * - **Dead air is its own failure.** Past about three and a half
 *   seconds a pause stops reading as composure and starts reading as
 *   lost.
 *
 * Deterministic, no LLM, every verdict traceable to a timestamp.
 */

import type { FillerHit, Pause, Segment, Word } from "./metrics";

export type PauseVerdict =
  | "landing" // held, at a boundary, after a real sentence — the good one
  | "opening" // held, before the first word — composure before you start
  | "hesitation" // held, mid-clause — searching
  | "filled" // held, but a filler is leaning against it
  | "dead" // held far too long — lost, not composed
  | "beat"; // under the held threshold — rhythm, not scored

export interface JudgedPause extends Pause {
  verdict: PauseVerdict;
  /** One line naming what this silence did, with its timestamp. */
  note: string;
}

export interface PauseReport {
  /** 0–100 for the Index dimension. */
  score: number;
  pauses: JudgedPause[];
  landings: number;
  hesitations: number;
  filled: number;
  dead: number;
  /** Did they pause before starting? */
  opened: boolean;
  /** Did a landing pause fall in the final fifth? */
  landedTheEnding: boolean;
  /** The single most useful thing to say about the pauses, or null. */
  headline: string | null;
}

// --- calibration (v1, stated not tuned) ------------------------------

/** Under this a boundary silence is a breath, not a rhetorical pause. */
export const RHETORICAL_MIN_S = 0.8;
/** Over this it stops reading as composure. */
export const DEAD_AIR_S = 3.5;
/** A filler this close to a silence means the silence was bought back. */
export const FILLER_ADJACENCY_S = 1.2;
/** A sentence has to be worth landing before the pause after it counts. */
export const SUBSTANTIAL_SENTENCE_WORDS = 6;
/** Landing pauses per minute that read as paced rather than sparse/stalling. */
export const LANDING_ZONE: [number, number] = [2, 9];

// --- weights ---------------------------------------------------------

const PLACEMENT_MAX = 60;
const RATE_MAX = 25;
const OPENING_BONUS = 7;
const ENDING_BONUS = 8;
const FILLED_PENALTY = 10;
const DEAD_PENALTY = 12;

function clock(t: number): string {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}

/** Words closed off by the sentence ending at or before `t`. */
function wordsInSentenceEndingAt(words: Word[], t: number): number {
  let count = 0;
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i].end > t + 0.05) continue;
    count++;
    // Walk back to the previous sentence end.
    if (count > 1 && /[.?!]["')\]]*\s*$/.test(words[i].word)) return count - 1;
    if (count > 40) break;
  }
  return count;
}

/**
 * Judge every pause. `words` and `fillers` come straight from the
 * engine, so nothing here needs the transcript or the LLM.
 */
export function judgePauses(params: {
  pauses: Pause[];
  words: Word[];
  fillers: FillerHit[];
  durationS: number;
  segments?: Segment[];
}): JudgedPause[] {
  const { pauses, words, fillers, durationS } = params;
  const firstWordAt = words[0]?.start ?? 0;

  return pauses.map((p): JudgedPause => {
    if (p.kind === "beat") {
      return { ...p, verdict: "beat", note: `${clock(p.t)} — a beat.` };
    }

    // A filler leaning on either side means the silence was bought back
    // with an "um" rather than used instead of one.
    const nearFiller = fillers.some(
      (f) => Math.abs(f.t - p.t) <= FILLER_ADJACENCY_S ||
        Math.abs(f.t - (p.t + p.len)) <= FILLER_ADJACENCY_S
    );

    if (p.len > DEAD_AIR_S) {
      return {
        ...p,
        verdict: "dead",
        note: `${clock(p.t)} — ${p.len.toFixed(1)}s of dead air. Past about ${DEAD_AIR_S}s a pause stops reading as composure.`,
      };
    }

    if (nearFiller) {
      return {
        ...p,
        verdict: "filled",
        note: `${clock(p.t)} — silence with a filler leaning on it. The technique is silence INSTEAD of the "um", not either side of it.`,
      };
    }

    if (p.kind === "mid") {
      return {
        ...p,
        verdict: "hesitation",
        note: `${clock(p.t)} — ${p.len.toFixed(1)}s mid-sentence. That's searching for the next word, and it reads that way.`,
      };
    }

    // Pre-sentence and long enough to be deliberate.
    if (p.len < RHETORICAL_MIN_S) {
      return { ...p, verdict: "beat", note: `${clock(p.t)} — a breath.` };
    }

    if (p.t <= firstWordAt + 0.5) {
      return {
        ...p,
        verdict: "opening",
        note: `${clock(p.t)} — you took the room before you spoke.`,
      };
    }

    const closed = wordsInSentenceEndingAt(words, p.t);
    if (closed < SUBSTANTIAL_SENTENCE_WORDS) {
      return {
        ...p,
        verdict: "hesitation",
        note: `${clock(p.t)} — a pause after only ${closed} word${closed === 1 ? "" : "s"}. There wasn't a point there to land yet.`,
      };
    }

    const late = durationS > 0 && p.t >= durationS * 0.8;
    return {
      ...p,
      verdict: "landing",
      note: late
        ? `${clock(p.t)} — you let the ending land instead of trailing off.`
        : `${clock(p.t)} — ${p.len.toFixed(1)}s after a finished point. That's the one.`,
    };
  });
}

/**
 * Pause /100 = placement (60) + usage (40), minus what was bought back.
 *
 * Placement is a RATIO, not a count: five landings and five
 * hesitations is half marks, because half your silences were you
 * looking for a word. That is the specific thing the old score could
 * not see.
 */
export function pauseReport(params: {
  pauses: Pause[];
  words: Word[];
  fillers: FillerHit[];
  durationS: number;
  segments?: Segment[];
}): PauseReport {
  const judged = judgePauses(params);
  const { durationS } = params;

  const held = judged.filter((p) => p.verdict !== "beat");
  const landings = judged.filter((p) => p.verdict === "landing").length;
  const opening = judged.filter((p) => p.verdict === "opening").length;
  const hesitations = judged.filter((p) => p.verdict === "hesitation").length;
  const filled = judged.filter((p) => p.verdict === "filled").length;
  const dead = judged.filter((p) => p.verdict === "dead").length;

  const good = landings + opening;
  const minutes = durationS > 0 ? durationS / 60 : 0;

  let score: number;
  if (held.length === 0) {
    // Never came up for air. Not a zero — there is nothing bad here
    // either — but it is the bottom of the useful range, and the old
    // baseline of 60 for exactly this was the bug.
    score = 20;
  } else {
    const placement = (good / held.length) * PLACEMENT_MAX;
    const perMin = minutes > 0 ? landings / minutes : 0;
    const rate = zone(perMin, LANDING_ZONE) * RATE_MAX;
    score =
      placement +
      rate +
      (opening > 0 ? OPENING_BONUS : 0) +
      (landedTheEnding(judged, durationS) ? ENDING_BONUS : 0) -
      filled * FILLED_PENALTY -
      dead * DEAD_PENALTY;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    pauses: judged,
    landings,
    hesitations,
    filled,
    dead,
    opened: opening > 0,
    landedTheEnding: landedTheEnding(judged, durationS),
    headline: headline({ held: held.length, landings, hesitations, filled, dead }),
  };
}

function landedTheEnding(judged: JudgedPause[], durationS: number): boolean {
  if (durationS <= 0) return false;
  return judged.some(
    (p) => p.verdict === "landing" && p.t >= durationS * 0.8
  );
}

/** 1 inside the zone, falling off linearly outside it. */
function zone(value: number, [lo, hi]: [number, number]): number {
  if (value >= lo && value <= hi) return 1;
  const distance = value < lo ? lo - value : value - hi;
  return Math.max(0, 1 - distance / Math.max((hi - lo) / 2, 1));
}

/**
 * One line, picking the biggest problem — or the win, if there isn't
 * one. Never a list: the loop has one focus (mechanics.md).
 */
function headline(counts: {
  held: number;
  landings: number;
  hesitations: number;
  filled: number;
  dead: number;
}): string | null {
  const { held, landings, hesitations, filled, dead } = counts;
  if (held === 0) {
    return "No held pauses at all. Silence is the one tool here nobody else scores — try one after your first real point.";
  }
  if (dead > 0) {
    return `${dead} pause${dead === 1 ? "" : "s"} ran past ${DEAD_AIR_S}s into dead air. A pause lands at one to two seconds; past that a listener starts wondering if you're lost.`;
  }
  if (filled > 0) {
    return `${filled} of your silences had a filler leaning on them. The swap is silence INSTEAD of the "um" — the pause is already right, the "um" is the part to drop.`;
  }
  if (hesitations > landings) {
    return `${hesitations} of your pauses were mid-sentence and ${landings} landed after a finished point. Same silence, opposite read: one is thinking, one is composure.`;
  }
  if (landings === 0) {
    return "Nothing landed after a finished point yet. Say the thing, then stop for a second — that second is what makes it sound decided.";
  }
  return `${landings} pause${landings === 1 ? "" : "s"} landed after a finished point.`;
}
