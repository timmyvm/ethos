"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CountUp } from "@/components/CountUp";
import { DURATION } from "@/lib/motion";
import { DayTrail } from "@/components/DayTrail";
import { ChallengeCard } from "@/components/home/ChallengeCard";
import { CleanRunCard } from "@/components/home/CleanRunCard";
import { FloorCard } from "@/components/home/FloorCard";
import { TraitStrip } from "@/components/home/TraitStrip";
import { ACTION_CLASS, LessonBody } from "@/components/LessonScreen";
import { ModPicker } from "@/components/ModPicker";
import { SkeletonCleanRun } from "@/components/ui/Skeleton";
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
  const introOwns = Boolean(
    history.length === 0 && next && !skipIntros && introDue(next.unit, starMap)
  );
  const floorHref =
    introOwns && next
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
              <CountUp value={totalStars(starMap)} durationMs={DURATION.max} />{" "}
              stars
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
              <FloorCard
                chosen={chosen}
                dayOne={dayOne}
                dayOnePrompt={drill.prompt}
                dayOneNote={dayOne ? dayOneNote(answers) : undefined}
                again={streak.didToday}
                href={introOwns ? floorHref : undefined}
                mods={mods}
              />
              <div className="mt-5 flex items-baseline justify-between gap-3">
                <button
                  onClick={() => setTopic(spinForAnswers(null))}
                  className="press -my-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-stone-500"
                >
                  Not feeling it? Spin a new topic →
                </button>
                <button
                  onClick={() => setShowMods((v) => !v)}
                  className="press -my-3 inline-flex min-h-11 shrink-0 items-center text-[13px] font-semibold text-stone-500"
                >
                  {showMods
                    ? "Hide mods"
                    : mods.length > 0
                      ? `${mods.length} mod${mods.length === 1 ? "" : "s"} on · edit`
                      : "Turn up the difficulty"}
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
       * Today's line (#281). The behaviour channel, with the streak and
       * the day trail, above the outcome channel and never inside it.
       * It is null until there are three of the user's own readings in
       * the window: a target drawn from one recording is a fiction, and
       * a seeded one is the endowed progress docs/closure.md rejects.
       */}
      {challenge && <ChallengeCard challenge={challenge} />}

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
          <SkeletonCleanRun />
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
