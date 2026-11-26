/**
 * The warm-up's own two lines (#477): the number it leads with and what
 * to do instead. Apart from the cue's engine (lib/carried-cue.ts), which
 * re-exports both, so the reminder (lib/reminder-copy.ts) can say them
 * word for word without carrying the engine into Today, which reads the
 * reminder's words through lib/reminders.ts.
 *
 * Pure, and nothing here but words: every number is a field of the cue.
 */
import type { Cue } from "./carried-cue";

/** A word as the cue says it, in curly quotes: “like”. */
export const q = (w: string | null) => `“${w ?? ""}”`;
export const times = (n: number) => (n === 1 ? "once" : `${n} times`);
export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * What to do instead, as the warm-up's title: silence where the habit
 * was (plan section 9, idea 5), or the one move a pace or a word needs.
 */
export function cueTitle(cue: Pick<Cue, "kind" | "word">): string {
  switch (cue.kind) {
    case "filler":
      return `Pause where ${q(cue.word)} was`;
    case "searching":
      return "Pause between sentences";
    case "filled":
      return "Keep each pause silent";
    case "unheld":
      return "Pause once after a full sentence";
    case "restarts":
      return "Pause, then finish the sentence";
    case "fast":
      return "Pause at every full stop";
    case "slow":
      return "Keep each sentence moving";
    case "repeat":
      return `Find another word for ${q(cue.word)}`;
  }
}

/** The number the warm-up leads with, the cue's newest: "Last time, “like” 9 times". */
export function warmupLead(cue: Pick<Cue, "kind" | "word" | "last">): string {
  const n = cue.last;
  switch (cue.kind) {
    case "filler":
    case "repeat":
      return `Last time, ${q(cue.word)} ${times(n)}`;
    case "searching":
      return `Last time, ${n} ${plural(n, "misplaced pause", "misplaced pauses")}`;
    case "filled":
      return `Last time, ${n} ${plural(n, "pause", "pauses")} had an um`;
    case "unheld":
      return "Last time, no pauses between sentences";
    case "restarts":
      return `Last time, ${n} ${plural(n, "sentence restart", "sentence restarts")}`;
    case "fast":
    case "slow":
      return `Last time, ${n} words a minute`;
  }
}
