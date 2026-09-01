"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ModPicker } from "@/components/ModPicker";
import { Paywall } from "@/components/Paywall";
import { fetchProfile, fetchReps } from "@/lib/client-data";
import { COLD_TOPICS, weeklyTopic, type ColdTopic } from "@/lib/cold-topics";
import { weekStart } from "@/lib/level";
import { buzz, prefersReducedMotion } from "@/lib/prefs";
import { repHref } from "@/lib/rep-config";

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
 * unlimited free study time before a drill whose whole point is the
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
    <main className="flex min-h-dvh flex-col px-5 pb-24 pt-7">
      <Link href="/" className="self-start text-sm text-stone-500">
        ← back
      </Link>

      {phase === "lobby" && (
        <>
          <div className="label-data mt-6">Weekly boss · Cold Topic</div>
          <h1 className="font-display mt-1.5 text-[27px] leading-tight">
            Explain what you haven&apos;t studied.
          </h1>
          <p className="mt-2.5 text-[14px] leading-relaxed text-stone-500">
            Four minutes to read. Ninety seconds from memory. Two scores:
            the engine reads your delivery, a fact-check reads your claims.
          </p>

          {bossCount > 0 && (
            <p className="mt-2 text-[13px] font-semibold text-stone-500">
              {bossCount} taken
              {bossBest !== null && (
                <>
                  {" "}
                  · best <span className="text-sage-700">{bossBest}</span>
                </>
              )}
            </p>
          )}

          {locked && (
            <div className="mt-4 rounded-[24px] border border-hairline bg-surface p-4 text-[13px] leading-relaxed text-stone-500">
              You&apos;ve taken this week&apos;s boss. It resets Monday, or
              premium opens the library now.
            </div>
          )}

          {/* The wheel. Topic title only — the study sheet waits for the
              clock (#182). */}
          <div className="mt-5 rounded-[26px] border border-hairline bg-surface p-6">
            <div className="flex items-baseline justify-between">
              <div className="label-data">
                {topic.id === weeklyTopic().id
                  ? "This week's headliner"
                  : "The wheel says"}
              </div>
              {!premium && (
                <div className="label-data !text-sage-700">
                  {spinsLeft} spin{spinsLeft === 1 ? "" : "s"} left
                </div>
              )}
            </div>
            <div
              className={`font-display mt-3 min-h-[4.2rem] text-[26px] leading-[1.12] transition-opacity ${
                rolling ? "opacity-40" : "opacity-100"
              }`}
            >
              {topic.title}
            </div>
            <div className="mt-4 flex gap-2.5">
              <button
                onClick={spinWheel}
                disabled={rolling}
                className="press shrink-0 rounded-full border border-stone-200 bg-surface px-5 py-4 text-[15px] font-semibold disabled:opacity-60"
              >
                Spin
              </button>
              <button
                onClick={() => setPhase("research")}
                disabled={rolling}
                className="press flex-1 rounded-full bg-terracotta-500 px-6 py-4 text-center text-[16.5px] font-semibold text-stage transition-colors hover:bg-terracotta-600 disabled:opacity-60"
              >
                Start the 4 minutes
              </button>
            </div>
          </div>

          <button
            onClick={() =>
              premium ? setLibrary((v) => !v) : setPaywall("The boss library")
            }
            className="mt-3 self-start text-[13px] font-semibold text-terracotta-600"
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
                className="w-full rounded-full border border-stone-200 bg-surface px-5 py-3 text-[15px] placeholder:text-stone-300 focus:border-stone-300"
              />
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {results.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTopic(t);
                      setLibrary(false);
                      setQuery("");
                    }}
                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                      t.id === topic.id
                        ? "bg-ink text-ground"
                        : "bg-sand text-stone-600"
                    }`}
                  >
                    {t.title}
                  </button>
                ))}
                {results.length === 0 && (
                  <p className="text-[13px] text-stone-500">
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
            className="press mt-5 flex items-center justify-between rounded-[24px] border border-hairline bg-surface p-4"
          >
            <div>
              <div className="text-[14.5px] font-semibold">
                Hostile Q&amp;A
              </div>
              <div className="mt-0.5 text-[12.5px] text-stone-500">
                Demos interrogates your take. Two questions, no notes.
              </div>
            </div>
            <span aria-hidden className="text-stone-400">
              →
            </span>
          </Link>
        </>
      )}

      {phase === "research" && (
        <>
          <div className="label-data mt-6">Cold Topic</div>
          <h1 className="font-display mt-1.5 text-2xl">{topic.title}</h1>
          <div className="mt-6 flex flex-col items-center">
            <div className="font-display text-[54px] leading-none">
              {mins}:{secs}
            </div>
            <div className="label-data mt-1">reading time left</div>
          </div>
          <div className="mt-5 rounded-[24px] border border-hairline bg-surface p-5">
            <div className="label-data">What a correct answer covers</div>
            <ul className="mt-2 space-y-2 text-[14px] leading-relaxed text-stone-700">
              {topic.truth.map((t, i) => (
                <li key={i}>· {t}</li>
              ))}
            </ul>
            <div className="mt-3 border-t border-sand pt-3 text-[12.5px] text-stone-500">
              Read more: {topic.reading}
            </div>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setPhase("ready")}
            className="w-full rounded-full border border-stone-200 bg-surface px-6 py-4 text-base font-semibold"
          >
            I&apos;m ready early
          </button>
        </>
      )}

      {phase === "ready" && (
        <>
          <div className="label-data mt-6">Cold Topic</div>
          <h1 className="font-display mt-1.5 text-2xl">{topic.title}</h1>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Image
              src="/demos-workout.webp"
              alt=""
              width={140}
              height={140}
              className="demos w-[140px]"
            />
            <p className="mt-4 max-w-[280px] text-[15px] leading-relaxed text-stone-500">
              Notes are gone. Ninety seconds, from memory. Wrong claims
              stated as fact cost more than saying you&apos;re unsure.
            </p>
            {mods.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {mods.map((id) => (
                  <span
                    key={id}
                    className="rounded-full bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-ground"
                  >
                    {id}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={takeTheFloor}
            className="w-full rounded-full bg-terracotta-500 px-6 py-4 text-base font-semibold text-stage press"
          >
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
