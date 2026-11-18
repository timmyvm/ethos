import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CAPPED_DOOR,
  CAPPED_LINE,
  CAPPED_REASON,
  CAPPED_SHEET,
  FREE_ALLOWANCE,
  PRO_MOMENT_LINE,
  SCORED_BENEFIT,
} from "./allowance-copy";
import { countWords } from "./glance";
import { DAILY_GRANT, meter, meterStatus, type MeterState } from "./metering";

/*
 * #514, Timothy 19 Nov: "a free account gets a score 3 times a day
 * max", then "Nah give them a few recordings yo". Every line that states
 * the free allowance says the meter's own number.
 */
describe("the free allowance in words (#514)", () => {
  it("says 3 scored recordings a day, from the meter's own number", () => {
    expect(DAILY_GRANT).toBe(3);
    expect(FREE_ALLOWANCE).toBe("(free: 3 a day)");
    expect(CAPPED_REASON).toBe("3 scored recordings a day free");
    expect(PRO_MOMENT_LINE.replace(/\u00a0/g, " ")).toBe("Free shows the last 7 days and scores 3 recordings a day. Premium opens all of it.");
    // "a day" never breaks at "a" (the 390 shot ended a line on it).
    expect(PRO_MOMENT_LINE).toContain("a\u00a0day.");
    expect(`${SCORED_BENEFIT} ${FREE_ALLOWANCE}`).toBe("Every recording scored (free: 3 a day)");
  });

  it("says the score is back tomorrow, which the meter keeps: any new day tops a spent day back up to 3", () => {
    expect(CAPPED_LINE).toBe("Ethos score back tomorrow");
    expect(CAPPED_DOOR).toBe("Ethos score back tomorrow, or go Premium");
    expect(CAPPED_SHEET).toBe("Your Ethos score and Demos's read are back tomorrow. This one still counted toward your streak.");
    const spent: MeterState = { balance: 0, accruedOn: "2026-11-19", usedAt: "2026-11-19T10:00:00.000Z" };
    expect(meter({ state: spent, now: new Date(2026, 10, 19, 23, 30), premium: false }).allowed).toBe(false);
    expect(meterStatus({ state: spent, now: new Date(2026, 10, 20, 0, 5), premium: false }).available).toBe(DAILY_GRANT);
  });

  it("keeps the capped glance's line inside the old one's words plus four, and the door one line at 320", () => {
    // The glance's ceiling holds the cue with these (lib/glance.ts GLANCE_WORDS):
    // the door was 4 words, the grey line 3.
    expect(countWords(CAPPED_DOOR)).toBeLessThanOrEqual(7);
    expect(countWords(CAPPED_LINE)).toBeLessThanOrEqual(4);
    // Measured at text-link 13/600 in Outfit: 252px beside the 22px mark, in 280.
    expect(CAPPED_DOOR.length).toBeLessThanOrEqual(40);
    expect(CAPPED_DOOR).toMatch(/Premium/);
  });

  it("follows the copy rules: no dash, no rep, no full stop on a door", () => {
    for (const s of [FREE_ALLOWANCE, SCORED_BENEFIT, CAPPED_REASON, CAPPED_LINE, CAPPED_DOOR, CAPPED_SHEET, PRO_MOMENT_LINE]) {
      expect(s).not.toMatch(/[—–]/);
      expect(s).not.toMatch(/\breps?\b/i);
      expect(s).not.toMatch(/\b(judged|analys[ie]s)\b/i);
    }
    expect(CAPPED_DOOR).not.toMatch(/\.$/);
    expect(CAPPED_LINE).not.toMatch(/\.$/);
  });
});

describe("no surface states the old one-a-day rule", () => {
  const SURFACES = [
    "components/Paywall.tsx",
    "components/RepResult.tsx",
    "components/premium/PremiumHave.tsx",
    "app/rep/page.tsx",
    "app/page.tsx",
    "app/you/page.tsx",
    "app/shop/page.tsx",
    "app/settings/plan/page.tsx",
    "app/welcome/page.tsx",
    "app/(marketing)/about/page.tsx",
    "app/(marketing)/terms/page.tsx",
    "lib/onboarding.ts",
    "lib/plan-view.ts",
    "lib/wait.ts",
  ];
  it.each(SURFACES)("%s", (path) => {
    const src = readFileSync(path, "utf8");
    expect(src).not.toMatch(/free: 1 a day/);
    expect(src).not.toMatch(/1 a day free/);
    expect(src).not.toMatch(/reads one recording a day/);
    expect(src).not.toMatch(/Measured, not judged/);
    expect(src).not.toMatch(/Premium reads every recording/);
  });

  it("the paywall's first benefit is built from the meter's number", () => {
    const src = readFileSync("components/Paywall.tsx", "utf8");
    expect(src).toMatch(/keep\(SCORED_BENEFIT\)\} \{keep\(FREE_ALLOWANCE\)\}/);
  });
});
