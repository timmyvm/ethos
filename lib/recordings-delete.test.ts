import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* The phone's half of "Delete my recordings" (#479): the route is asked
   with the session's token, and only a yes empties what the visit held. */

type Take = { id: string; owner?: string | null };
const h = vi.hoisted(() => ({
  session: { access_token: "tok", user: { id: "me" } } as null | { access_token: string; user?: { id: string } },
  forgot: 0,
  hint: "unset" as string | null,
  outbox: [] as Take[],
}));

vi.mock("./supabase-browser", () => ({
  supabaseBrowser: () => ({ auth: { getSession: async () => ({ data: { session: h.session } }) } }),
}));
vi.mock("./held", () => ({ forgetRecordings: () => void h.forgot++ }));
vi.mock("./spoke-hint", () => ({ writeSpokeHint: (d: string | null) => void (h.hint = d) }));
vi.mock("./rep-outbox", async (importOriginal) => ({
  ownedBy: (await importOriginal<typeof import("./rep-outbox")>()).ownedBy,
  outboxAll: async () => [...h.outbox],
  outboxDelete: async (id: string) => void (h.outbox = h.outbox.filter((t) => t.id !== id)),
}));

import { deleteAllRecordings } from "./recordings-delete";

const answer = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  h.session = { access_token: "tok", user: { id: "me" } };
  h.forgot = 0;
  h.hint = "unset";
  h.outbox = [];
});
afterEach(() => vi.unstubAllGlobals());

describe("deleting every recording from the phone", () => {
  it("asks the route with the session's token and forgets what the visit held", async () => {
    const fetch = answer(200, { ok: true, deleted: 12 });
    vi.stubGlobal("fetch", fetch);
    expect(await deleteAllRecordings()).toEqual({ ok: true, deleted: 12 });
    expect(fetch).toHaveBeenCalledWith("/api/recordings", { method: "DELETE", headers: { Authorization: "Bearer tok" } });
    expect(h.forgot).toBe(1);
    expect(h.hint).toBeNull();
  });

  it("drops this account's takes still waiting to send, and keeps another account's (review)", async () => {
    h.outbox = [{ id: "a", owner: "me" }, { id: "b", owner: null }, { id: "c", owner: "someone-else" }];
    vi.stubGlobal("fetch", answer(200, { ok: true, deleted: 3 }));
    expect((await deleteAllRecordings()).ok).toBe(true);
    expect(h.outbox.map((t) => t.id)).toEqual(["c"]);
  });

  it("keeps every waiting take when the server did not delete", async () => {
    h.outbox = [{ id: "a", owner: "me" }];
    vi.stubGlobal("fetch", answer(502, { error: "Couldn't list your recordings. Nothing was deleted." }));
    expect((await deleteAllRecordings()).ok).toBe(false);
    expect(h.outbox.map((t) => t.id)).toEqual(["a"]);
  });

  it("says the server's own sentence and keeps what is held when it fails", async () => {
    vi.stubGlobal("fetch", answer(502, { error: "Your audio didn't delete, so your recordings are all still here. Try again." }));
    expect(await deleteAllRecordings()).toEqual({ ok: false, error: "Your audio didn't delete, so your recordings are all still here. Try again." });
    expect(h.forgot).toBe(0);
    expect(h.hint).toBe("unset");
  });

  it("never says nothing happened when the server did not answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    const r = await deleteAllRecordings();
    expect(r).toEqual({ ok: false, error: "The server didn't answer. Try again." });
    expect(h.forgot).toBe(0);
  });

  it("asks nothing without a session", async () => {
    h.session = null;
    const fetch = answer(200, {});
    vi.stubGlobal("fetch", fetch);
    expect((await deleteAllRecordings()).ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("has a line for a failure with no sentence", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Bad gateway", { status: 502 })));
    expect(await deleteAllRecordings()).toEqual({ ok: false, error: "That didn't go through. Try again." });
  });
});
