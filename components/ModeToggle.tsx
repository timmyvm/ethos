"use client";

import type { CaptureMode } from "@/lib/prefs";

/**
 * Voice, or Voice + Video (decisions 11 Aug, §1).
 *
 * Equal visual weight between its halves, no premium badge, no upsell
 * copy. Both halves are a real choice — the Presence readout is what
 * Pro buys, not the camera, and a padlock here would sell the wrong
 * thing and make the free tier feel like a demo.
 *
 * DEMOTED in the feedback round (25 Sep). It was a full-width segmented
 * control with a sentence under it, the second-biggest object on a
 * screen whose job is the topic and the Record tap, and a first-time
 * user read the screen as a document. It is now a small centred pair
 * that sits with the Record button it configures: 44px targets still,
 * a glyph and a word each, and the only sentence left is the camera's
 * promise, shown at the moment the camera is chosen (#135's rule).
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
      <div
        role="radiogroup"
        aria-label="Recording mode"
        className="inline-flex gap-1 rounded-control bg-surface p-1"
      >
        <Option
          label="Voice"
          glyph="mic"
          selected={mode === "voice"}
          onSelect={() => onChange("voice")}
        />
        <Option
          label="Video"
          glyph="cam"
          selected={mode === "voice_video"}
          disabled={!available}
          onSelect={() => onChange("voice_video")}
        />
      </div>

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

function Option({
  label,
  glyph,
  selected,
  disabled = false,
  onSelect,
}: {
  label: string;
  glyph: "mic" | "cam";
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={glyph === "cam" ? "Voice + Video" : "Voice"}
      disabled={disabled}
      onClick={onSelect}
      className={`press font-display inline-flex min-h-11 items-center gap-1.5 rounded-control px-3.5 text-[13px] font-bold transition-colors ${
        selected ? "elev-1 bg-raised text-ink" : "text-stone-500"
      } ${disabled ? "!text-stone-300" : ""}`}
    >
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph === "mic" ? (
          <>
            <rect x="7" y="2.5" width="6" height="10" rx="3" />
            <path d="M4.5 9.5a5.5 5.5 0 0011 0M10 15v2.5" />
          </>
        ) : (
          <>
            <rect x="2.5" y="5.5" width="11" height="9" rx="2" />
            <path d="M13.5 9l4-2.5v7l-4-2.5" />
          </>
        )}
      </svg>
      {label}
    </button>
  );
}
