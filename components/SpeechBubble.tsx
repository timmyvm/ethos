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
 * Raised paper on a card-edge hairline, the same material as every
 * card, rather than the results screen's terracotta wash: on a question
 * screen the chosen answer takes that wash (mechanic 6), and his voice
 * and your tap should not share a colour.
 *
 * The tail is a rotated square that carries the bubble's own hairline
 * on its two outer sides and covers the bubble's edge with its fill,
 * so the outline reads as one shape.
 */
export function SpeechBubble({
  tail,
  className = "",
  children,
}: {
  /** "down" for a bubble over his head, "left" for one beside him. */
  tail: "down" | "left";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative elev-1 rounded-card border border-card-edge bg-raised px-4 py-3.5 ${className}`}
    >
      {children}
      <span
        aria-hidden
        className={`absolute h-3.5 w-3.5 rotate-45 border-card-edge bg-raised ${
          tail === "down"
            ? "-bottom-[7px] left-1/2 -translate-x-1/2 border-b border-r"
            : "-left-[7px] top-[22px] border-b border-l"
        }`}
      />
    </div>
  );
}
