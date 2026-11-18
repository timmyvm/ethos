"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { InfoRow, PAGE_CLASS, Section, Toggle } from "@/components/settings/Rows";
import { applyMotion } from "@/components/Theme";
import { DEFAULT_PREFS, readPrefs, writePrefs, type Prefs } from "@/lib/prefs";
import { playSound, unlockSound } from "@/lib/sound";
import { hapticsHere } from "@/lib/tap-tick";
import { askedTextZoom } from "@/lib/text-size";

/**
 * Accessibility (#479): what helps someone read Ethos and hold the
 * phone. Each row is drawn only where the phone can do it (#446): Larger
 * text where the phone's text is set larger (#451), Haptics where it can
 * give one (#449). Increase Contrast is the phone's own switch, which
 * Ethos follows (#448), so it is a fact here, not a second switch.
 * Captions on playback wait for playback to have them.
 */
export default function AccessibilityPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  /* What this phone can do, read before paint, so no row is drawn and then taken away. */
  const [canBuzz, setCanBuzz] = useState(false);
  const [canGrow, setCanGrow] = useState(false);
  const [contrast, setContrast] = useState<boolean | null>(null);
  useLayoutEffect(() => {
    setCanBuzz(hapticsHere());
    setCanGrow(askedTextZoom() > 1);
  }, []);
  useEffect(() => {
    setPrefs(readPrefs());
    const q = window.matchMedia?.("(prefers-contrast: more)");
    if (!q) return;
    setContrast(q.matches);
    const on = () => setContrast(q.matches);
    q.addEventListener?.("change", on);
    return () => q.removeEventListener?.("change", on);
  }, []);
  const update = (patch: Partial<Prefs>) => setPrefs(writePrefs(patch));

  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="Accessibility" back={{ href: "/settings", label: "Settings" }} />

      <Section title="Reading" className="mt-5">
        {/* #451: Ethos is shown at the size the phone's text is set to.
            The size is read as the page loads, so the switch saves and
            loads the page again: the one path that is the same as
            opening the app. */}
        {canGrow ? (
          <Toggle
            label="Larger text"
            note="Follows your phone's text size."
            on={prefs.followTextSize}
            onChange={(v) => {
              update({ followTextSize: v });
              window.location.reload();
            }}
          />
        ) : (
          <InfoRow label="Text size" value="Default" note="Ethos grows with your phone's text size." />
        )}
        <InfoRow
          label="Increase contrast"
          value={contrast === null ? undefined : contrast ? "On" : "Off"}
          note="Ethos follows your phone's setting."
        />
      </Section>

      <Section title="Motion">
        <Toggle
          label="Reduced motion"
          note="Every animation becomes a plain fade. Your phone's own setting still counts."
          on={prefs.reducedMotion}
          onChange={(v) => {
            update({ reducedMotion: v });
            applyMotion(v);
          }}
        />
      </Section>

      <Section title={canBuzz ? "Sound and haptics" : "Sound"}>
        <Toggle
          label="Sound"
          note="Plays when you earn stars, finish a lesson or keep your streak."
          on={prefs.sound}
          onChange={(v) => {
            update({ sound: v });
            /* Turned on, it makes the kit's context in this tap and plays
               the one-star sound, so the switch says what it switched (#505). */
            if (v) {
              unlockSound();
              playSound("star-1", { force: true });
            }
          }}
        />
        {canBuzz && (
          <Toggle
            label="Haptics"
            note="A tap when recording starts and stops."
            on={prefs.haptics}
            onChange={(v) => update({ haptics: v })}
          />
        )}
      </Section>
    </main>
  );
}
