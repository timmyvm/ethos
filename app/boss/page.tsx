"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DemosArt } from "@/components/DemosArt";
import { IconBoss, IconGlobe } from "@/components/Icon";
import { ModPicker } from "@/components/ModPicker";
import { Paywall } from "@/components/Paywall";
import { PremiumMark } from "@/components/PremiumMark";
import { Reel, useReel } from "@/components/Reel";
import { Disclosure } from "@/components/ui/Disclosure";
import { HeroStage } from "@/components/ui/HeroStage";
import { BackLink } from "@/components/ui/ScreenHeader";
import {
  BOSS_RESEARCH_SECONDS,
  bossAnswerLine,
  bossReadLine,
  bossWeekLine,
  daysLeftInWeek,
} from "@/lib/boss";
import { fetchProfile, fetchReps } from "@/lib/client-data";
import { COLD_TOPICS, weeklyTopic, type ColdTopic } from "@/lib/cold-topics";
import { HOSTILE_LINE } from "@/lib/hostile";
import { weekStart } from "@/lib/level";
import { repHref } from "@/lib/rep-config";
import { modById, STRESS_MODS, xpMultiplier } from "@/lib/stress-mods";
import { ACTION_CLASS, DISABLED_CLASS, INPUT_CLASS } from "@/lib/ui";
import { usePaywallReturn } from "@/lib/use-paywall-return";

/** Free tier: the headliner plus two re-rolls a week (DECISIONS #181). */
const FREE_SPINS = 2;
const SPINS_KEY = "ethos.boss.spins";

type Phase = "lobby" | "research" | "ready";

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
 * studied, a timed research window, then 90 seconds from memory, scored
 * on delivery by the normal engine AND fact-checked against the topic's
 * ground truth.
 *
 * Longer than the daily loop by design, which is why it's weekly and
 * never the default (DECISIONS #13 protects the 5-minute habit).
 *
 * Access (#181, amends #36): everyone starts on the week's headliner;
 * free re-rolls the wheel twice a week and takes what lands, premium
 * spins freely or picks from the library. Free still gets one boss RUN
 * a week; premium runs any topic, any time.
 *
 * The study sheet moved (#182): the truth bullets show only inside the
 * research window. They used to sit on the pre-clock screen, which was
 * unlimited free study time before a boss whose whole point is the
 * cold open.
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
  const [headlinerId, setHeadlinerId] = useState<string | null>(null);
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
  const [takenThisWeek, setTakenThisWeek] = useState(false);
  const [bossCount, setBossCount] = useState(0);
  const [bossBest, setBossBest] = useState<number | null>(null);
  const [mods, setMods] = useState<string[]>([]);
  const [showMods, setShowMods] = useState(false);
  const [library, setLibrary] = useState(false);
  const [query, setQuery] = useState("");
  const [spinsUsed, setSpinsUsed] = useState<number | null>(null);
  /* The stage's week line waits for both reads, as Practice's does. */
  const [weekRead, setWeekRead] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    const w = weeklyTopic();
    setTopic(w);
    setHeadlinerId(w.id);
    const thisWeek = weekStart().toISOString().slice(0, 10);
    setWeek(thisWeek);
    setDaysLeft(daysLeftInWeek(weekStart()));
    setSpinsUsed(readSpins(thisWeek));
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      // Unknown, not free: a failed read never locks a paying account.
      .catch(() => setPremium(null));
    fetchReps()
      .then((reps) => {
        const boss = reps.filter((r) => r.mode === "boss");
        setBossCount(boss.length);
        const scored = boss
          .map((r) => r.ethos_index)
          .filter((n): n is number => n !== null);
        setBossBest(scored.length > 0 ? Math.max(...scored) : null);
        const since = weekStart();
        setTakenThisWeek(
          boss.some((r) => new Date(r.created_at) >= since)
        );
        setWeekRead(true);
      })
      /* A failed read lands on "days left", which is true either way. */
      .catch(() => setWeekRead(true));
  }, []);

  useEffect(() => {
    if (phase !== "research") return;
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          setPhase("ready");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  const mins = Math.floor(left / 60);
  const secs = String(left % 60).padStart(2, "0");

  const paid = premium === true;
  const locked = takenThisWeek && premium === false;
  const spinsLeft = Math.max(0, FREE_SPINS - (spinsUsed ?? 0));
  const chosenMods = STRESS_MODS.filter((m) => mods.includes(m.id));
  const multiplier = xpMultiplier(chosenMods);

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

  function takeTheFloor() {
    if (!topic) return;
    if (locked) {
      setPaywall("You've taken this week's boss");
      return;
    }
    router.push(repHref({ boss: topic.id, mods }));
  }

  return (
    <main
      className={`flex min-h-dvh flex-col px-5 pt-[env(safe-area-inset-top)] ${
        phase === "lobby" ? "pb-12" : "pb-safe"
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
              the page's h1. Nothing on the stage is a tap. */}
          <HeroStage
            className="mt-4"
            eyebrow="This week's boss"
            line={
              <p
                className="practice-week font-display mt-auto pt-3 text-link font-bold"
                data-done={takenThisWeek || undefined}
              >
                {bossWeekLine(weekRead ? takenThisWeek : null, daysLeft)}
              </p>
            }
            art={<DemosArt pose="clock" size={132} grounded halo={{ tone: "sky", kind: "stage" }} />}
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

          {/* The record, in the numbers' own weight: a count and the
              best Index, the second in the earned colour. */}
          {bossCount > 0 && (
            <p className="mt-1 text-caption font-semibold text-stone-500">
              <span className="font-display font-extrabold tabular-nums">
                {bossCount}
              </span>{" "}
              taken
              {bossBest !== null && (
                <>
                  , best{" "}
                  <span className="font-display font-extrabold text-sage-700 tabular-nums">
                    {bossBest}
                  </span>
                </>
              )}
            </p>
          )}

          {/* The wheel, then the take. Spin is the secondary pill with
              the allowance beside it: allotted, not earned, so never
              sage, and the tier is named once, by the Premium head
              below. The count waits for the profile, so a paying
              account never sees one. */}
          <div className="mt-4 flex min-h-11 items-center gap-3">
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
          </div>
          <button
            type="button"
            onClick={() => setPhase("research")}
            disabled={reel.rolling || !topic}
            className={`${ACTION_CLASS} ${DISABLED_CLASS} mt-3`}
          >
            Start the 4 minutes
          </button>
          {locked && (
            /* The week's run is spent: said where the take is, plainly.
               The tier is the Premium head's to name. */
            <p className="mt-2 text-caption text-stone-500">
              You&apos;ve taken this week&apos;s boss. It resets Monday.
            </p>
          )}

          {/* Mods, folded (modes-3): optional, never suggested, so one
              row until it is asked for, the grammar Today uses. Its
              trailing value is what the choice is worth. The list's own
              header would say "Stress mods" a second time under this
              row, so the wrapper folds it away. */}
          <button
            type="button"
            aria-expanded={showMods}
            aria-controls="boss-mods"
            onClick={() => setShowMods((v) => !v)}
            className="press-row group-row mt-7 flex min-h-12 w-full items-center gap-3 rounded-card bg-surface px-4 text-left"
          >
            <span className="font-display min-w-0 flex-1 text-row text-ink">
              Stress mods
            </span>
            <span className="font-display text-link tabular-nums text-stone-500">
              {mods.length > 0 ? `×${multiplier} XP` : "Off"}
            </span>
            <Disclosure
              className={`text-stone-400 transition-transform dur-base ease-out ${
                showMods ? "rotate-90" : ""
              }`}
            />
          </button>
          {showMods && (
            <div
              id="boss-mods"
              className="reveal mt-2"
            >
              <ModPicker
                head={false}
                selected={mods}
                onChange={setMods}
                premium={paid}
                onPremiumTap={(m) => setPaywall(`${m.name} · premium mod`)}
              />
            </div>
          )}

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
        </>
      )}

      {phase === "research" && topic && (
        <>
          <p className="eyebrow mt-4">Cold Topic</p>
          <h1 className="font-display mt-1.5 text-title">{topic.title}</h1>
          {/* The clock is the recording loop's clock: the hero number,
              tabular. Its unit is the stat label under it. */}
          <div className="mt-7 flex flex-col items-center">
            <div
              role="timer"
              aria-label={`${mins} minutes ${secs} seconds of reading left`}
              className="font-display text-num-hero tabular-nums"
            >
              {mins}:{secs}
            </div>
            <div className="label-micro mt-2">reading time left</div>
          </div>
          <div className="card mt-7 p-4">
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
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setPhase("ready")}
            className="press font-display mt-7 min-h-12 w-full rounded-tap border border-edge bg-surface text-row"
          >
            I&apos;m ready early
          </button>
        </>
      )}

      {phase === "ready" && topic && (
        <>
          <p className="eyebrow mt-4">Cold Topic</p>
          <h1 className="font-display mt-1.5 text-title">{topic.title}</h1>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Image
              src="/demos-practice.webp"
              alt=""
              width={140}
              height={140}
              className="demos w-[140px]"
            />
            <p className="mt-4 max-w-[280px] text-body text-stone-500">
              Notes are gone. You have 90 seconds, from memory. A wrong
              claim stated as fact costs more than saying you&apos;re
              unsure.
            </p>
            {/* The mods you're carrying, under their names, as the
                sentence-case chips the recording screen and the log
                use. */}
            {mods.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {mods.map((id) => (
                  <span
                    key={id}
                    className="rounded-full bg-surface px-2.5 py-1 text-caption font-semibold text-ink"
                  >
                    {modById(id)?.name ?? id}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={takeTheFloor}
            className={`${ACTION_CLASS} mt-7`}
          >
            Start
          </button>
        </>
      )}

      {paywall && (
        <Paywall reason={paywall} onClose={() => setPaywall(null)} />
      )}
    </main>
  );
}
