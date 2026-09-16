"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { IconChevron } from "@/components/Icon";
import { Says, SAID_AFTER_MS } from "@/components/Says";
import { SpeechBubble } from "@/components/SpeechBubble";
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
             * The hero block. Each tactic is one ink line at `lead`,
             * numbered in olive on its own column so the eye can count
             * three things before it reads any of them, and the rows
             * are separated by air rather than bullets. Three of these
             * outweigh the lesson name by mass, which is the point:
             * mass is what survives a blur, and what the reader is
             * here to act on should be what survives.
             */
            <ol
              className={`mt-3 space-y-4 ${ladder ? "stagger" : ""}`}
              style={ladder ? { "--stagger-lead": "260ms" } as React.CSSProperties : undefined}
            >
              {tactics.map((tactic, i) => (
                <li key={tactic} className="flex gap-3.5">
                  <span
                    aria-hidden
                    className="font-display mt-1 w-4 shrink-0 text-[13px] font-extrabold text-sage-700 tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <span className="text-lead">{tactic}</span>
                </li>
              ))}
            </ol>
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
  ...body
}: LessonBodyProps & {
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
  return (
    <main className="pb-safe flex min-h-dvh flex-col px-5 pt-7">
      {(onBack || header) && (
        <div className="flex items-center gap-4">
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
      <div className={`flex flex-1 flex-col ${center ? "justify-center" : ""}`}>
        {/* A flex column like its parent, so the art and the text block
            stay flex items (the art centres with `mx-auto`) whether or
            not the wrapper is animating. */}
        <div
          key={stepKey}
          className={`flex flex-col ${stepKey !== undefined ? "arrive-x" : ""}`}
        >
          {speech ? (
            <DemosSpeech
              mode={speech}
              art={art}
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

      <div className="mt-8 pb-6">
        {aside && <div className="mb-5">{aside}</div>}

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
  title,
  line,
  reply,
}: {
  mode: "above" | "beside";
  art?: ReactNode;
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

/* Re-exported so the seven screens importing it from here keep
   working; the string itself lives in lib/ui.ts, which a server
   component can read. */
export { ACTION_CLASS };
