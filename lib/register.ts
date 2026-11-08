/**
 * CLAUDE.md's one banned thing, as a pattern: Ethos is not a gym, a
 * workout, a drill, a rep or training, as a noun or a verb. The words are
 * practice, lesson, recording, session, the road, the floor.
 *
 * One list for every place that checks it: the word sheet's options
 * (lib/words.ts), Demos's "Say this instead" (lib/upgrade.ts), Demos's
 * own copy (lib/coach.ts) and every string sent to a model
 * (lib/model-prompts.test.ts). lib/copy.test.ts keeps its own lists for
 * the interface's source.
 */
export const GYM_REGISTER = /\b(gyms?|workouts?|drills?|drilling|reps?|training|trains?|trained|trainers?)\b/i;

/** "Train a model" is machine learning (the privacy page), not the gym. */
const MODEL_SENSE = /\b(models?|AI|machine learning)\b/i;
const TRAIN_FORMS = /\btrain(?:s|ed|ing)?\b/gi;

/**
 * Whether `s` says the gym. With `modelSense`, the verb "train" and
 * "training" pass in a string that is about a model; every other word of
 * the register still counts there.
 */
export function saysGym(s: string, { modelSense = false } = {}): boolean {
  const text = modelSense && MODEL_SENSE.test(s) ? s.replace(TRAIN_FORMS, "") : s;
  return GYM_REGISTER.test(text);
}

/** The first word of the register `s` says, for a readable failure, or null. */
export function gymWord(s: string): string | null {
  return GYM_REGISTER.exec(s)?.[0] ?? null;
}

/** brand.md's banned phrases, for copy a model writes as well as ours (manosphere and false promise). */
export const BANNED_PHRASES: readonly string[] = [
  "alpha",
  "dominate",
  "high-value",
  "unlock your potential",
  "top 1%",
  "level up your life",
];

/** Hype: praise that measures nothing. */
export const HYPE_PHRASES: readonly string[] = [
  "amazing",
  "incredible",
  "awesome",
  "fantastic",
  "crushing it",
  "great job",
  "you're on your way",
];
