import { useCallback, useRef } from "react";
import type { KeyboardEvent } from "react";

/**
 * One radio group behaviour for the whole app (PRINCIPLES 10, you-19,
 * system-13, practice-tab-17, intro-a-5). A radio group is ONE tab stop:
 * the checked option (or the first enabled one when nothing is checked)
 * takes tabIndex 0 and the rest -1, and the arrow keys move the choice,
 * selecting and focusing together, the way a native radio group does.
 * Settings' segmented control, the paywall's plans, the hour set and the
 * introduction's answers all read it, so the keys work the same in all
 * four instead of being written four times.
 */

const FORWARD = new Set(["ArrowRight", "ArrowDown"]);
const BACK = new Set(["ArrowLeft", "ArrowUp"]);

/**
 * Where a key moves the choice in a group of `count`, from `current`.
 * Arrows wrap and skip disabled options; Home and End go to the first
 * and last enabled one. Null when the key is not a radio key (Tab,
 * Space, letters), so the caller leaves the event alone. When nothing
 * is enabled the choice stays where it is.
 */
export function nextIndex(
  count: number,
  current: number,
  key: string,
  isDisabled: (i: number) => boolean = () => false
): number | null {
  if (count <= 0) return null;
  const enabled = (i: number) => !isDisabled(i);
  if (key === "Home" || key === "End") {
    const order = Array.from({ length: count }, (_, i) => (key === "Home" ? i : count - 1 - i));
    const hit = order.find(enabled);
    return hit ?? current;
  }
  const step = FORWARD.has(key) ? 1 : BACK.has(key) ? -1 : 0;
  if (step === 0) return null;
  let i = current;
  for (let n = 0; n < count; n++) {
    i = (i + step + count) % count;
    if (enabled(i)) return i;
  }
  return current;
}

export interface RovingItemProps {
  tabIndex: 0 | -1;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  ref: (el: HTMLElement | null) => void;
}

/**
 * The hook: hand it the values, the checked one (or null) and the
 * setter, and spread `getItemProps(value, index)` onto each option. The
 * option keeps its own `role="radio"`, `aria-checked` and `onClick`
 * (Space and Enter press a button natively).
 */
export function useRovingRadio<T>({
  values,
  value,
  onChange,
  isDisabled,
}: {
  values: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  isDisabled?: (v: T) => boolean;
}) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const checked = value === null ? -1 : values.indexOf(value);
  const firstEnabled = values.findIndex((v) => !isDisabled?.(v));
  const stop = checked >= 0 ? checked : firstEnabled;

  const getItemProps = useCallback(
    (v: T, i: number): RovingItemProps => ({
      tabIndex: i === stop ? 0 : -1,
      onKeyDown: (e) => {
        const n = nextIndex(values.length, i, e.key, (j) => !!isDisabled?.(values[j]));
        if (n === null) return;
        e.preventDefault();
        if (n === i) return;
        onChange(values[n]);
        refs.current[n]?.focus();
      },
      ref: (el) => {
        refs.current[i] = el;
      },
    }),
    [stop, values, isDisabled, onChange]
  );

  return { getItemProps };
}
