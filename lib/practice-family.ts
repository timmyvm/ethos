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
 */
export type PracticeFamily = TraitId | "sky";

export function practiceFamily(config: Pick<RepConfig, "kind" | "lessonId">): PracticeFamily {
  if (config.kind === "boss") return "sky";
  const walk = config.lessonId.match(/^practice:trait-(\w+)$/);
  if (walk && walk[1] in TRAIT) return walk[1] as TraitId;
  return recordingTrait({ lesson_id: config.lessonId }) ?? "sky";
}
