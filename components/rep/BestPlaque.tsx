import { IconTrophy } from "@/components/Icon";
import type { BestParts } from "@/lib/round-live";

/**
 * A game's best at this level, before Record (M4), drawn as the record
 * it is (Timothy, 6 Nov: "make your best stand out more, it is an
 * important milestone"). Sage because it was earned, the cup gold like
 * every earned glyph, the number set large on its own so the eye lands
 * on what there is to beat. Not a tap: no fill of one, no press.
 *
 * A screen reader hears the one sentence (`label`, `bestLine`); the
 * split parts are for the eye only.
 */
export function BestPlaque({
  parts,
  label,
  className = "",
}: {
  parts: BestParts;
  label: string;
  className?: string;
}) {
  return (
    <p className={`best-plaque ${className}`}>
      <span className="sr-only">{label}</span>
      <span aria-hidden className="best-plaque-mark earned-lit">
        <IconTrophy size={22} />
      </span>
      <span aria-hidden className="min-w-0 flex-1">
        <span className="best-plaque-head">{parts.head}</span>
        <span className="best-plaque-line">
          {/* Under 700pt tall the head folds into this one word, so the
              plaque is one line and Record stays in view. */}
          <span className="best-plaque-short">Best </span>
          <span className="best-plaque-value">{parts.value}</span> {parts.rest}
        </span>
      </span>
      {parts.note && (
        <span aria-hidden className="best-plaque-note">
          {parts.note}
        </span>
      )}
    </p>
  );
}
