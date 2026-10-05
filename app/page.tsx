"use client";

import Link from "next/link";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CountUp } from "@/components/CountUp";
import { DURATION } from "@/lib/motion";
import { DayTrail } from "@/components/DayTrail";
import { ChallengeCard, SkeletonChallenge } from "@/components/home/ChallengeCard";
import { CleanRunCard, SkeletonCleanRunCard } from "@/components/home/CleanRunCard";
import { FloorCard } from "@/components/home/FloorCard";
import { TraitStrip } from "@/components/home/TraitStrip";
import { ModPicker } from "@/components/ModPicker";
import { ErrorState } from "@/components/ui/ErrorState";
import { HeaderCount } from "@/components/ui/HeaderCount";
import { IconBack, IconStar } from "@/components/Icon";
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
import { dayOneNote, spinForAnswers } from "@/lib/portfolio";
import { repHref } from "@/lib/rep-config";
import { ownedFrom, poseArt } from "@/lib/shop";
import { armReminder } from "@/lib/reminders";
import { decayNote, nextFocus } from "@/lib/schedule";
import { choosePractice } from "@/lib/next-practice";
import { buildChallenge } from "@/lib/challenge";
import { readTraitsFromRow } from "@/lib/trait-readings";
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
    /* A failed profile read throws now; the device's pose and the
       answers' sync still run, and the mods keep the free reading. */
    Promise.all([fetchProfile().catch(() => null), fetchCoinLedger()])
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
  // The lesson list decides what is next; the daily rotation is the
  // fallback once every lesson is at three stars.
  const drill = next?.lesson ?? todaysDrill();
  const unitName = next?.unit.name ?? drill.unit;

  /*
   * The Index left this screen with the score card (#267), and the
   * dangling half-sentence that used to sit here went with it: it cited
   * Zeigarnik, which docs/closure.md found does not survive a
   * meta-analysis of 38 publications and inverts in exactly the
   * achievement setting this app creates.
   */

  /*
   * ONE selection for the screen (#268). The card names a trait and
   * quotes its number, and the strip below marks the same one, because
   * they read the same `choosePractice`.
   */
  const chosen =
    history.length > 0
      ? choosePractice(readTraitsFromRow(history[history.length - 1]))
      : null;

  /* The same reading, the same trait, one line to clear (#281). */
  const challenge = buildChallenge(history);

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
  /*
   * THE INTRO IS A FIRST-RUN SCREEN, and it took until now to notice it
   * had stopped being one.
   *
   * `introDue` is true while every lesson in a unit is at zero stars.
   * Since #268 the daily card routes by TOPIC, so an ordinary day never
   * writes an `f*` lesson id, so those stars never arrive, so introDue
   * stayed true forever: every user was handed /lesson/filler every
   * single day, and its Start button then sent them to "The baseline"
   * instead of the practice their numbers had chosen. The card computed
   * the right thing and the link threw it away.
   *
   * It is gated on having no history at all now, which is what "unit
   * intro" always meant. Everybody else goes straight to the recorder
   * with their practice's topic on it.
   */
  /*
   * `dayOne`, not `history.length === 0` (today-2): while the read is in
   * flight the history is an empty array too, `introDue` is true on an
   * empty star map, and Start pointed at /lesson/<unit> for everybody
   * until the read landed, the misroute this block exists to prevent.
   */
  const introOwns = Boolean(
    dayOne && next && !skipIntros && introDue(next.unit, starMap)
  );
  /* The read is in flight. A failed read is not loading: the floor
     paints its fallback rather than a skeleton that never resolves. */
  const loading = reps === null && !failed;
  const floorHref =
    introOwns && next
      ? introHref(next.unit.id, mods)
      : repHref({ lesson: next?.lesson.id, mods });

  return (
    <main className="px-5 pb-[var(--nav-clear)] pt-7">
      {/* The large title (ScreenHeader), with the date over it the way
          Apple's own Today screens carry it. The wordmark went with the
          apple-design pass: the tab says where you are, and the splash
          already says whose app it is. The earned chips keep their
          corner, beside the title. */}
      <ScreenHeader
        title="Today"
        dated
        trailing={
          reps !== null && (
            <>
              {/* Earned stars, beside the streak: the two standing
                  scores (27 Aug, Timothy's call, #176): a sage chip with
                  a gold mark, the glyph doing the word's job. Earned,
                  never a tap. The total counts up as the history read
                  lands rather than appearing already counted. One chip,
                  the shared header count, for both (A2). They land with
                  the read, in one fade with everything else it paints. */}
              <span className="arrive flex items-center gap-2">
                <HeaderCount
                  variant="chip"
                  glyph={<IconStar />}
                  value={<CountUp value={totalStars(starMap)} durationMs={DURATION.max} />}
                  label={`${totalStars(starMap)} stars`}
                />
                <StreakBadge streak={streak} />
              </span>
            </>
          )
        }
      />

      {/* The freeze reconciliation is its own read, landing after the
          history: the banner is a card the app produced, so it arrives
          from 6px below rather than pushing the floor down out of
          nowhere. */}
      {rescued > 0 && (
        <div role="status" className="arrive card mt-7 border-sage-300 p-4 text-body">
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
            {/* A section title on the ground, like every other section
                on Today (today-22): sentence case, not tracked caps. */}
            <h2 className="section-head">Roulette</h2>
            <div className="mt-3">
              <TopicRoulette
                topic={topic}
                onSpin={setTopic}
                onTake={(t) => router.push(repHref({ topic: t.id, mods }))}
              />
              {/* The way back, in the app's one back grammar (BackLink's
                  chevron and 44px geometry, today-17): a button, because
                  it changes this screen's state rather than its route. */}
              <button
                type="button"
                onClick={() => {
                  setTopic(null);
                  setFloorReturned(true);
                }}
                className="screen-bar-back press -mb-3 -ml-2.5 mt-1"
              >
                <IconBack size={22} />
                <span>Today&apos;s practice</span>
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
              <FloorCard
                chosen={chosen}
                dayOne={dayOne}
                dayOnePrompt={drill.prompt}
                dayOneNote={dayOne ? dayOneNote(answers) : undefined}
                again={streak.didToday}
                loading={loading}
                href={introOwns ? floorHref : undefined}
                mods={mods}
                onSpin={() => setTopic(spinForAnswers(null))}
                onMods={() => setShowMods((v) => !v)}
                modsOpen={showMods}
              />
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
       * Today's line (#281). The behaviour channel, with the streak and
       * the day trail, above the outcome channel and never inside it.
       * It is null until there are three of the user's own readings in
       * the window: a target drawn from one recording is a fiction, and
       * a seeded one is the endowed progress docs/closure.md rejects.
       */}
      {/* Its slot is held while the read is in flight (today-4): it
          used to cut in above the score skeleton once the read landed
          and push everything under it about 140px down. It lands in
          that slot with one fade. */}
      {loading && <SkeletonChallenge />}
      {challenge && (
        <div className="arrive">
          <ChallengeCard challenge={challenge} />
        </div>
      )}

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
      {loading && (
        <div className="mt-7">
          <SkeletonCleanRunCard />
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
                {/*
                 * The Ethos Index is off the first screen (#267). It was
                 * a number out of a thousand that had to be learned
                 * before it meant anything, and once learned it still
                 * hid which of five traits moved. It is demoted, not
                 * deleted: /history still opens on it.
                 */}
                <CleanRunCard reps={history}>
                  {/*
                   * The day counter and its line. The streak above is the
                   * pressure; this is the memory — it never resets, so the
                   * morning after a missed day still opens on a number that
                   * went up. Beside the outcome number and never mixed into
                   * it: monitoring a behaviour moves behaviour and
                   * monitoring an outcome moves outcomes, and one figure
                   * cannot do both jobs (docs/closure.md).
                   */}
                  <DayTrail trail={trail} pebbles={pebbles} />
                </CleanRunCard>
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
            {/* A sentence and a text link (today-17): no typed arrow and
                no middot, the link alone wears the action. */}
            {anon === true && history.length > 0 && (
              <p className="mt-3 py-3 text-center text-caption text-pretty text-stone-500">
                {history.length} recording
                {history.length === 1 ? " lives" : "s live"} only in this
                browser.{" "}
                <Link href="/signup" className="text-link text-terracotta-700">
                  Keep {history.length === 1 ? "it" : "them"}
                </Link>
              </p>
            )}
          </div>

          {/*
           * Where the road used to be (#267). The road was the same
           * road for everybody, ordered once and gated on stars; these
           * five are read off the last recording, and the only reason
           * any one of them is in front of you is that its number is
           * yours. The road itself moved to /lessons rather than
           * being deleted, and the strip links to it.
           */}
          <TraitStrip reps={history} />
        </>
      )}

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
    </main>
  );
}
