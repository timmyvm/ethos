"use client";

import { IconCheck, IconFlag } from "@/components/Icon";
import { Ring } from "@/components/Ring";
import { Skeleton } from "@/components/ui/Skeleton";
import { TRAIT } from "@/content/traits";
import {
  challengeFoot,
  challengeLine,
  type Challenge,
} from "@/lib/challenge";

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
 * 56px, the wide trait tile's size and under the clean run's 96: the line
 * states one number and must not outweigh the floor's button at the
 * squint test's 7px blur. The ring carries no number of its own
 * (today-7): the sentence beside it prints today's value with its unit,
 * and the same 1.8 twice, 24px apart and neither with a unit, was one
 * number said twice and explained never.
 *
 * No aside on the head (today-8). "Pausing" right-aligned in its tone
 * read as iOS's See All link on a div that did nothing; the name sits
 * over the sentence instead, in its tone, where it labels the number.
 *
 * THE MATERIAL (round 2, M12). The line is a statement, not a tap, so
 * it has no card: the ring and its lines sit on the ground under the
 * section head, the way Imprint's home sets what it says on the page
 * and keeps a card for what you press. It wore its trait's wash with an
 * inset tone ring (#312), which made it a second coloured slab between
 * the floor card and the clean run. The tone is on the ring's arc and
 * the trait's name, nothing else; the name is said because the wash
 * that used to say which trait went (PRINCIPLES 6). The ring left
 * terracotta in the colour pass and stays out of it: a terracotta ring
 * under a terracotta button was a second tap's colour.
 *
 * THE TRACK (6 Oct). The ring's unfilled part is its trait's tone at
 * 22% on the ground, not the grey sand trough the tiles use. Its full
 * circle IS the line (`value` reaches 1 exactly when today clears it),
 * so before today's recording the ring is the line still to close:
 * Pausing's ring in Pausing's colour with a flag at its centre, the
 * way an activity ring waits; the check replaces the flag on close.
 * On sand it was an empty grey circle, the weakest thing on Today. The
 * skeleton keeps sand, because there the number is unknown, not open.
 * Every arc clears 3:1 on its tint in both themes (today-colour.test).
 *
 * NO BUTTON. The one tap on this screen belongs to the floor card.
 */
export const LINE_TRACK = "color-mix(in srgb, var(--tone) 22%, var(--color-ground))";

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const c = challenge;
  return (
    <section className="mt-7">
      <h2 className="section-head">Today&apos;s line</h2>
      {/* The row holds two lines of the sentence whichever state it is
          in (min-h-20, centred), so the open day's one line and the
          closed day's two land in the same slot as the skeleton. */}
      <div data-trait={c.trait} className="today-trait mt-3 flex min-h-20 items-center gap-4">
        <Ring
          value={c.value}
          size={56}
          tone="trait"
          track={LINE_TRACK}
          delay={240}
          state={c.closed ? "closing" : "idle"}
        >
          {/* The ring's centre says where the line stands, with a mark
              rather than the number the sentence already prints: a
              flag while today is open (the line still to clear), a
              check once today's recording closes it, and nothing in
              between, where the arc itself is the reading. */}
          {c.closed ? (
            <span className="tone-ink">
              <IconCheck size={22} />
            </span>
          ) : c.today === null ? (
            <span className="tone-ink">
              <IconFlag size={20} />
            </span>
          ) : undefined}
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="eyebrow tone-ink">{TRAIT[c.trait].name}</p>
          <p className="font-display text-body font-bold leading-snug text-balance">
            {challengeLine(c)}
          </p>
          {/*
           * The same sentence whether it closed or not. On a miss the
           * number is what does the attributing (§5 row 12): it says
           * "this is the kind of day you usually have" without a
           * second person anywhere in it, and without the word
           * "missed".
           */}
          <p className="mt-0.5 text-caption text-pretty text-stone-500">
            {challengeFoot(c)}
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Today's line while the history read is in flight (today-4): the head
 * and the card at their measured heights, so the line lands in its own
 * slot and nothing under it moves. Collapses only for somebody with
 * under three readings in the window, who gets no line at all.
 */
export function SkeletonChallenge() {
  return (
    <div aria-hidden className="mt-7">
      <div className="flex h-6 items-center">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="mt-3 flex min-h-20 items-center gap-4">
        <div className="size-14 shrink-0 rounded-full border-[5px] border-sand" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-2 h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}
