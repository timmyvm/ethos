"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type CSSProperties } from "react";
import { IconShuffle, IconSliders } from "@/components/Icon";
import { Reel, useReel } from "@/components/Reel";
import { TipLine } from "@/components/rep/TipStrip";
import { StageChip } from "@/components/ui/HeroStage";
import { Skeleton } from "@/components/ui/Skeleton";
import type { TraitId } from "@/content/traits";
import { artBox, objectSrc } from "@/lib/home";
import { spinForAnswers } from "@/lib/portfolio";
import { TOPIC_SHAPES, type Topic } from "@/lib/topics";

/** The roulette, run inside the card (#393's fix round). */
export interface HeroRoulette {
  topic: Topic;
  onSpin: (t: Topic) => void;
  onTake: (t: Topic) => void;
  /** The heading focus moves to when the roulette opens. */
  headRef: React.Ref<HTMLHeadingElement>;
}

/**
 * Today's practice, "the object" (#393; direction B, Timothy's pick of
 * the two the home round built on the workbench).
 *
 * "They have beautiful home pages. We have a card with a panda." The
 * references (docs/refs/home/) open on one tall colour card with a real
 * object in it, ToyCad's chick rising out of its tile. So the floor is
 * that card: the trait's own colour family lit from the top, the
 * practice's lead, its trait and its tactic beside the object, the
 * topic huge, and the one tap with spin and difficulty beside it. The
 * object is the glass render of the lesson that teaches the tactic on
 * the card (lib/home.ts), and it breaks out of the card's top-right
 * corner: the one picture on the screen that leaves its frame.
 *
 * The object is sized and stood by the box its visible pixels fill
 * (`artBox`, lib/lesson-art-bounds.ts), inside the card's object zone
 * (`.home-hero`): its top rises the same distance out of the card for
 * the hourglass and the boomerang alike, and it keeps 12px clear of the
 * words' column. The words' column holds the zone's height, so the
 * topic always starts under the object.
 *
 * Demos is not on it. He stood here holding a mic every day, which is
 * furniture; he comes back for moments (the price drop's sheet, a
 * result, a milestone).
 *
 * The card is the screen's one lifted thing (its own shadow in its
 * family's colour, `.home-hero`), and Start is the screen's one
 * terracotta, a pill like every tap (D11). Every slot holds its height
 * while the read is in flight, on a neutral card, because the trait and
 * so the colour are not known yet; Start and the two glyphs stay live,
 * as they always have: an early tap goes to the recorder.
 *
 * The roulette runs in the same card, in the same colour with the same
 * object: the topic spins where the topic was and the pill takes it.
 */
export function HomeHero({
  loading,
  family,
  lead,
  trait,
  tip,
  title,
  object,
  href,
  mods,
  onSpin,
  spinRef,
  onMods,
  modsOpen,
  roulette,
}: {
  /** The history read is in flight: no colour, no object, no words yet. */
  loading: boolean;
  /** The colour family: the practice's trait, or Pausing's blue (the house's) with none. */
  family: TraitId;
  /** "Today's practice", "One more" or "Your first recording". */
  lead: string;
  /** The trait the practice works on; null on day one and on a failed read. */
  trait: TraitId | null;
  /** The tactic, five words on the card with the sentence a tap away. */
  tip: string | null;
  /** The topic, or day one's headline. */
  title: string;
  /** The lesson whose glass object stands on the card. */
  object: string;
  href: string;
  mods: string[];
  onSpin: () => void;
  spinRef?: React.Ref<HTMLButtonElement>;
  onMods: () => void;
  modsOpen: boolean;
  /** Set while the roulette has the card. */
  roulette?: HeroRoulette | null;
}) {
  /* Words that replace a skeleton land (principle 8); a card that
     mounted with its words (back from the roulette) does not land twice. */
  const [fromSkeleton] = useState(loading);
  const lands = fromSkeleton ? "arrive" : "";
  /* The tactic's sentence is the card's, not the column's: it lays
     across the card's width under the object rather than in a six-line
     column beside it. */
  const [tipOpen, setTipOpen] = useState(false);
  const tipPanel = "home-tactic-tip";

  return (
    <section aria-labelledby={roulette ? "home-roulette" : "home-topic"} className="mt-6">
      <div
        data-family={loading ? "none" : family}
        className="home-hero"
        style={loading ? undefined : (artBox(object) as CSSProperties)}
      >
        {!loading && (
          <>
            <span aria-hidden className="home-hero-pool" />
            <HeroObject key={object} id={object} />
          </>
        )}

        {roulette ? (
          <RouletteBody key="roulette" {...roulette} />
        ) : (
          <>
            {/* Beside the object: what today is, the trait, the tactic. */}
            <div className="home-hero-words relative flex flex-col items-start gap-2">
              {loading ? (
                <div aria-hidden className="flex w-full flex-col items-start gap-2">
                  <span className="flex h-[18px] items-center">
                    <Skeleton className="h-2.5 w-24" />
                  </span>
                  <Skeleton className="h-[22px] w-20" rounded="rounded-full" />
                  <span className="flex h-11 w-full items-center">
                    <Skeleton className="h-3 w-full" />
                  </span>
                </div>
              ) : (
                <div className={`flex w-full flex-col items-start gap-2 ${lands}`}>
                  <span className="home-hero-lead">{lead}</span>
                  {trait && <StageChip trait={trait} />}
                  {tip && (
                    <TipLine
                      tip={tip}
                      compact
                      className="w-full"
                      open={tipOpen}
                      onOpenChange={setTipOpen}
                      panelId={tipPanel}
                    />
                  )}
                </div>
              )}
            </div>

            {/* The tactic's sentence, under the object, the card's width. */}
            <div id={tipPanel} aria-live="polite" className="relative">
              {tip && tipOpen && <p className="home-hero-tip reveal">{tip}</p>}
            </div>

            {loading ? (
              <div aria-hidden className="home-display relative mt-auto pt-6">
                {["w-full", "w-11/12", "w-1/2"].map((w, i) => (
                  <span key={i} className="relative block">
                    <span className="invisible">Ag</span>
                    <Skeleton className={`absolute inset-y-[6px] left-0 ${w}`} />
                  </span>
                ))}
              </div>
            ) : (
              <h2
                id="home-topic"
                className={`home-display relative mt-auto pt-6 ${lands}`}
                data-long={title.length > 40 || undefined}
              >
                {title}
              </h2>
            )}

            {/* The one tap, then spin and difficulty: 48px each, on the card. */}
            <div className="relative mt-5 flex items-center gap-2">
              <Link href={href} className="home-start press">
                Start
              </Link>
              <button
                ref={spinRef}
                type="button"
                onClick={onSpin}
                aria-label="Spin a new topic"
                className="home-glyph press"
              >
                <IconShuffle size={20} />
              </button>
              <button
                type="button"
                onClick={onMods}
                aria-label={modsOpen ? "Hide difficulty" : "Turn up the difficulty"}
                aria-expanded={modsOpen}
                className="home-glyph press"
              >
                <IconSliders size={20} />
                {/* How many mods are on, on the glyph's corner. */}
                {mods.length > 0 && (
                  <span className="home-glyph-count font-display text-suffix font-extrabold tabular-nums">
                    {mods.length}
                  </span>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * The roulette in the card (#242's motion, #393's fix round): the lead
 * says Roulette, the chip says the topic's shape (how to answer it),
 * the topic spins in the topic's place at the card's display size, and
 * the pill takes it. Spin again is the shuffle glyph that opened it.
 * The way back stays under the card, in the app's back grammar.
 */
function RouletteBody({ topic, onSpin, onTake, headRef }: HeroRoulette) {
  /* The wheel is components/Reel.tsx (#278), shared with the boss's. */
  const reel = useReel<Topic>({
    current: topic,
    draw: (exclude) => spinForAnswers(exclude),
    onLand: onSpin,
  });
  /*
   * The pill never waits on the wheel (D14): a tap mid-roll lands it on
   * the topic it already drew, on the snappy spring, and takes that one.
   * Taken once: a second tap, or the wheel's own stop in the same
   * moment, cannot start a second recording.
   */
  const taken = useRef(false);
  const take = () => {
    if (taken.current) return;
    reel.land((t) => {
      if (taken.current) return;
      taken.current = true;
      onTake(t);
    });
  };
  return (
    <>
      <div className="home-hero-words arrive relative flex flex-col items-start gap-2">
        <h2
          id="home-roulette"
          ref={headRef}
          tabIndex={-1}
          className="home-hero-lead outline-none!"
        >
          Roulette
        </h2>
        <span className="stage-chip font-display text-caption font-bold leading-none">
          {TOPIC_SHAPES[topic.shape].label}
        </span>
      </div>
      <Reel
        state={reel}
        current={topic}
        className="home-display home-reel relative mt-auto pt-6"
        render={(t) => (
          <span className="flex h-full items-end">
            <span className="block">{t.prompt}</span>
          </span>
        )}
      />
      <div className="relative mt-5 flex items-center gap-2">
        <button type="button" onClick={take} className="home-start press">
          Take this one
        </button>
        <button
          type="button"
          onClick={reel.spin}
          disabled={reel.rolling}
          aria-label="Spin again"
          className="home-glyph press disabled:opacity-60"
        >
          <IconShuffle size={20} />
        </button>
      </div>
    </>
  );
}

/**
 * The object fades up once its file has decoded, on the card's own
 * 300ms, so a picture that arrives after the card never cuts in; from
 * the cache it lands with the colour.
 */
function HeroObject({ id }: { id: string }) {
  const [loaded, setLoaded] = useState(false);
  /* A cached file can finish before React sees its load event. */
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={objectSrc(id, true)}
      alt=""
      width={260}
      height={260}
      onLoad={() => setLoaded(true)}
      data-loaded={loaded || undefined}
      className="home-hero-art"
      draggable={false}
    />
  );
}
