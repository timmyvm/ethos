/**
 * The daily set — four small things, one of which is the rep.
 *
 * Competitor note (Wellspoken, researched 10 Aug): its home screen is a
 * short checklist of daily tasks rather than a single button, and that
 * is the thing that makes it feel designed. Ethos copies the SHAPE and
 * not the contents: vision.md still caps the loop at five minutes and
 * DECISIONS #9 still gives the rep the dominant card, so exactly one
 * task here records audio and the other three are under a minute each.
 *
 * Every task is backed by data we already hold. A checklist item that
 * can't be completed for real is worse than three that can.
 */

import type { LexiconRow, RepRow } from "./client-data";
import type { StreakState } from "./streak";

export type DailyTaskId = "rep" | "flash" | "listen" | "checkin";

export interface DailyTask {
  id: DailyTaskId;
  title: string;
  /** What it costs you, in words the user can budget against. */
  cost: string;
  blurb: string;
  done: boolean;
  /** False when there isn't yet the history to make it real. */
  available: boolean;
  /** Why it's not available yet — shown instead of a dead row. */
  lockedNote?: string;
  href?: string;
}

const KEY = "ethos.daily";

function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

type DoneMap = Partial<Record<DailyTaskId, string>>;

function readDone(): DoneMap {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as DoneMap;
  } catch {
    return {};
  }
}

export function isDone(id: DailyTaskId, now = new Date()): boolean {
  return readDone()[id] === todayKey(now);
}

export function markDone(id: DailyTaskId, now = new Date()): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...readDone(), [id]: todayKey(now) })
    );
  } catch {}
}

export interface DailySetInput {
  reps: RepRow[];
  lexicon: LexiconRow[];
  streak: StreakState;
  now?: Date;
}

export function dailySet(input: DailySetInput): DailyTask[] {
  const { reps, lexicon, streak } = input;
  const now = input.now ?? new Date();
  const lastRep = reps[reps.length - 1];
  const withAudio = [...reps].reverse().find((r) => r.audio_path);

  return [
    {
      id: "rep",
      title: "Today's rep",
      cost: "60–90s",
      blurb: "One prompt, recorded and measured.",
      done: streak.didToday,
      available: true,
      href: "/rep",
    },
    {
      id: "flash",
      title: "Lexicon flash",
      cost: "30s",
      blurb: "Three upgrades from your own transcripts, recalled cold.",
      done: isDone("flash", now),
      available: lexicon.length >= 3,
      lockedNote:
        lexicon.length === 0
          ? "Your first rep fills this."
          : `${3 - lexicon.length} more upgrade${3 - lexicon.length === 1 ? "" : "s"} to collect.`,
    },
    {
      id: "listen",
      title: "Listen back",
      cost: "40s",
      blurb: "Hear one pause you held. The evidence, not our word for it.",
      done: isDone("listen", now),
      available: Boolean(withAudio),
      lockedNote: "Needs a stored rep with audio.",
      href: withAudio ? `/rep/${withAudio.id}` : undefined,
    },
    {
      id: "checkin",
      title: "Check in with Demos",
      cost: "20s",
      blurb: "What your last few reps actually show.",
      done: isDone("checkin", now),
      available: reps.length >= 2,
      lockedNote:
        reps.length === 0
          ? "Two reps and there's a trend to read."
          : "One more rep and there's a trend to read.",
    },
  ].map((t) => ({
    ...t,
    // An unavailable task is never "done" — that would tick a box the
    // user did not earn.
    done: t.available ? t.done : false,
  })) as DailyTask[];
}

export interface DailyProgress {
  done: number;
  total: number;
  /** Only the tasks the user can actually do today. */
  available: number;
  allDone: boolean;
}

export function dailyProgress(tasks: DailyTask[]): DailyProgress {
  const available = tasks.filter((t) => t.available);
  const done = available.filter((t) => t.done).length;
  return {
    done,
    total: tasks.length,
    available: available.length,
    allDone: available.length > 0 && done === available.length,
  };
}
