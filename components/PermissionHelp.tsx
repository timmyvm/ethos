"use client";

import Image from "next/image";
import { useMemo } from "react";
import { browserFamily, permissionSteps } from "@/lib/permission-help";
import { ACTION_CLASS } from "@/lib/ui";

/**
 * The blocked-mic screen. Never a dead end: it says why the mic is
 * needed at all, gives THIS browser's re-enable steps rather than a
 * shrug, and keeps a check-again button in reach. Demos listens rather
 * than scolds; a blocked permission is a setting, not a failing.
 */
export function PermissionHelp({
  video,
  missing,
  onRecheck,
}: {
  /** The attempt included the camera (Voice + Video mode). */
  video: boolean;
  /** No device at all, rather than a denied one. */
  missing: boolean;
  onRecheck: () => void;
}) {
  const steps = useMemo(
    () =>
      permissionSteps(
        browserFamily(typeof navigator === "undefined" ? "" : navigator.userAgent),
        video
      ),
    [video]
  );

  const thing = video ? "mic and camera" : "mic";

  return (
    <div className="card w-full p-4">
      <div className="flex items-center gap-3.5">
        <Image
          src="/demos-listening.webp"
          alt=""
          width={56}
          height={56}
          className="demos w-14 shrink-0"
        />
        <div>
          <div className="font-display text-detail font-extrabold">
            {missing ? `No ${thing} found` : `The ${thing} is blocked`}
          </div>
          <p className="mt-1 text-caption leading-relaxed text-stone-500">
            Ethos scores what the mic hears: your pauses, pace and fillers.
            Without it there is nothing to measure.
          </p>
        </div>
      </div>

      {missing ? (
        <p className="mt-4 text-body text-stone-600">
          This device didn&apos;t offer one. Plug in or switch on a {thing},
          then check again.
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-body">
              <span className="font-display mt-px w-3 shrink-0 text-row tabular-nums text-stone-500">
                {i + 1}
              </span>
              <span className="text-stone-600">{step}</span>
            </li>
          ))}
        </ol>
      )}

      <button
        onClick={onRecheck}
        className={`${ACTION_CLASS} mt-5`}
      >
        Check again
      </button>
      <p className="mt-2.5 text-center text-caption text-stone-400">
        {video
          ? "Audio uploads for scoring. Camera frames never leave this device."
          : "Audio uploads for scoring, nothing else."}
      </p>
    </div>
  );
}
