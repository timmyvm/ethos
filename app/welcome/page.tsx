"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { DemosArt, preloadPose, type Pose, type Tone } from "@/components/DemosArt";
import {
  IconBars,
  IconBolt,
  IconBubble,
  IconCap,
  IconCase,
  IconEllipsis,
  IconFreeze,
  IconGauge,
  IconGlobe,
  IconMic,
  IconParagraph,
  IconPeople,
  IconSpark,
  IconWave,
  IconWaveFlat,
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
  type PlanStep,
} from "@/content/portfolio";
import type { TraitId } from "@/content/traits";
import {
  cleanName,
  EMPTY_ANSWERS,
  MAX_NAME,
  MAX_PAINS,
  readOnboarding,
  writeOnboarding,
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
import { useHourLabel } from "@/lib/time-label";
import { INPUT_CLASS } from "@/lib/ui";
import { useRovingRadio } from "@/lib/use-roving-radio";

/**
 * The walk (DECISIONS #133, #232, #249): three screens that say the
 * thing, seven questions, and the plan built from the answers. Eleven
 * screens, a way back on every one, Skip on every question, no account,
 * no quiz wall (#11): the mic is never more than a tap away, and a
 * refresh lands where it left off.
 *
 * What #249 added, and why it is not decoration:
 *
 *  - Demos REACTS. Every answer moves him (a nod on the wrapper, one
 *    shot, 460ms), and where the answer actually changed something he
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
/**
 * The glyphs' inks walk these row by row (#300, pop with colour): the
 * colour is the glyph's own ink, never a tile and never the tap. The
 * level is the exception (intro-b-9): its bars rise one to three, so
 * all three wear one tone (`QUESTION_TONES.level`) and read as a scale.
 */
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

/**
 * One glyph per answer (#288, the reference's mechanic 6), standing
 * bare at 24px in its ink (intro-a-7, M20). Typed over every option id
 * so a new answer cannot ship without its mark. Two lists have none:
 * the age bands, whose label already IS the number (intro-a-8), and the
 * hour, whose rows are the word and the time, the reference's own goal
 * screen.
 */
const GLYPH: Record<GoalId | PainId | LevelId | ContextId, ReactNode> = {
  sharper: <IconSpark size={24} />,
  present: <IconMic size={24} />,
  feet: <IconBolt size={24} />,
  anyone: <IconBubble size={24} />,
  fillers: <IconWave size={24} />,
  rushing: <IconGauge size={24} />,
  trailing: <IconEllipsis size={24} />,
  freezing: <IconFreeze size={24} />,
  flat: <IconWaveFlat size={24} />,
  rambling: <IconParagraph size={24} />,
  never: <IconBars size={24} lit={1} />,
  some: <IconBars size={24} lit={2} />,
  often: <IconBars size={24} lit={3} />,
  class: <IconCap size={24} />,
  work: <IconCase size={24} />,
  social: <IconPeople size={24} />,
  online: <IconGlobe size={24} />,
};

/**
 * The pains that ARE a trait wear that trait's ink (intro-a-7,
 * PRINCIPLES 6): a colour always means a trait and a trait always wears
 * its colour, so "Um, like" is the Fillers lagoon and never a tone
 * picked by its row. Trailing off and rambling are read by the Index
 * but are no trait of the five, so they stand neutral.
 */
const PAIN_TRAIT: Record<PainId, TraitId | null> = {
  fillers: "fillers",
  rushing: "pace",
  trailing: null,
  freezing: "pause",
  flat: "range",
  rambling: null,
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
            : /* intro-b-21: the account ask says hello, so the plan's
                 clipboard is not shown twice in a row. */
              after.kind === "account"
              ? "hello"
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
     * a control that answers your hand. No permission is requested:
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
            <Link href="/signin" className={FOOT_LINK}>
              I already have an account
            </Link>
          ) : (
            /* intro-a-21: it leaves the whole introduction, questions
               and all, so it says so; a question's Skip passes one. */
            <Link href="/" className={FOOT_LINK}>
              Skip intro
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
        /* The beat is no question, so it has no Skip, but it holds
           Skip's width so the bar keeps one length from q6 to q7. */
        header={<WalkBar n={QUESTIONS.length - 1} of={QUESTIONS.length} />}
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
        header={
          <WalkBar n={n} of={QUESTIONS.length} onSkip={() => go(i + 1)} />
        }
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
            onNext={() => go(i + 1)}
          />
        }
        /*
         * Next waits for an answer on EVERY question (#288, the
         * reference's grey Continue): the button lighting terracotta is
         * the reward for answering, and a button that is always lit
         * rewards nothing. Skip, in the top row beside the bar (M20), is
         * the way past without one, so nothing became mandatory, and the
         * shelf holds Next alone, as the reference's footer does.
         */
        action={{
          label: "Next",
          onPress: () => go(i + 1),
          disabled: !picked,
        }}
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
      /*
       * The plan speaks (intro-b-11): Demos says the headline and his
       * line to them from the same bubble every question used, so the
       * walk keeps one grammar to its end instead of dropping into a
       * heading and a grey subtitle. The month is the screen's list,
       * left-aligned under him. 120px is the smallest size at which his
       * idle clip still plays (#316).
       */
      speech="beside"
      title={plan.headline}
      /* His line to them, in their name and their words, in place of
         the template's old "Built from what you told me." */
      line={plan.opening}
      controls={<PlanSteps label={PLAN_COPY.label} steps={plan.stepParts} />}
      art={
        <DemosArt
          pose="clipboard"
          size={120}
          pop
          halo={{ tone: "sun", kind: "coin" }}
          greetAfterMs={SAID_AFTER_MS}
        />
      }
      /*
       * Editing from /you leaves the way it came. Otherwise the plan
       * hands over to the account screen, unless this browser already
       * has an account, in which case there is nothing to ask and the
       * floor is one tap as it always was. Start only where it starts
       * something (#317); the step to the account ask is Next
       * (intro-b-10).
       */
      action={
        editing
          ? { label: PLAN_COPY.done, href: "/you" }
          : needsAccount === false
            ? { label: PLAN_COPY.action, href: floor }
            : { label: PLAN_COPY.toAccount, onPress: () => go(i + 1) }
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
      /* intro-b-13: the title and the line share the coin's axis, and
         a larger Demos takes the slack out of the bands round them. He
         says hello (intro-b-21): the plan's clipboard was one screen
         ago. */
      align="center"
      art={
        <DemosArt
          pose="hello"
          size={200}
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
          {/* intro-b-14: the second door is Google's size and type, so
              the two read as a pair and only the fill ranks them. */}
          <Link
            href="/signup"
            className="press font-display mt-3 flex min-h-12 w-full items-center justify-center rounded-control border border-edge bg-surface px-6 py-3.5 text-body font-bold"
          >
            Use an email instead
          </Link>
          {/* -mx-1 px-1: the words line up with the buttons' edges and
              keep the padding as hit area. */}
          <div className="mt-2 flex items-center justify-between gap-4">
            <Link href={floor} className="text-link -mx-1 inline-flex min-h-11 items-center px-1">
              Not now
            </Link>
            {/* The one place inside the product where somebody deciding
                whether to sign up can read what it is (#277). */}
            <Link href="/about" className="text-link -mx-1 inline-flex min-h-11 items-center px-1">
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
 * number, which is the reference's own move. The fill is full width and
 * clipped to `--p` on the base spring (A3's hook, intro-a-20), so the
 * gradient holds still under the clip as the bar grows; this element
 * persists from one question to the next, so it grows from where it was.
 */
function Progress({ n, of }: { n: number; of: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={of}
      aria-valuenow={n}
      aria-label={`Question ${n} of ${of}`}
      className="intro-progress w-full min-w-0 flex-1"
    >
      {/* intro-b-4: the plan is the walk's last step, so the drawn bar
          counts it and no question shows a finished bar. */}
      <div style={{ "--p": n / (of + 1) } as React.CSSProperties} />
    </div>
  );
}

/**
 * The walk's top row after Back (M20, Duolingo 13-question-list-dark):
 * the bar, then Skip, the way past a question without an answer, as a
 * text link with a 44px hit. Its place is held on the beat, which has
 * nothing to skip, so the bar is one length from the first question to
 * the last.
 */
function WalkBar({ n, of, onSkip }: { n: number; of: number; onSkip?: () => void }) {
  return (
    <div className="flex items-center gap-4">
      <Progress n={n} of={of} />
      {onSkip ? (
        <button type="button" onClick={onSkip} className="text-link flex min-h-11 shrink-0 items-center">
          Skip
        </button>
      ) : (
        <span aria-hidden className="text-link invisible flex min-h-11 shrink-0 items-center">
          Skip
        </span>
      )}
    </div>
  );
}

/** The door under an intro screen's Next: a text link at full width. */
const FOOT_LINK = "text-link mt-3 flex min-h-11 items-center justify-center";

/**
 * An answer, chosen (M20, intro-a-14): the reference's accent edge,
 * tinted fill and accent label, never an inverted block. The dark wash
 * is the accent at 10% over the surface, because terracotta-50 in dark
 * is a brown slab. One constant, worn by a chosen row and by the name
 * field once a name is in it, so the typed answer and the tapped ones
 * light the same way.
 */
const PICKED_ROW =
  "border-terracotta-500 bg-terracotta-50 text-terracotta-700 dark:bg-[color-mix(in_srgb,var(--color-terracotta-500)_10%,var(--color-surface))]";

/**
 * The answers to one question: a field for the name, checkboxes for
 * the pains (three at most), and a radio set for the rest. Each is its
 * own component, so the radio sets can hold their hook.
 */
function Choices({
  id,
  answers,
  onAnswer,
  onSettleName,
  onNext,
}: {
  id: QuestionId;
  answers: Answers;
  onAnswer: (patch: Partial<Answers>) => void;
  onSettleName: () => void;
  onNext: () => void;
}) {
  if (id === "name") {
    return (
      <NameField
        name={answers.name}
        onAnswer={onAnswer}
        onSettleName={onSettleName}
        onNext={onNext}
      />
    );
  }
  if (id === "pains") return <Pains pains={answers.pains} onAnswer={onAnswer} />;
  if (id === "time") return <Hours value={answers.time} onAnswer={onAnswer} />;
  return <OneOf id={id} answers={answers} onAnswer={onAnswer} />;
}

/**
 * The one answer you type (intro-a-10, intro-a-11): the same 56px
 * object as the rows under every other question, at 17px (still past
 * the 16 that stops iOS zooming in), lit like a chosen row once a name
 * is in it. The keyboard's Next key is the screen's Next (intro-a-2).
 */
function NameField({
  name,
  onAnswer,
  onSettleName,
  onNext,
}: {
  name: string | null;
  onAnswer: (patch: Partial<Answers>) => void;
  onSettleName: () => void;
  onNext: () => void;
}) {
  return (
    <input
      // Deliberately NOT autoFocus: a keyboard that throws itself up
      // over Demos on the first question of the first session hides
      // the half of the screen that is doing the introducing.
      aria-label={NAME_FIELD.label}
      name="given-name"
      maxLength={MAX_NAME}
      autoComplete="given-name"
      autoCapitalize="words"
      spellCheck={false}
      enterKeyHint="next"
      value={name ?? ""}
      onChange={(e) => onAnswer({ name: cleanName(e.target.value) })}
      onBlur={onSettleName}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || !name) return;
        e.preventDefault();
        onSettleName();
        onNext();
      }}
      placeholder={NAME_FIELD.placeholder}
      /* Picked, the field holds its focus edge (1px border plus a 1px
         inset), so a typed answer wears the same 2px terracotta edge as
         a chosen row whether or not the keyboard is up. */
      className={`${NAME_CLASS} font-display ${
        name
          ? `${PICKED_ROW} shadow-[inset_0_0_0_1px_var(--color-terracotta-500)]`
          : "border-edge bg-surface"
      }`}
    />
  );
}

/*
 * INPUT_CLASS at the answers' size: swapped rather than appended,
 * because two utilities for one property (min-h-11 and min-h-14, the
 * resting edge and the picked one) are settled by stylesheet order,
 * not by the order they are written in.
 */
const NAME_CLASS = INPUT_CLASS.replace("text-read", "text-detail")
  .replace("min-h-11", "min-h-14")
  .replace("border-edge bg-surface", "");

/** What you notice: checkboxes, three at most, each its own Tab stop. */
function Pains({
  pains,
  onAnswer,
}: {
  pains: readonly PainId[];
  onAnswer: (patch: Partial<Answers>) => void;
}) {
  const full = pains.length >= MAX_PAINS;
  return (
    <div role="group" aria-label="What you notice" className="flex flex-col gap-3">
      {PAINS.map((o) => {
        const on = pains.includes(o.id);
        return (
          <Row
            key={o.id}
            role="checkbox"
            on={on}
            disabled={!on && full}
            label={o.label}
            glyph={GLYPH[o.id]}
            trait={PAIN_TRAIT[o.id]}
            onPress={() =>
              onAnswer({ pains: on ? pains.filter((p) => p !== o.id) : [...pains, o.id] })
            }
          />
        );
      })}
    </div>
  );
}

/**
 * A single answer from a list (intro-a-5, intro-b-7): one Tab stop, the
 * arrow keys move the choice and the focus together, wrapping at the
 * ends, through the app's one radio hook.
 */
function OneOf({
  id,
  answers,
  onAnswer,
}: {
  id: "ageBand" | "goal" | "level" | "context";
  answers: Answers;
  onAnswer: (patch: Partial<Answers>) => void;
}) {
  const options: readonly { id: string; label: string }[] =
    id === "ageBand" ? AGE_BANDS : id === "goal" ? GOALS : id === "level" ? LEVELS : CONTEXTS;
  const value: string | null = answers[id];
  const pick = (v: string) => onAnswer({ [id]: v } as Partial<Answers>);
  const { getItemProps } = useRovingRadio({
    values: options.map((o) => o.id),
    value,
    onChange: pick,
  });
  return (
    <div
      role="radiogroup"
      aria-label={QUESTIONS.find((q) => q.id === id)!.title}
      className="flex flex-col gap-3"
    >
      {options.map((o, k) => (
        <Row
          key={o.id}
          role="radio"
          on={value === o.id}
          label={o.label}
          /* The age bands' label is the number, so they carry no glyph
             and line their figures up (intro-a-8). */
          glyph={id === "ageBand" ? undefined : GLYPH[o.id as keyof typeof GLYPH]}
          tabular={id === "ageBand"}
          tone={id === "level" ? QUESTION_TONES.level : ROW_TONES[k % ROW_TONES.length]}
          onPress={() => pick(o.id)}
          {...getItemProps(o.id, k)}
        />
      ))}
    </div>
  );
}

/**
 * The hour (intro-b-19): the word to scan on the left, and the time on
 * the right said the way this device says it ("6 pm", "18"), set after
 * mount so the server's render and the first client one agree. Its
 * accessible name is the two together.
 */
function Hours({
  value,
  onAnswer,
}: {
  value: Answers["time"];
  onAnswer: (patch: Partial<Answers>) => void;
}) {
  const hourLabel = useHourLabel();
  const pick = (v: (typeof TIMES)[number]["id"]) => onAnswer({ time: v });
  const { getItemProps } = useRovingRadio({
    values: TIMES.map((t) => t.id),
    value,
    onChange: pick,
  });
  return (
    <div
      role="radiogroup"
      aria-label={QUESTIONS.find((q) => q.id === "time")!.title}
      className="flex flex-col gap-3"
    >
      {TIMES.map((o, k) => {
        const word = o.label.split(", ")[0];
        const time = o.hour === null ? undefined : hourLabel(o.hour);
        return (
          <Row
            key={o.id}
            role="radio"
            on={value === o.id}
            label={time ? `${word}, ${time}` : word}
            word={word}
            detail={time}
            onPress={() => pick(o.id)}
            {...getItemProps(o.id, k)}
          />
        );
      })}
    </div>
  );
}

/**
 * One answer, as an object (#288, M20, Duolingo 13-question-list-dark):
 * a filled row on `surface` behind a 2px edge with the same edge at 4px
 * as its bottom lip, a bold label at the left, the glyph bare in its
 * ink. Never outlined and transparent (#218): `raised` is white on the
 * white ground in light, so the fill is `surface`. The edge and lip are
 * what tell an answer from the disabled Next, which is a flat grey slab
 * with no edge: grey without an edge means "not yet".
 *
 * A press presses it in: 0.985 (a row is wide, so it gives a third of a
 * button's 0.97), and the lip compresses as the row drops 2px. The row's
 * 56px is its min-height, so the thinner lip changes nothing round it and
 * no other row moves under the finger.
 *
 * `aria-label` carries the whole label, the hour's time included.
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
  trait,
  tabular = false,
  onPress,
  tabIndex,
  onKeyDown,
  ref,
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
  /** The glyph's ink, a picture tone (#300). */
  tone?: Tone;
  /** A trait's ink instead of a tone; null stands neutral. */
  trait?: TraitId | null;
  /** Figures in columns, for the age bands. */
  tabular?: boolean;
  onPress: () => void;
  /** From useRovingRadio, on the radio sets. */
  tabIndex?: 0 | -1;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  ref?: (el: HTMLElement | null) => void;
}) {
  const ink =
    disabled
      ? "text-stone-400"
      : trait === null
        ? "text-stone-500"
        : "text-[var(--tone-ink)]";
  return (
    <button
      ref={ref}
      type="button"
      role={role}
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onClick={onPress}
      className={`press font-display flex min-h-14 w-full items-center gap-3 rounded-control border-2 border-b-4 px-4 py-2 text-left text-detail font-bold transition-colors active:translate-y-0.5 active:border-b-2 active:[transform:scale(0.985)]! [[data-motion=reduce]_&]:active:[transform:none]! ${
        on ? PICKED_ROW : "border-edge bg-surface"
      } ${disabled ? "text-stone-400" : on ? "" : "text-ink"}`}
    >
      {glyph !== undefined && (
        <span
          aria-hidden
          data-trait={trait ?? undefined}
          className={`flex size-6 shrink-0 items-center justify-center ${
            trait === undefined ? `tone-${tone}` : ""
          } ${ink}`}
        >
          {glyph}
        </span>
      )}
      <span className={`min-w-0 flex-1 ${tabular ? "tabular-nums" : ""}`}>{word ?? label}</span>
      {detail && (
        <span aria-hidden className="font-body shrink-0 text-body font-normal tabular-nums text-stone-500">
          {detail}
        </span>
      )}
    </button>
  );
}

/**
 * The plan's month as numbered steps on a rail (the swipe-and-pop
 * round), landing one at a time. Each step is data (intro-b-12): a
 * short lead to count down, and the detail under it with every number
 * set as a number, because the numbers are what the product sells.
 */
function PlanSteps({ label, steps }: { label: string; steps: PlanStep[] }) {
  const tones: Tone[] = ["sun", "sky", "coral"];
  return (
    <div>
      {/* A3's request: a sentence-case head, not tracked capitals. */}
      <h2 className="detail-head">{label}</h2>
      <ol
        className="stagger relative mt-3 space-y-4"
        style={{ "--stagger-lead": "260ms" } as React.CSSProperties}
      >
        {steps.map((step, k) => (
          <li key={step.lead} className="relative flex items-start gap-3.5">
            {k < steps.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[13px] top-7 -bottom-4 w-0.5 bg-edge"
              />
            )}
            <span
              aria-hidden
              className={`plan-step-mark tone-${tones[k % tones.length]} font-display text-row font-extrabold tabular-nums`}
            >
              {k + 1}
            </span>
            <span className="min-w-0 pt-0.5 text-pretty">
              <span className="font-display block text-row">{step.lead}</span>
              <span className="mt-0.5 block text-body text-stone-500">
                <Numbers text={step.detail} />
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Every number in a line ("60", "130 to 160") set in the display face. */
function Numbers({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\d+(?: to \d+)?)/).map((part, k) =>
        k % 2 === 1 ? (
          /* nowrap: "130 to 160" is one number and never breaks. */
          <span key={k} className="font-display font-bold whitespace-nowrap tabular-nums text-ink">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}
