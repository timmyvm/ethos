"use client";

import { ScreenHeader } from "@/components/ui/ScreenHeader";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { CountUp } from "@/components/CountUp";
import { IconFreeze } from "@/components/Icon";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { HeaderCount } from "@/components/ui/HeaderCount";
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
import { DURATION } from "@/lib/motion";
import { MAX_EQUIPPED_FREEZES } from "@/lib/streak";
import { buzz, readPrefs, writePrefs } from "@/lib/prefs";
import { DISABLED_CLASS } from "@/lib/ui";

/**
 * The shop. Coins are earned by speaking, one per day, and this is the
 * first thing they do.
 *
 * Nothing here buys a number (lib/shop.test.ts holds it). Freezes buy
 * convenience, since a frozen day still doesn't count toward the
 * streak, and poses buy nothing at all.
 *
 * Every card is one grammar (you-3, you-22, you-24): a 56px art slot,
 * the name and its price in gold coins, the blurb, then the one footer
 * its state allows: Buy (sage, #131 and #165), the equip button for a
 * pose you own, a trough filling toward the price while the coins are
 * short, or nothing at all once the freezes are full.
 */
export default function ShopPage() {
  const [ledger, setLedger] = useState<CoinRow[] | null>(null);
  const [equipped, setEquipped] = useState(0);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pose, setPose] = useState<string | null>(null);
  /*
   * The item bought in this visit (#242). A purchase swaps the card's
   * button for a different one in the same slot — "Buy" becomes "On
   * your card", or the last freeze turns the door into a state line —
   * and a swap in place is the one thing that has to come from
   * somewhere. The new button arrives from 6px below, out of the tap
   * that produced it; a card whose button was already in that state
   * when the screen opened stays still.
   */
  const [bought, setBought] = useState<string | null>(null);

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
      setBought(item.id);
      // A cosmetic that changes nothing until you find a second switch
      // is a cosmetic that reads as broken. Buying equips it.
      if (item.kind === "cosmetic") equip(item.id);
      setNote(
        item.kind === "cosmetic"
          ? `${item.name} bought, and on your card.`
          : `${item.name} bought.`,
      );
      await refresh();
    } else {
      // The server's own words used to land here verbatim ("PGRST301",
      // "JWT expired"), which is a stack trace with better manners.
      setNote(
        res.detail === "not enough coins"
          ? "Not enough coins yet."
          : "That didn't go through. Your coins are untouched.",
      );
    }
    setBusy(null);
  }

  return (
    <main className="px-5 pb-[var(--nav-clear)] pt-7">
      <ScreenHeader
        title="Shop"
        back={{ href: "/you", label: "You" }}
        trailing={
          /* The balance is a picture of the thing counted: the gold coin
             and the number, bare (you-23, duolingo-path s6). The
             terracotta ring it replaces wore the tap colour on a number
             nobody taps. */
          <HeaderCount
            variant="bare"
            glyph={<span className="you-coin" />}
            label={
              ledger !== null
                ? `${coins} coins`
                : failed
                  ? "Coin balance unread"
                  : "Loading your coins"
            }
            value={
              ledger === null ? (
                failed ? (
                  /* Not a zero. A balance nobody could read is unknown,
                     and unknown is a dash. */
                  <span className="text-num-m text-stone-400">—</span>
                ) : (
                  <Skeleton className="h-6 w-10" />
                )
              ) : (
                <span className="text-num-m">
                  {/* The balance LANDS: the ledger read replaces a
                      skeleton here, and every price below is an argument
                      against this number, so it counts up into place.
                      It re-counts after a purchase, which is where the
                      coins went. */}
                  <CountUp value={coins} durationMs={DURATION.max} />
                </span>
              )
            }
          />
        }
      />
      {/* The earning rule moved here from under the balance on /you: a
          day you spoke pays once however many recordings you made, which
          is the fact that makes the prices below mean something. */}
      <p className="mt-1.5 text-caption text-stone-500">
        One coin a day you speak.
      </p>

      {/* Always mounted, so a screen reader hears the purchase land
          (you-25); the note itself still arrives as a card. */}
      <div role="status" aria-live="polite">
        {note && (
          <p key={note} className="arrive card mt-7 p-4 font-display text-row">
            {note}
          </p>
        )}
      </div>

      {failed ? (
        <ErrorState
          className="arrive mt-7"
          {...readFailure("Your coins")}
          onRetry={() => void refresh()}
        />
      ) : ledger === null ? (
        /* One skeleton card per item, each the card's own shape: the
           56px art slot, the name and blurb, and an h-8 footer between a
           button's 44px and a trough's line, so whichever state lands
           moves the page by a few pixels at most (#234, you-24). */
        <SkeletonRegion
          label="Loading the shop"
          className="mt-7 flex flex-col gap-3"
        >
          {SHOP.map((item) => (
            <div key={item.id} className="card p-4">
              <div className="flex gap-3.5">
                <Skeleton className="h-14 w-14 shrink-0" />
                <div className="min-w-0 flex-1 pt-0.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-2.5 h-3 w-full" />
                  <Skeleton className="mt-1.5 h-3 w-2/3" />
                </div>
              </div>
              <Skeleton className="mt-3 h-8 w-full" />
            </div>
          ))}
        </SkeletonRegion>
      ) : (
        /* The four cards replace the skeleton on one read, so they
           assemble rather than appear whole (#242): 40ms apart, top
           down, the order they are priced in. */
        <div className="stagger mt-7 flex flex-col gap-3">
          {SHOP.map((item) => {
            const state = canBuy(
              item,
              coins,
              owned,
              equipped,
              MAX_EQUIPPED_FREEZES,
            );
            const isOwned = item.kind === "cosmetic" && owned.ids.has(item.id);
            /* Full freezes are a state, not a door: the count goes under
               the blurb and the card offers no footer at all (you-24). */
            const full =
              !state.ok && !isOwned && item.id === "streak_freeze" &&
              equipped >= MAX_EQUIPPED_FREEZES;
            const short = !state.ok && !isOwned && !full;
            /* The tap this button came out of, if it was one. The key
               goes with it so the element mounts fresh and the arrival
               plays; without it React keeps the old node and the label
               simply changes under the finger. */
            const justBought = bought === item.id;
            return (
              <div key={item.id} className="card p-4">
                <div className="flex gap-3.5">
                  <ItemArt id={item.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-detail">
                        {item.name}
                      </span>
                      {isOwned ? (
                        /* Owned: the price has done its job, so the word
                           replaces it rather than a faded number. */
                        <span className="label-micro shrink-0">Owned</span>
                      ) : (
                        <span className="flex shrink-0 items-baseline gap-1.5">
                          <span
                            aria-hidden
                            className="you-coin !h-3 !w-3 self-center"
                          />
                          <span className="font-display text-num-s tabular-nums">
                            {item.price}
                            <span className="sr-only"> coins</span>
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-caption text-pretty text-stone-500">
                      {item.blurb}
                    </p>
                    {full && (
                      <p className="mt-1.5 text-caption font-semibold tabular-nums text-ink">
                        {state.reason}
                      </p>
                    )}
                  </div>
                </div>
                {isOwned ? (
                  /* Owned cosmetics stop offering a sale and offer the
                     only thing left to decide: whether it's the one on
                     your card. Its label is its state, so it carries no
                     aria-pressed (you-25). */
                  <button
                    key={justBought ? "equip-bought" : "equip"}
                    onClick={() => equip(pose === item.id ? null : item.id)}
                    className={`press font-display mt-3 min-h-11 w-full rounded-control border border-sage-300 px-5 py-2.5 text-row text-sage-700 transition-colors ${
                      justBought ? "arrive " : ""
                    }${pose === item.id ? "bg-sage-100" : "bg-surface"}`}
                  >
                    {pose === item.id ? "On your card" : "Put it on the card"}
                  </button>
                ) : state.ok ? (
                  /*
                   * Sage, never terracotta, though it is the card's
                   * action (#131, #165): a shop has four of them, and
                   * painting "Buy" in the attention colour is the nudge a
                   * store that refuses to sell you a score shouldn't make.
                   * A purchase in flight shuts every other door, and a
                   * shut door wears the one disabled value.
                   */
                  <button
                    key={justBought ? "buy-bought" : "buy"}
                    onClick={() => void buy(item)}
                    disabled={busy !== null}
                    className={`press font-display mt-3 min-h-11 w-full rounded-control border border-transparent bg-sage-700 px-5 py-2.5 text-row text-sage-ink transition-colors ${
                      justBought ? "arrive " : ""
                    }${DISABLED_CLASS}`}
                  >
                    {busy === item.id ? "Buying…" : "Buy"}
                  </button>
                ) : short ? (
                  /* Short of the price: how far along, as a measurement
                     rather than a button with its fill missing (you-24). */
                  <div className="mt-3">
                    <div aria-hidden className="h-1.5 overflow-hidden bg-sand">
                      <div
                        className="fill h-full bg-sage-500"
                        style={{
                          width: `${Math.min(100, (coins / item.price) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1.5 text-caption tabular-nums text-stone-500">
                      {coins} of {item.price} coins
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

/**
 * Every item's picture in one 56px slot (you-3, you-22). A pose stands
 * on the slot's floor, so the speaking pose's flat bust cut meets the
 * tile's edge instead of hanging in the air; the freeze is the sky tile
 * itself (#315: protection you hold, never sage), not a tile in a tile.
 * In dark the surface step is darker than the card it sits in and drew
 * a hole, so the tile takes the quiet ink fill Settings' hour set uses.
 */
function ItemArt({ id }: { id: string }) {
  const art = POSE_ART[id];
  if (!art) {
    return (
      <span aria-hidden className="you-freeze h-14! w-14!">
        <IconFreeze size={22} />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-14 w-14 shrink-0 items-end justify-center overflow-hidden rounded-control bg-surface dark:bg-[color-mix(in_srgb,var(--color-ink)_7%,transparent)]"
    >
      <Image
        src={art}
        alt=""
        width={128}
        height={128}
        className="demos h-[52px] w-[52px] object-contain object-bottom"
      />
    </span>
  );
}
