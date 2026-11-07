import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hushOthers, shouldStop, soundsOver } from "@/components/TakeAudio";

/*
 * The take's one audio element (components/TakeAudio.tsx, #424), the
 * playback side the review of #424 found untested: a moment stops at its
 * end, one sound plays at a time on the screen, every screen that holds
 * the take renders its element, and the results walk stops it on a step
 * change. The decisions are pure helpers tested here; their wiring is
 * read off the source, the way lib/walk-regressions.test.ts reads the walk.
 */
const root = path.resolve(__dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");

/** A stand-in for an <audio> or <video>: what the helpers read, and whether pause() was called. */
function media(o: { muted?: boolean; paused?: boolean } = {}) {
  const m = { muted: o.muted ?? false, paused: o.paused ?? false, paused_by_us: false, pause() {
    m.paused = true;
    m.paused_by_us = true;
  } };
  return m;
}

describe("a moment stops where its pause has played", () => {
  it("never stops a play that was given no end", () => {
    expect(shouldStop(0, null)).toBe(false);
    expect(shouldStop(999, null)).toBe(false);
  });
  it("plays on until its end, and stops there or past it", () => {
    expect(shouldStop(16.2, 17.4)).toBe(false);
    expect(shouldStop(17.4, 17.4)).toBe(true);
    expect(shouldStop(17.65, 17.4)).toBe(true);
  });
  it("stops a moment that starts at 0", () => {
    expect(shouldStop(0, 2.2)).toBe(false);
    expect(shouldStop(2.25, 2.2)).toBe(true);
  });
});

describe("one sound on the screen at a time", () => {
  it("counts any other player that is not muted as sounding over the take", () => {
    const take = media();
    expect(soundsOver(media(), take)).toBe(true);
    expect(soundsOver(take, take)).toBe(false);
    // The camera's self-view is muted and never stops the take.
    expect(soundsOver(media({ muted: true }), take)).toBe(false);
    expect(soundsOver(null, take)).toBe(false);
    expect(soundsOver({ tagName: "DIV" }, take)).toBe(false);
  });

  it("pauses every other player that is playing when a moment plays, and nothing else", () => {
    const take = media();
    const video = media();
    const selfView = media({ muted: true });
    const idle = media({ paused: true });
    hushOthers([take, video, selfView, idle], take);
    expect(video.paused_by_us).toBe(true);
    expect(take.paused_by_us).toBe(false);
    expect(selfView.paused_by_us).toBe(false);
    expect(idle.paused_by_us).toBe(false);
  });

  it("is wired both ways in the hook: a play hushes the others, another's play stops the take", () => {
    const hook = src("components/TakeAudio.tsx");
    // play() hushes the page's other media before it starts the take.
    const play = hook.slice(hook.indexOf("const play = useCallback"), hook.indexOf("const pause = useCallback"));
    expect(play).toMatch(/hushOthers\(document\.querySelectorAll<HTMLMediaElement>\("audio, video"\), a\);\s*(\/\*[\s\S]*?\*\/\s*)?a\.play\(\)/);
    // Media events do not bubble: the document listens in the capture phase.
    expect(hook).toMatch(/document\.addEventListener\("play", onPlay, true\)/);
    expect(hook).toMatch(/document\.removeEventListener\("play", onPlay, true\)/);
    expect(hook).toMatch(/if \(soundsOver\(e\.target, ref\.current\)\) ref\.current\?\.pause\(\);/);
    // The span's end is the helper's decision.
    expect(hook).toMatch(/onTimeUpdate=\{\(e\) => \{\s*if \(shouldStop\(e\.currentTarget\.currentTime, stopAt\.current\)\) e\.currentTarget\.pause\(\);/);
  });

  it("the Premium Playback card is a video with sound on the moments' step, so it must give way", () => {
    // The clip records the whole stream, voice included (app/rep/page.tsx),
    // and its <video> is not muted: without the rule above it plays over a moment.
    expect(src("app/rep/page.tsx")).toMatch(/videoRecorder = new MediaRecorder\(stream\)/);
    const card = src("components/PresenceCard.tsx");
    const video = card.slice(card.indexOf("<video"), card.indexOf("/>", card.indexOf("<video")));
    expect(video).toMatch(/\bcontrols\b/);
    expect(video).not.toMatch(/\bmuted\b/);
  });
});

describe("every screen that holds the take renders it, and the walk stops it", () => {
  const holders = globSync("{app,components}/**/*.tsx", { cwd: root }).filter(
    (f) => f !== "components/TakeAudio.tsx" && /useTakeAudio\(/.test(src(f))
  );

  it("is held by the live results, a stored recording and an upload", () => {
    expect(holders.sort()).toEqual(["app/rep/[id]/page.tsx", "app/rep/page.tsx", "app/upload/page.tsx"]);
  });

  for (const f of ["app/rep/[id]/page.tsx", "app/rep/page.tsx", "app/upload/page.tsx"]) {
    it(`${f} renders the take's element once and hands the take to the Pause row`, () => {
      const page = src(f);
      expect(page.match(/\{take\.element\}/g)).toHaveLength(1);
      expect(page).toMatch(/<RepResult[\s\S]*?take=\{take\}/);
      expect(page).toMatch(/<AudioScrubber[\s\S]*?take=\{take\}/);
    });
  }

  /* #427: no steps are left to leave. The felt question going still
     stops the take; the door's sheet does not, so a moment started on
     the glance keeps playing in Hear it back under it. */
  it("the results pause the take when the felt question goes, and never on the door", () => {
    const page = src("app/rep/page.tsx");
    const results = page.slice(page.indexOf("function Results("));
    expect(results).toMatch(/const take = useTakeAudio\(audioUrl, result\.metrics\.durationS\);/);
    expect(results).toMatch(/const stopTake = take\.pause;\s*useEffect\(\(\) => \{\s*stopTake\(\);\s*\}, \[askingFelt, stopTake\]\);/);
    expect(results).not.toMatch(/\[sheetOpen[^\]]*stopTake\]/);
  });

  it("the Pause row is handed a take only when it can play", () => {
    expect(src("components/DimensionList.tsx")).toMatch(/<PauseMoments moments=\{moments\} take=\{take\?\.playable \? take : null\} \/>/);
  });
});
