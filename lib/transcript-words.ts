/**
 * The transcript as tappable words (#411): the text Whisper returned,
 * cut into words and the gaps between them, each word given the time it
 * was said and what it is.
 *
 * The text keeps its punctuation and Whisper's word list does not, so
 * the two are aligned by letters, in order, with a short look-ahead for
 * a word one of them split differently. A word the list never matched
 * keeps no time: the sheet then says nothing about when, rather than a
 * guess.
 *
 * The marks, in the order they claim a word:
 *  - filler: exactly the engine's (lib/metrics.ts fillerSpans), run on
 *    the same word list the score was counted from, so an underline is
 *    a counted filler and nothing else is;
 *  - vague: lib/thesaurus.ts VAGUE, two-word phrases first ("a lot"),
 *    except inside a set phrase where the word is exact ("good luck",
 *    SET_PHRASES, #428): those words stay unmarked, as the sheet's keep;
 *  - repeat: a word that is not small (STOPWORDS), said three times or
 *    more, plural and singular counted together.
 *
 * A stored recording without its word list (an old row) is read from
 * the text alone: fillers are found the same way and take their times,
 * by label and in order, from the stored filler list.
 */

import { fillerSpans, type FillerHit, type Word } from "./metrics";
import { SET_PHRASES, STOPWORDS, VAGUE_BIGRAMS, VAGUE_SET, wordKey } from "./thesaurus";

export type WordMark = "filler" | "vague" | "repeat" | null;

export interface TranscriptUnit {
  kind: "word";
  /** Its place among the words, for keyboard order. */
  n: number;
  /** As printed, the inside gap included ("you know"). */
  text: string;
  /** As the sheet names it: lowercased unless it is "I" or a name mid-sentence. */
  display: string;
  /** Lowercased, punctuation gone: what the thesaurus and saved words file it under. */
  key: string;
  /** Seconds into the recording, or null when the word list never said. */
  start: number | null;
  mark: WordMark;
  /** A filler's label as the engine counted it ("you know"). */
  filler?: string;
  /** A repeated word: how many times it was said. */
  times?: number;
  /** A small word: nothing to swap. */
  small: boolean;
  /** The sentence it was said in. */
  sentence: string;
  /** Where it starts in `sentence`, so the sheet can set it apart there. */
  inSentence: number;
}

export interface TranscriptGap {
  kind: "gap";
  text: string;
}

export type TranscriptPiece = TranscriptUnit | TranscriptGap;

/** A word as the text spells it, contractions and hyphenations whole. */
const TOKEN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*(?:-[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*)*/gu;

/** Letters and digits only, for matching the text against the word list. */
const letters = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Plural and singular as one: "habits" and "habit", "stories" and "story". */
function stem(key: string): string {
  const k = key.replace(/'s$/, "").replace(/'/g, "");
  if (k.length > 4 && k.endsWith("ies")) return `${k.slice(0, -3)}y`;
  if (k.length > 3 && k.endsWith("s") && !/(ss|us|is)$/.test(k)) return k.slice(0, -1);
  return k;
}

interface Token {
  text: string;
  from: number;
  to: number;
  key: string;
  start: number | null;
  /** Which of `words` it matched, or -1. */
  at: number;
}

/** Each text token's place in the word list, by letters, in order. */
function align(tokens: Token[], words: Word[]) {
  let j = 0;
  for (const t of tokens) {
    const want = letters(t.text);
    if (!want) continue;
    let found = -1;
    for (let k = j; k < Math.min(words.length, j + 5) && found < 0; k++) {
      // The same word, or a word the list split in two or three ("five-minute").
      let joined = "";
      for (let m = k; m < Math.min(words.length, k + 3); m++) {
        joined += letters(words[m].word);
        if (joined === want) {
          found = k;
          j = m + 1;
          break;
        }
        if (!want.startsWith(joined)) break;
      }
    }
    if (found >= 0) {
      t.at = found;
      t.start = words[found].start;
    }
  }
}

/** Sentence spans of the text, by its own full stops. */
function sentences(text: string): { from: number; to: number; text: string }[] {
  const out: { from: number; to: number; text: string }[] = [];
  const re = /[^.!?]+(?:[.!?]+["')\]”’]*|$)/g;
  let m;
  while ((m = re.exec(text))) {
    if (!m[0].trim()) {
      if (re.lastIndex === m.index) re.lastIndex++;
      continue;
    }
    const lead = m[0].length - m[0].trimStart().length;
    out.push({ from: m.index + lead, to: m.index + m[0].length, text: m[0].trim() });
  }
  return out;
}

export function transcriptPieces(
  text: string,
  words: Word[] | null | undefined,
  fillers: FillerHit[] = []
): TranscriptPiece[] {
  const tokens: Token[] = [];
  for (const m of text.matchAll(TOKEN)) {
    const from = m.index ?? 0;
    tokens.push({ text: m[0], from, to: from + m[0].length, key: wordKey(m[0]), start: null, at: -1 });
  }
  if (tokens.length === 0) return text ? [{ kind: "gap", text }] : [];

  const list = words && words.length > 0 ? words : null;
  if (list) align(tokens, list);

  /* Fillers: the engine's spans, on the list the score came from, mapped
     back onto the text; without a list, on the text's own words. */
  type Claim = { first: number; last: number; mark: Exclude<WordMark, null>; filler?: string; start?: number | null };
  const claims = new Map<number, Claim>();
  const claimed = new Set<number>();
  const claim = (c: Claim) => {
    for (let i = c.first; i <= c.last; i++) if (claimed.has(i)) return;
    for (let i = c.first; i <= c.last; i++) claimed.add(i);
    claims.set(c.first, c);
  };
  if (list) {
    const byListIndex = new Map<number, number>();
    tokens.forEach((t, i) => {
      if (t.at >= 0 && !byListIndex.has(t.at)) byListIndex.set(t.at, i);
    });
    for (const s of fillerSpans(list)) {
      const first = byListIndex.get(s.index);
      if (first === undefined) continue;
      const second = s.length === 2 ? byListIndex.get(s.index + 1) : first;
      const last = second !== undefined && second === first + 1 ? second : first;
      claim({ first, last, mark: "filler", filler: s.label, start: list[s.index].start });
    }
  } else {
    const pool = [...fillers];
    for (const s of fillerSpans(tokens.map((t) => ({ word: t.text })))) {
      const hit = pool.findIndex((f) => f.word === s.label);
      const start = hit >= 0 ? pool.splice(hit, 1)[0].t : null;
      claim({ first: s.index, last: s.index + s.length - 1, mark: "filler", filler: s.label, start });
    }
  }

  /* Set phrases (#428): a vague word doing exact work ("good luck",
     "the very end") is not underlined, since the sheet's answer for it is
     keep. Matched on consecutive words with only spaces between. */
  const exact = new Set<number>();
  for (const phrase of SET_PHRASES) {
    const parts = phrase.split(" ");
    for (let i = 0; i + parts.length <= tokens.length; i++) {
      const fits = parts.every(
        (p, k) => tokens[i + k].key === p && (k === 0 || /^\s+$/.test(text.slice(tokens[i + k - 1].to, tokens[i + k].from)))
      );
      if (fits) for (let k = 0; k < parts.length; k++) exact.add(i + k);
    }
  }

  // Vague: the two-word phrases first, then single words.
  for (let i = 0; i < tokens.length - 1; i++) {
    if (exact.has(i) || exact.has(i + 1)) continue;
    for (const [a, b] of VAGUE_BIGRAMS) {
      if (tokens[i].key === a && tokens[i + 1].key === b && /^\s+$/.test(text.slice(tokens[i].to, tokens[i + 1].from))) {
        claim({ first: i, last: i + 1, mark: "vague" });
      }
    }
  }
  tokens.forEach((t, i) => {
    if (VAGUE_SET.has(t.key) && !exact.has(i)) claim({ first: i, last: i, mark: "vague" });
  });

  // Repeats: words that are not small, said three times or more.
  const counts = new Map<string, number>();
  const stems = tokens.map((t) => {
    if (t.key.length < 3 || STOPWORDS.has(t.key) || /^\d+$/.test(t.key)) return null;
    return stem(t.key);
  });
  stems.forEach((s, i) => {
    if (s && !claimed.has(i)) counts.set(s, (counts.get(s) ?? 0) + 1);
  });

  const spans = sentences(text);
  const sentenceAt = (at: number) => spans.find((s) => at >= s.from && at < s.to);
  const startsSentence = (at: number) => {
    const before = text.slice(0, at).trimEnd();
    return before === "" || /[.!?]["')\]”’]*$/.test(before);
  };

  const out: TranscriptPiece[] = [];
  let cursor = 0;
  let n = 0;
  for (let i = 0; i < tokens.length; i++) {
    const c = claims.get(i);
    const last = c ? c.last : i;
    const first = tokens[i];
    const end = tokens[last];
    if (first.from > cursor) out.push({ kind: "gap", text: text.slice(cursor, first.from) });
    const printed = text.slice(first.from, end.to);
    const key = c?.filler ?? (last > i ? wordKey(printed) : first.key);
    const times = !c && stems[i] ? counts.get(stems[i]!) ?? 0 : 0;
    const mark: WordMark = c ? c.mark : times >= 3 ? "repeat" : null;
    const lower = printed.toLowerCase();
    // "I" stays a capital, an acronym stays one, and a sentence's first
    // word loses the capital only the sentence gave it.
    const acronym = printed.length > 1 && printed === printed.toUpperCase() && /\p{L}/u.test(printed);
    const display =
      lower === "i" || /^i['’]/.test(lower)
        ? `I${printed.slice(1)}`
        : acronym || !startsSentence(first.from)
          ? printed
          : lower;
    out.push({
      kind: "word",
      n: n++,
      text: printed,
      display: display.replace(/’/g, "'"),
      key,
      start: c && c.start !== undefined ? c.start : first.start,
      mark,
      ...(c?.filler ? { filler: c.filler } : {}),
      ...(mark === "repeat" ? { times } : {}),
      small: !c && STOPWORDS.has(key),
      sentence: sentenceAt(first.from)?.text ?? "",
      inSentence: Math.max(0, first.from - (sentenceAt(first.from)?.from ?? first.from)),
    });
    cursor = end.to;
    i = last;
  }
  if (cursor < text.length) out.push({ kind: "gap", text: text.slice(cursor) });
  return out;
}

/** m:ss, as every timestamp in the app reads. */
export function clockOf(t: number): string {
  const s = Math.max(0, t);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
