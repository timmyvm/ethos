"use client";

import Link from "next/link";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CountUp } from "@/components/CountUp";
import { DURATION } from "@/lib/motion";
import { AvatarCoin } from "@/components/home/AvatarCoin";
import { HomeHero } from "@/components/home/HomeHero";
import { TilesSkeleton, TodayTiles } from "@/components/home/HomeTiles";
import { WeekSkeleton, WeekTiles } from "@/components/home/WeekTiles";
import { ModPicker } from "@/components/ModPicker";
import { ErrorState } from "@/components/ui/ErrorState";
import { HeaderCount } from "@/components/ui/HeaderCount";
import { Segmented } from "@/components/ui/Segmented";
import { IconBack, IconStar } from "@/components/Icon";
import { Paywall } from "@/components/Paywall";
import { PriceDropSheet } from "@/components/premium/Moments";
import { usePlan, usePriceDrop } from "@/lib/use-plan";
import { readable, readFailure } from "@/lib/load";
import { StreakBadge } from "@/components/StreakBadge";
import { TopicRoulette } from "@/components/TopicRoulette";
import {
  fetchProfile,
  fetchRepSpine,
  fetchReps,
  type RepRow,
  type RepSpine,
} from "@/lib/client-data";
import { topicById, type Topic } from "@/lib/topics";
import { sessionState } from "@/lib/auth";
import { syncFreezes } from "@/lib/freeze-sync";
import { firstRun, markWelcomed } from "@/lib/onboarding";
import {
  introDue,
  introHref,
  nextLesson,
  starsByLesson,
  totalStars,
} from "@/lib/path";
import { readPrefs } from "@/lib/prefs";
import { readOnboarding } from "@/lib/answers";
import { syncOnboarding } from "@/lib/answers-sync";
import { spinForAnswers } from "@/lib/portfolio";
import { repHref } from "@/lib/rep-config";
import { armReminder } from "@/lib/reminders";
import { choosePractice } from "@/lib/next-practice";
import { buildChallenge, practiceRow } from "@/lib/challenge";
import { readTraitsFromRow } from "@/lib/trait-readings";
import { computeStreak, type StreakState } from "@/lib/streak";
import { usePaywallReturn } from "@/lib/use-paywall-return";
import { greetingName, heroObject, weekView } from "@/lib/home";
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
const FALLBACK_TOPIC = topicById("t2")!;

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
 *  - a Today / This week switch over a bento: today's line (#281) and
 *    the clean run (#254, #267), then the five traits, the weakest wide;
 *    or the week: the Index, the days spoken, the recordings.
 *
 * Demos is not on the card: he stood on it every day, which is
 * furniture. He arrives for moments, and the month's price drop is one,
 * so the screen keeps its one Demos.
 */
export default function Home() {
  const router = useRouter();
  const [reps, setReps] = useState<RepRow[] | null>(null);
  /** Every recording, a few columns each: the lifetime numbers. */
  const [spine, setSpine] = useState<RepSpine[]>([]);
  const [streak, setStreak] = useState<StreakState>(EMPTY);
  const [rescued, setRescued] = useState(0);
  /** The plan: null until the profile answers, and on a failed read. */
  const [premium, setPremium] = useState<boolean | null>(null);
  const [mods, setMods] = useState<string[]>([]);
  const [showMods, setShowMods] = useState(false);
  const [paywall, setPaywall] = useState<string | null>(null);
  /** Today or This week, under the card. */
  const [view, setView] = useState<"today" | "week">("today");
  /* The month the price steps down: a sheet over Today, never a card in
     its flow, held back while the paywall is up. Its Demos is the
     screen's only one: the card carries none (#393). */
  const plan = usePlan();
  const drop = usePriceDrop(plan.view, paywall === null);
  const dropOpen = drop.open && !!plan.today;
  const [topic, setTopic] = useState<Topic | null>(null);
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
   * one line, and a name too long even then is greeted by itself.
   */
  const [nameAlone, setNameAlone] = useState<string | null>(null);
  const greeting = nameKnown
    ? name
      ? nameAlone === name
        ? name
        : `Hi, ${name}`
      : "Today"
    : "\u00a0";
  useLayoutEffect(() => {
    const title = document.querySelector<HTMLElement>(".home .large-title");
    if (!title) return;
    if (!name) {
      title.style.removeProperty("font-size");
      return;
    }
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
      const full = width(`Hi, ${name}`);
      const aloneW = width(name);
      probe.remove();
      const alone = full * (26 / 34) > room;
      setNameAlone(alone ? name : null);
      const natural = alone ? aloneW : full;
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
  }, [greeting, name]);
  // Back from the paywall's account doors with paywall=1: the sheet reopens.
  usePaywallReturn(() => setPaywall("Premium"));

  /**
   * The history read, on its own so the retry can mean it. It used to
   * end `.catch(() => setReps([]))`, which drew the home screen of
   * someone with no recordings for someone whose recordings merely
   * didn't arrive: the day counter reset, the numbers vanished, and
   * nothing on screen said why.
   */
  const load = useCallback(async () => {
    setFailed(false);
    setReps(null);
    // The newest 90 whole rows for what reads a recording, and every
    // recording's date and stars for what counts from day one: the
    // streak, the freezes it earns, the week and the stars.
    const read = await readable(() => Promise.all([fetchReps(), fetchRepSpine()]));
    if (!read.ok) {
      setFailed(true);
      return;
    }
    const [rows, all] = read.data;
    setSpine(all);
    setReps(rows);
    const dates = all.map((r) => new Date(r.created_at));
    // Optimistic: show the unfrozen streak immediately, then reconcile
    // freezes (which may involve a write).
    setStreak(computeStreak(dates));
    const sync = await readable(() => syncFreezes(dates));
    if (!sync.ok) return;
    setStreak(sync.data.streak);
    setRescued(sync.data.rescued.length);
    void armReminder({
      streak: sync.data.streak.current,
      didToday: sync.data.streak.didToday,
    });
  }, []);

  /* This device's name, before the first paint (a tab switch never shows
     the line empty). A first open is under the splash meanwhile. */
  useLayoutEffect(() => {
    const local = greetingName(readOnboarding().answers.name);
    if (local) {
      setName(local);
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
      return;
    }
    markWelcomed();

    sessionState()
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
        // The account's name wins; the device's stands in without one.
        setName(greetingName(p?.display_name) ?? local);
        setNameKnown(true);
        // The introduction's answers follow the account (#232): a
        // finished walk goes up, or the account's answers come down.
        return syncOnboarding();
      })
      .catch(() => {});

    void load();
  }, [load, router]);

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
   * newest numbers under it.
   */
  const lastBeforeToday = practiceRow(history);
  const chosen = lastBeforeToday
    ? choosePractice(readTraitsFromRow(lastBeforeToday))
    : null;

  /* The same reading, the same trait, one line to clear (#281). */
  const challenge = buildChallenge(history);

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
  const startHref =
    introOwns && next
      ? introHref(next.unit.id, mods, undefined, "today")
      : dayOne && next
        ? /* Day one with the intros off: the same first lesson the
             intro would have opened, so the card's colour is the
             recording's, not the day's rotation. */
          repHref({ lesson: next.lesson.id, mods })
        : repHref({
            topic: chosen?.item.topicId ?? (fallback ? FALLBACK_TOPIC.id : undefined),
            /* The practice the card printed, so the recording screen
               heads with its angle and leads with its tactic (E52). */
            item: chosen?.item.id,
            mods,
            trait: heroFamily,
          });
  const heroTip = dayOne ? null : (chosen?.item.tips[0] ?? null);
  const heroTitle = dayOne
    ? "Day one starts today."
    : (chosen?.item.prompt ?? FALLBACK_TOPIC.prompt);
  const lead = dayOne ? "Your first recording" : streak.didToday ? "One more" : "Today's practice";
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
        title={greeting}
        barTitle="Today"
        dated
        leading={<AvatarCoin name={name} known={nameKnown} />}
        barTrailing={
          <span className="mr-3 flex h-9 items-center gap-2">
            {reps !== null && (
              /* Earned stars, beside the streak: the two standing scores
                 (#176), sage chips with a gold mark, never a tap. They
                 land with the read, in one fade. At zero both read as
                 unlit zeros (D25) until the first recording lights them. */
              <span className="arrive flex items-center gap-2">
                <HeaderCount
                  variant="chip"
                  empty={totalStars(starMap) === 0}
                  glyph={<IconStar />}
                  value={<CountUp value={totalStars(starMap)} durationMs={DURATION.max} />}
                  label={`${totalStars(starMap)} stars`}
                />
                <StreakBadge streak={streak} />
              </span>
            )}
          </span>
        }
      />

      {/*
       * The roulette runs INSIDE the card rather than beside it (#393's
       * fix round): the same colour, the same object, the topic spinning
       * in the topic's place and the pill taking it, so the one
       * terracotta tap is still the card's. The way back sits under it.
       */}
      <HomeHero
        loading={loading}
        family={heroFamily}
        lead={lead}
        trait={heroTrait}
        tip={heroTip}
        title={heroTitle}
        object={object}
        href={startHref}
        mods={mods}
        onSpin={() => {
          toggled.current = true;
          setShowMods(false);
          setTopic(spinForAnswers(null));
        }}
        spinRef={spinGlyph}
        onMods={() => setShowMods((v) => !v)}
        modsOpen={showMods}
        roulette={
          topic
            ? {
                topic,
                onSpin: setTopic,
                onTake: (t) => router.push(repHref({ topic: t.id, mods, trait: heroFamily })),
                headRef: rouletteHead,
              }
            : null
        }
      />
      {topic ? (
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

      {/* The freeze reconciliation is its own read, landing after the
          history: a card the app produced, so it arrives from 6px below. */}
      {rescued > 0 && (
        <div role="status" className="arrive card mt-5 border-sage-300 p-4 text-body">
          <span className="font-semibold">
            A freeze covered {rescued === 1 ? "a day" : `${rescued} days`} you
            missed.
          </span>{" "}
          <span className="text-stone-500">
            The streak held. Only days you spoke count.
          </span>
        </div>
      )}

      {/* The switch (ToyCad's Start / My Recent), on the shared Segmented
          and its keys. Gone on a failed read, where neither side has a
          number to show. */}
      {!failed && (
        <div className="mt-7">
          <Segmented
            label="Show"
            size="lg"
            className="home-seg"
            value={view}
            onChange={setView}
            options={[
              { value: "today", label: "Today" },
              { value: "week", label: "This week" },
            ]}
          />
        </div>
      )}

      {/* Every tile holds its landed height while the read is in flight. */}
      {loading && (view === "today" ? <TilesSkeleton /> : <WeekSkeleton />)}

      {failed && (
        <ErrorState
          className="arrive mt-7"
          {...readFailure("Your numbers")}
          onRetry={() => void load()}
        />
      )}

      {reps !== null &&
        (view === "today" ? (
          <TodayTiles key="today" reps={history} challenge={challenge} focus={dayOne ? heroFamily : heroTrait} />
        ) : (
          <WeekTiles key="week" week={weekView(lifetime, new Date())} />
        ))}

      {/*
       * The standing soft-wall surface (DECISIONS #137): the honest
       * statement of risk for everyone who declined the loud ask, kept
       * quiet so the card's one terracotta tap stays uncontested. A
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
