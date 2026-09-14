"use client";

import { IconPremium } from "@/components/Icon";

/**
 * One mark for the one tier (DECISIONS #280).
 *
 * It was nine. A locked mod said "premium" in lowercase stone-400 after
 * its name; the Log said "Pro" in a grey pill; the Presence card said
 * nothing and drew an ellipsis; its detail card said it in a terracotta
 * wash with a terracotta button; /history, /you and /boss each used a
 * plain terracotta text link; the cap moment used a stone text button;
 * the boss's spin quota used SAGE; the boss's weekly lock said it in
 * prose with no mark at all; and Hostile Q&A did not say it, so you
 * found out by being refused.
 *
 * Nine spellings of one tier read as nine features, and two of them
 * borrowed a colour that already meant something else. Terracotta means
 * tap. Sage means earned. A free allowance is not earned, it is
 * allotted, and a thing you pay for is the opposite of a thing you
 * earned: that is the distinction the product is built on (#14, money
 * buys cosmetics only), and it now has a colour.
 *
 * The mark never hides a number. The ellipsis stays, the quota still
 * counts, the row still says how many recordings are behind it. This
 * component names the tier and does nothing else.
 */
export type PremiumMarkVariant = "inline" | "chip";

export function PremiumMark({
  variant = "inline",
  className = "",
}: {
  variant?: PremiumMarkVariant;
  className?: string;
}) {
  if (variant === "chip") {
    return (
      <span
        className={`label-micro inline-flex shrink-0 items-center gap-1 rounded-full border border-plum-300 bg-plum-50 px-2 py-0.5 !text-plum-800 ${className}`}
      >
        {/* The glyph is omitted under 16px on purpose: a two-stroke door
            at 11px is a smudge, and the word carries it. */}
        Premium
      </span>
    );
  }
  return (
    <span
      className={`ml-1.5 inline-flex items-baseline text-caption font-semibold text-plum-700 ${className}`}
    >
      Premium
    </span>
  );
}

/**
 * The mark with its glyph, for the two places it sits at reading size:
 * the cap moment's line and anywhere a row is the door itself.
 */
export function PremiumDoor({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <IconPremium size={16} />
      {children}
    </span>
  );
}
