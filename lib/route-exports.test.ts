import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A route file may export only its handlers and Next's segment config.
 * Any other value export (a helper, a constant) passes `tsc` and the
 * whole suite, then fails `next build` with "is not a valid Route export
 * field". Helpers live in `lib/`. Type exports are fine: they vanish.
 */
const ALLOWED = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "runtime",
  "maxDuration",
  "dynamic",
  "dynamicParams",
  "revalidate",
  "fetchCache",
  "preferredRegion",
  "generateStaticParams",
]);

const APP = path.resolve(__dirname, "../app");

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return routes(p);
    return /^route\.(ts|tsx|js)$/.test(name) ? [p] : [];
  });
}

/** Value exports a file makes, by name. Type and interface exports are skipped. */
function valueExports(src: string): string[] {
  const names: string[] = [];
  const decl =
    /^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
  for (const m of src.matchAll(decl)) names.push(m[1]);
  for (const m of src.matchAll(/^export\s+default\b/gm)) names.push(`default@${m.index}`);
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(",")) {
      const item = part.trim();
      if (!item || item.startsWith("type ")) continue;
      names.push(item.split(/\s+as\s+/).pop()!.trim());
    }
  }
  return names;
}

describe("route files", () => {
  const files = routes(APP);

  it("are found", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("export only handlers and segment config", () => {
    for (const f of files) {
      const bad = valueExports(readFileSync(f, "utf8")).filter((n) => !ALLOWED.has(n));
      expect(bad, path.relative(APP, f)).toEqual([]);
    }
  });

  it("catch a helper exported beside a handler", () => {
    const src = [
      'export const runtime = "nodejs";',
      "export const SLACK = 1;",
      "export function helper() {}",
      "export async function POST() {}",
      "export interface Body { a: number }",
      "export type Kind = 'a';",
    ].join("\n");
    expect(valueExports(src).filter((n) => !ALLOWED.has(n))).toEqual(["SLACK", "helper"]);
  });
});
