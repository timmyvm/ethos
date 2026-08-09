/**
 * Deterministic scoring engine — BUILD-PLAN.md step 1, layer 3.
 *
 * Pure functions over Whisper word-level timestamps. No LLM anywhere in
 * this file: these numbers are the product's integrity (vision.md:
 * "measure, don't flatter"). Every metric traces to a timestamp.
 */

/** One word from Whisper verbose_json `words[]`. */
export interface Word {
  word: string;
  start: number;
  end: number;
}

/** One segment from Whisper verbose_json `segments[]` (sentence-ish). */
export interface Segment {
  start: number;
  end: number;
  text: string;
}

/** Matches BUILD-PLAN schema: fillers jsonb [{word, t}] */
export interface FillerHit {
  word: string;
  t: number;
}

/**
 * Matches BUILD-PLAN schema: pauses jsonb [{t, len, kind}]
 * - beat: 0.3–0.8s — natural rhythm, not scored
 * - pre:  ≥0.8s landing before a sentence — composed (the good silence)
 * - mid:  ≥0.8s inside a sentence — searching for words
 */
export type PauseKind = "beat" | "pre" | "mid";

export interface Pause {
  t: number;
  len: number;
  kind: PauseKind;
}

export interface RepMetrics {
  durationS: number;
  wordCount: number;
  wpm: number;
  fillerCount: number;
  fillersPerMin: number;
  fillers: FillerHit[];
  fillerCounts: Record<string, number>;
  topFiller: string | null;
  pauses: Pause[];
  heldPauses: number;
  composedPauses: number; // kind === "pre"
  midSentencePauses: number; // kind === "mid"
  stars: 1 | 2 | 3;
}

export const BEAT_MIN_S = 0.3;
export const HELD_MIN_S = 0.8;

/** Single-word fillers counted verbatim. "like" is handled separately. */
const SIMPLE_FILLERS = new Set([
  "um",
  "uh",
  "erm",
  "basically",
  "actually",
  "literally",
]);

/** Two-word fillers, matched on consecutive words. */
const BIGRAM_FILLERS = [
  ["you", "know"],
  ["sort", "of"],
  ["kind", "of"],
];

/**
 * "like" disambiguation — the naive pass BUILD-PLAN asks for.
 * Skip (i.e. treat as legitimate) when it reads as comparison or verb:
 *   - preceded by a perception/comparison word: "feels like", "looks like",
 *     "something like", "just like", "much like"
 *   - followed by a noun-phrase opener: "like a", "like the", "like my"
 *   - followed by "to" (verb usage: "I'd like to")
 * Everything else counts. Accept imperfection; log for tuning.
 */
const LIKE_PREV_SKIP = new Set([
  "feel",
  "feels",
  "felt",
  "look",
  "looks",
  "looked",
  "sound",
  "sounds",
  "sounded",
  "seem",
  "seems",
  "seemed",
  "something",
  "anything",
  "nothing",
  "just",
  "much",
  "would",
  "d", // "I'd like"
]);

const LIKE_NEXT_SKIP = new Set([
  "a",
  "an",
  "the",
  "this",
  "that",
  "these",
  "those",
  "my",
  "your",
  "his",
  "her",
  "its",
  "our",
  "their",
  "to",
]);

/** Lowercase, strip punctuation and whitespace: " Hello," -> "hello" */
export function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9']/g, "")
    .replace(/^'+|'+$/g, "");
}

/** Does this raw word end a sentence? (Whisper attaches punctuation.) */
function endsSentence(raw: string): boolean {
  return /[.?!]["')\]]*\s*$/.test(raw);
}

export function detectFillers(words: Word[]): {
  fillers: FillerHit[];
  fillerCounts: Record<string, number>;
} {
  const norm = words.map((w) => normalizeWord(w.word));
  const fillers: FillerHit[] = [];
  const fillerCounts: Record<string, number> = {};
  const consumed = new Array(words.length).fill(false);

  const hit = (label: string, t: number) => {
    fillers.push({ word: label, t: round2(t) });
    fillerCounts[label] = (fillerCounts[label] ?? 0) + 1;
  };

  // Bigrams first so "you know" doesn't fall through to single-word passes.
  for (let i = 0; i < words.length - 1; i++) {
    if (consumed[i]) continue;
    for (const [a, b] of BIGRAM_FILLERS) {
      if (norm[i] === a && norm[i + 1] === b) {
        // "kind of a" / "sort of thing" are usually hedges — still counted.
        consumed[i] = consumed[i + 1] = true;
        hit(`${a} ${b}`, words[i].start);
        break;
      }
    }
  }

  for (let i = 0; i < words.length; i++) {
    if (consumed[i]) continue;
    const w = norm[i];
    if (SIMPLE_FILLERS.has(w)) {
      hit(w, words[i].start);
      continue;
    }
    if (w === "like") {
      const prev = i > 0 ? norm[i - 1] : null;
      const next = i < words.length - 1 ? norm[i + 1] : null;
      // Sentence boundary before "like" kills the comparison reading of prev.
      const prevEnds = i > 0 && endsSentence(words[i - 1].word);
      const prevSkips = !prevEnds && prev !== null && LIKE_PREV_SKIP.has(prev);
      const nextSkips = next !== null && LIKE_NEXT_SKIP.has(next);
      if (!prevSkips && !nextSkips) hit("like", words[i].start);
    }
  }

  fillers.sort((a, b) => a.t - b.t);
  return { fillers, fillerCounts };
}

/**
 * Gaps between consecutive word timestamps, classified.
 * Held pauses (≥0.8s) split into pre-sentence vs mid-sentence — this
 * classification IS the pause-bar data (BUILD-PLAN).
 */
export function detectPauses(words: Word[], segments?: Segment[]): Pause[] {
  const pauses: Pause[] = [];
  const segStarts = new Set(
    (segments ?? []).map((s) => Math.round(s.start * 100))
  );

  const startsSegment = (w: Word): boolean => {
    if (segStarts.size === 0) return false;
    // Whisper segment starts align with their first word within ~50ms.
    for (let ms = -5; ms <= 5; ms++) {
      if (segStarts.has(Math.round(w.start * 100) + ms)) return true;
    }
    return false;
  };

  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1].start - words[i].end;
    if (gap < BEAT_MIN_S) continue;
    const t = round2(words[i].end);
    const len = round2(gap);
    if (gap < HELD_MIN_S) {
      pauses.push({ t, len, kind: "beat" });
      continue;
    }
    const pre = endsSentence(words[i].word) || startsSegment(words[i + 1]);
    pauses.push({ t, len, kind: pre ? "pre" : "mid" });
  }
  return pauses;
}

/** Star thresholds — DECISIONS.md #10: objective metrics only. */
export function starsForFillerRate(fillersPerMin: number): 1 | 2 | 3 {
  if (fillersPerMin < 3) return 3;
  if (fillersPerMin < 6) return 2;
  return 1;
}

export function computeMetrics(
  words: Word[],
  durationS: number,
  segments?: Segment[]
): RepMetrics {
  const dur =
    durationS > 0 ? durationS : words.length ? words[words.length - 1].end : 0;
  const minutes = dur / 60;

  const { fillers, fillerCounts } = detectFillers(words);
  const pauses = detectPauses(words, segments);

  const fillerCount = fillers.length;
  const fillersPerMin = minutes > 0 ? fillerCount / minutes : 0;
  const topFiller =
    Object.entries(fillerCounts).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    )[0]?.[0] ?? null;

  const composedPauses = pauses.filter((p) => p.kind === "pre").length;
  const midSentencePauses = pauses.filter((p) => p.kind === "mid").length;

  return {
    durationS: round2(dur),
    wordCount: words.length,
    wpm: minutes > 0 ? Math.round(words.length / minutes) : 0,
    fillerCount,
    fillersPerMin: round2(fillersPerMin),
    fillers,
    fillerCounts,
    topFiller,
    pauses,
    heldPauses: composedPauses + midSentencePauses,
    composedPauses,
    midSentencePauses,
    stars: starsForFillerRate(fillersPerMin),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
