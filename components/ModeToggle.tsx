"use client";

import type { CaptureMode } from "@/lib/prefs";

/**
 * Voice, or Voice + Video (decisions 11 Aug, §1).
 *
 * Equal visual weight, no premium badge on the toggle itself, no upsell
 * copy. Both halves are a real choice — the Presence readout is what
 * Pro buys, not the camera, and a padlock here would sell the wrong
 * thing and make the free tier feel like a demo.
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
        className="flex gap-1.5 rounded-full bg-sand p-1.5"
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

      <p className="mt-2 text-[12px] leading-relaxed text-stone-500">
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
      className={`flex-1 rounded-[11px] px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
        selected
          ? "bg-surface text-ink lift"
          : "text-stone-500 hover:text-stone-600"
      } ${disabled ? "opacity-40" : ""}`}
    >
      {label}
    </button>
  );
}
