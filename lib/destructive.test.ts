import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The delete red (#496, the morning tour, docs/look/tour/sheet-4-you-settings.jpg:
 * "Remove photo" stood in a red DESIGN and STATE never named). The call:
 * it stays iOS's own delete red, `--color-destructive` (#d70015 light,
 * #ff6961 dark), and it is named for one job, the words of a control
 * whose tap deletes or cancels something kept. It is not pointed at
 * rust: in light rust is #b2432c, terracotta-600, Stop's red, and D39
 * gave a delete its own red so that one means a take is running.
 *
 * Held here: the red stands only on controls that delete or cancel, in
 * the files that hold them, and a new use has to be named here first.
 */
const RED = /text-destructive|tone="destructive"/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("the delete red", () => {
  const css = readFileSync("app/globals.css", "utf8");
  /* The light tokens come first in the file; the dark ones restate them. */
  const light = css.match(/--color-destructive:\s*(#[0-9a-f]{6});/i)?.[1];
  const stop = css.match(/--color-terracotta-600:\s*(#[0-9a-f]{6});/i)?.[1];
  const rust = css.match(/--color-rust:\s*(#[0-9a-f]{6});/i)?.[1];

  it("is iOS's delete red, its own: never Stop's terracotta-600, never rust", () => {
    expect(light).toBe("#d70015");
    expect(light).not.toBe(stop);
    expect(light).not.toBe(rust);
    // Rust in light is Stop's own red, which is why a delete is not drawn in it.
    expect(rust).toBe(stop);
  });

  it("stands only where a tap deletes or cancels something kept", () => {
    const users = [...files("app"), ...files("components")].filter((f) => RED.test(readFileSync(f, "utf8"))).sort();
    expect(users).toEqual([
      "app/settings/data/page.tsx",
      "components/picture/PictureChoices.tsx",
      "components/premium/ManageSheet.tsx",
      "components/settings/Rows.tsx",
    ]);
    // Every red row says what it deletes or cancels.
    const labels = users.flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(/label=(?:"([^"]+)"|\{([^}]+)\})\s+tone="destructive"|tone="destructive"/g)].map((m) => m[1] ?? m[2] ?? "")
    );
    for (const label of labels.filter(Boolean)) expect(label).toMatch(/Delete|Remove|remove/);
    const data = readFileSync("app/settings/data/page.tsx", "utf8");
    expect(data.match(/text-destructive/g)?.length).toBe(3);
    for (const words of ["Delete recordings", "Delete my account", "Delete everything"]) expect(data).toContain(words);
    expect(readFileSync("components/premium/ManageSheet.tsx", "utf8").match(/text-destructive/g)?.length).toBe(1);
  });

  it("is a word's colour, never a fill", () => {
    for (const f of [...files("app"), ...files("components")]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/\b(bg|border|fill|stroke)-destructive\b/);
    }
    expect(css.replace(/--color-destructive:[^;]*;/g, "")).not.toMatch(/var\(--color-destructive\)/);
  });
});
