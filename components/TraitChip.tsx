import { TRAIT, type TraitId } from "@/content/traits";

/**
 * The trait chip (M11): the one pill that names a trait, wherever traits
 * mix (Today's floor card, the lesson page under its stage, a stored
 * recording's header). Never inside a trait's own section, whose head
 * already names it.
 *
 * The solid tone with its own ink on it, no ring: the tone separates
 * from white, near-black, every wash and the amber floor card alike.
 * The outer span carries `data-trait` and the inner label `tone-fill
 * tone-on`, so the existing `[data-trait="repairs"] .tone-on` rule and
 * the dark theme's ink reach it (Restarts takes the dark ink on its
 * ochre). lib/today-colour.test.ts holds every pair at 4.5:1.
 *
 * Sizes: `sm` 22px, 12.5/700 (the floor card, a recording); `md` 24px,
 * 13/700 (the lesson page). The name is content/traits.ts's, as written.
 */
export function TraitChip({
  trait,
  size = "sm",
  className = "",
}: {
  trait: TraitId;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span data-trait={trait} className={`inline-flex shrink-0 ${className}`}>
      <span
        className={`tone-fill tone-on font-display inline-flex items-center whitespace-nowrap rounded-full font-bold leading-none ${
          size === "md" ? "h-6 px-2.5 text-link" : "h-[22px] px-2 text-caption"
        }`}
      >
        {TRAIT[trait].name}
      </span>
    </span>
  );
}
