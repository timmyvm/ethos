"use client";

import Link from "next/link";
import { useId } from "react";
import { Disclosure } from "@/components/ui/Disclosure";
import { Skeleton } from "@/components/ui/Skeleton";
import { TapTick } from "@/components/ui/TapTick";

/**
 * Settings' parts (#479), shared by the index and every page under it:
 * iOS's inset grouped list in Ethos's tokens (`.inset-group`,
 * `.group-row`, `.group-head`, `.group-foot`, `.switch`, #446). A page is
 * a large title with its way back, then groups of rows; a row is one
 * line of name and state, a door ends in the Disclosure, a switch is a
 * row whose state is the switch.
 */

/** Every Settings page's frame: the tab bar stays (Settings is under You). */
export const PAGE_CLASS = "px-5 pb-[var(--nav-clear)] pt-7";

/**
 * A named group of rows. The header is small over the group and the
 * explanation, when there is one, small under it. The group is named
 * by its head for a screen reader.
 */
export function Section({
  title,
  footer,
  children,
  className = "mt-7",
}: {
  title?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section className={className} aria-labelledby={title ? id : undefined}>
      {title && (
        <h2 id={id} className="group-head">
          {title}
        </h2>
      )}
      <div className="inset-group">{children}</div>
      {footer && <div className="group-foot">{footer}</div>}
    </section>
  );
}

/**
 * One preference, as a row. `role="switch"` sits on the button, so the
 * state is announced on the thing that takes the focus. Ink, never a
 * colour: a switch is a state, not an action. It ticks when thrown (#449).
 */
export function Toggle({
  label,
  note,
  on,
  onChange,
}: {
  label: string;
  note?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="group-row press-row flex w-full items-center gap-3 text-left"
    >
      <span className="flex-1">
        <span className="font-display block text-row">{label}</span>
        {note && <span className="mt-0.5 block text-caption text-pretty text-stone-500">{note}</span>}
      </span>
      <span aria-hidden className="switch" data-on={on || undefined}>
        <span className="switch-knob" />
      </span>
      <TapTick />
    </button>
  );
}

/** A fact, not a control: the name, its value at the right, a note under. */
export function InfoRow({ label, value, note }: { label: string; value?: React.ReactNode; note?: string }) {
  return (
    <div className="group-row">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display min-w-0 truncate text-row">{label}</span>
        {value !== undefined && value !== null && (
          <span className="shrink-0 text-row font-normal text-stone-500 tabular-nums">{value}</span>
        )}
      </div>
      {note && <p className="mt-0.5 text-caption text-pretty text-stone-500">{note}</p>}
    </div>
  );
}

/** A row while its value is unknown: its two lines' height, no words. */
export function InfoRowSkeleton() {
  return (
    <div className="group-row" aria-busy="true">
      <Skeleton className="h-[18px] w-40" />
      <Skeleton className="mt-1.5 h-3.5 w-56" />
    </div>
  );
}

/**
 * A door: its name, the value the page behind it holds, the Disclosure.
 * `value` undefined draws nothing there; null is a value still unknown,
 * drawn as a short bar so the row never says a value it does not have.
 */
export function LinkRow({
  href,
  label,
  note,
  value,
  external = false,
  onClick,
}: {
  href: string;
  label: string;
  note?: string;
  value?: string | null;
  external?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="font-display block text-row">{label}</span>
        {note && <span className="mt-0.5 block text-caption text-pretty text-stone-500">{note}</span>}
      </span>
      {value === null ? (
        <Skeleton className="h-4 w-12 shrink-0" />
      ) : value !== undefined ? (
        <span className="max-w-[55%] shrink-0 truncate text-row font-normal text-stone-500 tabular-nums">{value}</span>
      ) : null}
      <Disclosure />
    </>
  );
  const className = "group-row press-row flex w-full items-center gap-3 text-left";
  return external ? (
    <a href={href} className={className} onClick={onClick}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={className} onClick={onClick}>
      {inner}
    </Link>
  );
}

/**
 * A row that does something here: its words in the row's voice, a
 * status under them, and no Disclosure (it goes nowhere). `tone`
 * "destructive" is the one red word, for the rows that delete.
 */
export function ActionRow({
  label,
  note,
  onClick,
  disabled = false,
  tone = "ink",
  center = false,
  trailing,
  buttonRef,
  busy = false,
}: {
  label: string;
  note?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "ink" | "destructive";
  center?: boolean;
  trailing?: React.ReactNode;
  buttonRef?: React.Ref<HTMLButtonElement>;
  busy?: boolean;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className={`group-row press-row flex w-full items-center gap-3 disabled:opacity-60 ${center ? "justify-center text-center" : "text-left"}`}
    >
      <span className={center ? "" : "min-w-0 flex-1"}>
        <span className={`font-display block text-row ${tone === "destructive" ? "text-destructive" : ""}`}>{label}</span>
        {note && <span className="mt-0.5 block text-caption text-pretty text-stone-500">{note}</span>}
      </span>
      {trailing}
    </button>
  );
}

/** The mark iOS puts on a row that opens a list of values. */
export function PickerMark() {
  return (
    <svg
      aria-hidden
      width="9"
      height="14"
      viewBox="0 0 9 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-stone-400"
    >
      <path d="m1.5 5 3-3.2 3 3.2M1.5 9l3 3.2 3-3.2" />
    </svg>
  );
}

/** A check, for the one chosen row in a list of choices. */
export function CheckMark() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-ink"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
