"use client";

import { useLayoutEffect, useRef, useState, type Ref } from "react";
import { COMMON_LINE, passwordState, progress } from "@/lib/password";

/**
 * A new password's field and the line under it (#455, Charles Liu's
 * password reel, three of its eight). Sign-up and the reset page share it.
 *
 *  - Closure: the field's outline draws itself in ink as the password
 *    grows, and is one whole shape at the length rule. No "weak" or
 *    "strong" label: a closed outline is the whole message.
 *  - Reward early, punish late: the outline fills from the first letter;
 *    "too short" is never said while typing, only by Create.
 *  - Inline validation: a password everyone tries first is said at once,
 *    in rust, outline and line both, because typing more will not fix it.
 *
 * Not taken from the reel: sounds (a page that beeps at a password),
 * privacy glass and a character who looks away (decoration on a form
 * passed once; Demos appears at moments), a suggested password in
 * chunks (iOS offers its own, chunked, through `new-password`), and
 * dots that morph into letters (there is no show toggle to morph on).
 *
 * The line is drawn over the field's own 1px edge, starting at the top
 * left and running clockwise. Its length is the rounded rectangle's
 * perimeter, measured, because `pathLength` on a basic shape is not
 * drawn the same in every browser.
 */
export function NewPasswordField({
  value,
  onChange,
  email = "",
  inputRef,
  inputClassName,
  invalid = false,
  errorId,
  help,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  /** The account's email, so the password is not that either. */
  email?: string;
  inputRef?: Ref<HTMLInputElement>;
  /** The form's field class, without its top margin: the wrapper takes it. */
  inputClassName: string;
  /** Create or Save failed on this field. */
  invalid?: boolean;
  /** The id of the form's error line, read with the field while it shows. */
  errorId?: string;
  /** The rule, said before anyone types. */
  help: string;
  /** The field's accessible name when there is no <label for="password">. */
  label?: string;
}) {
  const state = passwordState(value, email);
  const box = useRef<HTMLDivElement>(null);
  const [perimeter, setPerimeter] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      // The stroke's centre runs 1px in, on the focus edge's 2px band.
      const w = el.clientWidth - 2;
      const h = el.clientHeight - 2;
      const r = Math.min(RADIUS, w / 2, h / 2);
      setPerimeter(Math.max(0, 2 * (w + h) - 8 * r + 2 * Math.PI * r));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const share = state === "good" ? 1 : progress(value);

  return (
    <>
      <div ref={box} className="new-password relative mt-2" data-state={state}>
        <input
          ref={inputRef}
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || state === "common" || undefined}
          aria-describedby={[invalid && errorId ? errorId : "", "password-help"].filter(Boolean).join(" ")}
          className={inputClassName}
        />
        <svg aria-hidden className="new-password-line" data-measured={perimeter > 0 || undefined}>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            rx={RADIUS - 1}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ strokeDasharray: perimeter, strokeDashoffset: perimeter * (1 - share) }}
          />
        </svg>
      </div>
      <p
        id="password-help"
        aria-live="polite"
        data-state={state}
        className="new-password-help mt-2 flex items-start gap-1.5 text-caption leading-relaxed"
      >
        {state === "good" && (
          <svg aria-hidden viewBox="0 0 16 16" className="mt-[3px] size-3.5 shrink-0">
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span>{state === "common" ? COMMON_LINE : help}</span>
      </p>
    </>
  );
}

/** The field's corner (`--radius-control`). */
const RADIUS = 12;
