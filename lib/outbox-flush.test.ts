import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboxRep } from "./rep-outbox";

/*
 * The background flush (components/OutboxRetry.tsx) against an in-memory
 * outbox and a stubbed /api/analyze, with the session under the test's
 * control: who is signed in, and whether a flush may mint anyone.
 */
let store: OutboxRep[] = [];
let me: { userId: string; token: string } | null = null;
const ensureSession = vi.fn(async () => "minted-token");

vi.mock("./supabase-browser", () => ({
  ensureSession: () => ensureSession(),
  currentSession: async () => me,
}));

vi.mock("./rep-outbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./rep-outbox")>()),
  outboxAll: async () => [...store].sort((a, b) => a.createdAt - b.createdAt),
  outboxDelete: async (id: string) => {
    store = store.filter((r) => r.id !== id);
  },
  outboxPut: async (rep: OutboxRep) => {
    store = [...store.filter((r) => r.id !== rep.id), rep];
    return true;
  },
}));

const { flushOutbox } = await import("./outbox-flush");

const calls: { auth: string | null }[] = [];
function held(id: string, owner?: string | null, ageMs = 60_000): OutboxRep {
  return {
    id,
    createdAt: Date.now() - ageMs,
    audio: new Blob(["a"], { type: "audio/webm" }),
    filename: "rep.webm",
    fields: { lessonId: "f1" },
    ...(owner === undefined ? {} : { owner }),
  };
}

beforeEach(() => {
  store = [];
  me = null;
  calls.length = 0;
  ensureSession.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const h = (init.headers ?? {}) as Record<string, string>;
      calls.push({ auth: h.Authorization ?? null });
      return new Response(JSON.stringify({ repId: "r1" }), { status: 200 });
    })
  );
});

describe("the outbox flush and who a recording belongs to", () => {
  it("never mints a new user to send a signed-out account's recording", async () => {
    store = [held("a", "user-a")];
    await flushOutbox();
    expect(ensureSession).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
    expect(store.map((r) => r.id)).toEqual(["a"]);
  });

  it("never sends one account's recording under another's session", async () => {
    me = { userId: "user-b", token: "token-b" };
    store = [held("a", "user-a")];
    await flushOutbox();
    expect(calls).toHaveLength(0);
    expect(store.map((r) => r.id)).toEqual(["a"]);
  });

  it("sends a parked recording once its owner is signed in again", async () => {
    me = { userId: "user-a", token: "token-a" };
    store = [held("a", "user-a")];
    await flushOutbox();
    expect(calls).toEqual([{ auth: "Bearer token-a" }]);
    expect(store).toHaveLength(0);
  });

  it("sends a recording from before owners only into a live session", async () => {
    store = [held("old")];
    await flushOutbox();
    expect(ensureSession).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
    me = { userId: "user-a", token: "token-a" };
    await flushOutbox();
    expect(calls).toEqual([{ auth: "Bearer token-a" }]);
  });

  it("gives a recording made with no session at all to this device's session", async () => {
    store = [held("first", null)];
    await flushOutbox();
    expect(ensureSession).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([{ auth: "Bearer minted-token" }]);
    expect(store).toHaveLength(0);
  });
});
