/**
 * The word sheet's answer, on the phone (#411, #428). Every tap asks the
 * server (app/api/words) with the word's sentence and its place in it,
 * since whether a word should change, and what to, depends on the
 * sentence. Two things answer before the network:
 *
 *  - this phone's own copy of every answer the server gave
 *    (localStorage `ethos.words.v2`, filed under the versioned key, so a
 *    second tap on the same word in the same sentence is instant and an
 *    answer from an older version is never read; the v1 store,
 *    `ethos.words`, is deleted on the first read);
 *  - a token that is only digits ("200", "9.30"), which is kept with
 *    "A number says it exactly." and costs no call.
 *
 * There is no list to fall back on (DECISIONS #428): the curated map
 * that used to answer first could not read a sentence, and a confident
 * wrong list is worse than an honest one line. Every failure throws
 * WordsUnavailable, and the sheet says the alternatives did not load,
 * labelled "You're offline" when the phone knows it is, with its retry.
 */

import { sessionToken } from "./supabase-browser";
import { WORDS_VERSION, cleanAnswer, sentenceAround, wordCacheKey, type WordAnswer, type WordAsk } from "./words";

const STORE = `ethos.words.v${WORDS_VERSION}`;
/** The stores earlier versions kept, deleted once on this phone's first read. */
const OLD_STORES = ["ethos.words"];
/** Answers this phone keeps, newest last; the oldest go past it. */
const STORE_CAP = 300;

/** A token that is only a number as Whisper writes one. */
const DIGITS = /^\d+(?:[.,]\d+)?$/;

type Kept = Record<string, unknown>;

let swept = false;
function sweepOldStores() {
  if (swept) return;
  swept = true;
  try {
    for (const old of OLD_STORES) localStorage.removeItem(old);
  } catch {
    // A blocked store has nothing old to read either.
  }
}

/** For the tests: the next read sweeps the old stores again. */
export function resetWordsClientForTests() {
  swept = false;
}

function readKept(): Kept {
  sweepOldStores();
  try {
    const raw = localStorage.getItem(STORE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Kept) : {};
  } catch {
    return {};
  }
}

function keep(key: string, answer: WordAnswer) {
  try {
    const kept = readKept();
    delete kept[key];
    kept[key] = answer;
    const keys = Object.keys(kept);
    for (const old of keys.slice(0, Math.max(0, keys.length - STORE_CAP))) delete kept[old];
    localStorage.setItem(STORE, JSON.stringify(kept));
  } catch {
    // A full or blocked store costs the next tap a call, nothing more.
  }
}

/**
 * The ask as it is sent: the word, the sentence with its whitespace
 * collapsed and cut to its limit around the word, and where the word
 * starts in it. `inSentence` is the transcript unit's own place, so a
 * word said twice in one sentence asks about the one tapped.
 */
export function askFor(word: string, sentence: string, inSentence = 0): WordAsk {
  const w = word.replace(/\s+/g, " ").trim();
  const { sentence: s, at } = sentenceAround(sentence, inSentence, w);
  return { word: w, sentence: s, at };
}

/** Held on the phone already: a kept answer or a number. Null means the server has to be asked. */
export function heldAnswer(ask: WordAsk): WordAnswer | null {
  if (DIGITS.test(ask.word)) {
    return { verdict: "keep", replaces: ask.word, alternatives: [], note: "A number says it exactly." };
  }
  const kept = readKept()[wordCacheKey(ask)];
  return kept ? cleanAnswer(kept, ask) : null;
}

export class WordsUnavailable extends Error {
  constructor(
    readonly status: number,
    /** The phone said it had no connection, so the sheet can say so. */
    readonly offline = false
  ) {
    super(`words: ${offline ? "offline" : status}`);
    this.name = "WordsUnavailable";
  }
}

function phoneIsOffline(): boolean {
  try {
    return typeof navigator !== "undefined" && navigator.onLine === false;
  } catch {
    return false;
  }
}

/** Swap or keep for a word in its sentence; throws WordsUnavailable when it cannot be had. */
export async function answerFor(ask: WordAsk, signal?: AbortSignal): Promise<WordAnswer> {
  const held = heldAnswer(ask);
  if (held) return held;
  if (phoneIsOffline()) throw new WordsUnavailable(0, true);
  const token = await sessionToken();
  let res: Response;
  try {
    res = await fetch("/api/words", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(ask),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new WordsUnavailable(0, phoneIsOffline());
  }
  if (!res.ok) throw new WordsUnavailable(res.status);
  const body = (await res.json().catch(() => null)) as ({ v?: unknown } & Record<string, unknown>) | null;
  // An answer from another version (an instance mid-deploy) is a failure, never a list.
  const answer = body?.v === WORDS_VERSION ? cleanAnswer(body, ask) : null;
  if (!answer) throw new WordsUnavailable(502);
  keep(wordCacheKey(ask), answer);
  return answer;
}
