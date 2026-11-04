/**
 * The word sheet's request and answer, shared by the phone
 * (lib/words-client.ts) and the route (app/api/words): what a valid ask
 * is, what a valid answer is, and the key both caches file it under.
 * No SDK and no network here, so the browser bundle can import it.
 */

export const WORD_LIMITS = {
  /** One word or a short phrase ("a lot", "you know"). */
  wordChars: 40,
  wordWords: 3,
  /** The sentence it was said in, cut to this around the word before it is sent. */
  sentenceChars: 300,
  /** Alternatives an answer holds. */
  min: 3,
  max: 6,
  /** One alternative's length. */
  altChars: 40,
} as const;

/** Letters (any script), digits, apostrophes, hyphens, single spaces. */
const WORD_SHAPE = /^[\p{L}\p{N}'’-]+(?: [\p{L}\p{N}'’-]+)*$/u;

export interface WordAsk {
  word: string;
  sentence: string;
}

/** The ask, cleaned, or null when it is not one word (or short phrase) and a sentence. */
export function cleanWordAsk(body: unknown): WordAsk | null {
  if (!body || typeof body !== "object") return null;
  const { word, sentence } = body as { word?: unknown; sentence?: unknown };
  if (typeof word !== "string" || typeof sentence !== "string") return null;
  const w = word.trim().replace(/\s+/g, " ");
  if (!w || w.length > WORD_LIMITS.wordChars) return null;
  if (w.split(" ").length > WORD_LIMITS.wordWords) return null;
  if (!WORD_SHAPE.test(w)) return null;
  const s = sentence.replace(/\s+/g, " ").trim();
  if (s.length > WORD_LIMITS.sentenceChars) return null;
  return { word: w, sentence: s };
}

/**
 * The sentence cut to the limit around the word, so a long run-on still
 * sends the words either side of it.
 */
export function sentenceAround(sentence: string, word: string): string {
  const s = sentence.replace(/\s+/g, " ").trim();
  if (s.length <= WORD_LIMITS.sentenceChars) return s;
  const at = Math.max(0, s.toLowerCase().indexOf(word.toLowerCase()));
  const half = Math.floor((WORD_LIMITS.sentenceChars - word.length) / 2);
  const from = Math.max(0, Math.min(at - half, s.length - WORD_LIMITS.sentenceChars));
  return s.slice(from, from + WORD_LIMITS.sentenceChars).trim();
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

/** Where an answer is filed: the word as said, and which sentence. */
export function wordCacheKey(ask: WordAsk): string {
  return `${ask.word.toLowerCase()}|${sentenceHash(ask.sentence.toLowerCase())}`;
}

/**
 * The alternatives worth showing: strings, trimmed, one to three words,
 * never the word itself, never a dash, no repeats, at most six. Null
 * when fewer than three survive: a sheet with one suggestion is a
 * failed answer, not a short one.
 */
export function cleanAlternatives(list: unknown, word: string): string[] | null {
  if (!Array.isArray(list)) return null;
  const said = word.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const alt = raw.trim().replace(/\s+/g, " ").replace(/^["'“‘]+|["'”’.,;:!?]+$/g, "");
    const key = alt.toLowerCase();
    if (!alt || alt.length > WORD_LIMITS.altChars) continue;
    if (alt.split(" ").length > WORD_LIMITS.wordWords) continue;
    if (/[–—]/.test(alt) || !WORD_SHAPE.test(alt)) continue;
    if (key === said || seen.has(key)) continue;
    seen.add(key);
    out.push(alt);
    if (out.length === WORD_LIMITS.max) break;
  }
  return out.length >= WORD_LIMITS.min ? out : null;
}
