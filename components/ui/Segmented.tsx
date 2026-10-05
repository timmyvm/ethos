"use client";

import type { ReactNode } from "react";
import { useRovingRadio } from "@/lib/use-roving-radio";

/**
 * iOS's segmented control: one track, one raised thumb that slides to
 * the chosen segment on a spring rather than a fill that jumps. The
 * segments are equal and the thumb is one of them wide, so its travel
 * is a percentage and holds at any width. Lifted from Settings so
 * ModeToggle (system-13), Settings (you-19) and anything after them
 * share one control and one set of keys (useRovingRadio: one tab stop,
 * the arrows move the choice).
 *
 * `size`: `md` is 40px segments (44 with the track), `lg` 44px with a
 * 15px label (globals.css `.segmented[data-size="lg"]`).
 *
 * A disabled option stays in place (the thumb never lands on it, the
 * arrows step over it) with its label at stone-300: stone-400 sat one
 * alpha step from the stone-500 of an unchosen label and read as
 * enabled.
 *
 *   <Segmented
 *     label="Theme"
 *     options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }]}
 *     value={theme}
 *     onChange={setTheme}
 *   />
 */
export interface SegmentedOption<T> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  size = "md",
  className = "",
}: {
  /** Names the group for screen readers. */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "md" | "lg";
  className?: string;
}) {
  const values = options.map((o) => o.value);
  const off = (v: T) => !!options.find((o) => o.value === v)?.disabled;
  const { getItemProps } = useRovingRadio({ values, value, onChange, isDisabled: off });
  const index = Math.max(0, values.indexOf(value));

  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-size={size}
      className={`segmented ${className}`}
      style={{ "--segments": options.length } as React.CSSProperties}
    >
      <span
        aria-hidden
        className="segmented-thumb"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-disabled={o.disabled || undefined}
          onClick={() => {
            if (!o.disabled) onChange(o.value);
          }}
          {...getItemProps(o.value, i)}
          className="segmented-option aria-disabled:cursor-default aria-disabled:!text-stone-300"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
