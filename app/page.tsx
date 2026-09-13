"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CountUp } from "@/components/CountUp";
import { DURATION } from "@/lib/motion";
import { DayTrail } from "@/components/DayTrail";
import { ScoreCard } from "@/components/ScoreCard";
import { ACTION_CLASS, LessonBody } from "@/components/LessonScreen";
import { ModPicker } from "@/components/ModPicker";
import { PathRoad } from "@/components/PathRoad";
import { SkeletonScoreCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Paywall } from "@/components/Paywall";
import { readable, readFailure } from "@/lib/load";
import { StreakBadge } from "@/components/StreakBadge";
import { TopicRoulette } from "@/components/TopicRoulette";
import {
  fetchCoinLedger,
  fetchProfile,
  fetchReps,
  type RepRow,
} from "@/lib/client-data";
import { type Topic } from "@/lib/topics";
import { sessionState } from "@/lib/auth";
import { dayTrail, pebbleDays } from "@/lib/days";
import { todaysDrill } from "@/lib/drills";
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
import { readOnboarding, type Answers, EMPTY_ANSWERS } from "@/lib/answers";
import { syncOnboarding } from "@/lib/answers-sync";
import { buildPortfolio, dayOneNote, spinForAnswers } from "@/lib/portfolio";
import { repHref } from "@/lib/rep-config";
import { ownedFrom, poseArt } from "@/lib/shop";
import { armReminder } from "@/lib/reminders";
import { decayNote, nextFocus } from "@/lib/schedule";
import { computeStreak, type StreakState } from "@/lib/streak";

const EMPTY: StreakState = {
  current: 0,
  longest: 0,
  atRisk: false,
  didToday: false,
  frozenInRun: 0,
};

// "The Floor" (DECISIONS #9) — one dominant rep card, one terracotta tap.
export default function Home() {
  const router = useRouter();
  const [reps, setReps] = useState<RepRow[] | null>(null);
  const [streak, setStreak] = useState<StreakState>(EMPTY);
  const [rescued, setRescued] = useState(0);
  const [frozen, setFrozen] = useState<Date[]>([]);
  const [premium, setPremium] = useState(false);
  const [mods, setMods] = useState<string[]>([]);
  const [showMods, setShowMods] = useState(false);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  /*
   * Whether the floor is coming BACK from the roulette (#242's motion
   * pass). The roulette rises into the floor's place with `arrive-lift`,
   * so the floor has to rise back into its own when the way out is
   * taken; on a cold open it must still paint instantly, which is why
   * this is a flag and not a class on the card.
   */
  const [floorReturned, setFloorReturned] = useState(false);
  const [demos, setDemos] = useState<string | null>(null);
  const [anon, setAnon] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  /** The introduction's answers (#232). Read after paint, never at render. */
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [skipIntros, setSkipIntros] = useState(false);

  /**
   * The history read, on its own so the retry can mean it. It used to
   * end `.catch(() => setReps([]))`, which drew the home screen of
   * someone with no reps for someone whose reps merely didn't arrive —
   * the day counter reset, the score card vanished, and nothing on
   * screen said why.
   */
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
    // Optimistic: show the unfrozen streak immediately, then reconcile
    // freezes (which may involve a write).
    setStreak(computeStreak(dates));
    const sync = await readable(() => syncFreezes(dates));
    if (!sync.ok) return;
    setStreak(sync.data.streak);
    setRescued(sync.data.rescued.length);
    setFrozen(sync.data.frozenDays);
    void armReminder({
      streak: sync.data.streak.current,
      didToday: sync.data.streak.didToday,
    });
  }, []);

  useEffect(() => {
    /*
     * A fresh browser gets the introduction (DECISIONS #133) — the
     * three screens existed and nothing routed a first visit into
     * them. Checked synchronously before any fetch: the fetches mint
     * an anonymous session, which would make this device stop looking
     * fresh before the decision was made.
     */
    if (firstRun()) {
      router.replace("/welcome");
      return;
    }
    markWelcomed();

    sessionState()
      .then((s) => setAnon(s.signedIn && s.anonymous))
      .catch(() => {});

    setAnswers(readOnboarding().answers);
    setSkipIntros(readPrefs().skipIntros);

    /* A bought pose, if there is one. `null` until both the ledger and
       the profile answer, so the default never flashes over the thing
       someone paid for. The account's equipped pose wins over the
       device's copy — it's what follows a purchase to a new phone. */
    Promise.all([fetchProfile(), fetchCoinLedger()])
      .then(([p, l]) => {
        setPremium(p?.premium ?? false);
        const pose = p?.equipped_pose ?? readPrefs().pose;
        setDemos(poseArt(pose, ownedFrom(l)));
        // The introduction's answers follow the account (#232): a
        // finished walk goes up, or the account's answers come down.
        return syncOnboarding().then((s) => setAnswers(s.answers));
      })
      .catch(() => {});

    void load();
  }, [load, router]);

  const history = reps ?? [];
  const starMap = starsByLesson(history);
  const next = nextLesson(starMap);
  // The path decides what to train; the daily rotation is the fallback
  // once every lesson is at three stars.
  const drill = next?.lesson ?? todaysDrill();
  const unitName = next?.unit.name ?? drill.unit;

  // of the week, the unfinished lesson is the stronger pull (Zeigarnik).
  const scored = history.filter((r) => r.ethos_index !== null);
  const lastIndex = scored[scored.length - 1]?.ethos_index ?? null;
  // Against the FIRST scored rep, not the previous one — the headline
  // number on the home screen is the arc, not the last delta.
  const indexDelta =
    lastIndex !== null && scored.length > 1
      ? lastIndex - (scored[0].ethos_index as number)
      : null;

  const focus = nextFocus(history);
  const gap = decayNote(history);
  const trail = dayTrail(history);
  const pebbles = pebbleDays(history, frozen);

  /*
   * The floor's headline, and which of the two things names the lesson
   * (#214).
   *
   * docs/voice.md approves "Day one starts today." and nothing for the
   * days after it, and "Day forty-one starts today." is a paraphrase,
   * which is the one thing the copy pass may not write. So on every
   * other day the headline is the LESSON NAME, which is approved copy
   * already, and the button drops back to #9's "Take the floor".
   * Exactly one of the two names the lesson at any time: with the
   * day-one line up the button carries the name, and without it the
   * headline does. Neither ever says it twice.
   *
   * `reps !== null` is what stops the day-one line flashing over the
   * floor of someone with forty recordings on every cold open: until
   * the history lands nobody is on day one. The lesson name needs no
   * round trip, so the card still paints immediately.
   */
  const dayOne = reps !== null && history.length === 0;
  const dayLine = dayOne ? "Day one starts today." : drill.title;

  /*
   * A unit nobody has scored in yet gets its teaching screen on the way
   * in (#210, Duolingo's unit header); every other tap goes straight to
   * the recording, because a technique screen in front of every lesson
   * is a paragraph a day.
   */
  const floorHref =
    next && !skipIntros && introDue(next.unit, starMap)
      ? introHref(next.unit.id, mods)
      : repHref({ lesson: next?.lesson.id, mods });

  return (
    <main className="px-5 pb-22 pt-7">
      {/* Wordmark only, for now. brand.md wants a head mark beside it —
          ears and face mask reading at 32px — but the only Demos asset
          we have is a full-body render, and shrinking it to 32px gives a
          white tile with a sliver of face in it, which reads as a broken
          image rather than a brand. Better nothing than that until the
          real head mark lands. */}
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[19px] font-extrabold uppercase tracking-[0.02em]">
          ethos
        </span>
        <div className="flex items-baseline gap-3.5">
          {/* Earned stars, beside the streak — the two standing scores
              (27 Aug, Timothy's call). Plain olive text now (#201):
              earned, never a pill, never a tap. */}
          {totalStars(starMap) > 0 && (
            <span className="font-display text-[13px] font-bold text-sage-700 tabular-nums">
              <span aria-hidden>★ </span>
              {/* The total LANDS with the history read — the corner is
                  empty until then — so it counts up rather than
                  appearing already counted. Not the celebration length:
                  nothing was earned here, a read landed. */}
              <CountUp value={totalStars(starMap)} durationMs={DURATION.max} />
            </span>
          )}
          <StreakBadge streak={streak} />
        </div>
      </div>

      {/* The freeze reconciliation is its own read, landing after the
          history: the banner is a card the app produced, so it arrives
          from 6px below rather than pushing the floor down out of
          nowhere. */}
      {rescued > 0 && (
        <div className="arrive elev-1 mt-7 rounded-card border border-sage-300 bg-raised p-4 text-body">
          <span className="font-semibold">
            A freeze covered {rescued === 1 ? "a day" : `${rescued} days`} you
            missed.
          </span>{" "}
          <span className="text-stone-500">
            The streak held. Only days you spoke count.
          </span>
        </div>
      )}

      {/*
       * TIER 1 — The Floor (DECISIONS #9), and the ONE lifted card on
       * this screen (the one-system pass, #234): raised paper, a
       * card-edge hairline and `elev-2`. It sat bare on the ground under
       * a hairline, which put the screen's first object at the same
       * depth as its list rows; the score card below stays FLAT because
       * deep sage on cream is already the second focal point, and two
       * lifted things is no lift at all.
       *
       * The roulette REPLACES the block rather than sitting beside it,
       * and wears the lift in its place. A second block would mean a
       * second terracotta button, and brand.md allows exactly one tap
       * per screen — scarcity is what makes it command.
       */}
      <section className="mt-7">
        {topic ? (
          /* The roulette block rises into the floor's place as ONE
             thing (#242): eyebrow, card and the way back on the same
             300ms lift, because they all arrived from the same tap. */
          <div key="roulette" className="arrive-lift">
            {/* The unit moved out of this label and into the line under
                the title, where voice.md puts it: the eyebrow names the
                slot, the body names the thing. */}
            <div className="label-data">Roulette</div>
            <div className="mt-3">
              <TopicRoulette
                topic={topic}
                onSpin={setTopic}
                onTake={(t) => router.push(repHref({ topic: t.id, mods }))}
              />
              {/* The way back, at the 44px target its two siblings
                  under the floor card already carry. */}
              <button
                onClick={() => {
                  setTopic(null);
                  setFloorReturned(true);
                }}
                className="press -mb-3 mt-1 inline-flex min-h-11 items-center text-[13px] font-semibold text-stone-500"
              >
                ← Back to today&apos;s lesson
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Coming BACK from the roulette, the floor rises into its
                own place the same way the roulette rose into it: the
                card and the two lines under it on one lift. On a cold
                open the wrapper carries no class and the floor paints
                instantly, which is the rule it has had since #224. */}
            {/* The keys are what make the two states two elements
                (#242). Both branches are a <div> in the same slot, so
                without them React keeps the node, the class string
                never changes, and the entrance simply does not run —
                the floor came back by cutting. */}
            <div
              key="floor"
              className={floorReturned ? "arrive-lift" : undefined}
            >
              <div className="elev-2 rounded-sheet border border-card-edge bg-raised p-5">
                {/* Centred with the rest of the card (#212): one
                  announcement over one tap. */}
                <div className="label-data mb-3 text-center">
                  {streak.didToday ? "Extra lesson" : "Today's lesson"}
                </div>
                {/*
                 * The floor's copy is the template (docs/voice.md Part 2)
                 * via <LessonBody>, and the PROMPT is gone from it
                 * (DECISIONS #209): it was the same sentence the recording
                 * screen shows a tap later, so reading it here bought
                 * nothing and taught people that the words on this screen
                 * are skippable.
                 *
                 * The `note` is the caption level: why THIS, today.
                 * Duolingo's published answer to "why come back" is
                 * half-life regression (Settles & Meeder, ACL 2016), and
                 * the reason always carries the number that chose it, so
                 * the call stays checkable.
                 */}
                {/*
                 * The lesson NAME is the one thing on this card that
                 * changes after a read: `todaysDrill()` paints instantly,
                 * then the history says which lesson is actually next,
                 * and three lines of type swapped in place (#242's strip
                 * caught it between 160 and 240ms). Keyed on the lesson,
                 * so the settled name rises its 6px instead of flicking
                 * over the placeholder — and unkeyed until the read
                 * lands, so a cold open still paints the floor with no
                 * entrance at all (#224).
                 */}
                <div
                  key={reps === null ? "floor-pending" : drill.id}
                  className={reps === null ? undefined : "arrive dur-fast"}
                >
                  <LessonBody
                    align="center"
                    title={dayLine}
                    line={unitName}
                    /* Day one carries what they said they notice, in their
                 words (#231); after that the number decides the line. */
                    note={
                      dayOne
                        ? dayOneNote(answers)
                        : (gap ??
                          (focus.strength !== null ? focus.reason : undefined))
                    }
                  />
                </div>
                {/*
                 * Demos peeks in from the right, just above the tap.
                 *
                 * He was beside the button, which pushed the one terracotta
                 * thing off the screen's axis under a centred headline. He
                 * cannot simply move to the middle either: the default mark
                 * (#7's side profile) is drawn cropped into the corner of
                 * its frame, so centred it reads as a broken image and
                 * anchored to an edge it reads as intended. Edge it is, and
                 * the button underneath gets the full width and the centre.
                 */}
                <div className="-mr-3 mt-2 flex justify-end">
                  <Image
                    src={
                      streak.didToday
                        ? "/demos-celebrate.webp"
                        : (demos ?? "/demos.webp")
                    }
                    alt=""
                    width={104}
                    height={104}
                    priority
                    className="demos pointer-events-none -mb-1 w-[58px]"
                  />
                </div>
                {/* The one tap, in the one declaration every screen shares
                (#234): the colour is the lift, so it takes no border
                and no shadow. */}
                <Link href={floorHref} className={`${ACTION_CLASS} mt-3`}>
                  {dayOne
                    ? `${drill.title} →`
                    : streak.didToday
                      ? "Go again"
                      : "Take the floor"}
                </Link>
              </div>
              <div className="mt-5 flex items-baseline justify-between gap-3">
                <button
                  onClick={() => setTopic(spinForAnswers(null))}
                  className="press -my-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-terracotta-700"
                >
                  Not feeling it? Spin a new topic →
                </button>
                <button
                  onClick={() => setShowMods((v) => !v)}
                  className="press -my-3 inline-flex min-h-11 shrink-0 items-center text-[13px] font-semibold text-terracotta-700"
                >
                  {showMods
                    ? "Hide mods"
                    : mods.length > 0
                      ? `${mods.length} mod${mods.length === 1 ? "" : "s"} on · edit`
                      : "Make it harder"}
                </button>
              </div>
            </div>
            {showMods && (
              <div className="reveal mt-3">
                <ModPicker
                  selected={mods}
                  onChange={setMods}
                  premium={premium}
                  onPremiumTap={(m) => setPaywall(`${m.name} · premium mod`)}
                />
              </div>
            )}
          </>
        )}
      </section>

      {/*
       * TIER 2 — the score. "The score IS the brand" (DECISIONS #18) and
       * brand.md sets the numbers as the hero, but this was a 26px stat
       * card at the bottom, indistinguishable from rep count. It gets
       * the second focal point: a different MATERIAL (deep sage against
       * the cream room, #165) so it pulls the eye without competing with
       * the floor for first place, and it absorbs the three identical
       * stat cards that used to sit here saying nothing in particular.
       */}
      {/* The floor card above needs no round trip — `todaysDrill()` is
          local — so it paints immediately. This one is fetched, and used
          to pop in under it. */}
      {/* The gap belongs to the parent (#234): the card and its
          skeleton carry no outer margin, so both sit at the same 28. */}
      {reps === null && !failed && (
        <div className="mt-7">
          <SkeletonScoreCard />
        </div>
      )}

      {/* The failure is a card the read produced, same as the score
          card would have been, so it arrives rather than appearing
          where the skeleton was standing. */}
      {failed && (
        <ErrorState
          className="arrive mt-7"
          {...readFailure("Your score")}
          onRetry={() => void load()}
        />
      )}

      {/*
       * What the history read paints, in one arrival (DECISIONS #224):
       * the score card over its skeleton and the save line under it.
       * One fade for one event, the read landing; the floor above needs
       * no round trip and never fades.
       *
       * The road left this wrapper in the motion pass (#242): it is a
       * list, so it assembles itself row by row, and a block fade over
       * a stagger is two entrances on one thing. One block, one
       * entrance — the score lands, then the road builds under it.
       */}
      {reps !== null && (
        <>
          <div className="arrive">
            {history.length > 0 && (
              <div className="mt-7">
                <ScoreCard
                  index={lastIndex}
                  delta={indexDelta}
                  recordings={history.length}
                  stars={totalStars(starMap)}
                >
                  {/*
                   * The day counter and its line. The streak above is the
                   * pressure; this is the memory — it never resets, so the
                   * morning after a missed day still opens on a number that
                   * went up. It also gets better with time by construction:
                   * one day is a number, thirty is a shape.
                   */}
                  <DayTrail trail={trail} pebbles={pebbles} />
                </ScoreCard>
              </div>
            )}

            {/* The boss card moved to /games (DECISIONS #158): the road keeps
          its checkpoint, the games tab keeps the weekly headliner, and
          the floor's scroll goes floor, score, road with nothing between. */}

            {/*
             * The standing soft-wall surface (DECISIONS #137). The loud ask
             * already happened in the rep flow; this is the persistent honest
             * statement of risk for everyone who declined it, kept quiet so
             * the floor's one terracotta tap stays uncontested — the link alone
             * wears the action text.
             */}
            {anon === true && history.length > 0 && (
              <Link
                href="/signup"
                className="press mt-3 block py-3 text-center text-caption leading-relaxed text-stone-400"
              >
                {history.length} recording
                {history.length === 1 ? " lives" : "s live"} only in this
                browser ·{" "}
                <span className="font-semibold text-terracotta-700">
                  keep {history.length === 1 ? "it" : "them"} →
                </span>
              </Link>
            )}
          </div>

          {/* The road (#141): the whole path, winding down from here. It
          goes LAST so the floor keeps the first screen (#9) — the road
          is what scrolling reveals, all of it, without a tab switch. */}
          {/* Only once the reps are in hand: a road drawn from an unread
          history shows nought stars to someone who has earned twenty. */}
          <PathRoad
            starMap={starMap}
            hasAnyRep={history.length > 0}
            focus={buildPortfolio(answers).focus}
          />
        </>
      )}

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
    </main>
  );
}
