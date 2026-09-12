"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ACTION_CLASS } from "@/components/LessonScreen";

/**
 * Something broke. Say so plainly and give one way forward — the same
 * register as a failed rep. No apology theatre, no cartoon sadness.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <h1 className="font-display text-title">That screen didn&apos;t load.</h1>
      <p className="mt-2 max-w-[300px] text-body leading-relaxed text-stone-500">
        Your recordings are stored. Nothing was lost.
      </p>
      {error.digest && (
        <p className="label-micro mt-3">reference {error.digest}</p>
      )}
      <button onClick={reset} className={`${ACTION_CLASS} mt-7 max-w-[300px]`}>
        Try again
      </button>
      <Link
        href="/"
        className="press mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-stone-500"
      >
        Back to today
      </Link>
    </main>
  );
}
