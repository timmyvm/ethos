"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ModPicker } from "@/components/ModPicker";
import { Paywall } from "@/components/Paywall";
import { fetchProfile, fetchReps } from "@/lib/client-data";
import { COLD_TOPICS, weeklyTopic, type ColdTopic } from "@/lib/cold-topics";
import { weekStart } from "@/lib/level";
import { repHref } from "@/lib/rep-config";

const RESEARCH_SECONDS = 240; // 4 minutes (mechanics.md: 3–5 min window)

type Phase = "brief" | "research" | "ready";

/**
 * Cold Topic — the weekly boss. A topic you haven't studied, a timed
 * research window, then 90 seconds from memory, scored on delivery by
 * the normal engine AND fact-checked against the topic's ground truth.
 *
 * Longer than the daily loop by design, which is why it's weekly and
 * never the default (DECISIONS #13 protects the 5-minute habit).
 *
 * Free gets this week's boss, once. Premium unlocks the library —
 * any topic, any time (DECISIONS #36).
 */
export default function BossPage() {
  const router = useRouter();
  const [topic, setTopic] = useState<ColdTopic>(() => weeklyTopic());
  const [phase, setPhase] = useState<Phase>("brief");
  const [left, setLeft] = useState(RESEARCH_SECONDS);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [premium, setPremium] = useState(false);
  const [takenThisWeek, setTakenThisWeek] = useState(false);
  const [mods, setMods] = useState<string[]>([]);
  const [library, setLibrary] = useState(false);

  useEffect(() => {
    fetchProfile()
      .then((p) => setPremium(p?.premium ?? false))
      .catch(() => {});
    fetchReps()
      .then((reps) => {
        const since = weekStart();
        setTakenThisWeek(
          reps.some(
            (r) => r.mode === "boss" && new Date(r.created_at) >= since
          )
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

  const locked = takenThisWeek && !premium;

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

      <div className="label-data mt-6">Weekly boss · Cold Topic</div>
      <h1 className="font-display mt-1.5 text-2xl font-bold">{topic.title}</h1>

      {phase === "brief" && (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-stone-500">
            Four minutes to read. Then the notes disappear and you explain
            it for 90 seconds from memory — scored on delivery and on
            whether the claims are actually true.
          </p>

          {locked && (
            <div className="mt-4 rounded-[18px] border border-black/5 bg-white lift p-4 text-[13px] leading-relaxed text-stone-500">
              You&apos;ve already taken this week&apos;s boss. It resets
              Monday — or premium opens the whole library now.
            </div>
          )}

          <div className="mt-5 rounded-[18px] border border-black/5 bg-white lift p-5">
            <div className="label-data">What a correct answer covers</div>
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-relaxed text-stone-600">
              {topic.truth.map((t, i) => (
                <li key={i}>· {t}</li>
              ))}
            </ul>
            <div className="mt-3 border-t border-sand pt-3 text-[12.5px] text-stone-500">
              Read more: {topic.reading}
            </div>
          </div>

          <button
            onClick={() =>
              premium ? setLibrary((v) => !v) : setPaywall("The boss library")
            }
            className="mt-3 self-start text-[13px] font-semibold text-terracotta-600"
          >
            {library ? "Hide the library" : "Pick a different topic"}
          </button>

          {library && premium && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COLD_TOPICS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTopic(t);
                    setLibrary(false);
                  }}
                  className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                    t.id === topic.id
                      ? "bg-stone-900 text-cream"
                      : "bg-sand text-stone-600"
                  }`}
                >
                  {t.title}
                </button>
              ))}
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

          <div className="flex-1" />
          <button
            onClick={() => setPhase("research")}
            className="mt-5 w-full rounded-[14px] bg-terracotta-500 px-6 py-4 text-base font-semibold text-cream press"
          >
            Start the 4 minutes
          </button>
        </>
      )}

      {phase === "research" && (
        <>
          <div className="mt-6 flex flex-col items-center">
            <div className="font-display text-[54px] font-bold leading-none">
              {mins}:{secs}
            </div>
            <div className="label-data mt-1">reading time left</div>
          </div>
          <div className="mt-5 rounded-[18px] border border-black/5 bg-white lift p-5">
            <ul className="space-y-2 text-[14px] leading-relaxed text-stone-700">
              {topic.truth.map((t, i) => (
                <li key={i}>· {t}</li>
              ))}
            </ul>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setPhase("ready")}
            className="w-full rounded-[14px] border border-black/10 bg-white px-6 py-4 text-base font-semibold"
          >
            I&apos;m ready early
          </button>
        </>
      )}

      {phase === "ready" && (
        <>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Image
              src="/demos-workout.webp"
              alt=""
              width={140}
              height={140}
              className="w-[140px]"
            />
            <p className="mt-4 max-w-[280px] text-[15px] leading-relaxed text-stone-500">
              Notes are gone. Ninety seconds, from memory. Wrong claims
              stated confidently cost more than saying you&apos;re unsure.
            </p>
            {mods.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {mods.map((id) => (
                  <span
                    key={id}
                    className="rounded-full bg-stone-900 px-2.5 py-1 text-[11.5px] font-semibold text-cream"
                  >
                    {id}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={takeTheFloor}
            className="w-full rounded-[14px] bg-terracotta-500 px-6 py-4 text-base font-semibold text-cream press"
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
