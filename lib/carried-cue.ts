/**
 * Feedback that sticks (DECISIONS #477, docs/plan-next.md section 9).
 *
 * Timothy, 16 Nov: you read "kill like", you understand it, and tomorrow
 * you do the same thing, because you cannot think about a rule and speak
 * at the same time. So a take ends on ONE cue to carry, phrased as what
 * to do instead (a pause where the filler was: silence is the
 * replacement), the next day's recorder rehearses only that cue before
 * Record, and the next day's result answers it first, with its number,
 * then retires it when it held or carries it when it did not, for up to
 * three answers, then rests it.
 *
 * The cue is the glance's cue (#427), not a second one: on a take that
 * carries it (Today's practice, a topic of your own; not a lesson's
 * practice, a game or the boss, whose cues point at the next practice,
 * the ladder and next week), Demos's line is the cue's evidence or its
 * answer, and the cue slot says what to do tomorrow.
 *
 * Every number here is a field of a take (a filler's count, a pause's
 * verdict, the words a minute) or a time in it, so every sentence traces
 * to one. Pure: the store is lib/cue-store.ts.
 */

import type { TraitId } from "@/content/traits";
import {
  FILLER_LEAD_S,
  FILLER_TAIL_S,
  PACE_ZONE,
  plain,
  windowAt,
  withMoment,
  type GlanceLine,
  type GlanceMoment,
  type GlancePart,
} from "./glance";
import type { FillerHit, Pause, RepMetrics, Word } from "./metrics";
import { landedPause } from "./pause-mark";
import { filledMoments, MOMENT_LEAD_S, MOMENT_TAIL_S, type PauseVerdict } from "./pause-quality";
import { stem, transcriptPieces, type TranscriptUnit } from "./transcript-words";

/** What a cue is about: one measured thing, each in one trait's unit. */
export type CueKind = "filler" | "searching" | "filled" | "unheld" | "restarts" | "fast" | "slow" | "repeat";

export const CUE_TRAIT: Record<CueKind, TraitId> = {
  filler: "fillers",
  searching: "pause",
  filled: "pause",
  unheld: "pause",
  restarts: "repairs",
  fast: "pace",
  slow: "pace",
  repeat: "range",
};

/** Where the pause goes in a warm-up sentence. */
export const PAUSE_MARK = "‖";
/** Answers a cue gets without holding before it rests (plan section 9, idea 6 lite). */
export const CARRY_DAYS = 3;
/** Days a cue that held or rested is not chosen again. */
export const ASIDE_DAYS = 7;
/**
 * Cues kept aside at once (the #477 review). One slot let a cue that held
 * come straight back when the next one retired inside its seven days:
 * "um" held on Tuesday, restarts on Wednesday, and Wednesday's take was
 * free to hand "um" back. Eight is more than a week of daily answers.
 */
export const ASIDE_MAX = 8;
/** The longest word and warm-up sentence the store keeps; a take never writes what it cannot read back. */
export const WORD_MAX = 40;
export const LINE_MAX = 240;

/** The cue being carried. */
export interface Cue {
  kind: CueKind;
  /** The filler ("like", "you know") or the repeated word; null for the rest. */
  word: string | null;
  /** The number it was set on: the bar it holds against. */
  from: number;
  /** The newest number measured for it ("down from 9"); `from` until answered. */
  last: number;
  /** The local day it was set, YYYY-MM-DD. */
  givenOn: string;
  /** The local day of its newest answer, or null before the first. */
  answeredOn: string | null;
  /** Answers that did not hold. */
  tries: number;
  /** The warm-up's sentence, `PAUSE_MARK` where the pause goes, and where in the take it was said. */
  line: { text: string; at: number | null } | null;
}

/** A cue set aside (held or rested), not chosen again before `until`. */
export interface Aside {
  key: string;
  until: string;
}

/** What is stored per account (profiles.carried_cue, migration 0034). */
export interface CueState {
  v: 1;
  cue: Cue | null;
  /** Every cue set aside and not yet back, oldest first, at most `ASIDE_MAX`. */
  aside: Aside[];
  /** When it was written, ISO: the newer of the account's copy and this phone's wins. */
  at: string;
}

/** The fields of a take a cue reads. */
export interface CueTake {
  metrics: Pick<RepMetrics, "durationS" | "wpm" | "fillerCount"> & {
    fillers?: FillerHit[] | null;
    fillerCounts?: Record<string, number> | null;
    repairCount?: number | null;
    pauses?: (Pause & { verdict?: PauseVerdict })[] | null;
  };
  /** The measured five, out of 100: the lowest with a cue is the weakest. */
  tier1: Partial<Record<TraitId, number>>;
  transcript?: string;
  words?: Word[] | null;
}

const ORDER: CueKind[] = ["filler", "filled", "searching", "unheld", "restarts", "fast", "slow", "repeat"];

export function cueKey(c: { kind: CueKind; word: string | null }): string {
  return `${c.kind}:${c.word ?? ""}`;
}

/* ---- days --------------------------------------------------------------- */

/** A local day, YYYY-MM-DD, as every day key in the app is written. */
export function cueDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/* ---- measuring a take --------------------------------------------------- */

interface Found {
  kind: CueKind;
  word: string | null;
  n: number;
}

const secsOf = (take: CueTake) => Math.round(take.metrics.durationS);
const sortedFillers = (take: CueTake) => [...(take.metrics.fillers ?? [])].sort((a, b) => a.t - b.t);

/** How many times a filler was said: from its times, else the stored counts. */
function fillerTimes(take: CueTake, word: string): number {
  const hits = take.metrics.fillers ?? [];
  if (hits.length > 0) return hits.filter((f) => f.word === word).length;
  return take.metrics.fillerCounts?.[word] ?? 0;
}

interface PauseRead {
  filled: number;
  searching: (Pause & { verdict?: PauseVerdict })[];
  landed: (Pause & { verdict?: PauseVerdict })[];
  firstFilled: GlanceMoment | null;
}

function readPauses(take: CueTake): PauseRead {
  const pauses = take.metrics.pauses ?? [];
  const filled = filledMoments(pauses);
  const held = pauses.filter((p) => p.kind !== "beat");
  const first = filled?.moments[0] ?? null;
  return {
    filled: filled?.moments.length ?? 0,
    searching: held.filter((p) => !landedPause(p) && p.verdict !== "filled").sort((a, b) => a.t - b.t),
    landed: held.filter(landedPause).sort((a, b) => a.t - b.t),
    firstFilled: first ? { t: first.t, clock: first.clock, from: first.from, until: first.until, label: first.label } : null,
  };
}

function units(take: CueTake): TranscriptUnit[] {
  return transcriptPieces(take.transcript ?? "", take.words, take.metrics.fillers ?? []).filter(
    (u): u is TranscriptUnit => u.kind === "word"
  );
}

/** The number a cue counts on a take. */
export function measure(cue: Pick<Cue, "kind" | "word">, take: CueTake): number {
  switch (cue.kind) {
    case "filler":
      return fillerTimes(take, cue.word ?? "");
    case "searching":
      return readPauses(take).searching.length;
    case "filled":
      return readPauses(take).filled;
    case "unheld":
      return readPauses(take).landed.length;
    case "restarts":
      return take.metrics.repairCount ?? 0;
    case "fast":
    case "slow":
      return Math.round(take.metrics.wpm);
    case "repeat": {
      const s = stem(cue.word ?? "");
      return units(take).filter((u) => stem(u.key) === s).length;
    }
  }
}

/**
 * Whether the take held the cue: half or fewer of what it was set on
 * (none, for one), a pause landed where none had, a pace back in the
 * zone, a word said under three times.
 */
export function holds(cue: Pick<Cue, "kind" | "from">, now: number): boolean {
  switch (cue.kind) {
    case "unheld":
      return now >= 1;
    case "fast":
      return now <= PACE_ZONE[1];
    case "slow":
      return now >= PACE_ZONE[0];
    case "repeat":
      return now <= Math.max(2, Math.floor(cue.from / 2));
    default:
      return now <= Math.floor(cue.from / 2);
  }
}

/** Every measured thing this take could carry, one per trait at most. */
function candidates(take: CueTake): Found[] {
  const out: Found[] = [];
  /* Fillers: the one said most; a tie goes to the one said first. */
  const counts = new Map<string, number>();
  for (const f of sortedFillers(take)) counts.set(f.word, (counts.get(f.word) ?? 0) + 1);
  if (counts.size === 0) for (const [w, n] of Object.entries(take.metrics.fillerCounts ?? {})) if (n > 0) counts.set(w, n);
  let top: [string, number] | null = null;
  for (const e of counts) if (!top || e[1] > top[1]) top = e;
  if (top) out.push({ kind: "filler", word: top[0], n: top[1] });

  /* Pauses: a sound in one first, then pausing mid-sentence, then none landed. */
  const p = readPauses(take);
  if (p.filled > 0) out.push({ kind: "filled", word: null, n: p.filled });
  else if (p.searching.length > 0) out.push({ kind: "searching", word: null, n: p.searching.length });
  else if (p.landed.length === 0) out.push({ kind: "unheld", word: null, n: 0 });

  const r = take.metrics.repairCount ?? 0;
  if (r > 0) out.push({ kind: "restarts", word: null, n: r });

  const wpm = Math.round(take.metrics.wpm);
  if (wpm > PACE_ZONE[1]) out.push({ kind: "fast", word: null, n: wpm });
  else if (wpm > 0 && wpm < PACE_ZONE[0]) out.push({ kind: "slow", word: null, n: wpm });

  /* A word the store could not read back (over WORD_MAX) is never carried (the #477 review). */
  const repeats = units(take).filter((u) => u.mark === "repeat" && u.key.length > 0 && u.key.length <= WORD_MAX);
  if (repeats.length > 0) {
    const most = repeats.reduce((a, b) => ((b.times ?? 0) > (a.times ?? 0) ? b : a));
    out.push({ kind: "repeat", word: most.key, n: most.times ?? 3 });
  }
  return out;
}

/**
 * The take's weakest measurable thing (#477): of the things it has a
 * number for, the one whose trait scored lowest out of 100; a tie goes to
 * the practice's own trait, then fillers, pauses, restarts, pace and
 * variety. Every cue set aside is skipped until its day.
 */
export function chooseCue(
  take: CueTake,
  opts: { today: string; practice?: TraitId | null; aside?: readonly Aside[] | null }
): Cue | null {
  const away = new Set(stillAside(opts.aside ?? [], opts.today).map((a) => a.key));
  const found = candidates(take).filter((f) => !away.has(cueKey(f)));
  if (found.length === 0) return null;
  const score = (f: Found) => take.tier1[CUE_TRAIT[f.kind]] ?? 100;
  const own = (f: Found) => (CUE_TRAIT[f.kind] === opts.practice ? 0 : 1);
  found.sort((a, b) => score(a) - score(b) || own(a) - own(b) || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const f = found[0];
  return {
    kind: f.kind,
    word: f.word,
    from: f.n,
    last: f.n,
    givenOn: opts.today,
    answeredOn: null,
    tries: 0,
    line: warmupFrom(f, take),
  };
}

/* ---- carrying it -------------------------------------------------------- */

/** What the next day's take did with the cue it was carrying. */
export interface CueAnswer {
  kind: CueKind;
  word: string | null;
  /** This take's number. */
  now: number;
  /** The number it is read against: the cue's newest. */
  before: number;
  held: boolean;
  /** Answered CARRY_DAYS times without holding: it rests. */
  rested: boolean;
}

export interface CueStep {
  answer: CueAnswer | null;
  /** The cue carried out of this take, or null when there is nothing to carry. */
  cue: Cue | null;
  /** The cue was set on this take. */
  fresh: boolean;
  /** The state to store, or null when nothing changed. */
  next: CueState | null;
}

/** The cues still set aside today, oldest first: the rest are back. */
export function stillAside(list: readonly Aside[], today: string): Aside[] {
  return list.filter((a) => today < a.until);
}

/** Whether a take today answers this cue: set on an earlier day, not answered today. */
export function answerable(cue: Cue, today: string): boolean {
  return cue.givenOn < today && (cue.answeredOn === null || cue.answeredOn < today);
}

/**
 * One take, through the cue (#477). The first take of a later day answers
 * the cue carried into it: held, it retires and the take sets a new one;
 * not held, it is carried with the new number, until its third answer,
 * when it rests and the take sets a new one. Any other take keeps the
 * cue as it is, and with none carried, sets one.
 */
export function carryCue(p: {
  before: CueState | null;
  take: CueTake;
  today: string;
  practice?: TraitId | null;
  at?: Date;
}): CueStep {
  const at = (p.at ?? new Date()).toISOString();
  const was = p.before?.cue ?? null;
  const aside = stillAside(p.before?.aside ?? [], p.today);
  if (was && answerable(was, p.today)) {
    const now = measure(was, p.take);
    const held = holds(was, now);
    const tries = held ? was.tries : was.tries + 1;
    const rested = !held && tries >= CARRY_DAYS;
    const answer: CueAnswer = { kind: was.kind, word: was.word, now, before: was.last, held, rested };
    if (held || rested) {
      const key = cueKey(was);
      const away = [...aside.filter((a) => a.key !== key), { key, until: addDays(p.today, ASIDE_DAYS) }].slice(-ASIDE_MAX);
      const cue = chooseCue(p.take, { today: p.today, practice: p.practice, aside: away });
      return { answer, cue, fresh: !!cue, next: { v: 1, cue, aside: away, at } };
    }
    const cue: Cue = { ...was, last: now, answeredOn: p.today, tries };
    return { answer, cue, fresh: false, next: { v: 1, cue, aside, at } };
  }
  if (was) return { answer: null, cue: was, fresh: false, next: null };
  const cue = chooseCue(p.take, { today: p.today, practice: p.practice, aside });
  return { answer: null, cue, fresh: !!cue, next: cue ? { v: 1, cue, aside, at } : null };
}

/* ---- the words ---------------------------------------------------------- */

const q = (w: string | null) => `“${w ?? ""}”`;
const times = (n: number) => (n === 1 ? "once" : `${n} times`);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * What to do instead, as the warm-up's title: silence where the habit
 * was (plan section 9, idea 5), or the one move a pace or a word needs.
 */
export function cueTitle(cue: Pick<Cue, "kind" | "word">): string {
  switch (cue.kind) {
    case "filler":
      return `Pause where ${q(cue.word)} was`;
    case "searching":
      return "Pause between sentences";
    case "filled":
      return "Keep each pause silent";
    case "unheld":
      return "Pause once after a full sentence";
    case "restarts":
      return "Pause, then finish the sentence";
    case "fast":
      return "Pause at every full stop";
    case "slow":
      return "Keep each sentence moving";
    case "repeat":
      return `Find another word for ${q(cue.word)}`;
  }
}

/**
 * The glance's own words for a cue, where they are shorter than the
 * title's: the glance holds 25 words (#427), and "Tomorrow:" is the
 * last thing it should have to give up.
 */
const SAID: Partial<Record<CueKind, string>> = {
  filled: "keep pauses silent",
  unheld: "finish, then pause",
  restarts: "pause, then finish",
  fast: "pause at full stops",
  slow: "keep sentences moving",
};

/**
 * The glance's cue: "Tomorrow: pause where “like” was." It says the word
 * even where Demos's line has just named it (#493, the morning tour):
 * "Tomorrow: a pause instead." was vaguer than its own short form, and
 * "instead" made the reader go back a line to find what it replaced.
 */
export function cueSentence(cue: Pick<Cue, "kind" | "word">): string {
  const say = SAID[cue.kind] || lowerFirst(cueTitle(cue));
  return `Tomorrow: ${say}.`;
}

/** The cue with no "Tomorrow:", for a glance with no room: "Pause where “like” was." */
export function cueShortSentence(cue: Pick<Cue, "kind" | "word">): string {
  const say = SAID[cue.kind] ?? cueTitle(cue);
  return `${say.charAt(0).toUpperCase()}${say.slice(1)}.`;
}

type Said = Pick<GlanceLine, "parts" | "sentence" | "moment">;

/** The moment a cue's thing first happens in a take, for the chip. */
function firstMoment(cue: Pick<Cue, "kind" | "word">, take: CueTake): GlanceMoment | null {
  switch (cue.kind) {
    case "filler": {
      const hit = sortedFillers(take).find((f) => f.word === cue.word);
      if (!hit) return null;
      const one = fillerTimes(take, cue.word ?? "") === 1;
      return windowAt(hit.t, FILLER_LEAD_S, hit.t + FILLER_TAIL_S, one ? `Play %, ${q(cue.word)}` : `Play %, the first ${q(cue.word)}`);
    }
    case "searching": {
      const s = readPauses(take).searching[0];
      return s ? windowAt(s.t, MOMENT_LEAD_S, s.t + s.len + MOMENT_TAIL_S, "Play %, a misplaced pause") : null;
    }
    case "filled":
      return readPauses(take).firstFilled;
    case "unheld": {
      const l = readPauses(take).landed[0];
      return l ? windowAt(l.t, MOMENT_LEAD_S, l.t + l.len + MOMENT_TAIL_S, "Play %, a pause between sentences") : null;
    }
    case "repeat": {
      const s = stem(cue.word ?? "");
      const u = units(take).find((x) => stem(x.key) === s && x.start !== null);
      return u && u.start !== null ? windowAt(u.start, FILLER_LEAD_S, u.start + FILLER_TAIL_S, `Play %, ${q(cue.word)}`) : null;
    }
    default:
      return null;
  }
}

/**
 * Demos's line on a take that sets or carries the cue: what the take did
 * in the cue's unit, with the moment that plays it ("“um” 2 times, first
 * ▶0:02"), and a shorter form with the number and no chip, for a glance
 * with no room for both.
 */
export function cueEvidence(cue: Pick<Cue, "kind" | "word">, take: CueTake): { line: Said; short: Said } {
  const n = measure(cue, take);
  const secs = secsOf(take);
  const m = firstMoment(cue, take);
  const both = (s: string) => ({ line: plain(s), short: plain(s) });
  const chip = (one: string, many: string, short: string) =>
    m ? { line: n === 1 ? withMoment(one, m, "") : withMoment(many, m, ""), short: plain(short) } : both(short);
  switch (cue.kind) {
    case "filler":
    case "repeat":
      if (n === 0) return { line: plain(`No ${q(cue.word)} in ${secs}s.`), short: plain(`No ${q(cue.word)}.`) };
      return chip(`${q(cue.word)} once, at `, `${q(cue.word)} ${n} times, first `, `${q(cue.word)} ${times(n)}.`);
    case "searching":
      if (n === 0) return { line: plain(`No misplaced pauses in ${secs}s.`), short: plain("No misplaced pauses.") };
      return chip("1 misplaced pause, at ", `${n} misplaced pauses, first `, `${n} ${plural(n, "misplaced pause", "misplaced pauses")}.`);
    case "filled":
      if (n === 0) return both("Every pause was silent.");
      return chip("1 pause had an um, at ", `${n} pauses had an um, first `, `${n} ${plural(n, "pause", "pauses")} had an um.`);
    case "unheld":
      if (n === 0) return { line: plain(`No pauses between sentences in ${secs}s.`), short: plain("No pauses between sentences.") };
      return chip("1 pause between sentences, at ", `${n} pauses between sentences, first `, `${n} ${plural(n, "pause", "pauses")} between sentences.`);
    case "restarts":
      if (n === 0) return { line: plain(`No restarts in ${secs}s.`), short: plain("No restarts.") };
      return { line: plain(`${n} ${plural(n, "restart", "restarts")} in ${secs}s.`), short: plain(`${n} ${plural(n, "restart", "restarts")}.`) };
    case "fast":
    case "slow":
      return both(`${n} words a minute.`);
  }
}

/** The answer's head: the count in the cue's unit ("“like” 3 times"), long and short. */
function answerHead(a: CueAnswer): { long: string; short: string } {
  const n = a.now;
  switch (a.kind) {
    case "filler":
    case "repeat": {
      if (n === 0) return { long: `No ${q(a.word)}`, short: `No ${q(a.word)}` };
      return { long: `${q(a.word)} ${times(n)}`, short: n === 1 ? `${q(a.word)} once` : `${q(a.word)} ${n}` };
    }
    case "searching": {
      /* No short form (the #477 review): "1 searching, down from 3." is
         not a sentence, so a glance short of room gives up "Tomorrow:". */
      const head = n === 0 ? "No misplaced pauses" : `${n} ${plural(n, "misplaced pause", "misplaced pauses")}`;
      return { long: head, short: head };
    }
    case "filled":
      /* The short form is the glance's when the cue needs the room (25
         words): "Pauses silent, down from 3." left "3" without a unit
         (the review of #490), so it counts the ums, five words at most. */
      return n === 0
        ? { long: "No pause had an um", short: "No ums" }
        : { long: `${n} ${plural(n, "pause", "pauses")} had an um`, short: `${n} ${plural(n, "um", "ums")}` };
    case "unheld":
      return n === 0
        ? { long: "No pauses between sentences", short: "No pauses between sentences" }
        : { long: `${n} ${plural(n, "pause", "pauses")} between sentences`, short: `${n} ${plural(n, "pause", "pauses")} between sentences` };
    case "restarts":
      return n === 0 ? { long: "No restarts", short: "No restarts" } : { long: `${n} ${plural(n, "restart", "restarts")}`, short: `${n} ${plural(n, "restart", "restarts")}` };
    case "fast":
    case "slow":
      return { long: `${n} words a minute`, short: `Pace ${n}` };
  }
}

/**
 * The next day's answer, first on the glance (#477): the cue's count on
 * this take against the one before it, "“like” 3 times, down from 9.",
 * or "“like” 9 times again.". Held, the count is the earned part, drawn in
 * sage. A shorter form drops the unit's words ("“like” 3, down from 9.").
 */
export function answerLine(a: CueAnswer): { line: Said; short: Said } {
  const head = answerHead(a);
  const was = a.before === 0 ? "none" : String(a.before);
  const tail = a.now === a.before ? " again." : `, ${a.now < a.before ? "down" : "up"} from ${was}.`;
  const make = (h: string): Said => {
    const parts: GlancePart[] = [{ kind: "text", text: h, ...(a.held ? { earned: true } : {}) }, { kind: "text", text: tail }];
    return { parts, sentence: `${h}${tail}`, moment: null };
  };
  return { line: make(head.long), short: make(head.short) };
}

/** What the glance says on a take that carries the cue: its line, its cue and their short forms. */
export interface CueGlance {
  line: Said;
  lineShort: Said;
  cue: string | null;
  cueShort: string | null;
  held: boolean;
}

/**
 * The glance's line and cue on a take that carries one (#477): the answer
 * to yesterday's cue first, then the cue to carry, whole, the word said
 * ("Tomorrow: pause where “um” was.", #493); or, on any other carrying
 * take, the cue's evidence and the cue. Null where there is nothing to
 * carry or answer, and the glance keeps its own line about the
 * practice's trait.
 */
export function cueGlance(step: CueStep, take: CueTake): CueGlance | null {
  if (step.answer) {
    const a = answerLine(step.answer);
    return {
      line: a.line,
      lineShort: a.short,
      cue: step.cue ? cueSentence(step.cue) : null,
      cueShort: step.cue ? cueShortSentence(step.cue) : null,
      held: step.answer.held,
    };
  }
  if (!step.cue) return null;
  const e = cueEvidence(step.cue, take);
  return { line: e.line, lineShort: e.short, cue: cueSentence(step.cue), cueShort: cueShortSentence(step.cue), held: false };
}

/* ---- the warm-up -------------------------------------------------------- */

/** The number the warm-up leads with, the cue's newest: "Last time, “like” 9 times". */
export function warmupLead(cue: Pick<Cue, "kind" | "word" | "last">): string {
  const n = cue.last;
  switch (cue.kind) {
    case "filler":
    case "repeat":
      return `Last time, ${q(cue.word)} ${times(n)}`;
    case "searching":
      return `Last time, ${n} ${plural(n, "misplaced pause", "misplaced pauses")}`;
    case "filled":
      return `Last time, ${n} ${plural(n, "pause", "pauses")} had an um`;
    case "unheld":
      return "Last time, no pauses between sentences";
    case "restarts":
      return `Last time, ${n} ${plural(n, "restart", "restarts")}`;
    case "fast":
    case "slow":
      return `Last time, ${n} words a minute`;
  }
}

/** A sentence to say with the cue applied, where the take gave none of its own. */
const FIXED_LINE: Record<CueKind, string> = {
  filler: `The best part ${PAUSE_MARK} was the people.`,
  searching: `I'd take the bus. ${PAUSE_MARK} I can think on the way.`,
  filled: `Here is my point. ${PAUSE_MARK} It saves an hour.`,
  unheld: `That's my answer. ${PAUSE_MARK} Here's why.`,
  restarts: `What I'd change ${PAUSE_MARK} is the first ten minutes.`,
  fast: `One point. ${PAUSE_MARK} Then the next one.`,
  slow: `I'd pick the bus because I can read on the way. ${PAUSE_MARK}`,
  repeat: `That part was ${PAUSE_MARK} the hardest.`,
};

/** The warm-up's sentence: the take's own words where it kept some, else a fixed one. */
export function warmupSentence(cue: Pick<Cue, "kind" | "line">): string {
  return cue.line?.text ?? FIXED_LINE[cue.kind];
}

/** A warm-up sentence in its pieces, the pause marks apart. */
export function warmupPieces(text: string): ({ kind: "words"; text: string } | { kind: "pause" })[] {
  const out: ({ kind: "words"; text: string } | { kind: "pause" })[] = [];
  text.split(PAUSE_MARK).forEach((t, i) => {
    if (i > 0) out.push({ kind: "pause" });
    if (t.trim()) out.push({ kind: "words", text: t.trim() });
  });
  return out;
}

/** The longest warm-up sentence, in words: about ten seconds said twice. */
const WARMUP_WORDS = 14;

/**
 * The take's own sentence with the cue applied (plan section 9, idea 2:
 * "hold the pause where the 'like' was"): the sentence the filler was
 * first said in, the filler taken out and the pause mark in its place,
 * the other fillers in it taken out too; for a repeated word, the mark
 * before it. Cut to the words around the mark when long. Null where the
 * take kept no sentence for it.
 */
function warmupFrom(f: Found, take: CueTake): Cue["line"] {
  if (f.kind !== "filler" && f.kind !== "repeat") return null;
  const list = units(take);
  const s = stem(f.word ?? "");
  const i = list.findIndex((u) => (f.kind === "filler" ? u.mark === "filler" && u.filler === f.word : stem(u.key) === s));
  if (i < 0) return null;
  const u = list[i];
  if (!u.sentence) return null;
  let lo = i;
  while (lo > 0 && list[lo - 1].sentence === u.sentence) lo--;
  let hi = i;
  while (hi < list.length - 1 && list[hi + 1].sentence === u.sentence) hi++;
  const edits = list
    .slice(lo, hi + 1)
    .filter((x) => x === u || x.mark === "filler")
    .map((x) => ({
      at: x.inSentence,
      len: x.text.length,
      put: x !== u ? "" : f.kind === "filler" ? PAUSE_MARK : `${PAUSE_MARK} ${x.text}`,
    }))
    .sort((a, b) => b.at - a.at);
  let text = u.sentence;
  for (const e of edits) text = text.slice(0, e.at) + e.put + text.slice(e.at + e.len);
  text = text
    .replace(new RegExp(`[,;]?\\s*${PAUSE_MARK}\\s*[,;]?`, "g"), ` ${PAUSE_MARK} `)
    .replace(/(^|\s)[,;](?=\s)/g, "$1")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/,(?=[,.])/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;]+/, "")
    .trim();
  text = text.replace(/\p{L}/u, (c) => c.toUpperCase());
  const tokens = text.split(" ");
  if (tokens.length > WARMUP_WORDS) {
    const mark = tokens.indexOf(PAUSE_MARK);
    const from = Math.max(0, mark - 6);
    const to = Math.min(tokens.length, from + WARMUP_WORDS);
    text = `${from > 0 ? "…" : ""}${tokens.slice(from, to).join(" ")}${to < tokens.length ? "…" : ""}`;
  }
  if (!text.includes(PAUSE_MARK) || text.replace(PAUSE_MARK, "").trim().split(/\s+/).length < 3) return null;
  /* Longer than the store reads back: the fixed sentence instead (the #477 review). */
  if (text.length > LINE_MAX) return null;
  return { text, at: u.start };
}

/* ---- the store's shape -------------------------------------------------- */

const KINDS = new Set<CueKind>(ORDER);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const count = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 10_000;

/**
 * A stored state, read defensively: the column is the account's own to
 * write, so anything that is not exactly this shape reads as nothing.
 */
export function parseCueState(raw: unknown): CueState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || typeof r.at !== "string" || Number.isNaN(Date.parse(r.at))) return null;
  /* A list since the #477 review; one entry on its own reads as a list of one. */
  const listed: unknown[] = Array.isArray(r.aside) ? r.aside : r.aside ? [r.aside] : [];
  const aside: Aside[] = listed
    .filter(
      (a): a is Aside =>
        !!a && typeof a === "object" &&
        typeof (a as Aside).key === "string" && (a as Aside).key.length <= 80 &&
        typeof (a as Aside).until === "string" && DAY.test((a as Aside).until)
    )
    .map((a) => ({ key: a.key, until: a.until }))
    .slice(-ASIDE_MAX);
  let cue: Cue | null = null;
  if (r.cue && typeof r.cue === "object") {
    const c = r.cue as Record<string, unknown>;
    const line = c.line as Cue["line"] | undefined;
    const lineOk =
      line === null || line === undefined ||
      (typeof line === "object" && typeof line.text === "string" && line.text.length <= LINE_MAX && line.text.includes(PAUSE_MARK) &&
        (line.at === null || count(line.at)));
    if (
      KINDS.has(c.kind as CueKind) &&
      (c.word === null || (typeof c.word === "string" && c.word.length > 0 && c.word.length <= WORD_MAX)) &&
      count(c.from) && count(c.last) && count(c.tries) &&
      typeof c.givenOn === "string" && DAY.test(c.givenOn) &&
      (c.answeredOn === null || (typeof c.answeredOn === "string" && DAY.test(c.answeredOn))) &&
      lineOk
    ) {
      const kind = c.kind as CueKind;
      if ((kind === "filler" || kind === "repeat") === (typeof c.word === "string")) {
        cue = {
          kind,
          word: (c.word as string | null) ?? null,
          from: c.from as number,
          last: c.last as number,
          givenOn: c.givenOn as string,
          answeredOn: (c.answeredOn as string | null) ?? null,
          tries: c.tries as number,
          line: line ? { text: line.text, at: line.at ?? null } : null,
        };
      }
    }
  }
  return { v: 1, cue, aside, at: r.at };
}

/** The newer of two states, by when each was written. */
export function newerCue(a: CueState | null, b: CueState | null): CueState | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.at) > Date.parse(a.at) ? b : a;
}

/** Whether today's ready recorder warms up on this cue: carried in from an earlier day, not yet answered. */
export function warmsUp(state: CueState | null | undefined, today: string): Cue | null {
  const cue = state?.cue ?? null;
  return cue && answerable(cue, today) ? cue : null;
}

export { clockOf as cueClock } from "./transcript-words";
