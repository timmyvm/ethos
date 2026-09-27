"use client";

import { Ring } from "@/components/Ring";
import { TRAIT } from "@/content/traits";
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
 * The ring is a loop still closable TODAY, which is the whole
 * difference between this and the five rings below it: a percentile has
 * no closed state and this does. It wore `tone="open"` (terracotta,
 * #252) until the colour pass; see below.
 *
 * 48px, under the trait rows' 50 and the clean run's 104: this card
 * states one number and must not outweigh the floor's button at the
 * squint test's 7px blur.
 *
 * THE COLOUR (the colour pass, 26 Sep). The line is drawn in one
 * trait's unit, so the card wears that trait's tone: its wash as the
 * ground, its ink on the ring and the name, the same colour the trait
 * has on /lessons and in the rows below. The ring left terracotta
 * (#252's `open`) in the same pass: a terracotta ring under a
 * terracotta button was the second orange object on the screen, and
 * the tone says which trait without a second tap's colour.
 *
 * NO BUTTON. The one tap on this screen belongs to the floor card. This
 * card states a number and gets out of the way, which is also why it is
 * `elev-1` under the floor's `elev-2`.
 */
export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const c = challenge;
  return (
    <section className="mt-7" data-trait={c.trait}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="section-head">Today&apos;s line</h2>
        <div className="section-head-aside tone-ink">{TRAIT[c.trait].name}</div>
      </div>
      <div className="today-line tone-wash mt-3 rounded-card p-4">
        <div className="flex items-center gap-4">
          <Ring
            value={c.value}
            size={48}
            tone="trait"
            track="var(--today-trough)"
            delay={240}
            state={c.closed ? "closing" : "idle"}
          >
            {c.today !== null && (
              <span className="font-display tone-ink text-[13px] font-extrabold leading-none tabular-nums">
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
            <p className="tone-ink mt-1 text-caption">
              {challengeFoot(c)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
