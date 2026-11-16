import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * #486 (Timothy, 16 Nov: "Total stars is a useless feature remove it").
 * No screen sums every lesson's stars into a number: not Today's header
 * chip, not the Log's stage ("22 recordings, 35 stars"), not You's road
 * card ("Pace Control opens in 4 stars"), not the results' gains ("35 of
 * 87 stars"). A lesson's own 0 to 3 stars stay where they are earned:
 * on its row, its practice, the results' row of three.
 *
 * The rendered surfaces are every file under app/ and components/; the
 * workbench's sketches are not screens anyone is sent to.
 */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path.includes("workbench") ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}
const surfaces = [...sources("app"), ...sources("components")].map(
  (file) => [file, readFileSync(file, "utf8")] as const
);

describe("no total of stars on any screen", () => {
  it("reads the surfaces", () => {
    expect(surfaces.length).toBeGreaterThan(50);
  });

  it("never sums the stars, or carries a sum, onto a screen", () => {
    for (const [file, src] of surfaces) {
      for (const sum of [/\btotalStars\b/, /\bMAX_STARS\b/, /\bstarsAfter\b/, /\bstarsBefore\b/, /\brepGains\b/, /\bjourneySummary\b/]) {
        expect(src, `${file} ${sum}`).not.toMatch(sum);
      }
    }
  });

  it("takes the count off Today's header, the Log's stage and You's road card", () => {
    const today = readFileSync("app/page.tsx", "utf8");
    expect(today).not.toMatch(/IconStar|\} stars`/);
    expect(today).toContain("<StreakBadge streak={streak} />");

    const card = readFileSync("components/ScoreCard.tsx", "utf8");
    expect(card).not.toMatch(/\bstars\??:\s*number/);
    expect(card).not.toMatch(/"stars?"/);
    expect(readFileSync("app/history/page.tsx", "utf8")).not.toMatch(/stars=\{/);
    expect(readFileSync("app/(marketing)/about/page.tsx", "utf8")).not.toMatch(/stars=\{/);

    const you = readFileSync("app/you/page.tsx", "utf8");
    expect(you).not.toMatch(/opens in \$\{|stars=\{/);
  });

  it("keeps each lesson's own stars", () => {
    expect(readFileSync("components/Stars.tsx", "utf8")).toMatch(/of \$\{total\} stars/);
    expect(readFileSync("app/history/page.tsx", "utf8")).toContain("<Stars n={r.stars}");
  });
});
