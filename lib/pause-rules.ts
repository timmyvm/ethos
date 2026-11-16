import { TRAIT } from "@/content/traits";

/**
 * Which pause rules scored a take (#491).
 *
 * #476 changed how a new take's Pause dimension is judged (sentence ends
 * from Whisper's full stops, only an um fills a pause), and nothing
 * stored is rescored (#422). So the first take under #476 sets its Index
 * beside a stored one scored under the old rules, and its delta and its
 * "Best yet" read high from the rule alone: the replay's median Pause
 * was 20 under the old rules and 56 under #476 across the testers, and
 * Pause is 1.5 Index points a point (the fixture moved +71).
 *
 * Every take stored from here on carries the rules that scored it,
 * `dimensions.pauseRules` (saveRep, lib/db.ts), and the route says the
 * same on its answer (`pauseRules`). A stored take without the mark was
 * scored before #476. Nothing stored is touched.
 */
export const PAUSE_RULES = 476;

/** The rules a stored take's `dimensions` says scored it; 0 for a take from before the mark. */
export function pauseRulesOf(dimensions: unknown): number {
  if (!dimensions || typeof dimensions !== "object") return 0;
  const v = (dimensions as { pauseRules?: unknown }).pauseRules;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** A stored take's Pause score (out of 100), or null when it has none. */
function pauseOf(dimensions: unknown): number | null {
  if (!dimensions || typeof dimensions !== "object") return null;
  const v = (dimensions as { tier1?: { pause?: unknown } }).tier1?.pause;
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

/** What the note reads off a stored take. */
export interface RulesRow {
  ethos_index: number | null;
  dimensions: unknown;
  mode?: string | null;
}

/**
 * The smallest rise in the Pause score that the note names: 5 points,
 * 7.5 on the Index. Under it the rule moved this take too little to be
 * "part of this jump", and saying so would blame a rule the numbers do
 * not show.
 */
export const RULES_NOTE_MIN = 5;

/** This phone has shown the note (the account's memory is the stored mark). */
export const RULES_NOTE_KEY = "ethos.pauseRules.told";

export interface RulesNote {
  /** What it stands beside: the delta ("this jump"), or the best it passed. */
  kind: "delta" | "best";
  text: string;
}

/**
 * The one line under the delta on the first take scored under #476 whose
 * delta or "Best yet" stands beside a take scored before it (#491), or
 * null. A "best" note is said only where the glance shows "Best yet"
 * (the caller drops it where a lesson's ending or a rung holds that
 * line), so "passing your 690" always has its 690 on screen.
 * CLAUDE.md: feedback traces to a number, so a jump that is the
 * rule's and not the speaker's says so, once, with the Pause scores that
 * moved: "Part of this jump comes from new pause scoring: Pausing went
 * 26 to 73."
 *
 * Once per account: it shows only while no earlier stored take carries
 * the mark, so the first take stored under #476 ends it on every phone;
 * `told` (this phone's flag) covers a first take whose save failed.
 * Never when the take is not under #476, has no Index, did not rise, or
 * its Pause score rose by less than `RULES_NOTE_MIN`.
 *
 * `prior` is the account's stored takes before this one, oldest first
 * (fetchReps). The delta's take is the newest scored one at the Index
 * the route compared with (`previousIndex`; a boss's is last week's
 * boss), the best's the one holding the best Index.
 */
export function rulesNote(p: {
  /** The take on screen: the rules the route scored it under, its Index and its Pause score. */
  now: { rules: number | null | undefined; index: number | null; pause: number };
  previousIndex: number | null;
  prior: readonly RulesRow[];
  boss?: boolean;
  told?: boolean;
}): RulesNote | null {
  const { now } = p;
  if (p.told) return null;
  if ((now.rules ?? 0) < PAUSE_RULES || now.index === null) return null;
  const scored = p.prior.filter((r) => r.ethos_index !== null);
  /* An earlier take is already under these rules: this is not the first. */
  if (scored.some((r) => pauseRulesOf(r.dimensions) >= PAUSE_RULES)) return null;
  const pauseNow = Math.round(now.pause);
  const rose = (then: number | null): then is number => then !== null && pauseNow - then >= RULES_NOTE_MIN;
  const name = TRAIT.pause.skill;

  if (p.previousIndex !== null && now.index > p.previousIndex) {
    const compared = [...scored]
      .reverse()
      .find((r) => r.ethos_index === p.previousIndex && (!p.boss || r.mode === "boss"));
    const then = compared ? pauseOf(compared.dimensions) : null;
    if (rose(then)) {
      return { kind: "delta", text: `Part of this jump comes from new pause scoring: ${name} went ${then} to ${pauseNow}.` };
    }
  }

  const best = scored.reduce<RulesRow | null>(
    (a, r) => (a === null || (r.ethos_index ?? 0) >= (a.ethos_index ?? 0) ? r : a),
    null
  );
  const bestIndex = best?.ethos_index ?? 0;
  if (best && bestIndex > 0 && now.index > bestIndex) {
    const then = pauseOf(best.dimensions);
    if (rose(then)) {
      return {
        kind: "best",
        text: `Part of passing your ${bestIndex} comes from new pause scoring: ${name} went ${then} to ${pauseNow}.`,
      };
    }
  }
  return null;
}

/** What `rulesNoteForAnswer` reads off /api/analyze's answer. */
export interface RulesAnswer {
  pauseRules?: number;
  ethosIndex: number | null;
  previousIndex: number | null;
  tier1?: { pause: number } | null;
  mode?: string | null;
}

/**
 * The note for an answer that just landed, read against the history the
 * screen held from before the take (#491). Every screen that shows a new
 * take's delta goes through this one call: the recorder's glance and
 * Upload's results (an upload is a take too, stored with the mark, so a
 * first take made there would otherwise end the note unsaid). No history
 * read yet means no note, never a guess.
 */
export function rulesNoteForAnswer(
  answer: RulesAnswer,
  prior: readonly RulesRow[] | null | undefined,
  told: boolean
): RulesNote | null {
  if (!prior || !answer.tier1) return null;
  return rulesNote({
    now: { rules: answer.pauseRules, index: answer.ethosIndex, pause: answer.tier1.pause },
    previousIndex: answer.previousIndex,
    prior,
    boss: answer.mode === "boss",
    told,
  });
}

/**
 * What the glance draws of the note: a delta's note on any scored take, a
 * best's only where the glance's earned line says "Best yet" (a lesson's
 * ending or a rung can hold that line), so "passing your 640" always has
 * its 640 on screen. Null draws nothing.
 */
export function rulesNoteShown(
  note: RulesNote | null,
  glance: { scorable: boolean; earned: string | null | undefined }
): string | null {
  if (!note || !glance.scorable) return null;
  if (note.kind === "best" && !glance.earned?.startsWith("Best yet")) return null;
  return note.text;
}

/** Whether this phone has shown the note; storage that refuses reads as not shown. */
export function rulesNoteTold(): boolean {
  try {
    return localStorage.getItem(RULES_NOTE_KEY) === String(PAUSE_RULES);
  } catch {
    return false;
  }
}

/** Remember on this phone that the note has shown; a refused write is no error. */
export function markRulesNoteTold(): void {
  try {
    localStorage.setItem(RULES_NOTE_KEY, String(PAUSE_RULES));
  } catch {}
}
