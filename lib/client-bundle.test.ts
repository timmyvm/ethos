import { existsSync, globSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * What the browser loads (#508, the speed audit). Read off the source:
 * every file that starts "use client" is an entry, and every static
 * import it makes (a type-only import is erased, a dynamic one is its own
 * chunk, loaded when it is asked for) is walked to the modules a phone
 * downloads and parses with it.
 */
const root = path.resolve(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) base = path.join(path.dirname(from), spec);
  else return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const f = path.normalize(base + ext);
    if (/\.(ts|tsx)$/.test(f) && existsSync(path.join(root, f))) return f;
  }
  return null;
}

/** The static, value-carrying imports of a file: [specifier]. */
function staticImports(src: string): string[] {
  const out: string[] = [];
  const decl = /^\s*(import|export)\s+([\s\S]*?)\s+from\s+["']([^"']+)["'];?/gm;
  for (const m of src.matchAll(decl)) {
    const clause = m[2].trim();
    if (/^type\b/.test(clause)) continue;
    const named = clause.match(/^\{([\s\S]*)\}$/);
    if (named) {
      const parts = named[1].split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0 && parts.every((p) => /^type\s/.test(p))) continue;
    }
    out.push(m[3]);
  }
  for (const m of src.matchAll(/^\s*import\s+["']([^"']+)["'];?/gm)) out.push(m[1]);
  return out;
}

const entries = globSync("{app,components,lib}/**/*.{ts,tsx}", { cwd: root }).filter(
  (f) => !f.endsWith(".test.ts") && /^\s*["']use client["']/.test(read(f))
);

/** Every module a set of entries pulls in statically, and the packages named on the way. */
function reach(from: string[]): { files: Map<string, string>; packages: Map<string, string> } {
  const files = new Map<string, string>();
  const packages = new Map<string, string>();
  const queue = from.map((f) => [f, f] as const);
  for (const f of from) files.set(f, f);
  while (queue.length) {
    const [file, via] = queue.shift()!;
    for (const spec of staticImports(read(file))) {
      const target = resolve(file, spec);
      if (target === null) {
        if (!spec.startsWith(".") && !spec.startsWith("@/") && !packages.has(spec)) packages.set(spec, `${via} > ${file}`);
        continue;
      }
      if (files.has(target)) continue;
      files.set(target, `${via} > ${file}`);
      queue.push([target, `${via} > ${file}`]);
    }
  }
  return { files, packages };
}

describe("the browser's bundle", () => {
  const all = reach(entries);

  it("walks the app (the walker is reading imports at all)", () => {
    expect(entries.length).toBeGreaterThan(50);
    expect(all.files.has("lib/hostile.ts")).toBe(true);
    expect(all.files.has("lib/supabase-browser.ts")).toBe(true);
  });

  it("carries no zod: the model's answers are checked on the server (fix 2)", () => {
    expect(all.files.get("lib/zod.ts")).toBeUndefined();
    expect(all.packages.get("zod")).toBeUndefined();
    expect(all.packages.get("zod/mini")).toBeUndefined();
  });

  it("never reaches a server-only file", () => {
    const server = [...all.files.keys()].filter((f) => /^\s*import\s+["']server-only["']/m.test(read(f)));
    expect(server.map((f) => `${f} via ${all.files.get(f)}`)).toEqual([]);
  });
});

/** The client components the root layout draws on every page (its static imports that start "use client"). */
function layoutParts(): string[] {
  return staticImports(read("app/layout.tsx"))
    .map((spec) => resolve("app/layout.tsx", spec))
    .filter((f): f is string => f !== null && /^\s*["']use client["']/.test(read(f)));
}

describe("the code every page carries (fix 18)", () => {
  const parts = layoutParts();
  const shared = reach(parts);

  it("is read from the layout (the command menu, the bar, the gate)", () => {
    expect(parts).toContain("components/CommandMenu.tsx");
    expect(parts).toContain("components/Nav.tsx");
    expect(parts).toContain("components/LazyAuthNote.tsx");
  });

  it("holds neither the command menu's list nor the 365 topics under it", () => {
    for (const f of ["lib/commands.ts", "content/lessons.ts", "lib/topics.ts", "lib/portfolio.ts"]) {
      expect(shared.files.get(f), f).toBeUndefined();
    }
  });
});

describe("the paywall loads when it is asked for (fix 18)", () => {
  const sheet = ["components/Paywall.tsx", "components/premium/Stair.tsx", "components/premium/PlanCard.tsx"];
  for (const page of ["app/page.tsx", "app/history/page.tsx", "app/games/page.tsx", "app/rep/page.tsx", "app/rep/[id]/page.tsx", "app/boss/page.tsx"]) {
    it(page, () => {
      const r = reach([page]);
      for (const f of sheet) expect(r.files.get(f), f).toBeUndefined();
      expect(r.files.has("components/LazyPaywall.tsx")).toBe(true);
    });
  }
});

export { reach, entries, staticImports };
