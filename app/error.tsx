"use client";

import Link from "next/link";
import { useEffect } from "react";

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
      <div className="font-display text-[22px] font-bold">
        That screen didn&apos;t load.
      </div>
      <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-stone-500">
        Your recordings are stored. Nothing was lost.
      </p>
      {error.digest && (
        <p className="label-data mt-3">reference {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-6 w-full max-w-[300px] rounded-full bg-terracotta-500 px-6 py-4 text-base font-semibold text-stage press"
      >
        Try again
      </button>
      <Link
        href="/"
        className="mt-3 text-[13.5px] font-semibold text-stone-500"
      >
        Back to today
      </Link>
    </main>
  );
}
