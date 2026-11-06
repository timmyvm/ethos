"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { DemosArt } from "@/components/DemosArt";
import { IconBoss, IconGlobe } from "@/components/Icon";
import { Paywall } from "@/components/Paywall";
import { PremiumMark } from "@/components/PremiumMark";
import { Reel, useReel } from "@/components/Reel";
import { Disclosure } from "@/components/ui/Disclosure";
import { FooterShelf } from "@/components/ui/FooterShelf";
import { HeroStage } from "@/components/ui/HeroStage";
import { BackLink } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  BOSS_RESEARCH_SECONDS,
  BOSS_WEEKS,
  bossAnswerLine,
  bossReadLine,
  bossWeekLine,
  bossWeeks,
  daysLeftInWeek,
  takeThisWeek,
  type BossWeek,
} from "@/lib/boss";
import { fetchProfile, fetchRepSpine, fetchReps } from "@/lib/client-data";
import { COLD_TOPICS, weeklyTopic, type ColdTopic } from "@/lib/cold-topics";
import { HOSTILE_LINE } from "@/lib/hostile";
import { weekStart } from "@/lib/level";
import { prefersReducedMotion } from "@/lib/prefs";
import { repHref } from "@/lib/rep-config";
import { SPRING, springEasing, springMs } from "@/lib/spring";
import { ACTION_CLASS, DISABLED_CLASS, INPUT_CLASS } from "@/lib/ui";
import { usePaywallReturn } from "@/lib/use-paywall-return";

/** Free tier: the headliner plus two re-rolls a week (DECISIONS #181). */
const FREE_SPINS = 2;
const SPINS_KEY = "ethos.boss.spins";

type Phase = "lobby" | "research";

function readSpins(week: string): number {
  try {
    const raw = localStorage.getItem(SPINS_KEY);
    if (!raw) return 0;
    const v = JSON.parse(raw) as { week?: string; used?: number };
    return v.week === week ? (v.used ?? 0) : 0;
  } catch {
    return 0;
  }
}

function writeSpins(week: string, used: number): void {
  try {
    localStorage.setItem(SPINS_KEY, JSON.stringify({ week, used }));
  } catch {}
}

/**
 * Cold Topic, the weekly boss (#292 names it). A topic you haven't
 * studied, 90 seconds to read, then 90 seconds from memory, scored on
 * delivery by the normal engine AND fact-checked against the topic's
 * ground truth.
 *
 * The week's benchmark (the games plan, item 16): the same 90 seconds
 * every week, no mods, so its number is the honest test of whether the
 * practice transferred. The lobby keeps the last six weeks, each week's
 * first boss Index, and the score step compares with last week's.
 *
 * Access (#181, amends #36): everyone starts on the week's headliner;
 * free re-rolls the wheel twice a week and takes what lands, premium
 * spins freely or picks from the library. Free still gets one boss RUN
 * a week; premium runs any topic, any time. A free account's spent week
 * opens its take instead of running the reading for nothing.
 *
 * The study sheet moved (#182): the truth bullets show only inside the
 * research window. They used to sit on the pre-clock screen, which was
 * unlimited free study time before a boss whose whole point is the
 * cold open. The reading's end, or "I'm ready early", goes straight to
 * the recording screen: Record is the one tap left.
 *
 * modes-5: nothing here reads the clock while rendering. The week and
 * the headliner come from `new Date()`, and this page is prerendered at
 * build, so a render-time read hydrated the build week's topic against
 * this week's (React #418) and flashed the old title. Both are read on
 * mount; until then the stage's label and the reel hold their space
 * invisibly.
 */
export default function BossPage() {
  const router = useRouter();
  const [topic, setTopic] = useState<ColdTopic | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [left, setLeft] = useState(BOSS_RESEARCH_SECONDS);
  const [paywall, setPaywall] = useState<string | null>(null);
  // Back from the paywall's account doors or Checkout's back arrow
  // (paywall=1): the sheet opens again where it was.
  usePaywallReturn(() => setPaywall("Premium"));
  /** Unknown until the profile read lands: the spins counter waits for
      it, so a paying account never flashes a free allowance. */
  const [premium, setPremium] = useState<boolean | null>(null);
  /** The last six weeks, Mondays known on mount; their takes once read. */
  const [weeks, setWeeks] = useState<BossWeek[] | null>(null);
  /** This week's take, which a spent free week opens. */
  const [takeId, setTakeId] = useState<string | null>(null);
  const [library, setLibrary] = useState(false);
  const [query, setQuery] = useState("");
  const [spinsUsed, setSpinsUsed] = useState<number | null>(null);
  /* The stage's week line and the record wait for the read, as Practice's does. */
  const [weekRead, setWeekRead] = useState<"no" | "yes" | "failed">("no");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const leaving = useRef(false);

  useEffect(() => {
    const w = weeklyTopic();
    setTopic(w);
    const now = new Date();
    const thisWeek = weekStart(now).toISOString().slice(0, 10);
    setWeek(thisWeek);
    setDaysLeft(daysLeftInWeek(weekStart(now)));
    setSpinsUsed(readSpins(thisWeek));
    setWeeks(bossWeeks([], now));
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      // Unknown, not free: a failed read never locks a paying account.
      .catch(() => setPremium(null));
    /* The record reads every recording's date and Index (a heavy week
       of practice would push six weeks of bosses past the newest 90);
       the newest 90 whole rows hold this week's take and its id. */
    Promise.all([fetchRepSpine(), fetchReps()])
      .then(([spine, reps]) => {
        setWeeks(bossWeeks(spine, now));
        setTakeId(takeThisWeek(reps, now)?.id ?? null);
        setWeekRead("yes");
      })
      /* A failed read lands on "days left", which is true either way,
         and a record of dashes: unknown, never a missed week. */
      .catch(() => setWeekRead("failed"));
  }, []);

  const takenThisWeek = weekRead === "yes" && (weeks?.at(-1)?.taken ?? false);
  const paid = premium === true;
  const locked = takenThisWeek && premium === false;
  const spinsLeft = Math.max(0, FREE_SPINS - (spinsUsed ?? 0));

  /* One way to the floor, from the reading's end or "I'm ready early":
     straight to the recording screen, no Ready screen between. */
  const takeTheFloor = useCallback(() => {
    if (!topic || leaving.current) return;
    if (locked) {
      setPaywall("You've taken this week's boss");
      return;
    }
    leaving.current = true;
    router.push(repHref({ boss: topic.id }));
  }, [topic, locked, router]);

  /* The stage stays where it stood and opens up to the reading's room:
     its height springs from the lobby's to the reading's, and Demos, who
     reads the stage's height, grows with it. Reduced motion and lite
     graphics show the end state. */
  function startReading() {
    const stageEl = () => document.querySelector<HTMLElement>('[data-look="boss-stage"]');
    const from = stageEl()?.getBoundingClientRect().height ?? null;
    flushSync(() => setPhase("research"));
    const el = stageEl();
    if (!el || from === null || prefersReducedMotion()) return;
    const to = el.getBoundingClientRect().height;
    if (Math.abs(to - from) < 2) return;
    el.animate(
      [
        { minHeight: `${from}px`, maxHeight: `${from}px` },
        { minHeight: `${to}px`, maxHeight: `${to}px` },
      ],
      { duration: springMs(SPRING.base), easing: springEasing(SPRING.base) }
    );
  }

  useEffect(() => {
    if (phase !== "research") return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "research" && left === 0) takeTheFloor();
  }, [phase, left, takeTheFloor]);

  const mins = Math.floor(left / 60);
  const secs = String(left % 60).padStart(2, "0");

  function randomTopic(excludeId: string | null): ColdTopic {
    const pool = COLD_TOPICS.filter((t) => t.id !== excludeId);
    return pool[Math.floor(Math.random() * pool.length)] ?? COLD_TOPICS[0];
  }

  /* The same wheel the roulette turns (#278). This screen used to hold
     a near-verbatim copy of that flicker, so a change to one of them
     was a change to neither. Until the mount read, the reel holds the
     first topic invisibly: the server and the first client render then
     agree, and nothing jumps when the week's headliner lands. */
  const shown = topic ?? COLD_TOPICS[0];
  const reel = useReel<ColdTopic>({
    current: shown,
    draw: randomTopic,
    onLand: setTopic,
  });

  function spinWheel() {
    if (reel.rolling || !topic || !week) return;
    if (!paid && spinsLeft <= 0) {
      setPaywall("More spins · premium picks any topic");
      return;
    }
    if (!paid) {
      const used = (spinsUsed ?? 0) + 1;
      setSpinsUsed(used);
      writeSpins(week, used);
    }
    reel.spin();
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COLD_TOPICS;
    return COLD_TOPICS.filter((t) => t.title.toLowerCase().includes(q));
  }, [query]);

  return (
    <main
      className={`flex min-h-dvh flex-col px-5 pt-[env(safe-area-inset-top)] ${
        phase === "lobby" ? "" : "pb-safe"
      }`}
    >
      {/* Practice is where both bosses' doors live (modes-1). */}
      <BackLink href="/games" label="Practice" />

      {phase === "lobby" && (
        <>
          {/* Practice's stage, the same one (E30): sky, the sheet
              radius, p-5, the screen's one elev-2, the week's boss named
              as Practice names it, what it asks in its two clocks, the
              week's state from the same helper, and the clock Demos
              standing on its floor at the right, without his spring: his
              arrival stays Practice's weekly moment (#313). The title is
              the page's h1. Nothing on the stage is a tap. On a pushed
              screen with room to spare it takes the free height and he
              grows with it (132 to 184), so the card you tapped on
              Practice opens up here and no band of bare ground is left
              over the shelf (R2F-09: 136pt at 390x844). */}
          <HeroStage
            data-look="boss-stage"
            className="mt-4 flex-1"
            artGrow={184}
            eyebrow="This week's boss"
            line={
              <p
                className="practice-week font-display mt-auto pt-3 text-link font-bold"
                data-done={takenThisWeek || undefined}
              >
                {bossWeekLine(weekRead === "no" ? null : takenThisWeek, daysLeft)}
              </p>
            }
            art={<DemosArt pose="clock" size={184} fit grounded halo={{ tone: "sky", kind: "stage" }} />}
          >
            <h1 className="font-display mt-1.5 text-title font-extrabold">Cold Topic</h1>
            <p className="stage-ink font-display mt-1 text-body font-semibold">
              <span className="block">{bossReadLine()}</span>
              <span className="block">{bossAnswerLine()}</span>
            </p>
          </HeroStage>

          {/* The topic on the ground, at the title's 26/800, and what
              the take earns under it. Topic title only: the study sheet
              waits for the clock (#182). */}
          <Reel
            state={reel}
            current={shown}
            className={`font-display mt-5 text-title font-extrabold [--reel-cell:3.75rem] ${
              topic ? "" : "invisible"
            }`}
            render={(t) => (
              <span className="flex h-full items-center text-balance">{t.title}</span>
            )}
          />
          <p className="mt-1 text-link font-medium text-stone-500">
            You get a delivery score and a fact-check.
          </p>

          <BossRecord weeks={weeks} read={weekRead} />

          {/* The wheel, or why there is none. Spin is the secondary pill
              with the allowance beside it: allotted, not earned, so never
              sage, and the tier is named once, by the Premium head below.
              The count waits for the profile, so a paying account never
              sees one. A free account's spent week has nothing to spin
              for: the row says so instead, at the row's own height, so
              nothing under it moves when the read lands. */}
          <div className="mt-4 flex min-h-11 items-center gap-3">
            {locked ? (
              <p className="arrive text-link font-medium text-stone-500">
                You&apos;ve taken this week&apos;s boss. It resets Monday.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={spinWheel}
                  disabled={reel.rolling || !topic}
                  className={`press font-display min-h-11 shrink-0 rounded-tap border border-edge bg-surface px-5 text-row ${DISABLED_CLASS}`}
                >
                  Spin
                </button>
                {premium === false && spinsUsed !== null && (
                  <span className="text-link tabular-nums text-stone-500">
                    {spinsLeft} spin{spinsLeft === 1 ? "" : "s"} left
                  </span>
                )}
              </>
            )}
          </div>

          {/* Premium, as Practice draws it (E30, D31): the tier's head
              with its one mark, over one plain card of rows, each a bare
              ink glyph, the name, one line and the chevron. No
              terracotta: the room's one tap is the take. Pick a topic
              opens the library on a plan and the paywall without one;
              Hostile Q&A goes to its own screen, which says a free
              account's one a week before the take. */}
          <div className="mt-7 flex items-center justify-between gap-3">
            <h2 className="section-head">Premium</h2>
            <PremiumMark variant="chip" />
          </div>
          <div className="card mt-3 px-4">
            <button
              type="button"
              aria-expanded={paid ? library : undefined}
              aria-haspopup={paid ? undefined : "dialog"}
              onClick={() =>
                paid ? setLibrary((v) => !v) : setPaywall("The boss library")
              }
              className="press-row flex min-h-14 w-full items-center gap-3 py-2 text-left"
            >
              <span aria-hidden className="shrink-0 text-ink">
                <IconGlobe size={24} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-detail font-semibold text-ink">
                  {library ? "Hide the topics" : "Pick a topic"}
                </span>
                <span className="block text-link font-medium text-stone-500">
                  Any of the {COLD_TOPICS.length} topics, any week.
                </span>
              </span>
              <Disclosure className={library ? "rotate-90" : ""} />
            </button>
            <Link
              href="/hostile"
              className="press-row flex min-h-14 items-center gap-3 border-t border-hairline py-2"
            >
              <span aria-hidden className="shrink-0 text-ink">
                <IconBoss size={24} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-detail font-semibold text-ink">
                  Hostile Q&amp;A
                </span>
                <span className="block text-link font-medium text-stone-500">{HOSTILE_LINE}</span>
              </span>
              <Disclosure />
            </Link>
          </div>
          {library && paid && (
            <div className="reveal mt-3">
              <label className="sr-only" htmlFor="boss-search">
                Search topics
              </label>
              <input
                id="boss-search"
                type="search"
                name="topic"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${COLD_TOPICS.length} topics…`}
                className={INPUT_CLASS}
              />
              {/* Chips, so pills: the neutral chip for the pool, and the
                  picked one lifted onto raised paper. Sentence case at
                  caption, because a topic title is a sentence. Each
                  reaches 44px through an invisible extension, so the
                  wrap stays a chip register and not a wall of buttons
                  (modes-28). */}
              <div className="mt-3 flex flex-wrap gap-2">
                {results.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTopic(t);
                      setLibrary(false);
                      setQuery("");
                    }}
                    className={`press relative rounded-full px-3.5 py-2 text-caption font-semibold before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] ${
                      t.id === topic?.id
                        ? "elev-1 border border-card-edge bg-raised text-ink"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {t.title}
                  </button>
                ))}
                {results.length === 0 && (
                  <p className="text-caption text-stone-500">
                    Nothing with that name. Spin instead?
                  </p>
                )}
              </div>
            </div>
          )}

          {/* The take, docked at the foot as on every one-thing screen
              (DESIGN 7, #355's offer): one y in thumb reach whatever the
              library opens above it. A free account's spent week opens
              its stored take: the reading would run for a take it may
              not record. */}
          <FooterShelf hairline={false}>
            {locked && takeId ? (
              <Link href={`/rep/${takeId}`} className={ACTION_CLASS}>
                See your take
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => (locked ? takeTheFloor() : startReading())}
                disabled={reel.rolling || !topic}
                className={`${ACTION_CLASS} ${DISABLED_CLASS}`}
              >
                Start reading
              </button>
            )}
          </FooterShelf>
        </>
      )}

      {phase === "research" && topic && (
        <>
          {/* The reading opens on the lobby's own stage (the games plan,
              item 16): the topic is its title, the clock its number, and
              the clock Demos stands on its floor while it runs. The stage
              takes the free height, so 90 seconds over four bullets
              leaves no band of bare ground over the way out (DESIGN 7). */}
          <HeroStage
            data-look="boss-stage"
            className="mt-4 flex-1"
            artGrow={184}
            eyebrow="Cold Topic"
            line={
              <div className="arrive mt-auto pt-3">
                <div
                  role="timer"
                  aria-label={`${left} seconds of reading left`}
                  className="font-display text-num-hero leading-none tabular-nums"
                >
                  {mins}:{secs}
                </div>
                <p className="stage-ink font-display mt-1.5 text-link font-bold">
                  Reading time left
                </p>
              </div>
            }
            art={<DemosArt pose="clock" size={184} fit grounded halo={{ tone: "sky", kind: "stage" }} />}
          >
            <h1 className="arrive font-display mt-1.5 text-title font-extrabold text-balance">
              {topic.title}
            </h1>
          </HeroStage>
          {/* The sheet arrives into the room the lobby's rows left; the
              stage stays where it stood. */}
          <div className="card arrive mt-5 p-4">
            <p className="eyebrow">What a correct answer covers</p>
            <ul className="mt-3 list-disc space-y-2.5 pl-5 text-read text-stone-800 marker:text-stone-400">
              {topic.truth.map((t, i) => (
                <li key={i} className="text-pretty">
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-hairline pt-3 text-caption text-stone-500">
              Read more: {topic.reading}
            </p>
          </div>
          <button
            type="button"
            onClick={takeTheFloor}
            className="press font-display mt-5 min-h-12 w-full rounded-tap border border-edge bg-surface text-row"
          >
            I&apos;m ready early
          </button>
        </>
      )}

      {paywall && (
        <Paywall reason={paywall} onClose={() => setPaywall(null)} />
      )}
    </main>
  );
}

/**
 * The last six weeks (the games plan, item 16): one slot a week, this
 * week last. A slot holds the week's first boss Index at num-s; a missed
 * week stays an empty outlined slot, never a zero; a week whose take was
 * too short to score holds a dash. This week's slot is ringed in ink,
 * never terracotta: the screen's one tap is the take. Each Monday's date
 * sits under its slot. Until the read lands the slots shimmer at their
 * landed size; a failed read shows dashes, unknown rather than missed.
 */
function BossRecord({
  weeks,
  read,
}: {
  weeks: BossWeek[] | null;
  read: "no" | "yes" | "failed";
}) {
  const slots = weeks ?? Array.from({ length: BOSS_WEEKS }, () => null);
  return (
    <section aria-labelledby="boss-record" className="mt-5">
      <h2 id="boss-record" className="eyebrow">
        Last six weeks
      </h2>
      <ol className="mt-2 grid grid-cols-6 gap-2 [@media(max-width:359px)]:gap-1" aria-busy={read === "no" || undefined}>
        {slots.map((w, i) => {
          const known = read === "yes" && w !== null;
          const said = !w
            ? ""
            : read !== "yes"
              ? `Week of ${w.label}`
              : `Week of ${w.label}${w.current ? ", this week" : ""}: ${
                  w.index !== null
                    ? w.index
                    : w.taken
                      ? "taken, not scored"
                      : w.current
                        ? "not taken yet"
                        : "missed"
                }`;
          const filled = known && w.taken;
          return (
            <li key={w ? w.label : i} className="flex min-w-0 flex-col items-center">
              <span className="sr-only">{said.replace(/ /g, " ")}</span>
              {read === "no" ? (
                <Skeleton className="h-11 w-full" />
              ) : (
                <span
                  aria-hidden
                  className={`flex h-11 w-full items-center justify-center rounded-control ${
                    filled || read === "failed" ? "bg-surface" : ""
                  } ${
                    w?.current
                      ? "border-2 border-ink"
                      : filled || read === "failed"
                        ? ""
                        : "border border-edge"
                  } ${known ? "arrive" : ""}`}
                >
                  {known && w.index !== null ? (
                    <span className="font-display text-num-s tabular-nums text-ink">{w.index}</span>
                  ) : filled || read === "failed" ? (
                    <span className="font-display text-num-s text-stone-400">–</span>
                  ) : null}
                </span>
              )}
              <span
                aria-hidden
                className={`mt-1.5 text-caption tabular-nums ${
                  w?.current ? "font-semibold text-ink" : "text-stone-500"
                }`}
              >
                {w ? w.label : " "}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
