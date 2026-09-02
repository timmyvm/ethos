"use client";

import type { CaptureMode } from "@/lib/prefs";

/**
 * Voice, or Voice + Video (decisions 11 Aug, §1).
 *
 * Equal visual weight, no premium badge on the toggle itself, no upsell
 * copy. Both halves are a real choice — the Presence readout is what
 * Pro buys, not the camera, and a padlock here would sell the wrong
 * thing and make the free tier feel like a demo.
 *
 * The shape is #206's, which already decided this: a segmented set
 * fills its selected option with `stage` ink, not terracotta (the one
 * terracotta on a screen is its tap, and this is not the tap), and #201
 * squares the corners. It used to be a sand-filled pill with a floating
 * cream lozenge inside it, which read as a switch someone had half
 * pushed: the selected half was the LIGHTEST thing in the control, so
 * the eye landed on the option you had not chosen. Ink on cream, both
 * halves the same size, and there is nothing to misread.
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
  reason?: string;
}) {
  return (
    <div className="mt-4">
      <div
        role="radiogroup"
        aria-label="Recording mode"
        className="flex gap-2"
      >
        <Option
          label="Voice"
          selected={mode === "voice"}
          onSelect={() => onChange("voice")}
        />
        <Option
          label="Voice + Video"
          selected={mode === "voice_video"}
          disabled={!available}
          onSelect={() => onChange("voice_video")}
        />
      </div>

      <p className="mt-2 text-caption text-stone-500">
        {!available
          ? (reason ??
            "Voice + Video needs a camera and on-device pose detection this browser doesn't have.")
          : mode === "voice_video"
            ? "Your camera reads posture, gesture and eye line on this device. The video is never uploaded, only five numbers."
            : "Audio only. Works on a tram with headphones."}
      </p>
    </div>
  );
}

function Option({
  label,
  selected,
  disabled = false,
  onSelect,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`press font-display min-h-11 flex-1 rounded-[10px] border px-3 text-[13.5px] font-bold transition-colors ${
        selected
          ? "border-ink bg-ink text-ground"
          : "border-stone-200 bg-surface text-stone-600 hover:bg-sand"
      } ${disabled ? "opacity-40" : ""}`}
    >
      {label}
    </button>
  );
}
