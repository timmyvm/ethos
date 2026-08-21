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
      <h1 className="font-display text-2xl font-bold">Games</h1>

      <Link
        href="/boss"
        className="press mt-5 flex w-full items-center gap-3 rounded-[18px] border border-terracotta-100 bg-terracotta-50 p-4 text-left"
      >
        <Image
          src="/demos-workout.webp"
          alt=""
          width={40}
          height={40}
          className="demos w-10 shrink-0"
        />
        <span className="flex-1">
          <span className="block text-[14.5px] font-semibold">
            This week&apos;s boss: Cold Topic
          </span>
          <span className="block text-[12.5px] text-stone-500">
            A topic you&apos;ve never studied. 4 min research, 90s to explain,
            fact-checked.
          </span>
        </span>
        <span className="text-[13px] text-stone-400" aria-hidden>
          →
        </span>
      </Link>

      <div className="mt-6 space-y-2.5">
        {GAMES.map((g) => {
          const mult = gameMultiplier(g);
          return (
            <button
              key={g.id}
              onClick={() => play(g)}
              className="press flex w-full items-center gap-3.5 rounded-[18px] border border-hairline bg-surface p-4 text-left"
            >
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">
                  {g.name}
                </span>
                <span className="block text-[12.5px] leading-relaxed text-stone-500">
                  {g.blurb}
                </span>
              </span>
              {/* The staged conditions pay effort credit, never stars
                  (#37) — so the chip names XP and nothing else. */}
              {mult > 1 && (
                <span className="label-data shrink-0">×{mult} XP</span>
              )}
            </button>
          );
        })}
      </div>

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
    </main>
  );
}
