import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DURATION,
  EASE_IN_OUT,
  EASE_OUT,
  EASE_SPRING,
  SPIN,
  spinAt,
  spinStop,
  spinTicks,
} from "./motion";

/**
 * The motion tokens live twice on purpose (DECISIONS #221): here, for
 * the animations JavaScript drives, and in app/globals.css, for the
 * ones CSS drives. Two copies drift unless something reads both, so
 * this does.
 */
const css = readFileSync("app/globals.css", "utf8");

function token(name: string): string | null {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

describe("motion tokens", () => {
  it("mirrors every duration into CSS", () => {
    expect(token("duration-fast")).toBe(`${DURATION.fast}ms`);
    expect(token("duration-base")).toBe(`${DURATION.base}ms`);
    expect(token("duration-max")).toBe(`${DURATION.max}ms`);
    expect(token("duration-celebrate")).toBe(`${DURATION.celebrate}ms`);
  });

  it("mirrors the easings, and makes them Tailwind's defaults", () => {
    expect(token("ease-out")).toBe(EASE_OUT);
    expect(token("ease-in-out")).toBe(EASE_IN_OUT);
    expect(token("ease-spring")).toBe(EASE_SPRING);
    expect(token("default-transition-timing-function")).toBe(EASE_OUT);
    expect(token("default-transition-duration")).toBe(`${DURATION.fast}ms`);
  });

  it("keeps every duration inside the motion rules", () => {
    expect(DURATION.fast).toBeLessThanOrEqual(DURATION.base);
    expect(DURATION.base).toBeLessThanOrEqual(DURATION.max);
    // Nothing past 300ms except a celebration, which may take 600, and
    // the spin, which has its own token below.
    expect(DURATION.max).toBeLessThanOrEqual(300);
    expect(DURATION.celebrate).toBeLessThanOrEqual(600);
  });
});

/**
 * The spin is the one motion past the celebration ceiling. It used to
 * live inside DURATION.max as a 300ms flick of three candidates; a
 * first-time user asked for a longer spin, and Timothy's live call
 * beats #278's "fast, on purpose". These pin it to a real slot-reel
 * spin without letting it drift into a wait.
 */
describe("the spin", () => {
  it("runs about two seconds, never past two and a half", () => {
    expect(SPIN.ms).toBeGreaterThanOrEqual(1800);
    expect(SPIN.ms).toBeLessThanOrEqual(2500);
  });

  it("flashes 15 to 25 candidates past, the landing included", () => {
    expect(SPIN.lead + 1).toBeGreaterThanOrEqual(15);
    expect(SPIN.lead + 1).toBeLessThanOrEqual(25);
  });

  const landing = SPIN.lead + 1;
  const stop = spinStop();

  it("starts in place, lands on the landing, and holds it to the end", () => {
    expect(spinAt(0, landing)).toBe(0);
    expect(spinAt(stop, landing)).toBeCloseTo(landing, 5);
    expect(spinAt(SPIN.ms, landing)).toBe(landing);
    // The stop leaves room for the bounce and the pop before hand-back.
    expect(stop + SPIN.pop).toBeLessThanOrEqual(SPIN.ms);
    expect(stop + SPIN.bounce * 2).toBeLessThanOrEqual(SPIN.ms);
  });

  it("only ever moves forward on the way in", () => {
    let prev = 0;
    for (let t = 0; t <= stop; t += 4) {
      const now = spinAt(t, landing);
      expect(now).toBeGreaterThanOrEqual(prev);
      prev = now;
    }
  });

  /* The review of the first build: a bezier that reached the swing at
     zero speed and left it at zero speed parked the reel nine pixels
     past the landing for 400ms, with the prompt's first line clipped
     and the next cell's ascenders showing. The swing must be small and
     moving: it arrives with speed, peaks early, and is back fast. */
  it("bounces past the landing a few pixels, moving, and is back inside the bounce", () => {
    let peak = 0;
    let peakAt = 0;
    for (let t = stop; t <= SPIN.ms; t += 2) {
      const past = spinAt(t, landing) - landing;
      if (past > peak) [peak, peakAt] = [past, t - stop];
    }
    expect(peak).toBeGreaterThan(0.02);
    expect(peak).toBeLessThanOrEqual(0.05);
    expect(peakAt).toBeLessThan(SPIN.bounce / 2);
    // Arrives moving: the last 16ms before the stop still covers ground.
    expect(landing - spinAt(stop - 16, landing)).toBeGreaterThan(0.02);
    for (let t = stop + SPIN.bounce; t <= SPIN.ms; t += 2) {
      // Under a pixel on the tallest cell (92px).
      expect(Math.abs(spinAt(t, landing) - landing)).toBeLessThan(0.01);
    }
  });

  it("is fast off the mark: a quarter of the cells go by in the first sixth", () => {
    expect(spinAt(stop / 6, landing)).toBeGreaterThan(landing / 4);
  });

  /* Replaces "past 60% of the distance by a third of the time", which
     pinned a brake so front-loaded the visible spin ended ~600ms before
     the stop. The eye and the hand have to agree on when it lands. */
  it("ticks space out as it brakes, and the last one falls just before the stop", () => {
    const ticks = spinTicks(landing);
    expect(ticks.length).toBeGreaterThan(6);
    const lastTick = ticks[ticks.length - 1];
    expect(lastTick).toBeLessThanOrEqual(stop);
    expect(stop - lastTick).toBeLessThanOrEqual(250);
    const gaps = ticks.slice(1).map((t, i) => t - ticks[i]);
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(SPIN.tickGap);
    // The last gaps are the longest: the brake is audible in the hand.
    expect(gaps[gaps.length - 1]).toBeGreaterThan(Math.min(...gaps) * 3);
    // The last four candidates tick past visibly late, in the final 40%.
    expect(ticks[ticks.length - 4]).toBeGreaterThan(stop * 0.6);
  });
});

/**
 * Never invent an animation duration inline (DESIGN.md, tokens). A Tailwind
 * `duration-500` on a component is exactly that, so the sweep looks
 * for one; `.dur-fast/base/max` are the classes that read the tokens.
 */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

describe("no inline durations", () => {
  const files = ["app", "components"].flatMap(tsxFiles);

  it("has files to check", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const file of files) {
    it(`reads durations from the tokens in ${file}`, () => {
      const source = readFileSync(file, "utf8");
      const inline = source.match(/\b(duration|delay)-\d+\b|\b(duration|delay)-\[/);
      expect(inline?.[0] ?? null).toBeNull();
    });
  }
});
