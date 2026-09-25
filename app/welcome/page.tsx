"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { DemosArt, preloadPose, type Pose, type Tone } from "@/components/DemosArt";
import {
  IconBars,
  IconBeacon,
  IconCap,
  IconBoss,
  IconCase,
  IconFlat,
  IconFreeze,
  IconGauge,
  IconGlobe,
  IconParagraph,
  IconPeople,
  IconSpark,
  IconTrail,
  IconWave,
  IconYou,
} from "@/components/Icon";
import { SAID_AFTER_MS } from "@/components/Says";
import { LessonScreen } from "@/components/LessonScreen";
import { attemptStartedOn, readOAuthAttempt, sessionState } from "@/lib/auth";
import { useGoogleSignIn } from "@/lib/use-oauth-return";
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
  type AgeBandId,
  type Answers,
  type ContextId,
  type GoalId,
  type LevelId,
  type PainId,
} from "@/lib/answers";
import {
  markWelcomed,
  NAME_FIELD,
  PLAN_COPY,
  QUESTIONS,
  WELCOME_BEAT,
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
  | { kind: "beat" }
  | { kind: "plan" }
  | { kind: "account" };

const STEPS: Step[] = [
  ...WELCOME_STEPS.map((_, index): Step => ({ kind: "intro", index })),
  /*
   * The beat sits before the hour (#288): six questions, then Demos
   * alone with one line, then the seventh. It is not a question, so
   * the bar does not move for it and the count stays seven.
   */
  ...QUESTIONS.flatMap((q): Step[] =>
    q.id === "time"
      ? [{ kind: "beat" }, { kind: "question", id: q.id }]
      : [{ kind: "question", id: q.id }]
  ),
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
/* The walk's resting place. A finished walk opens here, not on the
   account screen behind it. */
const PLAN = STEPS.findIndex((s) => s.kind === "plan");

/** Which pose asks which question (#233, #249). */
const INTRO_POSES: Pose[] = ["wave", "speaking", "celebrate"];
/** The beat's pose: he is telling you something, arcs and all. */
const BEAT_POSE: Pose = "speaking";
/*
 * The colour of each screen (the swipe-and-pop round). The three intro
 * screens and the beat each stand him on a stage in their own tone, so
 * a swipe is a change of room as well as of line; the questions give
 * his head a coin in a tone and the answers' glyphs their tiles. The
 * speaking pose never stands on sun, because his arcs are amber, and
 * he never stands on coral, which is his own fur colour (the review of
 * this round: in dark, coral was rust brown and he vanished into it).
 * Coral stays on the small things, the glyph tiles and the plan steps.
 */
const INTRO_TONES: Tone[] = ["sun", "sky", "mint"];
const BEAT_TONE: Tone = "mint";
const QUESTION_TONES: Record<QuestionId, Tone> = {
  name: "sun",
  ageBand: "sky",
  goal: "mint",
  pains: "sun",
  level: "sky",
  context: "mint",
  time: "sun",
};
/** Answer glyphs walk the tones row by row. */
const ROW_TONES: Tone[] = ["sky", "coral", "sun"];
const QUESTION_POSES: Record<QuestionId, Pose> = {
  name: "hello",
  ageBand: "fingers",
  goal: "telescope",
  pains: "listening",
  level: "mic",
  context: "headphones",
  time: "clock",
};

/** A number as a glyph: the age bands, where the number IS the mark. */
function Mark({ children }: { children: ReactNode }) {
  return (
    <span className="font-display text-[13px] font-extrabold tabular-nums">
      {children}
    </span>
  );
}

/**
 * One glyph per answer (#288, the reference's mechanic 6). Typed over
 * every option id so a new answer cannot ship without its mark. The
 * hour is the one list without glyphs: its rows are two columns, the
 * word and the time, which is the reference's own goal screen.
 */
const GLYPH: Record<AgeBandId | GoalId | PainId | LevelId | ContextId, ReactNode> = {
  u18: <Mark>&lt;18</Mark>,
  "18_24": <Mark>18</Mark>,
  "25_34": <Mark>25</Mark>,
  "35_plus": <Mark>35</Mark>,
  sharper: <IconSpark size={22} />,
  present: <IconBeacon size={22} />,
  feet: <IconBoss size={22} />,
  anyone: <IconYou size={22} />,
  fillers: <IconWave size={22} />,
  rushing: <IconGauge size={22} />,
  trailing: <IconTrail size={22} />,
  freezing: <IconFreeze size={22} />,
  flat: <IconFlat size={22} />,
  rambling: <IconParagraph size={22} />,
  never: <IconBars size={22} lit={1} />,
  some: <IconBars size={22} lit={2} />,
  often: <IconBars size={22} lit={3} />,
  class: <IconCap size={22} />,
  work: <IconCase size={22} />,
  social: <IconPeople size={22} />,
  online: <IconGlobe size={22} />,
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
  /* Which way the last step went, so the next screen arrives from the
     side it came from. */
  const [travel, setTravel] = useState<"next" | "back">("next");
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
    /* Back from a Google attempt that began here and did not finish
       (a successful return forgets it, app/auth/callback): reopen on
       the account ask, not the plan, or the Google button she just
       used is nowhere in sight (auth review, 25 Sep). */
    const resumeAccount =
      deep < 0 && asked === null && saved.done && attemptStartedOn(readOAuthAttempt(), "/welcome");
    setI(resumeAccount ? LAST : deep >= 0 ? deep : saved.done ? PLAN : Math.min(saved.step, PLAN));
    setFloor(firstRep(readPrefs().skipIntros));
    setReady(true);
    sessionState()
      .then((sess) => {
        const needs = !(sess.signedIn && !sess.anonymous);
        setNeedsAccount(needs);
        if (resumeAccount && !needs) setI(PLAN);
      })
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
          : after.kind === "beat"
            ? BEAT_POSE
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
    setTravel(next < i ? "back" : "next");
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
        stage={INTRO_TONES[step.index]}
        stepKey={i}
        travel={travel}
        swipe={{ next: () => go(i + 1), back: i > 0 ? () => go(i - 1) : undefined }}
        onBack={i > 0 ? () => go(i - 1) : undefined}
        title={s.title}
        line={s.line}
        art={
          <DemosArt
            pose={INTRO_POSES[step.index]}
            size={320}
            fit
            pop
            grounded
            halo={{ tone: INTRO_TONES[step.index], kind: "stage" }}
            greetAfterMs={SAID_AFTER_MS}
          />
        }
        aside={
          <Dots
            count={WELCOME_STEPS.length}
            at={step.index}
            onPick={(n) => go(STEPS.findIndex((x) => x.kind === "intro" && x.index === n))}
          />
        }
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

  if (step.kind === "beat") {
    return (
      <LessonScreen
        center
        speech="above"
        stage={BEAT_TONE}
        stepKey={i}
        travel={travel}
        swipe={{ next: () => go(i + 1), back: () => go(i - 1) }}
        onBack={() => go(i - 1)}
        header={<Progress n={QUESTIONS.length - 1} of={QUESTIONS.length} />}
        title={WELCOME_BEAT.title}
        line={WELCOME_BEAT.line}
        art={
          <DemosArt
            pose={BEAT_POSE}
            size={300}
            fit
            pop
            grounded
            halo={{ tone: BEAT_TONE, kind: "stage" }}
            greetAfterMs={SAID_AFTER_MS}
          />
        }
        action={{ label: "Next", onPress: () => go(i + 1) }}
      />
    );
  }

  if (step.kind === "question") {
    const q = QUESTIONS.find((x) => x.id === step.id)!;
    /* By the question's own place in the seven, not the step's index:
       the beat sits between the sixth and the seventh. */
    const n = QUESTIONS.findIndex((x) => x.id === step.id) + 1;
    const picked = has(answers, step.id);
    return (
      <LessonScreen
        speech="beside"
        stepKey={i}
        travel={travel}
        /* Forward by swipe follows Next's own rule: no answer, no
           advance. The screen rubber-bands and Skip stays the way past. */
        swipe={{ next: picked ? () => go(i + 1) : undefined, back: () => go(i - 1) }}
        onBack={() => go(i - 1)}
        header={<Progress n={n} of={QUESTIONS.length} />}
        title={q.title}
        line={q.line}
        reply={replyFor(answers, step.id)}
        art={
          <DemosArt
            pose={QUESTION_POSES[step.id]}
            size={84}
            pop
            halo={{ tone: QUESTION_TONES[step.id], kind: "coin" }}
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
        travel={travel}
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
      travel={travel}
      /* Forward only where forward is the account ask; the floor and
         /you are doors you tap, never somewhere a swipe drops you. */
      swipe={{
        next: !editing && needsAccount !== false ? () => go(i + 1) : undefined,
        back: () => go(i - 1),
      }}
      onBack={() => go(i - 1)}
      title={plan.headline}
      /* His line to them, in their name and their words, in place of
         the template's old "Built from what you told me." */
      line={plan.opening}
      /* The month as coloured steps on a rail (the swipe-and-pop
         round), in the controls slot so the ladder is this screen's
         own rather than the template's numbered list. */
      controls={<PlanSteps label={PLAN_COPY.label} lines={plan.lines} />}
      /*
       * The one screen in the app where the NAME is the result (#212's
       * own test): "Think on your feet." is not what this screen is
       * called, it is what the seven answers came to. So it leads, and
       * the month under it is the list.
       */
      lead="title"
      ladder
      art={
        <DemosArt
          pose="clipboard"
          size={156}
          pop
          grounded
          halo={{ tone: "sun", kind: "coin" }}
          className="mb-6"
        />
      }
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
  travel,
  onBack,
  floor,
  name,
}: {
  stepKey: number;
  travel: "next" | "back";
  onBack: () => void;
  floor: string;
  name: string | null;
}) {
  /* The same hook as /signup: the button comes back when they do,
     whether or not Google finished (lib/use-oauth-return.ts). */
  const { pending, error, start: google } = useGoogleSignIn("signup");

  return (
    <LessonScreen
      center
      stepKey={stepKey}
      travel={travel}
      swipe={{ back: onBack }}
      onBack={onBack}
      title={name ? `Keep this, ${name}.` : "Keep this."}
      line="Your plan and every number you're about to make, on any phone you open."
      art={
        <DemosArt
          pose="clipboard"
          size={144}
          pop
          grounded
          halo={{ tone: "sky", kind: "coin" }}
          className="mb-6"
        />
      }
      /* Held, not greyed, while the browser leaves, as on /signup: a
         faded button is what read as dead when she came back. */
      action={{
        label: pending ? "Opening Google…" : "Continue with Google",
        onPress: () => {
          if (!pending) void google();
        },
      }}
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

/**
 * The intro's pager (#133, the swipe-and-pop round). Reads as a pager
 * because it behaves as one: the active dot is a pill that stretches
 * along the row as the page changes, and each dot is a door to its
 * page. The dots live outside the sliding content, so they persist
 * from page to page and the stretch animates.
 */
function Dots({
  count,
  at,
  onPick,
}: {
  count: number;
  at: number;
  onPick: (n: number) => void;
}) {
  return (
    /* Each door is 44px tall and at least 24px wide (WCAG 2.5.8), not
       44 square: three 44px cells spread the dots into three separate
       marks and the row stops reading as one pager. */
    <div
      role="group"
      aria-label={`Page ${at + 1} of ${count}`}
      className="flex items-center justify-center"
    >
      {Array.from({ length: count }, (_, n) => (
        <button
          key={n}
          type="button"
          aria-label={`Page ${n + 1}`}
          aria-current={n === at ? "step" : undefined}
          onClick={() => onPick(n)}
          className="flex h-11 min-w-6 items-center justify-center px-2"
        >
          <span data-on={n === at ? "" : undefined} className="intro-dot block" />
        </button>
      ))}
    </div>
  );
}

/**
 * Where you are in the questions (#288): one bar that fills, no count.
 *
 * Seven segments and "2 of 7" told you the walk was seven long before
 * you had answered one; a bar a quarter full says the same without the
 * number, which is the reference's own move. The width transitions
 * because this element persists from one question to the next (the
 * template is the same instance across the walk), so the fill grows
 * from where it was rather than reappearing at the new value.
 */
function Progress({ n, of }: { n: number; of: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={of}
      aria-valuenow={n}
      aria-label={`Question ${n} of ${of}`}
      className="intro-progress w-full"
    >
      <div style={{ width: `${(n / of) * 100}%` }} />
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
        {PAINS.map((o, k) => {
          const on = answers.pains.includes(o.id);
          return (
            <Row
              key={o.id}
              role="checkbox"
              on={on}
              disabled={!on && full}
              label={o.label}
              glyph={GLYPH[o.id]}
              tone={ROW_TONES[k % ROW_TONES.length]}
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
  if (id === "time") {
    return (
      <div role="radiogroup" aria-label={QUESTIONS.find((q) => q.id === id)!.title} className="space-y-2">
        {TIMES.map((o) => {
          /* "Morning, 08:00" as two columns: the word to scan, the hour
             to the right in tabular figures. The row's accessible name
             stays the whole label. */
          const [word, hour] = o.label.split(", ");
          return (
            <Row
              key={o.id}
              role="radio"
              on={answers.time === o.id}
              label={o.label}
              word={word}
              detail={hour}
              onPress={() => onAnswer({ time: o.id })}
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
          : CONTEXTS;
  const value = answers[id];
  return (
    <div role="radiogroup" aria-label={QUESTIONS.find((q) => q.id === id)!.title} className="space-y-2">
      {options.map((o, k) => (
        <Row
          key={o.id}
          role="radio"
          on={value === o.id}
          label={o.label}
          glyph={GLYPH[o.id]}
          tone={ROW_TONES[k % ROW_TONES.length]}
          onPress={() => onAnswer({ [id]: o.id } as Partial<Answers>)}
        />
      ))}
    </div>
  );
}

/**
 * One answer, as an object (#288): 56px, a glyph at the left, and the
 * chosen one lit in terracotta, an edge on a wash, rather than the
 * inverted ink block #206 gave it. The ink block was the heaviest
 * thing on the screen and it marked the ANSWER, which is the one thing
 * on a question screen that is not the action; terracotta is what a
 * thing you touched looks like everywhere else in the app (an input's
 * focus, the boss card's edge). A second ring is drawn inside the edge
 * so the chosen row reads at a squint without the box changing size.
 *
 * `aria-label` carries the whole label because the glyph and the
 * hour are text too, and "<18Under 18" is not a name.
 */
function Row({
  role,
  on,
  disabled = false,
  label,
  word,
  detail,
  glyph,
  tone = "sky",
  onPress,
}: {
  role: "radio" | "checkbox";
  on: boolean;
  disabled?: boolean;
  label: string;
  /** What the row prints when it is not the whole label. */
  word?: string;
  /** A right-hand column: the hour. */
  detail?: string;
  glyph?: ReactNode;
  /** The glyph tile's colour (the swipe-and-pop round). */
  tone?: Tone;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      className={`press font-display flex min-h-14 w-full items-center gap-3.5 rounded-control border px-4 py-2.5 text-left text-[15px] font-bold transition-colors ${
        on
          ? "border-terracotta-500 bg-terracotta-50 shadow-[inset_0_0_0_1px_var(--color-terracotta-500)]"
          : "border-edge bg-surface hover:bg-sand"
      } ${disabled ? "!text-stone-400" : ""}`}
    >
      {glyph !== undefined && (
        /* A tile in its tone, the reference's coloured glyph: colour on
           the answer objects is illustration, never the tap's colour. */
        <span aria-hidden className={`glyph-tile tone-${tone}`}>
          {glyph}
        </span>
      )}
      <span className="min-w-0 flex-1">{word ?? label}</span>
      {detail && (
        <span
          aria-hidden
          className={`shrink-0 text-[14px] font-semibold tabular-nums ${
            on ? "text-terracotta-700" : "text-stone-400"
          }`}
        >
          {detail}
        </span>
      )}
    </button>
  );
}

/**
 * The plan's month as coloured steps (the swipe-and-pop round): three
 * numbered coins on a rail, each in its own tone, landing one at a
 * time. The numbers are what the eye counts before it reads, the rail
 * says the three are a sequence, and the tones are the only colour on
 * a screen that was brown text on white.
 */
function PlanSteps({ label, lines }: { label: string; lines: string[] }) {
  const tones: Tone[] = ["sun", "sky", "coral"];
  return (
    <div>
      <div className="label-data">{label}</div>
      <ol
        className="stagger relative mt-4 space-y-4"
        style={{ "--stagger-lead": "260ms" } as React.CSSProperties}
      >
        {lines.map((line, k) => (
          <li key={line} className="relative flex items-start gap-3.5">
            {k < lines.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[13px] top-7 -bottom-4 w-0.5 bg-edge"
              />
            )}
            <span
              aria-hidden
              className={`plan-step-mark tone-${tones[k % tones.length]} font-display text-[13px] font-extrabold tabular-nums`}
            >
              {k + 1}
            </span>
            <span className="min-w-0 pt-0.5 text-body">{line}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
