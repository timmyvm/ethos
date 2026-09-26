"use client";

import Link from "next/link";
import { TRAIT } from "@/content/traits";
import { ACTION_CLASS } from "@/lib/ui";
import { TipLine } from "@/components/rep/TipStrip";
import { repHref } from "@/lib/rep-config";
import { IconShuffle, IconSliders } from "@/components/Icon";
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
 * WHAT THE BUTTON SAYS. "Take the floor" is the brand's phrase and it
 * says it every time (#276). It used to drop to "Go again" on a day
 * already spoken on, which framed a second recording as a repeat of the
 * first: the one reading this card should never have. The eyebrow above
 * it already carries that difference ("One more, Pausing" against
 * "Today's practice, Pausing"), so the button does not have to,
 * and the app's own phrase stops having a second-class variant.
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
  /** The roulette and the mods, as two icon buttons beside the tap. */
  onSpin?: () => void;
  onMods?: () => void;
  modsOpen?: boolean;
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
  const eyebrow =
    chosen && !dayOne ? `${lead} · ${TRAIT[chosen.trait].name}` : lead;

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
      {/* The trait's name wears its tone (the colour pass): the same
          blue, lagoon, jade or ochre as today's line and the row below, so
          the three places that name it read as one thing. The dot
          carries it where the ink cannot: the ochre's ink is 1.4:1
          from this card's own amber eyebrow. */}
      <div className="label-data topic-eyebrow">
        {chosen && !dayOne ? (
          <>
            {lead} ·{" "}
            <span data-trait={chosen.trait} className="tone-ink">
              <span aria-hidden className="today-dot" />
              {TRAIT[chosen.trait].name}
            </span>
          </>
        ) : (
          eyebrow
        )}
      </div>

      {/* Three kinds of content in one card, each named (#293): the
          topic, the technique, the reason. Without the cues a prompt
          read as an article title and a technique as its standfirst. */}
      <h2 className="font-display mt-2.5 text-title leading-tight">
        {hero}
      </h2>

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
      {body && !dayOne && (
        <>
          <TipLine tip={body} className="mt-3" />
        </>
      )}

      {/* Less to read (26 Sep): the topic labels, the why paragraph and
          the two text links under the card went. The why is Today's
          line and the trait tiles below; spin and difficulty are the
          two marks beside the tap. "Take the floor" read as cringe on
          a button, so it says what it does. */}
      <div className="mt-5 flex gap-2">
        <Link href={to} className={`${ACTION_CLASS} flex-1`}>
          Start
        </Link>
        {onSpin && (
          <button
            type="button"
            onClick={onSpin}
            aria-label="Spin a new topic"
            className="press floor-side"
          >
            <IconShuffle size={22} />
          </button>
        )}
        {onMods && (
          <button
            type="button"
            onClick={onMods}
            aria-label={modsOpen ? "Hide difficulty" : "Turn up the difficulty"}
            aria-expanded={modsOpen}
            data-on={(mods?.length ?? 0) > 0 || modsOpen || undefined}
            className="press floor-side relative"
          >
            <IconSliders size={22} />
            {(mods?.length ?? 0) > 0 && (
              <span className="floor-side-count">{mods!.length}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
