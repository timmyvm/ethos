import type { CSSProperties, ReactNode } from "react";
import { FlatIcon } from "@/components/icons/flat/FlatIcon";
import { FLAT_SIX, type FlatKind } from "@/components/icons/flat/geometry";
import { LessonArt } from "@/components/lessons/LessonCard";
import { StatIcon } from "@/components/StatIcon";
import { TraitChip } from "@/components/TraitChip";
import { Disclosure } from "@/components/ui/Disclosure";
import { HeaderCount } from "@/components/ui/HeaderCount";
import { HeroStage, StageChip } from "@/components/ui/HeroStage";
import { SegmentBar } from "@/components/ui/SegmentBar";
import { lessonById, type Lesson } from "@/content/lessons";
import { ART_BOUNDS } from "@/lib/lesson-art-bounds";
import { objectSrc } from "@/lib/home";
import type { StatKind } from "@/lib/stat-icons";

/**
 * The icon board (camera only; nothing ships from it). Timothy, 20 Nov:
 * "lets just copy duolingos newer styles". Their art, never: their method,
 * drawn again from Ethos's own objects (components/icons/flat/).
 *
 * Three columns of the same eight places, so the choice is made by
 * pointing: A, the studied rules in a bright palette of its own; B, the
 * same drawings in Ethos's own tokens; Now, the Higgsfield 3D icons the
 * app draws today. Each column has the six at 20, 32, 48, 96 and 120 on
 * the page's ground (the camera shoots it light and dark), then the same
 * icons where the app puts them: You's three numbers, Today's chips, the
 * freeze's line and its two games' rows, Lessons' Up next stage, and a
 * lesson's own stage at 120.
 *
 * `?only=a|b|now` draws one column, for the camera's side by side
 * (scripts/look-icons-flat.mjs).
 */

type Variant = "a" | "b" | "now";
const VARIANTS: { v: Variant; name: string; line: string }[] = [
  { v: "a", name: "A, studied", line: "Flat base, one shade, a small light, in a bright palette of its own." },
  { v: "b", name: "B, Ethos", line: "The same drawings in the app's tokens: streak orange, XP orchid, gold, sky, trait tones." },
  { v: "now", name: "Now", line: "The Higgsfield 3D icons the app draws today." },
];

/** The six, in the ladder's order. */
const LEGEND = "Streak, XP, best, freeze, and two lessons' objects";

/** What the app draws today for each place. */
const NOW_STAT: Partial<Record<FlatKind, StatKind>> = {
  streak: "streak",
  xp: "xp",
  best: "best",
  freeze: "freeze",
  hostile: "hostile",
  boss: "boss",
};
const NOW_LESSON: Partial<Record<FlatKind, string>> = {
  target: "know-the-landing",
  hourglass: "the-long-one",
};

/**
 * One mark at one size. A lesson's 3D render stands inside a square with
 * its own air (lib/lesson-art-bounds.ts), so here it is cropped to its
 * visible box and drawn at the flat icons' 90%, or every size in the
 * Now column would read a third smaller than it is.
 */
function Mark({ v, kind, size, lit = true }: { v: Variant; kind: FlatKind; size: number; lit?: boolean }) {
  if (v !== "now") return <FlatIcon kind={kind} variant={v} size={size} lit={lit} />;
  const stat = NOW_STAT[kind];
  if (stat) return <StatIcon kind={stat} size={size} lit={lit} />;
  const id = NOW_LESSON[kind]!;
  const b = ART_BOUNDS[id];
  const k = (0.9 * size) / Math.max(b.r - b.l, b.b - b.t);
  const style: CSSProperties = {
    position: "absolute",
    width: k,
    height: k,
    left: size / 2 - k * ((b.l + b.r) / 2),
    top: size / 2 - k * ((b.t + b.b) / 2),
    maxWidth: "none",
  };
  return (
    <span className="relative block shrink-0 overflow-hidden" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the app's own file, as the app draws it (#274) */}
      <img src={objectSrc(id, true)} alt="" style={style} />
    </span>
  );
}

const SMALL = [20, 32, 48];

function Ladder({ v }: { v: Variant }) {
  return (
    <section aria-label="Sizes" className="mt-5">
      {SMALL.map((s) => (
        <div key={s} className="flex items-center gap-3 py-2">
          <span className="font-display w-10 shrink-0 text-caption font-semibold text-stone-500">{s}</span>
          <span className="flex flex-1 items-center justify-between">
            {FLAT_SIX.map((k) => (
              <Mark key={k} v={v} kind={k} size={s} />
            ))}
          </span>
        </div>
      ))}
      {[96, 120].map((s) => (
        <div key={s} className="flex gap-3 py-2">
          <span className="font-display w-10 shrink-0 pt-1 text-caption font-semibold text-stone-500">{s}</span>
          <span className="grid flex-1 grid-cols-3 justify-items-center gap-y-3">
            {FLAT_SIX.map((k) => (
              <Mark key={k} v={v} kind={k} size={s} />
            ))}
          </span>
        </div>
      ))}
    </section>
  );
}

/** You's three numbers, as app/you/page.tsx `Stat` draws them. */
function YouStat({ label, value, mark, tone }: { label: string; value: number; mark: ReactNode; tone: string }) {
  return (
    <div className="min-w-0 text-center">
      <div className="font-display flex items-center justify-center gap-1.5 text-num-m tabular-nums">
        <span aria-hidden className={`flex shrink-0 ${tone}`}>
          {mark}
        </span>
        <span>{value}</span>
      </div>
      <div className="font-display mt-1 whitespace-nowrap text-caption font-semibold text-stone-500">{label}</div>
    </div>
  );
}

/** Today's two games, as components/home/ModeRows.tsx draws them (its mark swapped). */
function ModeRow({ v, kind, name, subject, line }: { v: Variant; kind: "hostile" | "boss"; name: string; subject: string; line: ReactNode }) {
  return (
    <div data-mode={kind} data-flat={v === "now" ? undefined : ""} className={`home-mode ${kind === "hostile" ? "tone-coral" : "tone-sky"}`}>
      <span aria-hidden className="home-mode-art">
        <Mark v={v} kind={kind} size={72} />
      </span>
      <span className="home-mode-words">
        <span className="home-mode-name font-display">{name}</span>
        <span className="home-mode-subject font-display">
          <span>{subject}</span>
        </span>
        <span className="home-mode-line font-display">{line}</span>
      </span>
      <Disclosure />
    </div>
  );
}

/** A lesson's object on a stage, as LessonArt's `stage` draws it: the flat icon stands where the render's object stands. */
function StageArt({ v, lesson, size }: { v: Variant; lesson: Lesson; size: number }) {
  if (v === "now") return <LessonArt lesson={lesson} size={size} eager stage />;
  const kind: FlatKind = lesson.id === "know-the-landing" ? "target" : "hourglass";
  const b = ART_BOUNDS[lesson.id];
  const icon = Math.round(size * Math.max(b.r - b.l, b.b - b.t) * 1.05);
  return (
    <span aria-hidden className="lesson-art tone-sky relative block shrink-0" style={{ width: size, height: size }}>
      <span className="demos-halo" />
      <span
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: size * (1 - b.b) - icon * 0.05, width: icon, height: icon }}
      >
        <FlatIcon kind={kind} variant={v} size={icon} />
      </span>
    </span>
  );
}

function Context({ v }: { v: Variant }) {
  const landing = lessonById("know-the-landing")!;
  const longOne = lessonById("the-long-one")!;
  return (
    <section id={`context-${v}`} data-context={v} aria-label="In the app" className="-mx-5 px-5 pb-4 pt-2">
      <h3 className="eyebrow mt-4">You</h3>
      <div className="card mt-2 p-4">
        <div className="grid grid-cols-3">
          <YouStat label="Streak" value={12} tone="streak-lit" mark={<Mark v={v} kind="streak" size={22} />} />
          <YouStat label="Best streak" value={30} tone="streak-lit" mark={<Mark v={v} kind="best" size={22} />} />
          <YouStat label="XP today" value={40} tone="xp-ink" mark={<Mark v={v} kind="xp" size={22} />} />
        </div>
      </div>

      <h3 className="eyebrow mt-6">Today</h3>
      <div className="mt-2 flex items-center gap-2">
        <HeaderCount
          variant="chip"
          unlit
          label="Streak 12, today's open"
          glyph={<span className="flex">{<Mark v={v} kind="streak" size={20} lit={false} />}</span>}
          value={12}
        />
        <HeaderCount
          variant="chip"
          label="Streak 13"
          glyph={<span className="flex">{<Mark v={v} kind="streak" size={20} />}</span>}
          value={13}
        />
      </div>
      <p className="home-freeze mt-4 text-body">
        <span className="home-freeze-mark flex">
          <Mark v={v} kind="freeze" size={24} />
        </span>
        <span>
          <span className="font-semibold">A freeze covered a day you missed.</span>{" "}
          <span className="text-stone-500">The streak held.</span>
        </span>
      </p>
      <div className="home-modes">
        <ModeRow
          v={v}
          kind="hostile"
          name="Hostile Q&A"
          subject="Social media does more good than harm"
          line={
            <>
              <span className="home-pips">
                <span className="home-pip" data-on />
                <span className="home-pip" data-on />
                <span className="home-pip" />
              </span>
              2 free today
            </>
          }
        />
        <ModeRow v={v} kind="boss" name="Weekly boss" subject="How a bill becomes law" line="Read it, explain it" />
      </div>

      <h3 className="eyebrow mt-6">Lessons, Up next</h3>
      <div className="mt-2">
        <HeroStage
          eyebrow={
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <StageChip trait={landing.trait} />
              <span className="eyebrow stage-ink">Up next</span>
            </span>
          }
          eyebrowWide
          title={landing.title}
          art={<StageArt v={v} lesson={landing} size={132} />}
          line={
            <span className="mt-auto flex items-center gap-2.5 pt-3">
              <span className="w-24 shrink-0">
                <SegmentBar total={3} done={1} tone="stage" />
              </span>
              <span className="stage-ink font-display whitespace-nowrap text-link font-bold tabular-nums">1 of 3</span>
            </span>
          }
        />
      </div>

      <h3 className="eyebrow mt-6">A lesson&apos;s stage</h3>
      <div data-trait={longOne.trait} className="relative mt-2 overflow-hidden rounded-card bg-[var(--tone-stage)] pb-4 pt-5">
        <div className="flex justify-center">
          <LessonStageObject v={v} lesson={longOne} />
        </div>
        <div className="mt-3 flex flex-col items-center">
          <TraitChip trait={longOne.trait} size="md" />
          <p className="font-display mt-2 text-center text-title">{longOne.title}</p>
        </div>
      </div>
    </section>
  );
}

/** The lesson page's object at its smallest, 120 (app/lessons/[id]/page.tsx). */
function LessonStageObject({ v, lesson }: { v: Variant; lesson: Lesson }) {
  if (v === "now")
    return (
      <span className="lesson-art relative block size-[120px] shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- the app's own file (#274) */}
        <img src={objectSrc(lesson.id, true)} alt="" width={560} height={560} className="absolute inset-0 h-full w-full" />
      </span>
    );
  const b = ART_BOUNDS[lesson.id];
  const icon = Math.round(120 * Math.max(b.r - b.l, b.b - b.t) * 1.05);
  return (
    <span className="relative grid size-[120px] shrink-0 place-items-center">
      <FlatIcon kind="hourglass" variant={v} size={icon} />
    </span>
  );
}

function Column({ v, name, line }: { v: Variant; name: string; line: string }) {
  return (
    <div data-column={v} className="px-5 pb-10 pt-8">
      <h2 className="font-display text-title font-extrabold">{name}</h2>
      {/* Two lines held in every column, so the rows line up side by side. */}
      <p className="mt-2 min-h-[2lh] text-caption text-stone-500">{line}</p>
      <p className="font-display mt-2 text-caption font-semibold text-stone-500">{LEGEND}</p>
      <Ladder v={v} />
      <Context v={v} />
    </div>
  );
}

export default async function IconsBoard({ searchParams }: { searchParams: Promise<{ only?: string }> }) {
  const { only } = await searchParams;
  const shown = VARIANTS.filter((x) => !only || x.v === only);
  return (
    <main className="min-h-dvh bg-ground text-ink">
      {shown.map((x) => (
        <Column key={x.v} {...x} />
      ))}
    </main>
  );
}
