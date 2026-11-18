"use client";

import { Disclosure } from "@/components/ui/Disclosure";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AchievementMark, IconGear, IconOnward, IconPencil } from "@/components/Icon";
import { StatIcon } from "@/components/StatIcon";
import { Overlay } from "@/components/ui/Overlay";
import { SheetHead } from "@/components/ui/SheetHead";
import { useYouAvatar } from "@/components/you/Avatar";
import { PremiumHave } from "@/components/premium/PremiumHave";
import { PremiumDoor, PremiumMark } from "@/components/PremiumMark";
import { CountUp } from "@/components/CountUp";
import { ErrorLine, ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Paywall } from "@/components/LazyPaywall";
import type { PaywallAsk } from "@/components/Paywall";
import { SayCard } from "@/components/say/SayCard";
import { ManageSheet } from "@/components/premium/ManageSheet";
import { CheckoutReturn, PriceDropSheet } from "@/components/premium/Moments";
import { PlanCard, PlanCardSkeleton } from "@/components/premium/PlanCard";
import { achievements } from "@/lib/achievements";
import { syncCoins } from "@/lib/coin-sync";
import { DURATION } from "@/lib/motion";
import {
  fetchProfile,
  fetchRepSpine,
  fetchReps,
  fetchXp,
  updateDisplayName,
  type RepRow,
  type RepSpine,
  heldPremium,
  heldProfile,
  heldReps,
  heldSpine,
  heldXp,
  type XpRead,
} from "@/lib/client-data";
import {
  levelLine as traitLevelLine,
  rankedTraits,
  traitLevels,
  xpLine,
  type TraitLevel,
} from "@/lib/traits";
import { LevelMeter } from "@/components/ui/LevelMeter";
import { practiseHref, practiseLabel, sheetReading } from "@/lib/trait-sheet";
import { DIMENSION_NAME } from "@/lib/dimension-rows";
import { lessonProgress } from "@/lib/lesson-progress";
import { TRAIT, type TraitId } from "@/content/traits";
import { heldFreezes, syncFreezes } from "@/lib/freeze-sync";
import { GUEST_KEY, held, heldMark, hold } from "@/lib/held";
import { localSessionState } from "@/lib/auth";
import { useRevalidate } from "@/lib/use-revalidate";
import { useStill, useWarm } from "@/lib/use-warm";
import { barLabel, bestFlame, levelLine, reachLine, streakFlame, xpStanding, type Flame } from "@/lib/xp";
import { readable, readFailure, withTimeout } from "@/lib/load";
import { cleanName, MAX_NAME, readOnboarding, type OnboardingState } from "@/lib/answers";
import { ROAD_INVITE, ROAD_INVITE_STEP } from "@/lib/onboarding";
import { syncOnboarding } from "@/lib/answers-sync";
import { buildPortfolio } from "@/lib/portfolio";
import { traitForSaid } from "@/lib/lesson-up-next";
import {
  computeStreak,
  type StreakState,
} from "@/lib/streak";
import { ACTION_CLASS, INPUT_CLASS } from "@/lib/ui";
import { CHECKOUT_COPY, CODE_EXPLORE, CODE_LINE, hasPlan } from "@/lib/plan-view";
import { prefersReducedMotion } from "@/lib/prefs";
import { usePlan, usePriceDrop, useStripeReturn, useStripeReturns, type ProfileRead } from "@/lib/use-plan";
import { usePaywallReturn } from "@/lib/use-paywall-return";
import { asTitle } from "@/lib/title";
import { dayKey } from "@/lib/streak-moment";
import { claimXpTicks, tickClimb } from "@/lib/use-sound-cues";

/** The nine rows the Traits list always draws (lib/traits.ts TRAITS). */
const TRAIT_ROWS_FREE = 5;

/**
 * The traits the lessons teach, each with its tone (`[data-trait]`).
 * A toned row takes the lesson's name for it too (Pausing, Sentence
 * restarts, Variety), so the colour and the word match /lessons and Today; the
 * four the Index only reads keep the Index's names.
 */
const TONED = new Set<string>(["pause", "fillers", "repairs", "pace", "range"]);
const isToned = (key: string): key is TraitId => TONED.has(key);

/** Whether this session is a guest's, as this visit last asked (lib/held.ts). */

const EMPTY_STREAK: StreakState = {
  current: 0,
  longest: 0,
  atRisk: false,
  didToday: false,
  frozenInRun: 0,
};

/**
 * A secondary door on this page: the surface fill is its edge (you-9,
 * Wellspoken), the label on the left and the chevron on the right.
 */
const DOOR_CLASS =
  "press font-display flex min-h-11 w-full items-center justify-between gap-3 rounded-control bg-surface px-4 py-3 text-left text-row";

/**
 * The profile.
 *
 * One identity card (M09, Imprint's Me; one card again since #485): your
 * photo and name, your level and the bar to the next with what pays it,
 * then three numbers, each beside its mark. Everything under it is a
 * section title and its rows on the ground (DECISIONS #151).
 *
 * The copy pass took the paragraphs away. Coin economics live in the
 * shop, freeze rules live at the moment a freeze is earned or spent
 * (COPY-RULES.md, DECISIONS #150).
 */
/* XP today ticks as it counts up, when it rose since this phone last
   heard it (#505): XP earned is a win, opening You is not. */
function xpClimb(from: number, to: number, durationMs: number): (() => void) | void {
  return claimXpTicks(to, dayKey(new Date())) ? tickClimb(from, to, durationMs) : undefined;
}

export default function YouPage() {
  /**
   * `null` until the fetch lands, NOT `[]`. Starting empty meant this
   * page rendered "Level 1, 0 XP, 0-day streak" for a few hundred
   * milliseconds to someone who might have a hundred recordings:
   * numbers that were not true. The card holds each line's exact
   * height with a bar instead, and `lib/load` is what lets them end.
   */
  /*
   * What this visit last read (#433, lib/held.ts): You opens on its
   * numbers, its name and its words in the first frame and reads them
   * again behind that. Never while the server's page hydrates (`warm`).
   * The plan's own row is not held: a price is read, never remembered.
   */
  const warm = useWarm();
  const heldAccount = warm ? heldProfile() : undefined;
  const [reps, setReps] = useState<RepRow[] | null>(() => (warm && heldSpine() ? heldReps() : null));
  /** Every recording, a few columns each: the lifetime numbers. */
  const [spine, setSpine] = useState<RepSpine[]>(() => (warm ? heldSpine() : null) ?? []);
  /** The numbers are on screen: a later read is quiet, and its failure leaves them. */
  const drawn = useRef(reps !== null);
  useStill(drawn.current);
  const [failed, setFailed] = useState(false);
  const [allBadges, setAllBadges] = useState(false);
  /**
   * `null` until the XP read lands, for the same reason `reps` is: the
   * level and "XP this week" are derived from it, and a zero that has
   * not arrived yet would COUNT UP to the truth a moment later. A failed
   * read shows a dash and a retry, never Level 1.
   */
  const [xp, setXp] = useState<XpRead | null>(() => (warm ? heldXp() : null));
  const xpDrawn = useRef(xp !== null);
  const [xpFailed, setXpFailed] = useState(false);
  const [anon, setAnon] = useState<boolean | null>(() => (warm ? (held<boolean>(GUEST_KEY) ?? null) : null));
  const [paywall, setPaywall] = useState<PaywallAsk | null>(null);
  /* Coins and freezes still sync (the streak's freezes are real), but
     neither is drawn here since 26 Sep: the shop and the freeze shelf
     left the profile on Timothy's call (#317). */
  const [, setCoins] = useState<number | null | undefined>(undefined);
  /** The trait whose sheet is open. */
  const [openTrait, setOpenTrait] = useState<TraitLevel | null>(null);
  const [streak, setStreak] = useState<StreakState>(() => {
    const all = warm ? heldSpine() : null;
    if (!all) return EMPTY_STREAK;
    return heldFreezes()?.streak ?? computeStreak(all.map((r) => new Date(r.created_at)));
  });
  /** `undefined` pending, `null` failed: the same split as `coins`. */
  const [, setFreezes] = useState<{
    equipped: number;
    used: number;
  } | null | undefined>(undefined);
  /** `null` until the profile answers, so "Add your name" can't flash
      over a name that merely hasn't arrived. */
  const [name, setName] = useState<string | null>(heldAccount?.display_name ?? null);
  const [nameKnown, setNameKnown] = useState(heldAccount !== undefined);
  /** The plan: null until the profile answers, and on a failed read.
   *  Unknown is never free (#353). */
  const [premium, setPremium] = useState<boolean | null>(() => (warm ? heldPremium() : null));
  /** The introduction's answers (#232): undefined until the device has been read. */
  const [onboarding, setOnboarding] = useState<OnboardingState | undefined>(undefined);
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");
  const [nameFailed, setNameFailed] = useState(false);

  /*
   * The plan (docs/ladder-spec.md, surface 2). The profile read above
   * says code or free; the billing row says everything else. Unknown
   * until both land, and drawn as the card's skeleton, never the free
   * door. Back from Checkout, one sync switches Premium on and the
   * first step is celebrated in the card's place; back from the portal,
   * one sync quietly takes the row Stripe now has.
   */
  const [profileRead, setProfileRead] = useState<ProfileRead>(heldAccount === undefined ? "loading" : heldAccount);
  const plan = usePlan(profileRead);
  const stripeReturn = useStripeReturn();
  const { arrival, rereading } = useStripeReturns(stripeReturn, plan, setPremium);
  const [managing, setManaging] = useState(false);
  /** "Explore" beside an invite code's Premium: what it gives (#485). */
  const [exploring, setExploring] = useState(false);
  /* The photo on the card (#485): its coin, a failure's line, its sheet. */
  const avatar = useYouAvatar({ name, nameKnown });
  // Held back while any other sheet is up: two sheets at once is one
  // Escape for two and a scroll lock to unpick.
  const drop = usePriceDrop(
    plan.view,
    stripeReturn !== undefined &&
      stripeReturn !== "checkout" &&
      !managing &&
      !exploring &&
      !avatar.sheet &&
      paywall === null &&
      openTrait === null
  );
  const planSlot = useRef<HTMLDivElement>(null);
  // A page someone came back to from the paywall's account doors (or
  // Checkout's back arrow) opens the sheet again.
  usePaywallReturn(() => setPaywall({ reason: "Premium" }));

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

  function editName() {
    setDraft(name ?? "");
    setNameFailed(false);
    setEditingName(true);
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
    // Numbers on screen stay there while they are read again (#433).
    const quiet = drawn.current;
    if (!quiet) setReps(null);
    // The newest 90 whole rows for the traits and the badges, and every
    // recording's date and stars for the numbers that count from day one.
    const read = await readable(() => Promise.all([fetchReps(), fetchRepSpine()]));
    if (!read.ok) {
      // Only a screen with nothing to show says the read failed.
      if (!drawn.current) setFailed(true);
      return;
    }
    drawn.current = true;
    const [rows, all] = read.data;
    setSpine(all);
    setReps(rows);
    const dates = all.map((r) => new Date(r.created_at));
    // The bare count stands in only where no reconciled streak is drawn.
    if (!quiet) setStreak(computeStreak(dates));
    void loadFreezes(dates);
    // The coin sync pays new days, which are always among the newest, so
    // the 90 rows' dates suffice.
    void loadCoins(rows.map((r) => new Date(r.created_at)));
  }, [loadCoins, loadFreezes]);

  /* Under the page-level ceiling (readable): a read that fails or never
     answers ends in the ErrorLine and its retry, never Level 1, and never
     a skeleton for good (#147). Say it better reads its own (SayCard). */
  const loadXp = useCallback(async () => {
    setXpFailed(false);
    if (!xpDrawn.current) setXp(null);
    const read = await readable(fetchXp);
    if (read.ok) {
      xpDrawn.current = true;
      setXp(read.data);
    } else if (!xpDrawn.current) setXpFailed(true);
  }, []);
  // Looked at again after a while, or back on the network: read again, quietly.
  useRevalidate(() => {
    void load();
    void loadXp();
  });

  useEffect(() => {
    void load();
    void loadXp();
    setOnboarding(readOnboarding());
    // The profile decides code or free for the plan, so it takes the
    // page-level ceiling too: a read that never answers ends in the
    // plan's retry, never a skeleton for good.
    withTimeout(fetchProfile())
      .then((p) => {
        setName(p?.display_name ?? null);
        setNameKnown(true);
        setPremium(p?.premium ?? false);
        setProfileRead(p);
        return syncOnboarding().then(setOnboarding);
      })
      .catch(() => {
        /* The profile didn't load: the name stays unknown (never "Add
           your name" over one that exists), the plan stays unknown
           (never the free door), the answers still sync. */
        setProfileRead((r) => (r === "loading" ? "failed" : r));
        syncOnboarding().then(setOnboarding).catch(() => {});
      });
    // The guest flag from the session this phone holds, not the auth
    // server (#508): a line on screen, never a decision.
    const mark = heldMark();
    localSessionState()
      .then((s) => {
        const guest = s.signedIn ? s.anonymous : null;
        if (guest !== null) hold(GUEST_KEY, guest, mark);
        setAnon(guest);
      })
      // A failed ask leaves what the visit already knew.
      .catch(() => {});
  }, [load, loadXp]);

  /** The plan's read failed: read it again, and the profile with it if that was the one. */
  const retryPlan = () => {
    plan.retry();
    if (profileRead !== "failed") return;
    setProfileRead("loading");
    withTimeout(fetchProfile())
      .then((p) => {
        setProfileRead(p);
        setPremium(p?.premium ?? false);
      })
      .catch(() => setProfileRead("failed"));
  };

  /* Back from Checkout the plan is the news, and it lives at the foot of
     the page: bring it into view while Premium switches on, and again
     when the moment lands (only as far as it takes). While it switches,
     what lands above it (the recordings' card, the badges' bars, the
     account gate) pushes it down after the first scroll, so the page
     follows it on every resize until the person scrolls for themselves. */
  useEffect(() => {
    if (stripeReturn !== "checkout") return;
    const el = planSlot.current;
    if (!el) return;
    const go = () =>
      el.scrollIntoView({
        block: arrival === "switching" ? "center" : "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    const frame = requestAnimationFrame(go);
    const page = el.closest("main");
    if (arrival !== "switching" || !page || typeof ResizeObserver === "undefined") {
      return () => cancelAnimationFrame(frame);
    }
    let held = false;
    const hold = () => {
      held = true;
    };
    const ro = new ResizeObserver(() => {
      if (!held) go();
    });
    ro.observe(page);
    const opts = { passive: true } as const;
    window.addEventListener("wheel", hold, opts);
    window.addEventListener("touchstart", hold, opts);
    window.addEventListener("keydown", hold);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("wheel", hold);
      window.removeEventListener("touchstart", hold);
      window.removeEventListener("keydown", hold);
    };
  }, [stripeReturn, arrival]);

  /** The first step's moment holds the plan's place, and with it Demos. */
  const momentUp = arrival === "on" && !!plan.today && hasPlan(plan.view);

  /* The manage sheet closed over a card that is gone (a 409 found the
     plan ended): the focus the sheet gave back (to the card that opened
     it) had nowhere to land, so it goes to what holds the plan's place
     now, the door or the slot. Run after the commit that unmounts the
     sheet, whose own cleanup gives focus back first. */
  const wasManaging = useRef(false);
  useEffect(() => {
    if (managing) {
      wasManaging.current = true;
      return;
    }
    if (!wasManaging.current) return;
    wasManaging.current = false;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const slot = planSlot.current;
    const door = slot?.querySelector<HTMLElement>("button, a[href]");
    (door ?? slot)?.focus({ preventScroll: true });
  }, [managing]);

  /** The plan's slot is waiting on a read or a sync: its skeleton is up. */
  const planPending =
    arrival === "switching" ||
    (arrival === "slow" && rereading) ||
    (arrival !== "on" && !plan.failed && (plan.view.kind === "unknown" || !plan.today));

  const loading = reps === null;
  /** The level waits on the XP read; the streak columns on the reps. */
  const xpPending = xp === null && !xpFailed;
  const history = reps ?? [];
  /* Lifetime counts read every recording, not the newest 90. */
  const lifetime = reps === null ? [] : spine;
  const standing = xpStanding(xp?.total ?? 0);
  const badges = achievements(history);
  const earnedCount = badges.filter((b) => b.earned).length;
  /* The ladder past the next two not yet earned folds into one row
     (S12, E36: You was 2,293pt and then 2,063 against its 2,000): what
     you have, then what is next, then the count of the rest. */
  const shownBadges = (() => {
    if (loading) return badges;
    // Earned rows first, so the count reads at a glance and opening the
    // fold only adds rows under the ones already shown (F5).
    const ordered = [...badges.filter((b) => b.earned), ...badges.filter((b) => !b.earned)];
    return allBadges ? ordered : ordered.slice(0, earnedCount + 2);
  })();
  const foldedBadges = badges.length - shownBadges.length;

  // "Save your progress" gate: appears only after there IS progress
  // (DECISIONS #15: never before the first recording).
  const showGate = anon === true && lifetime.length >= 1;

  /* The gear sits on the large title's row (Imprint's Me, Wellspoken's
     s1) and its twin joins the bar once the title has handed
     over. The twin is mounted only from the first hand-over on, so at
     rest the page has one Settings link and the bar is empty. */
  const header = (
    <ScreenHeader
      title="You"
      trailing={<SettingsButton />}
      barTrailingOnCollapse
      barTrailing={
        /* mr-3: the bar's own 8px inset plus 12 puts the twin on the
           large title's 20px gutter, so the gear keeps its x. */
        <span className="mr-3 flex">
          <SettingsButton />
        </span>
      }
    />
  );

  /*
   * Every number on this page is derived from the reps, so an unread
   * history can't be drawn as a profile: it would be someone else's
   * profile, made of zeroes.
   */
  if (failed) {
    return (
      <main className="px-5 pb-[var(--nav-clear)] pt-7">
        {header}
        <ErrorState
          className="mt-5"
          {...readFailure("Your numbers")}
          onRetry={() => void load()}
        />
      </main>
    );
  }

  return (
    <main className="px-5 pb-[var(--nav-clear)] pt-7">
      {header}

      {/* The one card (#485, Timothy 16 Nov: "make it all one nice card
          ... rework the me card into all of that in one incl name"). It
          was the sky stage with Demos standing on it (the cohesion pass,
          26 Oct) over a second card of three bare numbers. Now it is
          Imprint's Me: one neutral card holding who you are (the photo
          and the name), where you stand (the level, the XP bar in XP's
          purple, how far the next level is and what pays it), and the
          three numbers, each with its mark. Demos is off it, and comes
          on You only at the moments (the price drop, the checkout's
          return). Every async line holds its exact height while it is in
          flight (`Line`), so nothing changes size when the numbers land. */}
      {/*
       * Say it better, the first card (#507, Timothy 18 Nov: "make it a
       * focus ... that's how you actually improve"). Above the identity
       * card, breaking #485's order on purpose: what improves speech
       * leads (#458's rule, taken one step further). The screen's one
       * lifted thing, holding its one tap (the day's test); while the
       * account gate holds the filled tap, its tap is the surface pill.
       */}
      <SayCard quiet={showGate} />

      <section aria-label="Your profile" data-look="you-card" className="card mt-3 p-5">
        <div className="flex items-center gap-4">
          {avatar.coin}
          <div className="min-w-0 flex-1">
            {editingName ? (
              <form
                className="flex flex-wrap items-center gap-2 text-left"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveName();
                }}
              >
                <input
                  autoFocus
                  name="displayName"
                  autoComplete="nickname"
                  /* A name is not a word to correct, and it starts with
                     a capital (#446). */
                  autoCapitalize="words"
                  autoCorrect="off"
                  enterKeyHint="done"
                  spellCheck={false}
                  aria-label="Display name"
                  maxLength={MAX_NAME}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Your name"
                  className={`${INPUT_CLASS} w-full min-w-0`}
                />
                <button
                  type="submit"
                  className="press font-display min-h-11 shrink-0 rounded-tap bg-surface px-4 text-row"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="text-link shrink-0 px-1"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                {/* The name: the one line on the card you type rather
                    than earn, in the detail type with its pencil. */}
                <div className="flex min-h-[22px] items-center">
                  {!nameKnown ? (
                    <Line className="font-display text-detail" bar="w-20" align="left" />
                  ) : name ? (
                    <>
                      <span className="font-display min-w-0 truncate text-detail">{name}</span>
                      {/* 14px of pencil, a 44px target: the padding is the
                          hit area and the negative margin gives it back. */}
                      <button
                        type="button"
                        onClick={editName}
                        aria-label="Edit your name"
                        className="press -my-[15px] -ml-1.5 -mr-[15px] shrink-0 rounded-control p-[15px] text-stone-500"
                      >
                        <IconPencil size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={editName}
                      className="press -my-3 -ml-2 flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-2 text-stone-500"
                    >
                      <span className="font-display text-detail">Add your name</span>
                      <IconPencil size={14} />
                    </button>
                  )}
                </div>
                {/* The level outranks everything else on the card, 26/800. */}
                {xpPending ? (
                  <Line className="font-display text-title font-extrabold" bar="w-24" align="left" />
                ) : (
                  <h2 className="font-display text-title font-extrabold tabular-nums">
                    Level{" "}
                    {xpFailed ? "–" : <CountUp value={standing.level} durationMs={DURATION.max} />}
                  </h2>
                )}
              </>
            )}
          </div>
        </div>

        {/* The bar to the next level, and its two lines: how far, in XP
            (Timothy: "40 of 50 to level 2" asked the reader to do the
            sum), then what reaches it, from what pays (lib/xp.ts). The
            trough paints at once; the bar fills when its number has
            landed (#225), in XP's purple (--xp). */}
        <div className="mt-4">
          <div
            role="img"
            aria-label={xp ? barLabel(xp.total) : "XP to the next level"}
            className="h-2 w-full overflow-hidden bg-sand"
          >
            {xp && <div className="fill xp-fill h-full" style={{ width: `${standing.fraction * 100}%` }} />}
          </div>
          {xpPending ? (
            <>
              <Line className="font-display mt-2 text-row font-bold" bar="w-32" align="left" />
              <Line className="mt-0.5 text-caption" bar="w-44" align="left" />
            </>
          ) : xpFailed ? (
            <ErrorLine className="mt-2" onRetry={() => void loadXp()}>
              Your XP didn&apos;t load.
            </ErrorLine>
          ) : (
            <>
              <p data-look="level-line" className="font-display mt-2 text-row font-bold tabular-nums">
                {levelLine(xp?.total ?? 0)}
              </p>
              {/* Which line it is ("Today's practice" or "One more
                  recording") rests on whether today is spoken, which only
                  the recordings know: until they are read the line holds
                  its place, so it never says one and then the other. */}
              {loading ? (
                <Line className="mt-0.5 text-caption" bar="w-44" align="left" />
              ) : (
                <p data-look="reach-line" className="mt-0.5 text-caption text-stone-500">
                  {reachLine(xp?.total ?? 0, streak.didToday)}
                </p>
              )}
            </>
          )}
        </div>

        {/* The three numbers, each beside its mark (Timothy: "icons next
            to the stats"): the streak's flame grey until today is spoken
            and lit after, the best streak's lit, and the XP today with
            XP's own mark. */}
        <div role="group" aria-label="Your numbers" className="mt-5 grid grid-cols-3">
          <Stat
            label="Streak"
            value={loading ? undefined : streak.current}
            mark={<StatIcon kind="streak" lit={streakFlame(streak.current, streak.didToday) === "lit"} size={22} />}
            flame={streakFlame(streak.current, streak.didToday)}
            said={streak.didToday ? "spoken today" : "not spoken today yet"}
          />
          <Stat
            label="Best streak"
            value={loading ? undefined : streak.longest}
            mark={<StatIcon kind="best" lit={bestFlame(streak.longest) === "lit"} size={22} />}
            flame={bestFlame(streak.longest)}
          />
          <Stat label="XP today" value={xpFailed ? null : xp?.today} mark={<StatIcon kind="xp" size={22} />} onClimb={xpClimb} />
        </div>
      </section>
      {nameFailed && (
        <ErrorLine className="mt-2" onRetry={() => void saveName()}>
          Your name didn&apos;t save.
        </ErrorLine>
      )}
      {avatar.problem}

      {showGate && (
        /* p-5 and a detail head: the account gate, straight under the
           numbers since Day 1 vs now went (#458). */
        <section className="card mt-3 p-5">
          <h2 className="detail-head">Save your progress</h2>
          <p className="mt-1 text-caption text-stone-500">
            {lifetime.length} recording{lifetime.length === 1 ? "" : "s"}
            {streak.current > 0 &&
              ` and ${/^(8|11|18|8\d)$/.test(String(streak.current)) ? "an" : "a"} ${streak.current}-day streak`}{" "}
            live
            on this device. An account keeps them.
          </p>
          <Link href="/signup" className={`${ACTION_CLASS} mt-3`}>
            Create my account
          </Link>
          <div className="mt-3 text-center">
            <Link href="/signin" className="text-link text-terracotta-700">
              I already have one
            </Link>
          </div>
        </section>
      )}

      {/* The road (#232, D36): its headline and the unit for what was
          noticed, as its own card door, because an answer is allowed to
          change. "Plan" is left to Premium. Its three lines are reserved
          while the device is read. */}
      {onboarding === undefined ? (
        <div aria-hidden className="card mt-7 p-4 text-left">
          <Line className="eyebrow" bar="w-16" align="left" />
          <Line className="font-display mt-0.5 text-row" bar="w-40" align="left" />
          <Line className="mt-0.5 text-caption" bar="w-32" align="left" />
        </div>
      ) : (
        <RoadCard state={onboarding} />
      )}

      {/*
       * Traits (#498): the nine Index dimensions as levels, filled by
       * trait XP (every scored recording pays each trait its score),
       * most XP first, derived from the reps on every load. They gate
       * nothing and feed nothing. A trait still at "Not yet" sits dimmed
       * at the bottom, the shelf's grammar (#153): the position is the
       * claim. Each row opens a sheet with what it measures, the XP
       * behind its bar and the rule that fills it (#317).
       */}
      <section className="mt-7">
        {/* "Trait levels" (E35): the bare numbers are levels you earned,
            never a score a tab away from Today's percentiles. */}
        <h2 className="section-head">Trait levels</h2>
        <div className="mt-3">
          {loading ? (
            <div aria-busy="true">
              {Array.from({ length: TRAIT_ROWS_FREE + 1 }, (_, i) => (
                <div key={i} className="flex min-h-11 items-center gap-3 py-2">
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
          ) : (
            (() => {
              const all = rankedTraits(traitLevels(history));
              /* D36: free shows the five traits the lessons teach and
                 folds the four the Index only reads into one door, which
                 still counts them; Premium shows all nine. */
              const ranked = premium === true ? all : all.filter((t) => TONED.has(t.key));
              const folded = all.length - ranked.length;
              const rows = ranked.map((t) => {
                const toned = TONED.has(t.key);
                const name = DIMENSION_NAME[t.key];
                return (
                  /* A trait the lessons teach wears its lesson tone on
                     its mark, so blue means pausing here as on /lessons
                     and Today; the name is ink. Its value is the level
                     in words with a small sage bar beside it, how far
                     into that level (#482, Timothy 16 Nov: "trait levels
                     as bars is bad"); the long bar scaled to the leader
                     is gone. The four the Index only reads take a stone
                     mark. The row's name says all of it, since a
                     button's inside is not read. */
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => setOpenTrait(t)}
                    aria-haspopup="dialog"
                    aria-label={`${name}, ${traitLevelLine(t).said}`}
                    data-trait={toned ? t.key : undefined}
                    className={`press -mx-2 flex min-h-11 w-[calc(100%+16px)] items-center gap-3 rounded-control px-2 py-2 text-left ${toned ? "you-trait" : ""}`}
                  >
                    {/* The accent rule (the cohesion pass): a taught
                        trait's colour is its 8px mark, nothing else. */}
                    <span
                      aria-hidden
                      className={toned ? "trait-dot" : "size-2 shrink-0 rounded-[2px] bg-stone-200"}
                    />
                    {/* 600, not 700: nine equally bold lines read as nine
                        headings and the section loses its leader (#234).
                        The name is ink at every level (#496): at level 0
                        it was stone and read as a disabled row beside a
                        bar with fill; only "Level 0" is quiet. */}
                    <span className="font-display -ml-1 min-w-0 flex-1 truncate text-row font-semibold">{name}</span>
                    <LevelMeter
                      name={name}
                      level={t.level}
                      percent={t.percent}
                      count={<CountUp value={t.level} durationMs={DURATION.max} />}
                    />
                  </button>
                );
              });
              return (
                <>
                  {rows}
                  {premium === null ? (
                    /* The plan is in flight: the fold's height, held. */
                    <div aria-hidden className="flex min-h-11 items-center py-2">
                      <Skeleton className="h-5 w-full" />
                    </div>
                  ) : (
                    folded > 0 && (
                      /* The fold's grammar: the count in words,
                         the mark, the chevron, a door to the sheet. The
                         mark names the tier, so the words do not. */
                      <button
                        type="button"
                        onClick={() => setPaywall({ reason: "All nine skills" })}
                        data-look="traits-fold"
                        className="press -mx-2 flex min-h-11 w-[calc(100%+16px)] items-center justify-between gap-3 rounded-control px-2 py-2 text-left text-row font-semibold text-stone-500"
                      >
                        <span>
                          {folded} more trait{folded === 1 ? "" : "s"}
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <PremiumMark variant="chip" />
                          <Disclosure />
                        </span>
                      </button>
                    )
                  )}
                </>
              );
            })()
          )}
        </div>
      </section>

      {/* The league card sat here until 27 Aug: shelved (Timothy's call,
          #173) until there are users to rank. lib/level.ts and xp_events
          stay; a future league reads them unchanged. */}

      {/*
       * The shelf. A ladder, not a grid: hardest last, no tier labels,
       * because the position is the claim. Every row is a link to the
       * lesson that produces its number: a locked badge that only
       * describes itself is a taunt (DECISIONS #153). Its count waits
       * for the reps, so it is never a 0 that hasn't been read.
       */}
      <section className="mt-7">
        <h2 className="section-head">
          Earned
          {!loading && (
            <span className="section-head-count">
              {earnedCount}/{badges.length}
            </span>
          )}
        </h2>
        {/* An open list on the ground (E11), Trait levels' grammar: no card, no tile inside it, and since #454
            no rule between rows. A badge part earned draws its progress
            along the row's foot, and a hairline under that was two lines
            for one row; the mark, the two lines of words and 56px a row
            keep them apart. The rows' own 12px top padding is the head's
            mt-3. */}
        <div className="stagger" aria-busy={loading || undefined}>
          {shownBadges.map((a) => {
            const earned = !loading && a.earned;
            return (
              <Link
                key={a.id}
                href={a.href}
                className="press-row flex min-h-14 items-center gap-3.5 py-3"
              >
                {/* The bare mark at 24 (E11): sage when earned, the
                    accent rule's one colour for it; stone while not. */}
                <span
                  aria-hidden
                  className={`flex size-6 shrink-0 items-center justify-center ${
                    earned ? "text-sage-600" : "text-stone-400"
                  }`}
                >
                  <AchievementMark name={a.icon} size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`font-display block text-row ${
                      earned ? "" : "text-stone-500"
                    }`}
                  >
                    {a.name}
                  </span>
                  <span className="mt-0.5 block text-caption text-stone-400">
                    {a.requirement}
                    {/* Earned or not is the mark's colour and nothing
                        else, so it is also said (#448). */}
                    {!loading && (
                      <span className="sr-only">
                        {a.earned
                          ? ". Earned."
                          : a.progress > 0
                            ? `. Not earned yet, ${Math.round(a.progress * 100)}% of the way.`
                            : ". Not earned yet."}
                      </span>
                    )}
                  </span>
                  {!loading && !a.earned && a.progress > 0 && (
                    <span className="mt-1.5 block h-1 overflow-hidden bg-sand">
                      {/* The trough is drawn by the row; the bar only exists
                          once there is progress to report, so its `.fill`
                          runs on the read landing and never over a
                          placeholder (#225). How close you are is the row's
                          one number, so the fill holds 3:1 on its trough
                          (`.you-near`); the mark and the name stay muted. */}
                      <span
                        className="you-near fill block h-full"
                        style={{ width: `${Math.round(a.progress * 100)}%` }}
                      />
                    </span>
                  )}
                </span>
                <Disclosure />
              </Link>
            );
          })}
          {foldedBadges > 0 && (
            /* The last row: the count in the names' column. */
            <button
              type="button"
              onClick={() => setAllBadges(true)}
              className="press-row flex min-h-14 w-full items-center gap-3.5 py-3 text-left"
            >
              <span aria-hidden className="w-6 shrink-0" />
              <span className="font-display min-w-0 flex-1 text-row text-stone-500">
                {foldedBadges} more to earn
              </span>
              {/* It opens here, so the mark points down, not on. */}
              <Disclosure className="rotate-90 text-stone-400" />
            </button>
          )}
        </div>
      </section>

      {/* The plan's place, last on the page. Free, or a plan that
          ended, keeps the one standing door to the sheet (docs/growth/04
          §4.1): a quiet row, never a card, the tier in its word and its
          door mark in plum (PRINCIPLES 2). An invite code keeps its one
          line. A plan is the card (docs/ladder-spec.md, surface 2), and
          while the plan is unknown its skeleton holds the card's height:
          never the free door, never A$0.00. The live region says each
          step of a checkout return once. */}
      <div
        ref={planSlot}
        tabIndex={-1}
        data-look="plan-slot"
        aria-busy={planPending || undefined}
        className="mt-7 scroll-mt-24 scroll-mb-28 outline-none!"
      >
        <p role="status" className="sr-only">
          {arrival === "switching"
            ? CHECKOUT_COPY.switching
            : arrival === "on"
              ? CHECKOUT_COPY.on
              : arrival === "slow"
                ? CHECKOUT_COPY.slow
                : ""}
        </p>
        {arrival === "switching" || (arrival === "slow" && rereading) ? (
          <PlanCardSkeleton status={arrival === "switching" ? CHECKOUT_COPY.switching : CHECKOUT_COPY.slow} />
        ) : momentUp && plan.today ? (
          <CheckoutReturn view={plan.view} today={plan.today} />
        ) : (
          <>
            {arrival === "slow" && (
              <p aria-hidden className="mb-3 text-caption text-pretty text-stone-500">
                {CHECKOUT_COPY.slow}
              </p>
            )}
            {/* Named for its card: "Your plan" on this page is the
                practice plan in the identity card. */}
            {plan.failed ? (
              <ErrorLine onRetry={retryPlan}>Premium didn&apos;t load.</ErrorLine>
            ) : plan.view.kind === "unknown" || !plan.today ? (
              <PlanCardSkeleton />
            ) : hasPlan(plan.view) ? (
              <div className="arrive">
                <PlanCard view={plan.view} today={plan.today} onOpen={() => setManaging(true)} />
              </div>
            ) : plan.view.kind === "code" ? (
              /* Premium by invite code (#485, Timothy 16 Nov: "yay! Youve
                 got premium 🎉 Explore ->"). His words, his emoji, then
                 the door to what Premium gives (PremiumHave), the tier
                 named in plum as every Premium door is. */
              <div className="flex min-h-11 items-center justify-between gap-3">
                <p data-look="premium-on" className="font-display text-row">
                  {CODE_LINE}
                </p>
                <button
                  type="button"
                  data-look="premium-explore"
                  aria-haspopup="dialog"
                  onClick={() => setExploring(true)}
                  className="press font-display -mr-2 flex min-h-11 shrink-0 items-center gap-1 rounded-control px-2 text-row text-plum-700"
                >
                  {CODE_EXPLORE}
                  <IconOnward size={16} />
                </button>
              </div>
            ) : arrival === "slow" ? null : (
              /* Free, or a plan that ended. Not under "Your payment went
                 through": a door that sells the plan again to someone who
                 just paid. The caption stands alone for this visit. */
              <button
                type="button"
                onClick={() => setPaywall({ reason: "Premium" })}
                className={DOOR_CLASS}
              >
                <PremiumDoor className="text-plum-700">Premium</PremiumDoor>
                <Disclosure />
              </button>
            )}
          </>
        )}
      </div>

      {exploring && <PremiumHave onClose={() => setExploring(false)} />}

      {avatar.sheet}

      {openTrait && (
        <TraitSheet trait={openTrait} reps={history} done={lessonProgress(lifetime)} onClose={() => setOpenTrait(null)} />
      )}

      {paywall && (
        <Paywall
          reason={paywall.reason}
          headline={paywall.headline}
          onClose={() => setPaywall(null)}
        />
      )}

      {managing && plan.today && (
        <ManageSheet
          view={plan.view}
          today={plan.today}
          onClose={() => setManaging(false)}
          onPlan={(row, isPremium) => {
            plan.adopt(row, isPremium);
            setPremium(isPremium);
          }}
        />
      )}

      {drop.open && plan.today && (
        <PriceDropSheet view={plan.view} today={plan.today} from={drop.from} onClose={drop.close} />
      )}
    </main>
  );
}

/**
 * Settings: the gear on its own (#485, Timothy 16 Nov: "remove the
 * square around the settings icon, js have the icon by it self"), as
 * Imprint's Me and the phone's own bars draw it. 24px in ink, in a 44px
 * target whose negative margin keeps the glyph's right edge on the
 * title's 20px gutter.
 */
function SettingsButton() {
  return (
    <Link
      href="/settings"
      aria-label="Settings"
      data-look="settings-gear"
      className="press -mr-2.5 flex size-11 items-center justify-center rounded-control text-ink"
    >
      <IconGear size={24} />
    </Link>
  );
}

/**
 * One line of type with its words invisible and a bar where they would
 * be: the line's own font, size and leading, so a placeholder is exactly
 * the height of what replaces it (PRINCIPLES 8).
 */
function Line({
  className,
  bar,
  align = "center",
  text = "Ag",
}: {
  className: string;
  bar: string;
  align?: "center" | "left";
  text?: string;
}) {
  return (
    <span aria-hidden className={`relative block ${className}`}>
      <span className="invisible">{text}</span>
      <Skeleton
        className={`absolute inset-y-[18%] ${
          align === "center" ? "left-1/2 -translate-x-1/2" : "left-0"
        } ${bar}`}
      />
    </span>
  );
}

/**
 * A number and its label in a column (Imprint's Me), the number beside
 * its mark (#485, Timothy: "icons next to the stats"): the label says
 * what the number counts and in what (you-12), so there is no unit line.
 * `undefined` is still in flight (a bar at the number's height), `null`
 * failed (a dash): never a zero that wasn't read. The value counts up
 * when it lands, which is the measurement arriving, never a re-run over
 * a figure that was already on the screen.
 *
 * The marks are #487's 3D icons (`StatIcon`): a flame lit, or the same
 * flame greyed by `--stat-unlit`, which differ in lightness as well as
 * colour and stay apart in Greyscale (lib/stat-icons.test.ts, #453's
 * rule); the best streak's crowned flame; XP's bolt. `said` is what the
 * mark means, for a screen reader.
 */
function Stat({
  label,
  value,
  mark,
  flame,
  said,
  onClimb,
}: {
  label: string;
  value: number | null | undefined;
  mark: React.ReactNode;
  flame?: Flame;
  said?: string;
  /** XP today's ticks as it counts up (#505). */
  onClimb?: (from: number, to: number, durationMs: number) => (() => void) | void;
}) {
  const tone = flame === undefined ? "xp-ink" : flame === "lit" ? "streak-lit" : "text-stone-400";
  return (
    <div className="min-w-0 text-center">
      {value === undefined ? (
        <Line className="font-display text-num-m" bar="w-12" text="0" />
      ) : (
        <div className="font-display flex items-center justify-center gap-1.5 text-num-m tabular-nums">
          <span aria-hidden data-flame={flame} className={`flex shrink-0 ${tone}`}>
            {mark}
          </span>
          <span>{value === null ? "–" : <CountUp value={value} durationMs={DURATION.max} onClimb={onClimb} />}</span>
        </div>
      )}
      {/* One line in every column at every width (D10, D36). Sentence
          case: in capitals the three took the viewport's whole budget of
          capitals. The label is drawn in both states, so the placeholder
          is the same height. */}
      <div className="font-display mt-1 whitespace-nowrap text-caption font-semibold text-stone-500">
        {label}
        {said && <span className="sr-only">, {said}</span>}
      </div>
    </div>
  );
}

/** The road's card: its own door (D36). */
const ROAD_CARD = "card press mt-7 flex min-h-11 items-center gap-3 p-4 text-left";

/**
 * The road (#232, D36): the portfolio's headline and the unit for what
 * was noticed. Opens the plan to change an answer; a walk never taken
 * opens the first question. Its eyebrow is "The road": "Your plan"
 * echoed the paid plan's card further down. Its caption counted the
 * stars to the unit's gate ("Pace Control opens in 4 stars") until #486,
 * which took the total of every lesson's stars off every screen
 * (Timothy, 16 Nov: "Total stars is a useless feature"): a count to a
 * gate is that total by another name. The caption names the trait as
 * Lessons heads its section (#493; it named the road's unit, which no
 * tab lists), and check-onboarding reads it.
 */
function RoadCard({ state }: { state: OnboardingState }) {
  if (!state.done) {
    return (
      <Link href={`/welcome?step=${ROAD_INVITE_STEP}`} className={ROAD_CARD}>
        <span className="min-w-0 flex-1">
          <span className="eyebrow block">The road</span>
          <span className="font-display mt-0.5 block text-row">
            {ROAD_INVITE}
          </span>
        </span>
        <Disclosure />
      </Link>
    );
  }
  const plan = buildPortfolio(state.answers);
  const trait = traitForSaid(plan.focus?.said);
  return (
    <Link href="/welcome?step=plan" className={ROAD_CARD}>
      <span className="min-w-0 flex-1">
        <span className="eyebrow block">The road</span>
        {/* The plan's headline is Demos's line in the introduction; here
            it is the card's title, so its full stop goes (lib/title.ts). */}
        <span className="font-display mt-0.5 block truncate text-row">
          {asTitle(plan.headline)}
        </span>
        {/* What it is for, as Lessons names it (#493): the trait's own
            section there, its swatch and its name. It named the road's
            unit ("Filler Elimination"), which no tab shows. A pain no
            trait measures (trailing off, rambling) says nothing here. */}
        {trait && (
          <span data-trait={trait} className="mt-0.5 flex items-center gap-2 text-caption text-stone-500">
            <span aria-hidden className="trait-dot" />
            <span className="truncate">{TRAIT[trait].name}</span>
          </span>
        )}
      </span>
      <Disclosure />
    </Link>
  );
}

/* The four the Index reads but no lesson teaches, in one line each. */
const WHAT: Record<string, string> = {
  structure: "Whether the answer has a point, support for it, and an ending.",
  credibility: "Whether you state things as known, without hedging them away.",
  engagement: "Whether a listener would stay with you to the last line.",
  confidence: "How even your delivery holds from the first word to the last.",
};

/**
 * A trait, explained where you asked (26 Sep, Timothy: "trait click to
 * pop up explanation", #317), and since D37 how you speak it: the last
 * reading in its own unit and where it places you, what it measures,
 * the level with the rule that moves it, and for the five the lessons
 * teach, the way to practise it. COPY-RULES: the mechanic is explained
 * at the moment somebody reaches for it, never printed on the page.
 *
 * It closes with Done at the top right, as every information sheet does
 * (D15). Its "Practise" covers You's own tap (Say it better's test), so each visible
 * layer still has one tap.
 */
function TraitSheet({
  trait,
  reps,
  done,
  onClose,
}: {
  trait: TraitLevel;
  reps: RepRow[];
  /** Practices recorded per lesson, every recording counted, so Practise opens the next one. */
  done: Record<string, number>;
  onClose: () => void;
}) {
  const toned = isToned(trait.key);
  /* The skill's name, as the row that opened it prints it (#471). */
  const name = DIMENSION_NAME[trait.key];
  const what = toned ? TRAIT[trait.key as TraitId].what : WHAT[trait.key];
  const reading = sheetReading(trait.key, reps);
  const practise = practiseHref(trait.key, done);
  return (
    <Overlay label={name} onClose={onClose}>
      <div
        data-trait={toned ? trait.key : undefined}
        className="elev-3 w-full max-w-[430px] rounded-t-sheet bg-raised px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2"
      >
        <SheetHead onClose={onClose} />
        <div className="eyebrow flex items-center gap-1.5">
          {toned && <span aria-hidden className="trait-dot" />}
          Trait
        </div>
        <h2 className="font-display mt-1 text-title font-extrabold">{name}</h2>
        {/* How you speak it, before what it is (D37): the number at
            num-l with its unit, then where it places you. */}
        <p className="mt-3 flex items-baseline gap-1.5">
          <span className="font-display text-num-l tabular-nums">{reading ? reading.value : "–"}</span>
          {reading && <span className="font-display text-body font-semibold text-stone-500">{reading.unit}</span>}
        </p>
        {/* Where it places you, in words that carry which way is better
            (#471: "93rd percentile" beside Fillers read as more fillers
            than nearly everyone), then what that is measured against,
            once, here where a percentile is reached for. A judged trait
            has no percentile: its band, in the band's own colour. */}
        {reading?.placement && (
          <p
            data-place
            className={`font-display text-link ${
              reading.source
                ? "text-stone-500"
                : reading.placement === "Strong"
                  ? "text-sage-700"
                  : reading.placement === "Okay"
                    ? "text-stone-500"
                    : "text-ink"
            }`}
          >
            {reading.placement}
          </p>
        )}
        {reading?.source && (
          <p data-place-source className="mt-1 text-caption text-stone-400 text-pretty">
            {reading.source}
          </p>
        )}
        <p className="mt-4 text-read text-stone-800 text-pretty">{what}</p>
        {/* The level as the row printed it, "Level 6" and its bar (#482),
            then the XP the bar is drawn from, so it traces to numbers
            ("370 XP to level 7. Last recording +45.", #498), then the rule
            that fills it, under the trait's own name: trait XP is only
            ever said inside its trait, never added up, so it is never
            read as the card's purple XP. */}
        <div className="mt-4">
          <LevelMeter name={name} level={trait.level} percent={trait.percent} size="sheet" />
          <p data-xp className="font-display mt-1 text-link tabular-nums text-stone-500">
            {xpLine(trait)}
          </p>
          <p data-rule className="mt-2 text-caption leading-relaxed text-stone-500 text-pretty">
            Each recording adds its {name} score as XP.
          </p>
        </div>
        {practise && (
          <Link href={practise} className={`${ACTION_CLASS} mt-6`}>
            {practiseLabel(trait.key)}
          </Link>
        )}
      </div>
    </Overlay>
  );
}
