import type { ReactNode } from "react";

/**
 * Demos's speech bubble (DECISIONS #288): a card with a tail on him.
 *
 * The tail is what makes the line HIS. A heading over a picture of a
 * mascot is a page with a mascot on it; a bubble with a tail is
 * somebody talking to you, and that is the whole difference the
 * reference's introduction has over ours (docs/refs/duolingo-onboarding,
 * NOTES.md, mechanic 1).
 *
 * The one `.card` recipe (raised paper, card-edge hairline, shadow-1,
 * the dark sheen), the same material as every card, rather than the results screen's terracotta wash: on a question
 * screen the chosen answer takes that wash (mechanic 6), and his voice
 * and your tap should not share a colour.
 *
 * The bubble owns his VOICE (intro-a-9, M08): Figtree 400 in ink, so
 * what he says reads as speech against the Outfit 700 objects you tap
 * (answers, Next), which is the reference's own contrast. Children set
 * no family and no weight; a second, quieter line sets only its size
 * and colour.
 *
 *   voice="lead"    19 on a 26px line: the introduction's stage and
 *                   beside bubbles, where he is the screen
 *   voice="detail"  17 on a 24px line: everywhere else (the default)
 *
 * The tail is a rotated square that carries the bubble's own hairline
 * on its two outer sides and covers the bubble's edge with its fill,
 * so the outline reads as one shape.
 *
 *   material="card"  the one card recipe (the default)
 *   material="plum"  on a plum Premium sheet (the price drop): cream at
 *                    10% over the plum, mixed opaque so the tail still
 *                    covers the edge, a cream/16 hairline and his voice
 *                    in cream. The paywall's inset note is the same
 *                    cream/10, and plum is #3c2043 in both themes, so
 *                    one material serves both; a raised card was a grey
 *                    slab on plum in dark.
 */
export function SpeechBubble({
  tail,
  voice = "detail",
  material = "card",
  className = "",
  children,
}: {
  /** "down" for a bubble over his head, "up" for one under him (the
   *  results' score step, D52), "left" for one beside him. */
  tail: "down" | "up" | "left";
  /** His voice's size: "lead" in the introduction, "detail" elsewhere. */
  voice?: "lead" | "detail";
  /** What the bubble is made of: the card, or the plum sheet's cream (above). */
  material?: "card" | "plum";
  className?: string;
  children: ReactNode;
}) {
  const plum = material === "plum";
  return (
    <div
      className={`relative px-4 py-3.5 font-body font-normal ${
        plum ? "rounded-card border border-cream/16 bg-[#4f3655] text-cream" : "card text-ink"
      } ${voice === "lead" ? "text-lead leading-[26px]" : "text-detail leading-[24px]"} ${className}`}
    >
      {children}
      <span
        aria-hidden
        className={`absolute h-3.5 w-3.5 rotate-45 ${plum ? "border-cream/16 bg-[#4f3655]" : "border-card-edge bg-raised"} ${
          tail === "down"
            ? "-bottom-[7px] left-1/2 -translate-x-1/2 border-b border-r"
            : tail === "up"
              ? /* At the top edge the dark card's sheen is at its
                   lightest (raised plus 4.6% white), so the tail
                   takes that step and no seam shows. */
                `-top-[7px] left-1/2 -translate-x-1/2 border-t border-l ${plum ? "" : "dark:bg-[color-mix(in_srgb,var(--color-raised),#fff_4.6%)]"}`
              : /* In dark the card's sheen is still about 3% lighter at
                 the tail's height (29px down), so the tail takes that
                 step and no seam shows where it meets the bubble. */
              `-left-[7px] top-[22px] border-b border-l ${plum ? "" : "dark:bg-[color-mix(in_srgb,var(--color-raised),#fff_3%)]"}`
        }`}
      />
    </div>
  );
}
