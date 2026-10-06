"use client";

import Link from "next/link";
import { useState } from "react";
import { ACTION_CLASS } from "@/lib/ui";
import { TipLine } from "@/components/rep/TipStrip";
import { repHref } from "@/lib/rep-config";
import { IconShuffle, IconSliders } from "@/components/Icon";
import { TraitChip } from "@/components/TraitChip";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Chosen } from "@/lib/next-practice";

/**
 * The first card on Today: the floor, handed over (DECISIONS #268).
 *
 * The one it replaces had six defects, three of look and three of
 * sense, and the three of sense were one structural fault: the title
 * came from `nextLesson` (a position on the fixed road) and the reason
 * from `nextFocus` (the weakest entry in `SKILLS`), two independent
 * calculations over two different trait vocabularies. So it said "Move
 * the pace" above "Range scored 58/100" and named a different trait in
 * each. This card takes ONE `Chosen` and reads everything off it, which
 * makes that mismatch unrepresentable rather than merely fixed.
 *
 * WHAT IS THE HERO, and why it is not the number. The five trait
 * numbers are already on this screen, in five cards below, each with
 * its ring. A bigger copy of the first of them is a duplicate, not a
 * headline. What is NOT anywhere else is the thing you are about to do,
 * so the prompt is the hero: the sentence you will actually speak
 * about. The number is the REASON, at caption weight, once.
 *
 * WHAT THE BUTTON SAYS. "Start", every time (#317; "Take the floor"
 * read as cringe on a button). It used to drop to "Go again" on a day
 * already spoken on, which framed a second recording as a repeat of the
 * first: the one reading this card should never have. The eyebrow above
 * it already carries that difference (the trait's chip, then "One
 * more" against "Today's practice"), so the button does not have to.
 *
 * The terms line that used to sit above the button is gone with it.
 * COPY-RULES had already ruled on that one: default to no explanation,
 * and "if a string exists to justify a design decision to the user, cut
 * it". What it explained, a prompt, a length and five numbers, is what
 * the next screen does, in order, thirty seconds later.
 *
 * WHERE DEMOS IS. Not here. He was on his own line jammed to the right
 * edge between the text and the button, which is the definition of
 * furniture, and DESIGN.md asks for an arrival instead. He keeps the
 * empty states and the celebrations.
 */
/** Placeholders in the card's own warm edge, not the grey trough. */
const WARM = "!bg-[color:var(--rec-topic-edge)]";
/** A bare glyph button: 20px of mark in a 44px hit area, no fill. */
const GLYPH =
  "press grid size-11 place-items-center rounded-control transition-colors dur-fast ease-out";

export function FloorCard({
  chosen,
  dayOne,
  dayOnePrompt,
  dayOneNote,
  again,
  href,
  mods,
  onSpin,
  onMods,
  modsOpen = false,
  loading = false,
}: {
  /** Null on day one and on any day with nothing measured yet. */
  chosen: Chosen | null;
  dayOne: boolean;
  /** The first lesson's own prompt, so card and recorder agree. */
  dayOnePrompt?: string;
  /** What they said they notice, in their words (#231). */
  dayOneNote?: string;
  /** Already spoke today. The offer stands, the framing changes. */
  again: boolean;
  /** Day one and the unit-intro gate still own the destination. */
  href?: string;
  mods?: string[];
  /** The roulette and the mods, as two bare glyphs in the top-right corner. */
  onSpin?: () => void;
  onMods?: () => void;
  modsOpen?: boolean;
  /**
   * The history read is in flight (today-2). Nothing on the card is
   * known yet: not the trait, not the prompt, not the tactic. The slots
   * hold their exact height instead of painting a fallback prompt that
   * swaps out and a tip row that pushes the screen 56px down. Start
   * stays the one tap and stays live: an early tap goes to the recorder.
   */
  loading?: boolean;
}) {
  const to =
    href ?? repHref({ topic: chosen?.item.topicId, mods });

  /*
   * The trait is named in EVERY state that has one. The first pass put
   * it in the eyebrow only on an ordinary day, so the "already spoke
   * today" card read "ONE MORE" and then named no trait anywhere,
   * which is the same one-name-for-one-thing failure from the other
   * side: the card quoted a number in a unit and never said whose.
   */
  const lead = dayOne ? "Your first recording" : again ? "One more" : "Today's practice";
  /*
   * Content that replaces a skeleton lands with `.arrive` (PRINCIPLES
   * 8), the same fade the line and the clean run under it land with.
   * Only when this card mounted loading: back from the roulette it
   * mounts loaded and its wrapper already rises (`arrive-lift`), and
   * two entrances on one tap is one too many.
   */
  const [fromSkeleton] = useState(loading);
  const lands = fromSkeleton ? "arrive" : "";

  /*
   * DAY ONE IS ITS OWN SHAPE. There is no measurement to choose from,
   * so nothing can be the reason, and the card says so rather than
   * inventing one. The headline is the day, the prompt drops to the
   * body line, and the reason slot carries what THEY said they notice,
   * in their own words (#231). Losing that was the first thing the
   * eleven-screen walk caught when this card replaced the old one.
   */
  const hero = dayOne
    ? "Day one starts today."
    : (chosen?.item.prompt ?? "Say what you think about the last thing you read.");

  const body = dayOne
    ? dayOnePrompt
    : chosen
      ? chosen.item.tips[0]
      : undefined;


  return (
    /* The same warm ground as the recording screen's topic card
       (feedback round, 25 Sep: "pop with colour"), so the card you tap
       and the screen it opens are visibly one thing. Still the ONE
       lifted object on Today. */
    <div className="topic-card topic-card-lift rounded-sheet p-5">
      {/* The trait is named by its chip (M04, M11, today-16): the solid
          tone with its own ink, the one pill that names a trait where
          traits mix. It replaced "ONE MORE · ● PAUSING", two ideas in
          tracked caps joined by a middot and a dot in two colours. The
          lead follows it in the card's amber, sentence case. The row is
          the chip's 22px whether or not there is a chip, and the
          skeleton holds the same 22px while the read is in flight.

          Spin and difficulty sit at the row's far end (round 2, M04;
          they stood beside Start as two 52px squares, #317): bare 20px
          glyphs in stone-500, ink while a mod is on, each a 44px hit
          area whose extra 12px is a negative margin, so the row keeps
          its 22px, the right glyph lines up with the text's edge, and
          "Today's practice" beside a chip still fits at 320px.
          They paint at once, loading or not, because neither waits on
          the read. */}
      <div className="flex min-h-[22px] items-center gap-2">
        {loading ? (
          <span className="flex min-w-0 flex-1">
            <Skeleton className={`h-2.5 w-32 ${WARM}`} />
          </span>
        ) : (
          <span className={`flex min-w-0 flex-1 items-center gap-2 ${lands}`}>
            {chosen && !dayOne && <TraitChip trait={chosen.trait} size="sm" />}
            <span className="eyebrow text-[color:var(--rec-amber-ink)]">{lead}</span>
          </span>
        )}
        {(onSpin || onMods) && (
          <span className="-mx-3 -my-3 flex shrink-0">
            {onSpin && (
              <button
                type="button"
                onClick={onSpin}
                aria-label="Spin a new topic"
                className={`${GLYPH} text-stone-500`}
              >
                <IconShuffle size={20} />
              </button>
            )}
            {onMods && (
              <button
                type="button"
                onClick={onMods}
                aria-label={modsOpen ? "Hide difficulty" : "Turn up the difficulty"}
                aria-expanded={modsOpen}
                className={`${GLYPH} ${
                  (mods?.length ?? 0) > 0 || modsOpen ? "text-ink" : "text-stone-500"
                }`}
              >
                <span className="relative flex">
                  <IconSliders size={20} />
                  {/* How many mods are on, as a count on the glyph's
                      corner: ink, the type scale's 10px suffix. */}
                  {(mods?.length ?? 0) > 0 && (
                    <span className="font-display absolute -right-3 -top-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-suffix font-extrabold leading-none text-ground tabular-nums">
                      {mods!.length}
                    </span>
                  )}
                </span>
              </button>
            )}
          </span>
        )}
      </div>

      {/* The prompt is the hero. While loading, two lines of the hero's
          own type hold its height (a two-line prompt is the usual one),
          each with a bar where the words will be. */}
      {loading ? (
        <div aria-hidden className="font-display mt-2.5 text-title leading-tight">
          <span className="relative block">
            <span className="invisible">Ag</span>
            <Skeleton className={`absolute inset-y-[2px] left-0 w-full ${WARM}`} />
          </span>
          <span className="relative block">
            <span className="invisible">Ag</span>
            <Skeleton className={`absolute inset-y-[2px] left-0 w-2/3 ${WARM}`} />
          </span>
        </div>
      ) : (
        <h2 className={`font-display mt-2.5 text-title leading-tight ${lands}`}>
          {hero}
        </h2>
      )}

      {/*
       * ONE instruction, and not the angle's title with it. The title
       * ("End, then wait") is how the path names this practice to
       * itself; printed in front of the tip it read as the first
       * clause of the sentence and made a three line paragraph out of
       * what should be one line of technique.
       */}
      {/* Day one's body is the topic, a sentence to read. Every other
          day it is a tactic, and a tactic shows as its five words and a
          glyph with the sentence one tap away (feedback round, 25 Sep:
          the full sentence in grey was the part nobody read). */}
      {loading ? (
        <div aria-hidden className="mt-3 min-h-11" />
      ) : (
        body && !dayOne && <TipLine tip={body} className={`mt-3 ${lands}`} />
      )}

      {/* Less to read (26 Sep): the topic labels, the why paragraph and
          the two text links under the card went. "Take the floor" read
          as cringe on a button, so it says what it does. Start has the
          card's full width in a row of its own (round 2, M04): the one
          tap, with nothing beside it to share its weight. */}
      <Link href={to} className={`${ACTION_CLASS} mt-5 w-full`}>
        Start
      </Link>
    </div>
  );
}
