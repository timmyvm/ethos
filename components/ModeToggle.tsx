"use client";

import { Segmented } from "@/components/ui/Segmented";
import type { CaptureMode } from "@/lib/prefs";

/**
 * Voice, or Voice + Video (decisions 11 Aug, §1).
 *
 * Equal visual weight between its halves, no premium badge, no upsell
 * copy. Both halves are a real choice — the Presence readout is what
 * Pro buys, not the camera, and a padlock here would sell the wrong
 * thing and make the free tier feel like a demo.
 *
 * DEMOTED in the feedback round (25 Sep, #301): a small centred pair
 * beside the Record button it configures, a glyph and a word each, and
 * the only sentence left is the camera's promise, shown at the moment
 * the camera is chosen (#135's rule).
 *
 * system-13, recording-26: it is the app's one segmented control (A2's
 * `Segmented`, the same track and sliding thumb as Settings), at the
 * large size: 44px segments, one tab stop, arrow keys that step over a
 * Video this browser cannot do. Segments are equal, 96px each at
 * least, so the thumb is the same width on both sides. The chosen
 * segment wears its glyph filled in ink; the other stands in outline at
 * stone-400, word and glyph together.
 */
export function ModeToggle({
  mode,
  onChange,
  available,
  reason,
}: {
  mode: CaptureMode;
  onChange: (mode: CaptureMode) => void;
  /** False when on-device pose isn't available in this browser. */
  available: boolean;
  /** Said only when Video is definitely unavailable, never while checking. */
  reason?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <Segmented<CaptureMode>
        label="Record with"
        size="lg"
        value={mode}
        onChange={onChange}
        options={[
          {
            value: "voice",
            label: <Face glyph="mic" word="Voice" on={mode === "voice"} />,
          },
          {
            value: "voice_video",
            label: (
              <Face
                glyph="cam"
                word="Video"
                on={mode === "voice_video"}
                off={!available}
              />
            ),
            disabled: !available,
          },
        ]}
      />

      {(mode === "voice_video" || reason) && (
        <p className="mt-1.5 text-center text-caption text-stone-500">
          {mode === "voice_video"
            ? "The video never leaves this device."
            : reason}
        </p>
      )}
    </div>
  );
}

/**
 * One segment's face: the 20px glyph and the word. A disabled segment
 * leaves its colour to the control (stone-300 on the option), so it
 * reads as unavailable rather than as merely unchosen.
 */
function Face({
  glyph,
  word,
  on,
  off = false,
}: {
  glyph: "mic" | "cam";
  word: string;
  on: boolean;
  off?: boolean;
}) {
  const tone = on ? "text-ink" : off ? "" : "text-stone-400";
  return (
    <span
      className={`flex min-w-[96px] items-center justify-center gap-1.5 px-3 text-body font-bold transition-colors duration-200 ease-out ${tone}`}
    >
      <Glyph kind={glyph} filled={on} />
      {word}
    </span>
  );
}

function Glyph({ kind, filled }: { kind: "mic" | "cam"; filled: boolean }) {
  const common = {
    "aria-hidden": true,
    width: 20,
    height: 20,
    viewBox: "0 0 20 20",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "mic") {
    return (
      <svg {...common} fill="none">
        <rect
          x="7"
          y="2.5"
          width="6"
          height="10"
          rx="3"
          fill={filled ? "currentColor" : "none"}
        />
        <path d="M4.5 9.5a5.5 5.5 0 0011 0M10 15v2.5" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="none">
      <rect
        x="2.5"
        y="5.5"
        width="11"
        height="9"
        rx="2"
        fill={filled ? "currentColor" : "none"}
      />
      <path
        d="M13.5 9l4-2.5v7l-4-2.5z"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}
