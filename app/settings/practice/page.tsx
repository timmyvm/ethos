"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { LinkRow, PAGE_CLASS, Section, Toggle } from "@/components/settings/Rows";
import { readOnboarding } from "@/lib/answers";
import { liteGraphics } from "@/lib/graphics";
import { videoOffered } from "@/lib/pose-client";
import { DEFAULT_PREFS, readCaptureMode, readPrefs, writeCaptureMode, writePrefs, type Prefs } from "@/lib/prefs";
import { focusWord } from "@/lib/settings-index";

/**
 * Practice (#479): what changes how a recording runs, and only what the
 * recorder honours. The focus is the first thing the introduction heard
 * you notice (lib/portfolio.ts reads `pains[0]`): Lessons' Up next starts
 * on its trait and the recorder leads with its number. Video by default
 * is the daily recorder's own Voice and Video choice (lib/prefs.ts
 * `captureMode`), offered only where a take can be Video at all (#446);
 * think time is the frame step, thirty seconds before the clock (#35).
 * There is no recording length here: the recorder has none to set.
 */
export default function PracticeSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [video, setVideo] = useState(false);
  const [focus, setFocus] = useState<string | null | undefined>(undefined);
  /* Read before paint, so the Video row is never drawn and then taken away. */
  const [canVideo, setCanVideo] = useState(false);
  useLayoutEffect(() => setCanVideo(videoOffered(liteGraphics())), []);
  useEffect(() => {
    setPrefs(readPrefs());
    setVideo(readCaptureMode("daily") === "voice_video");
    setFocus(readOnboarding().answers.pains[0] ?? null);
  }, []);
  const update = (patch: Partial<Prefs>) => setPrefs(writePrefs(patch));

  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="Practice" back={{ href: "/settings", label: "Settings" }} />

      <Section title="What you work on" className="mt-5">
        <LinkRow href="/settings/practice/focus" label="Focus" value={focus === undefined ? null : focusWord(focus)} />
      </Section>

      <Section title="Recording">
        {canVideo && (
          <Toggle
            label="Start with video"
            note="The camera's numbers, measured on this phone. Video never uploads."
            on={video}
            onChange={(v) => {
              writeCaptureMode("daily", v ? "voice_video" : "voice");
              setVideo(v);
            }}
          />
        )}
        <Toggle
          label="Think time"
          note="30 seconds to plan before the clock starts."
          on={prefs.frameStep}
          onChange={(v) => update({ frameStep: v })}
        />
        <Toggle
          label="Verbatim transcripts"
          note="Keep every 'um' in the transcript. Off makes it prettier and the filler count wrong."
          on={prefs.verbatim}
          onChange={(v) => update({ verbatim: v })}
        />
        {/* The Presence bench (#187): four labeled takes tune the camera
            score's thresholds to a real body. Only where a take can be
            Video at all (#446). */}
        {canVideo && (
          <LinkRow href="/calibrate" label="Calibrate the camera score" note="Four short takes tune it to your body." />
        )}
      </Section>
    </main>
  );
}
