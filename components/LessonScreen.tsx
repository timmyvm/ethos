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
 *   · tactic
 *   · tactic
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
 * Three type roles and no fourth (globals.css, DECISIONS #208): the
 * title is `text-title`, the line and the tactics are `text-body`, and
 * the eyebrow, the list label and the fine print share the caption
 * step. Strip the colour and the order still reads, because size and
 * weight carry it.
 */

/** A destination renders a real link; a handler renders a button. */
export type LessonAction = { label: string } & (
  | { href: string; onPress?: never }
  | { onPress: () => void; href?: never }
);

export interface LessonBodyProps {
  /** The label register above the title: the unit, or "Today's lesson". */
  eyebrow?: string;
  /** 2 to 4 words. The largest, heaviest thing on the screen. */
  title: string;
  /** ONE sentence of what this is. */
  line?: string;
  /** Tactics, 2 to 3. The technique, not encouragement. */
  howTo?: string[];
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
}: LessonBodyProps) {
  return (
    <>
      {eyebrow && <div className="label-data">{eyebrow}</div>}

      <h1 className="font-display mt-1.5 text-title">{title}</h1>

      {line && <p className="mt-2 text-body text-stone-500">{line}</p>}

      {note && <p className="mt-1.5 text-caption text-stone-400">{note}</p>}

      {howTo && howTo.length > 0 && (
        <div className="mt-6">
          <div className="label-data">{howToLabel}</div>
          <ul className="mt-2 space-y-2">
            {howTo.map((tactic) => (
              <li key={tactic} className="flex gap-2.5 text-body">
                <span aria-hidden className="shrink-0 text-stone-300">
                  ·
                </span>
                <span>{tactic}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <WhyThisWorks>{why}</WhyThisWorks>
    </>
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
