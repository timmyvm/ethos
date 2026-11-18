/**
 * The glance (DECISIONS #427): what a take's results put on their one
 * screen, and what waits behind its door.
 *
 * Timothy, 7 Nov: "there is so much to consume post lesson. like so much
 * to read." The three-step walk asked for 300 words and three taps after
 * a 62s take, three times a lesson. The glance asks for about 24 words
 * and one tap: the stars, the Index and its delta, Demos's one measured
 * line about the practice's own trait with one moment that plays and one
 * target for next time, the door, and the tap. Everything else is in
 * "Every number", pulled, never pushed (NN/g's progressive disclosure;
 * Chiviacowsky's self-controlled feedback).
 *
 * Every digit Demos says here is a field of the take or a time in it,
 * so the line traces to a number or a timestamp (vision.md). Nothing
 * here is the coach's text.
 */

import type { TraitId } from "@/content/traits";
import { recordingTrait } from "./log";
import type { Pause, RepMetrics, Word } from "./metrics";
import { filledWords, heldPauseMarks, landedPause, PAUSE_KEY_WORDS, PAUSE_WHY_WORDS, pauseWhy, sharedMiss } from "./pause-mark";
import { filledMoments, MOMENT_LEAD_S, MOMENT_TAIL_S } from "./pause-quality";
import { MOST_PAUSES, type RewardMoment } from "./rewards";
import type { GameRound } from "./round";
import { clockTenth, decidingCutIn, secs as tenths, type RoundReveal } from "./round-copy";
import type { LevelUpPiece, LevelUpView } from "./traits";
import { transcriptPieces, type TranscriptUnit } from "./transcript-words";

/** The glance's ceiling, in words as `countWords` counts them. */
export const GLANCE_WORDS = 25;
/** Named exceptions, each held at its own ceiling by the camera. */
export const GLANCE_WORDS_TESTER = 36;
export const GLANCE_WORDS_FIRST = 28;
/**
 * A lesson's last practice (the #427 review): the ending says how the
 * three practices went ("Lesson done: 4, 4, 3 fillers"), names the next
 * lesson on the tap and the streak's next day under it.
 */
export const GLANCE_WORDS_LESSON_DONE = 30;
/**
 * The reminder ask (#430): on the day's first scored take, when this
 * phone has no reminder, its own words ride on top of whichever ceiling
 * holds, up to this many, and the cue for next time gives up its slot.
 * Once a day at most; "Same time tomorrow? Remind me at 6 pm Not now" is
 * 10, the iPhone's Home Screen line and its steps 16, shown once ever.
 */
export const GLANCE_WORDS_ASK = 16;

/** The ceiling with the reminder ask's words on it. */
export function askBudget(budget: number, askWords: string): number {
  return budget + Math.min(GLANCE_WORDS_ASK, countWords(askWords));
}

/**
 * The note under the delta on the first take scored under #476's pause
 * rules (#491, lib/pause-rules.ts): once per account, so its words ride
 * on the ceiling as the reminder ask's do, up to this many, and nothing
 * the glance already says gives way to it. "Part of this jump comes from
 * new pause scoring: Pausing went 26 to 73." is 13.
 */
export const GLANCE_WORDS_RULES = 16;

/** The ceiling with the rules note's words on it. */
export function rulesBudget(budget: number, note: string | null): number {
  return budget + Math.min(GLANCE_WORDS_RULES, note ? countWords(note) : 0);
}

/**
 * The stars' goals (#504, components/StarGoals.tsx): one to three words
 * under each star ("20+ words", "Under 12 slips", "Under 4 slips"). They
 * are the stars' own labels, read with the stars in one look the way a
 * game's are, so they ride on every ceiling, up to this many, and
 * nothing Demos says gives way to them.
 */
export const GLANCE_WORDS_STARS = 8;

/** The ceiling with the stars' goals on it. */
export function starsBudget(budget: number, goals: readonly string[]): number {
  return budget + Math.min(GLANCE_WORDS_STARS, countWords(goals.join(" ")));
}

/** A filler's moment plays from a second before it to 1.5s after. */
export const FILLER_LEAD_S = 1;
export const FILLER_TAIL_S = 1.5;
/** The pace zone every Pace reading is held to (DimensionList's Pace row). */
export const PACE_ZONE: readonly [number, number] = [130, 160];

/**
 * Words as the camera counts them (walk.mjs, scripts/look-glance.mjs): a
 * whitespace token holding a letter or a digit. "▲ 3" is one word, "0:02."
 * one, "“thing”" one, "/1000" one.
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

/** m:ss, as every timestamp in the app reads. */
export function clock(t: number): string {
  const s = Math.max(0, t);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** The moment the line names, which plays that stretch of the take. */
export interface GlanceMoment {
  /** Where it is, on the take's clock: a filler's, a pause's or a word's time. */
  t: number;
  /** "0:02", as the chip shows it. */
  clock: string;
  /** Where playback starts, never before 0. */
  from: number;
  /** Where it stops. */
  until: number;
  /** The chip's accessible name. */
  label: string;
}

/**
 * The sentence in pieces: text, and at most one chip where the moment
 * stands. A text piece marked `earned` is drawn in sage: the count of a
 * carried cue that held (#477), the one earned thing in the sentence.
 */
export type GlancePart = { kind: "text"; text: string; earned?: boolean } | { kind: "moment" };

export interface GlanceLine {
  parts: GlancePart[];
  /** The sentence as plain text, the moment's clock in its place. */
  sentence: string;
  moment: GlanceMoment | null;
  /** "Practice 2: under 4.", or null where there is no next target. */
  cue: string | null;
}

/**
 * The practice's own trait: the lesson's (or the trait walk's, or the
 * path item's), else Today's card's, else Fillers, which every take has
 * a count for (a roulette topic, the boss, an upload).
 */
export function glanceTrait(config: {
  lessonId: string;
  practice?: { trait: TraitId } | null;
}): TraitId {
  return recordingTrait({ lesson_id: config.lessonId }) ?? config.practice?.trait ?? "fillers";
}

/**
 * What the cue points at: the next practice of this lesson, next time, or
 * next week's boss. Null where the next thing is the tap's own (a game's
 * Another round), so nothing on the glance answers "what next" twice.
 */
export function cueLead(p: {
  /** This practice's number and the lesson's count, on a lesson practice. */
  lesson?: { practice: number; of: number } | null;
  boss?: boolean;
  game?: boolean;
}): string | null {
  if (p.game) return null;
  if (p.boss) return "Next week:";
  if (p.lesson && p.lesson.practice < p.lesson.of) return `Practice ${p.lesson.practice + 1}:`;
  return "Next time:";
}

/**
 * A sentence with a chip in it, built from its two sides. A sentence the
 * chip ends takes no full stop (the #427 review: "first at (▶ 0:02) ."
 * left the stop floating outside the pill).
 */
export function withMoment(before: string, moment: GlanceMoment, after: string): Pick<GlanceLine, "parts" | "sentence" | "moment"> {
  const parts: GlancePart[] = [];
  if (before) parts.push({ kind: "text", text: before });
  parts.push({ kind: "moment" });
  if (after) parts.push({ kind: "text", text: after });
  return { parts, sentence: `${before}${moment.clock}${after}`, moment };
}

export function plain(sentence: string): Pick<GlanceLine, "parts" | "sentence" | "moment"> {
  return { parts: [{ kind: "text", text: sentence }], sentence, moment: null };
}

export function windowAt(t: number, lead: number, until: number, label: string): GlanceMoment {
  const at = clock(t);
  return { t, clock: at, from: Math.max(0, t - lead), until, label: label.replace("%", at) };
}

/**
 * The reason a take could not be scored, in Demos's words: its own word
 * count, or that it was mostly repeats (NotScored's two cases).
 */
export function unscoredReason(m: Pick<RepMetrics, "substance">): string {
  const n = m.substance.wordCount;
  return n < 20
    ? `${n} word${n === 1 ? "" : "s"}. Give it 60 to 90 seconds.`
    : "That was mostly repeats. Try a real answer.";
}

/**
 * Demos's one line on the glance and its cue (DECISIONS #427): one
 * sentence of at most seven words about the practice's trait, the first
 * thing that cost it or, when nothing did, its best moment, with at most
 * one chip that plays it; then one target for next time, its number the
 * one in the sentence. Every line names its trait ("pauses", "fillers")
 * in the house's plain words (#490: "between sentences", "mid-sentence",
 * never "landed" or "searching"). A capped
 * take's hero is its filler count, so its line follows the hero: the
 * same trait, never a second one under it (the #427 review).
 */
export function glanceLine(p: {
  trait: TraitId;
  metrics: RepMetrics;
  /** Whisper's words, for a Variety moment's time. */
  words?: Word[] | null;
  /** The transcript, for Variety's marks (lib/transcript-words.ts). */
  transcript?: string;
  /** Measured, not judged: the hero already shows the filler count. */
  capped?: boolean;
  scorable?: boolean;
  /** `cueLead`'s answer; null for no cue. */
  lead: string | null;
}): GlanceLine {
  const m = p.metrics;
  if (p.scorable === false) return { ...plain(unscoredReason(m)), cue: null };
  const trait: TraitId = p.capped ? "fillers" : p.trait;
  const secs = Math.round(m.durationS);
  const cue = (target: string | null): string | null => (p.lead && target ? `${p.lead} ${target}` : null);

  /* The pauses in the house's plain words (#490): a pause is between
     sentences, mid-sentence, after only a few words, over 3.5 seconds or
     next to an um, each read off the verdict the take stored
     (lib/pause-mark.ts pauseWhy). "landed" and "searching" were the
     app's own words for the first two. */
  if (trait === "pause") {
    const pauses = m.pauses ?? [];
    const marks = heldPauseMarks(pauses);
    const filled = filledMoments(pauses);
    const count = (n: number) => `${n} ${n === 1 ? "pause" : "pauses"}`;
    if (filled && filled.moments.length > 0) {
      const first = filled.moments[0];
      const moment: GlanceMoment = { t: first.t, clock: first.clock, from: first.from, until: first.until, label: first.label };
      const n = filled.moments.length;
      /* "an um" since #476; a stored verdict the phone's trace made is "a sound". */
      const had = filledWords(pauses, n).startsWith("had an um next") ? "had an um" : "had a sound";
      const said = n === 1 ? withMoment(`1 pause ${had}, at `, moment, "") : withMoment(`${n} pauses ${had}, first `, moment, "");
      return { ...said, cue: cue("keep every pause silent.") };
    }
    const held = pauses.filter((x) => x.kind !== "beat");
    const missed = held.filter((x) => !landedPause(x)).sort((a, b) => a.t - b.t);
    if (missed.length > 0) {
      const s = missed[0];
      const moment = windowAt(s.t, MOMENT_LEAD_S, s.t + s.len + MOMENT_TAIL_S, `Play %, a pause ${PAUSE_WHY_WORDS[pauseWhy(s)]}`);
      /* Seven words at most (#427): every one the same kind says which
         ("1 of 4 pauses mid-sentence"); a mix, or a pause after a sentence
         too short to be a point, is "misplaced",
         and the chip's own name says what the first one was. */
      /* A pause that did not count, in the key's few words (#490): the
         Pause row says it whole ("after only a few words", "over 3.5
         seconds"). A filled pause has its own line, so it is never one. */
      const why = sharedMiss(missed);
      const what = why ? PAUSE_KEY_WORDS[why] : "misplaced";
      const n = missed.length;
      const said =
        n === marks.held
          ? n === 1
            ? withMoment(`1 pause, ${what}, at `, moment, "")
            : withMoment(`All ${n} pauses ${what}, first `, moment, "")
          : n === 1
            ? withMoment(`1 of ${marks.held} pauses ${what}, at `, moment, "")
            : withMoment(`${n} of ${marks.held} pauses ${what}, first `, moment, "");
      /* "all 4 between sentences" left a reader to carry "pauses" over
         from the line before (the review of #490); seven words still. */
      return { ...said, cue: cue(marks.held === 1 ? "1 pause between sentences." : `all ${marks.held} pauses between sentences.`) };
    }
    if (marks.landed > 0) {
      const longest = held.filter(landedPause).reduce((a, b) => (b.len > a.len ? b : a));
      const one = marks.landed === 1;
      const moment = windowAt(
        longest.t,
        MOMENT_LEAD_S,
        longest.t + longest.len + MOMENT_TAIL_S,
        one ? "Play %, the pause between sentences" : "Play %, the longest pause between sentences"
      );
      const said = one
        ? withMoment("1 pause between sentences, at ", moment, "")
        : withMoment(`All ${marks.landed} pauses between sentences, longest `, moment, "");
      return { ...said, cue: cue(`${count(marks.landed + 1)} between sentences.`) };
    }
    return { ...plain(`No one-second pauses in ${secs}s.`), cue: cue("1 pause between sentences.") };
  }

  if (trait === "repairs") {
    const n = m.repairCount ?? 0;
    if (n >= 2) return { ...plain(`${n} sentence restarts in ${secs}s.`), cue: cue(`under ${n}.`) };
    if (n === 1) return { ...plain(`1 sentence restart in ${secs}s.`), cue: cue("none.") };
    return { ...plain(`No sentence restarts in ${secs}s.`), cue: cue("none again.") };
  }

  if (trait === "pace") {
    const [lo, hi] = PACE_ZONE;
    if (m.wpm >= lo && m.wpm <= hi) return { ...plain(`${m.wpm} words a minute, in the zone.`), cue: cue(`${lo} to ${hi} again.`) };
    if (m.wpm > hi) return { ...plain(`${m.wpm} words a minute.`), cue: cue(`under ${hi}.`) };
    return { ...plain(`${m.wpm} words a minute.`), cue: cue(`over ${lo}.`) };
  }

  if (trait === "range") {
    const units = transcriptPieces(p.transcript ?? "", p.words, m.fillers).filter(
      (u): u is TranscriptUnit => u.kind === "word"
    );
    const repeats = units.filter((u) => u.mark === "repeat");
    if (repeats.length > 0) {
      /* The word said most; a tie goes to the one said first. */
      const top = repeats.reduce((a, b) => ((b.times ?? 0) > (a.times ?? 0) ? b : a));
      const first = units.find((u) => u.key === top.key && u.mark === "repeat") ?? top;
      const word = `“${first.display}”`;
      const said =
        first.start !== null
          ? withMoment(`${word} ${top.times} times, first `, windowAt(first.start, FILLER_LEAD_S, first.start + FILLER_TAIL_S, `Play %, ${word}`), "")
          : plain(`${word} ${top.times} times.`);
      return { ...said, cue: cue(`${word} once.`) };
    }
    const vague = units.find((u) => u.mark === "vague");
    if (vague) {
      const word = `“${vague.display}”`;
      const said =
        vague.start !== null
          ? withMoment(`${word} at `, windowAt(vague.start, FILLER_LEAD_S, vague.start + FILLER_TAIL_S, `Play %, ${word}`), " was vague.")
          : plain(`${word} was vague.`);
      return { ...said, cue: cue("name it instead.") };
    }
    return { ...plain("No word said 3 times."), cue: null };
  }

  /* Fillers, and every take without a trait of its own. */
  const fillers = [...(m.fillers ?? [])].sort((a, b) => a.t - b.t);
  const n = m.fillerCount;
  if (n === 0) return { ...plain(`No fillers in ${secs}s.`), cue: p.capped ? null : cue("none again.") };
  if (fillers.length === 0) {
    /* A row that kept the count but not the times: the count, no chip. */
    return { ...plain(`${n} filler${n === 1 ? "" : "s"} in ${secs}s.`), cue: cue(n === 1 ? "none." : `under ${n}.`) };
  }
  const t = fillers[0].t;
  const label = n === 1 ? "Play %, the filler" : "Play %, the first filler";
  const moment = windowAt(t, FILLER_LEAD_S, t + FILLER_TAIL_S, label);
  const target = n === 1 ? "none." : `under ${n}.`;
  if (p.capped) {
    /* The hero is the count: the line says where, and names it. */
    const said = n === 1 ? withMoment("The filler at ", moment, "") : withMoment("First filler at ", moment, "");
    return { ...said, cue: cue(target) };
  }
  /* "first ▶0:02", not "first at": the delta's "since last time" is paid
     for here (the #427 review), and the chip ends the sentence. */
  const said = n === 1 ? withMoment("1 filler, at ", moment, "") : withMoment(`${n} fillers, first `, moment, "");
  return { ...said, cue: cue(target) };
}

/** The ladder line's first sentence ("1 of 2 counted."). */
export function ladderLine(line: string): string {
  const first = line.split(/(?<=[.!?])\s+(?=\S)/)[0] ?? line;
  return first.trim();
}

/**
 * A game's cue (the #427 review): what the ladder's count means, its
 * second sentence, with the noun it left to the first ("One more round
 * opens level 2.", "Another day's round opens level 3."), in six words or
 * fewer so it fits the glance beside the round's line. "1 of 2 counted."
 * on its own said nothing. Null once a game is mastered, where the line
 * is one sentence.
 */
export function ladderCue(line: string): string | null {
  const rest = line
    .split(/(?<=[.!?])\s+(?=\S)/)
    .slice(1)
    .join(" ")
    .trim();
  if (!rest) return null;
  return rest
    .replace(/^One more on another day opens/, "Another day's round opens")
    .replace(/^One more(?= opens)/, "One more round")
    .replace(/^Two on two different days open/, "Two days' rounds open");
}

/**
 * A game round's line on the glance (the #427 review): the round's own
 * result in Demos's words, with its moment, the same shape as every
 * other glance. The round card moved behind the door, so the line
 * carries what it said: how long you held after he cut in, and where.
 * Every number is the round's (lib/round.ts) or a time in the take.
 */
export function roundGlance(p: { round: GameRound; reveal: RoundReveal; cue: string | null }): GlanceLine {
  const { round, reveal, cue } = p;
  if (round.game === "qa") {
    const f = decidingCutIn(round);
    if (f && f.at !== null && reveal.number !== null) {
      const end = f.gapTo ?? f.at + (f.gap ?? 0);
      const moment = windowAt(f.at, FILLER_LEAD_S, Math.max(end, f.at) + FILLER_TAIL_S, "Play %, where I cut in");
      /* "after my cut-in ▶0:17": the chip is the cut-in's time, and six
         words leave the ladder's cue its room under the budget. */
      const said =
        f.verdict === "through"
          ? withMoment("You talked through my cut-in ", moment, "")
          : f.verdict === "held"
            ? withMoment(`Held ${reveal.number} after my cut-in `, moment, "")
            : withMoment(`${reveal.number} after my cut-in `, moment, "");
      return { ...said, cue };
    }
    const stopped = round.lastWord ?? round.durationS;
    return { ...plain(`You stopped at ${clock(stopped)}, before I cut in.`), cue };
  }
  if (reveal.note === "the clock stopped you" && reveal.number !== null) {
    return { ...plain(`The clock stopped you at ${reveal.number}.`), cue };
  }
  if (round.game === "rush") {
    if (reveal.note === "to spare" && reveal.number !== null) return { ...plain(`${reveal.number} to spare.`), cue };
    if (round.lastWord !== null) return { ...plain(`Last word at ${clockTenth(round.lastWord)}.`), cue };
    return { ...plain(reveal.line ?? `Stopped at ${tenths(round.durationS)}.`), cue };
  }
  /* Interview: where the last word fell against the window. */
  if (reveal.number !== null && reveal.note) return { ...plain(`Last word at ${reveal.number}, ${reveal.note}.`), cue };
  return { ...plain(reveal.line ?? `Stopped at ${tenths(round.durationS)}.`), cue };
}

/** The earned slot under the delta: one line, sage when earned, ink when a second score. */
export interface EarnedLine {
  text: string;
  /**
   * The level-up moment (#498): every form it can be said in, longest
   * first, so the budget takes the longest that fits and each named trait
   * wears its colour; absent on any other line.
   */
  levelUp?: LevelUpView;
  /** What stays when the budget cuts its tail ("Best yet"), or null to drop it whole. */
  short: string | null;
  tone: "earned" | "plain";
  /** Presence's change since the last video take, beside its number. */
  delta?: number | null;
}

const TRAIT_RECORD: Partial<Record<TraitId, string>> = {
  fillers: "Cleanest recording yet",
  pause: MOST_PAUSES,
};

/**
 * The earned line (DECISIONS #427): only for something earned, first
 * match wins: a game's ladder moment, the levels this recording crossed
 * (#498: "Pace reached level 3, Pausing level 2", lib/traits.ts
 * `levelUpLine`), a new best Index, a record on the practice's own
 * trait, a game's best round. Otherwise a second score in ink: a Premium
 * video take's Presence, a boss's Accuracy. Otherwise nothing, and the
 * slot takes no height. A level crossed ranks over a best Index because
 * the glance is the only place it is said, while a best still stands as
 * its card in the sheet and in Demos's celebrating pose.
 */
export function earnedLine(p: {
  bests: RewardMoment[];
  ladderMoment?: RewardMoment | null;
  levelUp?: LevelUpView | null;
  trait: TraitId;
  presence?: { score: number; previous: number | null } | null;
  accuracy?: number | null;
}): EarnedLine | null {
  if (p.ladderMoment) return { text: p.ladderMoment.headline, short: null, tone: "earned" };
  if (p.levelUp) return { text: p.levelUp.forms[0].text, short: p.levelUp.forms[1]?.text ?? null, tone: "earned", levelUp: p.levelUp };
  const index = p.bests.find((b) => b.headline === "Best Ethos yet");
  if (index) {
    const past = /past your (\d+)/.exec(index.detail)?.[1];
    /* "past your 690", as the sheet's record says: "past 690" left a
       stranger guessing what 690 was (the #427 review). */
    return past
      ? { text: `Best yet, past your ${past}`, short: "Best yet", tone: "earned" }
      : { text: "Best yet", short: null, tone: "earned" };
  }
  const record = TRAIT_RECORD[p.trait];
  if (record && p.bests.some((b) => b.headline === record)) return { text: record, short: null, tone: "earned" };
  if (p.bests.some((b) => b.headline === "Best round yet")) return { text: "Best round yet", short: null, tone: "earned" };
  if (p.presence) {
    /* The number alone: a bare "▲ 40" beside it said nothing about what it
       was against (the #427 review), and "since last video" is the
       sheet's, where Presence heads its section. */
    return { text: `Presence ${p.presence.score}`, short: null, tone: "plain" };
  }
  if (typeof p.accuracy === "number") return { text: `Accuracy ${p.accuracy}`, short: null, tone: "plain" };
  return null;
}

/**
 * The earned line as the glance draws it, once fitGlance has chosen its
 * words: those words, and for a level-up (#498) the same words in pieces,
 * so each trait they name wears its colour.
 */
export function fittedEarned(
  earned: EarnedLine | null,
  text: string | null
): {
  text: string;
  tone: EarnedLine["tone"];
  delta?: number | null;
  levelUp?: { pieces: LevelUpPiece[] };
} | null {
  if (!earned || !text) return null;
  const form = earned.levelUp?.forms.find((f) => f.text === text);
  return {
    text,
    tone: earned.tone,
    delta: earned.delta,
    levelUp: form ? { pieces: form.pieces } : undefined,
  };
}

/** What a lesson's ending reads off one practice: a stored row, or the take on screen. */
export interface PracticeTake {
  fillers: number;
  pauses: Pause[];
  wpm: number;
  index: number | null;
}

/**
 * A practice's count on a lesson's ending, in the lesson's trait: its
 * fillers, its landed pauses (heldPauseMarks, the glance's one count) or
 * its words a minute. Sentence restarts and Variety have no count a stored row
 * keeps, so those lessons count the Index. Null where there is none.
 */
export function practiceCount(trait: TraitId, t: PracticeTake): number | null {
  if (trait === "fillers") return t.fillers;
  if (trait === "pause") return heldPauseMarks(t.pauses ?? []).landed;
  if (trait === "pace") return t.wpm;
  return t.index;
}

/**
 * The lesson's three practices, newest take of each (rows oldest first,
 * as fetchReps returns them), this practice read off the take on screen
 * so a save still in flight is counted. Null when a practice has no take:
 * a lesson is done when all of its practices are.
 */
export function lessonTakes(p: {
  lessonId: string;
  of: number;
  practice: number;
  current: PracticeTake;
  rows: readonly {
    lesson_id: string | null;
    filler_count: number;
    pauses: Pause[] | null;
    wpm: number;
    ethos_index: number | null;
  }[];
}): PracticeTake[] | null {
  const out: PracticeTake[] = [];
  for (let n = 1; n <= p.of; n++) {
    if (n === p.practice) {
      out.push(p.current);
      continue;
    }
    const id = `lesson:${p.lessonId}:${n}`;
    const row = [...p.rows].reverse().find((r) => r.lesson_id === id);
    if (!row) return null;
    out.push({ fillers: row.filler_count, pauses: row.pauses ?? [], wpm: row.wpm, index: row.ethos_index });
  }
  return out;
}

const LESSON_UNIT: Partial<Record<TraitId, string>> = {
  fillers: "fillers",
  pause: "pauses between sentences",
  pace: "words a minute",
};

/**
 * The lesson's ending in the earned slot (the #427 review: practice 3's
 * glance looked exactly like practice 1's): one sage line built from the
 * three practices' own counts, "Lesson done: 4, 4, 3 fillers". Earned
 * and measured. Over budget it keeps the numbers and drops the unit.
 */
export function lessonDone(trait: TraitId, takes: readonly PracticeTake[] | null): EarnedLine | null {
  if (!takes || takes.length === 0) return null;
  const counts = takes.map((t) => practiceCount(trait, t));
  if (counts.some((c) => c === null)) return null;
  const head = `Lesson done: ${counts.join(", ")}`;
  const unit = LESSON_UNIT[trait];
  return unit ? { text: `${head} ${unit}`, short: head, tone: "earned" } : { text: head, short: null, tone: "earned" };
}

/**
 * The one quiet line under Retake on a lesson's ending: the streak's
 * next day, from the count Tomorrow and the closing note read, so the
 * ending points at coming back without a section.
 */
export function comeBackLine(streak: number): string | null {
  return streak >= 1 ? `Day ${streak + 1} tomorrow` : null;
}

/**
 * Whether the take plays on when the door's sheet closes (the #427
 * review): only the glance's own moment, started on the glance, which
 * its chip can stop. Anything started in the sheet (Hear it back, a
 * word's "Said at", a Pause row's moment) stops with it, since nothing on
 * the glance could.
 */
export function playsOnAfterSheet(
  span: { from: number; until: number } | null,
  moment: Pick<GlanceMoment, "from" | "until"> | null
): boolean {
  return !!span && !!moment && span.from === moment.from && span.until === moment.until;
}

/**
 * The budget (DECISIONS #427): the glance's visible words may not pass
 * `budget`. Over it, the cue goes first, then the earned line's tail
 * after its comma ("Best yet" stays). The score, the line, the door and
 * the tap are in `fixed` and never go.
 *
 * A level-up (#498) is the one earned line that gives up its words
 * before the cue does: one is crossed on most of a new account's
 * recordings, so with #427's order the take's coaching would leave the
 * glance on most of them (the #498 review). Its shorter forms ("Pace
 * reached level 3", "Pace: level 3") are tried with the cue first; only
 * when none fits does the cue go, and then the longest that fits stays.
 *
 * A carried cue (#477) is what the glance ends on, so where the line and
 * the cue come with shorter forms they are tried before anything goes:
 * the short line (its number, no chip), then the short cue (no
 * "Tomorrow:"), then both, each with the earned line whole and then with
 * its tail cut. Only then the cue goes, as before, and the line keeps its
 * long form only where the earned line still fits beside it. `short` says
 * the line's short form was used.
 */
export function fitGlance(
  p: {
    fixed: string[];
    line: string;
    cue: string | null;
    earned: EarnedLine | null;
    lineShort?: string | null;
    cueShort?: string | null;
  },
  budget: number = GLANCE_WORDS
): { cue: string | null; earned: string | null; words: number; short: boolean } {
  const total = (line: string, cue: string | null, earned: string | null) =>
    countWords([...p.fixed, line, cue ?? "", earned ?? "", p.earned?.delta ? `▲ ${Math.abs(p.earned.delta)}` : ""].join(" "));
  /* The earned line's forms, longest first: a level-up's every form, any
     other line whole and then with its tail cut. */
  const earnedForms: (string | null)[] = !p.earned
    ? [null]
    : p.earned.levelUp
      ? p.earned.levelUp.forms.map((f) => f.text)
      : [p.earned.text, ...(p.earned.short ? [p.earned.short] : [])];
  if (p.lineShort || p.cueShort) {
    const forms: [string, string | null, boolean][] = [[p.line, p.cue, false]];
    if (p.lineShort) forms.push([p.lineShort, p.cue, true]);
    if (p.cueShort) forms.push([p.line, p.cueShort, false]);
    if (p.lineShort && p.cueShort) forms.push([p.lineShort, p.cueShort, true]);
    /* Any other earned line keeps #477's order: the line and the cue
       shorten before its tail goes. A level-up gives up its words before
       the line or the cue gives up any (#498): its forms are tried inside
       each of theirs, so "Pace: level 3" is tried before the line loses
       its chip or the cue its "Tomorrow:" (the 18 Nov merge: "Pace
       reached level 3" had kept its word while both of theirs went). */
    const tries: [string | null, [string, string | null, boolean]][] = p.earned?.levelUp
      ? forms.flatMap((f) => earnedForms.map((e): [string | null, [string, string | null, boolean]] => [e, f]))
      : earnedForms.flatMap((e) => forms.map((f): [string | null, [string, string | null, boolean]] => [e, f]));
    for (const [earned, [line, cue, short]] of tries) {
      const words = total(line, cue, earned);
      if (words <= budget) return { cue, earned, words, short };
    }
  }
  let cue = p.cue;
  if (cue && p.earned?.levelUp) {
    const earned = earnedForms.find((e) => total(p.line, cue, e) <= budget);
    if (earned !== undefined) return { cue, earned, words: total(p.line, cue, earned), short: false };
  }
  if (total(p.line, cue, earnedForms[0]) > budget) cue = null;
  /* With the cue gone, the line's short form is tried too before the
     earned line is held over the ceiling: a level-up keeps a form
     whatever the room (#498), and beside the long line its shortest
     could pass the ceiling where the short line fitted (the 18 Nov
     merge's review). Where nothing fits, the fewest words. */
  const lines: [string, boolean][] = cue === null && p.lineShort ? [[p.line, false], [p.lineShort, true]] : [[p.line, false]];
  for (const [line, short] of lines) {
    const earned = earnedForms.find((e) => total(line, cue, e) <= budget);
    if (earned !== undefined) return { cue, earned, words: total(line, cue, earned), short };
  }
  const [line, short] = lines[lines.length - 1];
  const earned = earnedForms[earnedForms.length - 1];
  return { cue, earned, words: total(line, cue, earned), short };
}

/**
 * The proof line (#507, grafted from the in-the-loop design): when the
 * take's Whisper words hold a saved swap's better phrase, the earned slot
 * also reads "the thing is → ✓ the point is ▶0:14", its chip playing that
 * moment. Its words ride on the same ceiling as everything else (#504's
 * goals, #498's level-up line, Demos's cue). The struck old phrase is the
 * first thing to go: the full line stands only where it costs nothing
 * else on the glance; otherwise the short one ("✓ the point is ▶0:14"),
 * on the same terms. Where even the short line would cost the cue, the
 * earned line or the line's long form, the proof waits (the swap's page
 * still counts the recording).
 */
export function fitGlanceProof(
  p: Parameters<typeof fitGlance>[0],
  budget: number,
  proof: { full: string; short: string } | null
): ReturnType<typeof fitGlance> & { proof: "full" | "short" | null } {
  const base = fitGlance(p, budget);
  if (!proof) return { ...base, proof: null };
  /* Either form stands only where it costs nothing else: the same cue, the
     same earned line, the same form of the line. The cue, the goals and
     the level-up keep their places, and the proof waits (the review:
     the short form used to push Demos's cue off to fit). */
  const fits = (text: string) => {
    const f = fitGlance({ ...p, fixed: [...p.fixed, text] }, budget);
    return f.words <= budget && f.cue === base.cue && f.earned === base.earned && f.short === base.short ? f : null;
  };
  const full = fits(proof.full);
  if (full) return { ...full, proof: "full" };
  const short = fits(proof.short);
  if (short) return { ...short, proof: "short" };
  return { ...base, proof: null };
}

/*
 * TEMPORARY (18 Nov, the proof line's three designs, lib/proof-variant.ts):
 * variant A's fit and variant C's line. The builder keeps the winner's
 * and deletes the rest.
 */

/**
 * Variant A: the proof is an earned moment, like a level-up, and never
 * waits. Its words ride on the ceiling up to their own allowance, as
 * the reminder ask's do (GLANCE_WORDS_ASK), so nothing else on the glance
 * gives way to it: "the thing is → ✓ the point is 0:14" is 7. A pair
 * #429 lets through at its longest (eight words said, six better) is 15.
 */
export const GLANCE_WORDS_PROOF = 12;

/**
 * Variant A's fit: whole wherever its words fit the allowance, the
 * struck phrase dropped only for a pair too long for it; the rest of the
 * glance is fitted exactly as it would be without the proof, because the
 * allowance grows the ceiling by the proof's own words. Only a short line
 * still over the allowance takes the rest from the ceiling, as any line
 * does.
 */
export function fitGlanceProofEarned(
  p: Parameters<typeof fitGlance>[0],
  budget: number,
  proof: { full: string; short: string } | null
): ReturnType<typeof fitGlance> & { proof: "full" | "short" | null } {
  if (!proof) return { ...fitGlance(p, budget), proof: null };
  const form: "full" | "short" = countWords(proof.full) <= GLANCE_WORDS_PROOF ? "full" : "short";
  const text = form === "full" ? proof.full : proof.short;
  const f = fitGlance({ ...p, fixed: [...p.fixed, text] }, budget + Math.min(GLANCE_WORDS_PROOF, countWords(text)));
  return { ...f, proof: form };
}

/**
 * Variant C: Demos says the proof in the carried cue's place, "Instead
 * of “the thing is”, you said “the point is” ▶0:14". The better phrase is
 * the one earned thing in it, so sage, and the chip comes straight after
 * it, bound to the words it plays (the #427 review), so the sentence
 * ends on the chip and takes no full stop. No cue: tomorrow's waits a day.
 */
export function proofGlance(p: { said: string; better: string; at: number; end: number }): GlanceLine {
  const moment = windowAt(p.at, 1, p.end + 1.5, "%, play where you said it");
  const before = `Instead of “${p.said}”, you said `;
  const better = `“${p.better}”`;
  return {
    parts: [{ kind: "text", text: before }, { kind: "text", text: better, earned: true }, { kind: "moment" }],
    sentence: `${before}${better} ${moment.clock}`,
    moment,
    cue: null,
  };
}

/**
 * What is behind the door, in order (DECISIONS #427, its review): "Every
 * number", one flat scroll. A game's round card first (moved off the
 * glance), then the coach's two under one head, the thing worth reading
 * (or the capped line), the records when a best fell, the boss's
 * accuracy, the evidence (Hear it back, or every filler where nothing
 * can play), every dimension with the practice's row open, Presence, the
 * transcript, the closing note as its last word, and a game's ladder.
 */
export type SheetSection =
  | "round"
  | "records"
  | "accuracy"
  | "hear"
  | "fillers"
  | "coach"
  | "capped"
  | "dimensions"
  | "presence"
  | "words"
  | "closing"
  | "ladder";

export function sheetSections(p: {
  bests: number;
  accuracy: boolean;
  round: boolean;
  audio: boolean;
  fillers: number;
  coach: boolean;
  capped: boolean;
  presence: boolean;
  closing: boolean;
  ladder: boolean;
}): SheetSection[] {
  const out: SheetSection[] = [];
  if (p.round) out.push("round");
  if (p.coach) out.push("coach");
  else if (p.capped) out.push("capped");
  if (p.bests > 0) out.push("records");
  if (p.accuracy) out.push("accuracy");
  if (p.audio) out.push("hear");
  else if (p.fillers > 0) out.push("fillers");
  out.push("dimensions");
  if (p.presence) out.push("presence");
  out.push("words");
  if (p.closing) out.push("closing");
  if (p.ladder) out.push("ladder");
  return out;
}
