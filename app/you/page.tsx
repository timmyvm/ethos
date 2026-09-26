"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AchievementMark, IconFlame, IconFreeze } from "@/components/Icon";
import { DemosArt } from "@/components/DemosArt";
import { PremiumDoor, PremiumMark } from "@/components/PremiumMark";
import { CountUp } from "@/components/CountUp";
import { ErrorLine, ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Paywall, type PaywallAsk } from "@/components/Paywall";
import { LexiconFlash } from "@/components/LexiconFlash";
import { ShareCard } from "@/components/ShareCard";
import { achievements } from "@/lib/achievements";
import { syncCoins } from "@/lib/coin-sync";
import { limit } from "@/lib/entitlement";
import { DURATION } from "@/lib/motion";
import { towardFirstItem } from "@/lib/coins";
import {
  fetchLexicon,
  fetchProfile,
  fetchReps,
  fetchXp,
  updateDisplayName,
  type LexiconRow,
  type RepRow,
} from "@/lib/client-data";
import { rankedTraits, traitLevels } from "@/lib/traits";
import { TRAIT, type TraitId } from "@/content/traits";
import { syncFreezes } from "@/lib/freeze-sync";
import { levelFromXp } from "@/lib/level";
import { readable, readFailure } from "@/lib/load";
import { starsByLesson, totalStars } from "@/lib/path";
import { cleanName, MAX_NAME, readOnboarding, type OnboardingState } from "@/lib/answers";
import { syncOnboarding } from "@/lib/answers-sync";
import { buildPortfolio } from "@/lib/portfolio";
import {
  computeStreak,
  MAX_EQUIPPED_FREEZES,
  type StreakState,
} from "@/lib/streak";
import { INPUT_CLASS } from "@/lib/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";

// Free tier gets today's swap, not the archive — when the paywall is on.
const FREE_LEXICON = 3;

/**
 * The traits the lessons teach, each with its tone (`[data-trait]`).
 * A toned row takes the lesson's name for it too (Pausing, Restarts,
 * Variety), so the colour and the word match /lessons and Today; the
 * four the Index only reads keep the Index's names.
 */
const TONED = new Set<string>(["pause", "fillers", "repairs", "pace", "range"]);
const isToned = (key: string): key is TraitId => TONED.has(key);

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
  /**
   * `null` until the read lands, like `reps` and `xp`. Starting at `[]`
   * printed "Upgrades from your own recordings collect here." to
   * someone with forty upgrades for as long as the fetch took, and then
   * laddered the real rows in over that correction. A placeholder row
   * holds the space instead.
   */
  const [lexicon, setLexicon] = useState<LexiconRow[] | null>(null);
  /**
   * `null` until the XP read lands, for the same reason `reps` is: the
   * level card and "this week" are derived from it, and a zero that has
   * not arrived yet renders as Level 1 / 0 XP / 0 xp — numbers that are
   * not true, and now numbers that would COUNT UP to the truth a moment
   * later. A failed read still resolves to zeroes, which is what the
   * page has always shown.
   */
  const [xp, setXp] = useState<{ total: number; week: number } | null>(null);
  const [anon, setAnon] = useState<boolean | null>(null);
  const [paywall, setPaywall] = useState<PaywallAsk | null>(null);
  /**
   * `undefined` until the sync answers, `null` when it failed. They were
   * one value, so the moment between the reps landing and the balance
   * landing printed "Your balance didn't load." over a read still in
   * flight. A failed read draws no number and no coin, only the retry:
   * a balance nobody could read is not shown as one.
   */
  const [coins, setCoins] = useState<number | null | undefined>(undefined);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [flashing, setFlashing] = useState(false);
  /** `undefined` pending, `null` failed: the same split as `coins`. */
  const [freezes, setFreezes] = useState<{
    equipped: number;
    used: number;
  } | null | undefined>(undefined);
  /** `null` until the profile answers, so "Add your name" can't flash
      over a name that merely hasn't arrived. */
  const [name, setName] = useState<string | null>(null);
  const [nameKnown, setNameKnown] = useState(false);
  const [premium, setPremium] = useState(false);
  /** The introduction's answers (#232): undefined until the device has been read. */
  const [onboarding, setOnboarding] = useState<OnboardingState | undefined>(undefined);
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");
  const [nameFailed, setNameFailed] = useState(false);

  async function saveName() {
    const next = cleanName(draft) ?? "";
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
    setCoins(undefined);
    const read = await readable(() => syncCoins(dates));
    setCoins(read.ok ? read.data.balance : null);
  }, []);

  /** Same for freezes: one dead sync shouldn't blank the profile. */
  const loadFreezes = useCallback(async (dates: Date[]) => {
    setFreezes(undefined);
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
    fetchLexicon()
      .then(setLexicon)
      .catch(() => setLexicon([]));
    fetchXp()
      .then(setXp)
      .catch(() => setXp({ total: 0, week: 0 }));
    setOnboarding(readOnboarding());
    fetchProfile()
      .then((p) => {
        setName(p?.display_name ?? null);
        setNameKnown(true);
        setPremium(p?.premium ?? false);
        return syncOnboarding().then(setOnboarding);
      })
      .catch(() => {});
    const db = supabaseBrowser();
    db?.auth
      .getUser()
      .then(({ data }) => setAnon(data.user?.is_anonymous ?? null))
      .catch(() => setAnon(null));
  }, [load]);

  const loading = reps === null;
  /** The level card and the stat trio wait on BOTH reads (see `xp`). */
  const counting = loading || xp === null;
  const history = reps ?? [];
  const dates = history.map((r) => new Date(r.created_at));
  const level = levelFromXp(xp?.total ?? 0);
  const badges = achievements(history);
  const earnedCount = badges.filter((b) => b.earned).length;
  const toNextFreeze = 7 - (streak.longest % 7);

  // "Save your progress" gate — appears only after there IS progress
  // (DECISIONS #15: never before the first rep).
  const showGate = anon === true && history.length >= 1;

  const header = (
    <div className="flex items-center justify-between">
      <h1 className="font-display text-[24px] font-extrabold">You</h1>
      {/* The 44px target Today's text links carry, without moving the
          line: the box grows into the margins (#287). */}
      <Link
        href="/settings"
        className="press -my-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-stone-400"
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
      <main className="px-5 pb-22 pt-7">
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
    <main className="px-5 pb-22 pt-7">
      {header}

      {/* The ONE lifted thing on this screen (#234). It holds the two
          numbers that answer "how far in am I", so it keeps the
          furniture, and nothing below it carries a shadow above elev-1.
          Its top is a stage in the introduction's sun (picture colour,
          never earned or a tap): your name, your level, and Demos
          standing in it full-body, the way Practice's boss card stands
          him in sky. The XP under it stays sage, because XP is earned. */}
      <section className="elev-2 mt-5 rounded-sheet border border-card-edge bg-raised p-2">
        <div className="intro-stage tone-sun you-stage h-[184px]">
          <div className="relative z-[2] flex h-full max-w-[62%] flex-col p-4">
            {/* The name: the one profile field you type rather than earn.
                League rows show it, so it caps where they'd truncate. */}
            <div className="flex min-h-7 items-center gap-2">
              {!nameKnown ? (
                <Skeleton className="h-5 w-24" />
              ) : name ? (
                <>
                  <span className="font-display min-w-0 truncate text-[18px] font-extrabold leading-tight min-[360px]:text-[20px]">
                    {name}
                  </span>
                  {!editingName && (
                    <button
                      onClick={() => {
                        setDraft(name ?? "");
                        setNameFailed(false);
                        setEditingName(true);
                      }}
                      /* "Edit" is 24px of text; the pad widens the
                         target to 44 without moving the line (#287). */
                      className="press you-stage-ink -my-2 min-h-11 min-w-11 shrink-0 px-1 text-caption font-semibold"
                    >
                      Edit
                    </button>
                  )}
                </>
              ) : (
                !editingName && (
                  <button
                    onClick={() => {
                      setDraft("");
                      setNameFailed(false);
                      setEditingName(true);
                    }}
                    className="press you-stage-ink -my-2 min-h-11 text-left text-caption font-semibold"
                  >
                    Add your name →
                  </button>
                )
              )}
            </div>
            <div className="mt-auto">
              <div className="label-micro you-stage-ink">Level</div>
              {counting ? (
                <Skeleton className="mt-1.5 h-11 w-14" />
              ) : (
                <div className="font-display mt-0.5 text-[52px] font-extrabold leading-none tabular-nums">
                  <CountUp value={level.level} durationMs={DURATION.max} />
                </div>
              )}
            </div>
          </div>
          <div className="you-demos absolute bottom-[2px] right-1 z-[1]">
            <DemosArt
              pose="hello"
              size={172}
              pop
              grounded
              halo={{ tone: "sun", kind: "stage" }}
            />
          </div>
        </div>

        <div className="px-3 pb-2 pt-4">
          {editingName && (
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
                maxLength={MAX_NAME}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Your name"
                className={`${INPUT_CLASS} flex-1`}
              />
              <button
                type="submit"
                className="press font-display min-h-11 shrink-0 rounded-control border border-edge bg-surface px-4 text-[14px] font-bold hover:bg-sand"
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
          )}
          {nameFailed && (
            <ErrorLine className="mb-3" onRetry={() => void saveName()}>
              Your name didn&apos;t save.
            </ErrorLine>
          )}
          <div className="flex items-end justify-between gap-3">
            <div>
              {/* Tile labels inside a card take the micro register (#234). */}
              <div className="label-micro">Total XP</div>
              {counting ? (
                <Skeleton className="mt-1.5 h-6 w-16" />
              ) : (
                /* The separator survives the tick: `format` writes every
                   frame the way the page writes the final number, so this
                   never flashes 1195 on its way to 1,195. */
                <div className="font-display text-[24px] font-extrabold leading-tight tabular-nums">
                  <CountUp
                    value={xp.total}
                    durationMs={DURATION.max}
                    format={(v) => Math.round(v).toLocaleString()}
                  />
                </div>
              )}
            </div>
            {counting ? (
              <Skeleton className="mb-1 h-2.5 w-24" />
            ) : (
              <span className="label-micro mb-1 tabular-nums">
                {level.intoLevel}/{level.forNext} to level {level.level + 1}
              </span>
            )}
          </div>
          {/* The trough paints at once; the bar fills when the number it
              reports has landed (#225), never over a skeleton. */}
          <div className="mt-2.5 h-2 overflow-hidden bg-sand">
            {!counting && (
              <div
                className="fill h-full bg-sage-500"
                style={{
                  width: `${(level.intoLevel / level.forNext) * 100}%`,
                }}
              />
            )}
          </div>
        </div>
      </section>

      {/* The plan (#232): its headline, the unit for what was noticed,
          and how far the road's gate is. A row, not a card (#151), and a
          tap, because an answer is allowed to change. */}
      {onboarding !== undefined && (
        <PlanRow state={onboarding} stars={reps ? totalStars(starsByLesson(reps)) : null} />
      )}

      <div className="mt-7 flex gap-2">
        {counting ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <Stat label="Streak" value={streak.current} note="days" mark />
            <Stat label="Longest" value={streak.longest} note="days" />
            <Stat label="This week" value={xp?.week ?? 0} note="xp" />
          </>
        )}
      </div>

      {/*
       * Traits (DECISIONS #159) — the nine Index dimensions as levels,
       * best first, derived from the reps on every load. A mirror, not
       * a currency: they gate nothing and feed nothing. A trait that
       * hasn't leveled sits dimmed at the bottom, the shelf's grammar
       * (#153): the position is the claim.
       */}
      <div className="mt-7 border-t border-hairline pt-3">
        <div className="label-data">Traits</div>
        <div className="mt-3 space-y-2.5">
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
              return ranked.map((t) => {
                const toned = TONED.has(t.key);
                return (
                  /* A trait the lessons teach wears its lesson tone, so
                     blue means pausing here as on /lessons and Today;
                     the four the Index only reads stay neutral. */
                  <div
                    key={t.key}
                    data-trait={toned ? t.key : undefined}
                    className={`flex items-center gap-3 ${toned ? "you-trait" : ""}`}
                  >
                    <span
                      aria-hidden
                      className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${
                        toned ? "tone-fill" : "bg-stone-200"
                      }`}
                    />
                    {/* 600, not 700: nine equally bold lines read as nine
                        headings and the section loses its leader (#234). */}
                    <span
                      className={`font-display -ml-1 w-[124px] shrink-0 text-[14px] font-semibold leading-tight ${
                        t.level > 0 ? "" : "text-stone-400"
                      }`}
                    >
                      {toned && isToned(t.key) ? TRAIT[t.key].name : t.name}
                    </span>
                    <span
                      className={`h-1.5 flex-1 overflow-hidden ${
                        toned ? "you-trait-trough" : "bg-sand"
                      }`}
                    >
                      {t.level > 0 && (
                        <span
                          className={`fill block h-full ${
                            toned ? "tone-fill" : "bg-stone-400"
                          }`}
                          style={{ width: `${(t.level / top) * 100}%` }}
                        />
                      )}
                    </span>
                    <span
                      className={`font-display w-6 shrink-0 text-right text-[14px] font-extrabold tabular-nums ${
                        t.level > 0 ? "" : "text-stone-400"
                      }`}
                    >
                      <CountUp value={t.level} durationMs={DURATION.max} />
                    </span>
                  </div>
                );
              });
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
      <div className="mt-7 border-t border-hairline pt-3">
        <div className="label-data">Coins</div>
        {coins === null ? (
          <ErrorLine className="mt-3" onRetry={() => void loadCoins(dates)}>
            Your balance didn&apos;t load.
          </ErrorLine>
        ) : (
          <>
            <div className="mt-3 flex items-end gap-4">
              <div className="flex-1">
                {coins === undefined ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <div className="font-display flex items-center gap-2 text-[26px] font-extrabold leading-none tabular-nums">
                    {/* A coin, drawn: the picture of the thing counted. */}
                    <span aria-hidden className="you-coin" />
                    <CountUp value={coins} durationMs={DURATION.max} />
                  </div>
                )}
                <div className="label-micro mt-1.5">1 a day</div>
              </div>
              <div className="shrink-0 text-right">
                {coins === undefined ? (
                  <Skeleton className="ml-auto h-5 w-8" />
                ) : (
                  <div className="font-display text-[18px] font-extrabold leading-none tabular-nums">
                    <CountUp
                      value={towardFirstItem(coins).toGo}
                      durationMs={DURATION.max}
                    />
                  </div>
                )}
                <div className="label-micro mt-1.5">to the first item</div>
              </div>
            </div>
            {/* Sage: coins are earned, one a day, and this is how far the
                earning has got. It was terracotta (#165, #201), which on a
                screen of rows read as the page's tap. */}
            <div className="mt-3 h-1.5 overflow-hidden bg-sand">
              {typeof coins === "number" && (
                <div
                  className="fill h-full bg-sage-500"
                  style={{
                    width: `${towardFirstItem(coins).fraction * 100}%`,
                  }}
                />
              )}
            </div>
          </>
        )}
        <Link
          href="/shop"
          className="press font-display mt-3 flex min-h-11 items-center justify-between rounded-control border border-edge bg-surface px-4 py-3 text-[14px] font-bold hover:bg-sand"
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
      <div className="label-data mt-7 border-t border-hairline pt-3">
        Streak freezes
      </div>
      <div className="mt-3 flex items-center gap-2">
        {Array.from({ length: MAX_EQUIPPED_FREEZES }).map((_, i) => {
          const ready = (freezes?.equipped ?? 0) > i;
          return (
            /* Ice, not sage: a freeze is protection you hold, not a
               thing you earned the way a star is. A ready one is a tile
               of the introduction's sky; an empty slot is its outline. */
            <span
              key={i}
              className={`you-freeze ${ready ? "" : "you-freeze-empty"}`}
            >
              <IconFreeze size={20} />
            </span>
          );
        })}
        {freezes && freezes.equipped === 0 && (
          <p className="ml-2 flex-1 text-caption text-stone-500">
            {toNextFreeze} more day{toNextFreeze === 1 ? "" : "s"} earns one.
          </p>
        )}
      </div>
      {freezes && freezes.used > 0 && (
        <p className="mt-3 text-caption text-stone-500">
          {freezes.used} spent so far.
        </p>
      )}
      {freezes === null && (
        <ErrorLine className="mt-2" onRetry={() => void loadFreezes(dates)}>
          Your freezes didn&apos;t load.
        </ErrorLine>
      )}

      {/* The league card sat here until 27 Aug — shelved (Timothy's
          call) until there are users to rank. lib/level.ts and xp_events
          stay; a future league reads them unchanged. */}

      {/* Personal lexicon — the supply layer's archive (DECISIONS #12) */}
      <div className="label-data mt-7 border-t border-hairline pt-3">
        Your lexicon
      </div>
      {lexicon === null ? (
        /* Three rows, the free tier's share, at the height of the real
           ones so the shelf under them doesn't move when they land. */
        <div className="mt-1" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center border-b border-hairline py-3"
            >
              <Skeleton className="h-5 w-48" />
            </div>
          ))}
        </div>
      ) : lexicon.length === 0 ? (
        <p className="mt-3 text-caption text-stone-500">
          Upgrades from your own recordings collect here.
        </p>
      ) : (
        <>
          {/* The archive is a list, so it assembles itself (#245): one
              row every 40ms, capped at the eighth. Nothing above it
              carries an `.arrive`, so this is the block's one
              entrance. */}
          <div className="stagger mt-1">
            {lexicon.slice(0, limit(FREE_LEXICON, premium) ?? lexicon.length).map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2.5 border-b border-hairline py-3 text-[14px]"
              >
                <span className="text-stone-400 line-through">
                  {l.original}
                </span>
                <span aria-hidden className="text-stone-300">
                  →
                </span>
                {/* The word you have now, on a mint label: picture
                    colour, so it is neither a tap nor a badge. */}
                <span className="you-word">{l.upgrade}</span>
              </div>
            ))}
          </div>
          {lexicon.length >= 3 && !flashing && (
            <button
              onClick={() => setFlashing(true)}
              /* The shop link's shape: a door, so it wears no earned
                 colour of its own; the words it tests are the colour. */
              className="press font-display mt-3 flex min-h-11 w-full items-center justify-between rounded-control border border-edge bg-surface px-4 py-3 text-[14px] font-bold hover:bg-sand"
            >
              <span>Test yourself on these</span>
              <span aria-hidden className="text-stone-300">
                →
              </span>
            </button>
          )}

          {flashing && (
            <div className="mt-3">
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
              className="press mt-3 flex min-h-11 w-full items-center justify-between gap-3 px-0.5 py-3 text-left text-[14px] font-semibold text-stone-500"
            >
              <span>
                {lexicon.length - FREE_LEXICON} more upgrade
                {lexicon.length - FREE_LEXICON === 1 ? "" : "s"} in your
                archive
              </span>
              <PremiumMark variant="chip" />
            </button>
          )}
        </>
      )}

      {/*
       * The shelf. A ladder, not a grid: hardest last, no tier labels,
       * because the position is the claim. Every row is a link to the
       * lesson that produces its number — a locked badge that only
       * describes itself is a taunt (DECISIONS #153).
       */}
      <div className="label-data mt-7 border-t border-hairline pt-3">
        Earned{" "}
        <span className="you-count ml-1.5">
          {earnedCount}/{badges.length}
        </span>
      </div>
      <div className="stagger mt-1">
        {badges.map((a) => (
          <Link
            key={a.id}
            href={a.href}
            className="press flex min-h-14 items-center gap-3.5 border-b border-hairline py-3 last:border-b-0"
          >
            {/* Earned is a sage tile with its mark in gold, the grammar
                of Today's earned chips; not yet is a quiet outline. */}
            <span className={`you-badge ${a.earned ? "" : "you-badge-open"}`}>
              <AchievementMark name={a.icon} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`font-display block text-[14px] font-bold ${
                  a.earned ? "" : "text-stone-500"
                }`}
              >
                {a.name}
              </span>
              <span className="mt-0.5 block text-caption text-stone-400">
                {a.requirement}
              </span>
              {!a.earned && a.progress > 0 && (
                <span className="mt-1.5 block h-1 overflow-hidden bg-surface">
                  {/* The trough is drawn by the row; the bar only exists
                      once there is progress to report, so its `.fill`
                      runs on the read landing and never over a
                      placeholder (#225). How close you are is the row's
                      one number, so the fill holds 3:1 on its trough
                      (`.you-near`); the tile and the name stay muted. */}
                  <span
                    className="you-near fill block h-full"
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
          <div className="label-data mt-7 border-t border-hairline pt-3">
            Day 1 vs now
          </div>
          <ShareCard reps={history} />
        </>
      )}

      {showGate && (
        <div className="elev-1 mt-7 rounded-card border border-card-edge bg-raised p-4">
          <div className="font-display text-[14px] font-bold">
            Save your progress
          </div>
          <p className="mt-1 text-caption text-stone-500">
            {history.length} recording{history.length === 1 ? "" : "s"}
            {streak.current > 0 &&
              ` and ${/^(8|11|18|8\d)$/.test(String(streak.current)) ? "an" : "a"} ${streak.current}-day streak`}{" "}
            live
            on this device. An account keeps them.
          </p>
          <Link
            href="/signup"
            className="press font-display mt-3 block min-h-11 w-full rounded-control bg-terracotta-500 px-5 py-3 text-center text-[15px] font-bold text-on-accent hover:bg-terracotta-600"
          >
            Create my account
          </Link>
          <Link
            href="/signin"
            className="press mt-3 block text-center text-[13px] font-semibold text-terracotta-700"
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
          <p className="mt-7 text-caption text-stone-400">
            Premium is on this account.
          </p>
        ) : (
          <button
            onClick={() => setPaywall({ reason: "Premium" })}
            className="press font-display mt-7 flex min-h-11 w-full items-center justify-between rounded-control border border-plum-300 bg-plum-50 px-4 py-3 text-[14px] font-bold text-plum-800 hover:bg-plum-100"
          >
            <PremiumDoor>Premium</PremiumDoor>
            <span aria-hidden className="text-plum-400">
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

/**
 * A labelled number on an earned tile. All three are worked for (the
 * days practised, the best run, this week's XP), so the tile is sage,
 * the earned ground, and the number keeps the ink: it is the point.
 * The streak carries the flame it wears everywhere else, in the gold
 * Today's earned chips use for their marks.
 *
 * The value is a number rather than a string so it can COUNT: these
 * three only ever mount once the reps have landed (the skeletons hold
 * the space until then), so the tick is the measurement arriving, never
 * a re-run over a figure that was already on the screen.
 */
function Stat({
  label,
  value,
  note,
  mark = false,
}: {
  label: string;
  value: number;
  note: string;
  mark?: boolean;
}) {
  return (
    <div className="you-stat min-w-0 flex-1 rounded-card px-2.5 pb-2.5 pt-3 min-[360px]:px-3">
      {/* The micro register: three labels share one row, and at 320px
          the section eyebrow's tracking wants more than a tile has. */}
      <div className="label-micro you-stat-label whitespace-nowrap">{label}</div>
      <div className="mt-1 flex items-center gap-1">
        <span className="font-display text-[26px] font-extrabold leading-none tabular-nums">
          <CountUp value={value} durationMs={DURATION.max} />
        </span>
        {mark && value > 0 && (
          <span aria-hidden className="you-gold">
            <IconFlame size={18} />
          </span>
        )}
      </div>
      <div className="you-stat-label mt-1 text-caption">{note}</div>
    </div>
  );
}

/** The tile's placeholder: the same tile, so nothing moves when it lands. */
function StatSkeleton() {
  return (
    <div className="you-stat min-w-0 flex-1 rounded-card px-2.5 pb-2.5 pt-3 min-[360px]:px-3">
      <Skeleton className="h-2.5 w-12" />
      <Skeleton className="mt-1.5 h-[26px] w-10" />
      <Skeleton className="mt-1.5 h-3 w-8" />
    </div>
  );
}

/**
 * The plan row (#232): the portfolio's headline, the unit that trains
 * what was noticed, and how far its gate is. Opens the plan to change
 * an answer; a walk never taken opens the first question.
 */
function PlanRow({ state, stars }: { state: OnboardingState; stars: number | null }) {
  if (!state.done) {
    return (
      <Link
        href="/welcome?step=ageBand"
        className="press mt-7 flex min-h-11 items-center justify-between gap-3 border-t border-hairline py-3"
      >
        <span>
          <span className="label-data">Your plan</span>
          <span className="font-display mt-0.5 block text-[14px] font-bold">
            Five questions, then a first month.
          </span>
        </span>
        <span className="shrink-0 text-caption text-stone-500">Build it →</span>
      </Link>
    );
  }
  const plan = buildPortfolio(state.answers);
  const toGo =
    plan.focus && stars !== null ? Math.max(0, plan.focus.unlocksAt - stars) : null;
  return (
    <Link
      href="/welcome?step=plan"
      className="press mt-7 flex min-h-11 items-center justify-between gap-3 border-t border-hairline py-3"
    >
      <span className="min-w-0">
        <span className="label-data">Your plan</span>
        <span className="font-display mt-0.5 block truncate text-[14px] font-bold">
          {plan.headline}
        </span>
      </span>
      <span className="shrink-0 text-right text-caption text-stone-500 tabular-nums">
        {plan.focus
          ? toGo === null
            ? plan.focus.unitName
            : toGo === 0
              ? `${plan.focus.unitName} · open`
              : `${plan.focus.unitName} · ${toGo}★ to go`
          : "The road, one unit at a time"}
      </span>
    </Link>
  );
}
