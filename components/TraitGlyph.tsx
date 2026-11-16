import type { ReactNode } from "react";
import { IconGauge, IconPause, IconRestart, IconVariety, IconWave } from "@/components/Icon";
import type { TraitId } from "@/content/traits";

/**
 * Each trait's flat glyph (#478, docs/plan-next.md section 1: Today's
 * tiles lose their glass objects). The app's own line set, drawn in the
 * trait's tone where it stands: Pausing the pause bars, Fillers the
 * voice metered (the introduction's "Um, uh, like"), Restarts the arrow
 * back to the start, Pace the gauge (the introduction's "I rush"),
 * Variety three different shapes.
 */
export const TRAIT_GLYPH: Record<TraitId, (size: number) => ReactNode> = {
  pause: (s) => <IconPause size={s} />,
  fillers: (s) => <IconWave size={s} />,
  repairs: (s) => <IconRestart size={s} />,
  pace: (s) => <IconGauge size={s} />,
  range: (s) => <IconVariety size={s} />,
};

export function TraitGlyph({ id, size = 18 }: { id: TraitId; size?: number }) {
  return <>{TRAIT_GLYPH[id](size)}</>;
}
