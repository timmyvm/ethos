"use client";

import { useRef, useState } from "react";
import { IconPlay } from "@/components/Icon";
import { PAGE_CLASS, Section } from "@/components/settings/Rows";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { CueRunner, playSound, unlockSound, type Playing } from "@/lib/sound";
import { countTicks, glanceCues, recipe, recipeLength, type Cue, type GlanceWin, type SoundId } from "@/lib/sound-recipes";

/**
 * The sound audition (#505; the workbench pattern, DECISIONS #255): every
 * sound the kit makes, played by the kit itself on the phone in your
 * hand, through its speaker, its limiter and its silent switch. Each
 * moment plays as the results play it, on the glance's clock. It plays
 * with Settings' Sound off (it is a button that says play), never before
 * the tap. The same renders as files: docs/sound-audition/index.html.
 */

/* The glance's clock as RepResult runs it: the count, then the stars 120 apart. */
const CLOCK = { landAfter: 600, starStep: 120, starMs: 300, reduced: false };

const MOMENTS: { name: string; win: GlanceWin | "xp" }[] = [
  { name: "One star", win: { stars: 1 } },
  { name: "Two stars", win: { stars: 2 } },
  { name: "Three stars, paid out", win: { stars: 3 } },
  { name: "A lesson done, two stars", win: { stars: 2, lessonDone: true } },
  { name: "A lesson done, three stars", win: { stars: 3, lessonDone: true } },
  { name: "A personal best", win: { stars: 2, best: true } },
  { name: "A level reached", win: { stars: 2, level: true } },
  { name: "The week's boss, three stars", win: { stars: 3, boss: true } },
  { name: "XP today, up 10", win: "xp" },
];

const SOUNDS: { name: string; id: SoundId }[] = [
  { name: "First star", id: "star-1" },
  { name: "Second star", id: "star-2" },
  { name: "Third star", id: "star-3" },
  { name: "The payout", id: "payout" },
  { name: "A lesson done", id: "lesson" },
  { name: "A level reached", id: "level" },
  { name: "A personal best", id: "best" },
  { name: "A round won", id: "round" },
  { name: "The boss done", id: "boss" },
  { name: "The streak", id: "streak" },
  { name: "The streak, 7 days", id: "streak-milestone" },
  { name: "One XP tick", id: "tick" },
];

function cuesFor(win: GlanceWin | "xp"): Cue[] {
  return win === "xp" ? countTicks(25.4, 31, 300) : glanceCues(win, CLOCK);
}

function seconds(cues: Cue[]): string {
  const end = Math.max(...cues.map((c) => c.atMs / 1000 + recipeLength(recipe(c.sound, c.step ?? 0))));
  return `${end.toFixed(1)}s`;
}

export default function SoundAudition() {
  const [playing, setPlaying] = useState<string | null>(null);
  const runner = useRef<CueRunner | null>(null);
  const sounding = useRef<Playing[]>([]);
  const done = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    runner.current?.cancel();
    sounding.current.forEach((p) => p.stop());
    sounding.current = [];
    if (done.current) clearTimeout(done.current);
  };

  const play = (key: string, cues: Cue[]) => {
    stop();
    unlockSound();
    runner.current = new CueRunner((c, delayMs) => {
      const p = playSound(c.sound, { step: c.step, force: true, delayS: delayMs / 1000 });
      if (p) sounding.current.push(p);
      return () => p?.stop();
    });
    runner.current.run(cues);
    setPlaying(key);
    const ms = Math.max(...cues.map((c) => c.atMs + recipeLength(recipe(c.sound, c.step ?? 0)) * 1000));
    done.current = setTimeout(() => setPlaying((k) => (k === key ? null : k)), ms + 600);
  };

  const row = (key: string, name: string, cues: Cue[]) => (
    <div key={key} className="group-row flex min-h-[56px] items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-body font-semibold">{name}</p>
        <p className="text-caption text-stone-500">{seconds(cues)}</p>
      </div>
      {/* Hear it back's key (components/AudioScrubber.tsx): surface,
          hairline, the play mark in terracotta. Twenty rows of filled
          taps would break the one-tap rule (principle 2). */}
      <button
        type="button"
        onClick={() => play(key, cues)}
        aria-label={`Play ${name}`}
        aria-pressed={playing === key}
        className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-edge bg-surface text-terracotta-500 aria-pressed:bg-raised"
      >
        <IconPlay size={16} />
      </button>
    </div>
  );

  return (
    <main className={PAGE_CLASS}>
      <ScreenHeader
        title="Sounds"
        back={{ href: "/settings/accessibility", label: "Accessibility" }}
        subtitle="Every sound Ethos plays. On an iPhone, turn the silent switch off to hear them."
      />
      <Section title="As the results play them" className="mt-5">
        {MOMENTS.map((m) => row(`m:${m.name}`, m.name, cuesFor(m.win)))}
      </Section>
      <Section title="Each sound alone">
        {SOUNDS.map((s) => row(`s:${s.id}`, s.name, [{ sound: s.id, atMs: 0, slot: s.id }]))}
      </Section>
    </main>
  );
}
