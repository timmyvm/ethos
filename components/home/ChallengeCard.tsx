"use client";

import { Ring } from "@/components/Ring";
import {
  challengeFoot,
  challengeLine,
  type Challenge,
} from "@/lib/challenge";
import { fmtRaw } from "@/lib/trait-readings";

/**
 * Today's line (DECISIONS #281).
 *
 * The behaviour channel's one target, sitting with the streak and the
 * day trail and never inside the trait strip. `docs/closure.md` §5 row 2
 * is "two channels, never merged": the trait cards are the outcome
 * channel and this is not, so nothing here is a percentile, a rank, or
 * a comparison with anybody else. The number is one of the user's own,
 * in the trait's own unit.
 *
 * The ring wears `tone="open"` — terracotta, the tone Ring.tsx reserved
 * for exactly this in #252 and that no caller had ever passed. Open
 * means a loop still closable TODAY, which is the whole difference
 * between this and the five rings below it: a percentile has no closed
 * state and this does.
 *
 * 44px, not the trait cards' 56 or the clean run's 104. Today already
 * carries a terracotta button and this is the second terracotta object
 * on the screen; the mass difference is what keeps the tap dominant at
 * the squint test's 7px blur.
 *
 * NO BUTTON. The one tap on this screen belongs to the floor card. This
 * card states a number and gets out of the way, which is also why it is
 * `elev-1` under the floor's `elev-2`.
 */
export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const c = challenge;
  return (
    <section className="mt-7">
      <div className="label-data">Today&apos;s line</div>
      <div className="elev-1 mt-3 rounded-card border border-card-edge bg-raised p-4">
        <div className="flex items-center gap-4">
          <Ring
            value={c.value}
            size={44}
            tone="open"
            delay={240}
            state={c.closed ? "closing" : "idle"}
          >
            {c.today !== null && (
              <span className="font-display text-[13px] font-extrabold leading-none tabular-nums">
                {fmtRaw(c.today)}
              </span>
            )}
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-bold leading-snug">
              {challengeLine(c)}
            </p>
            {/*
             * The same sentence whether it closed or not. On a miss the
             * number is what does the attributing (§5 row 12): it says
             * "this is the kind of day you usually have" without a
             * second person anywhere in it, and without the word
             * "missed".
             */}
            <p className="mt-1 text-caption text-stone-500">
              {challengeFoot(c)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
