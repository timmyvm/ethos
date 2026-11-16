/**
 * The topic pool (DECISIONS #232, #489): which prompts fit the person,
 * from two of the introduction's answers, the age band and the place
 * speaking matters most. Kept apart from the portfolio so the server's
 * reminder and the command menu read it without the plan's tables.
 *
 * Only "school" drops anything today (lib/topics.ts `not`: the three
 * prompts that need a job). The roulette (`topicsFor`), Today's card,
 * the command menu's Today, the reminder and the lessons (#492: the
 * lesson page and the recorder, content/lessons.ts `lessonFor`) all
 * read the pool from here, so one person meets one pool everywhere.
 */

import { AGE_BANDS, CONTEXTS, type Pool } from "@/content/portfolio";
import { type Answers, cleanAnswers, EMPTY_ANSWERS, readOnboarding } from "./answers";

/**
 * Where the answer says school (by age or by place), the pool is school.
 *
 * An age never given counts as school too (#489), unless the place is
 * Work: the three prompts the school pool drops all need a job, and the
 * age band is the one answer that says whether one is likely. A grown-up
 * who skipped it loses those three of 365, and Today's card stands
 * another topic on the few days of its walk that held one; someone under
 * 18 who skipped it never meets a prompt about a job they cannot have
 * had. The phone and the reminder read the same answers through this,
 * so a person nobody knows the age of gets the same card from both.
 */
export function poolFor(a: Answers): Pool {
  const byAge = AGE_BANDS.find((b) => b.id === a.ageBand)?.pool;
  const byPlace = CONTEXTS.find((c) => c.id === a.context)?.pool;
  if (byAge === "school" || byPlace === "school") return "school";
  if (byAge === undefined && byPlace !== "work") return "school";
  return byPlace ?? byAge ?? "all";
}

/**
 * The pool from the account's introduction row (`onboarding`, 0009),
 * for the server's reminder: the same rule on the same two answers, so
 * no row, or a read that failed, is an age never given.
 */
export function poolForRow(row: { age_band?: unknown; context?: unknown } | null | undefined): Pool {
  return poolFor(cleanAnswers({ ageBand: row?.age_band as never, context: row?.context as never }));
}

/** This phone's pool, from its introduction's answers. */
export function poolHere(): Pool {
  return poolFor(readOnboarding().answers);
}

/**
 * The pool of someone whose answers have not been read (#492): no age
 * and no place, which `poolFor` reads as school. A resolver asked for a
 * topic without a pool answers for this one, so a caller that forgets
 * the pool hands nobody a prompt about a job.
 */
export const UNKNOWN_POOL: Pool = poolFor(EMPTY_ANSWERS);
