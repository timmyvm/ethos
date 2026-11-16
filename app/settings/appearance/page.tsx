"use client";

import { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Segmented } from "@/components/ui/Segmented";
import { PAGE_CLASS, Section, Toggle } from "@/components/settings/Rows";
import { applyMotion, applyTheme } from "@/components/Theme";
import { applyGraphics, liteWhy, type LiteWhy } from "@/lib/graphics";
import { DEFAULT_PREFS, readPrefs, writePrefs, type Prefs, type Theme } from "@/lib/prefs";

/* The three answers (#286, the OS first), spelled as lib/theme.test.ts
   reads them, then labelled for the Segmented. */
const THEMES = (["system", "light", "dark"] as const satisfies readonly Theme[]).map((t) => ({
  value: t,
  label: `${t[0].toUpperCase()}${t.slice(1)}`,
}));

/**
 * Appearance (#479): the theme, and Lite graphics for a phone that
 * struggles (#412). What helps someone read and hold the phone is on
 * Accessibility.
 */
export default function AppearancePage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  /** Why this device went lite by itself (#412), read after mount. */
  const [why, setWhy] = useState<LiteWhy | null>(null);
  useEffect(() => {
    setPrefs(readPrefs());
    setWhy(liteWhy());
  }, []);
  const update = (patch: Partial<Prefs>) => setPrefs(writePrefs(patch));

  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader title="Appearance" back={{ href: "/settings", label: "Settings" }} />

      <Section title="Theme" className="mt-5" footer="System follows your phone's light and dark.">
        <div className="group-row">
          {/* One tab stop, the arrows move the choice, 40px segments in a 44px track. */}
          <Segmented
            label="Theme"
            options={THEMES}
            value={prefs.theme}
            onChange={(t) => {
              update({ theme: t });
              applyTheme(t);
            }}
          />
        </div>
      </Section>

      <Section title="Graphics">
        {/* #412: the switch shows what the phone draws now, chosen or not;
            once touched, it is the person's and the device's guesses
            stand aside. */}
        <Toggle
          label="Lite graphics"
          note={liteNote(prefs.liteGraphics === null ? why : null)}
          on={prefs.liteGraphics ?? why !== null}
          onChange={(v) => {
            update({ liteGraphics: v });
            applyGraphics(v);
            applyMotion(prefs.reducedMotion);
          }}
        />
      </Section>
    </main>
  );
}

/** What the Lite graphics switch says under it (#412). */
function liteNote(why: LiteWhy | null): string {
  const what = "Demos stands still and nothing blurs or loops, for phones that struggle.";
  if (why === "crash") return `On because Ethos closed on this phone. ${what}`;
  if (why === "gpu") return `On because this phone's graphics gave out. ${what}`;
  if (why === "device") return `On for this iPhone. ${what}`;
  return what;
}
