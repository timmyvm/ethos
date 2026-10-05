import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The type scale's ratchet (system-2, PRINCIPLES 3).
 *
 * Every size is meant to be a token: `text-title`, `text-lead`,
 * `text-body`, `text-caption`, the copy steps `text-detail`, `text-read`,
 * `text-row`, `text-link`, `text-suffix`, and the number steps
 * `text-num-xl` … `text-num-s` (app/globals.css). The audit counted 21
 * rendered sizes and 255 bracketed ones, so a ban would fail on day one.
 * This counts them instead and fails if the count goes UP: a new screen
 * cannot add a 13.5px, and each package that moves a size onto the
 * scale lowers BASELINE to the new count.
 *
 * rem as well as px, so `text-[1rem]` cannot slip past.
 */
// Phase C: 255 → 1 (the splash wordmark's 22px, a brand mark rather
// than a step of the scale).
const BASELINE = 1;

const ROOT = path.resolve(__dirname, "..");
const ARBITRARY_SIZE = /text-\[\d+(?:\.\d+)?(?:px|rem)\]/g;

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function census() {
  const bySize = new Map<string, number>();
  let total = 0;
  for (const file of [...tsxFiles(path.join(ROOT, "app")), ...tsxFiles(path.join(ROOT, "components"))]) {
    for (const m of readFileSync(file, "utf8").matchAll(ARBITRARY_SIZE)) {
      total += 1;
      bySize.set(m[0], (bySize.get(m[0]) ?? 0) + 1);
    }
  }
  return { total, bySize };
}

describe("the type scale", () => {
  it("counts arbitrary text sizes and never lets the count rise", () => {
    const { total, bySize } = census();
    const top = [...bySize.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, n]) => `${k} ${n}`)
      .join(", ");
    // Printed on every run, so the number is visible, not just a pass.
    console.log(`type scale: ${total} arbitrary text-[N] sizes (baseline ${BASELINE}); most used: ${top}`);
    expect(
      total,
      `${total} arbitrary text sizes, over the baseline of ${BASELINE}. Use a token (text-row, text-link, text-num-m …) instead.`
    ).toBeLessThanOrEqual(BASELINE);
  });

  it("catches rem as well as px", () => {
    const sample = 'className="text-[1rem] text-[13.5px] text-[15px] text-body"';
    expect(sample.match(ARBITRARY_SIZE)).toEqual(["text-[1rem]", "text-[13.5px]", "text-[15px]"]);
  });
});
