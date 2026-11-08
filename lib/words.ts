/**
 * The word sheet's request and answer, shared by the phone
 * (lib/words-client.ts) and the route (app/api/words): what a valid ask
 * is, what a valid answer is, and the key both caches file it under.
 * No SDK and no network here, so the browser bundle can import it.
 *
 * Since #428 (Timothy, 7 Nov: "the try instead words are shittt") an
 * answer is a verdict on the word in its sentence, not a list of words
 * like it: `swap` names what it replaces (the word, or the idiom or
 * phrase it sits in: "switch things up") and one to three ways to say
 * that better; `keep` says the word is already right ("dollar") with one
 * fixed line from KEEP_NOTES. The rule an option has to pass is in the
 * prompt (lib/words-server.ts); this file holds what a reply must be
 * before anyone sees it.
 */

import { GYM_REGISTER } from "./register";
import { VAGUE } from "./thesaurus";

/**
 * Bumped whenever an answer's shape or meaning changes, so the phone's
 * kept answers and the server's memory file new answers under new keys
 * and never read an old one (v1 was the thesaurus list, #411).
 */
export const WORDS_VERSION = 2;

export const WORD_LIMITS = {
  /** The tapped unit: one word or a short phrase ("a lot", "you know"). */
  wordChars: 40,
  wordWords: 3,
  /** The sentence it was said in, cut to this around the word before it is sent. */
  sentenceChars: 300,
  /** A swap's options after cleaning: one right row is a full answer. */
  altMin: 1,
  altMax: 3,
  /** One option's length, and saved_words.instead's check (migration 0023). */
  altChars: 40,
  altWords: 5,
  /** What a swap replaces: saved_words.word's check is 40 characters. */
  replacesChars: 40,
  replacesWords: 6,
} as const;

/**
 * Why a word is kept, as the sheet says it. A fixed list (the schema's
 * enum), so every line on the sheet is Ethos's own copy: full sentences,
 * no dash, nothing about what the speaker said.
 */
export const KEEP_NOTES = [
  "A name says it exactly.",
  "A number says it exactly.",
  "A currency says it exactly.",
  "A unit says it exactly.",
  "The technical term is the exact one.",
  "It names exactly what you meant.",
  "It's part of a set phrase that's already right.",
  "Any swap would change what you meant.",
  "It's already the precise word.",
] as const;

export type KeepNote = (typeof KEEP_NOTES)[number];

/** A keep whose reason did not come back as one of the lines above. */
export const DEFAULT_KEEP_NOTE: KeepNote = "It's already the precise word.";

export interface WordAsk {
  /** The tapped word or phrase, as the sheet names it. */
  word: string;
  /** The sentence it was said in, whitespace collapsed, at most 300 characters. */
  sentence: string;
  /** Where the tapped word starts in `sentence` (0 when the sentence is empty). */
  at: number;
}

export interface WordAnswer {
  verdict: "swap" | "keep";
  /** The words in the sentence the options take the place of, as the sentence spells them. */
  replaces: string;
  /** Swap: one to three, best first. Keep: none. */
  alternatives: string[];
  /** Keep: one of KEEP_NOTES. Swap: "". */
  note: string;
}

/** Letters (any script), digits, apostrophes, hyphens, single spaces. */
const WORD_SHAPE = /^[\p{L}\p{N}'’-]+(?: [\p{L}\p{N}'’-]+)*$/u;
/** The same, with a comma allowed after a word ("Honestly, the whole thing"). */
const SPAN_SHAPE = /^[\p{L}\p{N}'’-]+(?:,? [\p{L}\p{N}'’-]+)*$/u;

/** Lowercase with curly apostrophes made straight: the same length, so offsets hold. */
const fold = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'");
const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}'’]/u.test(c);
const collapse = (s: string) => s.replace(/\s+/g, " ");

/** Whether `hay` holds `needle` at `i` as whole words. */
function wholeAt(hay: string, needle: string, i: number): boolean {
  return fold(hay.slice(i, i + needle.length)) === fold(needle) && !isWordChar(hay[i - 1]) && !isWordChar(hay[i + needle.length]);
}

/** The first place `needle` stands in `hay` as whole words, else anywhere, else -1. */
function firstPlace(hay: string, needle: string): number {
  const h = fold(hay);
  const n = fold(needle);
  for (let i = h.indexOf(n); i >= 0; i = h.indexOf(n, i + 1)) if (wholeAt(hay, needle, i)) return i;
  return h.indexOf(n);
}

/** Where the word is in the sentence: `at` when it is there, else its first place, else null. */
function placeOf(sentence: string, word: string, at: unknown): number | null {
  if (!sentence) return 0;
  if (typeof at === "number" && Number.isInteger(at) && at >= 0 && fold(sentence.slice(at, at + word.length)) === fold(word)) {
    return at;
  }
  const first = firstPlace(sentence, word);
  return first >= 0 ? first : null;
}

/**
 * The ask, cleaned, or null when it is not one word (or short phrase)
 * standing in its sentence. An old client sends no `at`: the word's
 * first place in the sentence stands in for it.
 */
export function cleanWordAsk(body: unknown): WordAsk | null {
  if (!body || typeof body !== "object") return null;
  const { word, sentence, at } = body as { word?: unknown; sentence?: unknown; at?: unknown };
  if (typeof word !== "string" || typeof sentence !== "string") return null;
  const w = collapse(word).trim();
  if (!w || w.length > WORD_LIMITS.wordChars) return null;
  if (w.split(" ").length > WORD_LIMITS.wordWords) return null;
  if (!WORD_SHAPE.test(w)) return null;
  const s = collapse(sentence).trim();
  if (s.length > WORD_LIMITS.sentenceChars) return null;
  const place = placeOf(s, w, at);
  if (place === null) return null;
  return { word: w, sentence: s, at: place };
}

/**
 * The sentence as it is sent: whitespace collapsed and cut to the limit
 * around the tapped word, with where the word now starts. `at` is the
 * word's place in `sentence` as given (the transcript's `inSentence`);
 * when it does not hold the word, its first place does.
 */
export function sentenceAround(sentence: string, at: number, word: string): { sentence: string; at: number } {
  const lead = sentence.length - sentence.trimStart().length;
  const s = collapse(sentence).trim();
  // The same place once the whitespace before it is collapsed.
  let place = collapse(sentence.slice(lead, Math.max(lead, at))).length;
  const w = collapse(word).trim();
  if (fold(s.slice(place, place + w.length)) !== fold(w)) place = Math.max(0, firstPlace(s, w));
  if (s.length <= WORD_LIMITS.sentenceChars) return { sentence: s, at: place };
  const half = Math.floor((WORD_LIMITS.sentenceChars - w.length) / 2);
  const from = Math.max(0, Math.min(place - half, s.length - WORD_LIMITS.sentenceChars));
  const raw = s.slice(from, from + WORD_LIMITS.sentenceChars);
  const trimmedStart = raw.length - raw.trimStart().length;
  return { sentence: raw.trim(), at: place - from - trimmedStart };
}

/** FNV-1a, 32 bits, as hex: a short stable name for a sentence. */
export function sentenceHash(sentence: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < sentence.length; i++) {
    h ^= sentence.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Where an answer is filed: the version, the word as said, where it
 * stands, and which sentence. The place is in the key because one
 * sentence can say a word twice and mean two things ("that was that").
 */
export function wordCacheKey(ask: WordAsk): string {
  return `v${WORDS_VERSION}|${ask.word.toLowerCase()}|${ask.at}|${sentenceHash(ask.sentence.toLowerCase())}`;
}

/** Words an option may not bring in when what it replaces did not already say them (and "Say this instead", lib/upgrade.ts). */
export const VAGUE_WORDS: readonly string[] = [...VAGUE, "lots", "loads", "tons", "heaps", "so many"];
/** The engine's fillers (lib/metrics.ts fillerSpans): never offered as a better word. */
export const FILLERS: readonly string[] = ["um", "uh", "erm", "basically", "actually", "literally", "you know", "kind of", "sort of"];

/** Whether `phrase` is in `text` as whole words. */
const holds = (text: string, phrase: string) => ` ${text} `.includes(` ${phrase} `);
/** Lowercased words with the sentence's commas gone, single spaces. */
const plain = (s: string) => fold(s).replace(/,/g, "").replace(/\s+/g, " ").trim();

/**
 * What a swap replaces, as the sentence spells it, or null when the
 * reply's `replaces` is not whole words of the sentence covering the
 * tapped word.
 */
function spanOf(raw: unknown, ask: WordAsk): string | null {
  if (typeof raw !== "string") return null;
  const span = collapse(raw)
    .trim()
    .replace(/^["'“”‘’.,;:!?()[\]\s]+|["'“”‘’.,;:!?()[\]\s]+$/g, "");
  if (!span || span.length > WORD_LIMITS.replacesChars) return null;
  if (span.split(" ").length > WORD_LIMITS.replacesWords || !SPAN_SHAPE.test(span)) return null;
  if (!ask.sentence) return fold(span) === fold(ask.word) ? ask.word : null;
  const start = Math.max(0, ask.at + ask.word.length - span.length);
  for (let i = start; i <= ask.at; i++) {
    if (wholeAt(ask.sentence, span, i)) return ask.sentence.slice(i, i + span.length);
  }
  return null;
}

/**
 * The options worth showing: strings, trimmed and unquoted, at most five
 * words and forty characters, best first, at most three. Never the
 * replaced words or the tapped word, never a dash, no repeats, no vague
 * word or filler that the replaced words did not already hold, nothing
 * from the banned register. Null when none survive.
 */
function cleanOptions(list: unknown, replaces: string, word: string): string[] | null {
  if (!Array.isArray(list)) return null;
  const was = plain(replaces);
  const refused = new Set([was, plain(word)]);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const alt = collapse(raw)
      .trim()
      .replace(/^["'“‘(]+|["'”’.,;:!?)]+$/g, "");
    if (!alt || alt.length > WORD_LIMITS.altChars) continue;
    if (alt.split(" ").length > WORD_LIMITS.altWords) continue;
    if (/[–—]/.test(alt) || !WORD_SHAPE.test(alt)) continue;
    const key = plain(alt);
    if (refused.has(key) || seen.has(key)) continue;
    if (VAGUE_WORDS.some((v) => holds(key, v) && !holds(was, v))) continue;
    if (FILLERS.some((f) => holds(key, f) && !holds(was, f)) || key === "like") continue;
    if (GYM_REGISTER.test(alt) && !GYM_REGISTER.test(replaces)) continue;
    seen.add(key);
    out.push(alt);
    if (out.length === WORD_LIMITS.altMax) break;
  }
  return out.length >= WORD_LIMITS.altMin ? out : null;
}

/**
 * A reply made safe to show, or null when it is not an answer. Keep is
 * a full answer: no options, and a note from KEEP_NOTES (any other note
 * becomes the default); when its `replaces` is not in the sentence over
 * the tapped word, it is kept for the word itself. A swap needs a
 * `replaces` that is whole words of the sentence over the tapped word,
 * and at least one option that survives cleanOptions. A swap whose
 * `replaces` cannot be found is a failed answer, never a list for the
 * word: its options were written for words the sentence does not hold
 * ("plans" for "switch thing up" would read "I switch plans up"), which
 * is the grammar-only fit #428 exists to stop (the #428 review).
 */
export function cleanAnswer(raw: unknown, ask: WordAsk): WordAnswer | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const reply = raw as { verdict?: unknown; replaces?: unknown; alternatives?: unknown; note?: unknown };
  if (reply.verdict !== "swap" && reply.verdict !== "keep") return null;
  const span = spanOf(reply.replaces, ask);
  if (reply.verdict === "keep") {
    const note =
      typeof reply.note === "string" && (KEEP_NOTES as readonly string[]).includes(reply.note) ? reply.note : DEFAULT_KEEP_NOTE;
    return { verdict: "keep", replaces: span ?? ask.word, alternatives: [], note };
  }
  if (!span) return null;
  const alternatives = cleanOptions(reply.alternatives, span, ask.word);
  if (!alternatives) return null;
  return { verdict: "swap", replaces: span, alternatives, note: "" };
}

/** Whether a swap replaces more than the tapped word (the sheet then says what it replaces). */
export function replacesPhrase(answer: WordAnswer, word: string): boolean {
  return fold(answer.replaces) !== fold(word);
}
