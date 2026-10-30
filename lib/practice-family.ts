import { TRAIT, type TraitId } from "@/content/traits";
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
