import { describe, expect, it } from "vitest";
import { hostileKey, isSideKey, uploadKey } from "./client-key";
import { newOutboxId } from "./rep-outbox";
import { CONSENT_VERSION } from "@/content/tester";
import { showsMatchCheck } from "./tester";

/** What /api/analyze accepts as a recording's key (app/api/analyze/route.ts). */
const ACCEPTED = /^[\w-]{1,200}$/;

/*
 * The keys an upload and a Hostile take travel under (#436). They exist
 * so a second try stores nothing new; these pin what makes that true.
 */
describe("an uploaded file's key", () => {
  const file = { name: "Team meeting 4 Nov.m4a", size: 3_145_728, lastModified: 1_762_222_000_000 };

  it("is the same for the same file, however many times it is picked", () => {
    expect(uploadKey(file)).toBe(uploadKey({ ...file }));
  });

  it("differs when the file does: its size, its date or its name", () => {
    const key = uploadKey(file);
    expect(uploadKey({ ...file, size: file.size + 1 })).not.toBe(key);
    expect(uploadKey({ ...file, lastModified: file.lastModified + 1000 })).not.toBe(key);
    expect(uploadKey({ ...file, name: "Team meeting 5 Nov.m4a" })).not.toBe(key);
  });

  it("is a key the route accepts, whatever the name holds", () => {
    for (const name of ["", "voice memo (2).m4a", "réunion – équipe.webm", "会议.mp3", "a".repeat(400), "../../etc/passwd"]) {
      expect(uploadKey({ ...file, name })).toMatch(ACCEPTED);
    }
    expect(uploadKey({ name: "x", size: Number.NaN, lastModified: Number.NaN })).toMatch(ACCEPTED);
  });

  it("never carries the file's name", () => {
    const key = uploadKey({ ...file, name: "performance-review-jordan.m4a" });
    expect(key).not.toMatch(/jordan|review|performance/i);
  });
});

describe("a Hostile take's key", () => {
  it("is a key the route accepts, and new for every take", () => {
    const a = hostileKey(1_762_800_000_000, () => 0.25);
    const b = hostileKey(1_762_800_000_000, () => 0.75);
    expect(a).toMatch(ACCEPTED);
    expect(a).not.toBe(b);
    expect(hostileKey(1, () => 0)).toMatch(ACCEPTED);
    expect(hostileKey(1, () => 0.999999999)).toMatch(ACCEPTED);
  });
});

describe("keys made off the recording screen", () => {
  const tester = { consent_version: CONSENT_VERSION, consented_at: "2026-10-30T09:00:00.000Z" };

  it("are told apart from the outbox's own", () => {
    expect(isSideKey(uploadKey({ name: "a.m4a", size: 1, lastModified: 1 }))).toBe(true);
    expect(isSideKey(hostileKey())).toBe(true);
    expect(isSideKey(newOutboxId("lesson:the-cold-open:1"))).toBe(false);
    expect(isSideKey(newOutboxId("upload"))).toBe(false);
  });

  it("ask a tester nothing, as before they had a key", () => {
    // The same tester is asked about a take made on the recording screen.
    expect(showsMatchCheck({ tester, scorable: true, clientId: newOutboxId("lesson:the-cold-open:1") })).toBe(true);
    const upload = uploadKey({ name: "a.m4a", size: 1, lastModified: 1 });
    expect(showsMatchCheck({ tester, scorable: true, clientId: upload })).toBe(false);
    expect(showsMatchCheck({ tester, scorable: true, clientId: hostileKey() })).toBe(false);
  });
});
