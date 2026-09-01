"use client";

import type { DayTrail as Trail, PebbleState } from "@/lib/days";

/**
 * The day counter and its trail, sitting inside the score card on home.
 *
 * Deliberately not a third card: DECISIONS #9 gives the floor the screen
 * and brand.md allows one tap, so this earns its place by living in
 * furniture that already exists. One square bar per recent day — the
 * Instrument reading of a training log (#201, replacing #168's
 * pebbles): a spoken day is a lit bar, a frozen day an outline, a
 * missed day barely registers, and today stands taller with an offset
 * outline. Nothing here is a tap.
 *
 * It gets better with time by construction. One day is a mark, fourteen
 * is a shape you can read at a glance — the reward for staying is that
 * the thing on your home screen becomes more worth looking at.
 */
export function DayTrail({
  trail,
  pebbles,
}: {
  trail: Trail;
  pebbles: PebbleState[];
}) {
  if (trail.count === 0) return null;

  const spoken = pebbles.filter((p) => p === "spoken").length;
  const frozen = pebbles.filter((p) => p === "frozen").length;

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-cream/10 pt-3.5">
      {pebbles.length > 0 && (
        <div
          className="flex items-center gap-[5px]"
          role="img"
          aria-label={`Last ${pebbles.length} days: ${spoken} spoken${
            frozen > 0 ? `, ${frozen} frozen` : ""
          }`}
        >
          {pebbles.map((p, i) => {
            const today = i === pebbles.length - 1;
            return (
              <span
                key={i}
                className={`w-2 shrink-0 ${
                  today ? "h-[22px] outline outline-1 outline-offset-2" : "h-4"
                } ${
                  p === "spoken"
                    ? "bg-sage-lit outline-sage-lit"
                    : p === "frozen"
                      ? "border border-sage-lit outline-sage-lit"
                      : "bg-cream/15 outline-cream/25"
                }`}
              />
            );
          })}
        </div>
      )}
      <p className="shrink-0 text-right text-[12px] text-sage-mist">
        Day {trail.count} of speaking
        {/* Only when earned, and only for something the card above
            doesn't already say (#95). */}
        {trail.bestYet && " · best day yet"}
      </p>
    </div>
  );
}
