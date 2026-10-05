"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DemosArt } from "@/components/DemosArt";
import { IconBoss } from "@/components/Icon";
import { ModPicker } from "@/components/ModPicker";
import { Paywall } from "@/components/Paywall";
import { PremiumMark } from "@/components/PremiumMark";
import { Reel, useReel } from "@/components/Reel";
import { Disclosure } from "@/components/ui/Disclosure";
import { BackLink } from "@/components/ui/ScreenHeader";
import { fetchProfile, fetchReps } from "@/lib/client-data";
import { COLD_TOPICS, weeklyTopic, type ColdTopic } from "@/lib/cold-topics";
import { weekStart } from "@/lib/level";
import { repHref } from "@/lib/rep-config";
import { modById, STRESS_MODS, xpMultiplier } from "@/lib/stress-mods";
import { ACTION_CLASS, DISABLED_CLASS, INPUT_CLASS } from "@/lib/ui";

const RESEARCH_SECONDS = 240; // 4 minutes (mechanics.md: 3–5 min window)

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
  const [left, setLeft] = useState(RESEARCH_SECONDS);
  const [paywall, setPaywall] = useState<string | null>(null);
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

  useEffect(() => {
    const w = weeklyTopic();
    setTopic(w);
    setHeadlinerId(w.id);
    const thisWeek = weekStart().toISOString().slice(0, 10);
    setWeek(thisWeek);
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
      })
      .catch(() => {});
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
          <p className="eyebrow mt-4">Cold Topic</p>
          <h1 className="font-display mt-1.5 text-title">
            Explain what you haven&apos;t studied.
          </h1>
          <p className="mt-2 text-read text-stone-800 text-pretty">
            Read for 4 minutes, then explain it from memory in 90 seconds.
            You get a delivery score and a fact-check.
          </p>

          {/* The record, in the numbers' own weight: a count and the
              best Index, the second in the earned colour. */}
          {bossCount > 0 && (
            <p className="mt-2.5 text-caption font-semibold text-stone-500">
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

          {locked && (
            <div className="card mt-4 flex items-center justify-between gap-3 p-4">
              {/* The word leaves the sentence and the mark carries it,
                  so the fact and the tier are two things (#280). */}
              <p className="text-caption leading-relaxed text-stone-500">
                You&apos;ve taken this week&apos;s boss. It resets Monday.
              </p>
              <PremiumMark variant="chip" />
            </div>
          )}

          {/* The wheel, on the stage Practice's boss card stands on
              (modes-29, M13): the object you tapped carries over. The
              sky stage runs flush along the card's top at the sheet
              radius, the label at Practice's 20px inset, the same clock
              Demos at 132 in the same corner, without his spring: his
              arrival stays Practice's weekly moment (#313). The topic
              and the two buttons sit on the card under the stage.

              This is the screen's one lifted thing (#234/#240): it holds
              the tap. Topic title only, the study sheet waits for the
              clock (#182). */}
          <section
            aria-label="This week's boss"
            className="card elev-2 mt-6 overflow-hidden rounded-sheet p-0"
          >
            <div
              data-flush
              className="intro-stage tone-sky practice-stage relative h-[160px] p-5"
            >
              <div className="relative z-[2] flex h-full max-w-[60%] flex-col">
                <p
                  className={`eyebrow practice-stage-ink ${
                    headlinerId ? "" : "invisible"
                  }`}
                >
                  {shown.id === headlinerId
                    ? "This week's headliner"
                    : "The wheel says"}
                </p>
                {/* The allowance, where Practice prints the week's
                    state: a label on the picture in the stage's ink.
                    Allotted, not earned, so never sage, and the tier is
                    named once, by the mark beside "Pick a topic" (#280).
                    It waits for the profile, so a paying account never
                    sees a count. */}
                {premium === false && spinsUsed !== null && (
                  <p className="practice-week font-display mt-auto text-link font-bold tabular-nums">
                    {spinsLeft} spin{spinsLeft === 1 ? "" : "s"} left
                  </p>
                )}
              </div>
              <div className="absolute bottom-[2px] right-1 z-[1] h-[132px] w-[132px]">
                <DemosArt
                  pose="clock"
                  size={132}
                  grounded
                  halo={{ tone: "sky", kind: "stage" }}
                />
              </div>
            </div>
            <div className="px-5 pb-5 pt-4">
              <Reel
                state={reel}
                current={shown}
                className={`font-display text-title font-extrabold [--reel-cell:3.75rem] ${
                  topic ? "" : "invisible"
                }`}
                render={(t) => (
                  <span className="flex h-full items-center text-balance">
                    {t.title}
                  </span>
                )}
              />
              <div className="mt-3 flex gap-2.5">
                <button
                  type="button"
                  onClick={spinWheel}
                  disabled={reel.rolling || !topic}
                  className={`press font-display min-h-12 shrink-0 rounded-control border border-edge bg-surface px-5 text-row ${DISABLED_CLASS}`}
                >
                  Spin
                </button>
                <button
                  type="button"
                  onClick={() => setPhase("research")}
                  disabled={reel.rolling || !topic}
                  className={`${ACTION_CLASS} ${DISABLED_CLASS} flex-1`}
                >
                  Start the 4 minutes
                </button>
              </div>
            </div>
          </section>

          {/* A text link in both states, never the tap colour and never
              plum as a colour (modes-8): the mark names the tier. */}
          <button
            type="button"
            aria-expanded={paid ? library : undefined}
            aria-haspopup={paid ? undefined : "dialog"}
            onClick={() =>
              paid ? setLibrary((v) => !v) : setPaywall("The boss library")
            }
            className="text-link press mt-2 inline-flex min-h-11 items-center gap-2 self-start"
          >
            {library ? "Hide the library" : "Pick a topic instead"}
            {premium === false && <PremiumMark variant="chip" />}
          </button>

          {library && paid && (
            <div className="reveal mt-2">
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

          {/* The second boss (#183), as Practice draws it: the hot seat's
              tile, the name, the mark where the tap leads to Premium,
              and the row's chevron. No blurb (#317), and no terracotta:
              the room's one tap stays on the wheel. */}
          <Link
            href="/hostile"
            className="press card mt-3 flex min-h-12 items-center gap-3 px-4 py-3"
          >
            <span aria-hidden className="game-tile game-tile-seat">
              <IconBoss size={22} />
            </span>
            <span className="font-display min-w-0 flex-1 text-row text-ink">
              Hostile Q&amp;A
            </span>
            {premium === false && <PremiumMark variant="chip" />}
            <Disclosure />
          </Link>
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
            className="press font-display mt-7 min-h-12 w-full rounded-control border border-edge bg-surface text-row"
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
