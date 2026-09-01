"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { IconFreeze } from "@/components/Icon";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { readable, readFailure } from "@/lib/load";
import {
  fetchCoinLedger,
  fetchProfile,
  fetchReps,
  spendCoins,
  updateEquippedPose,
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
    // The local copy paints first; the account's answer wins when it
    // lands, because the account is what follows you to a new device.
    setPose(readPrefs().pose);
    fetchProfile()
      .then((p) => {
        if (p) setPose(p.equipped_pose ?? null);
      })
      .catch(() => {});
    void refresh();
  }, [refresh]);

  /** Equipping is free and reversible — the coins bought the option. */
  function equip(id: string | null) {
    writePrefs({ pose: id });
    setPose(id);
    void updateEquippedPose(id);
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
      <Link href="/you" className="text-[13px] font-semibold text-stone-400">
        ← You
      </Link>

      <div className="mt-4 flex items-end justify-between">
        <h1 className="font-display text-[24px] font-extrabold leading-tight">
          Shop
        </h1>
        {/* The balance wears the coin as a drawn terracotta ring; the shop
            is where a coin is about to become something, so the ring
            points at the number, not at a tap. */}
        <span className="flex items-baseline gap-2">
          <span
            aria-hidden
            className="inline-block h-[18px] w-[18px] shrink-0 self-center rounded-full border-2 border-terracotta-500"
          />
          {ledger === null ? (
            failed ? (
              /* Not a zero. A balance nobody could read is unknown, and
                 unknown is a dash. */
              <span className="font-display text-[20px] font-extrabold leading-none text-stone-400">
                —
              </span>
            ) : (
              <Skeleton className="h-6 w-10" />
            )
          ) : (
            <span className="font-display text-[20px] font-extrabold leading-none tabular-nums">
              {coins}
            </span>
          )}
        </span>
      </div>
      {/* The earning rule moved here from under the balance on /you: a
          day you spoke pays once however many reps you did, which is the
          fact that makes the prices below mean something. */}
      <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">
        One coin a day you speak.
      </p>

      {note && (
        <p className="mt-4 rounded-[10px] border border-edge bg-raised px-4 py-3 text-[13px] font-semibold">
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
              className="rounded-[14px] border border-edge p-4"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2.5 h-3 w-full" />
              <Skeleton className="mt-3 h-9 w-full" rounded="rounded-[10px]" />
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
                className="rounded-[14px] border border-edge p-4"
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
                      className="demos h-[46px] w-[46px] shrink-0 object-contain"
                    />
                  ) : (
                    <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-sage-300 text-sage-700">
                      <IconFreeze size={20} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-[15px] font-extrabold">
                        {item.name}
                      </span>
                      {/* The price wears the coin as a small ring; an
                          already-owned price fades to faint. */}
                      <span
                        className={`flex shrink-0 items-baseline gap-1.5 ${
                          isOwned ? "text-stone-300" : ""
                        }`}
                      >
                        <span
                          aria-hidden
                          className="inline-block h-[7px] w-[7px] shrink-0 rounded-full border-[1.5px] border-current"
                        />
                        <span className="font-display text-[15px] font-extrabold tabular-nums">
                          {item.price}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-stone-500">
                      {item.blurb}
                    </p>
                  </div>
                </div>
                {isOwned ? (
                  /* Owned cosmetics stop offering a sale and offer the
                     only thing left to decide: whether it's the one on
                     your card. */
                  <button
                    onClick={() => equip(pose === item.id ? null : item.id)}
                    className={`press font-display mt-3 w-full rounded-[10px] px-5 py-2.5 text-[13px] font-bold transition-colors ${
                      pose === item.id
                        ? "border border-sage-300 bg-sage-100 text-sage-700"
                        : "border border-sage-300 text-sage-700 hover:bg-sage-100"
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
                     * the same way: brand.md allows one terracotta tap per
                     * screen and a shop has four, and painting "Buy" in
                     * the attention colour is the exact nudge a store
                     * that refuses to sell you a score shouldn't make.
                     * The price is the argument; the button is a door —
                     * olive-filled when it opens, an outline when the
                     * coins aren't there yet (#131, #201).
                     */
                    className={`press font-display mt-3 w-full rounded-[10px] px-5 py-2.5 text-[13px] font-bold transition-colors ${
                      state.ok
                        ? "bg-sage-500 text-sage-ink hover:bg-sage-600"
                        : "border border-stone-200 text-stone-400"
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

    </main>
  );
}
