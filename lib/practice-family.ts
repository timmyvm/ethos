import { lessonById } from "@/content/lessons";
import { TRAIT, type TraitId } from "@/content/traits";
import { heroObject } from "./home";
import { parsePracticeId } from "./lesson-progress";
import { recordingTrait } from "./log";
import type { RepConfig } from "./rep-config";

/**
 * The colour family a recording screen wears (D50): the practice's
 * trait, so pressing Start on Today's blue Pausing card opens onto the
 * same blue, or the sky stage for a practice that measures no one
 * trait (the boss, a game, a free recording). Read by the topic card's
 * fill (`.family-fill`) and the live waveform's stroke.
 *
 * A trait walk (/practice/[trait]) sends `?lesson=trait-<id>`, stored
 * as `practice:trait-<id>`; everything else goes by the recording's own
 * id, as the Log colours its rows (lib/log.ts `recordingTrait`).
 *
 * Today's Start and its roulette open a topic (`?topic=t9`), whose id
 * names no trait, so the card that was pressed says which family it
 * wore (`?trait=pause`, the `pressed` hint). Without it the blue
 * Pausing card opened onto the sky stage on every returning user's
 * daily path. The practice's own trait wins over the hint.
 */
export type PracticeFamily = TraitId | "sky";

export function practiceFamily(
  config: Pick<RepConfig, "kind" | "lessonId">,
  pressed?: string | null
): PracticeFamily {
  if (config.kind === "boss") return "sky";
  const walk = config.lessonId.match(/^practice:trait-(\w+)$/);
  if (walk && walk[1] in TRAIT) return walk[1] as TraitId;
  const own = recordingTrait({ lesson_id: config.lessonId });
  if (own) return own;
  return pressed && Object.prototype.hasOwnProperty.call(TRAIT, pressed) ? (pressed as TraitId) : "sky";
}

/**
 * Day one's colour (E20): the family of the lesson day one's Start opens
 * (`nextLesson`, The baseline for a new account, which is Fillers), so
 * Today's first card, the unit intro it leads to and the recording card
 * after that are one colour (D50). Pausing's blue, the house's, only
 * when there is no lesson to name. Read by Today and by the
 * introduction's plan, which previews that card.
 */
export function dayOneFamily(next: { lesson: { id: string } } | null): TraitId {
  return (next && recordingTrait({ lesson_id: next.lesson.id })) ?? "pause";
}

/**
 * The glass object the recording card stands in its top band (E51), or
 * null where it stands none.
 *
 *  - Today's practice: exactly Today's object (`heroObject` of the item's
 *    trait and first tip), so the thing on the card you pressed is on
 *    the card you land on.
 *  - A lesson's practice: the lesson's own object, the one its page's
 *    stage stood one tap earlier. (By its first tip it would be the
 *    object of whichever lesson teaches that tactic: a different object
 *    on 30 of the 45 practices.)
 *  - Anything else with a trait (the road's lessons, a trait walk): the
 *    trait's object for its first tip, as Today picks.
 *  - None on the sky (the boss, a game) or for a spun topic, whose card
 *    named a shape, not a tactic.
 */
export function recordingObject(
  config: Pick<RepConfig, "kind" | "lessonId" | "tips" | "rouletteTopic" | "practice">
): string | null {
  if (config.kind === "boss") return null;
  if (config.practice) return heroObject(config.practice.trait, config.practice.tips[0]);
  if (config.rouletteTopic) return null;
  const own = parsePracticeId(config.lessonId);
  if (own && lessonById(own.lessonId)) return own.lessonId;
  const family = practiceFamily(config);
  return family === "sky" ? null : heroObject(family, config.tips[0]);
}
