import Link from "next/link";
import type { ReactNode } from "react";
import { CountUp } from "@/components/CountUp";
import { StatIcon } from "@/components/StatIcon";
import { Disclosure } from "@/components/ui/Disclosure";
import { Skeleton } from "@/components/ui/Skeleton";
import { DURATION } from "@/lib/motion";

/**
 * One recording in the Log (#506): what it was about, its day on one
 * quiet line, its Ethos number, and the chevron of a row that is a door
 * (#442). It opens the recording's stored results. Both sides of the Log
 * draw it, so the Daily / Games switch never flips between a calm list
 * and a table of caps heads (DATE / LESSON / ETHOS went with #506).
 *
 * The title is 16/600 (`text-read`), a sentence rather than a row's
 * 14/700 name, so the 17/800 number leads; two lines at most, never an
 * ellipsis mid-word on a phone of 320. The all-time best wears the
 * house's best grammar (#421): the gold cup before the number, the
 * number in sage, since a best is earned. The row's name says all of it,
 * the topic first (#448).
 */
export function LogRow({
  href,
  title,
  meta,
  index,
  best = false,
  label,
  first = false,
  onOpen,
}: {
  href: string;
  title: string;
  /** The quiet line under the title: the day, and on Games the round's one number in words. */
  meta: ReactNode;
  index: number | null;
  best?: boolean;
  label: string;
  /** The list's first row takes no rule over it: the head is its edge. */
  first?: boolean;
  onOpen?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onOpen}
      aria-label={label}
      data-best={best || undefined}
      className={`log-row press-row grid grid-cols-[minmax(0,1fr)_auto_8px] items-center gap-x-3.5 py-4 ${
        first ? "" : "border-t border-hairline"
      }`}
    >
      <span className="min-w-0">
        <span className="font-display line-clamp-2 text-read font-semibold leading-snug text-pretty">{title}</span>
        <span className="mt-1 flex min-w-0 items-center gap-2 text-caption font-medium text-stone-500">{meta}</span>
      </span>
      <span
        className={`font-display flex items-center gap-1.5 text-right text-num-s tabular-nums ${
          best ? "text-sage-800" : ""
        }`}
      >
        {best && <StatIcon kind="trophy" size={18} />}
        {index === null ? (
          "—"
        ) : (
          /* `max`, not `celebrate`: a row in a list is a value arriving,
             not a recording landing, and 600ms seven rows deep is a
             loading bar. */
          <CountUp value={index} durationMs={DURATION.max} />
        )}
      </span>
      <Disclosure className="justify-self-end text-stone-400" />
    </Link>
  );
}

/** A row while the list reads, at a landed one-line row's height (77px). */
export function LogRowSkeleton({ first = false, width = "w-3/4" }: { first?: boolean; width?: string }) {
  return (
    <div
      aria-hidden
      className={`grid grid-cols-[minmax(0,1fr)_auto_8px] items-center gap-x-3.5 py-4 ${
        first ? "" : "border-t border-hairline"
      }`}
    >
      <span className="min-w-0">
        <span className="relative block text-read leading-snug">
          <span className="invisible">Ag</span>
          <Skeleton className={`absolute inset-y-[20%] left-0 ${width}`} />
        </span>
        <span className="relative mt-1 block text-caption">
          <span className="invisible">Ag</span>
          <Skeleton className="absolute inset-y-[22%] left-0 w-20" />
        </span>
      </span>
      <Skeleton className="h-4 w-9" />
      <span />
    </div>
  );
}
