/**
 * "Say this instead" (DECISIONS #429): Demos's one upgrade to the
 * speaker's own words, held to the word sheet's rule (#428). It keeps
 * what they meant and says it better, or it is not said at all.
 *
 * Timothy, 8 Nov, "sure" to giving it that rule. The live pair in every
 * camera shot, "the thing about" to "what matters about", turned a
 * framing phrase into a claim of importance: the coach was asked for a
 * "stronger" word, with nothing about the sentence or the meaning, and
 * had no way to say none.
 *
 * The model now answers upgrade or none (lib/coach.ts). This file holds
 * what a machine can check of the rule, so a reply that fails it is
 * dropped and the take simply has no "Say this instead": never a retry,
 * never the take's coach or its Index. Meaning and strength are the
 * prompt's job; this catches the shapes that are always wrong.
 *
 * Pure: no SDK, no network. The coach, the Log and the tests share it.
 */
import { BANNED_PHRASES, GYM_REGISTER, HYPE_PHRASES } from "./register";
import { FILLERS, VAGUE_WORDS } from "./words";

/** The upgrade as the app keeps and shows it (reps.supply, lexicon). */
export interface Supply {
  original: string;
  upgrade: string;
  note: string;
}

export type UpgradeWhy = "precise" | "vivid" | "shorter";

/** The note under the pair: one of three fixed lines, Ethos's own copy (#428 did the same for keep). */
export const UPGRADE_NOTES: Record<UpgradeWhy, string> = {
  precise: "It says exactly what you meant.",
  vivid: "It lets them picture it.",
  shorter: "It says the same in fewer words.",
};

/** 40 is saved_words' width (#428), so a later Save on the sheet fits. */
export const UPGRADE_LIMITS = { fromWords: 8, fromChars: 60, toWords: 6, toChars: 40 } as const;

/** Why an upgrade was dropped: a reason only, never the speaker's words. */
export type DropReason =
  | "shape"
  | "long"
  | "not-said"
  | "filler-only"
  | "dash"
  | "same"
  | "register"
  | "hype"
  | "vague"
  | "filler"
  | "intensifier"
  | "bookish"
  | "number"
  | "new-name";

/* ---- words ------------------------------------------------------------- */

/** Lowercase, apostrophes straightened: curly, and the modifier letter (U+02BC) some keyboards and models write. */
const fold = (s: string) => s.toLowerCase().replace(/[‘’ʼ]/g, "'");
/** Matching ignores apostrophes too, so "dont" finds "don’t"; the words shown are the transcript's own. */
const bare = (w: string) => w.replace(/'/g, "");
/** A word: letters and digits, with inner apostrophes ("don't", "rock'n'roll"). */
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const tokens = (s: string) => [...fold(s).matchAll(WORD)].map((m) => m[0]);

interface Token {
  w: string;
  start: number;
  end: number;
}
const tokensAt = (s: string): Token[] =>
  [...s.matchAll(WORD)].map((m) => ({ w: bare(fold(m[0])), start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));

/**
 * The transcript's sentences, in order. A terminator ends one unless it
 * sits between two digits ("1.5 fillers"), as lib/coach.ts splitSentences
 * counts them, so a phrase across "end. So" is never one place.
 */
function sentences(text: string): string[] {
  const out: string[] = [];
  const re = /(?<!\d)[.!?…]+(?!\d)|(?<=\d)[.!?]+(?=\s|$)/g;
  let from = 0;
  for (const m of text.matchAll(re)) {
    const end = (m.index ?? 0) + m[0].length;
    out.push(text.slice(from, end));
    from = end;
  }
  if (from < text.length) out.push(text.slice(from));
  return out.filter((s) => s.trim());
}

/**
 * Where `phrase` is said, as whole words inside one sentence of
 * `transcript`: the words as the transcript spells them, and their
 * sentence. Case, punctuation, spacing and apostrophes aside, so
 * "really really good" finds "really, really good" and "art" never
 * matches inside "start". Null when it is not said.
 */
export function saidIn(phrase: string, transcript: string): { said: string; sentence: string } | null {
  const want = tokens(phrase).map(bare);
  if (want.length === 0) return null;
  for (const s of sentences(transcript)) {
    const t = tokensAt(s);
    for (let i = 0; i + want.length <= t.length; i++) {
      if (want.every((w, k) => t[i + k].w === w)) {
        return { said: s.slice(t[i].start, t[i + want.length - 1].end), sentence: s.trim() };
      }
    }
  }
  return null;
}

/* ---- the lists --------------------------------------------------------- */

/** The engine's fillers plus the spoken ones it does not count: never the words worth upgrading, never brought in. */
const UPGRADE_FILLERS: readonly string[] = [...FILLERS, "like", "i mean", "so yeah", "yeah"];
/** The commonest stronger claim: more of these than the speaker said. */
const INTENSIFIERS: readonly string[] = ["very", "really", "so", "extremely", "totally", "absolutely", "incredibly", "super", "completely", "utterly"];
/** After "so", these make it the conjunction ("so we left", "so that"), which claims nothing: a short way round "and because of that". */
const SO_JOINS = new Set([
  "i", "i'm", "i'd", "i'll", "i've", "we", "you", "he", "she", "they", "it", "it's", "that", "this", "these", "those",
  "the", "a", "an", "there", "then", "now", "if", "when", "my", "our", "your", "his", "her", "their", "its",
]);
/** How many intensifiers a word key holds; "so" counts only where it modifies the word after it. */
function intensifiers(key: string): number {
  const w = key.split(" ");
  return w.filter((x, i) => INTENSIFIERS.includes(x) && (x !== "so" || (i + 1 < w.length && !SO_JOINS.has(w[i + 1])))).length;
}
/** "I" and its contractions are a word, never a name, wherever they sit. */
const I_WORD = /^I(?:['’ʼ](?:m|d|ll|ve))?$/;
const HYPE: readonly string[] = [...HYPE_PHRASES, ...BANNED_PHRASES, "phenomenal", "outstanding", "unbelievable"];
/** A written word for a spoken one. */
const BOOKISH: readonly string[] = [
  "utilise", "utilize", "commence", "myriad", "plethora", "endeavour", "endeavor", "facilitate", "leverage",
  "paramount", "pivotal", "delve", "ascertain", "elucidate", "multifaceted", "moreover", "furthermore", "numerous", "arduous",
];
const NUMBER_WORDS = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundreds?|thousands?|millions?|dozens?)\b/i;

/** Whether `phrase` is in the word key `key` as whole words ("high-value" as "high value"). */
const holds = (key: string, phrase: string) => ` ${key} `.includes(` ${tokens(phrase).join(" ")} `);

/** Whether every word of `words` is a filler, the two-word ones ("you know") taken whole. */
function onlyFillers(words: string[]): boolean {
  const fillers = UPGRADE_FILLERS.map((f) => f.split(" "));
  for (let i = 0; i < words.length; ) {
    const f = fillers.find((p) => p.every((w, k) => words[i + k] === w));
    if (!f) return false;
    i += f.length;
  }
  return true;
}

/**
 * A model's string, trimmed, single-spaced, its quotes and end
 * punctuation gone (brackets stay, so "(pause)" is not a word). Single
 * quotes go only when they wrap the whole string: one at the end alone
 * is an apostrophe ("my parents'"), the speaker's grammar.
 */
function strip(s: unknown): string {
  if (typeof s !== "string") return "";
  let t = s.replace(/\s+/g, " ").trim();
  for (let was = ""; was !== t; ) {
    was = t;
    t = t.replace(/^["“”]+|["“”]+$/g, "").replace(/[.,;:!?]+$/, "").trim();
    if (t.length > 1 && /^['‘’]/.test(t) && /['‘’]$/.test(t)) t = t.slice(1, -1).trim();
  }
  return t;
}

/* ---- the checks -------------------------------------------------------- */

type Checked = { ok: true; said: string; from: string; to: string } | { ok: false; dropped: DropReason };

/**
 * The checks that hold for any pair, new or stored: the from is the
 * speaker's, said once in a sentence and not only fillers; the to is
 * words, with no dash, different from the from, and not the banned register.
 */
function checkPair(original: unknown, upgrade: unknown, transcript: string, { limits = true } = {}): Checked {
  const from = strip(original);
  const to = strip(upgrade);
  if (!from || !to) return { ok: false, dropped: "shape" };
  const fromT = tokens(from);
  const toT = tokens(to);
  if (fromT.length === 0 || toT.length === 0) return { ok: false, dropped: "long" };
  if (limits && (fromT.length > UPGRADE_LIMITS.fromWords || from.length > UPGRADE_LIMITS.fromChars)) {
    return { ok: false, dropped: "long" };
  }
  if (limits && (toT.length > UPGRADE_LIMITS.toWords || to.length > UPGRADE_LIMITS.toChars)) {
    return { ok: false, dropped: "long" };
  }
  const place = saidIn(from, transcript);
  if (!place) return { ok: false, dropped: "not-said" };
  const fromKey = fromT.join(" ");
  const toKey = toT.join(" ");
  if (onlyFillers(fromT)) return { ok: false, dropped: "filler-only" };
  if (/[–—]/.test(to)) return { ok: false, dropped: "dash" };
  if (!/^[\p{L}\p{N}'’ ,-]+$/u.test(to)) return { ok: false, dropped: "shape" };
  if (toT.map(bare).join(" ") === fromT.map(bare).join(" ")) return { ok: false, dropped: "same" };
  if (GYM_REGISTER.test(to) && !GYM_REGISTER.test(from)) return { ok: false, dropped: "register" };
  return { ok: true, said: place.said, from: fromKey, to: toKey };
}

/**
 * The model's upgrade made safe to show, or null with the reason. A
 * "none" is an answer, not a drop. Never throws.
 *
 * `raw` is the reply's supply as it came: `{verdict, original, upgrade, why}`.
 * The original shown is the transcript's own spelling of the match, so
 * the speaker's casing and commas stay.
 */
export function cleanUpgrade(raw: unknown, transcript: string): { supply: Supply | null; dropped?: DropReason } {
  if (!raw || typeof raw !== "object") return { supply: null, dropped: "shape" };
  const r = raw as Record<string, unknown>;
  if (r.verdict === "none") return { supply: null };
  if (r.verdict !== "upgrade") return { supply: null, dropped: "shape" };
  const pair = checkPair(r.original, r.upgrade, transcript);
  if (!pair.ok) return { supply: null, dropped: pair.dropped };
  const { from: fromKey, to: toKey } = pair;
  const to = strip(r.upgrade);
  // Nothing the from did not already hold.
  const brings = (list: readonly string[]) => list.some((w) => holds(toKey, w) && !holds(fromKey, w));
  if (brings(HYPE)) return { supply: null, dropped: "hype" };
  if (brings(VAGUE_WORDS)) return { supply: null, dropped: "vague" };
  if (brings(UPGRADE_FILLERS)) return { supply: null, dropped: "filler" };
  if (intensifiers(toKey) > intensifiers(fromKey)) return { supply: null, dropped: "intensifier" };
  if (brings(BOOKISH)) return { supply: null, dropped: "bookish" };
  const digits = (s: string): string[] => s.match(/\d+/g) ?? [];
  const fromText = strip(r.original);
  if (digits(to).some((d) => !digits(fromText).includes(d))) return { supply: null, dropped: "number" };
  if (NUMBER_WORDS.test(to) && !NUMBER_WORDS.test(fromText)) return { supply: null, dropped: "number" };
  // A name the speaker never said is a new fact (the first word may be capitalised by position; "I", "I'd" are words).
  const said = new Set(tokens(transcript).map(bare));
  const names = [...to.matchAll(WORD)]
    .slice(1)
    .map((m) => m[0])
    .filter((w) => /^\p{Lu}/u.test(w) && !I_WORD.test(w));
  if (names.some((n) => !said.has(bare(fold(n))))) return { supply: null, dropped: "new-name" };
  const why = typeof r.why === "string" && Object.prototype.hasOwnProperty.call(UPGRADE_NOTES, r.why) ? (r.why as UpgradeWhy) : "precise";
  const note = UPGRADE_NOTES[why];
  return { supply: { original: pair.said, upgrade: to, note } };
}

/**
 * A stored pair, as the Log shows it: the pair when it still passes the
 * checks any pair must (said in a sentence of its take, not only
 * fillers, words with no dash, different, not the banned register), or
 * null. Old rows held "um" to "(pause)" and the register's verbs; those
 * stop showing. Today's length limits are for new answers: a row stored
 * under the old ones (120 characters) is not wrong for being longer. It
 * cannot catch an old change of meaning, and the stored note stays.
 */
export function shownSupply(stored: Supply | null | undefined, transcript: string): Supply | null {
  if (!stored) return null;
  return checkPair(stored.original, stored.upgrade, transcript, { limits: false }).ok ? stored : null;
}
