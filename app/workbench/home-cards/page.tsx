"use client";

import {
  CardCleanRun,
  CardStanding,
  CardTell,
} from "@/components/home/HomeCards";

/**
 * The workbench (DECISIONS #255): where a choice between designs gets
 * made by looking at all of them at once, at the width they ship at.
 *
 * Not linked from anywhere and not in the nav. It exists because the
 * alternative — building one, screenshotting it, replacing it, building
 * the next — compares each option against a memory of the last one, and
 * a memory of a card is not a card.
 *
 * The numbers are fixed and fictional, and identical across the three,
 * so what differs between them is the METRIC rather than the luck of
 * the data.
 */
export default function HomeCards() {
  return (
    <main className="mx-auto max-w-[390px] px-5 pb-28 pt-8">
      <h1 className="label-data">The first card, three ways</h1>

      <div className="mt-6 space-y-8">
        <Option
          letter="A"
          name="The standing"
          note="A position among people. Understandable instantly, but it is a composite: five traits rolled into one figure is the Ethos Index wearing a friendlier unit, and it hides which number moved."
        >
          <CardStanding percentile={62} movedTrait="Pausing" movedBy={14} />
        </Option>

        <Option
          letter="B"
          name="The clean run"
          note="A duration. Seconds are the only speech unit a body already owns, it is one trait rather than a blend, and it is a personal best rather than a rank. It moves in lumps: one stray um at second 31 halves it."
        >
          <CardCleanRun seconds={41} best={47} bestWhen="Tuesday" />
        </Option>

        <Option
          letter="C"
          name="The tell"
          note="A rate, turned into the gap between. A rhythm is something you can hear yourself doing. It also leads with the thing you are worst at, every day, which is the one of the three that could read as a scold."
        >
          <CardTell word="um" gapS={14} wasGapS={9} />
        </Option>
      </div>
    </main>
  );
}

function Option({
  letter,
  name,
  note,
  children,
}: {
  letter: string;
  name: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-display text-[15px] font-extrabold text-terracotta-700">
          {letter}
        </span>
        <span className="font-display text-[15px] font-bold">{name}</span>
      </div>
      {children}
      <p className="mt-2.5 text-caption leading-relaxed text-stone-500">{note}</p>
    </section>
  );
}
