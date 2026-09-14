"use client";

import Link from "next/link";
import { TRAIT } from "@/content/traits";
import { ACTION_CLASS } from "@/lib/ui";
import { DAILY_MAX_SECONDS, repHref } from "@/lib/rep-config";
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
 * never said what the tap does. It now carries the two facts the tap
 * owes: that you are about to record, and for how long, read from
 * `DAILY_MAX_SECONDS` rather than typed, because an adversarial read of
 * four separate proposals for this card found every one of them had
 * written "60 seconds" onto a recorder that runs to ninety.
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
  const lead = dayOne ? "Day one" : again ? "One more" : "Today's practice";
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

  const reason = dayOne ? dayOneNote : chosen?.because;

  return (
    <div className="elev-2 rounded-sheet border border-card-edge bg-raised p-5">
      <div className="label-data">{eyebrow}</div>

      <h2 className="font-display mt-2.5 text-title leading-tight">{hero}</h2>

      {/*
       * ONE instruction, and not the angle's title with it. The title
       * ("End, then wait") is how the path names this practice to
       * itself; printed in front of the tip it read as the first
       * clause of the sentence and made a three line paragraph out of
       * what should be one line of technique.
       */}
      {body && <p className="mt-2 text-body text-stone-500">{body}</p>}

      {/*
       * The reason, in the trait's own unit, naming the SAME trait the
       * eyebrow does. `because` quotes the measurement rather than the
       * percentile while the scales are provisional, because the
       * measurement is the half that is known (docs/percentiles.md).
       */}
      {reason && (
        <p className="mt-3.5 border-t border-hairline pt-3 text-body leading-snug text-ink">
          {reason}
        </p>
      )}

      {/*
       * The terms, ABOVE the tap, because it is the last thing read
       * before the finger moves. "Take the floor" is the app's own
       * phrase (#9, opening the app is being handed the floor) and it
       * never said what the tap does; this says it, and the duration
       * comes from the recorder's own constant rather than being typed.
       * Four independent designs for this card all wrote "60 seconds"
       * onto a recorder that runs to ninety, and all twelve reviewers
       * caught it.
       */}
      <p className="mt-4 text-caption text-stone-400">
        A prompt, up to {DAILY_MAX_SECONDS} seconds of speaking, then your five
        numbers.
      </p>

      <Link href={to} className={`${ACTION_CLASS} mt-2.5`}>
        {again ? "Go again" : "Take the floor"}
      </Link>
    </div>
  );
}
