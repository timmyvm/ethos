"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { Tone } from "@/components/DemosArt";
import { IconBack, IconChevron } from "@/components/Icon";
import { Says, SaysGhost } from "@/components/Says";
import { SpeechBubble } from "@/components/SpeechBubble";
import { TipStrip } from "@/components/rep/TipStrip";
import { FooterShelf } from "@/components/ui/FooterShelf";
import type { TraitId } from "@/content/traits";
import {
  SPRING,
  animateSpring,
  project,
  rubberband,
  springEasing,
  springMs,
  springProgress,
} from "@/lib/spring";
import { ACTION_CLASS, DISABLED_CLASS } from "@/lib/ui";

/*
 * The speed a swipe left the last screen with, for the screen it brings
 * in (the apple-design skill, §5). The old page and the new one are
 * different elements, so the hand-off goes through here: the leaving
 * page writes it as it commits, the arriving page reads it on mount and
 * starts moving at that speed instead of from rest. Stale after half a
 * second, so an arrow key or a tap never inherits an old flick.
 */
let handoff: { v: number; at: number } | null = null;

/**
 * The one shape every explanation screen takes (docs/voice.md, Part 2).
 *
 *   TITLE                    2 to 4 words, the instruction
 *   One line of what it is.  one sentence, and no second sentence
 *
 *   How to do this
 *   1  tactic
 *   2  tactic
 *   3  tactic
 *
 *   [ACTION]
 *
 *   fine print
 *
 * There is no `description` prop and no `children`, on purpose. The
 * component is INCAPABLE of rendering a paragraph, which is the only
 * reliable way to stop one appearing: a screen that can hold prose
 * eventually holds prose, and the reason the old screens were skipped
 * is that they held three of them each. Longer theory has exactly one
 * home, the `why` disclosure, and it starts closed every single time.
 *
 * Three type levels on any one screen (globals.css, #208/#212), and
 * `lead` decides WHICH block is the hero. On the floor and in
 * onboarding the screen name is the instruction, so it takes
 * `text-title`. On a lesson screen it isn't — nobody opens the app to
 * find out this one is called The baseline — so the tactics lead as
 * tiles and the name steps down to `text-detail` (17/700, M19) above
 * them. Either way, strip the colour and blur it and the hero is still
 * the biggest mass on the screen.
 *
 * The line is `text-read` in stone-800 (M18): a sentence someone is
 * meant to read is set at reading size in near-ink, and only the note
 * stays a caption. "How to do this" is a sentence-case `.detail-head`
 * h2 and the eyebrow a sentence-case `.eyebrow` (M05, practice-detail-18).
 */

/** A destination renders a real link; a handler renders a button. */
export type LessonAction = { label: string } & (
  | { href: string; onPress?: never; disabled?: never }
  | { onPress: () => void; href?: never; disabled?: boolean }
);

export interface LessonBodyProps {
  /** The line over the title, `.eyebrow` (sentence case 13/600): the
   *  unit, or "Today's lesson". */
  eyebrow?: string;
  /** 2 to 4 words. The name of the thing. */
  title: string;
  /** ONE sentence of what this is. */
  line?: string;
  /**
   * Demos answering the thing you just did (#249), in the line's slot.
   *
   * It REPLACES `line` rather than joining it, because a question's
   * description and its answer are the same sentence at two moments,
   * and stacking them leaves the question explaining itself after it
   * has been answered. Full ink rather than the line's stone, since it
   * is the newest thing on the screen, and keyed so a different answer
   * arrives rather than swaps: the whole screen must NOT re-animate on
   * a tap, so this one paragraph carries its own entrance.
   */
  reply?: string;
  /** Tactics, 2 to 3. The technique, not encouragement. */
  howTo?: string[];
  /**
   * Which block is the hero (#212).
   *
   * "title" on the floor and in onboarding, where the screen NAME is
   * the instruction. "howTo" on a lesson screen, where it isn't: you
   * are not there to learn that this one is called The baseline, you
   * are there to do it, so the tactics take the ink and the name steps
   * back to a label above them.
   */
  lead?: "title" | "howTo";
  /** The how-to block's h2 (`.detail-head`). Defaults to voice.md's own
   *  label, "How to do this". */
  howToLabel?: string;
  /**
   * "Why this works" — collapsed theory. Renders nothing at all when
   * nothing is passed, so an empty disclosure can never sit on a screen
   * advertising that it has nothing to say.
   */
  why?: ReactNode;
  /** A caption under the title block: the reason, carrying its number. */
  note?: string;
  /**
   * The tactics land one at a time instead of all at once (#249).
   *
   * Opt-in rather than always, because these lists sit inside a block
   * that is often arriving itself, and two clocks on one list is a
   * collision. Where it IS set, the ladder is held back by the parent's
   * own duration (`--stagger-lead`) so the block lands first and the
   * lines land after it: the shape a result is supposed to have.
   */
  ladder?: boolean;
  /**
   * Centre the text block. The floor's card takes it (#212, Timothy's
   * call): that card is one announcement over one button, and a
   * left-ragged stack above a full-width tap reads as the top of a list
   * rather than as the thing you came to press. Only the head (eyebrow,
   * title, line, note) centres; the how-to block stays left at full
   * width (M19).
   */
  align?: "left" | "center";
  /**
   * The eyebrow wears the screen's trait ink (practice-detail-6).
   * LessonScreen sets it whenever it has a `trait`, so a page no longer
   * reaches the eyebrow through a wrapper.
   */
  toneEyebrow?: boolean;
}

/**
 * The template's text block, on its own.
 *
 * Two screens in the app are not ONLY an explanation — the floor (which
 * also carries the score and the road) and the recording screen (whose
 * phases share one `<main>` because the self-view `<video>` has to stay
 * mounted from the Record tap through to the first pose frame). Both
 * compose this directly rather than nesting a second `<main>`; the
 * template, and the ban on prose, is identical either way.
 */
export function LessonBody({
  eyebrow,
  title,
  line,
  reply,
  howTo,
  howToLabel = "How to do this",
  why,
  note,
  ladder = false,
  lead = "title",
  align = "left",
  toneEyebrow = false,
}: LessonBodyProps) {
  const tactics = howTo?.length ? howTo : null;
  /* The hero only moves when there is something to move it to: a
     lesson screen mid-recording has no tactics, and a name shrunk in
     favour of nothing is just a smaller name. */
  const howToLeads = lead === "howTo" && tactics !== null;
  const centred = align === "center";

  return (
    <div>
      {/* Under `align="center"` only the head is centred: the how-to
          block below stays left at full width, because a list read down
          a ragged centre line is harder to read than one with an edge. */}
      <div className={centred ? "text-center" : undefined}>
        {/* M05: sentence case at reading size, not tracked capitals. */}
        {eyebrow && <div className={`eyebrow ${toneEyebrow ? "tone-ink" : ""}`}>{eyebrow}</div>}

        {/* M19: where the tactics lead (#212, Timothy), the name rises
            only to the detail step (Outfit 17/700), never to the title,
            4px under its eyebrow. */}
        <h1
          className={`font-display mt-1 text-balance ${howToLeads ? "text-detail" : "text-title"}`}
        >
          {title}
        </h1>

        {/* M18: a line meant to be read is set to be read, Figtree 16 on
            1.45 in near-ink, and never ends on one word. */}
        {reply ? (
          <p key={reply} className={`arrive mt-2 text-read text-pretty ${centred ? "mx-auto" : ""}`}>
            {reply}
          </p>
        ) : (
          line && (
            <p
              className={`mt-2 text-read text-stone-800 text-pretty ${centred ? "mx-auto" : ""}`}
            >
              {line}
            </p>
          )
        )}

        {note && <p className="mt-1.5 text-caption text-stone-400">{note}</p>}
      </div>

      {tactics && (
        <div className={`${howToLeads ? "mt-7" : "mt-6"} ${centred ? "text-left" : ""}`}>
          {/* practice-detail-18, M05: a real heading, so the tiles under
              it can be reached by heading, in sentence case. */}
          <h2 className="detail-head">{howToLabel}</h2>
          {howToLeads ? (
            /*
             * The hero block, as tiles (feedback round, 25 Sep). Three
             * numbered sentences at lead size were the thing a
             * first-time user said she would not read. Each tactic is
             * now a glyph and at most five words (lib/tip-labels.ts),
             * and its sentence opens on a tap, so the substance stays
             * one tap away and the screen reads by looking.
             */
            <TipStrip tips={tactics} label={null} ladder={ladder} className="mt-3" />
          ) : (
            /*
             * The same grammar one size down, not a different one
             * (#249). This branch used to be a `·` bullet list, and the
             * plan screen is its only caller: three lines that are a
             * SEQUENCE — day one, then the first number, then the unit
             * — read as a sequence when they are counted and as a heap
             * when they are dotted. So the ordered column stays and
             * only the type size steps back.
             */
            <ol
              className={`mt-3 space-y-3 ${ladder ? "stagger" : ""}`}
              style={ladder ? { "--stagger-lead": "260ms" } as React.CSSProperties : undefined}
            >
              {tactics.map((tactic, i) => (
                <li key={tactic} className="flex gap-3.5 text-body">
                  <span
                    aria-hidden
                    className="font-display w-4 shrink-0 text-caption font-extrabold text-sage-700 tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">{tactic}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className={centred ? "text-left" : undefined}>
        <WhyThisWorks>{why}</WhyThisWorks>
      </div>
    </div>
  );
}

export function LessonScreen({
  action,
  fineprint,
  art,
  aside,
  controls,
  footer,
  header,
  center = false,
  stepKey,
  onBack,
  fill = false,
  speech,
  stage,
  swipe,
  travel = "next",
  trait,
  replies,
  announce,
  ...body
}: LessonBodyProps & {
  /**
   * Every reply this question can give (B12): held in the bubble as
   * ghosts, so it is the width and height of the widest from the first
   * frame and its edge does not jump when a short question is replaced
   * by a longer reply.
   */
  replies?: string[];
  /**
   * What the beside bubble's live region announces (intro-a-4). Defaults
   * to `reply`; the name question passes the SETTLED name's reply, so a
   * screen reader hears it once the field is finished, not per keystroke.
   */
  announce?: string;
  /**
   * The trait this screen is about (practice-detail-6). Sets
   * `data-trait` on <main>, so everything on the screen can wear that
   * trait's tone (`--tone`, `--tone-wash`, `--tone-ink`, and
   * `--tone-stage` for a `fill` stage) without each block naming it.
   */
  trait?: TraitId;
  /**
   * Which way the walk just moved, so a swiped screen arrives from the
   * side it came from: forward from the right, back from the left.
   */
  travel?: "next" | "back";
  /**
   * A coloured room for Demos and his bubble (the swipe-and-pop round):
   * with `speech="above"`, the bubble and the art stand together on a
   * panel in this tone and the panel takes the screen's free height.
   */
  stage?: Tone;
  /**
   * The walk is a carousel (the swipe-and-pop round): drag left for
   * `next`, right for `back`, and the arrow keys do the same. A side
   * with no handler rubber-bands, which is how a question with no
   * answer refuses a swipe exactly as its Next refuses a tap. The
   * screen follows the finger (transform only), commits past a quarter
   * of the width or on a flick, and springs back otherwise. Drags that
   * start in a text field are never taken, a vertical drag is left to
   * the page, and reduced motion steps without the follow.
   */
  swipe?: { next?: () => void; back?: () => void };
  /**
   * The mascot says the title and the line, from a bubble with a tail
   * on him, instead of the template printing them (#288).
   *
   * "above": the bubble over his head, both centred, for a screen that
   * is one line and one button. "beside": his head at the left and the
   * bubble to its right, for a question with its answers under it. The
   * strings are the same `title`, `line` and `reply`; only who is seen
   * to say them changes. A reply REPLACES the question in the bubble,
   * which is the reference's own move and what keeps a bubble beside
   * six answers from growing into a paragraph.
   */
  speech?: "above" | "beside";
  /** The one terracotta tap (brand.md: exactly one per screen). */
  action: LessonAction;
  /** Bottom, small, muted. */
  fineprint?: string;
  /** Above the title. An image, never text. */
  art?: ReactNode;
  /**
   * Furniture that belongs to this screen and nothing else: pagination
   * dots, a mode toggle, a data cue. Sits directly above the action,
   * where a control the tap depends on can be seen without leaving the
   * button. Not prose.
   */
  aside?: ReactNode;
  /**
   * The answers to the question above: rows you tap, a field you type
   * in. Interactive, never prose (#249).
   *
   * Distinct from `aside` because it is CONTENT, and content belongs in
   * the flow under the line that introduced it. Putting a question's
   * answers in the bottom-anchored slot left a variable gap between the
   * question and the thing that answers it, which is the one place on a
   * screen a gap must never be; anchored here, the slack falls at the
   * bottom above the button, where nobody reads it as a missing piece.
   */
  controls?: ReactNode;
  /** Below the action: the secondary door (skip, sign in). Not prose. */
  footer?: ReactNode;
  /**
   * On the back row, at the very top: where you are in a walk (#249).
   *
   * It cannot live in `aside`, which is anchored above the action, or a
   * progress bar rides up and down with the height of whatever sits
   * under it — across seven questions that is the one element that must
   * not move, because it is the whole answer to "how much of this is
   * left". Top-anchored beside the way out is Duolingo's own shape and
   * the reason it works: both of a walk's exits in one row.
   */
  header?: ReactNode;
  /**
   * Centre the block in the space above the action.
   *
   * For a screen with no how-to list — onboarding is the only one — the
   * content is two short lines, and left at the top of a phone they sit
   * above half a screen of nothing with the artwork stranded in it. The
   * hierarchy is identical either way; this is where the block sits, not
   * what it weighs.
   */
  center?: boolean;
  /**
   * For a screen that walks steps (the welcome carousel): the step's
   * identity. When it changes, the art and text come in from the
   * direction of travel (DECISIONS #223) instead of swapping in place.
   */
  stepKey?: string | number;
  /** A walk's way back one step. Renders the rep screen's back link. */
  onBack?: () => void;
  /**
   * The art takes the screen's free height (R3, principle 7: no empty
   * band over 64px at 390x844). Opt-in, for the one-thing screens that
   * are an object, a name and a tap: the trait page and the unit intro.
   *
   * The `art` stands on a stage in the screen's trait tone that runs
   * from the top edge (under the back row) down to the words, its foot
   * a shallow arc of the ground rising into it (Wellspoken 03-course's
   * hero, Imprint 02-lesson-sheet's art over a plain sheet). The words
   * sit under it and the tap is docked at the foot in `FooterShelf`, so
   * the slack goes into the stage instead of pooling in two bands round
   * a small block. The art is laid out in a size container, so it can
   * scale with the room it is given (`cqh`, `cqmin`).
   *
   * The stage stays put across a walk's steps (`stepKey`): only the
   * words arrive, and when a step's words need more or less room the
   * stage's foot and its art travel to their new size on the base
   * spring instead of cutting.
   */
  fill?: boolean;
}) {
  const slide = useRef<HTMLDivElement>(null);
  const gestured = useRef(false);
  const drag = useSwipe(swipe, slide, gestured);
  const arrival = travel === "back" ? "step-in-back" : "step-in-next";
  /*
   * Whether THIS step arrived by a swipe or an arrow key, bound on the
   * first render with the new key. A gesture is a carousel, and a
   * carousel's next page brings its content with it: the words land as
   * the page does instead of waiting for the slide (globals.css,
   * `[data-arrival="gesture"]`). A tap on Next keeps the said-then-moves
   * order of #288.
   */
  const arrived = useRef<{ key: typeof stepKey; gesture: boolean }>({
    key: stepKey,
    gesture: false,
  });
  if (arrived.current.key !== stepKey) {
    arrived.current = { key: stepKey, gesture: gestured.current };
    gestured.current = false;
  }
  /*
   * A page a swipe brought in continues the swipe: it takes over the
   * keyframe's start (30% in from the far side) but moves off it at the
   * finger's speed on the sheet spring, so leaving and arriving read as
   * one throw rather than a stop and a start.
   */
  useLayoutEffect(() => {
    const el = slide.current;
    const h = handoff;
    handoff = null;
    if (!el || !h || !arrived.current.gesture) return;
    if (performance.now() - h.at > 500) return;
    if (document.documentElement.dataset.motion === "reduce") return;
    el.getAnimations().forEach((a) => a.cancel());
    const from = -Math.sign(h.v) * el.clientWidth * 0.3;
    // A hard flick would overshoot the landing by more than a hair;
    // past this it is fast enough to read as the same throw.
    const v = Math.sign(h.v) * Math.min(Math.abs(h.v), 1600);
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 160,
      easing: "ease-out",
    });
    void animateSpring(el, { axis: "x", from, to: 0, velocity: v, spring: SPRING.sheet }).then(
      () => {
        el.style.transform = "";
      }
    );
  }, [stepKey]);
  /* A walk compacts its chrome on a short phone (under 740px tall), so
     the one tap and the door under it stay above the fold. Screens that
     do not swipe keep the template's spacing. (The top row already sits
     where the bar does, so the top has nothing left to give.) */
  const short = swipe
    ? {
        stage: "[@media(max-height:740px)]:mt-2",
        body: "[@media(max-height:740px)]:pb-0",
        foot: "[@media(max-height:740px)]:pb-[max(8px,env(safe-area-inset-bottom))]",
      }
    : { stage: "", body: "", foot: "" };

  const tap =
    action.href !== undefined ? (
      <Link href={action.href} className={ACTION_CLASS}>
        {action.label}
      </Link>
    ) : (
      <button
        type="button"
        onClick={action.onPress}
        disabled={action.disabled}
        className={`${ACTION_CLASS} ${DISABLED_CLASS}`}
      >
        {action.label}
      </button>
    );

  if (fill) {
    return (
      <StageScreen
        trait={trait}
        onBack={onBack}
        art={art}
        stepKey={stepKey}
        controls={controls}
        /* The walk's shelf grammar (B12): what sits over the tap grows
           the shelf upward, so the tap lands at one y on every step
           whether or not the step has fine print. */
        foot={
          <>
            {aside && <div className="mb-3">{aside}</div>}
            {fineprint && (
              <p className="mb-3 text-center text-caption text-stone-400">{fineprint}</p>
            )}
            {tap}
            {footer}
          </>
        }
        words={<LessonBody {...body} toneEyebrow={trait !== undefined} />}
      />
    );
  }

  return (
    <main
      data-trait={trait}
      className={`flex min-h-dvh flex-col px-5 ${
        onBack || header || swipe ? "pt-[env(safe-area-inset-top)]" : "pt-7"
      } ${swipe ? "touch-pan-y" : "pb-safe"}`}
      {...drag}
    >
      {/* A carousel keeps the row even where it is empty (the first
          page has no way back), so the stage does not jump 44px down
          when the second page slides in. The row stands where the
          header's bar does, so Back sits at one x and one y app-wide. */}
      {(onBack || header || swipe) && (
        <div className="flex min-h-11 items-center gap-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="screen-bar-back press -ml-3 shrink-0"
            >
              <IconBack size={22} />
              <span>Back</span>
            </button>
          )}
          {header && <div className="min-w-0 flex-1">{header}</div>}
        </div>
      )}
      <div
        className={`flex flex-1 flex-col ${center && !stage ? "justify-center" : ""} ${
          swipe ? `pb-4 ${short.body}` : ""
        }`}
      >
        {/* A flex column like its parent, so the art and the text block
            stay flex items (the art centres with `mx-auto`) whether or
            not the wrapper is animating. */}
        <div
          key={stepKey}
          ref={slide}
          data-arrival={arrived.current.gesture ? "gesture" : undefined}
          className={`flex flex-col ${stage ? `mt-4 min-h-0 flex-1 ${short.stage}` : ""} ${
            stepKey === undefined ? "" : swipe ? arrival : "arrive-x"
          }`}
        >
          {speech ? (
            <DemosSpeech
              mode={speech}
              art={art}
              stage={stage}
              title={body.title}
              line={body.line}
              reply={body.reply}
              replies={replies}
              announce={announce}
            />
          ) : (
            <>
              {art}
              <LessonBody {...body} toneEyebrow={trait !== undefined} />
            </>
          )}
          {controls && <div className="mt-7">{controls}</div>}
        </div>
      </div>

      {swipe ? (
        /*
         * intro-b-3, intro-a-23 (M20, Duolingo 13-question-list-dark): a
         * walk's tap stands on the shared shelf at the foot of the
         * screen, so it is docked rather than floating under a band of
         * blank, and it lands at ONE height on every page. What sits
         * over it (the pager, an error, the fine print) grows the shelf
         * upward; what sits under it is one 56px slot (`flow-root`
         * keeps a door's mt-3 inside it) only where there IS a door: the
         * intro screens and the account ask. The seven questions, the
         * beat and the plan have none, so Next sits at the foot as the
         * reference's Continue does (B12), at one y across all nine. The
         * hairline only where answers sit above it: on a stage it would
         * be a stray rule.
         */
        <FooterShelf
          hairline={controls !== undefined && speech === "beside"}
          className={short.foot}
        >
          {aside && <div className="mb-3">{aside}</div>}
          {fineprint && (
            <p className="mb-3 text-center text-caption text-stone-400">{fineprint}</p>
          )}
          {tap}
          {footer !== undefined && <div className="flow-root min-h-14">{footer}</div>}
        </FooterShelf>
      ) : (
        <div className="mt-8 pb-6">
          {aside && <div className="mb-5">{aside}</div>}

          {tap}

          {fineprint && (
            <p className="mt-3 text-center text-caption text-stone-400">
              {fineprint}
            </p>
          )}

          {footer}
        </div>
      )}
    </main>
  );
}

/**
 * LessonScreen's `fill` layout (R3): the stage takes the free height,
 * the words sit under it, the tap is docked at the foot.
 *
 *   ┌ back ───────────────────┐  the trait's stage, from the top edge
 *   │          (art)          │  flex-1: every spare pixel lands here
 *   └────────╮ arc ╭──────────┘  the ground rising into it
 *     eyebrow, title, line        keyed on the step, so only these arrive
 *     how-to, controls
 *   [ tap ]  fine print           FooterShelf, at one y on every step
 */
function StageScreen({
  trait,
  onBack,
  art,
  stepKey,
  controls,
  foot,
  words,
}: {
  trait?: TraitId;
  onBack?: () => void;
  art?: ReactNode;
  stepKey?: string | number;
  controls?: ReactNode;
  foot: ReactNode;
  /** The template's own text block (LessonBody), never free text: the
   *  no-prose rule holds here too. */
  words: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const ground = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLDivElement>(null);
  /* Where the stage's foot and its art were laid out at the last
     commit, in document coordinates, transforms aside. */
  const seen = useRef<{ key: typeof stepKey; foot: number; x: number; y: number; w: number } | null>(
    null
  );
  /*
   * A new step's words can need more room or less, so the stage is a
   * different height on each step. The layout lands at once (the words
   * arrive into their final place); the stage's foot and the art are
   * drawn from where they were and travel to where they are now on the
   * base spring (FLIP, transform only), so the room breathes between
   * steps rather than jumping. Reduced motion lands at once.
   */
  useLayoutEffect(() => {
    const b = box.current;
    const g = ground.current;
    const f = figure.current;
    if (!b || !g || !f) return;
    const layer = (f.offsetParent ?? b).getBoundingClientRect();
    const now = {
      key: stepKey,
      foot: b.getBoundingClientRect().bottom + window.scrollY,
      x: layer.left + f.offsetLeft,
      y: layer.top + window.scrollY + f.offsetTop,
      w: f.offsetWidth,
    };
    const was = seen.current;
    seen.current = now;
    if (!was || was.key === now.key) return;
    if (document.documentElement.dataset.motion === "reduce") return;
    const timing = { duration: springMs(SPRING.base), easing: springEasing(SPRING.base) };
    const d = was.foot - now.foot;
    if (Math.abs(d) >= 1) {
      g.animate([{ transform: `translateY(${d}px)` }, { transform: "none" }], timing);
    }
    if (was.w > 0 && now.w > 0) {
      const k = was.w / now.w;
      const dx = was.x - now.x;
      const dy = was.y - now.y;
      if (Math.abs(k - 1) > 0.01 || Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
        f.animate(
          [
            { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${k})` },
            { transformOrigin: "0 0", transform: "none" },
          ],
          timing
        );
      }
    }
  });

  return (
    <main data-trait={trait} className="flex min-h-dvh flex-col px-5">
      <div
        ref={box}
        className="relative -mx-5 flex min-h-[260px] flex-1 flex-col px-5 pt-[env(safe-area-inset-top)]"
      >
        {/* The stage's ground. Unclipped above the document's top (and
            tall enough there to travel), so under a status bar the stage
            simply carries on. Outside a trait it is the neutral surface. */}
        <div
          ref={ground}
          aria-hidden
          className="absolute inset-x-0 bottom-0 -top-96 bg-[var(--tone-stage,var(--color-surface))]"
        >
          <div className="absolute inset-x-0 -bottom-px h-6 rounded-[50%_50%_0_0/100%_100%_0_0] bg-ground" />
        </div>
        {onBack && (
          <div className="relative flex min-h-11 items-center">
            <button
              type="button"
              onClick={onBack}
              className="screen-bar-back press -ml-3 shrink-0"
            >
              <IconBack size={22} />
              <span>Back</span>
            </button>
          </div>
        )}
        <div className="relative min-h-0 flex-1">
          {/* A size container over the grown slot (the `.demos-fit`
              pattern: cq units read 0 in a container whose height comes
              from flex-grow, so the container is an absolute layer with
              a definite size). The art reads `cqh` and `cqmin`. */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pb-6 [container-type:size]">
            <div ref={figure} className="flex flex-col items-center">
              {art}
            </div>
          </div>
        </div>
      </div>
      {/* Positioned, so the words paint over the stage's foot while it
          travels under them. */}
      <div
        key={stepKey}
        className={`relative mt-5 pb-4 ${stepKey === undefined ? "" : "arrive-x"}`}
      >
        {words}
        {controls && <div className="mt-6">{controls}</div>}
      </div>
      <FooterShelf hairline={false}>{foot}</FooterShelf>
    </main>
  );
}

/**
 * Demos speaking (#288). The words wait for the screen's own slide
 * (`arrive-x`, 200ms) so two entrances never run at once, then land a
 * word at a time; a reply swapped into a bubble already on screen
 * starts at once. The `key` on each line is what replays the landing
 * when the text changes.
 *
 * The question stays in the document as a hidden heading while a reply
 * is showing, so the screen's name never changes under a screen reader
 * while what is SEEN is what he just said. What he says back is HEARD
 * through one live region that is always mounted beside the bubble
 * (intro-a-4, intro-b-6): a region inserted together with its words is
 * often never announced. The visible reply is `aria-hidden`, so browse
 * mode meets it once, in the region.
 */
function DemosSpeech({
  mode,
  art,
  stage,
  title,
  line,
  reply,
  replies,
  announce,
}: {
  mode: "above" | "beside";
  art?: ReactNode;
  stage?: Tone;
  title: string;
  line?: string;
  reply?: string;
  replies?: string[];
  announce?: string;
}) {
  const lead = reply ? 0 : 200;
  const live = mode === "beside";
  /* B12: every other reply this question can give, as ghosts in the same
     cell at no height, so the bubble rests at the widest from the first
     frame and only its height answers the line being said (the coin
     holds the rows, intro-a-1). */
  const held = (replies ?? []).filter((r) => r !== reply);
  /* The second line is quieter than his voice: body size in stone. */
  const lineClass = "mt-1 text-body text-stone-500 text-pretty";
  /*
   * intro-a-1: the question and the reply share ONE grid cell, so the
   * bubble is as tall as the taller of the two and the answers under it
   * stay where the finger left them when his reply replaces the
   * question. The one not showing is a ghost (SaysGhost: its words drawn
   * by CSS from `data-text`, never in the DOM), and there is exactly one
   * h1 in <main> at a time: the question as he says it, or the question
   * kept for a screen reader while the reply shows. A reply shorter than
   * the question it replaces sits in the middle of the held height, so
   * the space reads as the bubble's, not as a line gone missing.
   */
  const ghosts = held.map((r) => (
    <SaysGhost key={r} text={r} className="h-0 overflow-hidden text-balance [grid-area:1/1]" />
  ));
  const words = reply ? (
    <div className="grid">
      {ghosts}
      <div aria-hidden className="[grid-area:1/1]">
        <SaysGhost text={title} className="text-balance" />
        {line && <SaysGhost text={line} className={lineClass} />}
      </div>
      <Says
        key={reply}
        text={reply}
        lead={lead}
        ariaHidden={live}
        className="self-center text-balance [grid-area:1/1]"
      />
      <h1 className="sr-only">{title}</h1>
    </div>
  ) : (
    <div className="grid">
      {ghosts}
      <div className="[grid-area:1/1]">
        <Says key={title} as="h1" text={title} lead={lead} className="text-balance" />
        {line && <Says key={line} text={line} lead={lead + 120} className={lineClass} />}
      </div>
    </div>
  );

  if (mode === "above" && stage) {
    /* The stage: his bubble at the top of a coloured room, and him
       standing on its floor, as big as the room allows. The room takes
       the screen's free height and no more, and he takes the room's
       (`.demos-fit` is a size container his `fit` reads), so a short
       phone gets a smaller Demos rather than a tap below the fold.
       intro-a-15: the bubble is the stage's full 320px on every page,
       so a swipe never shows it change width under a still room. */
    return (
      <div
        className={`intro-stage tone-${stage} flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-5 pt-5`}
      >
        <SpeechBubble
          tail="down"
          voice="lead"
          className="intro-stage-bubble w-full max-w-[320px] shrink-0 text-center"
        >
          {words}
        </SpeechBubble>
        <div className="demos-fit mt-4 w-full flex-1">
          <div className="demos-fit-room">{art}</div>
        </div>
      </div>
    );
  }
  if (mode === "above") {
    return (
      <>
        <SpeechBubble tail="down" className="max-w-[330px] self-center text-center">
          {words}
        </SpeechBubble>
        <div className="mt-6">{art}</div>
      </>
    );
  }
  /* intro-a-24: the bubble hugs its line (no flex-1), as the
     reference's does, and the grid above keeps it the width of the
     wider of question and reply. */
  return (
    <div className="mt-6 flex items-start gap-3">
      <div className="shrink-0">{art}</div>
      <SpeechBubble tail="left" voice="lead" className="min-w-0">
        {words}
      </SpeechBubble>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {(announce === undefined ? reply : announce) ?? ""}
      </p>
    </div>
  );
}

/**
 * The theory slot.
 *
 * Closed on mount, always, and deliberately not remembered: an open
 * disclosure restored from storage puts the paragraph back on the
 * screen we just cleared, for the one person who once tapped it. The
 * state lives in `useState` and dies with the screen, which is the
 * whole specification.
 */
function WhyThisWorks({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!children) return null;

  return (
    <div className="mt-6 border-y border-hairline">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="press flex min-h-11 w-full items-center justify-between py-2 text-left"
      >
        <span className="label-data">Why this works</span>
        <span
          aria-hidden
          data-open={open}
          className="disclosure-mark text-stone-400"
        >
          <IconChevron size={18} />
        </span>
      </button>
      {/* The theory drops out of the row that opened it (#227). */}
      {open && (
        <div className="reveal pb-3 text-body text-stone-600">{children}</div>
      )}
    </div>
  );
}

/**
 * The carousel gesture (the swipe-and-pop round), on pointer events so
 * a finger, a pen and a mouse all drag the same way.
 *
 * The page keeps `touch-action: pan-y`, so the browser still owns
 * vertical scrolling and hands us only the horizontal. The first 8px
 * decide the axis; a vertical start is abandoned on the spot, so a
 * scroll is never hijacked. A drag that starts in a text field is
 * never taken (the name field keeps its caret and selection). A tap
 * never moves 8px, so it is untouched; a horizontal drag that began on
 * an answer swallows the click it would otherwise end in, so a swipe
 * never picks an answer on its way past.
 *
 * Everything moves by transform, written straight to the element, not
 * through React: a render per pointer event is how a drag stutters.
 */
function useSwipe(
  swipe: { next?: () => void; back?: () => void } | undefined,
  slide: RefObject<HTMLDivElement | null>,
  /** Set just before a gesture steps, so the next page knows it was one. */
  gestured: RefObject<boolean>
) {
  const handlers = useRef(swipe);
  useEffect(() => {
    handlers.current = swipe;
  });
  const g = useRef<{
    id: number;
    x0: number;
    y0: number;
    w: number;
    lock: "x" | "y" | null;
    dx: number;
    /** Where the page is drawn: `dx`, or less past a refused edge. */
    shown: number;
    trail: { t: number; x: number }[];
  } | null>(null);
  const leaving = useRef(false);
  /* Marks the step about to happen as a gesture's. Lapses on its own if
     no new step renders (a handler that navigated away), so a later tap
     is never mistaken for one. */
  const markGesture = () => {
    gestured.current = true;
    setTimeout(() => {
      gestured.current = false;
    }, 150);
  };

  /* The arrow keys are the desktop's swipe. Not while typing: in the
     name field the arrows move the caret. */
  useEffect(() => {
    if (!swipe) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable]")) return;
      /* Nor inside a set of answers or the pager: there the arrows are
         the standard way to move between the options, and a keyboard or
         screen-reader user must not be carried to another screen. */
      if (t?.closest("[role=radiogroup], [role=group], [role=radio], [role=checkbox]")) return;
      const h = handlers.current;
      if (e.key === "ArrowRight" && h?.next) {
        e.preventDefault();
        markGesture();
        h.next();
      } else if (e.key === "ArrowLeft" && h?.back) {
        e.preventDefault();
        markGesture();
        h.back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [swipe === undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!swipe) return {};

  const reduced = () => document.documentElement.dataset.motion === "reduce";
  const paint = (x: number, w: number) => {
    const el = slide.current;
    if (!el || reduced()) return;
    el.style.transition = "none";
    el.style.transform = `translate3d(${x}px,0,0)`;
    el.style.opacity = String(1 - Math.min(Math.abs(x) / w, 1) * 0.5);
  };
  /** Home from wherever it was let go, at the speed it was going (§5):
   *  a slow release settles, a thrown one earns the small overshoot. */
  const settle = (from: number, velocity: number) => {
    const el = slide.current;
    if (!el) return;
    el.style.transition = "opacity var(--duration-base) var(--ease-out)";
    el.style.opacity = "1";
    void animateSpring(el, {
      axis: "x",
      from,
      to: 0,
      velocity,
      spring: Math.abs(velocity) > 600 ? SPRING.thrown : SPRING.base,
    }).then(() => {
      if (g.current) return; // grabbed again mid-flight: the finger owns it
      el.style.transition = "";
      el.style.transform = "";
      el.style.opacity = "";
    });
  };
  /* Past the end the screen gives a little and no more: the shared
     rubber band (§9), so a refused swipe still feels like the screen
     heard the finger, resisting harder the further it is pulled. */
  const band = (dx: number, w: number) => rubberband(dx, w * 0.4);
  /* Eats the one click a drag can end in, and nothing after it: the
     guard disarms on the next pointerdown, so a swipe that ended in no
     click (a moved touch) never swallows the real tap that follows. */
  const swallowClick = () => {
    const disarm = () => {
      window.removeEventListener("click", stop, { capture: true });
      window.removeEventListener("pointerdown", disarm, { capture: true });
      clearTimeout(timer);
    };
    const stop = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      disarm();
    };
    window.addEventListener("click", stop, { capture: true });
    window.addEventListener("pointerdown", disarm, { capture: true });
    const timer = setTimeout(disarm, 350);
  };

  const end = (e: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    const s = g.current;
    g.current = null;
    if (!s || s.id !== e.pointerId || s.lock !== "x") return;
    e.currentTarget.style.userSelect = "";
    if (Math.abs(s.dx) > 8) swallowClick();
    const h = handlers.current;
    const go = s.dx < 0 ? h?.next : h?.back;
    const recent = s.trail.filter((p) => p.t > performance.now() - 120);
    const first = recent[0] ?? s.trail[0];
    const last = s.trail[s.trail.length - 1];
    /** px/s, from the end of the drag rather than its average. */
    const v = last.t > first.t ? ((last.x - first.x) / (last.t - first.t)) * 1000 : 0;
    /*
     * Go or stay by where the throw would come to REST (§6): a short
     * quick flick carries the page past the halfway line and goes; a
     * long slow haul that stops short stays. A quarter of the width
     * dragged still counts on its own, and a flick back the other way
     * cancels whatever the position.
     */
    const reversing = Math.sign(v) === -Math.sign(s.dx) && Math.abs(v) > 150;
    const carried = Math.abs(s.dx + project(v)) > s.w * 0.5 && Math.sign(v) === Math.sign(s.dx);
    const commit =
      !cancelled && go !== undefined && !reversing && (Math.abs(s.dx) > s.w * 0.25 || carried);
    if (!commit) {
      if (!reduced()) settle(s.shown, v);
      return;
    }
    const el = slide.current;
    if (!el || reduced()) {
      markGesture();
      go();
      return;
    }
    /* Carry the page off the edge it was dragged toward at the speed it
       was going, and hand that speed to the page coming in. The step
       happens once the old page is most of the way out, which a fast
       flick reaches sooner: the throw sets the tempo, not a timer. */
    leaving.current = true;
    const to = Math.sign(s.dx) * s.w;
    const rel = v / (to - s.dx || 1);
    let out = 0;
    while (out < 0.3 && springProgress(SPRING.base, out, rel) < 0.6) out += 1 / 120;
    const stepAt = Math.max(70, Math.min(220, out * 1000));
    el.style.transition = `opacity ${Math.round(stepAt)}ms linear`;
    el.style.opacity = "0";
    void animateSpring(el, { axis: "x", from: s.dx, to, velocity: v, spring: SPRING.base });
    setTimeout(() => {
      leaving.current = false;
      handoff = { v: v || Math.sign(s.dx) * 400, at: performance.now() };
      markGesture();
      go();
      /* A step that did not remount this element (the last screen, a
         handler that navigates away) must not stay parked off-screen. */
      requestAnimationFrame(() => {
        if (el.isConnected && el.style.opacity === "0") {
          el.getAnimations().forEach((a) => a.cancel());
          el.style.transition = "";
          el.style.transform = "";
          el.style.opacity = "";
        }
      });
    }, stepAt);
  };

  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (leaving.current || g.current) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable], [data-no-swipe]")) return;
      g.current = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        w: e.currentTarget.clientWidth || window.innerWidth,
        lock: null,
        dx: 0,
        shown: 0,
        trail: [{ t: performance.now(), x: e.clientX }],
      };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const s = g.current;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x0;
      const dy = e.clientY - s.y0;
      if (s.lock === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) >= Math.abs(dx)) {
          g.current = null;
          return;
        }
        s.lock = "x";
        e.currentTarget.style.userSelect = "none";
        /* Caught mid-spring, the page is held where it IS (§3): the
           finger takes it from its live position instead of it jumping
           back under the finger. */
        const el = slide.current;
        if (el && el.getAnimations().length) {
          const at = new DOMMatrixReadOnly(getComputedStyle(el).transform).m41 || 0;
          el.getAnimations().forEach((a) => a.cancel());
          s.x0 -= at;
        }
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* A pointer that already went away; the drag ends on its own. */
        }
      }
      s.dx = dx;
      s.trail.push({ t: performance.now(), x: e.clientX });
      if (s.trail.length > 8) s.trail.shift();
      const h = handlers.current;
      const allowed = dx < 0 ? h?.next : h?.back;
      s.shown = allowed ? dx : band(dx, s.w);
      paint(s.shown, s.w);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => end(e, false),
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => end(e, true),
  };
}

/* Re-exported so the seven screens importing it from here keep
   working; the string itself lives in lib/ui.ts, which a server
   component can read. */
export { ACTION_CLASS };
