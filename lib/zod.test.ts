import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "./zod";

const ROOT = path.resolve(__dirname, "..");

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/*
 * The page's policy has no 'unsafe-eval'. zod 4 tries `new Function` once
 * unless it is told not to, and the browser reports the refusal on every
 * page that loads a schema (found in the browser, 11 Nov; no unit test
 * saw it).
 */
describe("zod never tries eval here", () => {
  it("is set jitless before any schema is made", () => {
    expect(z.config().jitless).toBe(true);
  });

  it("is imported from lib/zod.ts and nowhere else", () => {
    const direct = ["app", "components", "lib", "content"]
      .flatMap((d) => sources(path.join(ROOT, d)))
      .filter((f) => !f.endsWith(path.join("lib", "zod.ts")))
      .filter((f) => /from\s+["']zod(\/[^"']*)?["']/.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(ROOT, f));
    expect(direct).toEqual([]);
  });
});
