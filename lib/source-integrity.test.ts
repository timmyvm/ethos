import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

/*
 * A merge that leaves its markers behind, or splits a block, can pass
 * tsc and every unit test when it lands in CSS, which only the build
 * compiles: the 16 Nov room merge (#475) left a "=======" and a broken
 * comment in app/globals.css and the production build failed on it.
 * These two checks catch that in the unit run.
 */
const ROOTS = ["app", "components", "lib", "content", "scripts", "supabase"];
const EXT = /\.(ts|tsx|mjs|js|css|sql)$/;

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}

describe("the source after a merge", () => {
  it("holds no conflict markers", () => {
    const marked = ROOTS.flatMap(files).filter((f) =>
      /^(<<<<<<<|=======|>>>>>>>)( |$)/m.test(readFileSync(f, "utf8"))
    );
    expect(marked).toEqual([]);
  });

  it("parses app/globals.css whole", () => {
    expect(() => postcss.parse(readFileSync("app/globals.css", "utf8"))).not.toThrow();
  });
});
