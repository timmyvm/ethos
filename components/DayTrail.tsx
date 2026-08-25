"use client";

import type { DayTrail as Trail, PebbleState } from "@/lib/days";

/**
 * The day counter and its pebble trail, sitting inside the score card
 * on home.
 *
 * Deliberately not a third card: DECISIONS #9 gives the floor the screen
 * and brand.md allows one tap, so this earns its place by living in
 * furniture that already exists. One 14px pebble per recent day —
 * Demosthenes' training prop, the redesign's motif (DECISIONS #165):
 * a spoken day is a sage pebble, a frozen day is an outline, a missed
 * day barely registers. Sage because a spoken day is earned; nothing
 * here is a tap.
 *
 * It gets better with time by construction. One day is a dot, fourteen
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
    <div className="mt-4 border-t border-cream/10 pt-4">
      {pebbles.length > 0 && (
        <div
          className="flex items-center gap-[5px]"
          role="img"
          aria-label={`Last ${pebbles.length} days: ${spoken} spoken${
            frozen > 0 ? `, ${frozen} frozen` : ""
          }`}
        >
          {pebbles.map((p, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 shrink-0 rounded-full ${
                p === "spoken"
                  ? "bg-sage-500"
                  : p === "frozen"
                    ? "border-[1.5px] border-sage-mist"
                    : "bg-cream/15"
              }`}
            />
          ))}
        </div>
      )}
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="text-[11.5px] text-sage-mist">
          Day {trail.count} of speaking. The pebbles are adding up.
        </p>
        {/* Only when earned, and only for something the card above
            doesn't already say (#95). */}
        {trail.bestYet && (
          <span className="shrink-0 text-[12px] font-semibold text-sage-mist">
            best day yet
          </span>
        )}
      </div>
    </div>
  );
}
