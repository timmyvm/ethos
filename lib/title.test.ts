import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { asTitle } from "./title";

/**
 * A title takes no full stop (#454, COPY-RULES.md): a heading, a card's
 * title, an error's title, a sheet's headline. Two sentences keep both
 * stops. What Demos says is speech and keeps its own.
 */
describe("a title cut from a line", () => {
  it("loses its one full stop", () => {
    expect(asTitle("Hold the room.")).toBe("Hold the room");
    expect(asTitle("Your first month.")).toBe("Your first month");
    expect(asTitle("  Think on your feet.  ")).toBe("Think on your feet");
  });

  it("is left alone when it has none, or is not a statement", () => {
    expect(asTitle("Premium opens everything")).toBe("Premium opens everything");
    expect(asTitle("Did 665 feel right?")).toBe("Did 665 feel right?");
    expect(asTitle("Loading...")).toBe("Loading...");
    expect(asTitle("")).toBe("");
  });

  it("keeps both stops when it holds two sentences", () => {
    expect(asTitle("22 days of numbers. Keep all of them.")).toBe("22 days of numbers. Keep all of them.");
    expect(asTitle("You had the point. It came out fuzzy.")).toBe("You had the point. It came out fuzzy.");
    expect(asTitle("Speed rush, level 1. 2.6s to spare.")).toBe("Speed rush, level 1. 2.6s to spare.");
  });

  it("does not take a decimal for a second sentence", () => {
    expect(asTitle("Ethos 2.0 is here.")).toBe("Ethos 2.0 is here");
  });
});

/** Every source file a title can be written in. */
function sources(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!/workbench|__/.test(entry.name)) walk(path);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        out.push({ path, text: readFileSync(join(process.cwd(), path), "utf8") });
      }
    }
  };
  for (const dir of ["app", "components", "content", "lib"]) walk(dir);
  return out;
}

/** One sentence that ends in a full stop: the thing a title may not be. */
const oneSentenceStop = (text: string) => /\.$/.test(text) && !/\.\.\.$/.test(text) && asTitle(text) !== text;

describe("no title in the app ends in a full stop", () => {
  const files = sources();

  it("no heading written in a screen does", () => {
    const found: string[] = [];
    for (const { path, text } of files) {
      if (!path.endsWith(".tsx")) continue;
      for (const m of text.matchAll(/<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>/g)) {
        // What Demos says is set in a bubble, never in a heading: any heading here is a title.
        const inner = m[2]
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
          .replace(/<[^>]+>/g, "")
          .replace(/&apos;/g, "'")
          .replace(/\s+/g, " ")
          .trim();
        // Only what is written out: a heading built from a variable is held where the variable is.
        if (!inner || /[{}]/.test(inner)) continue;
        if (oneSentenceStop(inner)) found.push(`${path}: "${inner}"`);
      }
    }
    expect(found).toEqual([]);
  });

  it("no title or headline handed to a component does", () => {
    /* Speech, said by Demos from his bubble, written as sentences:
       the introduction's steps and its beat, and the plan's headline,
       which You's road card cuts with asTitle. */
    const SPEECH = new Set(["lib/onboarding.ts", "content/portfolio.ts", "app/welcome/page.tsx"]);
    const found: string[] = [];
    for (const { path, text } of files) {
      if (SPEECH.has(path)) continue;
      for (const m of text.matchAll(/\b(title|headline)\s*[:=]\s*\{?\s*(["'`])((?:(?!\2)[^\n]){2,120}?)\2/g)) {
        const value = m[3].replace(/\$\{[^}]*\}/g, "x");
        if (oneSentenceStop(value)) found.push(`${path}: ${m[1]} "${m[3]}"`);
      }
    }
    expect(found).toEqual([]);
  });

  it("the plan's headline is speech where it is written and a title where You shows it", () => {
    const portfolio = readFileSync("content/portfolio.ts", "utf8");
    for (const line of ["Sharper in the room.", "Hold the room.", "Think on your feet.", "Talk to anyone.", "Your first month."]) {
      expect(portfolio).toContain(`"${line}"`);
    }
    const you = readFileSync("app/you/page.tsx", "utf8");
    expect(you).toContain("{asTitle(plan.headline)}");
    expect(you).not.toMatch(/\{plan\.headline\}/);
  });

  it("Hostile's line is a title on its own screen and a sentence in its row", () => {
    expect(readFileSync("lib/hostile.ts", "utf8")).toContain('HOSTILE_LINE = "Hold a claim while Demos comes at it"');
    expect(readFileSync("app/hostile/page.tsx", "utf8")).toContain('<h1 className="font-display mt-1.5 text-title">{HOSTILE_LINE}</h1>');
    expect(readFileSync("app/boss/page.tsx", "utf8")).toContain("{HOSTILE_LINE}.</span>");
  });
});
