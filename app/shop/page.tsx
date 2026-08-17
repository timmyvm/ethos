"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Coin } from "@/components/Coin";
import { IconFreeze } from "@/components/Icon";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { readable, readFailure } from "@/lib/load";
import {
  fetchCoinLedger,
  fetchReps,
  spendCoins,
  type RepRow,
} from "@/lib/client-data";
import { balance, type CoinRow } from "@/lib/coins";
import { syncCoins } from "@/lib/coin-sync";
import { syncFreezes } from "@/lib/freeze-sync";
import {
  canBuy,
  ownedFrom,
  POSE_ART,
  reasonFor,
  SHOP,
  type ShopItem,
} from "@/lib/shop";
import { MAX_EQUIPPED_FREEZES } from "@/lib/streak";
import { buzz, readPrefs, writePrefs } from "@/lib/prefs";

/**
 * The shop. Coins are earned by speaking, one per day, and this is the
 * first thing they do.
 *
 * The non-negotiable is printed on every card rather than assumed:
 * nothing here buys a number. Freezes buy convenience — a frozen day
 * still doesn't count toward the streak — and poses buy nothing at all.
 */
export default function ShopPage() {
  const [ledger, setLedger] = useState<CoinRow[] | null>(null);
  const [equipped, setEquipped] = useState(0);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pose, setPose] = useState<string | null>(null);

  /*
   * A balance is the one number in the app that must never be guessed:
   * every button on this screen is priced against it, and an unread
   * ledger used to fall back to zero — which sold "not enough coins" to
   * someone holding thirty.
   */
  const refresh = useCallback(async () => {
    setFailed(false);
    const reps = await readable(fetchReps);
    if (!reps.ok) {
      setLedger(null);
      setFailed(true);
      return;
    }
    const dates = reps.data.map((r: RepRow) => new Date(r.created_at));
    // Pay out anything owed before showing a balance to spend.
    await readable(() => syncCoins(dates));
    const rows = await readable(fetchCoinLedger);
    if (!rows.ok) {
      setLedger(null);
      setFailed(true);
      return;
    }
    setLedger(rows.data);
    const f = await readable(() => syncFreezes(dates));
    if (f.ok) setEquipped(f.data.equipped);
  }, []);

  useEffect(() => {
    setPose(readPrefs().pose);
    void refresh();
  }, [refresh]);

  /** Equipping is free and reversible — the coins bought the option. */
  function equip(id: string | null) {
    writePrefs({ pose: id });
    setPose(id);
    buzz(15);
  }

  const rows = ledger ?? [];
  const coins = balance(rows);
  const owned = ownedFrom(rows);

  async function buy(item: ShopItem) {
    setBusy(item.id);
    setNote(null);
    const res = await spendCoins(reasonFor(item), item.price);
    if (res.ok) {
      buzz([20, 40, 20]);
      // A cosmetic that changes nothing until you find a second switch
      // is a cosmetic that reads as broken. Buying equips it.
      if (item.kind === "cosmetic") equip(item.id);
      setNote(
        item.kind === "cosmetic"
          ? `${item.name} bought, and on your card.`
          : `${item.name} bought.`
      );
      await refresh();
    } else {
      // The server's own words used to land here verbatim ("PGRST301",
      // "JWT expired"), which is a stack trace with better manners.
      setNote(
        res.detail === "not enough coins"
          ? "Not enough coins yet."
          : "That didn't go through. Your coins are untouched."
      );
    }
    setBusy(null);
  }

  return (
    <main className="px-5 pb-24 pt-7">
      <Link href="/you" className="text-sm text-stone-500">
        ← you
      </Link>

      <div className="mt-4 flex items-end justify-between">
        <h1 className="font-display text-[30px] font-bold leading-tight">
          Shop
        </h1>
        <span className="flex items-center gap-2">
          <Coin variant={coins > 0 ? "coin" : "empty"} size={26} />
          {ledger === null ? (
            failed ? (
              /* Not a zero. A balance nobody could read is unknown, and
                 unknown is a dash. */
              <span className="font-display text-[24px] font-bold leading-none text-stone-400">
                —
              </span>
            ) : (
              <Skeleton className="h-6 w-10" />
            )
          ) : (
            <span className="font-display text-[24px] font-bold leading-none">
              {coins}
            </span>
          )}
        </span>
      </div>
      {/* The earning rule moved here from under the balance on /you: a
          day you spoke pays once however many reps you did, which is the
          fact that makes the prices below mean something. The claim that
          nothing here buys a score is made once, at the bottom, where
          the shelf has already made its case. */}
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-500">
        One coin a day you speak, however many reps you did.
      </p>

      {note && (
        <p className="mt-4 rounded-[14px] bg-terracotta-50 px-4 py-3 text-[13.5px] font-semibold text-terracotta-700">
          {note}
        </p>
      )}

      {failed ? (
        <ErrorState
          className="mt-5"
          {...readFailure("Your coins")}
          onRetry={() => void refresh()}
        />
      ) : ledger === null ? (
        <SkeletonRegion label="Loading the shop" className="mt-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-[18px] border border-hairline bg-surface lift p-5"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2.5 h-3 w-full" />
              <Skeleton className="mt-3 h-9 w-full" rounded="rounded-[13px]" />
            </div>
          ))}
        </SkeletonRegion>
      ) : (
        <div className="mt-5 space-y-3">
          {SHOP.map((item) => {
            const state = canBuy(
              item,
              coins,
              owned,
              equipped,
              MAX_EQUIPPED_FREEZES
            );
            const isOwned =
              item.kind === "cosmetic" && owned.ids.has(item.id);
            return (
              <div
                key={item.id}
                className="rounded-[18px] border border-hairline bg-surface lift p-5"
              >
                {/* You can see what you're buying. A cosmetic sold as a
                    name and a price is a cosmetic bought blind, which is
                    the one way a decoration can still be a bad deal. */}
                <div className="flex gap-3.5">
                  {POSE_ART[item.id] ? (
                    <Image
                      src={POSE_ART[item.id]}
                      alt=""
                      width={128}
                      height={128}
                      className="demos h-[62px] w-[62px] shrink-0 object-contain"
                    />
                  ) : (
                    <span className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-[14px] bg-amber-50 text-amber-500">
                      <IconFreeze size={28} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-semibold">
                        {item.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Coin variant={isOwned ? "empty" : "coin"} size={16} />
                        <span className="font-display text-[16px] font-bold">
                          {item.price}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
                      {item.blurb}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-stone-400">
                      {item.honest}
                    </p>
                  </div>
                </div>
                {isOwned ? (
                  /* Owned cosmetics stop offering a sale and offer the
                     only thing left to decide: whether it's the one on
                     your card. */
                  <button
                    onClick={() => equip(pose === item.id ? null : item.id)}
                    className={`press mt-3 w-full rounded-[13px] px-4 py-3 text-[14.5px] font-semibold transition-colors ${
                      pose === item.id
                        ? "bg-amber-50 text-amber-600"
                        : "border border-black/10 text-stone-600"
                    }`}
                  >
                    {pose === item.id ? "On your card" : "Put it on the card"}
                  </button>
                ) : (
                  <button
                    onClick={() => void buy(item)}
                    disabled={!state.ok || busy !== null}
                    /*
                     * Deliberately NOT terracotta, even though it's the
                     * primary action on its card. Two reasons pointing
                     * the same way: brand.md allows one terracotta tap
                     * per screen and a shop has four, and painting "Buy"
                     * in the attention colour is the exact nudge a store
                     * that refuses to sell you a score shouldn't make.
                     * The price is the argument; the button is a door.
                     */
                    className={`press mt-3 w-full rounded-[13px] border px-4 py-3 text-[14.5px] font-semibold transition-colors ${
                      state.ok
                        ? "border-stone-300 text-ink hover:bg-sand"
                        : "border-black/10 text-stone-400"
                    }`}
                  >
                    {busy === item.id
                      ? "Buying…"
                      : state.ok
                        ? "Buy"
                        : (state.reason ?? "Not yet")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-[12px] leading-relaxed text-stone-400">
        The shop sells convenience and decoration. It can&apos;t sell you a
        streak, a star or a point of your Ethos.
      </p>
    </main>
  );
}
