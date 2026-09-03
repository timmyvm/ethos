"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AchievementMark, IconFreeze } from "@/components/Icon";
import { ErrorLine, ErrorState } from "@/components/ui/ErrorState";
import { Skeleton, SkeletonStatBare } from "@/components/ui/Skeleton";
import { Paywall, type PaywallAsk } from "@/components/Paywall";
import { LexiconFlash } from "@/components/LexiconFlash";
import { ShareCard } from "@/components/ShareCard";
import { achievements } from "@/lib/achievements";
import { syncCoins } from "@/lib/coin-sync";
import { limit } from "@/lib/entitlement";
import { towardFirstItem } from "@/lib/coins";
import {
  fetchLexicon,
  fetchProfile,
  fetchReps,
  fetchXp,
  MAX_DISPLAY_NAME,
  updateDisplayName,
  type LexiconRow,
  type RepRow,
} from "@/lib/client-data";
import { rankedTraits, traitLevels } from "@/lib/traits";
import { syncFreezes } from "@/lib/freeze-sync";
import { levelFromXp } from "@/lib/level";
import { readable, readFailure } from "@/lib/load";
import {
  computeStreak,
  MAX_EQUIPPED_FREEZES,
  type StreakState,
} from "@/lib/streak";
import { supabaseBrowser } from "@/lib/supabase-browser";

// Free tier gets today's swap, not the archive — when the paywall is on.
const FREE_LEXICON = 3;

const EMPTY_STREAK: StreakState = {
  current: 0,
  longest: 0,
  atRisk: false,
  didToday: false,
  frozenInRun: 0,
};

/**
 * The profile.
 *
 * Two passes shaped what's here. The structural pass took the boxes
 * away: every block on this page was a bordered, lifted card, so eight
 * cards gave eight things equal rank and the eye had nowhere to land
 * first. Only the level card is furniture now; everything under it is a
 * section title and its numbers, sitting on the ground (DECISIONS #151).
 *
 * The copy pass took the paragraphs away. Coin economics live in the
 * shop, freeze rules live at the moment a freeze is earned or spent, and
 * "never money" is said once, where it lands hardest — under the XP bar
 * (COPY-RULES.md, DECISIONS #150).
 */
export default function YouPage() {
  /**
   * `null` until the fetch lands, NOT `[]`. Starting empty meant this
   * page rendered "Level 1 · 0 XP · 0 coins · 0-day streak" for a few
   * hundred milliseconds to someone who might have a hundred reps —
   * numbers that were not true. Skeletons hold the space instead, and
   * `lib/load` is what lets them end.
   */
  const [reps, setReps] = useState<RepRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [lexicon, setLexicon] = useState<LexiconRow[]>([]);
  const [xp, setXp] = useState({ total: 0, week: 0 });
  const [anon, setAnon] = useState<boolean | null>(null);
  const [paywall, setPaywall] = useState<PaywallAsk | null>(null);
  /** `null` is a balance nobody could read. It renders as a dash. */
  const [coins, setCoins] = useState<number | null>(null);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [flashing, setFlashing] = useState(false);
  const [freezes, setFreezes] = useState<{
    equipped: number;
    used: number;
  } | null>(null);
  /** `null` until the profile answers, so "Add your name" can't flash
      over a name that merely hasn't arrived. */
  const [name, setName] = useState<string | null>(null);
  const [nameKnown, setNameKnown] = useState(false);
  const [premium, setPremium] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");
  const [nameFailed, setNameFailed] = useState(false);

  async function saveName() {
    const next = draft.trim().slice(0, MAX_DISPLAY_NAME);
    setNameFailed(false);
    const ok = await updateDisplayName(next);
    if (!ok) {
      setNameFailed(true);
      return;
    }
    setName(next || null);
    setEditingName(false);
  }

  /** The coins half, on its own so its retry doesn't reload the page. */
  const loadCoins = useCallback(async (dates: Date[]) => {
    const read = await readable(() => syncCoins(dates));
    setCoins(read.ok ? read.data.balance : null);
  }, []);

  /** Same for freezes: one dead sync shouldn't blank the profile. */
  const loadFreezes = useCallback(async (dates: Date[]) => {
    const read = await readable(() => syncFreezes(dates));
    if (!read.ok) {
      setFreezes(null);
      return;
    }
    setStreak(read.data.streak);
    setFreezes({
      equipped: read.data.equipped,
      used: read.data.frozenDays.length,
    });
  }, []);

  const load = useCallback(async () => {
    setFailed(false);
    setReps(null);
    const read = await readable(fetchReps);
    if (!read.ok) {
      setFailed(true);
      return;
    }
    const rows = read.data;
    setReps(rows);
    const dates = rows.map((r) => new Date(r.created_at));
    setStreak(computeStreak(dates));
    void loadFreezes(dates);
    void loadCoins(dates);
  }, [loadCoins, loadFreezes]);

  useEffect(() => {
    void load();
    fetchLexicon().then(setLexicon).catch(() => {});
    fetchXp().then(setXp).catch(() => {});
    fetchProfile()
      .then((p) => {
        setName(p?.display_name ?? null);
        setNameKnown(true);
        setPremium(p?.premium ?? false);
      })
      .catch(() => {});
    const db = supabaseBrowser();
    db?.auth
      .getUser()
      .then(({ data }) => setAnon(data.user?.is_anonymous ?? null))
      .catch(() => setAnon(null));
  }, [load]);

  const loading = reps === null;
  const history = reps ?? [];
  const dates = history.map((r) => new Date(r.created_at));
  const level = levelFromXp(xp.total);
  const badges = achievements(history);
  const earnedCount = badges.filter((b) => b.earned).length;
  const toNextFreeze = 7 - (streak.longest % 7);

  // "Save your progress" gate — appears only after there IS progress
  // (DECISIONS #15: never before the first rep).
  const showGate = anon === true && history.length >= 1;

  const header = (
    <div className="flex items-center justify-between">
      <h1 className="font-display text-[24px] font-extrabold">You</h1>
      <Link
        href="/settings"
        className="text-[13px] font-semibold text-stone-400"
      >
        Settings
      </Link>
    </div>
  );

  /*
   * Every number on this page is derived from the reps, so an unread
   * history can't be drawn as a profile — it would be someone else's
   * profile, made of zeroes.
   */
  if (failed) {
    return (
      <main className="px-5 pb-24 pt-7">
        {header}
        <ErrorState
          className="mt-4"
          {...readFailure("Your numbers")}
          onRetry={() => void load()}
        />
      </main>
    );
  }

  return (
    <main className="px-5 pb-24 pt-7">
      {header}

      {/* The one card on the page. It holds the two numbers that answer
          "how far in am I", so it keeps the furniture. */}
      <div className="mt-4 rounded-[14px] border border-edge bg-raised p-[18px]">
        {/* The name: the one profile field you type rather than earn.
            League rows show it, so it caps where they'd truncate. */}
        {editingName ? (
          <form
            className="mb-4 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void saveName();
            }}
          >
            <input
              autoFocus
              aria-label="Display name"
              maxLength={MAX_DISPLAY_NAME}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Your name"
              className="min-h-11 w-full min-w-0 flex-1 rounded-[10px] border border-stone-200 bg-raised px-4 text-[15px] font-semibold placeholder:text-stone-300 focus:border-stone-300"
            />
            <button
              type="submit"
              className="press min-h-11 shrink-0 rounded-[10px] border border-stone-200 bg-surface px-4 text-[13.5px] font-semibold hover:bg-sand"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              className="press min-h-11 shrink-0 px-1 text-[13px] font-semibold text-stone-500"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="mb-4 flex items-baseline justify-between gap-3">
            {name && (
              <span className="font-display min-w-0 truncate text-[18px] font-extrabold">
                {name}
              </span>
            )}
            {nameKnown && (
              <button
                onClick={() => {
                  setDraft(name ?? "");
                  setNameFailed(false);
                  setEditingName(true);
                }}
                className={`press min-h-11 shrink-0 text-[12.5px] font-semibold text-stone-400 ${name ? "" : "text-left"}`}
              >
                {name ? "Edit" : "Add your name →"}
              </button>
            )}
            {!nameKnown && <Skeleton className="h-5 w-28" />}
          </div>
        )}
        {nameFailed && (
          <ErrorLine className="mb-3" onRetry={() => void saveName()}>
            Your name didn&apos;t save.
          </ErrorLine>
        )}
        <div className="flex items-center gap-4">
          {/* Demos peers out of a sage pebble — the wash is earned-tone
              because being here at all is (#165). */}
          <Image
            src="/demos-listening.webp"
            alt=""
            width={96}
            height={96}
            className="demos w-12 shrink-0"
          />
          <div className="flex-1">
            <div className="label-data !text-sage-700">Level</div>
            {loading ? (
              <Skeleton className="mt-1.5 h-7 w-10" />
            ) : (
              <div className="font-display text-[30px] font-extrabold leading-none tabular-nums">
                {level.level}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="label-data">Total XP</div>
            {loading ? (
              <Skeleton className="mt-1.5 ml-auto h-5 w-14" />
            ) : (
              <div className="font-display text-[20px] font-extrabold tabular-nums">{xp.total.toLocaleString()}</div>
            )}
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden bg-sand">
          <div
            className="h-full bg-sage-500"
            style={{
              width: `${(level.intoLevel / level.forNext) * 100}%`,
            }}
          />
        </div>
        <div className="mt-1.5 flex justify-between">
          {loading ? (
            <Skeleton className="h-2.5 w-28" />
          ) : (
            <span className="label-data">
              {level.intoLevel}/{level.forNext} to level {level.level + 1}
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        {loading ? (
          <>
            <SkeletonStatBare />
            <SkeletonStatBare />
            <SkeletonStatBare />
          </>
        ) : (
          <>
            <Stat label="Streak" value={String(streak.current)} note="days" />
            <Stat label="Longest" value={String(streak.longest)} note="days" />
            <Stat label="This week" value={String(xp.week)} note="xp" />
          </>
        )}
      </div>

      {/*
       * Traits (DECISIONS #159) — the nine Index dimensions as levels,
       * best first, derived from the reps on every load. A mirror, not
       * a currency: they gate nothing and feed nothing. Amber goes to
       * the leader only; a trait that hasn't leveled sits dimmed at the
       * bottom, the shelf's grammar (#153): the position is the claim.
       */}
      <div className="mt-6 border-t border-hairline pt-3.5">
        <div className="label-data">Traits</div>
        <div className="mt-2.5 space-y-2.5">
          {loading ? (
            <>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </>
          ) : (
            (() => {
              const ranked = rankedTraits(traitLevels(history));
              const top = Math.max(1, ranked[0]?.level ?? 0);
              return ranked.map((t, i) => (
                <div key={t.key} className="flex items-center gap-3">
                  <span
                    className={`font-display w-[92px] shrink-0 text-[13px] font-bold leading-tight ${
                      t.level > 0 ? "" : "text-stone-300"
                    }`}
                  >
                    {t.name}
                  </span>
                  <span className="h-[5px] flex-1 overflow-hidden bg-sand">
                    {t.level > 0 && (
                      /* The leader wears the earned olive; the rest sit
                         one step dimmer (#201) — position is the claim. */
                      <span
                        className={`block h-full ${
                          i === 0 ? "bg-sage-500" : "bg-sage-400"
                        }`}
                        style={{ width: `${(t.level / top) * 100}%` }}
                      />
                    )}
                  </span>
                  <span
                    className={`font-display w-6 shrink-0 text-right text-[14px] font-extrabold tabular-nums ${
                      t.level > 0 ? "" : "text-stone-300"
                    }`}
                  >
                    {t.level}
                  </span>
                </div>
              ));
            })()
          )}
        </div>
      </div>

      {/*
       * Coins. The balance is shown against the price of the first thing
       * it buys — a number going somewhere named. What used to sit under
       * it was three lines arguing why the shop can only sell
       * convenience; that argument belongs in the shop, where somebody is
       * about to spend (COPY-RULES: explain a mechanic where it happens).
       */}
      <div className="mt-6 border-t border-hairline pt-3.5">
        <div className="label-data">Coins</div>
        <div className="mt-2.5 flex items-end gap-4">
          <div className="flex-1">
            {loading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <div className="font-display text-[26px] font-extrabold leading-none tabular-nums">
                {coins ?? "—"}
              </div>
            )}
            <div className="label-data mt-1.5 !tracking-[0.1em]">1 a day</div>
          </div>
          <div className="shrink-0 text-right">
            {loading ? (
              <Skeleton className="ml-auto h-5 w-8" />
            ) : (
              <div className="font-display text-[18px] font-extrabold leading-none tabular-nums">
                {coins === null ? "—" : towardFirstItem(coins).toGo}
              </div>
            )}
            <div className="label-data mt-1.5 !tracking-[0.1em]">
              to the first item
            </div>
          </div>
        </div>
        {/* Terracotta on purpose, the ONLY terracotta on this screen: it points
            at the next buyable thing, and it isn't a tap (#165's flag,
            carried into #201). */}
        <div className="mt-2.5 h-[5px] overflow-hidden bg-sand">
          <div
            className="h-full bg-terracotta-500"
            style={{
              width: `${coins === null ? 0 : towardFirstItem(coins).fraction * 100}%`,
            }}
          />
        </div>
        {!loading && coins === null && (
          <ErrorLine className="mt-2" onRetry={() => void loadCoins(dates)}>
            Your balance didn&apos;t load.
          </ErrorLine>
        )}
        <Link
          href="/shop"
          className="press font-display mt-3 flex min-h-11 items-center justify-between rounded-[10px] border border-stone-200 bg-surface px-4 py-[11px] text-[13.5px] font-bold hover:bg-sand"
        >
          <span>Open the shop</span>
          <span aria-hidden className="text-stone-300">
            →
          </span>
        </Link>
      </div>

      {/* Freezes. The rules that were printed here in full — how they're
          earned, what they cost, what a frozen day does to the streak —
          now appear at the two moments they're true: when one is spent
          (the home screen says so) and when you have one to spend. */}
      <div className="label-data mt-6 border-t border-hairline pt-3.5">
        Streak freezes
      </div>
      <div className="mt-2 flex items-center gap-2">
        {Array.from({ length: MAX_EQUIPPED_FREEZES }).map((_, i) => {
          const ready = (freezes?.equipped ?? 0) > i;
          return (
            /* Bordered tiles, not washes (#201): a ready freeze wears
               the earned outline, an empty slot the neutral one. */
            <span
              key={i}
              className={`flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border ${
                ready
                  ? "border-sage-300 bg-surface text-sage-700"
                  : "border-stone-200 bg-surface text-stone-300"
              }`}
            >
              <IconFreeze size={17} />
            </span>
          );
        })}
        {freezes !== null && freezes.equipped === 0 && (
          <p className="ml-2 flex-1 text-[13px] leading-relaxed text-stone-500">
            {toNextFreeze} more day{toNextFreeze === 1 ? "" : "s"} earns one.
          </p>
        )}
      </div>
      {freezes !== null && freezes.used > 0 && (
        <p className="mt-2 text-[12.5px] text-stone-500">
          {freezes.used} spent so far.
        </p>
      )}
      {!loading && freezes === null && (
        <ErrorLine className="mt-2" onRetry={() => void loadFreezes(dates)}>
          Your freezes didn&apos;t load.
        </ErrorLine>
      )}

      {/* The league card sat here until 27 Aug — shelved (Timothy's
          call) until there are users to rank. lib/level.ts and xp_events
          stay; a future league reads them unchanged. */}

      {/* Personal lexicon — the supply layer's archive (DECISIONS #12) */}
      <div className="label-data mt-6 border-t border-hairline pt-3.5">
        Your lexicon
      </div>
      {lexicon.length === 0 ? (
        <p className="mt-2 text-[13px] leading-relaxed text-stone-500">
          Upgrades from your own recordings collect here.
        </p>
      ) : (
        <>
          <div className="mt-1">
            {lexicon.slice(0, limit(FREE_LEXICON, premium) ?? lexicon.length).map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2.5 border-b border-hairline py-2.5 text-[13.5px]"
              >
                <span className="text-stone-300 line-through">
                  {l.original}
                </span>
                <span aria-hidden className="text-stone-200">
                  →
                </span>
                <span className="font-bold">{l.upgrade}</span>
              </div>
            ))}
          </div>
          {lexicon.length >= 3 && !flashing && (
            <button
              onClick={() => setFlashing(true)}
              className="press font-display mt-3 min-h-11 w-full rounded-[10px] border border-sage-300 px-5 py-2.5 text-[13px] font-bold text-sage-700 hover:bg-sage-100"
            >
              Test yourself on these →
            </button>
          )}

          {flashing && (
            <div className="mt-2.5">
              <LexiconFlash
                lexicon={lexicon}
                onDone={() => setFlashing(false)}
              />
            </div>
          )}

          {limit(FREE_LEXICON, premium) !== null && lexicon.length > FREE_LEXICON && (
            <button
              onClick={() =>
                setPaywall({
                  reason: "Full lexicon · premium",
                  headline: "Every word you've earned, kept.",
                })
              }
              className="press mt-2.5 flex min-h-11 w-full items-center justify-between gap-3 border-b border-hairline px-0.5 py-3 text-left text-[13px] font-semibold text-stone-500"
            >
              <span>
                {lexicon.length - FREE_LEXICON} more upgrade
                {lexicon.length - FREE_LEXICON === 1 ? "" : "s"} in your
                archive
              </span>
              <span
                aria-hidden
                className="font-display shrink-0 font-bold text-terracotta-700"
              >
                →
              </span>
            </button>
          )}
        </>
      )}

      {/*
       * The shelf. A ladder, not a grid: hardest last, no tier labels,
       * because the position is the claim. Every row is a link to the
       * drill that produces its number — a locked badge that only
       * describes itself is a taunt (DECISIONS #153).
       */}
      <div className="label-data mt-6 border-t border-hairline pt-3.5">
        Earned{" "}
        <span className="ml-1 text-stone-300">
          {earnedCount}/{badges.length}
        </span>
      </div>
      <div className="mt-1">
        {badges.map((a) => (
          <Link
            key={a.id}
            href={a.href}
            className="press flex min-h-14 items-center gap-3.5 border-b border-hairline py-3"
          >
            {/* Bordered tiles, not washes (#201): earned wears the
                olive outline, not-yet the neutral one. */}
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border ${
                a.earned
                  ? "border-sage-300 bg-surface text-sage-700"
                  : "border-stone-200 bg-surface text-stone-300"
              }`}
            >
              <AchievementMark name={a.icon} size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`font-display block text-[13.5px] font-bold ${
                  a.earned ? "" : "text-stone-500"
                }`}
              >
                {a.name}
              </span>
              <span className="mt-0.5 block text-[12px] text-stone-400">
                {a.requirement}
              </span>
              {!a.earned && a.progress > 0 && (
                <span className="mt-1.5 block h-1 overflow-hidden bg-sand">
                  <span
                    className="block h-full bg-stone-400"
                    style={{ width: `${Math.round(a.progress * 100)}%` }}
                  />
                </span>
              )}
            </span>
            <span aria-hidden className="shrink-0 text-stone-300">
              →
            </span>
          </Link>
        ))}
      </div>

      {history.length >= 2 && (
        <>
          <div className="label-data mt-6 border-t border-hairline pt-3.5">
            Day 1 vs now
          </div>
          <ShareCard reps={history} />
        </>
      )}

      {showGate && (
        <div className="mt-7 rounded-[14px] border border-edge bg-raised p-4">
          <div className="font-display text-[14.5px] font-bold">
            Save your progress
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-stone-500">
            {history.length} recording{history.length === 1 ? "" : "s"}
            {streak.current > 0 &&
              ` and ${/^(8|11|18|8\d)$/.test(String(streak.current)) ? "an" : "a"} ${streak.current}-day streak`}{" "}
            live
            on this device. An account keeps them.
          </p>
          <Link
            href="/signup"
            className="press font-display mt-3 block min-h-11 w-full rounded-xl bg-terracotta-500 px-5 py-3 text-center text-[15px] font-bold text-cream hover:bg-terracotta-600"
          >
            Create my account
          </Link>
          <Link
            href="/signin"
            className="mt-2.5 block text-center text-[12.5px] font-semibold text-terracotta-700"
          >
            I already have one
          </Link>
        </div>
      )}

      {/* The one standing door to the sheet (docs/growth/04 §4.1): a
          quiet row, last on the page, never a card. A premium account
          sees its state instead — the only place the app says it. */}
      {!loading &&
        (premium ? (
          <p className="mt-7 text-[12.5px] text-stone-400">
            Premium is on this account.
          </p>
        ) : (
          <button
            onClick={() => setPaywall({ reason: "Ethos Premium" })}
            className="press font-display mt-7 flex min-h-11 w-full items-center justify-between rounded-[10px] border border-stone-200 bg-surface px-4 py-[11px] text-[13.5px] font-bold hover:bg-sand"
          >
            <span>Ethos Premium</span>
            <span aria-hidden className="text-stone-300">
              →
            </span>
          </button>
        ))}

      {paywall && (
        <Paywall
          reason={paywall.reason}
          headline={paywall.headline}
          onClose={() => setPaywall(null)}
        />
      )}
    </main>
  );
}

/** A labelled number on the ground. No box: the label is the container. */
function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex-1">
      <div className="label-data">{label}</div>
      <div className="font-display text-[24px] font-extrabold leading-tight tabular-nums">
        {value}
      </div>
      <div className="text-[11.5px] text-stone-400">{note}</div>
    </div>
  );
}
