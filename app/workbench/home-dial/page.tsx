"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeaderCount } from "@/components/ui/HeaderCount";
import { Disclosure } from "@/components/ui/Disclosure";
import { StreakBadge } from "@/components/StreakBadge";
import { Ring } from "@/components/Ring";
import { ModPicker } from "@/components/ModPicker";
import { TipLine } from "@/components/rep/TipStrip";
import {
  IconCheck,
  IconPractice,
  IconLessons,
  IconLog,
  IconShuffle,
  IconSliders,
  IconStar,
  IconToday,
  IconYou,
} from "@/components/Icon";
import { TRAIT, type TraitId } from "@/content/traits";
import { TOPICS } from "@/lib/topics";
import { ordinal } from "@/lib/trait-readings";
import { Dial } from "./Dial";
import "./home-dial.css";

/**
 * Direction A, "the dial" (the workbench, DECISIONS #255).
 *
 * Timothy, 29 Oct: "i see the other apps. They have beautiful home
 * pages. we have a card with a panda." The references are in
 * docs/refs/home/; this direction takes the fintech card, the AC dial
 * and the kcal arc: a personal opening, ONE signature number set huge in
 * a terracotta tick dial, the day's practice on a card lit from its foot
 * with its lesson's glass object standing out of the corner, the traits
 * as a bento of big numbers, and the recordings as a list.
 *
 * Everything Today must do is here: start today's practice (the topic,
 * the tactic, spin and difficulty), today's line (folded into the
 * weakest trait's tile, because the line is in that trait's unit), the
 * clean run, the five traits, the streak and the stars. Demos is not on
 * it: he appears at moments.
 *
 * The numbers are fixed and fictional, and shared with the other
 * directions: Timothy, Ethos 662 of 1000, +51 since day one, 22
 * recordings, 35 stars, a six-day streak, a 46s clean run (best 53).
 *
 *   /workbench/home-dial                    the direction
 *   /workbench/home-dial?start=terracotta   Start as the terracotta pill
 */

const NAME = "Timothy";

const READINGS: { id: TraitId; raw: string; percentile: number }[] = [
  { id: "pause", raw: "1.8", percentile: 18 },
  { id: "range", raw: "62", percentile: 68 },
  { id: "pace", raw: "155", percentile: 72 },
  { id: "fillers", raw: "0.7", percentile: 93 },
  { id: "repairs", raw: "0.8", percentile: 93 },
];

/** The last three recordings, newest first, with the lesson whose glass object stands for each. */
const RECENT = [
  { topic: "t2", art: "the-landing", when: "Yesterday, 7:42 pm", index: 662, delta: 6 },
  { topic: "t9", art: "closed-mouth", when: "Tuesday, 8:15 pm", index: 656, delta: 9 },
  { topic: "t16", art: "one-gear-down", when: "Monday, 7:03 am", index: 647, delta: -4 },
];

/** The last fourteen days, oldest first: true is a day spoken. */
const DAYS = [true, true, true, false, true, true, true, false, true, true, true, true, true, true];

const TACTIC = "One to two seconds reads as command. Past three and a half it costs you.";

function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  return "Evening";
}

export default function HomeDial() {
  /* The greeting and the date are the device's, read after mount; their
     slot holds its height until then and they land with one fade. */
  const [now, setNow] = useState<{ greet: string; date: string } | null>(null);
  const [topicId, setTopicId] = useState("t5");
  const [mods, setMods] = useState<string[]>([]);
  const [showMods, setShowMods] = useState(false);
  const [variant, setVariant] = useState<"white" | "terracotta">("white");
  /* The strip's replay: remounts everything that arrives. */
  const [take, setTake] = useState(0);

  useEffect(() => {
    const d = new Date();
    setNow({
      greet: greetingFor(d.getHours()),
      date: d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
    });
    if (/[?&]start=terracotta\b/.test(window.location.search)) setVariant("terracotta");
    (window as unknown as { __replay?: () => void }).__replay = () => setTake((t) => t + 1);
  }, []);

  const topic = TOPICS.find((t) => t.id === topicId) ?? TOPICS[0];

  return (
    <main key={take} className="hd-page px-5 pb-[var(--nav-clear)] pt-[max(20px,env(safe-area-inset-top))]">
      {/* The opening: who, then the two earned counts. */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/you" aria-label="You" className="press hd-coin">
          {NAME[0]}
        </Link>
        <span className="flex items-center gap-2">
          <HeaderCount variant="chip" glyph={<IconStar />} value={35} label="35 stars" />
          <StreakBadge
            streak={{ current: 6, longest: 9, atRisk: false, didToday: false, frozenInRun: 0 }}
          />
        </span>
      </div>

      <div className="mt-4">
        <h1 className={`large-title hd-greet ${now ? "arrive" : "invisible"}`}>
          {now?.greet ?? "Morning"}, {NAME}
        </h1>
        <p className={`large-title-subtitle ${now ? "arrive" : "invisible"}`}>{now?.date ?? "Today"}</p>
      </div>

      {/* The signature: the Index, huge, in its dial. */}
      <section aria-label="Ethos Index" className="mt-4">
        <Link href="/history" className="block rounded-sheet">
          <Dial value={662} max={1000} delta={51} />
        </Link>
      </section>

      {/* Today's practice: the one lifted thing, lit from its foot. */}
      <section aria-label="Today's practice" className="mt-12">
        <div className="hd-play elev-2 p-5">
          <img src="/lessons/the-long-one.webp" alt="" className="hd-art" />
          <div aria-hidden className="hd-art-room" />
          <div className="flex min-h-[22px] flex-wrap items-center gap-x-2 gap-y-1">
            <span data-trait="pause" className="stage-chip font-display text-caption font-bold leading-none">
              <span aria-hidden className="trait-dot" />
              {TRAIT.pause.name}
            </span>
            <span className="eyebrow stage-ink">Today&apos;s practice</span>
          </div>
          <h2 className="hd-topic mt-3 text-balance">{topic.prompt}</h2>
          <div className="clear-both" />
          <TipLine tip={TACTIC} compact className="mt-2" />
          <div className="mt-5 flex items-center gap-2">
            <Link href={`/rep?topic=${topic.id}`} data-variant={variant} className="press hd-start min-w-0 flex-1">
              Start
              <span aria-hidden className="hd-start-arrow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </Link>
            <button
              type="button"
              aria-label="Spin a new topic"
              onClick={() => {
                const pool = TOPICS.filter((t) => t.id !== topicId);
                setTopicId(pool[Math.floor(Math.random() * pool.length)].id);
              }}
              className="press hd-glyph"
            >
              <IconShuffle size={20} />
            </button>
            <button
              type="button"
              aria-label={showMods ? "Hide difficulty" : "Turn up the difficulty"}
              aria-expanded={showMods}
              data-on={mods.length > 0 || undefined}
              onClick={() => setShowMods((v) => !v)}
              className="press hd-glyph relative"
            >
              <IconSliders size={20} />
              {mods.length > 0 && (
                <span className="font-display absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-suffix font-extrabold leading-none text-on-accent tabular-nums">
                  {mods.length}
                </span>
              )}
            </button>
          </div>
        </div>
        {showMods && (
          <div className="reveal mt-3">
            <ModPicker selected={mods} onChange={setMods} premium onPremiumTap={() => {}} />
          </div>
        )}
      </section>

      {/* The numbers, as a bento: the clean run across the top, the
          weakest trait tall with today's line in it, the rest square. */}
      <section className="arrive mt-7" aria-labelledby="hd-numbers">
        <h2 id="hd-numbers" className="section-head">
          Your numbers
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <CleanRunTile />
          <WeakestTile reading={READINGS[0]} />
          {READINGS.slice(1).map((r, i) => (
            <TraitTile key={r.id} reading={r} delay={320 + i * 80} />
          ))}
        </div>
      </section>

      {/* The recordings, the fintech's transactions. */}
      <section className="arrive mt-7" aria-labelledby="hd-recent">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="hd-recent" className="section-head">
            Recordings<span className="section-head-count">22</span>
          </h2>
          <Link href="/history" className="text-link">
            See all
          </Link>
        </div>
        <ul className="mt-1">
          {RECENT.map((r, i) => {
            const t = TOPICS.find((x) => x.id === r.topic)!;
            return (
              <li key={r.topic}>
                <Link
                  href="/history"
                  className={`press-row relative -mx-5 flex items-center gap-3.5 px-5 py-3 ${
                    i === 0 ? "" : "before:absolute before:left-[86px] before:right-0 before:top-0 before:h-px before:origin-top before:scale-y-50 before:bg-hairline"
                  }`}
                >
                  <span className="hd-thumb">
                    <img src={`/lessons/${r.art}.webp`} alt="" width={46} height={46} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-display block truncate text-row">{t.prompt}</span>
                    <span className="mt-0.5 block text-caption text-stone-500">{r.when}</span>
                  </span>
                  <span className="text-right">
                    <span className="font-display block text-num-s tabular-nums">{r.index}</span>
                    <span
                      className={`font-display block text-caption font-bold tabular-nums ${
                        r.delta >= 0 ? "text-sage-700" : "text-stone-500"
                      }`}
                    >
                      {r.delta >= 0 ? "+" : "−"}
                      {Math.abs(r.delta)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <TabBar />
    </main>
  );
}

/** The clean run across the bento's top: the number, the stretch on the recording's timeline, the trail. */
function CleanRunTile() {
  const total = 65;
  const from = 14;
  const run = 46;
  return (
    <Link href="/history" className="card press col-span-2 block p-4">
      <span className="flex items-center justify-between">
        <span className="eyebrow">Last recording&apos;s clean run</span>
        <Disclosure />
      </span>
      <span className="mt-2 flex items-center gap-3.5">
        <span className="font-display shrink-0 text-num-l tabular-nums">
          46<span className="ml-0.5 text-num-s text-stone-500">s</span>
        </span>
        <span className="min-w-0">
          <span className="font-display block text-row">Longest stretch without a filler</span>
          <span className="mt-0.5 block text-caption text-stone-500">Best so far: 53s</span>
        </span>
      </span>
      {/* The stretch, where it sat in the recording. */}
      <span aria-hidden className="relative mt-3 block h-2 bg-sand">
        <span
          className="absolute inset-y-0 bg-sage-600"
          style={{ left: `${(from / total) * 100}%`, width: `${(run / total) * 100}%` }}
        />
      </span>
      <span aria-hidden className="mt-1.5 flex justify-between text-caption tabular-nums text-stone-400">
        <span>0:00</span>
        <span>1:05</span>
      </span>
      <span className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-hairline pt-3">
        <span
          role="img"
          aria-label="Last 14 days: 12 spoken"
          className="flex items-end gap-[5px]"
        >
          {DAYS.map((d, i) => (
            <span key={i} className="hd-day" data-spoken={d} data-today={i === DAYS.length - 1 || undefined} />
          ))}
        </span>
        <span className="whitespace-nowrap text-caption text-stone-500">12 of the last 14 days</span>
      </span>
    </Link>
  );
}

/** The kcal arc's blocks: a half circle of segments, lit to the percentile. */
function SegArc({ fraction, children }: { fraction: number; children: React.ReactNode }) {
  const n = 11;
  const gap = 4; // degrees
  const span = (180 - gap * (n - 1)) / n;
  const cx = 70;
  const cy = 70;
  const ro = 68;
  const ri = 55;
  const lit = Math.round(fraction * n);
  const pt = (deg: number, r: number) => {
    const a = ((deg - 180) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  };
  return (
    <span className="relative mx-auto block w-full max-w-[140px]" style={{ aspectRatio: "140 / 104" }}>
      <svg viewBox="0 0 140 104" className="absolute inset-0 h-full w-full" aria-hidden focusable="false">
        {Array.from({ length: n }, (_, i) => {
          const a0 = i * (span + gap);
          const a1 = a0 + span;
          const d = `M ${pt(a0, ro)} A ${ro} ${ro} 0 0 1 ${pt(a1, ro)} L ${pt(a1, ri)} A ${ri} ${ri} 0 0 0 ${pt(a0, ri)} Z`;
          return (
            <path
              key={i}
              d={d}
              className={i < lit ? "hd-seg hd-seg-on" : "hd-seg"}
              style={i < lit ? ({ "--i": i } as React.CSSProperties) : undefined}
              strokeLinejoin="round"
            />
          );
        })}
      </svg>
      <span className="absolute inset-x-0 bottom-0 flex justify-center">{children}</span>
    </span>
  );
}

/** The weakest trait, tall: its gauge, its number, and today's line, which is drawn in its unit. */
function WeakestTile({ reading }: { reading: (typeof READINGS)[number] }) {
  const t = TRAIT[reading.id];
  return (
    <Link href={`/practice/${reading.id}`} data-trait={reading.id} className="card press today-trait row-span-2 flex flex-col p-4">
      <span className="flex items-center justify-between gap-2">
        <span className="font-display flex items-center gap-1.5 text-row">
          <span aria-hidden className="trait-dot" />
          {t.name}
        </span>
        <span className="font-display text-caption font-bold tabular-nums tone-ink">
          {ordinal(reading.percentile)}
        </span>
      </span>
      <span className="flex flex-1 flex-col justify-center py-3">
        <SegArc fraction={reading.percentile / 100}>
          <span className="hd-gauge-num font-display font-extrabold tabular-nums">{reading.raw}</span>
        </SegArc>
        <span className="mt-2 block text-center text-caption text-balance text-stone-500">{t.unit}</span>
      </span>
      {/* Today's line, in this trait's unit: cleared, so its check is earned. */}
      <span className="block border-t border-hairline pt-3">
        <span className="eyebrow block">Today&apos;s line</span>
        <span className="mt-1.5 flex items-center gap-2.5">
          <span className="hd-check">
            <IconCheck size={16} />
          </span>
          <span className="min-w-0">
            <span className="font-display block text-row">Over 1</span>
            <span className="block text-caption leading-tight text-stone-500">6 of your last 6</span>
          </span>
        </span>
        <span className="sr-only">Cleared today.</span>
      </span>
    </Link>
  );
}

/** A trait as a square tile: name and percentile ring, the number big, the unit small. */
function TraitTile({ reading, delay }: { reading: (typeof READINGS)[number]; delay: number }) {
  const t = TRAIT[reading.id];
  const ord = ordinal(reading.percentile);
  const unit = reading.raw === "1" ? t.unitOne : t.unit;
  return (
    <Link href={`/practice/${reading.id}`} data-trait={reading.id} className="card press today-trait flex flex-col p-4">
      <span className="flex items-start justify-between gap-2">
        <span className="font-display flex items-center gap-1.5 pt-1 text-row">
          <span aria-hidden className="trait-dot" />
          {t.name}
        </span>
        <Ring value={reading.percentile / 100} size={40} thickness={3} tone="trait" track="var(--color-sand)" delay={delay}>
          <span className="font-display flex items-baseline text-caption font-extrabold leading-none tabular-nums">
            {reading.percentile}
            <span className="text-suffix">{ord.slice(String(reading.percentile).length)}</span>
          </span>
        </Ring>
      </span>
      <span className="font-display mt-3 text-num-l tabular-nums">{reading.raw}</span>
      <span className="mt-1 text-caption leading-snug text-balance text-stone-500">{unit}</span>
    </Link>
  );
}

/*
 * The tab bar. Nav hides itself on /workbench (its BARE list) and is a
 * shared component this page may not edit, so this is its markup with
 * its own classes and marks, Today lit, standing where it stands.
 */
const TABS = [
  { href: "/", label: "Today", Icon: IconToday },
  { href: "/lessons", label: "Lessons", Icon: IconLessons },
  { href: "/games", label: "Practice", Icon: IconPractice },
  { href: "/history", label: "Log", Icon: IconLog },
  { href: "/you", label: "You", Icon: IconYou },
];

function TabBar() {
  return (
    <nav
      aria-label="Sections"
      className="nav-dock fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 px-5"
    >
      <div className="nav-glass relative flex h-[var(--nav-h)] items-stretch">
        <span aria-hidden className="nav-well" style={{ transform: "translateX(0%)" }} />
        {TABS.map((t, i) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={i === 0 ? "page" : undefined}
            className={`nav-tab relative z-[1] flex min-w-0 flex-1 flex-col items-center justify-center rounded-full ${
              i === 0 ? "text-ink" : "text-stone-500"
            }`}
          >
            <t.Icon size={22} active={i === 0} />
            <span className="nav-label">{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
