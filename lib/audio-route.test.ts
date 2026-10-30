import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { fakeDb, type FakeDb } from "./billing-fakes";

/**
 * GET /api/audio (SEC-1, 30 Oct): a stored recording's playback link,
 * signed by the server for the recording's owner only.
 *
 * Every upload is made by the server with the service role under
 * `reps/<time>-<name>` (lib/db.ts), so a storage object carries no owner
 * and no user folder, and no storage policy can tell one person's
 * recording from another's. Signing from the browser needed a policy
 * that lets any session sign any object in the bucket, testers' and
 * minors' voices included. The route reads the recording's row, checks
 * it is the caller's, and signs with the service role, so the browser
 * needs no storage policy at all.
 */

const OWNER = "6f1c2b9e-0d4a-4c1e-9a77-3b2f5e8d1c40";
const OTHER = "0b7d4c1a-5e2f-4a3b-8c9d-1e2f3a4b5c6d";
const MINE = "11111111-1111-4111-8111-111111111111";
const THEIRS = "22222222-2222-4222-8222-222222222222";
const SILENT = "33333333-3333-4333-8333-333333333333";

const h = vi.hoisted(() => ({
  db: null as unknown,
  sessions: new Map<string, { id: string; anonymous: boolean; email: string | null }>(),
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const resolve = async (header: string | null) => {
    if (!header?.startsWith("Bearer ")) return { kind: "none" as const };
    const user = h.sessions.get(header.slice(7));
    return user ? { kind: "user" as const, user } : { kind: "rejected" as const };
  };
  return {
    ...(await importOriginal<typeof import("@/lib/db")>()),
    supabaseAdmin: () => h.db,
    resolveAuthHeader: vi.fn(resolve),
    getUserFromAuthHeader: vi.fn(async (header: string | null) => {
      const r = await resolve(header);
      return r.kind === "user" ? r.user : null;
    }),
  };
});

import { GET as audio } from "@/app/api/audio/route";

let db: FakeDb;

beforeEach(() => {
  db = fakeDb([OWNER, OTHER]);
  h.db = db.asClient();
  h.sessions.clear();
  h.sessions.set("tok_owner", { id: OWNER, anonymous: true, email: null });
  h.sessions.set("tok_other", { id: OTHER, anonymous: false, email: "b@example.com" });
  db.put("reps", { id: MINE, user_id: OWNER, audio_path: "reps/1761814800000-rep.webm" });
  db.put("reps", { id: THEIRS, user_id: OTHER, audio_path: "reps/1761814800001-rep.webm" });
  db.put("reps", { id: SILENT, user_id: OWNER, audio_path: null });
});

function get(rep: string, token?: string): Promise<Response> {
  const url = new URL(`https://speakethos.com/api/audio?rep=${encodeURIComponent(rep)}`);
  const headers = new Headers(token ? { authorization: `Bearer ${token}` } : {});
  return audio({ headers, nextUrl: url, url: url.toString() } as unknown as NextRequest);
}

describe("a stored recording's playback link", () => {
  it("is signed for the recording's owner, short-lived and never cached", async () => {
    const res = await get(MINE, "tok_owner");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    const body = (await res.json()) as { url: string };
    expect(body.url).toContain("reps/1761814800000-rep.webm");
    expect(db.state.signed).toEqual([{ path: "reps/1761814800000-rep.webm", expiresIn: 3600 }]);
  });

  it("is refused for someone else's recording, as if it were not there", async () => {
    const res = await get(THEIRS, "tok_owner");
    expect(res.status).toBe(404);
    expect(db.state.signed).toEqual([]);
  });

  it("needs a session", async () => {
    expect((await get(MINE)).status).toBe(401);
    expect((await get(MINE, "tok_forged")).status).toBe(401);
    expect(db.state.signed).toEqual([]);
  });

  it("is nothing for a recording with no audio, or an id that is not one", async () => {
    expect((await get(SILENT, "tok_owner")).status).toBe(404);
    expect((await get("rep-1", "tok_owner")).status).toBe(404);
    expect((await get("", "tok_owner")).status).toBe(404);
    expect(db.state.signed).toEqual([]);
  });
});

describe("the browser", () => {
  /* With the route in place no browser code signs storage itself, so the
     audio bucket needs no browser policy (docs/testers.md). */
  it("asks the route for a link and never signs storage itself", () => {
    const client = readFileSync("lib/client-data.ts", "utf8");
    expect(client).not.toMatch(/createSignedUrl/);
    expect(client).toMatch(/\/api\/audio\?rep=/);
    const page = readFileSync("app/rep/[id]/page.tsx", "utf8");
    expect(page).not.toMatch(/createSignedUrl|storage\.from/);
  });
});
