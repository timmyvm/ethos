"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { DemosArt, preloadPose, type Pose } from "@/components/DemosArt";
import { SAID_AFTER_MS } from "@/components/Says";
import { LessonScreen } from "@/components/LessonScreen";
import { sessionState, signInWithGoogle } from "@/lib/auth";
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
  | { kind: "plan" }
  | { kind: "account" };

const STEPS: Step[] = [
  ...WELCOME_STEPS.map((_, index): Step => ({ kind: "intro", index })),
  ...QUESTIONS.map((q): Step => ({ kind: "question", id: q.id })),
  { kind: "plan" },
  /*
   * The account ask (#277). Last, after the plan, because the plan is
   * the thing worth keeping and asking before it exists is asking for
   * nothing. Nothing here is gated: "Not now" goes straight to the
   * floor, which is what keeps /about's "no signup until you've spoken"
   * true, and a signed-in account skips the screen entirely.
   */
  { kind: "account" },
];
const LAST = STEPS.length - 1;
const FIRST_QUESTION = STEPS.findIndex((s) => s.kind === "question");
/* The walk's resting place. A finished walk opens here, not on the
   account screen behind it. */
const PLAN = STEPS.findIndex((s) => s.kind === "plan");

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
   * Null until the session read lands. Somebody who came in through "I
   * already have an account" on screen one is not asked again, so the
   * plan takes them straight to the floor.
   */
  const [needsAccount, setNeedsAccount] = useState<boolean | null>(null);

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
    setI(deep >= 0 ? deep : saved.done ? PLAN : Math.min(saved.step, PLAN));
    setFloor(firstRep(readPrefs().skipIntros));
    setReady(true);
    sessionState()
      .then((sess) => setNeedsAccount(!(sess.signedIn && !sess.anonymous)))
      .catch(() => setNeedsAccount(true));
  }, [asked]);

  const step = STEPS[i];

  /* The next screen's Demos, fetched while this one is read (#288). */
  useEffect(() => {
    const after = STEPS[i + 1];
    if (!after) return;
    const pose =
      after.kind === "intro"
        ? INTRO_POSES[after.index]
        : after.kind === "question"
          ? QUESTION_POSES[after.id]
          : "clipboard";
    preloadPose(pose);
  }, [i]);

  /*
   * Reaching the plan finishes the walk: the answers are final for
   * now, the defaults the level sets are applied, and the sync
   * (lib/answers-sync.ts) carries it to the account once one exists.
   */
  useEffect(() => {
    if (!ready || step.kind !== "plan") return;
    const p = buildPortfolio(answers);
    writeOnboarding({ done: true, step: PLAN });
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
        speech="above"
        stepKey={i}
        onBack={i > 0 ? () => go(i - 1) : undefined}
        title={s.title}
        line={s.line}
        art={
          <DemosArt
            pose={INTRO_POSES[step.index]}
            size={200}
            greetAfterMs={SAID_AFTER_MS}
          />
        }
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
        speech="beside"
        stepKey={i}
        onBack={() => go(i - 1)}
        header={<Progress n={n} of={QUESTIONS.length} />}
        title={q.title}
        line={q.line}
        reply={replyFor(answers, step.id)}
        art={
          <DemosArt
            pose={QUESTION_POSES[step.id]}
            size={84}
            nodKey={nodKey(answers, step.id, heardName)}
            greetAfterMs={SAID_AFTER_MS}
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
        /*
         * Next waits for an answer on EVERY question (#288, the
         * reference's grey Continue): the button lighting terracotta is
         * the reward for answering, and a button that is always lit
         * rewards nothing. Skip, under it, is the way past without one,
         * so nothing became mandatory. The old rule lit Next on the
         * optional questions and held it on the essential ones, which
         * was two rules for one button.
         */
        action={{
          label: "Next",
          onPress: () => go(i + 1),
          disabled: !picked,
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

  if (step.kind === "account") {
    return (
      <AccountStep
        stepKey={i}
        onBack={() => go(i - 1)}
        floor={floor}
        name={answers.name}
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
      art={<DemosArt pose="clipboard" size={150} className="mb-6" />}
      /*
       * Editing from /you leaves the way it came. Otherwise the plan
       * hands over to the account screen, unless this browser already
       * has an account, in which case there is nothing to ask and the
       * floor is one tap as it always was.
       */
      action={
        editing
          ? { label: PLAN_COPY.done, href: "/you" }
          : needsAccount === false
            ? { label: PLAN_COPY.action, href: floor }
            : { label: PLAN_COPY.action, onPress: () => go(i + 1) }
      }
      fineprint={plan.boss ? plan.boss.line : undefined}
    />
  );
}

/**
 * The account ask (#277), and the shape of it is the whole point.
 *
 * Ethos has never asked for an account before the product worked: #15
 * set that rule, the save-progress wall (lib/onboarding.ts) is where it
 * was kept, and /about still promises "no signup until you've spoken".
 * Asking here, one screen after the plan, is Timothy's call on 14 Sep,
 * and it only survives that promise because NOTHING on this screen is a
 * gate. "Not now" is a plain tap to the floor, not a dismissal hidden
 * in a corner, and the wall downstream still catches anyone who took
 * it.
 *
 * What it asks to keep is the plan they have just been shown, which is
 * the one moment in the walk where an account is about something they
 * can see rather than about a future they have not had yet.
 *
 * It wears the save-progress wall's grammar rather than /signup's: one
 * terracotta tap on the thing being asked for, a neutral second door,
 * and a quiet decline that continues. No four-colour G, because that
 * mark belongs on a light surface and this screen's one accent is the
 * accent every screen gets.
 *
 * Google first because it is one tap and the identity is already
 * wired: `signInWithGoogle("signup")` links the provider to the
 * anonymous session rather than signing into a new one, so nothing
 * recorded on this device is orphaned (lib/auth.ts).
 */
function AccountStep({
  stepKey,
  onBack,
  floor,
  name,
}: {
  stepKey: number;
  onBack: () => void;
  floor: string;
  name: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function google() {
    setBusy(true);
    setError(null);
    const result = await signInWithGoogle("signup");
    /* Success navigates away to Google, so only failure lands back
       here and the button has to be usable again. */
    if (!result.ok) {
      setBusy(false);
      setError(result.error ?? "Google didn't answer. Try again.");
    }
  }

  return (
    <LessonScreen
      center
      stepKey={stepKey}
      onBack={onBack}
      title={name ? `Keep this, ${name}.` : "Keep this."}
      line="Your plan and every number you're about to make, on any phone you open."
      art={<DemosArt pose="clipboard" size={132} className="mb-6" />}
      action={{ label: "Continue with Google", onPress: () => void google(), disabled: busy }}
      aside={
        error ? (
          <p role="alert" className="text-caption text-rust">
            {error}
          </p>
        ) : undefined
      }
      /*
       * Under the tap, in descending loudness: the second door, then
       * the decline. The decline is a plain link at full tap height
       * rather than a swallowed word, because it is the thing that
       * keeps this screen honest.
       */
      footer={
        <>
          <Link
            href="/signup"
            className="press font-display mt-3 flex min-h-12 w-full items-center justify-center rounded-control border border-edge bg-surface px-6 text-[14px] font-bold"
          >
            Use an email instead
          </Link>
          <div className="mt-2 flex items-center justify-between gap-4">
            <Link
              href={floor}
              className="press inline-flex min-h-11 items-center px-1 text-[13px] font-semibold text-stone-500"
            >
              Not now
            </Link>
            {/* The one place inside the product where somebody deciding
                whether to sign up can read what it is (#277). */}
            <Link
              href="/about"
              className="press inline-flex min-h-11 items-center px-1 text-[13px] font-semibold text-stone-500"
            >
              What Ethos is
            </Link>
          </div>
        </>
      }
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
