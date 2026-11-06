import type { TraitId } from "@/content/traits";
import type { RewardMoment } from "./rewards";

/**
 * The last step's closing note (DECISIONS #423): the take's last word,
 * set as the step's closing sentence rather than one more card under
 * "Records broken". Its headline is read for the one number it is about,
 * and that number wears the colour of what it measured:
 *
 * - a trait's reading ("3 composed pauses", "Zero fillers", "145 words a
 *   minute") wears the trait's tone, as a trait does everywhere;
 * - an earned close with no trait (a streak, a level opened, a game
 *   mastered) wears sage, since sage is what was earned;
 * - a plain count ("Recording 22 logged") stays in the page's ink.
 *
 * Its line is set a sentence to a line, so a two-sentence close reads
 * as two ("Silence you chose, before a new point." / "That's the hard
 * one.") and never breaks mid-clause on a narrow phone.
 */
export interface ClosingLook {
  /** The words before the number ("Recording "), or "". */
  pre: string;
  /** The number the line is about ("3", "Zero", "Level 3"); null when the line has none. */
  value: string | null;
  /** The words after the number (" composed pauses"), or the whole line when it has none. */
  post: string;
  /** Whose colour the number wears. */
  ink: "trait" | "earned" | "plain";
  /** The trait a "trait" ink reads; null otherwise. */
  trait: TraitId | null;
  /** The detail, one sentence per line. */
  lines: string[];
}

/** A level ("Level 3"), a count in digits, or "Zero", the one count the closings spell. */
const NUMBER = /\bLevel \d+\b|\b\d[\d,.]*\b|\bZero\b/;

/** "Silence you chose, before a new point. That's the hard one." as its two sentences. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=\S)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function closingLook(m: RewardMoment): ClosingLook {
  const ink: ClosingLook["ink"] = m.trait ? "trait" : m.tone === "earned" ? "earned" : "plain";
  const trait = m.trait ?? null;
  const lines = sentences(m.detail);
  const hit = NUMBER.exec(m.headline);
  if (!hit) return { pre: "", value: null, post: m.headline, ink, trait, lines };
  return {
    pre: m.headline.slice(0, hit.index),
    value: hit[0],
    post: m.headline.slice(hit.index + hit[0].length),
    ink,
    trait,
    lines,
  };
}
