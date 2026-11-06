import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bucket } from "@/components/ScoringWave";

/*
 * One clock for the take (games review, finding 1), held after the
 * regression review (edges F1). The recorder records from start(); its
 * "start" event is only queued. On a Voice + Video take the camera's
 * first inference ran before that event (a 3.6s long task in the
 * sandbox), and a listener that restarted the clock and emptied the
 * envelope there put the envelope 4s off the audio, so the server heard
 * speech in nearly every silence. These read the recorder's code in
 * app/rep/page.tsx, since the take runs only in a browser.
 */
describe("the take's clock", () => {
  const src = readFileSync("app/rep/page.tsx", "utf8");
  const start = src.indexOf("recorder.start(1000);");

  it("starts once, with recorder.start, and no recorder event restarts it", () => {
    expect(start).toBeGreaterThan(0);
    expect(src.indexOf("recorder.start(1000);", start + 1)).toBe(-1);
    expect(src).not.toMatch(/recorder\.addEventListener\(\s*["']start["']/);
    expect(src).not.toMatch(/recorder\.onstart\s*=/);
    const after = src.slice(start, start + 200);
    expect(after).toMatch(/clock\.startedAt = performance\.now\(\);\s*envelope\.length = 0;/);
  });

  it("starts the camera's frames after the take, on the same clock", () => {
    const pose = src.indexOf("samplePose(pose.video");
    expect(pose).toBeGreaterThan(start);
    expect(src.match(/samplePose\(/g)?.length).toBe(1);
  });

  it("sends the envelope marked as sampled on the take's clock", () => {
    expect(src).toMatch(/levels: \[\.\.\.r\.envelope\], rate: ENVELOPE_RATE, clock: true/);
  });
});

describe("the wait's wave", () => {
  it("draws a span the phone never heard at the floor, never as NaN", () => {
    const levels = [0.5, 0.5, NaN, NaN, NaN, NaN, 0.1, 0.1];
    const bars = bucket(levels, 4);
    expect(bars.every((v) => Number.isFinite(v))).toBe(true);
    expect(bars[1]).toBe(0);
    expect(bars[0]).toBe(1);
  });
});
