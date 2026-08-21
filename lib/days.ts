/**
 * The day counter and the improvement trail.
 *
 * A streak is the right pressure and the wrong memory: it resets, so on
 * the morning after a missed day the number that greets you is the one
 * that says you failed. This is the other number — how many days you
 * have actually spoken, ever. It only ever goes up, it survives a missed
 * day, and it is the thing that quietly gets better the longer you stay.
 *
 * It is also incapable of overstating (DECISIONS #47): it counts days
 * that contain a real rep, not days since you signed up. Miss a month
 * and you come back to Day 12, not Day 43.
 *
 * Pure arithmetic over stored reps, never an LLM call (DECISIONS #30).
 */

export interface TrainedDay {
  /** 1-based: this was your Nth day of training. */
  day: number;
  /** Local calendar key, YYYY-MM-DD. */
  date: string;
  /**
   * The day's best Ethos Index, or null if nothing that day scored.
   * Best-of matches how stars already summarise a lesson (`starsByLesson`)
   * — a warm-up rep after a good one shouldn't erase the good one.
   */
  index: number | null;
}

interface RepLike {
  created_at: string;
  ethos_index: number | null;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** One entry per local day that contains a rep, oldest first. */
export function trainedDays(reps: RepLike[]): TrainedDay[] {
  const byDate = new Map<string, number | null>();
  for (const rep of reps) {
    const key = dayKey(new Date(rep.created_at));
    const best = byDate.get(key) ?? null;
    const score = rep.ethos_index;
    byDate.set(
      key,
      score === null ? best : best === null ? score : Math.max(best, score)
    );
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, index], i) => ({ day: i + 1, date, index }));
}

/** The counter itself. "Day 12" — never resets, never inflates. */
export function dayCount(reps: RepLike[]): number {
  return trainedDays(reps).length;
}

export interface DayTrail {
  /** Which day today is — or would be, counting the reps that exist. */
  count: number;
  /** Days that produced a score, for the line. */
  points: TrainedDay[];
  /**
   * The latest scored day is the highest scored day so far.
   *
   * Deliberately NOT a restatement of the arc: the score card above
   * already carries "+N since your first rep", and a second, slightly
   * different total beside it (day-bests versus rep-to-rep) would be two
   * numbers about the same thing that disagree. This says something the
   * card cannot: today was the best one.
   */
  bestYet: boolean;
  /**
   * Why there is no line yet, or null when there is one. Said plainly
   * rather than drawn as a flat line, which would imply a real week of
   * no improvement.
   */
  pending: string | null;
}

export function dayTrail(reps: RepLike[]): DayTrail {
  const days = trainedDays(reps);
  const points = days.filter((d) => d.index !== null);

  if (days.length === 0) {
    return {
      count: 0,
      points: [],
      bestYet: false,
      pending: "Day 1 starts when you do.",
    };
  }
  if (points.length < 2) {
    return {
      count: days.length,
      points,
      bestYet: false,
      pending:
        points.length === 0
          ? "Nothing has scored yet. One real recording draws the first point."
          : "Day 2 draws the line.",
    };
  }

  const scores = points.map((p) => p.index as number);
  const last = scores[scores.length - 1];
  return {
    count: days.length,
    points,
    // Strictly greater than every earlier day: matching your old best is
    // holding, not beating it, and calling it a record would be flattery.
    bestYet: scores.slice(0, -1).every((s) => last > s),
    pending: null,
  };
}
