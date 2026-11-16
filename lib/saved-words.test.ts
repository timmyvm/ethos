import { describe, expect, it } from "vitest";
import { withRow, type SavedWord } from "./saved-words";

const row = (id: string, created_at: string): SavedWord => ({
  id,
  word: `w-${id}`,
  instead: `i-${id}`,
  sentence: null,
  rep_id: null,
  created_at,
});

/* The undo (#435): a row taken off goes back into its own place. */
describe("a row back in its place", () => {
  const a = row("a", "2026-11-10T09:00:00.000Z");
  const b = row("b", "2026-11-09T09:00:00.000Z");
  const c = row("c", "2026-11-08T09:00:00.000Z");

  it("lands where its date puts it, newest first", () => {
    expect(withRow([a, c], b).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(withRow([b, c], a).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(withRow([a, b], c).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(withRow([], b).map((r) => r.id)).toEqual(["b"]);
  });

  it("is never listed twice: a row already there leaves the list as it is", () => {
    const rows = [a, b, c];
    expect(withRow(rows, b)).toBe(rows);
  });

  it("does not change the list it was given", () => {
    const rows = [a, c];
    withRow(rows, b);
    expect(rows.map((r) => r.id)).toEqual(["a", "c"]);
  });
});
