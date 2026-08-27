import { describe, expect, it } from "vitest";
import { proposeConstants, type LabeledTake } from "./presence-fit";
import type { DeliveryMetrics } from "./presence";

function metrics(over: Partial<DeliveryMetrics>): DeliveryMetrics {
  return {
    gestureRate: 12,
    postureDrift: 0.018,
    headStability: 0.012,
    eyeLinePct: 88,
    headLift: 0.93,
    neckGap: 2.9,
    presenceScore: 700,
    ...over,
  };
}

function takes(): LabeledTake[] {
  return [
    { label: "composed", metrics: metrics({}) },
    {
      label: "slouch",
      metrics: metrics({ postureDrift: 0.11, headLift: 0.66, neckGap: 1.0 }),
    },
    { label: "look-away", metrics: metrics({ eyeLinePct: 18 }) },
    { label: "hands-hidden", metrics: metrics({ gestureRate: 1 }) },
  ];
}

describe("proposeConstants", () => {
  it("needs the composed take; everything anchors to it", () => {
    expect(proposeConstants([])).toBeNull();
    expect(
      proposeConstants([{ label: "slouch", metrics: metrics({}) }])
    ).toBeNull();
  });

  it("gives natural movement headroom on every good threshold", () => {
    const p = proposeConstants(takes())!;
    expect(p.postureGood).toBeGreaterThan(0.018);
    expect(p.headGood).toBeGreaterThan(0.012);
    expect(p.eyeGood).toBeLessThan(88);
  });

  it("bounds bad posture with the slouch take when it drifted", () => {
    const p = proposeConstants(takes())!;
    expect(p.postureBad).toBeLessThanOrEqual(0.11);
    expect(p.postureBad).toBeGreaterThan(p.postureGood);
  });

  it("keeps the ratio and says so when the slouch was motionless", () => {
    const still = takes().map((t) =>
      t.label === "slouch"
        ? { ...t, metrics: metrics({ postureDrift: 0.02 }) }
        : t
    );
    const p = proposeConstants(still)!;
    expect(p.warnings.join(" ")).toContain("slouch");
    expect(p.postureBad / p.postureGood).toBeCloseTo(0.12 / 0.02, 1);
  });

  it("floors the eye constants between composed and look-away", () => {
    const p = proposeConstants(takes())!;
    expect(p.eyeGood).toBeGreaterThan(p.eyeBad);
    expect(p.eyeBad).toBeGreaterThanOrEqual(18);
  });

  it("warns when look-away out-scores composed instead of proposing nonsense", () => {
    const broken = takes().map((t) =>
      t.label === "look-away"
        ? { ...t, metrics: metrics({ eyeLinePct: 95 }) }
        : t
    );
    const p = proposeConstants(broken)!;
    expect(p.warnings.join(" ")).toContain("look-away");
  });

  it("brackets the gesture zone around the composed rate", () => {
    const p = proposeConstants(takes())!;
    expect(p.gestureZone[0]).toBeLessThan(12);
    expect(p.gestureZone[1]).toBeGreaterThan(12);
  });

  it("refuses to invent a zone from a gesture-free composed take", () => {
    const stiff = takes().map((t) =>
      t.label === "composed" ? { ...t, metrics: metrics({ gestureRate: 0.5 }) } : t
    );
    const p = proposeConstants(stiff)!;
    expect(p.warnings.join(" ")).toContain("gesture");
  });

  it("fits the neck band between the composed and slouch gaps", () => {
    const p = proposeConstants(takes())!;
    expect(p.neckGood).toBeLessThan(2.9);
    expect(p.neckBad).toBeGreaterThanOrEqual(1.0);
    expect(p.neckGood).toBeGreaterThan(p.neckBad);
  });

  it("warns when the slouch take's neck stayed as open as the composed one's", () => {
    const shallow = takes().map((t) =>
      t.label === "slouch" ? { ...t, metrics: metrics({ neckGap: 2.8 }) } : t
    );
    const p = proposeConstants(shallow)!;
    expect(p.warnings.join(" ")).toContain("Slouch harder");
  });

  it("calls out a handheld camera instead of fitting to the shake", () => {
    // Above the whole scoring band (which #189 widened to real-body
    // values), the way an actual handheld session measured.
    const handheld = takes().map((t) =>
      t.label === "composed"
        ? { ...t, metrics: metrics({ postureDrift: 0.3 }) }
        : t
    );
    const p = proposeConstants(handheld)!;
    expect(p.warnings.join(" ")).toContain("CAMERA");
  });

  it("flags a hands-hidden take that still reads as gesturing", () => {
    const noisy = takes().map((t) =>
      t.label === "hands-hidden"
        ? { ...t, metrics: metrics({ gestureRate: 9 }) }
        : t
    );
    const p = proposeConstants(noisy)!;
    expect(p.warnings.join(" ")).toContain("hands-hidden");
  });
});
