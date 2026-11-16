"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { browserFamily, permissionSteps } from "@/lib/permission-help";
import { askPlatform } from "@/lib/reminder-ask";
import { ACTION_CLASS } from "@/lib/ui";

/**
 * The blocked-mic screen. Never a dead end: it says why the mic is
 * needed at all, gives THIS browser's re-enable steps rather than a
 * shrug, and keeps a check-again button in reach. Demos listens rather
 * than scolds; a blocked permission is a setting, not a failing.
 *
 * An iPhone running Ethos from its Home Screen gets its own steps
 * (#440): it has no address bar to find a button in. A screen that
 * already has its own tap (Hostile's Record my take) leaves `onRecheck`
 * out, and that tap is the check.
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
  onRecheck?: () => void;
}) {
  /* Whether this is the installed app, read after mount (the card only
     ever appears after a tap, long after the server's page). */
  const [standalone, setStandalone] = useState(false);
  useEffect(() => setStandalone(askPlatform().standalone), []);
  const steps = useMemo(
    () =>
      permissionSteps(
        browserFamily(typeof navigator === "undefined" ? "" : navigator.userAgent, standalone),
        video
      ),
    [video, standalone]
  );

  const thing = video ? "mic and camera" : "mic";

  return (
    <div className="card w-full p-4">
      <div className="flex items-center gap-3.5">
        {/* One Demos a screen: a screen with its own tap has its own
            Demos too (Hostile's stands on the claim), so he is not drawn
            a second time here. */}
        {onRecheck && (
          <Image
            src="/demos-listening.webp"
            alt=""
            width={56}
            height={56}
            className="demos w-14 shrink-0"
          />
        )}
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

      {onRecheck && (
        <button
          onClick={onRecheck}
          className={`${ACTION_CLASS} mt-5`}
        >
          Check again
        </button>
      )}
      <p className={`${onRecheck ? "mt-2.5" : "mt-4"} text-center text-caption text-stone-400`}>
        {video
          ? "Audio uploads for scoring. Camera frames never leave this device."
          : "Audio uploads for scoring, nothing else."}
      </p>
    </div>
  );
}
