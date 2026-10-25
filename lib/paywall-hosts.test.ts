import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every page that opens the paywall honours `paywall=1` (docs/ladder-spec.md,
 * "Needs an account"). The sheet's account doors and Checkout's back arrow
 * send someone to the page they were on plus `paywall=1`; a page that does
 * not mount `usePaywallReturn` lands them on a bare page with the flag stuck
 * in the address, and the sheet's "you'll come back here" is false.
 *
 * Source-level, like lib/way-out.test.ts: the failure is a page that forgets
 * the hook. A page whose state cannot survive a reload (the debrief on /rep)
 * names a page that can instead, with `returnTo`.
 */
function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "workbench" ? [] : pages(full);
    return entry === "page.tsx" ? [full] : [];
  });
}

/** Each `<Paywall …>` opening tag in a file, props and all. */
function paywallTags(source: string): string[] {
  return source.match(/<Paywall\b[\s\S]*?\/?>/g) ?? [];
}

describe("the pages that open the paywall", () => {
  const hosts = pages("app").filter((f) => paywallTags(readFileSync(f, "utf8")).length > 0);

  it("are found (so a bad glob can't pass silently)", () => {
    expect(hosts.length).toBeGreaterThanOrEqual(8);
  });

  for (const file of hosts) {
    it(`${file} reopens the sheet on paywall=1, or sends the way back elsewhere`, () => {
      const source = readFileSync(file, "utf8");
      const mounted = /\busePaywallReturn\(/.test(source);
      const unreturned = paywallTags(source).filter((tag) => !/\breturnTo=/.test(tag));
      expect(mounted || unreturned.length === 0).toBe(true);
    });
  }
});
