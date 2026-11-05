/**
 * The word sheet's alternatives, on the phone (#411). The curated map
 * first (lib/thesaurus.ts, instant), then this phone's own copy of every
 * answer the server gave (localStorage, so a second tap on the same word
 * in the same sentence is instant too), then the server (app/api/words).
 * Every failure throws: the sheet says the alternatives did not load and
 * offers its retry, never an empty list.
 */

import { sessionToken } from "./supabase-browser";
import { curatedFor } from "./thesaurus";
import { cleanAlternatives, sentenceAround, wordCacheKey, type WordAsk } from "./words";

const STORE = "ethos.words";
/** Answers this phone keeps, newest last; the oldest go past it. */
const STORE_CAP = 300;

type Kept = Record<string, string[]>;

function readKept(): Kept {
  try {
    const raw = localStorage.getItem(STORE);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Kept) : {};
  } catch {
    return {};
  }
}

function keep(key: string, alternatives: string[]) {
  try {
    const kept = readKept();
    delete kept[key];
    kept[key] = alternatives;
    const keys = Object.keys(kept);
    for (const old of keys.slice(0, Math.max(0, keys.length - STORE_CAP))) delete kept[old];
    localStorage.setItem(STORE, JSON.stringify(kept));
  } catch {
    // A full or blocked store costs the next tap a call, nothing more.
  }
}

/** The ask as it is sent: the sentence cut to its limit around the word. */
export function askFor(word: string, sentence: string): WordAsk {
  return { word, sentence: sentenceAround(sentence, word) };
}

/** Held on the phone already: the curated map or a kept answer. Null means the server has to be asked. */
export function heldAlternatives(ask: WordAsk): string[] | null {
  const curated = curatedFor(ask.word);
  if (curated) return [...curated];
  const kept = readKept()[wordCacheKey(ask)];
  return cleanAlternatives(kept, ask.word);
}

export class WordsUnavailable extends Error {
  constructor(readonly status: number) {
    super(`words: ${status}`);
    this.name = "WordsUnavailable";
  }
}

/** Alternatives for a word in its sentence, three to six; throws when they cannot be had. */
export async function alternativesFor(ask: WordAsk, signal?: AbortSignal): Promise<string[]> {
  const held = heldAlternatives(ask);
  if (held) return held;
  const token = await sessionToken();
  const res = await fetch("/api/words", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(ask),
    signal,
  });
  if (!res.ok) throw new WordsUnavailable(res.status);
  const body = (await res.json().catch(() => null)) as { alternatives?: unknown } | null;
  const alternatives = cleanAlternatives(body?.alternatives, ask.word);
  if (!alternatives) throw new WordsUnavailable(502);
  keep(wordCacheKey(ask), alternatives);
  return alternatives;
}
