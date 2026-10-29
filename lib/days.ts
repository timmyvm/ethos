/**
 * The day counter.
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
  /** 1-based: this was your Nth day of speaking. */
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
