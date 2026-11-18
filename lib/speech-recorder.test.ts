import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SPEECH_BITS_PER_SECOND, speechRecorderOptions } from "./speech-recorder";

/*
 * A take is recorded as speech (#508, the speed audit's fix 1): 32 kbps,
 * a quarter of the browser's default, so a minute goes up in about two
 * and a half seconds on mobile data rather than ten.
 */
const root = path.resolve(__dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");

describe("a take's recorder options", () => {
  it("records WebM Opus at 32 kbps where the browser has it", () => {
    expect(speechRecorderOptions(() => true)).toEqual({
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 32_000,
    });
    expect(SPEECH_BITS_PER_SECOND).toBe(32_000);
  });

  it("leaves the format to the browser where it does not, at the same bitrate", () => {
    const asked: string[] = [];
    const opts = speechRecorderOptions((m) => {
      asked.push(m);
      return false;
    });
    expect(opts).toEqual({ audioBitsPerSecond: 32_000 });
    expect(opts.mimeType).toBeUndefined();
    expect(asked).toEqual(["audio/webm;codecs=opus"]);
  });

  it("answers without a MediaRecorder at all (the server's render, a test)", () => {
    expect(speechRecorderOptions()).toEqual({ audioBitsPerSecond: 32_000 });
  });
});

describe("every recorder whose take leaves the phone records speech", () => {
  const files = globSync("{app,components,lib}/**/*.{ts,tsx}", { cwd: root }).filter(
    (f) => !f.endsWith(".test.ts")
  );
  const makers = files.flatMap((f) =>
    [...src(f).matchAll(/new MediaRecorder\(([^;]*?)\);/gs)].map((m) => ({ file: f, args: m[1] }))
  );

  it("finds the recorders", () => {
    expect(makers.map((m) => m.file).sort()).toEqual(["app/hostile/page.tsx", "app/rep/page.tsx", "app/rep/page.tsx"]);
  });

  it("the daily take and Hostile pass the speech options", () => {
    const sent = makers.filter((m) => !/^stream$/.test(m.args.trim()));
    expect(sent).toHaveLength(2);
    for (const m of sent) expect(m.args, m.file).toMatch(/speechRecorderOptions\(\)/);
  });

  it("the only other is the take's local video, which never leaves the phone", () => {
    const local = makers.filter((m) => /^stream$/.test(m.args.trim()));
    expect(local.map((m) => m.file)).toEqual(["app/rep/page.tsx"]);
    expect(src("app/rep/page.tsx")).toMatch(/videoRecorder = new MediaRecorder\(stream\);/);
  });
});
