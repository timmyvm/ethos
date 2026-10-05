"use client";

import { Fragment, type CSSProperties } from "react";

/**
 * A line Demos says, landing a word at a time (DECISIONS #288).
 *
 * The reference (docs/refs/duolingo-onboarding, frame 11): the bubble
 * appears, the text fills it over about a quarter of a second, and only
 * then does the mascot move. The order is the mechanism. A line that is
 * simply there is read in whatever order the eye lands; a line that
 * arrives is read in the order it arrives, which makes it a thing being
 * said rather than a thing printed.
 *
 * Words, not characters, and a whole line in about 220ms whatever its
 * length: a typewriter at reading speed is a wait, and the reference
 * types at two hundred characters a second, which the eye reads as a
 * wipe. Every word is in the DOM from the first frame at opacity 0, so
 * the bubble is its final size before the first word shows and nothing
 * under it moves. Reduced motion lands the whole line at once
 * (globals.css, `.says-word`).
 *
 * Assistive tech gets the sentence once, whole (intro-a-25): a
 * `.sr-only` copy of the line, with the word spans beside it inside
 * `aria-hidden`, because VoiceOver can stop on each of a run of styled
 * inline-block spans and read a bubble one word per swipe. A test that
 * finds a line by its words finds it in the `.sr-only` copy. With
 * `ariaHidden` the whole line is hidden and the copy is left out: the
 * caller speaks it somewhere else (DemosSpeech's live region).
 *
 * Says sets no type of its own: inside a SpeechBubble the bubble's
 * voice (Figtree 400 in ink) is what it inherits, and `className` adds
 * only wrap and spacing (`text-balance` on the line he says, intro-a-16).
 */
export function Says({
  text,
  as: Tag = "p",
  className,
  lead = 0,
  ariaHidden = false,
}: {
  text: string;
  as?: "p" | "h1";
  className?: string;
  /** Milliseconds before the first word: the bubble's own entrance. */
  lead?: number;
  /** Seen, not read: the line is announced elsewhere. */
  ariaHidden?: boolean;
}) {
  const words = text.split(" ");
  const step = Math.min(30, 220 / words.length);
  return (
    <Tag
      className={className}
      aria-hidden={ariaHidden || undefined}
      style={
        {
          "--says-step": `${step.toFixed(1)}ms`,
          "--says-lead": `${lead}ms`,
        } as CSSProperties
      }
    >
      {!ariaHidden && <span className="sr-only">{text}</span>}
      <span aria-hidden>
        {words.map((w, i) => (
          <Fragment key={i}>
            {i > 0 && " "}
            <span className="says-word" style={{ "--i": i } as CSSProperties}>
              {w}
            </span>
          </Fragment>
        ))}
      </span>
    </Tag>
  );
}

/**
 * A line he is NOT saying right now, kept only for its size (intro-a-1).
 *
 * The bubble holds the question and his reply in one grid cell, so it is
 * as tall as the taller of the two and the answers under it never move
 * when one replaces the other. Whichever is not showing is this: an
 * invisible block whose words are drawn by `.ghost-text::before`
 * (globals.css) from `data-text`. A pseudo-element's text is not in the
 * DOM, so a screen reader, `getByText` and the onboarding gate's
 * `main h1` reader never meet a line twice. Give it the same type
 * classes as the line it stands in for, or it sizes to the wrong thing.
 */
export function SaysGhost({ text, className = "" }: { text: string; className?: string }) {
  return <div aria-hidden className={`ghost-text invisible ${className}`} data-text={text} />;
}

/**
 * When the last word of a line that had to wait for the screen's own
 * entrance has landed: the entrance (200), the words (220), the last
 * word's fade (120). Demos moves after this, never during.
 */
export const SAID_AFTER_MS = 540;
