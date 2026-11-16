/**
 * Where a sentence ends, read from Whisper's own punctuation (#476).
 *
 * Whisper's word list carries no punctuation (`lib/transcript-words.ts`
 * says so), so a word could never say it closed a sentence, and the
 * pause scorer fell back to Whisper's segment starts: a "landing" was a
 * pause Whisper happened to start a new segment after. The segments'
 * text does carry the full stops. This lines that text up with the timed
 * words, by letters as the transcript does, so each word knows whether a
 * . ? or ! follows it.
 *
 * How, one segment at a time:
 *  - The segment's letters (a to z and digits, lowercased, nothing else)
 *    must equal the letters of a run of consecutive words, read in order.
 *    Splits and joins come out in the wash: "five-minute" against
 *    "five" "minute", "3.5" against "3.5", "don't" against "don't".
 *  - The run starts at a word that begins between a second before the
 *    segment starts and the segment's end; of several, the one nearest
 *    the segment's start. Whisper times segments and words separately, so
 *    the two can disagree by a few hundred ms; a second is the slack.
 *  - A word in an aligned segment ends a sentence when the text between
 *    its last letter and the next one holds a . ? or !. "..." and "…" do
 *    not count: the disfluency prompt (`lib/transcribe.ts`) teaches
 *    Whisper to write them where you hesitate. Nor does a full stop
 *    inside a number ("3.5").
 *  - A segment whose text and words disagree (a number written one way
 *    and spoken another, a word in one and not the other) aligns nothing.
 *    Its words keep the rule used before: their own punctuation, or the
 *    next word starting a Whisper segment within 50 ms.
 *
 * Known misses, all rare in speech and none costing more than one pause:
 * an abbreviation ("Mr.", "U.S.") reads as a full stop, and a segment
 * repeated word for word within a second can align to the other copy.
 *
 * `supabase/replay/pause-replay.sql` does the same in SQL, and
 * `lib/pause-replay.test.ts` holds the two to one answer.
 */

import type { Segment, Word } from "./metrics";

/** A segment's first word may start this long before the segment does. */
export const ALIGN_SLACK_S = 1.0;

/** Letters and digits, lowercased: what the text and the words are matched on. */
export function alignLetters(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Today's rule for a word that carries its own punctuation. */
export function endsWithStop(raw: string): boolean {
  return /[.?!]["')\]]*\s*$/.test(raw);
}

/**
 * Does the text between one run of letters and the next end a sentence?
 * `run` is the letters before it, `next` the letters after it.
 */
export function gapEndsSentence(gap: string, run: string, next: string): boolean {
  const clean = gap.replace(/\.{2,}|…/g, "");
  if (/[?!]/.test(clean)) return true;
  if (!clean.includes(".")) return false;
  // A full stop inside a number ("3.5", "1.000") is not a sentence end.
  return !(clean === "." && /[0-9]$/.test(run) && /^[0-9]/.test(next));
}

/** Letter offsets in `text` after which a sentence ends. */
function stopOffsets(text: string): Set<number> {
  const runs = [...text.toLowerCase().matchAll(/([a-z0-9]+)([^a-z0-9]*)/g)];
  const out = new Set<number>();
  let at = 0;
  runs.forEach((m, i) => {
    at += m[1].length;
    if (gapEndsSentence(m[2], m[1], runs[i + 1]?.[1] ?? "")) out.add(at);
  });
  return out;
}

export interface SentenceEnds {
  /**
   * Per word: a . ? or ! follows it in the segment text (true or false),
   * or null when no aligned segment covers it.
   */
  marks: (boolean | null)[];
  /**
   * Per word: a sentence ends after it. `marks` where there is one, and
   * otherwise the rule used before: its own punctuation, or the next word
   * starting a Whisper segment within 50 ms.
   */
  stops: boolean[];
  /** How many segments aligned, of how many. */
  aligned: number;
  segments: number;
}

export function sentenceEnds(words: Word[], segments: Segment[] = []): SentenceEnds {
  const n = words.length;
  const lens = words.map((w) => alignLetters(w.word).length);
  const stream = words.map((w) => alignLetters(w.word)).join("");
  const off: number[] = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    off.push(acc);
    acc += lens[i];
  }
  const boundaries = new Set<number>([...off, stream.length]);

  const marks: (boolean | null)[] = new Array(n).fill(null);
  let aligned = 0;
  for (const s of segments) {
    const target = alignLetters(s.text ?? "");
    if (!target) continue;
    let best = -1;
    for (let j = 0; j < n; j++) {
      if (lens[j] === 0) continue;
      if (words[j].start < s.start - ALIGN_SLACK_S || words[j].start > s.end) continue;
      if (!boundaries.has(off[j] + target.length)) continue;
      if (stream.slice(off[j], off[j] + target.length) !== target) continue;
      if (best < 0 || Math.abs(words[j].start - s.start) < Math.abs(words[best].start - s.start)) {
        best = j;
      }
    }
    if (best < 0) continue;
    aligned++;
    const stops = stopOffsets(s.text);
    const from = off[best];
    for (let k = best; k < n && off[k] < from + target.length; k++) {
      const mark = lens[k] > 0 && stops.has(off[k] + lens[k] - from);
      marks[k] = (marks[k] ?? false) || mark;
    }
  }

  // Whisper segment starts align with their first word within ~50ms.
  const segStarts = new Set(segments.map((s) => Math.round(s.start * 100)));
  const startsSegment = (w: Word): boolean => {
    if (segStarts.size === 0) return false;
    for (let ms = -5; ms <= 5; ms++) {
      if (segStarts.has(Math.round(w.start * 100) + ms)) return true;
    }
    return false;
  };
  const stops = words.map(
    (w, i) => marks[i] ?? (endsWithStop(w.word) || (i + 1 < n && startsSegment(words[i + 1])))
  );

  return { marks, stops, aligned, segments: segments.length };
}
