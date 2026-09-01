"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { IconChevron } from "@/components/Icon";

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
  | { href: string; onPress?: never }
  | { onPress: () => void; href?: never }
);

export interface LessonBodyProps {
  /** The label register above the title: the unit, or "Today's lesson". */
  eyebrow?: string;
  /** 2 to 4 words. The name of the thing. */
  title: string;
  /** ONE sentence of what this is. */
  line?: string;
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
  howTo,
  howToLabel = "How to do this",
  why,
  note,
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

      {line && (
        <p
          className={`text-body text-stone-500 ${howToLeads ? "mt-1" : "mt-2"} ${
            centred ? "mx-auto" : ""
          }`}
        >
          {line}
        </p>
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
            <ol className="mt-3 space-y-4">
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
            <ul className="mt-2 space-y-2">
              {tactics.map((tactic) => (
                <li key={tactic} className="flex gap-2.5 text-body">
                  <span aria-hidden className="shrink-0 text-stone-300">
                    ·
                  </span>
                  <span>{tactic}</span>
                </li>
              ))}
            </ul>
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
  footer,
  center = false,
  ...body
}: LessonBodyProps & {
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
  /** Below the action: the secondary door (skip, sign in). Not prose. */
  footer?: ReactNode;
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
}) {
  return (
    <main className="flex min-h-dvh flex-col px-5 pb-10 pt-7">
      <div
        className={`flex flex-1 flex-col ${center ? "justify-center" : ""}`}
      >
        {art}
        <LessonBody {...body} />
      </div>

      <div className="mt-8">
        {aside && <div className="mb-5">{aside}</div>}

        {action.href !== undefined ? (
          <Link href={action.href} className={ACTION_CLASS}>
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onPress}
            className={ACTION_CLASS}
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

/** #201's button grammar: a 12px rectangle, cream on terracotta, no pill. */
const ACTION_CLASS =
  "press font-display block w-full rounded-xl bg-terracotta-500 px-6 py-3.5 text-center text-[15px] font-bold text-cream transition-colors hover:bg-terracotta-600";

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
      {open && <div className="pb-3 text-body text-stone-600">{children}</div>}
    </div>
  );
}
