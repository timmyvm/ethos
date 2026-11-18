import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * A class in app/globals.css with nothing left to wear it (the 18 Nov
 * merge's review). Fourteen branches built in parallel deleted Today's
 * tiles, the Log's heatmap and the score card, and a deleted component's
 * rule stays standing unless something asks: `.card-score` and
 * `.intro-dot` were found by hand, `.tone-wash` (the heatmap's) only by
 * this test. A class is read when its name appears whole in a source
 * file under app, components, lib or content.
 *
 * `UNREAD` is the list from before that merge, each a rule nobody wears
 * that predates it; like lib/type-scale.test.ts's count it may only get
 * shorter. `tone-sun` and its kin are worn through `tone-${tone}`.
 */
const UNREAD = new Set([
  "arrive-lift",
  "arrive-x-back",
  "elev-0",
  "practice-stage-ink",
  "premium-card-slot",
  "premium-wall-behind",
  "premium-wall-glass",
  "stage-prompt",
  "tone-sun",
  "topic-card-lift",
  "you-gold",
]);

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\./.test(name)) out.push(path);
  }
  return out;
}

describe("every class the stylesheet defines has a reader", () => {
  it("leaves no deleted component's rule standing", () => {
    const css = readFileSync("app/globals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const defined = new Set([...css.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]).filter((c) => !/^[0-9a-z]{1,2}$/.test(c)));
    const src = ["app", "components", "lib", "content"].flatMap((d) => sources(d)).map((f) => readFileSync(f, "utf8")).join("\n");
    const unread = [...defined].filter((c) => !new RegExp(`(?<![A-Za-z0-9_-])${c.replace(/[-]/g, "\\-")}(?![A-Za-z0-9_-])`).test(src));
    expect(unread.filter((c) => !UNREAD.has(c))).toEqual([]);
    // The list only shrinks: a rule given a reader, or deleted, leaves it.
    expect([...UNREAD].filter((c) => !unread.includes(c))).toEqual([]);
  });
});
