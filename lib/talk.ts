/**
 * Demos talking (#501, Timothy, 18 Nov: "it needs more pop in the text
 * sound"): what he says in the introduction's bubble lands a word at a
 * time, each word springing in with a blip under it (lib/intro-sound.ts),
 * and he moves while it does.
 *
 * Quick, so it never holds a reader up: a word every 50 to 85 ms, the
 * step set per line so no line takes much more than 0.9 s however long it
 * is (a reader takes about 240 ms a word), and 140 ms between his
 * question and the line under it. A tap anywhere finishes it at once
 * (components/Talk.tsx).
 *
 * Under reduced motion every word is there at `lead`, whole, and the
 * sound follows the words: one blip for what lands at once.
 *
 * `instant` is a line that follows a hand (the name's reply, which
 * changes with every key typed): it is there from the first frame, whole
 * and silent, because a line re-said per keystroke is a flicker and a
 * blip per key, not Demos talking (#501 review).
 *
 * Pure: the plan is worked out from the text alone, so a test can read
 * each word's millisecond.
 */

export const TALK_PACE = {
  /** The most a line's words take, before the step's floor stretches it. */
  lineMs: 900,
  /** Between two words: never faster, never slower. */
  minStepMs: 50,
  maxStepMs: 85,
  /** Between one line and the next. */
  lineGapMs: 140,
} as const;

export type TalkPlan = {
  /** Each line's words, as they will be drawn. */
  lines: string[][];
  /** When each word lands, in milliseconds, in reading order across the lines. */
  at: number[];
  /** When a blip sounds: under every word, or once under reduced motion. */
  blips: number[];
  /** When the last word lands. */
  doneAt: number;
};

export const wordsOf = (text: string) => text.trim().split(/\s+/).filter(Boolean);

/** The step between two words of a line this long. */
export function stepFor(words: number): number {
  if (words <= 0) return TALK_PACE.maxStepMs;
  return Math.round(Math.min(TALK_PACE.maxStepMs, Math.max(TALK_PACE.minStepMs, TALK_PACE.lineMs / words)));
}

export function planTalk(
  lines: readonly string[],
  { lead = 0, reduced = false, instant = false }: { lead?: number; reduced?: boolean; instant?: boolean } = {}
): TalkPlan {
  const split = lines.map(wordsOf).filter((w) => w.length > 0);
  const total = split.reduce((n, w) => n + w.length, 0);
  if (total === 0) return { lines: split, at: [], blips: [], doneAt: lead };
  if (instant) return { lines: split, at: new Array(total).fill(0), blips: [], doneAt: 0 };
  if (reduced) {
    return { lines: split, at: new Array(total).fill(lead), blips: [lead], doneAt: lead };
  }
  const at: number[] = [];
  let t = lead;
  split.forEach((words, k) => {
    if (k > 0) t += TALK_PACE.lineGapMs;
    const step = stepFor(words.length);
    words.forEach((_, i) => {
      if (i > 0) t += step;
      at.push(t);
    });
  });
  return { lines: split, at, blips: [...at], doneAt: at[at.length - 1] };
}

/** How many words have landed `elapsed` ms in. */
export function landedAt(plan: TalkPlan, elapsed: number): number {
  let n = 0;
  for (const t of plan.at) if (t <= elapsed) n += 1;
  return n;
}
