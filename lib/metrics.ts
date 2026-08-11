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
  /**
   * Self-corrections: a phrase restarted with a different landing.
   * A listener hears one of these exactly the way they hear an "um".
   */
  repairCount: number;
  repairsPerMin: number;
  /**
   * Fillers + repairs. Scored SEPARATELY in the Index — they are
   * different problems with different fixes — but stars need one
   * number, and to a listener both are the same kind of stumble.
   */
  disfluenciesPerMin: number;
  pauses: Pause[];
  heldPauses: number;
  composedPauses: number; // kind === "pre"
  midSentencePauses: number; // kind === "mid"
  stars: 1 | 2 | 3;
  /** Was there a rep here at all — length and variety, not opinion. */
  substance: Substance;
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

/**
 * Self-corrections: a phrase run again with a different landing —
 * "ease the days rest", then "ease the days problems". The run-up
 * repeats, the ending changes.
 *
 * Only near-adjacent repeats count. Saying the same phrase again a
 * paragraph later is a vocabulary question, and `rangeScore` already
 * owns that.
 */
const REPAIR_MAX_NGRAM = 4;
const REPAIR_MAX_GAP = 2;

export function detectRepairs(words: Word[]): number {
  const tokens = words.map((w) => normalizeWord(w.word)).filter(Boolean);
  let count = 0;
  const claimed = new Set<number>();

  // Longest run-up first, so "ease the days" is one repair rather than
  // also counting "ease the" and "the days" nested inside it.
  for (let k = REPAIR_MAX_NGRAM; k >= 1; k--) {
    for (let i = 0; i + k <= tokens.length; i++) {
      if (claimed.has(i)) continue;
      for (let j = i + 1; j <= i + k + REPAIR_MAX_GAP && j + k <= tokens.length; j++) {
        if (claimed.has(j)) continue;
        let same = true;
        for (let n = 0; n < k; n++) {
          if (tokens[i + n] !== tokens[j + n]) {
            same = false;
            break;
          }
        }
        if (!same) continue;
        count++;
        for (let n = 0; n < k; n++) {
          claimed.add(i + n);
          claimed.add(j + n);
        }
        break;
      }
    }
  }
  return count;
}

/**
 * Star thresholds — DECISIONS.md #10: objective metrics only.
 *
 * Reads the DISFLUENCY rate, not the filler rate: an "um" and a
 * restarted sentence are the same event to whoever is listening, and
 * counting only one of them was how a rep with audible self-corrections
 * came back three stars. Cut points are unchanged and now measure more,
 * so they are due a recalibration on real recordings.
 */
export function starsForDisfluencyRate(perMin: number): 1 | 2 | 3 {
  if (perMin < 3) return 3;
  if (perMin < 6) return 2;
  return 1;
}

/**
 * Substance — is there actually a rep here to score?
 *
 * Filler rate alone is a trap: say "I don't know" eight times and you
 * have zero fillers, a clean pace and three stars. That is exactly the
 * flattery DECISIONS #10 exists to prevent, and it makes every other
 * number on the screen a lie.
 *
 * Deterministic, no LLM — the same rule as every other metric here.
 */
export interface Substance {
  wordCount: number;
  /** Type-token ratio: distinct words / total words. */
  distinctRatio: number;
  /** Largest share of the rep taken up by one repeated phrase. */
  repeatShare: number;
}

const WORD_RE = /[a-z0-9']+/g;

export function substance(text: string): Substance {
  const tokens = (text.toLowerCase().match(WORD_RE) ?? []).filter(Boolean);
  const wordCount = tokens.length;
  if (wordCount === 0) {
    return { wordCount: 0, distinctRatio: 0, repeatShare: 1 };
  }
  const distinctRatio = new Set(tokens).size / wordCount;

  // How much of the rep is one phrase said over and over.
  const trigrams = new Map<string, number>();
  for (let i = 0; i + 2 < tokens.length; i++) {
    const k = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
    trigrams.set(k, (trigrams.get(k) ?? 0) + 1);
  }
  const topCount = Math.max(0, ...trigrams.values());
  const repeatShare =
    tokens.length > 3 ? Math.min(1, (topCount * 3) / tokens.length) : 0;

  return {
    wordCount,
    distinctRatio: Math.round(distinctRatio * 1000) / 1000,
    repeatShare: Math.round(repeatShare * 1000) / 1000,
  };
}

/** Below this there is no rep to score, only noise. */
export const MIN_WORDS_TO_SCORE = 20;

/**
 * The ceiling substance puts on stars. It can only ever LOWER the star
 * count — a varied vocabulary never buys a star that the filler rate
 * didn't earn.
 */
export function substanceStarCap(s: Substance): 1 | 2 | 3 {
  if (s.wordCount < MIN_WORDS_TO_SCORE) return 1;
  if (s.distinctRatio < 0.3 || s.repeatShare > 0.4) return 1;
  if (s.distinctRatio < 0.45 || s.repeatShare > 0.2) return 2;
  return 3;
}

/** True when there is enough real speech for the Index to mean anything. */
export function isScorable(s: Substance): boolean {
  return s.wordCount >= MIN_WORDS_TO_SCORE && s.distinctRatio >= 0.3;
}

export function starsFor(disfluenciesPerMin: number, s: Substance): 1 | 2 | 3 {
  return Math.min(
    starsForDisfluencyRate(disfluenciesPerMin),
    substanceStarCap(s)
  ) as 1 | 2 | 3;
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
  const repairCount = detectRepairs(words);
  const repairsPerMin = minutes > 0 ? repairCount / minutes : 0;
  const disfluenciesPerMin =
    minutes > 0 ? (fillerCount + repairCount) / minutes : 0;
  const topFiller =
    Object.entries(fillerCounts).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    )[0]?.[0] ?? null;

  const composedPauses = pauses.filter((p) => p.kind === "pre").length;
  const midSentencePauses = pauses.filter((p) => p.kind === "mid").length;

  // Stars are capped by whether anything was actually said. Reading the
  // words back off the token stream keeps this in step with the
  // transcript even when no separate text is handed in.
  const sub = substance(words.map((w) => w.word).join(" "));

  return {
    durationS: round2(dur),
    wordCount: words.length,
    wpm: minutes > 0 ? Math.round(words.length / minutes) : 0,
    fillerCount,
    fillersPerMin: round2(fillersPerMin),
    fillers,
    fillerCounts,
    topFiller,
    repairCount,
    repairsPerMin: round2(repairsPerMin),
    disfluenciesPerMin: round2(disfluenciesPerMin),
    pauses,
    heldPauses: composedPauses + midSentencePauses,
    composedPauses,
    midSentencePauses,
    stars: starsFor(disfluenciesPerMin, sub),
    substance: sub,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
