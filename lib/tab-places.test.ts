import { beforeEach, describe, expect, it } from "vitest";
import { forgetTab, leaveTab, resetTabPlaces, tabPlace } from "./tab-places";

/* A tab keeps its place (#443). */
describe("where a tab was left", () => {
  beforeEach(() => resetTabPlaces());

  it("is where it comes back to", () => {
    leaveTab("/history", 415);
    expect(tabPlace("/history")).toBe(415);
    expect(tabPlace("/")).toBe(0);
  });

  it("is one place per tab, the newest", () => {
    leaveTab("/you", 300);
    leaveTab("/you", 120.6);
    expect(tabPlace("/you")).toBe(121);
    leaveTab("/you", 0);
    expect(tabPlace("/you")).toBe(0);
  });

  it("is kept only for a tab's own screen", () => {
    leaveTab("/settings", 500);
    leaveTab("/lessons/the-cold-open", 200);
    leaveTab("/rep", 90);
    expect(tabPlace("/settings")).toBe(0);
    expect(tabPlace("/lessons/the-cold-open")).toBe(0);
  });

  it("is the top when the page as drawn is too short to hold it", () => {
    leaveTab("/history", 900);
    expect(tabPlace("/history", 2000)).toBe(900);
    expect(tabPlace("/history", 900)).toBe(900);
    expect(tabPlace("/history", 320)).toBe(0);
  });

  it("is forgotten when the tab is sent to its top", () => {
    leaveTab("/lessons", 640);
    forgetTab("/lessons");
    expect(tabPlace("/lessons")).toBe(0);
  });

  it("ignores a place that is not a number", () => {
    leaveTab("/history", Number.NaN);
    expect(tabPlace("/history")).toBe(0);
  });
});
