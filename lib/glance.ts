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
 * "The whole recording", pulled, never pushed (NN/g's progressive
 * disclosure; Chiviacowsky's self-controlled feedback).
 *
 * Every digit Demos says here is a field of the take or a time in it,
 * so the line traces to a number or a timestamp (vision.md). Nothing
 * here is the coach's text.
 */

import type { TraitId } from "@/content/traits";
import { recordingTrait } from "./log";
import type { RepMetrics, Word } from "./metrics";
import { heldPauseMarks, landedPause } from "./pause-mark";
import { filledMoments, MOMENT_LEAD_S, MOMENT_TAIL_S } from "./pause-quality";
import type { RewardMoment } from "./rewards";
import { transcriptPieces, type TranscriptUnit } from "./transcript-words";

/** The glance's ceiling, in words as `countWords` counts them. */
export const GLANCE_WORDS = 25;
/** Named exceptions, each held at its own ceiling by the camera. */
export const GLANCE_WORDS_TESTER = 36;
export const GLANCE_WORDS_FIRST = 28;

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

/** The sentence in pieces: text, and at most one chip where the moment stands. */
export type GlancePart = { kind: "text"; text: string } | { kind: "moment" };

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

/** A sentence with a chip in it, built from its two sides. */
function withMoment(before: string, moment: GlanceMoment, after: string): Pick<GlanceLine, "parts" | "sentence" | "moment"> {
  const parts: GlancePart[] = [];
  if (before) parts.push({ kind: "text", text: before });
  parts.push({ kind: "moment" });
  if (after) parts.push({ kind: "text", text: after });
  return { parts, sentence: `${before}${moment.clock}${after}`, moment };
}

function plain(sentence: string): Pick<GlanceLine, "parts" | "sentence" | "moment"> {
  return { parts: [{ kind: "text", text: sentence }], sentence, moment: null };
}

function windowAt(t: number, lead: number, until: number, label: string): GlanceMoment {
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
 * one in the sentence.
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
  const secs = Math.round(m.durationS);
  const cue = (target: string | null): string | null => (p.lead && target ? `${p.lead} ${target}` : null);

  if (p.trait === "pause") {
    const pauses = m.pauses ?? [];
    const marks = heldPauseMarks(pauses);
    const filled = filledMoments(pauses);
    if (filled && filled.moments.length > 0) {
      const first = filled.moments[0];
      const moment: GlanceMoment = { t: first.t, clock: first.clock, from: first.from, until: first.until, label: first.label };
      const n = filled.moments.length;
      const said = n === 1 ? withMoment("", moment, " had a sound in it.") : withMoment(`${n} pauses had a sound, first `, moment, ".");
      return { ...said, cue: cue("none with a sound.") };
    }
    const held = pauses.filter((x) => x.kind !== "beat");
    const searching = held.filter((x) => !landedPause(x)).sort((a, b) => a.t - b.t);
    if (searching.length > 0) {
      const s = searching[0];
      const moment = windowAt(s.t, MOMENT_LEAD_S, s.t + s.len + MOMENT_TAIL_S, "Play %, a searching pause");
      const landed = marks.landed === 0 ? "None landed" : `${marks.landed} landed`;
      const said =
        searching.length === 1
          ? withMoment(`${landed}, 1 searching at `, moment, ".")
          : withMoment(`${landed}, ${searching.length} searching, first `, moment, ".");
      return { ...said, cue: cue(`land ${marks.held}.`) };
    }
    if (marks.landed > 0) {
      const longest = held.filter(landedPause).reduce((a, b) => (b.len > a.len ? b : a));
      const one = marks.landed === 1;
      const moment = windowAt(
        longest.t,
        MOMENT_LEAD_S,
        longest.t + longest.len + MOMENT_TAIL_S,
        one ? "Play %, the landed pause" : "Play %, the longest landed pause"
      );
      const said = one ? withMoment("1 landed, at ", moment, ".") : withMoment(`All ${marks.landed} landed, longest at `, moment, ".");
      return { ...said, cue: cue(`land ${marks.landed + 1}.`) };
    }
    return { ...plain(`No held pauses in ${secs}s.`), cue: cue("hold 1 after a point.") };
  }

  if (p.trait === "repairs") {
    const n = m.repairCount ?? 0;
    if (n >= 2) return { ...plain(`${n} restarts in ${secs}s.`), cue: cue(`under ${n}.`) };
    if (n === 1) return { ...plain(`1 restart in ${secs}s.`), cue: cue("none.") };
    return { ...plain(`No restarts in ${secs}s.`), cue: cue("none again.") };
  }

  if (p.trait === "pace") {
    const [lo, hi] = PACE_ZONE;
    if (m.wpm >= lo && m.wpm <= hi) return { ...plain(`${m.wpm} words a minute, in the zone.`), cue: cue(`${lo} to ${hi} again.`) };
    if (m.wpm > hi) return { ...plain(`${m.wpm} words a minute.`), cue: cue(`under ${hi}.`) };
    return { ...plain(`${m.wpm} words a minute.`), cue: cue(`over ${lo}.`) };
  }

  if (p.trait === "range") {
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
          ? withMoment(`${word} ${top.times} times, first `, windowAt(first.start, FILLER_LEAD_S, first.start + FILLER_TAIL_S, `Play %, ${word}`), ".")
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
    /* The hero is the count: the line says where. */
    const said = n === 1 ? withMoment("At ", moment, ".") : withMoment("The first at ", moment, ".");
    return { ...said, cue: cue(target) };
  }
  const said = n === 1 ? withMoment("1 filler, at ", moment, ".") : withMoment(`${n} fillers, first at `, moment, ".");
  return { ...said, cue: cue(target) };
}

/**
 * A game's line (the ladder's first sentence, "1 of 2 counted."): the
 * round card already holds the round's number and moment, so Demos says
 * where the ladder stands, and nothing else.
 */
export function ladderLine(line: string): string {
  const first = line.split(/(?<=[.!?])\s+(?=\S)/)[0] ?? line;
  return first.trim();
}

/** The earned slot under the delta: one line, sage when earned, ink when a second score. */
export interface EarnedLine {
  text: string;
  /** What stays when the budget cuts its tail ("Best yet"), or null to drop it whole. */
  short: string | null;
  tone: "earned" | "plain";
  /** Presence's change since the last video take, beside its number. */
  delta?: number | null;
}

const TRAIT_RECORD: Partial<Record<TraitId, string>> = {
  fillers: "Cleanest recording yet",
  pause: "Most silence you've held",
};

/**
 * The earned line (DECISIONS #427): the slot that held "Pace leveled
 * twice", now only for something earned, first match wins: a game's
 * ladder moment, a new best Index, a record on the practice's own trait,
 * a game's best round. Otherwise a second score in ink: a Premium video
 * take's Presence, a boss's Accuracy. Otherwise nothing, and the slot
 * takes no height. Every record still stands as its card in the sheet.
 */
export function earnedLine(p: {
  bests: RewardMoment[];
  ladderMoment?: RewardMoment | null;
  trait: TraitId;
  presence?: { score: number; previous: number | null } | null;
  accuracy?: number | null;
}): EarnedLine | null {
  if (p.ladderMoment) return { text: p.ladderMoment.headline, short: null, tone: "earned" };
  const index = p.bests.find((b) => b.headline === "Best Ethos yet");
  if (index) {
    const past = /past your (\d+)/.exec(index.detail)?.[1];
    return past ? { text: `Best yet, past ${past}`, short: "Best yet", tone: "earned" } : { text: "Best yet", short: null, tone: "earned" };
  }
  const record = TRAIT_RECORD[p.trait];
  if (record && p.bests.some((b) => b.headline === record)) return { text: record, short: null, tone: "earned" };
  if (p.bests.some((b) => b.headline === "Best round yet")) return { text: "Best round yet", short: null, tone: "earned" };
  if (p.presence) {
    const delta = p.presence.previous !== null ? p.presence.score - p.presence.previous : null;
    return { text: `Presence ${p.presence.score}`, short: null, tone: "plain", delta: delta === 0 ? null : delta };
  }
  if (typeof p.accuracy === "number") return { text: `Accuracy ${p.accuracy}`, short: null, tone: "plain" };
  return null;
}

/**
 * The budget (DECISIONS #427): the glance's visible words may not pass
 * `budget`. Over it, the cue goes first, then the earned line's tail
 * after its comma ("Best yet" stays). The score, the line, the door and
 * the tap are in `fixed` and never go.
 */
export function fitGlance(
  p: { fixed: string[]; line: string; cue: string | null; earned: EarnedLine | null },
  budget: number = GLANCE_WORDS
): { cue: string | null; earned: string | null; words: number } {
  const total = (cue: string | null, earned: string | null) =>
    countWords([...p.fixed, p.line, cue ?? "", earned ?? "", p.earned?.delta ? `▲ ${Math.abs(p.earned.delta)}` : ""].join(" "));
  let cue = p.cue;
  let earned = p.earned?.text ?? null;
  if (total(cue, earned) > budget) cue = null;
  if (total(cue, earned) > budget && p.earned?.short) earned = p.earned.short;
  return { cue, earned, words: total(cue, earned) };
}

/**
 * What is behind the door, in order (DECISIONS #427): "The whole
 * recording", one flat scroll. Records first when a best fell, the
 * boss's accuracy and the round's note, then the evidence (Hear it back,
 * or every filler where nothing can play), the coach's two under one
 * caption (or the capped line), every dimension with the practice's row
 * open, Presence, the transcript, the closing note as its last word, and
 * a game's ladder.
 */
export type SheetSection =
  | "records"
  | "accuracy"
  | "round-note"
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
  roundNote: boolean;
  audio: boolean;
  fillers: number;
  coach: boolean;
  capped: boolean;
  presence: boolean;
  closing: boolean;
  ladder: boolean;
}): SheetSection[] {
  const out: SheetSection[] = [];
  if (p.bests > 0) out.push("records");
  if (p.accuracy) out.push("accuracy");
  if (p.roundNote) out.push("round-note");
  if (p.audio) out.push("hear");
  else if (p.fillers > 0) out.push("fillers");
  if (p.coach) out.push("coach");
  else if (p.capped) out.push("capped");
  out.push("dimensions");
  if (p.presence) out.push("presence");
  out.push("words");
  if (p.closing) out.push("closing");
  if (p.ladder) out.push("ladder");
  return out;
}
