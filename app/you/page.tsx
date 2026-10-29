"use client";

import { Disclosure } from "@/components/ui/Disclosure";
import { HeroStage } from "@/components/ui/HeroStage";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AchievementMark, IconFlame, IconGear, IconPencil } from "@/components/Icon";
import { Overlay } from "@/components/ui/Overlay";
import { YouDemos } from "@/components/you/YouDemos";
import { PremiumDoor, PremiumMark } from "@/components/PremiumMark";
import { CountUp } from "@/components/CountUp";
import { ErrorLine, ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Paywall, type PaywallAsk } from "@/components/Paywall";
import { LexiconFlash } from "@/components/LexiconFlash";
import { ShareCard } from "@/components/ShareCard";
import { ManageSheet } from "@/components/premium/ManageSheet";
import { CheckoutReturn, PriceDropSheet } from "@/components/premium/Moments";
import { PlanCard, PlanCardSkeleton } from "@/components/premium/PlanCard";
import { achievements } from "@/lib/achievements";
import { syncCoins } from "@/lib/coin-sync";
import { limit } from "@/lib/entitlement";
import { DURATION } from "@/lib/motion";
import {
  fetchLexicon,
  fetchProfile,
  fetchRepSpine,
  fetchReps,
  fetchXp,
  updateDisplayName,
  type LexiconRow,
  type RepRow,
  type RepSpine,
} from "@/lib/client-data";
import { LEVEL_AT, DOUBLE_AT, rankedTraits, traitLevels, type TraitLevel } from "@/lib/traits";
import { TRAIT, type TraitId } from "@/content/traits";
import { syncFreezes } from "@/lib/freeze-sync";
import { levelFromXp } from "@/lib/level";
import { readable, readFailure, withTimeout } from "@/lib/load";
import { starsByLesson, totalStars } from "@/lib/path";
import { cleanName, MAX_NAME, readOnboarding, type OnboardingState } from "@/lib/answers";
import { syncOnboarding } from "@/lib/answers-sync";
import { buildPortfolio } from "@/lib/portfolio";
import {
  computeStreak,
  type StreakState,
} from "@/lib/streak";
import { ACTION_CLASS, INPUT_CLASS } from "@/lib/ui";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { CHECKOUT_COPY, CODE_LINE, hasPlan } from "@/lib/plan-view";
import { prefersReducedMotion, readPrefs } from "@/lib/prefs";
import { adoptAccountPose } from "@/lib/pose-save";
import type { CoinRow } from "@/lib/coins";
import { usePlan, usePriceDrop, useStripeReturn, useStripeReturns, type ProfileRead } from "@/lib/use-plan";
import { usePaywallReturn } from "@/lib/use-paywall-return";

// Free tier gets today's swap, not the archive, when the paywall is on.
const FREE_LEXICON = 3;

/** The nine rows the Traits list always draws (lib/traits.ts TRAITS). */
const TRAIT_ROWS = 9;

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
 * A secondary door on this page: the surface fill is its edge (you-9,
 * Wellspoken), the label on the left and the chevron on the right.
 */
const DOOR_CLASS =
  "press font-display flex min-h-11 w-full items-center justify-between gap-3 rounded-control bg-surface px-4 py-3 text-left text-row";

/**
 * The profile.
 *
 * One identity card (M09, Imprint's Me): Demos on a sky coin, your name,
 * your level and the bar to the next, then three numbers in bare columns
 * and the plan row. It replaced five containers (a lifted card, the sun
 * stage inside it, a rule, the plan's rule and three sage tiles) that
 * told one identity in five recipes. Everything under it is a section
 * title and its rows on the ground (DECISIONS #151).
 *
 * The copy pass took the paragraphs away. Coin economics live in the
 * shop, freeze rules live at the moment a freeze is earned or spent
 * (COPY-RULES.md, DECISIONS #150).
 */
export default function YouPage() {
  /**
   * `null` until the fetch lands, NOT `[]`. Starting empty meant this
   * page rendered "Level 1, 0 XP, 0-day streak" for a few hundred
   * milliseconds to someone who might have a hundred recordings:
   * numbers that were not true. The card holds each line's exact
   * height with a bar instead, and `lib/load` is what lets them end.
   */
  const [reps, setReps] = useState<RepRow[] | null>(null);
  /** Every recording, a few columns each: the lifetime numbers. */
  const [spine, setSpine] = useState<RepSpine[]>([]);
  const [failed, setFailed] = useState(false);
  /**
   * `null` until the read lands, like `reps` and `xp`. Starting at `[]`
   * printed the empty example to someone with forty upgrades for as
   * long as the fetch took. A failed read is its own state, with a
   * retry, never drawn as an empty lexicon (PRINCIPLES 8).
   */
  const [lexicon, setLexicon] = useState<LexiconRow[] | null>(null);
  const [lexiconFailed, setLexiconFailed] = useState(false);
  /**
   * `null` until the XP read lands, for the same reason `reps` is: the
   * level and "XP this week" are derived from it, and a zero that has
   * not arrived yet would COUNT UP to the truth a moment later. A failed
   * read shows a dash and a retry, never Level 1.
   */
  const [xp, setXp] = useState<{ total: number; week: number } | null>(null);
  const [xpFailed, setXpFailed] = useState(false);
  const [anon, setAnon] = useState<boolean | null>(null);
  const [paywall, setPaywall] = useState<PaywallAsk | null>(null);
  /* Coins and freezes still sync (the streak's freezes are real), but
     neither is drawn here since 26 Sep: the shop and the freeze shelf
     left the profile on Timothy's call (#317). */
  const [, setCoins] = useState<number | null | undefined>(undefined);
  /** The trait whose sheet is open. */
  const [openTrait, setOpenTrait] = useState<TraitLevel | null>(null);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [flashing, setFlashing] = useState(false);
  /** `undefined` pending, `null` failed: the same split as `coins`. */
  const [, setFreezes] = useState<{
    equipped: number;
    used: number;
  } | null | undefined>(undefined);
  /** `null` until the profile answers, so "Add your name" can't flash
      over a name that merely hasn't arrived. */
  const [name, setName] = useState<string | null>(null);
  const [nameKnown, setNameKnown] = useState(false);
  /** The plan: null until the profile answers, and on a failed read.
   *  Unknown is never free (#353): the lexicon is not cut until it says so. */
  const [premium, setPremium] = useState<boolean | null>(null);
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
  const [profileRead, setProfileRead] = useState<ProfileRead>("loading");
  const plan = usePlan(profileRead);
  const stripeReturn = useStripeReturn();
  const { arrival, rereading } = useStripeReturns(stripeReturn, plan, setPremium);
  const [managing, setManaging] = useState(false);
  // Held back while any other sheet is up: two sheets at once is one
  // Escape for two and a scroll lock to unpick.
  const drop = usePriceDrop(
    plan.view,
    stripeReturn !== undefined && stripeReturn !== "checkout" && !managing && paywall === null && openTrait === null
  );
  const planSlot = useRef<HTMLDivElement>(null);
  /* Demos steps off the stage for a moment with its own Demos (the
     price drop) and springs back in after it, rather than reappearing. */
  const [back, setBack] = useState(false);
  /*
   * The pose the Shop sold, on the stage (#393 took Demos off Today, so
   * this is where a bought pose shows). `worn` is the shop id: undefined
   * until read, then the device's copy, then the account's answer, which
   * wins (#175). The whole ledger proves it was bought (#392), so a pose
   * from month one is still owned; it is the coin sync's own read, shared,
   * so a visit reads the ledger once.
   */
  const [worn, setWorn] = useState<string | null | undefined>(undefined);
  const [poseLedger, setPoseLedger] = useState<CoinRow[] | null>(null);
  // Before paint, so a tab switch to You never draws an empty stage first.
  useLayoutEffect(() => setWorn(readPrefs().pose), []);
  useEffect(() => {
    if (drop.open) setBack(true);
  }, [drop.open]);
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
    // The sync read the whole ledger, which is the pose's proof too. A
    // failed read keeps the pose already drawn; it never blanks the stage.
    if (read.ok) setPoseLedger(read.data.ledger);
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
    // The newest 90 whole rows for the traits and the badges, and every
    // recording's date and stars for the numbers that count from day one.
    const read = await readable(() => Promise.all([fetchReps(), fetchRepSpine()]));
    if (!read.ok) {
      setFailed(true);
      return;
    }
    const [rows, all] = read.data;
    setSpine(all);
    setReps(rows);
    const dates = all.map((r) => new Date(r.created_at));
    setStreak(computeStreak(dates));
    void loadFreezes(dates);
    // The coin sync pays new days, which are always among the newest, so
    // the 90 rows' dates suffice; its ledger read is whole, and the stage's
    // pose is proven from it.
    void loadCoins(rows.map((r) => new Date(r.created_at)));
  }, [loadCoins, loadFreezes]);

  /* Both under the page-level ceiling (readable): a read that fails or
     never answers ends in the ErrorLine and its retry, never Level 1 or
     an empty lexicon, and never a skeleton for good (#147). */
  const loadLexicon = useCallback(async () => {
    setLexiconFailed(false);
    setLexicon(null);
    const read = await readable(() => fetchLexicon());
    if (read.ok) setLexicon(read.data);
    else setLexiconFailed(true);
  }, []);

  const loadXp = useCallback(async () => {
    setXpFailed(false);
    setXp(null);
    const read = await readable(fetchXp);
    if (read.ok) setXp(read.data);
    else setXpFailed(true);
  }, []);

  useEffect(() => {
    void load();
    void loadLexicon();
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
        // The account's pose wins, its null (none worn) included, and the
        // device's copy follows so the next first paint is right, unless
        // the Shop's save of a pose worn here has not landed yet: then the
        // device's copy stands (lib/pose-save). No account (null) keeps it.
        if (p) setWorn(adoptAccountPose(p.equipped_pose));
        return syncOnboarding().then(setOnboarding);
      })
      .catch(() => {
        /* The profile didn't load: the name stays unknown (never "Add
           your name" over one that exists), the plan stays unknown
           (never the free door), the answers still sync. */
        setProfileRead((r) => (r === "loading" ? "failed" : r));
        syncOnboarding().then(setOnboarding).catch(() => {});
      });
    const db = supabaseBrowser();
    db?.auth
      .getUser()
      .then(({ data }) => setAnon(data.user?.is_anonymous ?? null))
      .catch(() => setAnon(null));
  }, [load, loadLexicon, loadXp]);

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

  /** The first step's moment holds the plan's place, and with it the page's one Demos. */
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
  /* The free cap on the lexicon, only once the plan says free. */
  const lexiconCap = premium === false ? limit(FREE_LEXICON, false) : null;
  /* Lifetime counts read every recording, not the newest 90. */
  const lifetime = reps === null ? [] : spine;
  const level = levelFromXp(xp?.total ?? 0);
  const badges = achievements(history);
  const earnedCount = badges.filter((b) => b.earned).length;

  // "Save your progress" gate: appears only after there IS progress
  // (DECISIONS #15: never before the first recording).
  const showGate = anon === true && lifetime.length >= 1;

  /* The gear sits on the large title's row (Imprint's Me, Wellspoken's
     lexicon s1) and its twin joins the bar once the title has handed
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

      {/* The identity stage (the cohesion pass, 26 Oct). It was a grey
          card with Demos on a sky coin over the name, the level, the XP
          bar, three numbers and the plan row: a first-time tester said
          "nothing matches this one because of the panda". It is the
          house stage now (`HeroStage`, Practice's sky), Demos standing on
          its floor at the right the way Practice's boss Demos does, your
          name over your level and the bar to the next. The numbers and
          the plan follow on one neutral card. Every async line holds its
          exact height while it is in flight (`Line`), so nothing changes
          size when the numbers land. */}
      <div className="mt-5">
        <HeroStage
          label="Your profile"
          eyebrowWide={editingName}
          eyebrow={
            editingName ? (
              <form
                className="flex items-center gap-2 text-left"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveName();
                }}
              >
                <input
                  autoFocus
                  name="displayName"
                  autoComplete="nickname"
                  enterKeyHint="done"
                  spellCheck={false}
                  aria-label="Display name"
                  maxLength={MAX_NAME}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Your name"
                  className={`${INPUT_CLASS} min-w-0 flex-1`}
                />
                <button
                  type="submit"
                  className="press font-display min-h-11 shrink-0 rounded-control bg-surface px-4 text-row"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="text-link stage-ink shrink-0 px-1"
                >
                  Cancel
                </button>
              </form>
            ) : (
              /* The name: the one profile field you type rather than
                 earn, in the stage's eyebrow with its pencil. */
              <div className="flex min-h-[18px] items-center">
                {!nameKnown ? (
                  <Line className="font-display text-detail" bar="w-20" align="left" />
                ) : name ? (
                  <>
                    {/* The name in the detail type, 17/700 (the fix round:
                        as the stage's 13px eyebrow it was the smallest
                        words on the stage, and it is the one thing on it
                        that is you rather than a number). */}
                    <span className="font-display min-w-0 truncate text-detail">{name}</span>
                    {/* 14px of pencil, a 44px target: the padding is the
                        hit area and the negative margin gives it back. */}
                    <button
                      type="button"
                      onClick={editName}
                      aria-label="Edit your name"
                      className="press stage-ink -my-[15px] -ml-1.5 -mr-[15px] shrink-0 rounded-control p-[15px]"
                    >
                      <IconPencil size={14} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={editName}
                    className="press stage-ink -my-3 -ml-2 flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-2"
                  >
                    <span className="eyebrow stage-ink">Add your name</span>
                    <IconPencil size={14} />
                  </button>
                )}
              </div>
            )
          }
          art={
            /* The pose the Shop sold, or his hello (YouDemos). At 132
               his idle clip plays where the pose has one (#316, from 120
               up). While the checkout's moment celebrates at the foot,
               or the month's price drop is up in its sheet, he is there,
               not here: the stage keeps its light with nobody on it, so
               the page has one Demos and nothing above the moment moves;
               when the sheet goes he springs back in. And while the name
               is typed he steps off, so the field has the stage's width. */
            editingName ? undefined : (
              <YouDemos worn={worn} ledger={poseLedger} away={momentUp || drop.open} back={back} />
            )
          }
          line={
            <div className="mt-auto pt-3">
              {/* The trough paints at once; the bar fills when the
                  number it reports has landed (#225), never over a
                  placeholder. The stage's ink on its bone: XP is earned,
                  and the earned colour stays on the chips and stars. */}
              <div
                role="img"
                aria-label={xp ? `${level.intoLevel} of ${level.forNext} XP to level ${level.level + 1}` : "XP to the next level"}
                className="stage-trough h-1.5 w-full max-w-[168px] overflow-hidden"
              >
                {xp && (
                  <div
                    className="fill stage-fill h-full"
                    style={{ width: `${(level.intoLevel / level.forNext) * 100}%` }}
                  />
                )}
              </div>
              {xpPending ? (
                <Line className="font-display mt-1.5 text-link font-bold" bar="w-32" align="left" />
              ) : xpFailed ? (
                <ErrorLine className="mt-1.5" onRetry={() => void loadXp()}>
                  Your XP didn&apos;t load.
                </ErrorLine>
              ) : (
                <p className="stage-ink font-display mt-1.5 text-link font-bold tabular-nums">
                  {level.intoLevel} of {level.forNext} to level {level.level + 1}
                </p>
              )}
            </div>
          }
        >
          {/* The level is the stage's title (you-7: it outranks the
              three numbers under it, 26/800 against their 24). */}
          {xpPending ? (
            <Line className="font-display mt-1.5 text-title font-extrabold" bar="w-24" align="left" />
          ) : (
            <h2 className="font-display mt-1.5 text-title font-extrabold tabular-nums">
              Level{" "}
              {xpFailed ? "–" : <CountUp value={level.level} durationMs={DURATION.max} />}
            </h2>
          )}
        </HeroStage>
        {nameFailed && (
          <ErrorLine className="mt-2" onRetry={() => void saveName()}>
            Your name didn&apos;t save.
          </ErrorLine>
        )}
      </div>

      {/* The numbers and the plan, on one neutral card under the stage
          (M09's three bare columns, you-12). */}
      <section aria-label="Your numbers" className="card mt-3 p-5 text-center">
        <div className="grid grid-cols-3">
          <Stat
            label="Day streak"
            value={loading ? undefined : streak.current}
            mark
          />
          <Stat label="Longest streak" value={loading ? undefined : streak.longest} />
          <Stat
            label="XP this week"
            value={xpFailed ? null : xp?.week}
          />
        </div>

        {/* The plan (#232): its headline, the unit for what was noticed,
            and how far the road's gate is. A row in the card under a
            hairline, not a card of its own, and a tap, because an answer
            is allowed to change. Its three lines are reserved while the
            device is read. */}
        <div aria-hidden className="mx-1 mt-5 border-t border-hairline" />
        {onboarding === undefined ? (
          <div aria-hidden className="-mx-3 mt-2 -mb-2.5 px-3 py-2.5 text-left">
            <Line className="eyebrow" bar="w-16" align="left" />
            <Line className="font-display mt-0.5 text-row" bar="w-40" align="left" />
            <Line className="mt-0.5 text-caption" bar="w-32" align="left" />
          </div>
        ) : (
          <PlanRow state={onboarding} stars={reps ? totalStars(starsByLesson(lifetime)) : null} />
        )}
      </section>

      {/*
       * Traits (DECISIONS #159): the nine Index dimensions as levels,
       * best first, derived from the reps on every load. A mirror, not
       * a currency: they gate nothing and feed nothing. A trait that
       * hasn't leveled sits dimmed at the bottom, the shelf's grammar
       * (#153): the position is the claim. Each row opens a sheet with
       * what it measures and the rule that moves it (#317).
       */}
      <section className="mt-7">
        <h2 className="section-head">Traits</h2>
        <div className="mt-3">
          {loading ? (
            <div aria-busy="true">
              {Array.from({ length: TRAIT_ROWS }, (_, i) => (
                <div key={i} className="flex min-h-11 items-center gap-3 py-2">
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
          ) : (
            (() => {
              const ranked = rankedTraits(traitLevels(history));
              const top = Math.max(1, ranked[0]?.level ?? 0);
              return ranked.map((t) => {
                const toned = TONED.has(t.key);
                return (
                  /* A trait the lessons teach wears its lesson tone on
                     its mark, so blue means pausing here as on /lessons
                     and Today; the name is ink. The bar is a level you
                     earned, so it fills in sage on sand, as every earned
                     bar off the stage does (the fix round: it was stone,
                     and the app drew progress in four colours). The four
                     the Index only reads take a stone mark. */
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => setOpenTrait(t)}
                    aria-haspopup="dialog"
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
                        headings and the section loses its leader (#234). */}
                    <span
                      className={`font-display -ml-1 w-[124px] shrink-0 text-row font-semibold ${
                        t.level > 0 ? "" : "text-stone-400"
                      }`}
                    >
                      {toned && isToned(t.key) ? TRAIT[t.key].name : t.name}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden bg-sand">
                      {t.level > 0 && (
                        <span
                          className="fill block h-full bg-sage-500"
                          style={{ width: `${(t.level / top) * 100}%` }}
                        />
                      )}
                    </span>
                    <span
                      className={`font-display w-6 shrink-0 text-right text-row font-extrabold tabular-nums ${
                        t.level > 0 ? "" : "text-stone-400"
                      }`}
                    >
                      <CountUp value={t.level} durationMs={DURATION.max} />
                    </span>
                  </button>
                );
              });
            })()
          )}
        </div>
      </section>

      {/* The league card sat here until 27 Aug: shelved (Timothy's call,
          #173) until there are users to rank. lib/level.ts and xp_events
          stay; a future league reads them unchanged. */}

      {/* Personal lexicon: the supply layer's archive (DECISIONS #12),
          grown into the room the shop left (#317): a section with its
          count, the swaps at reading size, an example when empty. It
          wore Variety's tone (you-4) until the cohesion pass: purple
          chips under a sky stage read as a second colour world. A word
          you have now is a neutral label in ink. */}
      <section className="mt-7">
        <h2 className="section-head">
          Your lexicon
          {lexicon !== null && (
            <span className="section-head-count">{lexicon.length}</span>
          )}
        </h2>
        {lexiconFailed ? (
          <ErrorLine className="mt-3" onRetry={() => void loadLexicon()}>
            Your lexicon didn&apos;t load.
          </ErrorLine>
        ) : lexicon === null || profileRead === "loading" ? (
          /* Three rows, the free tier's share, at the height of the real
             ones so nothing under them moves when they land. Held until
             the plan is read too, so a free list never lands long and
             then shrinks to its three (a failed plan read shows all). */
          <div aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`${SWAP_ROW} border-b border-hairline`}>
                <Skeleton className="h-6 w-48" />
              </div>
            ))}
          </div>
        ) : lexicon.length === 0 ? (
          /* The example card (#317): one swap, drawn the way a real one
             will be, so the empty section shows what arrives here. */
          <div className="card mt-3 px-5 py-4">
            <div aria-hidden className={SWAP_ROW}>
              <Swap original="the thing is" upgrade="the point is" />
            </div>
            <p className="text-caption text-stone-500">
              Upgrades from your own recordings collect here.
            </p>
          </div>
        ) : (
          <>
            {/* The archive is a list, so it assembles itself (#245): one
                row every 40ms, capped at the eighth. Nothing above it
                carries an `.arrive`, so this is the block's one
                entrance. */}
            {/* No margin: the rows' own 12px top padding is the head's
                mt-3 (system-7), so a word sits 12px under "Your lexicon"
                like every section's content. */}
            <ul className="stagger">
              {lexicon.slice(0, lexiconCap ?? lexicon.length).map((l) => (
                <li key={l.id} className={`${SWAP_ROW} border-b border-hairline`}>
                  <Swap original={l.original} upgrade={l.upgrade} />
                </li>
              ))}
            </ul>
            {lexicon.length >= 3 && !flashing && (
              <button
                type="button"
                onClick={() => setFlashing(true)}
                className={`${DOOR_CLASS} mt-3`}
              >
                <span>Test yourself on these</span>
                <Disclosure />
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

            {lexiconCap !== null && lexicon.length > FREE_LEXICON && (
              <button
                type="button"
                onClick={() =>
                  setPaywall({
                    reason: "Full lexicon",
                    headline: "Every word you've earned, kept.",
                  })
                }
                className="press mt-1 flex min-h-11 w-full items-center justify-between gap-3 py-3 text-left text-row font-semibold text-stone-500"
              >
                <span>
                  {lexicon.length - FREE_LEXICON} more upgrade
                  {lexicon.length - FREE_LEXICON === 1 ? "" : "s"} in your
                  archive
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <PremiumMark variant="chip" />
                  <Disclosure />
                </span>
              </button>
            )}
          </>
        )}
      </section>

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
        <div className="inset-group stagger mt-3" data-inset="icon" aria-busy={loading || undefined}>
          {badges.map((a) => {
            const earned = !loading && a.earned;
            return (
              <Link
                key={a.id}
                href={a.href}
                className="group-row press-row flex min-h-14 items-center gap-3.5"
              >
                {/* One host for every badge (wellspoken-lexicon s12): a
                    40px tile and an 18px mark, the raised step off the
                    group's surface. Earned is the mark in sage (the
                    accent rule, the cohesion pass: it was a sage tile);
                    not yet is the mark in stone. */}
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-control bg-raised ${
                    earned ? "text-sage-700" : "text-stone-400"
                  }`}
                >
                  <AchievementMark name={a.icon} size={18} />
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
                  </span>
                  {!loading && !a.earned && a.progress > 0 && (
                    <span className="mt-1.5 block h-1 overflow-hidden bg-sand">
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
                <Disclosure />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Day 1 vs now (you-11, M23): one card with the two numbers and
          the tap that makes them a picture. The margin is the parent's
          (STATE: shared components carry none). While the account gate
          below is showing, its button keeps the screen's one terracotta
          and this one steps down to the surface door. */}
      {history.length >= 2 && (
        <div className="mt-7">
          <ShareCard reps={history} quiet={showGate} />
        </div>
      )}

      {showGate && (
        /* p-5 and a detail head, like Day 1 vs now above it, so the two
           stacked cards share one inner edge and one title size. */
        <section className="card mt-7 p-5">
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
              <p className="text-caption text-stone-400">{CODE_LINE}</p>
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

      {openTrait && (
        <TraitSheet trait={openTrait} onClose={() => setOpenTrait(null)} />
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
 * Settings, as an object a thumb can hit (wellspoken-lexicon s1): a
 * 40px surface square with the gear in stone-500, its hit area grown to
 * 44 by the `::after`. A square at the control radius, never a circle:
 * Record is the app's only circle.
 */
function SettingsButton() {
  return (
    <Link
      href="/settings"
      aria-label="Settings"
      className="press relative flex size-10 items-center justify-center rounded-control bg-surface text-stone-500 after:absolute after:-inset-0.5 after:content-['']"
    >
      <IconGear size={20} />
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
 * A number and its label, bare in a column (Imprint's Me): the label
 * says what the number counts and in what (you-12), so there is no unit
 * line. `undefined` is still in flight (a bar at the number's height),
 * `null` failed (a dash): never a zero that wasn't read. The value
 * counts up when it lands, which is the measurement arriving, never a
 * re-run over a figure that was already on the screen. The streak keeps
 * the flame it wears everywhere else, in the earned gold.
 */
function Stat({
  label,
  value,
  mark = false,
}: {
  label: string;
  value: number | null | undefined;
  mark?: boolean;
}) {
  return (
    <div className="min-w-0">
      {value === undefined ? (
        <Line className="font-display text-num-m" bar="w-9" text="0" />
      ) : (
        /* The flame hangs off the number's right edge, so the number
           itself stays centred over its label like the other two. */
        <div className="font-display text-num-m tabular-nums">
          <span className="relative inline-block">
            {value === null ? "–" : <CountUp value={value} durationMs={DURATION.max} />}
            {mark && value !== null && value > 0 && (
              <span aria-hidden className="you-gold absolute left-full top-1/2 ml-1 -translate-y-1/2">
                <IconFlame size={18} />
              </span>
            )}
          </span>
        </div>
      )}
      {/* Two short lines in every column at every width, as Imprint's
          run: one line each crowded the three together at 390 and broke
          only the longest at 375. The label is drawn in both states, so
          the placeholder is the same height. */}
      <div className="label-micro mx-auto mt-1.5 max-w-16 text-balance text-stone-500!">{label}</div>
    </div>
  );
}

/** A lexicon row's box: one height for the real rows, the skeleton and the example. */
const SWAP_ROW = "flex min-h-14 flex-wrap items-center gap-x-2.5 gap-y-1 py-3 text-detail font-normal";

/**
 * One swap: what you said, struck through, an arrow, and the word you
 * have now as a neutral label (`.you-word`): ink on the surface, so it
 * is neither a tap nor a badge (the cohesion pass; it wore Variety's
 * wash).
 */
function Swap({ original, upgrade }: { original: string; upgrade: string }) {
  return (
    <>
      <span className="text-stone-400 line-through">{original}</span>
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-stone-400"
      >
        <path d="M2.5 8h10.5M9.5 4.5 13 8l-3.5 3.5" />
      </svg>
      <span className="you-word">{upgrade}</span>
    </>
  );
}

/** The gate caption under the plan's headline (#232; check-onboarding reads it). */
function gateLine(unitName: string, toGo: number | null): string {
  if (toGo === null) return unitName;
  if (toGo === 0) return `${unitName} is open`;
  return `${unitName} opens in ${toGo} star${toGo === 1 ? "" : "s"}`;
}

/** The plan row's box: a row inside the identity card that lights on a press. */
const PLAN_ROW =
  "press-row -mx-3 mt-2 -mb-2.5 flex min-h-11 items-center gap-3 rounded-control px-3 py-2.5 text-left";

/**
 * The plan row (#232): the portfolio's headline, the unit for what was
 * noticed, and how far its gate is. Opens the plan to change an answer;
 * a walk never taken opens the first question.
 */
function PlanRow({ state, stars }: { state: OnboardingState; stars: number | null }) {
  if (!state.done) {
    return (
      <Link href="/welcome?step=ageBand" className={PLAN_ROW}>
        <span className="min-w-0 flex-1">
          <span className="eyebrow block">Your plan</span>
          <span className="font-display mt-0.5 block text-row">
            Five questions, then a first month.
          </span>
        </span>
        <Disclosure />
      </Link>
    );
  }
  const plan = buildPortfolio(state.answers);
  const toGo =
    plan.focus && stars !== null ? Math.max(0, plan.focus.unlocksAt - stars) : null;
  return (
    <Link href="/welcome?step=plan" className={PLAN_ROW}>
      <span className="min-w-0 flex-1">
        <span className="eyebrow block">Your plan</span>
        <span className="font-display mt-0.5 block truncate text-row">
          {plan.headline}
        </span>
        <span className="mt-0.5 block truncate text-caption tabular-nums text-stone-500">
          {plan.focus ? gateLine(plan.focus.unitName, toGo) : "The road, one unit at a time"}
        </span>
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
 * pop up explanation", #317). What it measures, the level, and the rule
 * that moves it, with its two numbers. COPY-RULES: the mechanic is
 * explained at the moment somebody reaches for it, never printed on the
 * page.
 */
function TraitSheet({ trait, onClose }: { trait: TraitLevel; onClose: () => void }) {
  const toned = isToned(trait.key);
  const name = toned ? TRAIT[trait.key as TraitId].name : trait.name;
  const what = toned ? TRAIT[trait.key as TraitId].what : WHAT[trait.key];
  return (
    <Overlay label={name} onClose={onClose}>
      <div
        data-trait={toned ? trait.key : undefined}
        className="elev-3 w-full max-w-[430px] rounded-t-sheet bg-raised px-6 pb-8 pt-6"
      >
        <div aria-hidden className="mx-auto mb-5 h-1 w-10 rounded-full bg-stone-300" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="eyebrow flex items-center gap-1.5">
              {toned && <span aria-hidden className="trait-dot" />}
              Trait
            </div>
            <h2 className="font-display mt-1 text-title font-extrabold">{name}</h2>
          </div>
          <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-card bg-surface">
            <span className="font-display text-num-m tabular-nums">
              {trait.level}
            </span>
            <span className="label-micro mt-1">Level</span>
          </div>
        </div>
        <p className="mt-4 text-read text-stone-800 text-pretty">{what}</p>
        <p className="mt-3 text-caption leading-relaxed text-stone-500">
          A recording levels it when this is its best score and clears{" "}
          {LEVEL_AT}. Over {DOUBLE_AT} counts twice.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="press font-display mt-6 flex min-h-12 w-full items-center justify-center rounded-control bg-surface text-body font-bold"
        >
          Done
        </button>
      </div>
    </Overlay>
  );
}
