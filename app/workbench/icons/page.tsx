import type { ReactNode } from "react";
import { FlatIcon } from "@/components/icons/flat/FlatIcon";
import { FlatLessonIcon } from "@/components/icons/flat/FlatLessonIcon";
import {
  LESSON_FAMILIES,
  LESSON_OBJECT_KIND,
  STAT_FLAT_KINDS,
  type LessonFlatKind,
  type StatFlatKind,
} from "@/components/icons/flat/geometry";
import { Disclosure } from "@/components/ui/Disclosure";
import { HeaderCount } from "@/components/ui/HeaderCount";
import { LESSONS } from "@/content/lessons";
import { TRAIT } from "@/content/traits";

/**
 * The flat icon board (camera only; nothing ships from it). Timothy, 20
 * Nov: "lets just copy duolingos newer styles". Their method, never their
 * art, drawn again from Ethos's own objects (components/icons/flat/). He
 * picked variant A: its own bright palette, the same in both themes, and
 * this board shows that set alone.
 *
 * The six stat icons at 20, 24, 44 and 120, then unlit at the small sizes;
 * the fifteen lessons' objects by trait at the same sizes; each object on
 * its family's colour (Today's card and the lesson stage); and the stats
 * where the app puts them: You's numbers, Today's chips, the freeze's line
 * and Today's two game rows. The camera (scripts/look-icons-flat.mjs)
 * shoots it light and dark.
 *
 * A server component: the lessons' drawings render here and never reach
 * the browser bundle.
 */

const SMALL = [20, 24, 44];
const LARGE = 120;

/** Each object's lesson title, for the caption under it at 120. */
const TITLE: Partial<Record<LessonFlatKind, string>> = Object.fromEntries(
  LESSONS.map((l) => [LESSON_OBJECT_KIND[l.id], l.title]),
);

function SizeRow({ size, children }: { size: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="font-display w-9 shrink-0 text-caption font-semibold text-stone-500">{size}</span>
      <span className="flex flex-1 items-center justify-between">{children}</span>
    </div>
  );
}

/** 120 stands on its own line: three icons at 120 fill the row's whole width. */
function LargeLabel() {
  return <span className="font-display block pb-1 pt-2 text-caption font-semibold text-stone-500">{LARGE}</span>;
}

function Heading({ children, line }: { children: ReactNode; line?: string }) {
  return (
    <>
      <h2 className="font-display mt-8 text-title font-extrabold">{children}</h2>
      {line && <p className="mt-1 text-caption text-stone-500">{line}</p>}
    </>
  );
}

function Stats() {
  return (
    <section aria-label="Stat icons">
      <Heading line="Streak, XP, best, freeze, and Today's two games.">Stats</Heading>
      <div className="mt-2">
        {SMALL.map((s) => (
          <SizeRow key={s} size={s}>
            {STAT_FLAT_KINDS.map((k) => (
              <FlatIcon key={k} kind={k} size={s} />
            ))}
          </SizeRow>
        ))}
        <LargeLabel />
        <div className="grid grid-cols-3 justify-items-center gap-y-3">
          {STAT_FLAT_KINDS.map((k) => (
            <FlatIcon key={k} kind={k} size={LARGE} />
          ))}
        </div>
      </div>
      <h3 className="eyebrow mt-4">Unlit</h3>
      <div className="mt-1">
        {SMALL.map((s) => (
          <SizeRow key={s} size={s}>
            {STAT_FLAT_KINDS.map((k) => (
              <FlatIcon key={k} kind={k} size={s} lit={false} />
            ))}
          </SizeRow>
        ))}
      </div>
    </section>
  );
}

function Family({ trait, kinds }: { trait: (typeof LESSON_FAMILIES)[number]["trait"]; kinds: readonly LessonFlatKind[] }) {
  return (
    <div data-family-board={trait} className="mt-5">
      <h3 className="eyebrow">{TRAIT[trait].name}</h3>
      <div className="mt-1">
        {SMALL.map((s) => (
          <div key={s} className="flex items-center gap-3 py-2">
            <span className="font-display w-9 shrink-0 text-caption font-semibold text-stone-500">{s}</span>
            <span className="grid flex-1 grid-cols-3 justify-items-center">
              {kinds.map((k) => (
                <FlatLessonIcon key={k} kind={k} size={s} />
              ))}
            </span>
          </div>
        ))}
        <LargeLabel />
        <div className="grid grid-cols-3 justify-items-center">
          {kinds.map((k) => (
            <span key={k} className="flex w-full flex-col items-center">
              <FlatLessonIcon kind={k} size={LARGE} />
              <span className="font-display mt-1 text-center text-caption font-semibold text-stone-500">{TITLE[k]}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Lessons() {
  return (
    <section aria-label="Lesson objects">
      <Heading line="Fifteen objects, three to a trait, in their family's tones.">Lessons</Heading>
      {LESSON_FAMILIES.map((f) => (
        <Family key={f.trait} trait={f.trait} kinds={f.kinds} />
      ))}
    </section>
  );
}

/** Each family's objects on Today's card (the family's own colour) and on the lesson stage (its wash, its dark stage). */
function OnFamily() {
  return (
    <section aria-label="On the family's colour">
      <Heading line="Today's card, then the lesson stage.">On its family&apos;s colour</Heading>
      <div className="mt-3 flex flex-col gap-3">
        {LESSON_FAMILIES.map(({ trait, kinds }) => (
          <div key={trait} className="grid grid-cols-2 gap-3">
            <div className="family-fill flex items-center justify-around px-2 py-3" data-family={trait} data-object="none" style={{ borderRadius: 20 }}>
              {kinds.map((k) => (
                <FlatLessonIcon key={k} kind={k} size={52} />
              ))}
            </div>
            <div data-trait={trait} className="flex items-center justify-around rounded-[20px] bg-[var(--tone-stage)] px-2 py-3">
              {kinds.map((k) => (
                <FlatLessonIcon key={k} kind={k} size={52} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** You's three numbers, as app/you/page.tsx `Stat` draws them. */
function YouStat({ label, value, kind, lit = true, tone }: { label: string; value: number; kind: StatFlatKind; lit?: boolean; tone: string }) {
  return (
    <div className="min-w-0 text-center">
      <div className="font-display flex items-center justify-center gap-1.5 text-num-m tabular-nums">
        <span aria-hidden className={`flex shrink-0 ${tone}`}>
          <FlatIcon kind={kind} size={22} lit={lit} />
        </span>
        <span>{value}</span>
      </div>
      <div className="font-display mt-1 whitespace-nowrap text-caption font-semibold text-stone-500">{label}</div>
    </div>
  );
}

/** Today's two games, as components/home/ModeRows.tsx draws them, with the flat mark. */
function ModeRow({ kind, name, subject, line }: { kind: "hostile" | "boss"; name: string; subject: string; line: ReactNode }) {
  return (
    <div data-mode={kind} data-flat="" className={`home-mode ${kind === "hostile" ? "tone-coral" : "tone-sky"}`}>
      <span aria-hidden className="home-mode-art">
        <FlatIcon kind={kind} size={72} />
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

function InTheApp() {
  return (
    <section id="context" data-context aria-label="In the app" className="pb-4">
      <Heading>In the app</Heading>
      <h3 className="eyebrow mt-4">You</h3>
      <div className="card mt-2 p-4">
        <div className="grid grid-cols-3">
          <YouStat label="Streak" value={12} kind="streak" tone="streak-lit" />
          <YouStat label="Best streak" value={30} kind="best" tone="streak-lit" />
          <YouStat label="XP today" value={40} kind="xp" tone="xp-ink" />
        </div>
      </div>
      <div className="card mt-2 p-4">
        <div className="grid grid-cols-3">
          <YouStat label="Streak" value={0} kind="streak" lit={false} tone="" />
          <YouStat label="Best streak" value={0} kind="best" lit={false} tone="" />
          <YouStat label="XP today" value={0} kind="xp" tone="xp-ink" />
        </div>
      </div>

      <h3 className="eyebrow mt-6">Today</h3>
      <div className="mt-2 flex items-center gap-2">
        <HeaderCount
          variant="chip"
          unlit
          label="Streak 12, today's open"
          glyph={
            <span className="flex">
              <FlatIcon kind="streak" size={20} lit={false} />
            </span>
          }
          value={12}
        />
        <HeaderCount
          variant="chip"
          label="Streak 13"
          glyph={
            <span className="flex">
              <FlatIcon kind="streak" size={20} />
            </span>
          }
          value={13}
        />
      </div>
      <p className="home-freeze mt-4 text-body">
        <span className="home-freeze-mark flex">
          <FlatIcon kind="freeze" size={24} />
        </span>
        <span>
          <span className="font-semibold">A freeze covered a day you missed.</span>{" "}
          <span className="text-stone-500">The streak held.</span>
        </span>
      </p>
      <div className="home-modes">
        <ModeRow
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
        <ModeRow kind="boss" name="Weekly boss" subject="How a bill becomes law" line="Read it, explain it" />
      </div>
    </section>
  );
}

export default function IconsBoard() {
  return (
    <main className="min-h-dvh bg-ground px-5 pb-10 pt-6 text-ink">
      <h1 className="font-display text-title font-extrabold">Flat icons</h1>
      <p className="mt-1 text-caption text-stone-500">Flat base, one shade, a small light, in a bright palette of its own.</p>
      <Stats />
      <Lessons />
      <OnFamily />
      <InTheApp />
    </main>
  );
}
