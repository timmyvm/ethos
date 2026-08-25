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
      <h1 className="font-display text-[27px]">Games</h1>

      <Link
        href="/boss"
        className="press lift mt-5 flex w-full items-center gap-3.5 rounded-[26px] border-[1.5px] border-transparent bg-terracotta-100 p-4 text-left"
      >
        <Image
          src="/demos-workout.webp"
          alt=""
          width={52}
          height={52}
          className="demos w-[52px] shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold">
            This week&apos;s boss: Cold Topic
          </span>
          <span className="block mt-0.5 text-[12.5px] leading-[1.45] text-terracotta-800">
            A topic you&apos;ve never studied. 4 min research, 90s to explain,
            fact-checked.
          </span>
        </span>
        <span
          className="shrink-0 text-[15px] font-bold text-terracotta-800"
          aria-hidden
        >
          →
        </span>
      </Link>

      <div className="mt-6 space-y-2.5">
        {GAMES.map((g, i) => {
          const mult = gameMultiplier(g);
          // The row badges alternate the two washes so neither accent
          // reads as a rank — a menu is a room of doors.
          const warm = i % 2 === 0;
          return (
            <button
              key={g.id}
              onClick={() => play(g)}
              className="press flex w-full items-center gap-3.5 rounded-[24px] border-[1.5px] border-hairline bg-surface p-4 text-left"
            >
              <span
                className={`font-display flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[17px] ${
                  warm
                    ? "bg-terracotta-100 text-terracotta-800"
                    : "bg-sage-100 text-sage-800"
                }`}
                aria-hidden
              >
                {g.glyph}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-extrabold">
                  {g.name}
                </span>
                <span className="block mt-0.5 text-[12.5px] leading-[1.45] text-stone-500">
                  {g.blurb}
                </span>
              </span>
              {/* The staged conditions pay effort credit, never stars
                  (#37) — so the chip names XP and nothing else. */}
              {mult > 1 && (
                <span className="shrink-0 rounded-full bg-sage-100 px-[11px] py-[5px] text-[11.5px] font-extrabold tracking-[0.04em] text-sage-800">
                  ×{mult} xp
                </span>
              )}
            </button>
          );
        })}
      </div>

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
    </main>
  );
}
