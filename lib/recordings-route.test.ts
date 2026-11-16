import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { fakeDb, type FakeDb } from "./billing-fakes";

/**
 * DELETE /api/recordings (#479): Settings' "Delete my recordings". Every
 * recording on the caller's account and its audio, the audio first, the
 * account and everyone else's recordings untouched; a failure part way
 * says what is still there and is safe to run again.
 */

const OWNER = "6f1c2b9e-0d4a-4c1e-9a77-3b2f5e8d1c40";
const OTHER = "0b7d4c1a-5e2f-4a3b-8c9d-1e2f3a4b5c6d";

const h = vi.hoisted(() => ({
  db: null as unknown,
  sessions: new Map<string, { id: string; anonymous: boolean; email: string | null }>(),
}));

vi.mock("@/lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db")>()),
  supabaseAdmin: () => h.db,
  getUserFromAuthHeader: vi.fn(async (header: string | null) => {
    if (!header?.startsWith("Bearer ")) return null;
    return h.sessions.get(header.slice(7)) ?? null;
  }),
}));

import { DELETE } from "@/app/api/recordings/route";

let db: FakeDb;

beforeEach(() => {
  db = fakeDb([OWNER, OTHER]);
  h.db = db.asClient();
  h.sessions.clear();
  h.sessions.set("tok_owner", { id: OWNER, anonymous: false, email: "a@example.com" });
  h.sessions.set("tok_guest", { id: OTHER, anonymous: true, email: null });
  db.put("reps", { id: "r1", user_id: OWNER, audio_path: "reps/1-rep.webm" });
  db.put("reps", { id: "r2", user_id: OWNER, audio_path: null });
  db.put("reps", { id: "r3", user_id: OWNER, audio_path: "reps/3-rep.webm" });
  db.put("reps", { id: "r4", user_id: OTHER, audio_path: "reps/4-rep.webm" });
  db.put("profiles", { user_id: OWNER, display_name: "Tim" });
});

function del(token?: string): Promise<Response> {
  const headers = new Headers(token ? { authorization: `Bearer ${token}` } : {});
  return DELETE({ headers } as unknown as NextRequest);
}

const repsOf = (id: string) => db.state.tables.reps.filter((r) => r.user_id === id).map((r) => r.id);

describe("deleting every recording", () => {
  it("takes the caller's recordings and their audio, and nothing else", async () => {
    const res = await del("tok_owner");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: 3 });
    expect(repsOf(OWNER)).toEqual([]);
    expect(db.state.removedAudio.sort()).toEqual(["reps/1-rep.webm", "reps/3-rep.webm"]);
    // Someone else's recording, and the account itself, stay.
    expect(repsOf(OTHER)).toEqual(["r4"]);
    expect(db.row("profiles", OWNER)).toMatchObject({ display_name: "Tim" });
    expect(db.state.deletedUsers).toEqual([]);
  });

  it("removes the audio before the rows that hold its paths", async () => {
    await del("tok_owner");
    const order = db.state.log.filter((l) => l.table === "reps").map((l) => l.op);
    expect(order).toEqual(["select", "delete"]);
    expect(db.state.removedAudio.length).toBe(2);
  });

  it("works for a guest, on the guest's own recordings", async () => {
    const res = await del("tok_guest");
    expect(res.status).toBe(200);
    expect(repsOf(OTHER)).toEqual([]);
    expect(repsOf(OWNER)).toEqual(["r1", "r2", "r3"]);
  });

  it("says nothing was there to delete as zero, not as a failure", async () => {
    db.state.tables.reps = [];
    const res = await del("tok_owner");
    expect(await res.json()).toEqual({ ok: true, deleted: 0 });
  });

  it("needs a session", async () => {
    expect((await del()).status).toBe(401);
    expect((await del("tok_forged")).status).toBe(401);
    expect(repsOf(OWNER).length).toBe(3);
  });

  it("deletes nothing when the recordings cannot be read", async () => {
    db.state.fail.push({ table: "reps", op: "select", error: { code: "XX000", message: "down" } });
    const res = await del("tok_owner");
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/Nothing was deleted/);
    expect(repsOf(OWNER).length).toBe(3);
    expect(db.state.removedAudio).toEqual([]);
  });

  it("keeps every row when the audio does not delete, so a second try finds the paths", async () => {
    db.state.fail.push({ table: "storage:audio", op: "remove", error: { code: "500", message: "storage down" } });
    const res = await del("tok_owner");
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/still here/);
    expect(repsOf(OWNER).length).toBe(3);
    // And the second try finishes.
    const again = await del("tok_owner");
    expect(again.status).toBe(200);
    expect(repsOf(OWNER)).toEqual([]);
  });

  it("says the audio went when only the rows failed, and a retry finishes", async () => {
    db.state.fail.push({ table: "reps", op: "delete", error: { code: "XX000", message: "down" } });
    const res = await del("tok_owner");
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/audio is deleted/);
    expect((await del("tok_owner")).status).toBe(200);
    expect(repsOf(OWNER)).toEqual([]);
  });

  it("reads every page of a long history, so no audio outlives its row (review)", async () => {
    // PostgREST answers 1000 rows a select; the rows all go in one delete.
    db.state.maxRows = 1000;
    db.state.tables.reps = [];
    for (let i = 0; i < 2345; i++) {
      db.put("reps", { id: `r${String(i).padStart(5, "0")}`, user_id: OWNER, audio_path: i % 7 === 0 ? null : `reps/${i}-rep.webm` });
    }
    db.put("reps", { id: "x1", user_id: OTHER, audio_path: "reps/other.webm" });
    const res = await del("tok_owner");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: 2345 });
    const want = 2345 - Math.ceil(2345 / 7);
    expect(new Set(db.state.removedAudio).size).toBe(want);
    expect(db.state.removedAudio).not.toContain("reps/other.webm");
    expect(repsOf(OWNER)).toEqual([]);
    expect(repsOf(OTHER)).toEqual(["x1"]);
  });

  it("says so when the audio stops part way, and a retry finishes", async () => {
    db.state.tables.reps = [];
    for (let i = 0; i < 250; i++) db.put("reps", { id: `r${i}`, user_id: OWNER, audio_path: `reps/${i}-rep.webm` });
    // The first hundred go; the second batch fails.
    let calls = 0;
    const storage = db.asClient().storage;
    const from = storage.from.bind(storage);
    (storage as { from: typeof from }).from = (bucket: string) => {
      const b = from(bucket);
      return {
        ...b,
        remove: async (paths: string[]) => (++calls === 2 ? { data: null, error: { message: "storage down" } } : b.remove(paths)),
      } as ReturnType<typeof from>;
    };
    const res = await del("tok_owner");
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/^Part of your audio deleted/);
    expect(repsOf(OWNER).length).toBe(250);
    (storage as { from: typeof from }).from = from;
    expect((await del("tok_owner")).status).toBe(200);
    expect(repsOf(OWNER)).toEqual([]);
  });

  it("answers 503 on a server with no database", async () => {
    h.db = null;
    expect((await del("tok_owner")).status).toBe(503);
  });
});
