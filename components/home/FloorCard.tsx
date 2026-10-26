"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ACTION_CLASS } from "@/lib/ui";
import { DemosArt } from "@/components/DemosArt";
import { TipLine } from "@/components/rep/TipStrip";
import { repHref } from "@/lib/rep-config";
import { IconShuffle, IconSliders } from "@/components/Icon";
import { HeroStage, StageChip } from "@/components/ui/HeroStage";
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
 * WHERE DEMOS IS. On the stage, since the cohesion pass (26 Oct). He
 * left this card when he stood on his own line jammed to the right edge
 * between the text and the button, which is the definition of
 * furniture. The hero stage gives him a floor: he stands at its right
 * holding the mic, the way he holds the clock on Practice's stage, and
 * he springs in on the first visit of the day only, so a tab you come
 * back to is not a moment. Day one he waves.
 *
 * THE MATERIAL (the cohesion pass). The card is the house stage
 * (`HeroStage`), the same sky as Practice's, not the recording flow's
 * amber: a first-time tester read Today's amber card, blue ring, sage
 * run and five tones as "everything competes". Start stands on the
 * ground under the stage at its width, as on Practice: the one tap.
 */
/** A bare glyph button: 20px of mark in a 44px hit area, no fill. */
const GLYPH =
  "press grid size-11 place-items-center rounded-control transition-colors dur-fast ease-out";
/** The day this device last welcomed Demos onto Today's stage. */
const SEEN_KEY = "ethos.today.demosSeen";

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

  /* Demos springs onto the stage on the first visit of the day and
     stands still after that (Practice's rule, by the day rather than the
     week). Null until read, so he never pops in late over a still frame. */
  const [arrive, setArrive] = useState<boolean | null>(null);
  useEffect(() => {
    const day = new Date().toDateString();
    let first = true;
    try {
      first = localStorage.getItem(SEEN_KEY) !== day;
      localStorage.setItem(SEEN_KEY, day);
    } catch {
      /* No storage: every visit is the first. */
    }
    setArrive(first);
  }, []);

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

  /* The trait leads the eyebrow on its stage chip (the trait's 8px mark
     and its name in the stage ink), then the lead. The row is the chip's
     22px whether or not there is a chip, and the skeleton holds the same
     22px while the read is in flight. It runs to the corner's glyphs
     rather than wrapping in the words' 60%. */
  const eyebrow = (
    <div className="flex min-h-[22px] items-center">
      {loading ? (
        <Skeleton className="h-2.5 w-32" />
      ) : (
        <span className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 ${lands}`}>
          {chosen && !dayOne && <StageChip trait={chosen.trait} />}
          <span className="eyebrow stage-ink">{lead}</span>
        </span>
      )}
    </div>
  );

  /* Spin and difficulty (round 2, M04): bare 20px glyphs in the stage's
     ink at the stage's top-right corner, each a 44px hit area. They
     paint at once, loading or not, because neither waits on the read. */
  const corner = (onSpin || onMods) && (
    <>
      {onSpin && (
        <button
          type="button"
          onClick={onSpin}
          aria-label="Spin a new topic"
          className={`${GLYPH} stage-ink`}
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
          className={`${GLYPH} ${(mods?.length ?? 0) > 0 || modsOpen ? "text-ink" : "stage-ink"}`}
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
    </>
  );

  return (
    <>
      <HeroStage
        eyebrow={eyebrow}
        eyebrowWide
        corner={corner}
        /* The prompt runs to three lines in the words' 60%, and the
           corner's glyphs need his head clear of them: a 196px floor. */
        minHeight={196}
        art={
          arrive !== null && (
            <DemosArt
              pose={dayOne ? "wave" : "mic"}
              size={132}
              pop={arrive}
              grounded
              halo={{ tone: "sky", kind: "stage" }}
            />
          )
        }
        line={
          /*
           * ONE instruction, and not the angle's title with it. Day
           * one's body is the topic, a sentence to read, and stays off
           * the stage; every other day it is a tactic, its five words
           * and a glyph with the sentence one tap away (feedback round,
           * 25 Sep). While loading its 44px is held.
           */
          loading ? (
            <div aria-hidden className="mt-auto min-h-11 pt-3" />
          ) : body && !dayOne ? (
            <TipLine tip={body} compact className={`mt-auto pt-3 ${lands}`} />
          ) : undefined
        }
      >
        {/* The prompt is the hero. While loading, two lines of the hero's
            own type hold its height, each with a bar where the words will
            be. */}
        {loading ? (
          <div aria-hidden className="font-display mt-2.5 text-title leading-tight">
            <span className="relative block">
              <span className="invisible">Ag</span>
              <Skeleton className="absolute inset-y-[2px] left-0 w-full" />
            </span>
            <span className="relative block">
              <span className="invisible">Ag</span>
              <Skeleton className="absolute inset-y-[2px] left-0 w-2/3" />
            </span>
          </div>
        ) : (
          <h2 className={`font-display mt-2.5 text-title font-extrabold leading-tight text-balance ${lands}`}>
            {hero}
          </h2>
        )}
      </HeroStage>

      {/* The one tap, on the ground under the stage at its width, as on
          Practice (the cohesion pass). "Start", every time (#317). */}
      <Link href={to} className={`${ACTION_CLASS} mt-3`}>
        Start
      </Link>
    </>
  );
}
