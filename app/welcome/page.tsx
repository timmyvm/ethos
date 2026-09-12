"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LessonScreen } from "@/components/LessonScreen";
import {
  markWelcomed,
  PLAN_COPY,
  QUESTIONS,
  WELCOME_STEPS,
} from "@/lib/onboarding";
import { introDue, introHref, nextLesson, UNITS } from "@/lib/path";
import {
  AGE_BANDS,
  GOALS,
  planFor,
  readProfile,
  writeProfile,
  type AgeBand,
  type Goal,
} from "@/lib/profile";
import { repHref } from "@/lib/rep-config";

/**
 * Where "Take the floor" lands. Bare /rep serves the daily ROTATION —
 * whatever drill today's date rotates to — but a first recording has to
 * be the path's first lesson, "The baseline" (DECISIONS #135): the
 * introduction just promised a baseline, so the button delivers one.
 * An empty star map resolves to the first lesson of the first unit.
 */
// The same door the floor opens for the same state: a unit nobody has
// scored in yet owes its teaching screen first (#210); only the skippers
// used to see it.
const FIRST_UNIT = UNITS[0];
const FIRST_REP = introDue(FIRST_UNIT, {})
  ? introHref(FIRST_UNIT.id)
  : repHref({ lesson: nextLesson({})?.lesson.id });

/**
 * The walk (DECISIONS #133, #231): three screens that say the thing,
 * two questions answered by tap, and the plan built from the answers.
 * Six screens, one tap each, Skip on every one, no account, no quiz
 * wall (#11): the mic is never more than a tap away.
 */
type Step =
  | { kind: "intro"; index: number }
  | { kind: "goal" }
  | { kind: "age" }
  | { kind: "plan" };

const STEPS: Step[] = [
  ...WELCOME_STEPS.map((_, index): Step => ({ kind: "intro", index })),
  { kind: "goal" },
  { kind: "age" },
  { kind: "plan" },
];

/** Demos while he asks, and while he tells you the plan (#233's set). */
const ASKING_ART = "/demos-onboard-listening.webp";
const PLAN_ART = "/demos-onboard-speaking.webp";

/**
 * Onboarding — no quiz-wall, no account. Wellspoken's quiz-wall is a
 * documented resentment point (DECISIONS #11), so the intro copy is
 * WELCOME_STEPS (lib/onboarding), docs/voice.md verbatim, and the two
 * questions after it are the person's own diagnosis, not ours.
 */
export default function Welcome() {
  return (
    <Suspense fallback={<main className="px-5 pt-7" />}>
      <Walk />
    </Suspense>
  );
}

function Walk() {
  const params = useSearchParams();
  // `?step=goal` opens the questions directly: the Focus row on /you
  // comes here to change an answer, and leaves back to /you.
  const asked = params.get("step");
  const editing = asked !== null;
  const [i, setI] = useState(() =>
    Math.max(
      0,
      STEPS.findIndex((s) => s.kind === asked)
    )
  );
  const [goal, setGoal] = useState<Goal | null>(null);
  const [age, setAge] = useState<AgeBand | null>(null);

  // Seen once is seen — set on mount so neither finishing nor skipping
  // is needed to stop the floor routing back here (DECISIONS #133).
  // The answers come from the device, after paint, so a returning
  // visit opens on what was said.
  useEffect(() => {
    markWelcomed();
    const p = readProfile();
    setGoal(p.goal);
    setAge(p.ageBand);
  }, []);

  const step = STEPS[i];
  const advance = () => setI((n) => Math.min(n + 1, STEPS.length - 1));

  const dots = (
    <div className="flex gap-1.5">
      {STEPS.map((_, n) => (
        <span
          key={n}
          className={`h-1.5 ${
            n === i ? "w-6 bg-terracotta-500" : "w-1.5 bg-stone-300"
          }`}
        />
      ))}
    </div>
  );

  const art = (src: string) => (
    <Image
      src={src}
      alt=""
      width={180}
      height={180}
      priority
      className="demos demos-idle mx-auto mb-6 w-[180px]"
    />
  );

  if (step.kind === "intro") {
    const s = WELCOME_STEPS[step.index];
    return (
      <LessonScreen
        center
        stepKey={i}
        title={s.title}
        line={s.line}
        action={{ label: "Next", onPress: advance }}
        art={art(s.art)}
        aside={dots}
        footer={
          /*
           * Screen 1 carries the returning-user door (Duolingo's splash
           * pattern, DECISIONS #133): a new device belonging to an
           * existing account should sign in BEFORE recording anonymously,
           * because recordings made first would strand on this device.
           * Later screens keep Skip, which skips the questions too.
           */
          step.index === 0 ? (
            <Link
              href="/signin"
              className="mt-3 block text-center text-caption text-stone-500"
            >
              I already have an account
            </Link>
          ) : (
            <Link
              href="/"
              className="mt-3 block text-center text-caption text-stone-500"
            >
              Skip
            </Link>
          )
        }
      />
    );
  }

  if (step.kind === "goal" || step.kind === "age") {
    const copy = QUESTIONS[step.kind];
    const picked = step.kind === "goal" ? goal : age;
    return (
      <LessonScreen
        center
        stepKey={i}
        title={copy.title}
        line={copy.line}
        art={art(ASKING_ART)}
        aside={
          <div className="space-y-5">
            {dots}
            {step.kind === "goal" ? (
              <Options
                label={copy.title}
                options={GOALS}
                value={goal}
                onPick={(g) => {
                  setGoal(g);
                  writeProfile({ goal: g });
                }}
              />
            ) : (
              <Options
                label={copy.title}
                options={AGE_BANDS}
                value={age}
                onPick={(a) => {
                  setAge(a);
                  writeProfile({ ageBand: a });
                }}
              />
            )}
          </div>
        }
        /* One button, and what it says is the truth about the tap:
           nothing picked, it skips; something picked, it continues. */
        action={{ label: picked ? "Next" : "Skip", onPress: advance }}
      />
    );
  }

  return (
    <LessonScreen
      stepKey={i}
      title={PLAN_COPY.title}
      line={PLAN_COPY.line}
      howTo={planFor(goal)}
      howToLabel={PLAN_COPY.label}
      lead="howTo"
      art={art(PLAN_ART)}
      action={
        editing
          ? { label: "Done", href: "/you" }
          : { label: "Take the floor", href: FIRST_REP }
      }
      fineprint={editing ? undefined : "Every number on it is measured, none awarded."}
    />
  );
}

/**
 * One tappable answer per row: a radio set in the segmented control's
 * grammar (#206, ModeToggle): the chosen row fills with ink, the rest
 * stand on `surface` with the `stone-200` outline (#218). Tapping picks;
 * the screen's one button moves on.
 */
function Options<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T | null;
  onPick: (id: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="space-y-2">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(o.id)}
            className={`press font-display flex min-h-12 w-full items-center rounded-[10px] border px-4 text-left text-[14.5px] font-bold transition-colors ${
              on
                ? "border-ink bg-ink text-ground"
                : "border-stone-200 bg-surface hover:bg-sand"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
