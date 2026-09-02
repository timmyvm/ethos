"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Paywall } from "@/components/Paywall";
import { fetchProfile } from "@/lib/client-data";
import { draw, GAMES, gameMultiplier, needsPremium, type Game } from "@/lib/games";
import { repHref } from "@/lib/rep-config";

/**
 * Games (DECISIONS #157) — Elevate's word for the same surface, and the
 * tab that took Path's slot when the merge finished (#155).
 *
 * Menu grammar follows the shop (#131): nothing here is terracotta,
 * because a menu is a room of doors and the price of walking through
 * one is a rep. The single tinted card is the weekly boss, which moved
 * here from home (#158) so the floor keeps its one moment and this tab
 * gets a reason to be opened weekly.
 *
 * Every row launches a REAL rep through the real engine. The question
 * is drawn on tap, not shown here: a cold open is the training, same
 * reason the roulette spins instead of listing.
 *
 * Type is the three roles (#208, #212): the screen name takes `title`,
 * every door's name takes `body` at 700, and every blurb takes
 * `caption`. This screen had five ad-hoc sizes between 11 and 24px, so
 * a door's name and its description differed by two points and the list
 * read as one grey block you scrolled past. The strings are unchanged —
 * they are already inside the budget, the widest at nine words.
 */
export default function GamesPage() {
  const router = useRouter();
  const [premium, setPremium] = useState(false);
  const [paywall, setPaywall] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => {});
  }, []);

  function play(g: Game) {
    if (needsPremium(g) && !premium) {
      setPaywall(`${g.name} · premium mods`);
      return;
    }
    router.push(repHref({ game: g.id, q: draw(g).id }));
  }

  return (
    <main className="px-5 pb-24 pt-7">
      <h1 className="font-display text-title">Tools</h1>

      {/* The one terracotta element on the screen: the weekly headliner,
          wearing the current-item border (#201), never a fill. */}
      <Link
        href="/boss"
        className="press mt-4 flex w-full items-center gap-3.5 rounded-[14px] border-[1.5px] border-terracotta-500 bg-raised p-4 text-left"
      >
        <Image
          src="/demos-workout.webp"
          alt=""
          width={92}
          height={92}
          className="demos w-[46px] shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="label-data block !text-terracotta-700">
            This week&apos;s boss
          </span>
          <span className="font-display mt-0.5 block text-body font-extrabold">
            Cold Topic
          </span>
          <span className="mt-0.5 block text-caption text-stone-500">
            A topic you&apos;ve never studied. 4 min research, 90s to explain,
            fact-checked.
          </span>
        </span>
        <span
          className="shrink-0 text-[16px] font-extrabold text-terracotta-700"
          aria-hidden
        >
          →
        </span>
      </Link>

      <div className="mt-6">
        <div className="label-data pb-2">Games</div>
        {GAMES.map((g) => {
          const mult = gameMultiplier(g);
          return (
            <button
              key={g.id}
              onClick={() => play(g)}
              className="press flex w-full items-center gap-3.5 border-t border-hairline px-0.5 py-3 text-left"
            >
              <span
                className="font-display flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-stone-200 bg-surface text-[16px] font-extrabold"
                aria-hidden
              >
                {g.glyph}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-body font-bold">
                  {g.name}
                  {/* The same chip the mod picker wears: a door that opens
                      the sheet says so before the tap. */}
                  {needsPremium(g) && !premium && (
                    <span className="ml-1.5 text-[11.5px] font-normal text-stone-500">
                      premium
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-caption text-stone-500">
                  {g.blurb}
                </span>
              </span>
              {/* The staged conditions pay effort credit, never stars
                  (#37) — so the chip names XP and nothing else. Sage
                  outline: a multiplier is earned by taking the harder
                  conditions, and the chip is the one pill in the set. */}
              {mult > 1 && (
                <span className="font-display shrink-0 rounded-full border border-sage-300 px-2 py-[3px] text-[11px] font-bold uppercase text-sage-700 tabular-nums">
                  ×{mult} xp
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* The second boss and the analyzer: doors, same grammar. */}
      <div className="mt-6">
        <div className="label-data pb-2">More doors</div>
        <Link
          href="/hostile"
          className="press flex w-full items-center gap-3.5 border-t border-hairline px-0.5 py-3 text-left"
        >
          <span
            className="font-display flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-stone-200 bg-surface text-[16px] font-extrabold"
            aria-hidden
          >
            !
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-display block text-body font-bold">
              Hostile Q&amp;A
            </span>
            <span className="mt-0.5 block text-caption text-stone-500">
              Demos interrogates your take. Two questions, no notes.
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-stone-300">
            →
          </span>
        </Link>
        <Link
          href="/upload"
          className="press flex w-full items-center gap-3.5 border-y border-hairline px-0.5 py-3 text-left"
        >
          <span
            className="font-display flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-stone-200 bg-surface text-[16px] font-extrabold"
            aria-hidden
          >
            ↑
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-display block text-body font-bold">
              Upload a recording
            </span>
            <span className="mt-0.5 block text-caption text-stone-500">
              A real meeting or a voice memo, through the same engine.
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-stone-300">
            →
          </span>
        </Link>
      </div>

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
    </main>
  );
}
