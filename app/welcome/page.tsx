"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { DemosArt, type Pose } from "@/components/DemosArt";
import { LessonScreen } from "@/components/LessonScreen";
import {
  AGE_BANDS,
  CONTEXTS,
  GOALS,
  LEVELS,
  NAME_REPLY,
  PAINS,
  TIMES,
} from "@/content/portfolio";
import {
  cleanName,
  EMPTY_ANSWERS,
  MAX_NAME,
  MAX_PAINS,
  readOnboarding,
  writeOnboarding,
  type Answers,
} from "@/lib/answers";
import {
  markWelcomed,
  NAME_FIELD,
  PLAN_COPY,
  QUESTIONS,
  WELCOME_STEPS,
  type QuestionId,
} from "@/lib/onboarding";
import { introDue, introHref, nextLesson, UNITS } from "@/lib/path";
import { buildPortfolio } from "@/lib/portfolio";
import { readPrefs, writePrefs } from "@/lib/prefs";
import { repHref } from "@/lib/rep-config";
import { INPUT_CLASS } from "@/lib/ui";

/**
 * The walk (DECISIONS #133, #232, #249): three screens that say the
 * thing, seven questions, and the plan built from the answers. Eleven
 * screens, a way back on every one, Skip on every question, no account,
 * no quiz wall (#11): the mic is never more than a tap away, and a
 * refresh lands where it left off.
 *
 * What #249 added, and why it is not decoration:
 *
 *  - Demos REACTS. Every answer moves him — a nod on the wrapper, one
 *    shot, 460ms — and where the answer actually changed something he
 *    also says so, in the line's own slot, replacing the question's
 *    description. Where it changed nothing he only nods. The strings
 *    are in content/portfolio.ts, on the options themselves.
 *  - The name is the one typed answer, and it is FIRST, so the six
 *    screens after it can use it.
 *  - The plan leads with his line to them and its three lines land one
 *    at a time rather than arriving as a paragraph.
 */
type Step =
  | { kind: "intro"; index: number }
  | { kind: "question"; id: QuestionId }
  | { kind: "plan" };

const STEPS: Step[] = [
  ...WELCOME_STEPS.map((_, index): Step => ({ kind: "intro", index })),
  ...QUESTIONS.map((q): Step => ({ kind: "question", id: q.id })),
  { kind: "plan" },
];
const LAST = STEPS.length - 1;
const FIRST_QUESTION = STEPS.findIndex((s) => s.kind === "question");

/** Which pose asks which question (#233, #249). */
const INTRO_POSES: Pose[] = ["wave", "speaking", "celebrate"];
const QUESTION_POSES: Record<QuestionId, Pose> = {
  name: "hello",
  ageBand: "fingers",
  goal: "telescope",
  pains: "listening",
  level: "mic",
  context: "headphones",
  time: "clock",
};

/**
 * Where "Take the floor" lands. Bare /rep serves the daily ROTATION;
 * a first recording has to be the path's first lesson, "The baseline"
 * (DECISIONS #135). A unit nobody has scored in yet owes its teaching
 * screen first (#210) unless the introduction turned intros off (#232).
 */
function firstRep(skipIntros: boolean): string {
  const unit = UNITS[0];
  return !skipIntros && introDue(unit, {})
    ? introHref(unit.id)
    : repHref({ lesson: nextLesson({})?.lesson.id });
}

export default function Welcome() {
  return (
    <Suspense fallback={<main className="px-5 pt-7" />}>
      <Walk />
    </Suspense>
  );
}

function Walk() {
  const params = useSearchParams();
  // `?step=<question id | plan>` opens a screen directly: the plan row
  // on /you comes here to change an answer, and leaves back to /you.
  const asked = params.get("step");
  const editing = asked !== null;
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [floor, setFloor] = useState(() => firstRep(false));
  const [ready, setReady] = useState(false);
  /*
   * The name he has actually HEARD, as opposed to the one being typed.
   * His line updates live, because a screen that answers your hand is
   * the whole brief, but the nod waits for the field to be finished:
   * one nod per keystroke is not a reaction, it is a twitch.
   */
  const [heardName, setHeardName] = useState<string | null>(null);

  /*
   * Seen once is seen (#133): set on mount, so neither finishing nor
   * skipping is needed to stop the floor routing back here. Then the
   * device's answers and step, after paint: a refresh resumes, a
   * finished walk opens on its plan, a deep link opens where it asked.
   */
  useEffect(() => {
    markWelcomed();
    const saved = readOnboarding();
    setAnswers(saved.answers);
    setHeardName(saved.answers.name);
    const deep = STEPS.findIndex(
      (s) => (s.kind === "question" && s.id === asked) || (s.kind === "plan" && asked === "plan")
    );
    setI(deep >= 0 ? deep : saved.done ? LAST : Math.min(saved.step, LAST));
    setFloor(firstRep(readPrefs().skipIntros));
    setReady(true);
  }, [asked]);

  const step = STEPS[i];

  /*
   * Reaching the plan finishes the walk: the answers are final for
   * now, the defaults the level sets are applied, and the sync
   * (lib/answers-sync.ts) carries it to the account once one exists.
   */
  useEffect(() => {
    if (!ready || step.kind !== "plan") return;
    const p = buildPortfolio(answers);
    writeOnboarding({ done: true, step: LAST });
    if (answers.level !== null) {
      writePrefs({ frameStep: p.settings.frameStep, skipIntros: !p.settings.intros });
      setFloor(firstRep(!p.settings.intros));
    }
  }, [ready, step, answers]);

  if (!ready) return <main className="px-5 pt-7" />;

  const go = (n: number) => {
    const next = Math.max(0, Math.min(n, LAST));
    // Leaving a question settles it, so the name he says back is the
    // one that was finished rather than the one mid-word.
    setHeardName(answers.name);
    setI(next);
    writeOnboarding({ step: next });
  };
  const answer = (patch: Partial<Answers>) => {
    const next = { ...answers, ...patch };
    setAnswers(next);
    writeOnboarding({ answers: next });
    /*
     * The hour is a device preference, so it applies the moment it is
     * chosen rather than waiting for the plan: picking "Evening" and
     * seeing nothing happen until two screens later is the opposite of
     * a control that answers your hand. No permission is requested —
     * `armPush` no-ops until one is granted (content/portfolio.ts).
     */
    if (patch.time !== undefined) {
      writePrefs({
        reminderHour: TIMES.find((t) => t.id === patch.time)?.hour ?? null,
      });
    }
  };

  if (step.kind === "intro") {
    const s = WELCOME_STEPS[step.index];
    return (
      <LessonScreen
        center
        stepKey={i}
        onBack={i > 0 ? () => go(i - 1) : undefined}
        title={s.title}
        line={s.line}
        art={<DemosArt pose={INTRO_POSES[step.index]} />}
        aside={<Dots count={WELCOME_STEPS.length} at={step.index} />}
        action={{ label: "Next", onPress: () => go(i + 1) }}
        footer={
          /*
           * Screen 1 carries the returning-user door (Duolingo's splash
           * pattern, DECISIONS #133): a new device belonging to an
           * existing account should sign in BEFORE recording anonymously.
           * Later screens keep Skip, which skips the questions too.
           */
          step.index === 0 ? (
            <Link
              href="/signin"
              className="press mt-3 block min-h-11 py-3 text-center text-[13px] font-semibold text-stone-500"
            >
              I already have an account
            </Link>
          ) : (
            <Link
              href="/"
              className="press mt-3 block min-h-11 py-3 text-center text-[13px] font-semibold text-stone-500"
            >
              Skip
            </Link>
          )
        }
      />
    );
  }

  if (step.kind === "question") {
    const q = QUESTIONS.find((x) => x.id === step.id)!;
    const n = i - FIRST_QUESTION + 1;
    const picked = has(answers, step.id);
    return (
      <LessonScreen
        stepKey={i}
        onBack={() => go(i - 1)}
        header={<Progress n={n} of={QUESTIONS.length} />}
        title={q.title}
        line={q.line}
        reply={replyFor(answers, step.id)}
        art={
          <DemosArt
            pose={QUESTION_POSES[step.id]}
            size={120}
            nodKey={nodKey(answers, step.id, heardName)}
          />
        }
        controls={
          <Choices
            id={step.id}
            answers={answers}
            onAnswer={answer}
            onSettleName={() => setHeardName(answers.name)}
          />
        }
        /* Essential questions wait for an answer; the optional ones
           don't. Skip is a link under the button on every one. */
        action={{
          label: "Next",
          onPress: () => go(i + 1),
          disabled: q.essential && !picked,
        }}
        footer={
          <button
            type="button"
            onClick={() => go(i + 1)}
            className="press mt-3 block min-h-11 w-full py-3 text-center text-[13px] font-semibold text-stone-500"
          >
            Skip
          </button>
        }
      />
    );
  }

  const plan = buildPortfolio(answers);
  return (
    <LessonScreen
      stepKey={i}
      onBack={() => go(i - 1)}
      title={plan.headline}
      /* His line to them, in their name and their words, in place of
         the template's old "Built from what you told me." */
      line={plan.opening}
      howTo={plan.lines}
      howToLabel={PLAN_COPY.label}
      /*
       * The one screen in the app where the NAME is the result (#212's
       * own test): "Think on your feet." is not what this screen is
       * called, it is what the seven answers came to. So it leads, and
       * the month under it is the list.
       */
      lead="title"
      ladder
      art={<DemosArt pose="clipboard" size={150} />}
      action={
        editing
          ? { label: PLAN_COPY.done, href: "/you" }
          : { label: PLAN_COPY.action, href: floor }
      }
      fineprint={plan.boss ? plan.boss.line : undefined}
    />
  );
}

function has(a: Answers, id: QuestionId): boolean {
  return id === "pains" ? a.pains.length > 0 : a[id] !== null;
}

/**
 * What Demos says back (#249). He speaks where the answer changed
 * something and stays quiet where it did not, so `goal`, `context` and
 * `time` return nothing and get the nod alone.
 *
 * The pains reply to the LAST one tapped rather than the first, because
 * a reply is an answer to what you just did; the plan's focus still
 * takes the first, which is a different question.
 */
function replyFor(a: Answers, id: QuestionId): string | undefined {
  switch (id) {
    case "name":
      return a.name === null ? undefined : NAME_REPLY(a.name);
    case "ageBand":
      return AGE_BANDS.find((b) => b.id === a.ageBand)?.reply;
    case "pains":
      return PAINS.find((p) => p.id === a.pains[a.pains.length - 1])?.reply;
    case "level":
      return LEVELS.find((l) => l.id === a.level)?.reply;
    default:
      return undefined;
  }
}

/**
 * What makes him nod: the answer to THIS question, as a string. Picking
 * the same row twice changes nothing and he stays still; picking a
 * different one always lands. The name uses the settled value, so the
 * nod comes when the field is finished rather than per keystroke.
 */
function nodKey(a: Answers, id: QuestionId, heardName: string | null): string {
  if (id === "name") return heardName ?? "";
  if (id === "pains") return a.pains.join(",");
  return a[id] ?? "";
}

/** The intro's pagination, unchanged (#133). */
function Dots({ count, at }: { count: number; at: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: count }, (_, n) => (
        <span
          key={n}
          className={`h-1.5 ${n === at ? "w-6 bg-terracotta-500" : "w-1.5 bg-sand"}`}
        />
      ))}
    </div>
  );
}

/** Where you are in the questions: the debrief's segment grammar. */
function Progress({ n, of }: { n: number; of: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: of }, (_, k) => (
        <span
          key={k}
          className={`h-1 flex-1 ${k < n ? "bg-terracotta-500" : "bg-sand"}`}
        />
      ))}
      <span className="label-micro ml-1 shrink-0 tabular-nums">
        {n} of {of}
      </span>
    </div>
  );
}

/**
 * One tappable answer per row, in the segmented control's grammar
 * (#206, ModeToggle): the chosen row fills with ink, the rest stand on
 * `surface` behind the `edge` boundary every control in the app now
 * carries. Single answers are a radio set; the pains are checkboxes,
 * three at most; the name is the one thing you type.
 */
function Choices({
  id,
  answers,
  onAnswer,
  onSettleName,
}: {
  id: QuestionId;
  answers: Answers;
  onAnswer: (patch: Partial<Answers>) => void;
  onSettleName: () => void;
}) {
  if (id === "name") {
    return (
      <input
        // Deliberately NOT autoFocus: a keyboard that throws itself up
        // over Demos on the first question of the first session hides
        // the half of the screen that is doing the introducing.
        aria-label={NAME_FIELD.label}
        maxLength={MAX_NAME}
        autoComplete="given-name"
        enterKeyHint="next"
        value={answers.name ?? ""}
        onChange={(e) => onAnswer({ name: cleanName(e.target.value) })}
        onBlur={onSettleName}
        placeholder={NAME_FIELD.placeholder}
        className={INPUT_CLASS}
      />
    );
  }

  if (id === "pains") {
    const full = answers.pains.length >= MAX_PAINS;
    return (
      <div role="group" aria-label="What you notice" className="space-y-2">
        {PAINS.map((o) => {
          const on = answers.pains.includes(o.id);
          return (
            <Row
              key={o.id}
              role="checkbox"
              on={on}
              disabled={!on && full}
              label={o.label}
              onPress={() =>
                onAnswer({
                  pains: on
                    ? answers.pains.filter((p) => p !== o.id)
                    : [...answers.pains, o.id],
                })
              }
            />
          );
        })}
      </div>
    );
  }
  const options =
    id === "ageBand"
      ? AGE_BANDS
      : id === "goal"
        ? GOALS
        : id === "level"
          ? LEVELS
          : id === "time"
            ? TIMES
            : CONTEXTS;
  const value = answers[id];
  return (
    <div role="radiogroup" aria-label={QUESTIONS.find((q) => q.id === id)!.title} className="space-y-2">
      {options.map((o) => (
        <Row
          key={o.id}
          role="radio"
          on={value === o.id}
          label={o.label}
          onPress={() => onAnswer({ [id]: o.id } as Partial<Answers>)}
        />
      ))}
    </div>
  );
}

function Row({
  role,
  on,
  disabled = false,
  label,
  onPress,
}: {
  role: "radio" | "checkbox";
  on: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={on}
      disabled={disabled}
      onClick={onPress}
      className={`press font-display flex min-h-12 w-full items-center rounded-control border px-4 text-left text-[14px] font-bold transition-colors ${
        on
          ? "border-ink bg-ink text-ground"
          : "border-edge bg-surface hover:bg-sand"
      } ${disabled ? "!text-stone-400" : ""}`}
    >
      {label}
    </button>
  );
}
