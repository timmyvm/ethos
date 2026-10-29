"use client";

import Link from "next/link";
import { useState } from "react";
import { IconShuffle, IconSliders } from "@/components/Icon";
import { TipLine } from "@/components/rep/TipStrip";
import { StageChip } from "@/components/ui/HeroStage";
import { Skeleton } from "@/components/ui/Skeleton";
import type { TraitId } from "@/content/traits";
import { objectSrc } from "@/lib/home";

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
 * Demos is not on it. He stood here holding a mic every day, which is
 * furniture; he comes back for moments (the price drop's sheet, a
 * result, a milestone).
 *
 * The card is the screen's one lifted thing (its own shadow in its
 * family's colour, `.home-hero`), and Start is the screen's one
 * terracotta, now a pill (STATE's open experiment, "a pill primary is
 * worth one experiment"). Every slot holds its height while the read is
 * in flight, on a neutral card, because the trait and so the colour are
 * not known yet; Start and the two glyphs stay live, as they always
 * have: an early tap goes to the recorder.
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
}) {
  /* Words that replace a skeleton land (principle 8); a card that
     mounted with its words (back from the roulette) does not land twice. */
  const [fromSkeleton] = useState(loading);
  const lands = fromSkeleton ? "arrive" : "";

  return (
    <section aria-labelledby="home-topic" className="mt-6">
      <div data-family={loading ? "none" : family} className="home-hero">
        {!loading && (
          <>
            <span aria-hidden className="home-hero-pool" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={object}
              src={objectSrc(object, true)}
              alt=""
              width={260}
              height={260}
              className={`home-hero-art ${lands}`}
              draggable={false}
            />
          </>
        )}

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
              {tip && <TipLine tip={tip} compact className="w-full" />}
            </div>
          )}
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
      </div>
    </section>
  );
}
