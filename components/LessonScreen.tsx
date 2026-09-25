"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { Tone } from "@/components/DemosArt";
import { IconChevron } from "@/components/Icon";
import { Says, SAID_AFTER_MS } from "@/components/Says";
import { SpeechBubble } from "@/components/SpeechBubble";
import { TipStrip } from "@/components/rep/TipStrip";
import { ACTION_CLASS, DISABLED_CLASS } from "@/lib/ui";

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
 * find out this one is called The baseline — so the tactics take
 * `text-lead` in ink and the name drops to a bold body line above
 * them. Either way, strip the colour and blur it and the hero is still
 * the biggest mass on the screen.
 */

/** A destination renders a real link; a handler renders a button. */
export type LessonAction = { label: string } & (
  | { href: string; onPress?: never; disabled?: never }
  | { onPress: () => void; href?: never; disabled?: boolean }
);

export interface LessonBodyProps {
  /** The label register above the title: the unit, or "Today's lesson". */
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
  /** Defaults to voice.md's own label. */
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
   * rather than as the thing you came to press.
   */
  align?: "left" | "center";
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
}: LessonBodyProps) {
  const tactics = howTo?.length ? howTo : null;
  /* The hero only moves when there is something to move it to: a
     lesson screen mid-recording has no tactics, and a name shrunk in
     favour of nothing is just a smaller name. */
  const howToLeads = lead === "howTo" && tactics !== null;
  const centred = align === "center";

  return (
    <div className={centred ? "text-center" : undefined}>
      {eyebrow && <div className="label-data">{eyebrow}</div>}

      <h1
        className={
          howToLeads
            ? "font-display mt-1.5 text-body font-bold"
            : "font-display mt-1.5 text-title"
        }
      >
        {title}
      </h1>

      {reply ? (
        <p
          key={reply}
          className={`arrive text-body ${howToLeads ? "mt-1" : "mt-2"} ${
            centred ? "mx-auto" : ""
          }`}
        >
          {reply}
        </p>
      ) : (
        line && (
          <p
            className={`text-body text-stone-500 ${howToLeads ? "mt-1" : "mt-2"} ${
              centred ? "mx-auto" : ""
            }`}
          >
            {line}
          </p>
        )
      )}

      {note && <p className="mt-1.5 text-caption text-stone-400">{note}</p>}

      {tactics && (
        <div className={howToLeads ? "mt-7" : "mt-6"}>
          <div className="label-data">{howToLabel}</div>
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
                    className="font-display w-4 shrink-0 text-[12px] font-extrabold text-sage-700 tabular-nums"
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

      <WhyThisWorks>{why}</WhyThisWorks>
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
  speech,
  stage,
  swipe,
  travel = "next",
  ...body
}: LessonBodyProps & {
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
  /* A walk compacts its chrome on a short phone (under 740px tall), so
     the one tap and the door under it stay above the fold. Screens that
     do not swipe keep the template's spacing. */
  const short = swipe
    ? {
        main: "[@media(max-height:740px)]:pt-2",
        stage: "[@media(max-height:740px)]:mt-2",
        foot: "[@media(max-height:740px)]:mt-4 [@media(max-height:740px)]:pb-2",
      }
    : { main: "", stage: "", foot: "" };

  return (
    <main
      className={`pb-safe flex min-h-dvh flex-col px-5 pt-7 ${swipe ? "touch-pan-y" : ""} ${short.main}`}
      {...drag}
    >
      {/* A carousel keeps the row even where it is empty (the first
          page has no way back), so the stage does not jump 44px down
          when the second page slides in. */}
      {(onBack || header || swipe) && (
        <div className="flex min-h-11 items-center gap-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="press -ml-1 inline-flex min-h-11 shrink-0 items-center px-1 text-sm text-stone-500"
            >
              ← back
            </button>
          )}
          {header && <div className="min-w-0 flex-1">{header}</div>}
        </div>
      )}
      <div className={`flex flex-1 flex-col ${center && !stage ? "justify-center" : ""}`}>
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
            />
          ) : (
            <>
              {art}
              <LessonBody {...body} />
            </>
          )}
          {controls && <div className="mt-7">{controls}</div>}
        </div>
      </div>

      <div className={`mt-8 pb-6 ${short.foot}`}>
        {aside && <div className={swipe ? "mb-3" : "mb-5"}>{aside}</div>}

        {action.href !== undefined ? (
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
        )}

        {fineprint && (
          <p className="mt-3 text-center text-caption text-stone-400">
            {fineprint}
          </p>
        )}

        {footer}
      </div>
    </main>
  );
}

/**
 * The one tap, in one place (#201's grammar, #234's numbers): a
 * `rounded-control` rectangle, ink on terracotta, 48px tall, no border
 * and no shadow — the colour is the lift.
 *
 * Exported because Today and the roulette declare the same button
 * outside this template, and they had drifted into three spellings of
 * it: a transparent 1px border and no min-height on the floor, neither
 * on the roulette, and this one here. One constant, one button.
 */
export 
/**
 * Demos speaking (#288). The words wait for the screen's own slide
 * (`arrive-x`, 200ms) so two entrances never run at once, then land a
 * word at a time; a reply swapped into a bubble already on screen
 * starts at once. The `key` on each line is what replays the landing
 * when the text changes.
 *
 * The question stays in the document as a hidden heading while a reply
 * is showing, so the screen's name never changes under a screen reader
 * while what is SEEN is what he just said.
 */
function DemosSpeech({
  mode,
  art,
  stage,
  title,
  line,
  reply,
}: {
  mode: "above" | "beside";
  art?: ReactNode;
  stage?: Tone;
  title: string;
  line?: string;
  reply?: string;
}) {
  const said = reply ?? title;
  const second = reply ? undefined : line;
  const lead = reply ? 0 : 200;
  const bubble = (size: string) => (
    <>
      <Says
        key={said}
        as={reply ? "p" : "h1"}
        text={said}
        lead={lead}
        className={`font-display ${size} font-bold leading-snug`}
      />
      {reply && <h1 className="sr-only">{title}</h1>}
      {second && (
        <Says
          key={second}
          text={second}
          lead={lead + 120}
          className="mt-1 text-body text-stone-500"
        />
      )}
    </>
  );

  if (mode === "above" && stage) {
    /* The stage: his bubble at the top of a coloured room, and him
       standing on its floor, as big as the room allows. The room takes
       the screen's free height and no more, and he takes the room's
       (`.demos-fit` is a size container his `fit` reads), so a short
       phone gets a smaller Demos rather than a tap below the fold. */
    return (
      <div
        className={`intro-stage tone-${stage} flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-5 pt-5`}
      >
        <SpeechBubble tail="down" className="max-w-[320px] shrink-0 text-center">
          {bubble("text-[20px]")}
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
          {bubble("text-[19px]")}
        </SpeechBubble>
        <div className="mt-6">{art}</div>
      </>
    );
  }
  return (
    <div className="mt-6 flex items-start gap-3">
      <div className="shrink-0">{art}</div>
      <SpeechBubble tail="left" className="min-w-0 flex-1">
        {bubble("text-[17px]")}
      </SpeechBubble>
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
  const settle = () => {
    const el = slide.current;
    if (!el) return;
    el.style.transition =
      "transform 460ms var(--ease-spring), opacity var(--duration-base) var(--ease-out)";
    el.style.transform = "translate3d(0,0,0)";
    el.style.opacity = "1";
    /* Cleared when the SPRING ends, not the fade: opacity finishes at
       200ms, near the spring's overshoot, and clearing the transform
       there snapped the screen the last few pixels. */
    const clear = (ev: TransitionEvent) => {
      if (ev.target !== el || ev.propertyName !== "transform") return;
      el.removeEventListener("transitionend", clear);
      el.style.transition = "";
      el.style.transform = "";
      el.style.opacity = "";
    };
    el.addEventListener("transitionend", clear);
  };
  /* Past the end the screen gives a little and no more: a rubber band,
     so a refused swipe still feels like the screen heard the finger. */
  const band = (dx: number) => Math.sign(dx) * 56 * (1 - Math.exp(-Math.abs(dx) / 140));
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
    const v = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
    const flick = Math.abs(v) > 0.45 && Math.sign(v) === Math.sign(s.dx) && Math.abs(s.dx) > 24;
    const commit = !cancelled && go !== undefined && (Math.abs(s.dx) > s.w * 0.25 || flick);
    if (!commit) {
      if (!reduced()) settle();
      return;
    }
    const el = slide.current;
    if (!el || reduced()) {
      markGesture();
      go();
      return;
    }
    /* Carry the screen off the edge it was dragged toward, then step.
       The next one arrives from the other side (`.step-in-*`). */
    leaving.current = true;
    el.style.transition = "transform 180ms cubic-bezier(0.4, 0, 1, 1), opacity 180ms linear";
    el.style.transform = `translate3d(${Math.sign(s.dx) * s.w}px,0,0)`;
    el.style.opacity = "0";
    setTimeout(() => {
      leaving.current = false;
      markGesture();
      go();
      /* A step that did not remount this element (the last screen, a
         handler that navigates away) must not stay parked off-screen. */
      requestAnimationFrame(() => {
        if (el.isConnected && el.style.opacity === "0") {
          el.style.transition = "";
          el.style.transform = "";
          el.style.opacity = "";
        }
      });
    }, 170);
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
      paint(allowed ? dx : band(dx), s.w);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => end(e, false),
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => end(e, true),
  };
}

/* Re-exported so the seven screens importing it from here keep
   working; the string itself lives in lib/ui.ts, which a server
   component can read. */
export { ACTION_CLASS };
