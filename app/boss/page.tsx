"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ACTION_CLASS } from "@/components/LessonScreen";
import { DISABLED_CLASS } from "@/lib/ui";
import { ModPicker } from "@/components/ModPicker";
import { Paywall } from "@/components/Paywall";
import { fetchProfile, fetchReps } from "@/lib/client-data";
import { COLD_TOPICS, weeklyTopic, type ColdTopic } from "@/lib/cold-topics";
import { weekStart } from "@/lib/level";
import { buzz, prefersReducedMotion } from "@/lib/prefs";
import { repHref } from "@/lib/rep-config";
import { modById } from "@/lib/stress-mods";

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
 * Cold Topic — the weekly boss. A topic you haven't studied, a timed
 * research window, then 90 seconds from memory, scored on delivery by
 * the normal engine AND fact-checked against the topic's ground truth.
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
 */
export default function BossPage() {
  const router = useRouter();
  const [topic, setTopic] = useState<ColdTopic>(() => weeklyTopic());
  const [phase, setPhase] = useState<Phase>("lobby");
  const [left, setLeft] = useState(RESEARCH_SECONDS);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [premium, setPremium] = useState(false);
  const [takenThisWeek, setTakenThisWeek] = useState(false);
  const [bossCount, setBossCount] = useState(0);
  const [bossBest, setBossBest] = useState<number | null>(null);
  const [mods, setMods] = useState<string[]>([]);
  const [library, setLibrary] = useState(false);
  const [query, setQuery] = useState("");
  const [rolling, setRolling] = useState(false);
  const week = weekStart().toISOString().slice(0, 10);
  const [spinsUsed, setSpinsUsed] = useState(0);

  useEffect(() => {
    setSpinsUsed(readSpins(week));
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => {});
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
  }, [week]);

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

  const locked = takenThisWeek && !premium;
  const spinsLeft = Math.max(0, FREE_SPINS - spinsUsed);

  function randomTopic(excludeId: string): ColdTopic {
    const pool = COLD_TOPICS.filter((t) => t.id !== excludeId);
    return pool[Math.floor(Math.random() * pool.length)] ?? COLD_TOPICS[0];
  }

  function spinWheel() {
    if (rolling) return;
    if (!premium && spinsLeft <= 0) {
      setPaywall("More spins · premium picks any topic");
      return;
    }
    buzz(20);
    if (!premium) {
      const used = spinsUsed + 1;
      setSpinsUsed(used);
      writeSpins(week, used);
    }
    if (prefersReducedMotion()) {
      setTopic((t) => randomTopic(t.id));
      return;
    }
    setRolling(true);
    // A few flickers so it reads as a draw, not a swap (the roulette's
    // exact rhythm) — short enough that it never becomes a wait.
    let n = 0;
    const t = setInterval(() => {
      setTopic((prev) => randomTopic(prev.id));
      if (++n >= 6) {
        clearInterval(t);
        setRolling(false);
        buzz([10, 30, 10]);
      }
    }, 70);
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COLD_TOPICS;
    return COLD_TOPICS.filter((t) => t.title.toLowerCase().includes(q));
  }, [query]);

  function takeTheFloor() {
    if (locked) {
      setPaywall("You've taken this week's boss");
      return;
    }
    router.push(repHref({ boss: topic.id, mods }));
  }

  return (
    <main className="pb-safe flex min-h-dvh flex-col px-5 pt-7">
      <Link
        href="/"
        className="press inline-flex min-h-11 items-center self-start text-[13px] font-semibold text-stone-500"
      >
        ← back
      </Link>

      {phase === "lobby" && (
        <>
          <div className="label-data mt-4">Weekly boss · Cold Topic</div>
          <h1 className="font-display mt-1.5 text-title">
            Explain what you haven&apos;t studied.
          </h1>
          <p className="mt-2 text-body text-stone-500">
            Four minutes to read. Ninety seconds from memory. Two scores:
            the engine reads your delivery, a fact-check reads your claims.
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
                  {" "}
                  · best{" "}
                  <span className="font-display font-extrabold text-sage-700 tabular-nums">
                    {bossBest}
                  </span>
                </>
              )}
            </p>
          )}

          {locked && (
            <div className="elev-1 mt-4 rounded-card border border-card-edge bg-raised p-4 text-caption leading-relaxed text-stone-500">
              You&apos;ve taken this week&apos;s boss. It resets Monday, or
              premium opens the library now.
            </div>
          )}

          {/* The wheel. Topic title only — the study sheet waits for the
              clock (#182).

              This is the screen's one lifted thing (#234/#240): it holds
              the tap, so it takes the floor card's grammar — raised
              paper at the sheet radius, a card-edge hairline, `elev-2`.
              It used to be `surface` under a hairline, which put the
              headliner a step BELOW the mods card underneath it. */}
          <div className="elev-2 mt-5 rounded-sheet border border-card-edge bg-raised p-5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="label-data">
                {topic.id === weeklyTopic().id
                  ? "This week's headliner"
                  : "The wheel says"}
              </div>
              {!premium && (
                <div className="label-micro shrink-0 !text-sage-700">
                  {spinsLeft} spin{spinsLeft === 1 ? "" : "s"} left
                </div>
              )}
            </div>
            <div
              className={`font-display mt-3 min-h-[3.75rem] text-title transition-opacity ${
                rolling ? "opacity-40" : "opacity-100"
              }`}
            >
              {/* Keyed on the topic so every draw mounts fresh and rolls
                  in from below, the way the roulette draws. */}
              <span key={topic.id} className="arrive dur-fast block">
                {topic.title}
              </span>
            </div>
            <div className="mt-4 flex gap-2.5">
              <button
                onClick={spinWheel}
                disabled={rolling}
                className="press font-display min-h-12 shrink-0 rounded-control border border-edge bg-surface px-5 text-[14px] font-bold disabled:opacity-40"
              >
                Spin
              </button>
              <button
                onClick={() => setPhase("research")}
                disabled={rolling}
                className={`${ACTION_CLASS} ${DISABLED_CLASS} flex-1`}
              >
                Start the 4 minutes
              </button>
            </div>
          </div>

          <button
            onClick={() =>
              premium ? setLibrary((v) => !v) : setPaywall("The boss library")
            }
            className="press mt-1 inline-flex min-h-11 items-center self-start text-[13px] font-semibold text-terracotta-700"
          >
            {library ? "Hide the library" : "Pick a topic instead"}
          </button>

          {library && premium && (
            <div className="mt-2">
              <label className="sr-only" htmlFor="boss-search">
                Search topics
              </label>
              <input
                id="boss-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${COLD_TOPICS.length} topics`}
                className="w-full rounded-control border border-edge bg-surface px-4 py-2.5 text-[14px] font-semibold transition-colors placeholder:text-stone-400 focus:border-terracotta-500"
              />
              {/* Chips, so pills: the neutral chip for the pool, and the
                  picked one lifted onto raised paper rather than wearing
                  the retired ink block. Sentence case at caption stays —
                  `.label-micro` is 10px uppercase, and a topic title is
                  a sentence, not a column head. */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {results.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTopic(t);
                      setLibrary(false);
                      setQuery("");
                    }}
                    className={`press rounded-full px-3 py-1.5 text-caption font-semibold ${
                      t.id === topic.id
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

          <div className="mt-4">
            <ModPicker
              selected={mods}
              onChange={setMods}
              premium={premium}
              onPremiumTap={(m) => setPaywall(`${m.name} · premium mod`)}
            />
          </div>

          {/* The second boss (#183). A door in the shop's row grammar:
              no terracotta, the room's one tap stays on the wheel. */}
          <Link
            href="/hostile"
            className="press elev-1 mt-3 flex items-center gap-3 rounded-card border border-card-edge bg-raised p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="font-display text-[14px] font-bold">
                Hostile Q&amp;A
              </div>
              <div className="mt-0.5 text-caption leading-relaxed text-stone-500">
                Demos interrogates your take. Two questions, no notes.
              </div>
            </div>
            <span aria-hidden className="shrink-0 text-stone-400">
              →
            </span>
          </Link>
        </>
      )}

      {phase === "research" && (
        <>
          <div className="label-data mt-4">Cold Topic</div>
          <h1 className="font-display mt-1.5 text-title">{topic.title}</h1>
          {/* The clock is the recording loop's clock, to the pixel:
              54/800, tabular, tracked in. Its unit drops to the micro
              register so the screen keeps one section eyebrow. */}
          <div className="mt-7 flex flex-col items-center">
            <div className="font-display text-[54px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">
              {mins}:{secs}
            </div>
            <div className="label-micro mt-2">reading time left</div>
          </div>
          <div className="elev-2 mt-7 rounded-card border border-card-edge bg-raised p-4">
            <div className="label-data">What a correct answer covers</div>
            <ul className="mt-3 space-y-2.5 text-body text-stone-700">
              {topic.truth.map((t, i) => (
                <li key={i} className="flex gap-2.5">
                  <span aria-hidden className="shrink-0 text-stone-300">
                    ·
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-hairline pt-3 text-caption text-stone-500">
              Read more: {topic.reading}
            </div>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setPhase("ready")}
            className="press font-display mt-7 min-h-12 w-full rounded-control border border-edge bg-surface text-[14px] font-bold"
          >
            I&apos;m ready early
          </button>
        </>
      )}

      {phase === "ready" && (
        <>
          <div className="label-data mt-4">Cold Topic</div>
          <h1 className="font-display mt-1.5 text-title">{topic.title}</h1>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Image
              src="/demos-workout.webp"
              alt=""
              width={140}
              height={140}
              className="demos w-[140px]"
            />
            <p className="mt-4 max-w-[280px] text-body text-stone-500">
              Notes are gone. Ninety seconds, from memory. Wrong claims
              stated as fact cost more than saying you&apos;re unsure.
            </p>
            {/* The mods you're carrying, in the chip register the log
                and the recording screen already use — and under their
                names, which is what the same chip says everywhere else. */}
            {mods.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {mods.map((id) => (
                  <span
                    key={id}
                    className="label-micro rounded-full bg-stone-100 px-2.5 py-1 !text-ink"
                  >
                    {modById(id)?.name ?? id}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button onClick={takeTheFloor} className={`${ACTION_CLASS} mt-7`}>
            Take the floor
          </button>
        </>
      )}

      {paywall && (
        <Paywall reason={paywall} onClose={() => setPaywall(null)} />
      )}
    </main>
  );
}
