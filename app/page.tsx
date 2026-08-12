"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DayTrail } from "@/components/DayTrail";
import { ModPicker } from "@/components/ModPicker";
import { PathRoad } from "@/components/PathRoad";
import { SkeletonScoreCard } from "@/components/Skeleton";
import { Paywall } from "@/components/Paywall";
import { StreakBadge } from "@/components/StreakBadge";
import { TopicRoulette } from "@/components/TopicRoulette";
import {
  fetchCoinLedger,
  fetchProfile,
  fetchReps,
  type RepRow,
} from "@/lib/client-data";
import { spin, type Topic } from "@/lib/topics";
import { sessionState } from "@/lib/auth";
import { dayTrail } from "@/lib/days";
import { todaysDrill } from "@/lib/drills";
import { syncFreezes } from "@/lib/freeze-sync";
import { firstRun, markWelcomed } from "@/lib/onboarding";
import { nextLesson, starsByLesson, totalStars } from "@/lib/path";
import { readPrefs } from "@/lib/prefs";
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
  const [premium, setPremium] = useState(false);
  const [mods, setMods] = useState<string[]>([]);
  const [showMods, setShowMods] = useState(false);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [demos, setDemos] = useState<string | null>(null);
  const [anon, setAnon] = useState<boolean | null>(null);

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

    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => {});

    /* A bought pose, if there is one. `null` until the ledger answers,
       so the default never flashes over the thing someone paid for. */
    fetchCoinLedger()
      .then((l) => setDemos(poseArt(readPrefs().pose, ownedFrom(l))))
      .catch(() => {});

    fetchReps()
      .then(async (rows) => {
        setReps(rows);
        const dates = rows.map((r) => new Date(r.created_at));
        // Optimistic: show the unfrozen streak immediately, then
        // reconcile freezes (which may involve a write).
        setStreak(computeStreak(dates));
        try {
          const sync = await syncFreezes(dates);
          setStreak(sync.streak);
          setRescued(sync.rescued.length);
          void armReminder({
            streak: sync.streak.current,
            didToday: sync.streak.didToday,
          });
        } catch {}
      })
      .catch(() => setReps([]));
  }, []);

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


  return (
    <main className="px-5 pb-24 pt-7">
      {/* Wordmark only, for now. brand.md wants a head mark beside it —
          ears and face mask reading at 32px — but the only Demos asset
          we have is a full-body render, and shrinking it to 32px gives a
          white tile with a sliver of face in it, which reads as a broken
          image rather than a brand. Better nothing than that until the
          real head mark lands. */}
      <div className="flex items-center justify-between">
        <span className="font-display text-[21px] font-bold tracking-[-0.03em]">
          ethos
        </span>
        <StreakBadge streak={streak} />
      </div>

      {rescued > 0 && (
        <div className="mt-4 rounded-[18px] border border-amber-500/30 bg-surface px-4 py-3 text-[13px] leading-relaxed">
          <span className="font-semibold">
            A freeze covered {rescued === 1 ? "a day" : `${rescued} days`} you
            missed.
          </span>{" "}
          <span className="text-stone-500">
            The streak held. It didn&apos;t grow — you only count days you
            spoke.
          </span>
        </div>
      )}

      {/* ONE moment above the floor, never two.
          brand.md bans orange as decoration — scarcity is what makes the
          terracotta tap command the screen, and two amber-filled cards
          stacked over the CTA is exactly the wash it warns about. The
          near-miss wins when there is one; otherwise the landmark or the
          open loop. It renders as a quiet rule-and-text line, not a
          filled card, so the only filled colour on this screen is the
          button. */}
      <div className="label-data mt-7">
        {topic
          ? "Roulette"
          : `${streak.didToday ? "Extra rep" : "Today's rep"} · ${unitName}`}
      </div>
      {/*
       * Why THIS, today. Duolingo's published answer to "why come back"
       * is half-life regression (Settles & Meeder, ACL 2016): the app
       * models what you're about to lose and schedules against it. Same
       * idea over our four measured skills — and the reason always
       * carries the number that chose it, so the call is checkable.
       */}
      {!topic && (gap || focus.strength !== null) && (
        <p className="mt-1.5 max-w-[92%] text-[13px] leading-relaxed text-stone-500">
          {gap ?? focus.reason}
        </p>
      )}
      {/*
       * TIER 1 — The Floor (DECISIONS #9). It has to win the screen on
       * size alone: a 32px title against 14.5px body and 11px labels is
       * a real jump, where the old 26/15/13 scale was one grey mush and
       * gave the eye nowhere to land first.
       *
       * The roulette REPLACES the card rather than sitting beside it.
       * A second card would mean a second terracotta button, and
       * brand.md allows exactly one tap per screen — scarcity is what
       * makes it command.
       */}
      {topic ? (
        <div className="mt-2.5">
          <TopicRoulette
            topic={topic}
            onSpin={setTopic}
            onTake={(t) => router.push(repHref({ topic: t.id, mods }))}
          />
          <button
            onClick={() => setTopic(null)}
            className="mt-3 text-[13px] font-semibold text-stone-500"
          >
            ← Back to today&apos;s drill
          </button>
        </div>
      ) : (
        <>
          <div className="relative mt-2.5 overflow-hidden rounded-[26px] border border-hairline bg-surface p-6 pb-[4.75rem] lift-hero">
            <h1 className="font-display max-w-[74%] text-[32px] font-bold leading-[1.06]">
              {drill.title}
            </h1>
            <p className="mt-3 max-w-[68%] text-[14.5px] leading-relaxed text-stone-400">
              {drill.prompt}
            </p>
            <div className="relative z-10 mt-5">
              <Link
                href={repHref({ lesson: next?.lesson.id, mods })}
                className="press block w-full rounded-[15px] bg-terracotta-500 px-6 py-4 text-center text-[17px] font-semibold text-cream transition-colors hover:bg-terracotta-600"
              >
                {streak.didToday ? "Go again" : "Take the floor"}
              </Link>
            </div>
            {/* Demos peeks in at the corner rather than being cropped
                through the middle — he's at a moment, not furniture. */}
            <Image
              src={
                streak.didToday
                  ? "/demos-celebrate.webp"
                  : (demos ?? "/demos.webp")
              }
              alt=""
              width={150}
              height={150}
              priority
              className="demos pointer-events-none absolute -bottom-5 -right-4 w-[128px] opacity-95"
            />
          </div>
          <button
            onClick={() => setTopic(spin(null))}
            className="press mt-3 block text-[13px] font-semibold text-stone-500"
          >
            Don&apos;t like it? Spin a random topic →
          </button>
        </>
      )}

      {/*
       * TIER 2 — the score. "The score IS the brand" (DECISIONS #18) and
       * brand.md sets the numbers as the hero, but this was a 26px stat
       * card at the bottom, indistinguishable from rep count. It gets
       * the second focal point: a different MATERIAL (stage dark against
       * white and cream) so it pulls the eye without competing with the
       * floor for first place, and it absorbs the three identical stat
       * cards that used to sit here saying nothing in particular.
       */}
      {/* The floor card above needs no round trip — `todaysDrill()` is
          local — so it paints immediately. This one is fetched, and used
          to pop in under it. */}
      {reps === null && <SkeletonScoreCard />}

      {history.length > 0 && (
        <section className="mt-5 rounded-[26px] bg-stage p-5 text-cream lift-stage">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="label-data !text-stone-500">Your Ethos</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-display text-[56px] font-bold leading-[0.85]">
                  {lastIndex ?? "—"}
                </span>
                <span className="text-[13px] text-stone-500">/1000</span>
              </div>
              {indexDelta !== null && indexDelta !== 0 && (
                <div
                  className={`mt-2 text-[12.5px] font-semibold ${
                    indexDelta > 0 ? "text-amber-500" : "text-stone-400"
                  }`}
                >
                  {indexDelta > 0 ? "▲ +" : "▼ "}
                  {indexDelta} since your first rep
                </div>
              )}
            </div>
            <div className="shrink-0 space-y-2.5 text-right">
              <div>
                <div className="font-display text-[20px] font-bold leading-none">
                  {history.length}
                </div>
                {/* "reps" is the brand word for the ACT — you take the
                    floor and do one. As the label on a counter it left
                    the unit ambiguous (a 60-second take? everything
                    between two pauses?). The counter names the thing it
                    counts; the verb stays "rep" everywhere it's obvious
                    from context. */}
                <div className="label-data !text-stone-500">recordings</div>
              </div>
              <div>
                <div className="font-display text-[20px] font-bold leading-none">
                  {totalStars(starMap)}
                </div>
                <div className="label-data !text-stone-500">stars</div>
              </div>
            </div>
          </div>

          {/*
           * The day counter and its line. The streak above is the
           * pressure; this is the memory — it never resets, so the
           * morning after a missed day still opens on a number that
           * went up. It also gets better with time by construction:
           * one day is a number, thirty is a shape.
           */}
          <DayTrail trail={trail} />

        </section>
      )}

      <button
        onClick={() => setShowMods((v) => !v)}
        className="mt-5 block text-[13px] font-semibold text-stone-500"
      >
        {showMods
          ? "Hide mods"
          : mods.length > 0
            ? `${mods.length} mod${mods.length === 1 ? "" : "s"} on · edit`
            : "Make it harder"}
      </button>

      {showMods && (
        <div className="mt-2">
          <ModPicker
            selected={mods}
            onChange={setMods}
            premium={premium}
            onPremiumTap={(m) => setPaywall(`${m.name} · premium mod`)}
          />
        </div>
      )}

      {history.length === 0 && (
        <p className="mt-5 text-center text-[13px] text-stone-400">
          60–90 seconds. Pauses are allowed — they&apos;re scored in your favor.
        </p>
      )}

      <Link
        href="/boss"
        className="mt-4 flex w-full items-center gap-3 rounded-[18px] border border-terracotta-100 bg-terracotta-50 p-4 text-left"
      >
        <Image
          src="/demos-workout.webp"
          alt=""
          width={40}
          height={40}
          className="demos w-10 shrink-0"
        />
        <span className="flex-1">
          <span className="block text-[14.5px] font-semibold">
            This week&apos;s boss: Cold Topic
          </span>
          <span className="block text-[12.5px] text-stone-500">
            A topic you&apos;ve never studied. 4 min research, 90s to explain,
            fact-checked.
          </span>
        </span>
        <span className="text-[13px] text-stone-400" aria-hidden>
          →
        </span>
      </Link>

      {/*
       * The standing soft-wall surface (DECISIONS #137). The loud ask
       * already happened in the rep flow; this is the persistent honest
       * statement of risk for everyone who declined it, kept at the
       * volume of "Make it harder" so the floor's one terracotta tap
       * stays uncontested.
       */}
      {anon === true && history.length > 0 && (
        <Link
          href="/signup"
          className="press mt-5 block text-center text-[13px] leading-relaxed text-stone-400"
        >
          {history.length} recording{history.length === 1 ? "" : "s"} live only
          in this browser ·{" "}
          <span className="font-semibold text-stone-500">keep them →</span>
        </Link>
      )}

      {/* The road (#141): the whole path, winding down from here. It
          goes LAST so the floor keeps the first screen (#9) — the road
          is what scrolling reveals, all of it, without a tab switch. */}
      <PathRoad starMap={starMap} hasAnyRep={history.length > 0} />

      {paywall && <Paywall reason={paywall} onClose={() => setPaywall(null)} />}
    </main>
  );
}
