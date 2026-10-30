"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CountUp } from "@/components/CountUp";
import {
  IconPractice,
  IconLessons,
  IconLog,
  IconShuffle,
  IconSliders,
  IconStar,
  IconToday,
  IconYou,
  IconCheck,
} from "@/components/Icon";
import { ModPicker } from "@/components/ModPicker";
import { StreakBadge } from "@/components/StreakBadge";
import { TipLine } from "@/components/rep/TipStrip";
import { HeaderCount } from "@/components/ui/HeaderCount";
import { Segmented } from "@/components/ui/Segmented";
import { StageChip } from "@/components/ui/HeroStage";
import { Skeleton } from "@/components/ui/Skeleton";
import { TRAIT, type TraitId } from "@/content/traits";
import { DURATION } from "@/lib/motion";
import { repHref } from "@/lib/rep-config";
import { TOPICS } from "@/lib/topics";
import { ordinal } from "@/lib/trait-readings";
import hourglass from "./art/the-long-one.webp";
import "./home-b.css";

/**
 * Direction B, "the object" (the home round, 29 Oct; the workbench
 * pattern, DECISIONS #255).
 *
 * Timothy: "i see the other apps. They have beautiful home pages. we
 * have a card with a panda." This is Today rebuilt on ToyCad's and the
 * travel app's grammar: a personal opening, one tall colour card for
 * today's practice with its lesson's glass object breaking out of the
 * corner, a Today / This week switch, and a bento of tiles where every
 * trait carries its own object and its number at a size you read from
 * across a room. Demos is not on it: he comes back for moments.
 *
 * The numbers are fixed and fictional (Timothy's account as the brief
 * gives it), and the history read is simulated so the arrival can be
 * photographed: the opening and the hero paint at once, the chips and
 * the bento land with `.arrive` after the read. `?hold` keeps the read
 * open until `window.__land()` is called, for the frame strip.
 */

/* ---------------------------------------------------------------- */
/* Fixture. */

const NAME = "Timothy";
const STARS = 35;
const STREAK = { current: 6, longest: 9, atRisk: false, didToday: true, frozenInRun: 0 };
const INDEX = { now: 662, since: 51 };
const RECORDINGS = 22;
/** Recordings a week, oldest first; the last is this week. Sums to 22. */
const WEEKS = [2, 3, 4, 3, 4, 6];
const CLEAN = { s: 46, of: 65, best: 53 };
const LINE = { trait: "pause" as TraitId, today: 1.8, line: 1, over: 6, of: 6 };
/** Today's practice: the lesson's object, the trait, the topic, the tactic. */
const TODAY = {
  trait: "pause" as TraitId,
  topic: "t5",
  tip: "One to two seconds reads as command. Past three and a half it costs you.",
};

/** The five, weakest first. Each tile wears its trait's first lesson. */
const TRAITS: {
  id: TraitId;
  raw: string;
  unit: string;
  pct: number;
  art: string;
}[] = [
  { id: "pause", raw: "1.8", unit: "/min", pct: 18, art: "the-landing" },
  { id: "range", raw: "62", unit: "/100", pct: 68, art: "name-it-once" },
  { id: "pace", raw: "155", unit: "wpm", pct: 72, art: "room-to-land" },
  { id: "fillers", raw: "0.7", unit: "/100 words", pct: 93, art: "the-cold-open" },
  { id: "repairs", raw: "0.8", unit: "/100 words", pct: 93, art: "finish-it" },
];

/** The Index across the 22 recordings, day one to now. */
const HISTORY = [
  611, 614, 609, 618, 622, 619, 626, 631, 628, 634, 638, 636, 641, 645, 643, 649,
  652, 650, 655, 658, 657, 662,
];
/** This week, Monday first; today is Thursday. */
const WEEK: { d: string; on: boolean; today?: boolean }[] = [
  { d: "M", on: true },
  { d: "T", on: true },
  { d: "W", on: true },
  { d: "T", on: true, today: true },
  { d: "F", on: false },
  { d: "S", on: false },
  { d: "S", on: false },
];

/** The read, simulated: long enough to see the skeleton, short enough not to wait. */
const READ_MS = 320;

const DATE = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default function HomeB() {
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [view, setView] = useState<"today" | "week">("today");
  const [topicIx, setTopicIx] = useState(() => TOPICS.findIndex((t) => t.id === TODAY.topic));
  const [mods, setMods] = useState<string[]>([]);
  const [showMods, setShowMods] = useState(false);

  useEffect(() => {
    setDate(DATE.format(new Date()));
    const land = () => setReady(true);
    if (new URLSearchParams(location.search).has("hold")) {
      (window as unknown as { __land?: () => void }).__land = land;
      return;
    }
    const t = setTimeout(land, READ_MS);
    return () => clearTimeout(t);
  }, []);

  const topic = TOPICS[topicIx] ?? TOPICS[0];

  return (
    <>
      <main className="hb px-5 pb-[var(--nav-clear)] pt-[calc(env(safe-area-inset-top)+12px)]">
        {/* The opening: who, and what they have earned. */}
        <div className="flex h-11 items-center justify-between">
          <Link href="/you" aria-label="You" className="hb-avatar press">
            {NAME[0]}
          </Link>
          <span className="flex h-9 items-center gap-2">
            {ready && (
              <span className="arrive flex items-center gap-2">
                <HeaderCount
                  variant="chip"
                  glyph={<IconStar />}
                  value={<CountUp value={STARS} durationMs={DURATION.max} />}
                  label={`${STARS} stars`}
                />
                <StreakBadge streak={STREAK} />
              </span>
            )}
          </span>
        </div>
        <p className="large-title-eyebrow mt-4 min-h-6">{date}</p>
        {/* A long name wraps before it reaches the object's column, which
            rises beside it from 360 up. */}
        <h1 className="large-title text-balance min-[360px]:max-w-[60%]">Hi, {NAME}</h1>

        {/* Today's practice. */}
        <section aria-labelledby="hb-topic" className="mt-6">
          <div data-trait={TODAY.trait} className="hb-hero">
            <span aria-hidden className="hb-hero-pool" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hourglass.src}
              alt=""
              width={260}
              height={260}
              className="hb-hero-art"
              draggable={false}
            />
            {/* Beside the object: what today is, the trait, and the one
                tactic, which is what the object pictures (an hourglass
                for "Hold one to two seconds"). */}
            <div className="relative flex max-w-[52%] flex-col items-start gap-2">
              <span className="hb-hero-lead">Today&apos;s practice</span>
              <StageChip trait={TODAY.trait} />
              <TipLine tip={TODAY.tip} compact className="w-full" />
            </div>

            <h2
              id="hb-topic"
              className="hb-display relative mt-auto pt-6"
              data-long={topic.prompt.length > 40 || undefined}
            >
              {topic.prompt}
            </h2>

            <div className="relative mt-5 flex items-center gap-2">
              <Link href={repHref({ topic: topic.id, mods })} className="hb-start press">
                Start
              </Link>
              <button
                type="button"
                aria-label="Spin a new topic"
                onClick={() => setTopicIx((i) => (i + 1) % TOPICS.length)}
                className="hb-glyph press"
              >
                <IconShuffle size={20} />
              </button>
              <button
                type="button"
                aria-label={showMods ? "Hide difficulty" : "Turn up the difficulty"}
                aria-expanded={showMods}
                onClick={() => setShowMods((v) => !v)}
                className="hb-glyph press"
              >
                <IconSliders size={20} />
                {mods.length > 0 && (
                  <span className="hb-glyph-count font-display text-suffix font-extrabold tabular-nums">
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

        {/* The switch, and the section it switches. */}
        <div className="mt-7">
          <Segmented
            label="Show"
            size="lg"
            className="hb-seg"
            value={view}
            onChange={setView}
            options={[
              { value: "today", label: "Today" },
              { value: "week", label: "This week" },
            ]}
          />
        </div>

        <div className="mt-3">
          {!ready ? (
            <BentoSkeleton />
          ) : view === "today" ? (
            <TodayBento key="today" />
          ) : (
            <WeekBento key="week" />
          )}
        </div>
      </main>
      <BenchNav />
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Today: the line and the clean run, then the five. */

function TodayBento() {
  const [first, ...rest] = TRAITS;
  return (
    <div className="flex flex-col gap-3">
      <div className="arrive grid grid-cols-2 gap-3">
        <LineTile />
        <CleanRunTile />
      </div>
      <div className="stagger grid grid-cols-2 gap-3 [--stagger-lead:80ms]">
        <TraitTile t={first} wide />
        {rest.map((t) => (
          <TraitTile key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}

function LineTile() {
  const closed = LINE.today >= LINE.line;
  /* The bar runs to a quarter past the larger of the two, so the line's
     mark and today's fill both sit inside it. */
  const top = Math.max(LINE.today, LINE.line) * 1.25;
  return (
    <section data-trait={LINE.trait} data-compact className="hb-tile">
      <h3 className="eyebrow flex min-h-7 items-start gap-1.5 text-ink">
        <span aria-hidden className="trait-dot mt-[5px]" />
        Today&apos;s line
      </h3>
      {/* The check closes the number's row, so the name keeps one line at
          320 and the check stands beside what it is about. */}
      <p className="font-display mt-auto flex items-center gap-2 text-num-l tabular-nums">
        <span className="flex items-baseline gap-x-1">
          {LINE.today}
          <span className="hb-unit">/min</span>
        </span>
        {closed && (
          <span className="hb-check ml-auto" role="img" aria-label="Cleared today">
            <IconCheck size={16} />
          </span>
        )}
      </p>
      {/* Clearing your line is earned: the fill is sage, as the ring's
          arc is on Today now. */}
      <span aria-hidden data-marked className="hb-bar mt-2.5 block [--ring-arc:var(--color-sage-500)]">
        <i style={{ width: `${(LINE.today / top) * 100}%` }} />
        <span className="hb-bar-mark" style={{ left: `${(LINE.line / top) * 100}%` }} />
      </span>
      <p className="mt-2 text-caption text-stone-500">Over your line of {LINE.line}</p>
    </section>
  );
}

function CleanRunTile() {
  return (
    <Link href="/history" data-compact className="hb-tile press">
      <h3 className="eyebrow flex min-h-7 items-start text-ink">Clean run</h3>
      <p className="font-display mt-auto flex items-baseline gap-x-1 text-num-l tabular-nums">
        <CountUp value={CLEAN.s} durationMs={DURATION.max} />
        <span className="hb-unit">s</span>
      </p>
      {/* The recording's length as the trough, the clean stretch in sage,
          the best so far as a mark. */}
      <span aria-hidden data-marked className="hb-bar mt-2.5 block [--ring-arc:var(--color-sage-500)]">
        <i style={{ width: `${(CLEAN.s / CLEAN.of) * 100}%` }} />
        <span className="hb-bar-mark" style={{ left: `${(CLEAN.best / CLEAN.of) * 100}%` }} />
      </span>
      <p className="mt-2 text-caption text-stone-500">
        Of {CLEAN.of}s. Best {CLEAN.best}s.
      </p>
    </Link>
  );
}

function TraitTile({ t, wide = false }: { t: (typeof TRAITS)[number]; wide?: boolean }) {
  const name = TRAIT[t.id].name;
  return (
    <Link
      href={`/practice/${t.id}`}
      data-trait={t.id}
      data-wide={wide || undefined}
      aria-label={`${name}, ${t.raw} ${t.unit}, ${ordinal(t.pct)} percentile`}
      className={`hb-tile press ${wide ? "col-span-2" : ""}`}
    >
      <span aria-hidden className="hb-tile-glow" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/lessons/${t.art}.webp`}
        alt=""
        width={wide ? 168 : 108}
        height={wide ? 168 : 108}
        className="hb-tile-art"
        draggable={false}
      />
      <span className="font-display flex items-center gap-1.5 text-row">
        <span aria-hidden className="trait-dot" />
        {name}
      </span>
      <span
        className={`font-display mt-auto flex flex-wrap items-baseline gap-x-1 tabular-nums ${
          wide ? "text-num-hero" : "text-num-l"
        }`}
      >
        {t.raw}
        <span className="hb-unit">{t.unit}</span>
      </span>
      <span className={`mt-2.5 flex items-center gap-2.5 ${wide ? "max-w-[52%]" : ""}`}>
        <span className="hb-bar flex-1">
          <i style={{ width: `${t.pct}%` }} />
        </span>
        <span className="font-display shrink-0 text-caption font-bold tabular-nums text-stone-500">
          {ordinal(t.pct)}
        </span>
      </span>
    </Link>
  );
}

/* ---------------------------------------------------------------- */
/* This week: the Index, the days, the recordings. */

function WeekBento() {
  const spoken = WEEK.filter((d) => d.on).length;
  /* The Index at the first recording of the week (the last six). */
  const weekFrom = HISTORY[HISTORY.length - WEEKS[WEEKS.length - 1]];
  const most = Math.max(...WEEKS);
  return (
    <div className="arrive grid grid-cols-2 gap-3">
      <Link href="/history" data-wide className="hb-tile press col-span-2">
        <Hill values={HISTORY} />
        <h3 className="eyebrow text-ink">Ethos Index</h3>
        <p className="font-display mt-3 flex items-baseline gap-x-1 text-num-hero tabular-nums">
          <CountUp value={INDEX.now} durationMs={DURATION.max} />
          <span className="hb-unit">/1000</span>
        </p>
        <p className="font-display mt-1 text-caption font-bold text-sage-700">
          +{INDEX.now - weekFrom} this week, +{INDEX.since} since day one
        </p>
      </Link>
      <section data-compact className="hb-tile">
        <h3 className="eyebrow text-ink">Days spoken</h3>
        <p className="font-display mt-auto flex items-baseline gap-x-1 text-num-l tabular-nums">
          {spoken}
          <span className="hb-unit">of 7</span>
        </p>
        <div aria-hidden className="mt-2.5 grid grid-cols-7 gap-1">
          {WEEK.map((d, i) => (
            <span key={i} className="flex flex-col items-center gap-1">
              <span className="hb-day w-full" data-on={d.on || undefined} />
              <span
                className={`font-display text-suffix ${
                  d.today ? "font-extrabold text-ink" : "text-stone-400"
                }`}
              >
                {d.d}
              </span>
            </span>
          ))}
        </div>
      </section>
      <Link href="/history" data-compact className="hb-tile press">
        <div className="flex items-start justify-between gap-2">
          <h3 className="eyebrow text-ink">Recordings</h3>
          {/* A column a week, this week's in sage. */}
          <span aria-hidden className="flex h-7 items-end gap-[3px]">
            {WEEKS.map((n, i) => (
              <span
                key={i}
                className={`w-1.5 rounded-sm ${i === WEEKS.length - 1 ? "bg-sage-500" : "bg-sand"}`}
                style={{ height: `${(n / most) * 100}%` }}
              />
            ))}
          </span>
        </div>
        <p className="font-display mt-auto flex items-baseline gap-x-1 text-num-l tabular-nums">
          {WEEKS[WEEKS.length - 1]}
          <span className="hb-unit">this week</span>
        </p>
        <p className="mt-2 text-caption text-stone-500">{RECORDINGS} since day one</p>
      </Link>
    </div>
  );
}

/** The Index's history as a filled hill: the sage of anything earned. */
function Hill({ values }: { values: number[] }) {
  const w = 350;
  const h = 84;
  const lo = Math.min(...values) - 8;
  const hi = Math.max(...values) + 4;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - ((v - lo) / (hi - lo)) * (h - 8),
  ]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg aria-hidden viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="hb-hill">
      <defs>
        <linearGradient id="hb-hill-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#hb-hill-fill)" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* The read in flight: every tile at its landed height. */

function BentoSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} data-compact className="hb-tile">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-auto h-8 w-16" />
            <Skeleton className="mt-3 h-1 w-full" />
            <Skeleton className="mt-2.5 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div data-wide className="hb-tile col-span-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-auto h-12 w-28" />
          <Skeleton className="mt-3 h-1 w-1/2" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="hb-tile">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-auto h-8 w-16" />
            <Skeleton className="mt-3 h-1 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* The tab bar. `Nav` hides itself on /workbench (#255), so this is its
   markup with Today lit: the same classes, marks and labels. */

const TABS = [
  { href: "/", label: "Today", Icon: IconToday },
  { href: "/lessons", label: "Lessons", Icon: IconLessons },
  { href: "/games", label: "Practice", Icon: IconPractice },
  { href: "/history", label: "Log", Icon: IconLog },
  { href: "/you", label: "You", Icon: IconYou },
];

function BenchNav() {
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
