"use client";

import Link from "next/link";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AvatarCoin } from "@/components/home/AvatarCoin";
import { HomeHero } from "@/components/home/HomeHero";
import { ModeRows } from "@/components/home/ModeRows";
import { TodayFoot, TodayFootSkeleton } from "@/components/home/TodayFoot";
import { ModPicker } from "@/components/ModPicker";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconBack, IconFlask } from "@/components/Icon";
import { Paywall, PriceDropSheet } from "@/components/LazyPaywall";
import { usePlan, usePriceDrop } from "@/lib/use-plan";
import { readable, readFailure } from "@/lib/load";
import { StreakBadge } from "@/components/StreakBadge";
import { StatIcon } from "@/components/StatIcon";
import { TopicRoulette } from "@/components/TopicRoulette";
import { TestTile } from "@/components/tester/TestTile";
import { TEST_COPY } from "@/content/tester";
import { useTestPresence } from "@/lib/tester-client";
import {
  fetchProfile,
  fetchRepSpine,
  fetchReps,
  heldPremium,
  heldProfile,
  heldReps,
  heldSpine,
  type RepRow,
  type RepSpine,
} from "@/lib/client-data";
import { topicById, type Topic } from "@/lib/topics";
import { localSessionState } from "@/lib/auth";
import { heldFreezes, syncFreezes } from "@/lib/freeze-sync";
import { useRevalidate } from "@/lib/use-revalidate";
import { useStill, useWarm } from "@/lib/use-warm";
import { restoreHeld } from "@/lib/held";
import { expectDraw, markDrawn, whenIdle } from "@/lib/first-draw";
import { warmYou } from "@/lib/warm-you";
import { firstRun, markWelcomed } from "@/lib/onboarding";
import {
  introDue,
  introHref,
  nextLesson,
  starsByLesson,
} from "@/lib/path";
import { readPrefs } from "@/lib/prefs";
import { readOnboarding } from "@/lib/answers";
import { syncOnboarding } from "@/lib/answers-sync";
import { spinForAnswers } from "@/lib/portfolio";
import { poolFor, poolHere } from "@/lib/pool";
import type { Pool } from "@/content/portfolio";
import { repHref } from "@/lib/rep-config";
import { armReminder } from "@/lib/reminders";
import { buildChallenge } from "@/lib/challenge";
import { computeStreak, type StreakState } from "@/lib/streak";
import { usePaywallReturn } from "@/lib/use-paywall-return";
import {
  aboutSeconds,
  cardFace,
  costLine,
  dayOf,
  dayTurned,
  FALLBACK_TOPIC_ID,
  greeting as greetingFor,
  greetingName,
  heroObject,
  lastSpokeOn,
  lineFigure,
  practiceHref,
  runFigure,
  todaysPractice,
  usedModsLately,
} from "@/lib/home";
import { bossTile, hostileTile } from "@/lib/home-modes";
import { readSpokeHint, writeSpokeHint } from "@/lib/spoke-hint";
import { dayOneFamily } from "@/lib/practice-family";

const EMPTY: StreakState = {
  current: 0,
  longest: 0,
  atRisk: false,
  didToday: false,
  frozenInRun: 0,
};

/** No practice could be chosen (a failed read): a topic anyone can take,
    and the one Start opens, so the card promises what the tap keeps. */
const FALLBACK_TOPIC = topicById(FALLBACK_TOPIC_ID)!;

/*
 * Today, "the object" (#393). Timothy, on the five home pages in
 * docs/refs/home/: "They have beautiful home pages. We have a card with
 * a panda." He picked direction B off the workbench (app/workbench/home-b,
 * kept as the record), and this is it with the account's own numbers:
 *
 *  - who: the date, "Hi, Timothy", the avatar coin (a door to You) and
 *    the earned chips, in ScreenHeader's large title and its bar;
 *  - today's practice as one tall card in its trait's colour family,
 *    with the glass object of the lesson that teaches its tactic
 *    breaking out of the corner, the topic huge, Start, spin and
 *    difficulty (DECISIONS #9's floor, #268's one selector);
 *  - under it, Hostile Q&A and the weekly boss (#478, "the bike in the
 *    room") as two rows on the ground, each led by its 3D mark and one
 *    tap away (#500);
 *  - at the foot, the two numbers only Today holds: today's line (#281)
 *    and the longest stretch with no filler (#254, #267), as figures.
 *
 * Since #500 (Timothy, 18 Nov: "I don't fuck with all the cards on the
 * homepage. I don't know what to do") the card is the one box on the
 * screen. The Today / This week switch, the five trait tiles and the
 * week's Index, days and recordings left; each lives on Lessons, You,
 * the Log or a recording's own page (lib/home.ts, "The foot").
 *
 * Demos is not on the card: he stood on it every day, which is
 * furniture. He arrives for moments, and the month's price drop is one,
 * so the screen keeps its one Demos.
 */
export default function Home() {
  const router = useRouter();
  /*
   * What this visit last read (#433, lib/held.ts): coming back along the
   * tab bar, Today opens on its history, streak and plan in the first
   * frame and reads them again behind that. Never while the server's
   * page hydrates (`warm`), so the two always agree.
   */
  const warm = useWarm();
  const [reps, setReps] = useState<RepRow[] | null>(() => (warm && heldSpine() ? heldReps() : null));
  /** Every recording, a few columns each: the lifetime numbers. */
  const [spine, setSpine] = useState<RepSpine[]>(() => (warm ? heldSpine() : null) ?? []);
  const [streak, setStreak] = useState<StreakState>(() => {
    const all = warm ? heldSpine() : null;
    if (!all) return EMPTY;
    return heldFreezes()?.streak ?? computeStreak(all.map((r) => new Date(r.created_at)));
  });
  /** A history is on screen: a later read is quiet, and its failure leaves the screen as it is. */
  const drawn = useRef(reps !== null);
  useStill(drawn.current);
  const [rescued, setRescued] = useState(0);
  /** The plan: null until the profile answers, and on a failed read. */
  const [premium, setPremium] = useState<boolean | null>(() => (warm ? heldPremium() : null));
  /*
   * A fresh open (#508, lib/held.ts rule 4): the numbers this phone kept
   * from the last open, for the account it is signed in to, are drawn
   * before the first paint after hydration (the server's page has none of
   * them, so never in the hydrating render itself): the streak, the name,
   * the plan and the two rows under the card. The card and its foot read
   * the newest 90 recordings, which are never kept, and land with the
   * read as before.
   */
  const coldOpen = useRef(!warm);
  const [spineKept, setSpineKept] = useState(false);
  /** A reconciled streak is on screen: the read's bare count never stands in for it. */
  const streakKept = useRef(false);
  /** The freezes have answered (or failed): the streak on screen is the one that stays. */
  const [streakSettled, setStreakSettled] = useState(false);
  useLayoutEffect(() => {
    // Today announces when its numbers are drawn (the splash lands on them, #508),
    // and its leaving releases what waited, if it goes before they land.
    const leave = expectDraw();
    if (!coldOpen.current || !restoreHeld()) return leave;
    const all = heldSpine();
    if (all) {
      setSpine(all);
      setSpineKept(true);
      const kept = heldFreezes();
      setStreak(kept?.streak ?? computeStreak(all.map((r) => new Date(r.created_at))));
      streakKept.current = kept !== null;
      // A streak the freezes reconciled last open is the one that stays:
      // the splash need not wait for them again (a day's turn can still move it).
      if (kept !== null) setStreakSettled(true);
    }
    const plan = heldPremium();
    if (plan !== null) setPremium(plan);
    return leave;
  }, []);
  const [mods, setMods] = useState<string[]>([]);
  const [showMods, setShowMods] = useState(false);
  const [paywall, setPaywall] = useState<string | null>(null);
  /*
   * The device's clock for Hostile's claim of the day and the week's
   * boss (#478): read after mount, never in render, so the server's
   * prerendered first paint and the phone's agree; a warm return along
   * the tab bar reads it in its first frame. A new day reads it again.
   */
  const [clock, setClock] = useState<Date | null>(() => (warm ? new Date() : null));
  /* The month the price steps down: a sheet over Today, never a card in
     its flow, held back while the paywall is up. Its Demos is the
     screen's only one: the card carries none (#393). */
  const plan = usePlan();
  const drop = usePriceDrop(plan.view, paywall === null);
  const dropOpen = drop.open && !!plan.today;
  const [topic, setTopic] = useState<Topic | null>(null);
  /* The topic pool (#489): this phone's introduction answers, then the
     account's once they sync. Read in the first render, so a tab return
     drawn from what the visit holds names the same topic it lands on. */
  const [pool, setPool] = useState<Pool>(poolHere);
  /*
   * Focus across the swap. Opening the roulette unmounts the spin glyph
   * that held focus and closing it unmounts the way back, and both times
   * focus fell to <body>: a keyboard or screen-reader user was thrown to
   * the top. It moves to the roulette's heading on open and back to the
   * spin glyph on close, only after a tap (never on a cold open), and
   * keyed on open or closed, so a spin inside the roulette leaves focus
   * where it is.
   */
  const toggled = useRef(false);
  const rouletteHead = useRef<HTMLHeadingElement>(null);
  const spinGlyph = useRef<HTMLButtonElement>(null);
  const rouletteOpen = topic !== null;
  useEffect(() => {
    if (!toggled.current) return;
    toggled.current = false;
    if (rouletteOpen) rouletteHead.current?.focus();
    else spinGlyph.current?.focus();
  }, [rouletteOpen]);
  const [anon, setAnon] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  /*
   * The name to greet. Unknown until this device's answers or the
   * account say, so the server (which knows neither) renders the title's
   * line empty and nothing swaps "Today" for a name in front of anyone.
   * The introduction's own copy is read before the first paint; the
   * account's display_name, when it answers, wins.
   */
  const [name, setName] = useState<string | null>(null);
  const [nameKnown, setNameKnown] = useState(false);
  const [skipIntros, setSkipIntros] = useState(false);
  /*
   * The greeting fits one line (#393's fix round: "Hi, Maximiliana" left
   * "Hi," alone over the name and pushed the card down 40px). Measured
   * before paint: the title steps down from 34 to as small as 26 to keep
   * one line, and a line too long even then gives way to its short form
   * (`greeting`, lib/home.ts): the name by itself, or "Welcome back".
   * Holds the full line that did not fit.
   */
  const [tooLong, setTooLong] = useState<string | null>(null);
  /** When the history was last read: the day the screen belongs to. */
  const loadedAt = useRef<Date | null>(null);
  /** The days this page has turned over while open: the header's key. */
  const [dayTurn, setDayTurn] = useState(0);
  /*
   * The local day this device last saw a recording land (#431), read
   * before the first paint so the card and the greeting are the day's
   * own from their first frame; the history read, when it lands, decides.
   */
  const [spokeHint, setSpokeHint] = useState<string | null>(null);
  useLayoutEffect(() => {
    setSpokeHint(readSpokeHint());
  }, []);
  const lastDay = reps !== null ? lastSpokeOn(spine) : spokeHint;
  const day = dayOf(lastDay, new Date());
  /* Back after a break (#431): a last recording two or more days ago.
     Welcomed on the card's lead (#430 review), never counted: no number
     of days and no word about the streak; the flame chip keeps its
     honest 0. The title stays "Hi, Timothy" at 34. */
  const back = day === "back";
  const lines = greetingFor(name);
  const greeting = nameKnown
    ? tooLong === lines.full && lines.short
      ? lines.short
      : lines.full
    : "\u00a0";
  useLayoutEffect(() => {
    const title = document.querySelector<HTMLElement>(".home .large-title");
    if (!title) return;
    if (!lines.short) {
      title.style.removeProperty("font-size");
      return;
    }
    const full = lines.full;
    const short = lines.short;
    /* Both versions are measured off the page in the title's own type,
       so the choice is made again when the webfont lands and a guess
       made on the fallback face never sticks. */
    const fit = () => {
      title.style.removeProperty("font-size");
      const cs = getComputedStyle(title);
      const probe = document.createElement("span");
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font};letter-spacing:${cs.letterSpacing}`;
      document.body.appendChild(probe);
      const width = (text: string) => {
        probe.textContent = text;
        return probe.getBoundingClientRect().width;
      };
      const room = title.clientWidth;
      const fullW = width(full);
      const shortW = width(short);
      probe.remove();
      const alone = fullW * (26 / 34) > room;
      setTooLong(alone ? full : null);
      const natural = alone ? shortW : fullW;
      if (natural > room) title.style.fontSize = `${Math.max(26, Math.floor(34 * (room / natural)))}px`;
    };
    fit();
    let live = true;
    void document.fonts?.ready.then(() => live && fit());
    window.addEventListener("resize", fit);
    return () => {
      live = false;
      window.removeEventListener("resize", fit);
    };
    // dayTurn: the header remounts on a new day, and its new title is fitted again.
  }, [greeting, lines.full, lines.short, dayTurn]);
  // Back from the paywall's account doors with paywall=1: the sheet reopens.
  usePaywallReturn(() => setPaywall("Premium"));
  /* A tester during the test (#402): the eyebrow says the test's day in
     the date's place, and the test tile stands under the practice card.
     Read before the first paint from this device's hint and the clock;
     everyone else's Today is exactly as it was, and reads nothing new. */
  const test = useTestPresence();
  /* The mark's flask beside the day: on a short phone the tile is under
     the nav when Today opens, and this line is the test's one sign. */
  const testEyebrow =
    test.shown && test.phase === "on" ? (
      <span className="flex h-5 items-center gap-1.5">
        <span aria-hidden className="test-eyebrow-mark inline-flex">
          <IconFlask size={14} />
        </span>
        {TEST_COPY.eyebrow(test.day)}
      </span>
    ) : null;

  /**
   * The history read, on its own so the retry can mean it. It used to
   * end `.catch(() => setReps([]))`, which drew the home screen of
   * someone with no recordings for someone whose recordings merely
   * didn't arrive: the day counter reset, the numbers vanished, and
   * nothing on screen said why.
   */
  const load = useCallback(async (again = false) => {
    loadedAt.current = new Date();
    setFailed(false);
    // A history on screen stays there while it is read again (#433).
    const quiet = drawn.current;
    if (!quiet) setReps(null);
    // The newest 90 whole rows for what reads a recording, and every
    // recording's date and stars for what counts from day one: the
    // streak, the freezes it earns, the week and the stars.
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
    writeSpokeHint(lastSpokeOn(all));
    const dates = all.map((r) => new Date(r.created_at));
    // Optimistic: show the unfrozen streak immediately, then reconcile
    // freezes (which may involve a write). A screen already showing a
    // reconciled streak keeps it until the next one lands, so the flame
    // never dips to the bare count and back.
    if (!quiet && !streakKept.current) setStreak(computeStreak(dates));
    const sync = await readable(() => syncFreezes(dates));
    if (!sync.ok) {
      setStreakSettled(true);
      return;
    }
    setStreak(sync.data.streak);
    setStreakSettled(true);
    // A rescue is said by the load that made it; a quiet read never unsays it.
    if (!again || sync.data.rescued.length > 0) setRescued(sync.data.rescued.length);
    // Armed once a visit, and at a day's turn, as before: a return to the
    // app reads the history again but leaves the reminder where it is.
    if (again) return;
    void armReminder({
      streak: sync.data.streak.current,
      didToday: sync.data.streak.didToday,
    });
  }, []);
  // Looked at again after a while, or back on the network: read again, quietly.
  useRevalidate(() => void load(true));

  /* The name, before the first paint (a tab switch never shows the line
     empty): the account's as this visit last read it, else this
     device's. A first open is under the splash meanwhile. */
  useLayoutEffect(() => {
    const local = greetingName(readOnboarding().answers.name);
    const p = heldProfile();
    const known = (p !== undefined ? greetingName(p?.display_name) : null) ?? local;
    if (known || p !== undefined) {
      setName(known);
      setNameKnown(true);
    }
  }, []);

  useEffect(() => {
    /*
     * A fresh browser gets the introduction (DECISIONS #133). Checked
     * synchronously before any fetch: the fetches mint an anonymous
     * session, which would make this device stop looking fresh before
     * the decision was made.
     */
    if (firstRun()) {
      router.replace("/welcome");
      // The room is drawn by its server page (#508): nothing here to wait for.
      markDrawn();
      return;
    }
    markWelcomed();
    setClock(new Date());

    // A line on screen, so the session this phone holds answers (#508).
    localSessionState()
      .then((s) => setAnon(s.signedIn && s.anonymous))
      .catch(() => {});

    setSkipIntros(readPrefs().skipIntros);
    const local = greetingName(readOnboarding().answers.name);

    fetchProfile()
      // undefined is a failed read: the plan stays unknown, never free
      // (#353). null is no backend at all, which is free.
      .catch(() => undefined)
      .then((p) => {
        if (p !== undefined) setPremium(p?.premium ?? false);
        // The account's name wins; the device's stands in without one. A
        // read that failed leaves a name already drawn from what the
        // visit holds (#433), rather than trading it for the device's.
        setName((was) => greetingName(p?.display_name) ?? (p === undefined ? was : null) ?? local);
        setNameKnown(true);
        // The introduction's answers follow the account (#232): a
        // finished walk goes up, or the account's answers come down, and
        // the pool follows them, so the card names the topic the
        // reminder, which reads the account's, names (#489).
        return syncOnboarding().then((s) => setPool(poolFor(s.answers)));
      })
      .catch(() => {});

    void load();
  }, [load, router]);

  /*
   * Today left open across midnight. A phone locked on Today at 23:50
   * and woken next morning resumes the page without a reload, and it
   * kept yesterday's date, a lit streak and "One more" while the card
   * moved to the new day under them. A return on a new local day reads
   * again, and the header remounts for its date; the minute's check
   * covers a screen left open and visible through midnight. The clock
   * Hostile's tile counts from moves on every check too (#478 review),
   * so "Next in about 2 hours" neither stands still on a screen left
   * open nor outlives the round it waits for on a return.
   */
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      setClock(new Date());
      if (!dayTurned(loadedAt.current, new Date())) return;
      setDayTurn((n) => n + 1);
      // A new day is a new screen: yesterday's numbers do not stand in for it.
      drawn.current = false;
      void load();
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    const minute = window.setInterval(check, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("focus", check);
      window.clearInterval(minute);
    };
  }, [load]);

  /* Today's numbers, or the failure that stands in for them, are on
     screen: the splash may lift onto them, and what waited may go (#508).
     The streak is one of them: the read's bare count stands until the
     freezes answer, so the splash waits for the count that stays and
     never lands on one that then ticks (its cap still bounds the wait). */
  useEffect(() => {
    if (!failed && (reps === null || !streakSettled)) return;
    markDrawn();
    if (reps === null) return;
    // You's own reads, once Today is drawn and the phone is idle, so its
    // first open draws from them (lib/warm-you.ts).
    return whenIdle(warmYou, 4000);
  }, [reps, failed, streakSettled]);

  const history = reps ?? [];
  /* Lifetime numbers count every recording, not the newest 90. */
  const lifetime = reps === null ? [] : spine;
  const starMap = starsByLesson(lifetime);
  const next = nextLesson(starMap);

  /*
   * ONE selection for the screen (#268). The card names a trait and
   * stands its object, today's line works on the same trait (it reads
   * the same `choosePractice` off the same row), and the wide tile is
   * handed the same trait, whatever today's recordings did to the
   * newest numbers under it. In the person's pool (#489), the one the
   * command menu's Today and the reminder pass, so all three name one
   * topic.
   */
  const chosen = todaysPractice(history, new Date(), pool);

  /* The same reading, the same trait, one line to clear (#281), and the
     newest scored take's longest stretch with no filler: the foot's two
     figures (#500). */
  const challenge = buildChallenge(history);
  const lineAtFoot = lineFigure(challenge);
  const runAtFoot = runFigure(history);

  /*
   * Day one is its own card: no measurement to choose from, so no trait,
   * no tactic and nothing quoted as the reason. `reps !== null` is what
   * stops the day-one line flashing over the card of someone with forty
   * recordings on every cold open: until the history lands nobody is on
   * day one.
   */
  const dayOne = reps !== null && lifetime.length === 0;

  /*
   * THE INTRO IS A FIRST-RUN SCREEN. A unit nobody has scored in yet
   * gets its teaching screen on the way in (#210), gated on having no
   * history at all (`dayOne`, not `history.length === 0`: while the read
   * is in flight the history is empty too, and Start pointed at the
   * unit intro for everybody until it landed, today-2). Everybody else
   * goes straight to the recorder with their practice's topic on it.
   */
  const introOwns = Boolean(
    dayOne && next && !skipIntros && introDue(next.unit, starMap)
  );
  /* The read is in flight. A failed read is not loading: the card paints
     its fallback rather than a skeleton that never resolves. */
  const loading = reps === null && !failed;
  /* No practice to show once the read has answered (a failed read, a
     history with nothing to read): the card's fallback topic, which is
     also where Start goes. */
  const fallback = !loading && !dayOne && !chosen;
  /* What the card says. The trait is named in every state that has one. */
  const heroTrait = dayOne ? null : (chosen?.trait ?? null);
  /* The colour it wears, which the recording card keeps (D50). Day one
     wears the family of the lesson its Start opens (E20). */
  const heroFamily = dayOne ? dayOneFamily(next) : (heroTrait ?? "pause");
  /*
   * What the card shows on this day (#431): on a day not yet spoken, the
   * topic, what it costs, Start across the card and "Another topic";
   * once spoken, "One more" with the tactic, spin and difficulty, as it
   * was. While the read is in flight the hint decides, so the card holds
   * the height it lands at.
   */
  const face = cardFace({
    dayOne,
    spokeToday: day === "spoken",
    usedMods: usedModsLately(history),
    back,
  });
  const cost = face.cost ? costLine(aboutSeconds(history)) : null;
  const startHref =
    introOwns && next
      ? introHref(next.unit.id, mods, undefined, "today")
      : dayOne && next
        ? /* Day one with the intros off: the same first lesson the
             intro would have opened, so the card's colour is the
             recording's, not the day's rotation. */
          repHref({ lesson: next.lesson.id, mods })
        : chosen || fallback
          ? /* The practice the card printed, so the recording screen
               heads with its angle and leads with its tactic (E52), and
               on a day not yet spoken opens ready to record (#431): the
               address the reminder opens too (lib/home.ts `todayHref`). */
            practiceHref(chosen, { mods, ready: face.ready })
          : /* An early tap, before the read: the recorder. */
            repHref({ mods, trait: heroFamily });
  const heroTip = dayOne ? null : (chosen?.item.tips[0] ?? null);
  const heroTitle = dayOne
    ? "Day one starts today."
    : (chosen?.item.prompt ?? FALLBACK_TOPIC.prompt);
  /* The topic the card shows, which the roulette counts as seen and
     never opens on (#473); none on day one or while the read is out. */
  const cardTopicId = dayOne || loading ? null : (chosen?.item.topicId ?? FALLBACK_TOPIC_ID);
  /* Day one stands the object the recording card will (the lesson its
     Start opens, by its first tip: The baseline's Fillers door), so the
     card's colour and its object name one trait (R2F-04: a crimson
     card carried Pausing's blue hourglass). */
  const object = dayOne
    ? heroObject(heroFamily, next?.lesson.tips[0])
    : heroObject(heroTrait, heroTip);

  return (
    <main className="home px-5 pb-[var(--nav-clear)] pt-7">
      {/* The opening, as the references open: the date, a greeting by
          name, the coin (a door to You) and the earned chips. The bar
          takes "Today" when the greeting scrolls under it. Without a
          name the large title is the tab's own, "Today". */}
      <ScreenHeader
        key={dayTurn}
        title={greeting}
        barTitle="Today"
        dated={testEyebrow === null}
        eyebrow={testEyebrow ?? undefined}
        leading={<AvatarCoin name={name} known={nameKnown} />}
        barTrailing={
          <span className="mr-3 flex h-9 items-center gap-2">
            {(reps !== null || spineKept) && (
              /* The streak, the one standing score in the header (#176),
                 a sage chip with a gold mark, never a tap. It lands with
                 the read; at zero it reads as an unlit zero (D25) until
                 the first recording lights it. The total of every
                 lesson's stars stood beside it until #486 (Timothy, 16
                 Nov: "Total stars is a useless feature remove it"). */
              <span className="arrive flex items-center gap-2">
                <StreakBadge streak={streak} />
              </span>
            )}
          </span>
        }
      />

      {/*
       * The roulette runs INSIDE the card rather than beside it (#393's
       * fix round): the same colour, the same object, the topic spinning
       * in the topic's place and the pill taking it, so the one tap is
       * still the card's. The way back sits under it.
       */}
      <HomeHero
        loading={loading}
        family={heroFamily}
        face={face}
        cost={cost}
        trait={heroTrait}
        tip={heroTip}
        title={heroTitle}
        object={object}
        href={startHref}
        mods={mods}
        onSpin={() => {
          toggled.current = true;
          setShowMods(false);
          setTopic(spinForAnswers(cardTopicId));
        }}
        spinRef={spinGlyph}
        onMods={() => setShowMods((v) => !v)}
        modsOpen={showMods}
        roulette={
          topic
            ? {
                topic,
                onSpin: setTopic,
                onTake: (t) =>
                  router.push(repHref({ topic: t.id, mods, trait: heroFamily, ready: face.ready })),
                headRef: rouletteHead,
                back:
                  face.spin === "link"
                    ? {
                        label: "Today's practice",
                        onBack: () => {
                          toggled.current = true;
                          setTopic(null);
                        },
                      }
                    : undefined,
              }
            : null
        }
      />
      {topic && face.spin === "link" ? null : topic ? (
        /* The way back, in the app's one back grammar: a button, because
           it changes this screen's state, not its route. */
        <button
          type="button"
          onClick={() => {
            toggled.current = true;
            setTopic(null);
          }}
          className="screen-bar-back press arrive -mb-3 -ml-2.5 mt-1"
        >
          <IconBack size={22} />
          <span>Today&apos;s practice</span>
        </button>
      ) : (
        showMods && (
          <div className="reveal mt-3">
            <ModPicker
              selected={mods}
              onChange={setMods}
              /* An unknown plan never opens the paywall over a paid
                 one (#353): the mods stay open until the plan says
                 free, and /rep honours what the account holds. */
              premium={premium !== false}
              onPremiumTap={(m) => setPaywall(`${m.name} · premium mod`)}
            />
          </div>
        )
      )}

      {/* The other two things (#478, docs/plan-next.md section 10):
          Hostile Q&A and the weekly boss, two rows on the ground under the
          card (#500), each led by its 3D mark and one tap away. No box, so
          the card stays the one box and the one thing that glows. The
          rows are every recording's date and kind (the spine), unread
          until the history lands. */}
      <ModeRows
        tiles={[
          hostileTile({ now: clock, premium, rows: reps === null && !spineKept ? null : spine }),
          bossTile({ now: clock, rows: reps === null && !spineKept ? null : spine }),
        ]}
      />

      {/* The test, for a tester (#402): above the freeze's note, so that
          note landing late never moves it, and on the ground with no box
          since #500. It draws a failed history as unknown rather than
          hiding. */}
      {test.shown ? (
        <TestTile
          presence={test}
          recordings={failed ? "failed" : reps === null ? "loading" : { reps, spine }}
          className="mt-6"
        />
      ) : (
        /* Its place, held from the server's paint on a tester's device
           until the tile takes it (lib/tester-boot.ts); nothing for
           anyone else. */
        <div aria-hidden className="test-tile-slot home-tile mt-6" />
      )}

      {/* The freeze reconciliation is its own read, landing after the
          history, so it arrives from 6px below: a line on the ground with
          the freeze's own mark, never a box (#500). */}
      {rescued > 0 && (
        <p role="status" className="home-freeze arrive mt-6 text-body">
          <StatIcon kind="freeze" size={24} className="home-freeze-mark" />
          <span>
            <span className="font-semibold">
              A freeze covered {rescued === 1 ? "a day" : `${rescued} days`} you
              missed.
            </span>{" "}
            <span className="text-stone-500">
              The streak held. Only days you spoke count.
            </span>
          </span>
        </p>
      )}

      {/* The foot (#500): the two numbers only Today holds, as figures.
          Held at its landed height while the read is in flight; none on
          day zero, where a first recording sets both; a failed read says
          so in their place. */}
      {loading && <TodayFootSkeleton />}

      {failed && (
        <ErrorState
          className="arrive mt-7"
          {...readFailure("Your numbers")}
          onRetry={() => void load()}
        />
      )}

      {reps !== null && !dayOne && <TodayFoot line={lineAtFoot} run={runAtFoot} />}

      {/*
       * The standing soft-wall surface (DECISIONS #137): the honest
       * statement of risk for everyone who declined the loud ask, kept
       * quiet so the card's one tap stays uncontested. A
       * sentence and a text link (today-17).
       */}
      {anon === true && lifetime.length > 0 && (
        <p className="arrive mt-5 text-center text-caption text-pretty text-stone-500">
          {lifetime.length} recording
          {lifetime.length === 1 ? " lives" : "s live"} only in this
          browser.{" "}
          <Link href="/signup" className="text-link text-terracotta-700">
            Keep {lifetime.length === 1 ? "it" : "them"}
          </Link>
        </p>
      )}

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
      {dropOpen && plan.today && (
        <PriceDropSheet view={plan.view} today={plan.today} from={drop.from} onClose={drop.close} />
      )}
    </main>
  );
}
