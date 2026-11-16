/**
 * Whisper-shaped takes for tests (#476): what whisper-1's verbose_json
 * really returns, which the older pause fixtures did not. Its word list
 * has no punctuation and no leading spaces; its segments carry the
 * punctuated text, "..." where the disfluency prompt taught it to write
 * one; segment and word times come from different passes and do not
 * quite agree.
 *
 * A take is written as segments of text, the way Whisper would print
 * them, with a small notation for what the words did:
 *
 *   "So, um, I've been thinking. [1.4]"   a 1.4s silence after "thinking."
 *   "{Twenty|20} people stayed."          the text says "Twenty", the word list "20"
 *   "{really|} good"                      a word the text has and the list does not
 *   "um,~0.9"                             a word that lasted 0.9s
 *
 * Every other word lasts `wordS` and the next starts `stepS` after it
 * starts, so the gap between words is under a beat unless a hold says so.
 */

import type { Segment, Word } from "../metrics";

export interface SpokenSegment {
  /** The segment's text in the notation above. */
  text: string;
  /**
   * Where Whisper puts the segment's start: 40ms before its first word
   * ("word", the default), where the previous segment ended ("previous"),
   * or this many seconds before its first word.
   */
  start?: "word" | "previous" | number;
}

export interface WhisperTake {
  text: string;
  durationS: number;
  words: Word[];
  segments: Segment[];
  raw: {
    task: "transcribe";
    language: "english";
    duration: number;
    text: string;
    segments: (Segment & {
      id: number;
      seek: number;
      tokens: number[];
      temperature: number;
      avg_logprob: number;
      compression_ratio: number;
      no_speech_prob: number;
    })[];
    words: Word[];
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A text token's word as Whisper's list writes it: its punctuation gone. */
export function bareWord(token: string): string {
  return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

interface Tok {
  text: string | null;
  word: string | null;
  dur: number | null;
  hold: number;
}

function parse(text: string): Tok[] {
  const toks: Tok[] = [];
  for (const raw of text.trim().split(/\s+/)) {
    const hold = /^\[(\d+(?:\.\d+)?)\]$/.exec(raw);
    if (hold) {
      if (toks.length) toks[toks.length - 1].hold = Number(hold[1]);
      continue;
    }
    const [body, dur] = raw.split("~");
    const swap = /^\{([^|}]*)\|([^}]*)\}(.*)$/.exec(body);
    const shown = swap ? swap[1] + swap[3] : body;
    const said = swap ? (swap[2] ? swap[2] + bareWord(swap[3]) : null) : bareWord(body);
    toks.push({
      text: shown || null,
      word: said || null,
      dur: dur ? Number(dur) : null,
      hold: 0,
    });
  }
  return toks;
}

export function whisperTake(
  spoken: SpokenSegment[],
  { lead = 0.52, tail = 0.8, wordS = 0.3, stepS = 0.38 }: { lead?: number; tail?: number; wordS?: number; stepS?: number } = {}
): WhisperTake {
  const words: Word[] = [];
  const segments: Segment[] = [];
  let t = lead;
  let prevEnd = 0;
  for (const seg of spoken) {
    const toks = parse(seg.text);
    const first = words.length;
    for (const tok of toks) {
      if (tok.word) {
        const dur = tok.dur ?? wordS;
        words.push({ word: tok.word, start: r2(t), end: r2(t + dur) });
        t += Math.max(stepS, dur + (stepS - wordS));
      }
      if (tok.hold) t += tok.hold - (stepS - wordS);
    }
    const mine = words.slice(first);
    const firstStart = mine[0]?.start ?? r2(t);
    const start =
      seg.start === "previous"
        ? prevEnd
        : typeof seg.start === "number"
          ? r2(Math.max(0, firstStart - seg.start))
          : r2(Math.max(0, firstStart - 0.04));
    const end = r2((mine[mine.length - 1]?.end ?? firstStart) + 0.06);
    const text = " " + toks.map((x) => x.text).filter(Boolean).join(" ");
    segments.push({ start, end, text });
    prevEnd = end;
  }
  const durationS = r2((words[words.length - 1]?.end ?? 0) + tail);
  const text = segments.map((s) => s.text).join("").trim();
  return {
    text,
    durationS,
    words,
    segments,
    raw: {
      task: "transcribe",
      language: "english",
      duration: durationS,
      text,
      segments: segments.map((s, id) => ({
        id,
        seek: 0,
        ...s,
        tokens: [],
        temperature: 0,
        avg_logprob: -0.24,
        compression_ratio: 1.38,
        no_speech_prob: 0.012,
      })),
      words,
    },
  };
}

/**
 * The take the end-to-end tests read. Eight held pauses, each a case the
 * old rules got wrong or the new ones must still get right:
 *
 *  P0 after "talk."            a full stop, but the next segment starts where
 *                              this one ended, not at its first word: landing
 *                              (before #476: searching, no segment start)
 *  P1 after "say..."           a segment ends on "...": searching
 *                              (before: a landing, a segment starts after it)
 *  P2 after "losing."          a full stop mid-segment: landing (before: searching)
 *  P3 after "left."            landing, "2019" and "3.5" in the sentence
 *  P4 after "thing."           its segment says "Twenty" where the words say
 *                              "20", so it falls back to the segment start:
 *                              landing, and "Like," after it is not an um
 *                              (before: filled, any filler within 1.2s)
 *  P5 after "them."            an "um" 1.1s into the next sentence: landing
 *                              (before: filled)
 *  P6 after "um,"              an um leaning on it: filled, both ways
 *  P7 after "lands."           in the last fifth: the ending landed
 *
 * #476's rules score it 73; the rules before scored it 26.
 */
export const SHAPED_TAKE: SpokenSegment[] = [
  { text: "So, um, I've been thinking about why most of us rush when we talk. [1.4]" },
  { text: "It's not that we have nothing to say... [1.1]", start: "previous" },
  { text: "it's that silence feels like losing. [1.2] In 2019 I timed 3.5 seconds of quiet in a talk, and nobody left. [1.3]" },
  { text: "{Twenty|20} people stayed for the whole thing. [1.5]" },
  { text: "Like, honestly, the gap feels longer to you than to them. [1.0]" },
  { text: "And when you, um, [0.9] rush it, the point never lands. [1.6]", start: "previous" },
  { text: "So stop, breathe, and let the last line sit with them." },
];
