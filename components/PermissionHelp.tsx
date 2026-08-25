"use client";

import Image from "next/image";
import { useMemo } from "react";
import { browserFamily, permissionSteps } from "@/lib/permission-help";

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
    <div className="w-full rounded-[24px] border border-hairline bg-surface lift p-5">
      <div className="flex items-center gap-3.5">
        <Image
          src="/demos-listening.webp"
          alt=""
          width={56}
          height={56}
          className="demos w-14 shrink-0"
        />
        <div>
          <div className="text-[16px] font-extrabold">
            {missing ? `No ${thing} found` : `The ${thing} is blocked`}
          </div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-stone-500">
            Ethos scores what the mic hears: your pauses, pace and fillers.
            Without it there is nothing to measure.
          </p>
        </div>
      </div>

      {missing ? (
        <p className="mt-4 text-[13.5px] leading-relaxed text-stone-600">
          This device didn&apos;t offer one. Plug in or switch on a {thing},
          then check again.
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed">
              <span className="label-data mt-0.5 shrink-0 !text-sage-700">
                {i + 1}
              </span>
              <span className="text-stone-600">{step}</span>
            </li>
          ))}
        </ol>
      )}

      <button
        onClick={onRecheck}
        className="press mt-5 w-full rounded-full bg-terracotta-500 px-5 py-3.5 text-[15px] font-bold text-cream transition-colors hover:bg-terracotta-600"
      >
        Check again
      </button>
      <p className="mt-2 text-center text-[11.5px] text-stone-400">
        {video
          ? "Audio uploads for scoring. Camera frames never leave this device."
          : "Audio uploads for scoring, nothing else."}
      </p>
    </div>
  );
}
