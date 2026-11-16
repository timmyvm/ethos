/**
 * Today's other two things (#478, docs/plan-next.md section 10, "the
 * bike in the room"): Hostile Q&A and this week's boss, two equal tiles
 * under the practice card, each one tap away. Neither glows (section 1:
 * only the thing to do today does); each stands out by its place, its
 * colour and one line that is a reason to come back:
 *
 *   Hostile Q&A   the claim of the day, then the free plan's rounds left
 *                 today, or when the next opens at the cap; on Premium,
 *                 the one rule ("Argue either side").
 *   Weekly boss   the week's topic, then the days left in the week, or
 *                 "Done this week" in sage once it is taken.
 *
 * Pure, so the tiles only lay these out. The clock is the device's,
 * read after mount (`now` null until then), and the rows are every
 * recording's date and kind (`fetchRepSpine`), so a busy week never
 * pushes this week's boss out of the count.
 */

import { BOSS_DONE_LINE, takeThisWeek, type BossTakeRow } from "./boss";
import { dayKey } from "./challenge";
import { weeklyTopic } from "./cold-topics";
import { claimOfTheDay, hostileAllowance, hostileLeftLine, hostileNextLine } from "./hostile";

export interface ModeTile {
  id: "hostile" | "boss";
  /** One tap away, and back returns to Today (`?from=today`). */
  href: string;
  name: string;
  /** What it is about now: the claim of the day, the week's topic. Null until the clock is read. */
  subject: string | null;
  /** The one line under it; a no-break space while unknown, so the tile never moves. */
  line: string;
  /** The week's boss taken: earned, so its line is sage. */
  done: boolean;
  /** The tile as one sentence for a screen reader, its name first. */
  label: string;
}

const NBSP = " ";

const sentence = (parts: (string | null)[]) =>
  parts
    .filter((p): p is string => !!p && p !== NBSP)
    .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
    .join(" ");

export function hostileTile(opts: {
  now: Date | null;
  premium: boolean | null;
  rows: readonly { lesson_id: string | null; created_at: string }[] | null;
}): ModeTile {
  const { now, premium, rows } = opts;
  const claim = now ? claimOfTheDay(dayKey(now)).claim : null;
  let line = NBSP;
  if (premium === true) line = "Argue either side";
  else if (premium === false && rows && now) {
    const a = hostileAllowance(rows, now);
    line = a.nextAt
      ? hostileNextLine((a.nextAt.getTime() - now.getTime()) / 1000)
      : hostileLeftLine(a.left);
  }
  return {
    id: "hostile",
    href: "/hostile?from=today",
    name: "Hostile Q&A",
    subject: claim,
    line,
    done: false,
    label: sentence(["Hostile Q&A", claim ? `Today's claim: ${claim}` : null, line]),
  };
}

/** What the weekly boss asks, on Today's tile before the week is taken. */
export const BOSS_ASK_LINE = "Read it, explain it";

export function bossTile(opts: { now: Date | null; rows: readonly BossTakeRow[] | null }): ModeTile {
  const { now, rows } = opts;
  const topic = now ? weeklyTopic(now).title : null;
  const done = now && rows ? takeThisWeek(rows, now) !== null : null;
  /* No countdown and no time frame (#486, Timothy: "get rid of 6 days
     left", "they don't need to know any time frame"): what the boss
     asks, until the week is taken. */
  const line = done === true ? BOSS_DONE_LINE : done === false ? BOSS_ASK_LINE : NBSP;
  return {
    id: "boss",
    href: "/boss?from=today",
    name: "Weekly boss",
    subject: topic,
    line,
    done: done === true,
    label: sentence(["Weekly boss", topic ? `This week's topic: ${topic}` : null, line]),
  };
}
