import { CountUp } from "@/components/CountUp";

/**
 * The Ethos number, drawn one way (#493). The morning tour found it three
 * ways: "665 /1000" bare on the glance, "Your Ethos 662 / 1000" on the
 * Log's stage and "616 your Ethos /1000" on a stored recording. Now it is
 * always the number in the display face and "/1000", one word, 4px after
 * it on the number's baseline. Where the screen needs to say what it is,
 * "Your Ethos" is an eyebrow above it (the Log's stage, a stored
 * recording), never a label beside it. Its change goes under it, through
 * `Trend` (components/ui/TrendMark.tsx).
 *
 * Presence, the app's other number out of 1000, is drawn by the same
 * line under its own "Your Presence" eyebrow (the #493 review), and so
 * is Today's This week tile.
 *
 * `value` null is unknown, a dash, never zero (E33). `count` rolls it up
 * on arrival (#245); `still` draws the number as it is, for a glance
 * holding its place before it counts.
 */
export const OUT_OF = "/1000";

const SIZE = {
  /** The glance's 72, the results score step only. */
  xl: "text-num-xl",
  /** The screen's one big number: the Log's stage, a stored recording. */
  hero: "text-num-hero",
} as const;

export function EthosScore({
  value,
  size,
  count = false,
  durationMs,
  onStage = false,
  srLabel,
  className = "",
}: {
  value: number | null;
  size: keyof typeof SIZE;
  /** Count up to the number on arrival. */
  count?: boolean;
  durationMs?: number;
  /** On a HeroStage: "/1000" takes the stage's ink. */
  onStage?: boolean;
  /** Words a screen reader hears before the number where no eyebrow says them. */
  srLabel?: string;
  className?: string;
}) {
  return (
    <span data-ethos-score className={`flex items-baseline gap-1 ${className}`}>
      {srLabel && <span className="sr-only">{srLabel}</span>}
      {value === null ? (
        <span className={`font-display ${SIZE[size]} font-extrabold tabular-nums`}>{"—"}</span>
      ) : (
        <span data-score className={`font-display ${SIZE[size]} font-extrabold tabular-nums`}>
          {count ? <CountUp value={value} durationMs={durationMs} /> : value}
        </span>
      )}
      <span className={`whitespace-nowrap text-body font-normal ${onStage ? "stage-ink" : "text-stone-500"}`}>
        {OUT_OF}
      </span>
    </span>
  );
}
