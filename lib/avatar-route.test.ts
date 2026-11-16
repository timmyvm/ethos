import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { fakeDb, type FakeDb } from "./billing-fakes";
import {
  AVATAR_COPY,
  AVATAR_MAX_BYTES,
  avatarPath,
  avatarSize,
  centreSquare,
  newestAvatar,
  samePhoto,
  sniffAvatar,
} from "./avatar";

/*
 * The profile photo (#485, Timothy 16 Nov: "add a pfp option"), kept
 * the way recordings are (app/api/audio, docs/testers.md): the server
 * uploads with the service role into a private bucket under the caller's
 * own id and signs a read link only for that caller. No storage policy
 * lets a browser near the bucket. Until the bucket's migration is
 * applied the card still works: a read is "no photo", a save says so.
 */

const OWNER = "6f1c2b9e-0d4a-4c1e-9a77-3b2f5e8d1c40";
const OTHER = "0b7d4c1a-5e2f-4a3b-8c9d-1e2f3a4b5c6d";

const h = vi.hoisted(() => ({
  db: null as unknown,
  sessions: new Map<string, { id: string; anonymous: boolean; email: string | null }>(),
  limited: false,
}));

vi.mock("@/lib/stripe", () => ({
  stripeClient: () => null,
  webhookSecret: () => null,
  billingConfigured: () => false,
  stripeLivemode: () => false,
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
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit: vi.fn(async () =>
    h.limited ? { allowed: false, window: "hour", retryAfterS: 600 } : { allowed: true, window: null, retryAfterS: 0 }
  ),
}));

import { DELETE as removeRoute, GET as readRoute, POST as saveRoute } from "@/app/api/avatar/route";
import { DELETE as deleteAccount } from "@/app/api/account/route";

/** A WebP's first bytes ("VP8 " keyframe) at w x h, padded to `total`. */
function webp(w: number, h2: number, total = 2048): Uint8Array {
  const b = new Uint8Array(total);
  b.set([0x52, 0x49, 0x46, 0x46], 0);
  b.set([0x57, 0x45, 0x42, 0x50], 8);
  b.set([0x56, 0x50, 0x38, 0x20], 12);
  b.set([0x9d, 0x01, 0x2a], 23);
  b.set([w & 0xff, (w >> 8) & 0x3f, h2 & 0xff, (h2 >> 8) & 0x3f], 26);
  return b;
}

/** A JPEG's first bytes: SOI, a JFIF segment, then a baseline frame at w x h. */
function jpeg(w: number, h2: number, total = 2048): Uint8Array {
  const b = new Uint8Array(total);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00], 0);
  const sof = 2 + 2 + 16;
  b.set([0xff, 0xc0, 0x00, 0x11, 0x08, h2 >> 8, h2 & 0xff, w >> 8, w & 0xff], sof);
  return b;
}

let db: FakeDb;

beforeEach(() => {
  db = fakeDb([OWNER, OTHER]);
  h.db = db.asClient();
  h.sessions.clear();
  h.sessions.set("tok_owner", { id: OWNER, anonymous: false, email: "a@example.com" });
  h.sessions.set("tok_guest", { id: OTHER, anonymous: true, email: null });
  h.limited = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function req(method: string, opts: { token?: string | null; type?: string; body?: Uint8Array; length?: number } = {}) {
  const headers = new Headers();
  const token = opts.token === undefined ? "tok_owner" : opts.token;
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (opts.type) headers.set("content-type", opts.type);
  if (opts.length !== undefined) headers.set("content-length", String(opts.length));
  return new Request("https://speakethos.com/api/avatar", {
    method,
    headers,
    body: opts.body ? (opts.body as unknown as BodyInit) : undefined,
  }) as unknown as NextRequest;
}

const json = async (res: Response) => ({ status: res.status, body: (await res.json()) as Record<string, unknown> });

describe("the photo's bytes", () => {
  it("are told by their own header, never by the name or the type sent", () => {
    expect(sniffAvatar(webp(256, 256))).toBe("image/webp");
    expect(sniffAvatar(jpeg(256, 256))).toBe("image/jpeg");
    expect(sniffAvatar(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffAvatar(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull(); // PNG
  });

  it("carry their size, which the server reads", () => {
    expect(avatarSize(webp(256, 256))).toEqual({ width: 256, height: 256 });
    expect(avatarSize(jpeg(300, 200))).toEqual({ width: 300, height: 200 });
    expect(avatarSize(new Uint8Array(40))).toBeNull();
  });

  it("are cut to the picture's centred square", () => {
    expect(centreSquare(4032, 3024)).toEqual({ sx: 504, sy: 0, side: 3024 });
    expect(centreSquare(1080, 1920)).toEqual({ sx: 0, sy: 420, side: 1080 });
    expect(centreSquare(256, 256)).toEqual({ sx: 0, sy: 0, side: 256 });
  });

  it("live in the account's own folder, the newest read", () => {
    expect(avatarPath(OWNER, 1700, "image/webp")).toBe(`${OWNER}/1700.webp`);
    expect(avatarPath(OWNER, 1700, "image/jpeg")).toBe(`${OWNER}/1700.jpg`);
    expect(newestAvatar(["1700.webp", "1800.jpg", "notes.txt", "99.webp"])).toBe("1800.jpg");
    expect(newestAvatar([])).toBeNull();
  });

  it("keep the photo drawn when only the link's token changed", () => {
    const a = "https://x.supabase.co/storage/v1/object/sign/avatars/u/1.webp?token=a";
    const b = "https://x.supabase.co/storage/v1/object/sign/avatars/u/1.webp?token=b";
    const c = "https://x.supabase.co/storage/v1/object/sign/avatars/u/2.webp?token=b";
    expect(samePhoto(a, b)).toBe(true);
    expect(samePhoto(a, c)).toBe(false);
    expect(samePhoto(null, null)).toBe(true);
    expect(samePhoto(undefined, a)).toBe(false);
  });
});

describe("POST /api/avatar", () => {
  it("refuses a caller with no session or a dead one", async () => {
    expect((await json(await saveRoute(req("POST", { token: null, type: "image/webp", body: webp(256, 256) })))).status).toBe(401);
    const dead = await json(await saveRoute(req("POST", { token: "tok_gone", type: "image/webp", body: webp(256, 256) })));
    expect(dead.status).toBe(401);
    expect(dead.body.error).toBe(AVATAR_COPY.expired);
    expect(db.state.uploaded).toEqual([]);
  });

  it("keeps a WebP under the caller's own id, private, and answers its link", async () => {
    const res = await json(await saveRoute(req("POST", { type: "image/webp", body: webp(256, 256) })));
    expect(res.status).toBe(200);
    expect(db.state.uploaded).toHaveLength(1);
    const up = db.state.uploaded[0];
    expect(up.bucket).toBe("avatars");
    expect(up.path).toMatch(new RegExp(`^${OWNER}/\\d+\\.webp$`));
    expect(up.contentType).toBe("image/webp");
    expect(String(res.body.url)).toContain(`avatars/${OWNER}/`);
    expect(db.state.signed.at(-1)?.expiresIn).toBe(3600);
  });

  it("keeps a JPEG where the phone could not make a WebP", async () => {
    const res = await json(await saveRoute(req("POST", { type: "image/jpeg", body: jpeg(256, 256) })));
    expect(res.status).toBe(200);
    expect(db.state.uploaded[0].path).toMatch(/\.jpg$/);
  });

  it("lets a guest keep one, under the guest's own id", async () => {
    const res = await json(await saveRoute(req("POST", { token: "tok_guest", type: "image/webp", body: webp(256, 256) })));
    expect(res.status).toBe(200);
    expect(db.state.uploaded[0].path.startsWith(`${OTHER}/`)).toBe(true);
  });

  it("refuses a type that is not WebP or JPEG, and bytes that are not what they claim", async () => {
    const png = await json(await saveRoute(req("POST", { type: "image/png", body: webp(256, 256) })));
    expect(png.status).toBe(415);
    const svg = await json(await saveRoute(req("POST", { type: "image/svg+xml", body: new TextEncoder().encode("<svg/>") })));
    expect(svg.status).toBe(415);
    const lying = await json(await saveRoute(req("POST", { type: "image/webp", body: jpeg(256, 256) })));
    expect(lying.status).toBe(415);
    expect(lying.body.error).toBe(AVATAR_COPY.notPhoto);
    expect(db.state.uploaded).toEqual([]);
  });

  it("refuses a file too heavy or a picture too large: the phone sends 256px", async () => {
    const heavy = await json(await saveRoute(req("POST", { type: "image/webp", body: webp(256, 256, AVATAR_MAX_BYTES + 1) })));
    expect(heavy.status).toBe(413);
    const said = await json(
      await saveRoute(req("POST", { type: "image/webp", body: webp(256, 256), length: AVATAR_MAX_BYTES + 1 }))
    );
    expect(said.status).toBe(413);
    const wide = await json(await saveRoute(req("POST", { type: "image/jpeg", body: jpeg(4032, 3024) })));
    expect(wide.status).toBe(413);
    const empty = await json(await saveRoute(req("POST", { type: "image/webp", body: new Uint8Array(0) })));
    expect([400, 415]).toContain(empty.status);
    expect(db.state.uploaded).toEqual([]);
  });

  it("answers 503 in words while the bucket's migration is not applied", async () => {
    db.state.missingBuckets.add("avatars");
    const res = await json(await saveRoute(req("POST", { type: "image/webp", body: webp(256, 256) })));
    expect(res.status).toBe(503);
    expect(res.body.error).toBe(AVATAR_COPY.notYet);
  });

  it("is limited per account", async () => {
    h.limited = true;
    const res = await json(await saveRoute(req("POST", { type: "image/webp", body: webp(256, 256) })));
    expect(res.status).toBe(429);
    expect(db.state.uploaded).toEqual([]);
  });

  it("keeps one photo a folder: a new one takes the old one's place", async () => {
    db.state.objects.avatars = [`${OWNER}/1000.webp`, `${OTHER}/1000.webp`];
    await saveRoute(req("POST", { type: "image/webp", body: webp(256, 256) }));
    const mine = db.state.objects.avatars.filter((p) => p.startsWith(`${OWNER}/`));
    expect(mine).toHaveLength(1);
    expect(mine[0]).not.toBe(`${OWNER}/1000.webp`);
    // Nobody else's photo is touched.
    expect(db.state.objects.avatars).toContain(`${OTHER}/1000.webp`);
  });
});

describe("GET /api/avatar", () => {
  it("signs the caller's own newest photo, short-lived and never cached", async () => {
    db.state.objects.avatars = [`${OWNER}/1000.webp`, `${OWNER}/2000.webp`, `${OTHER}/3000.webp`];
    const res = await readRoute(req("GET"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    expect(db.state.signed).toEqual([{ path: `${OWNER}/2000.webp`, expiresIn: 3600 }]);
  });

  it("answers none (404) with no photo, and with no bucket yet", async () => {
    expect((await readRoute(req("GET"))).status).toBe(404);
    db.state.missingBuckets.add("avatars");
    const res = await json(await readRoute(req("GET")));
    expect(res.status).toBe(404);
    expect(res.body.none).toBe(true);
  });

  it("refuses a caller with no session", async () => {
    expect((await readRoute(req("GET", { token: null }))).status).toBe(401);
  });

  it("says a failed read failed, never none", async () => {
    db.state.fail.push({ table: "storage:avatars", op: "list", error: { message: "timeout", code: "500" } as never });
    expect((await readRoute(req("GET"))).status).toBe(502);
  });
});

describe("DELETE /api/avatar", () => {
  it("takes every photo in the caller's folder and nobody else's", async () => {
    db.state.objects.avatars = [`${OWNER}/1000.webp`, `${OWNER}/2000.jpg`, `${OTHER}/3000.webp`];
    const res = await removeRoute(req("DELETE"));
    expect(res.status).toBe(200);
    expect(db.state.objects.avatars).toEqual([`${OTHER}/3000.webp`]);
  });

  it("is done with nothing to take, and with no bucket", async () => {
    expect((await removeRoute(req("DELETE"))).status).toBe(200);
    db.state.missingBuckets.add("avatars");
    expect((await removeRoute(req("DELETE"))).status).toBe(200);
  });
});

describe("the account's removal takes the photo (#485)", () => {
  const del = (token: string) => deleteAccount(req("DELETE", { token }));

  it("removes the photo with the account", async () => {
    db.state.objects.avatars = [`${OWNER}/1000.webp`, `${OTHER}/1000.webp`];
    const res = await del("tok_owner");
    expect(res.status).toBe(200);
    expect(db.state.objects.avatars).toEqual([`${OTHER}/1000.webp`]);
    expect(db.state.deletedUsers).toEqual([OWNER]);
  });

  it("goes ahead where the bucket is not made yet: there is no photo to keep", async () => {
    db.state.missingBuckets.add("avatars");
    expect((await del("tok_owner")).status).toBe(200);
    expect(db.state.deletedUsers).toEqual([OWNER]);
  });

  it("stops before the account goes when the photo will not come out", async () => {
    db.state.objects.avatars = [`${OWNER}/1000.webp`];
    db.state.fail.push({ table: "storage:avatars", op: "remove", error: { message: "storage down", code: "500" } as never });
    const res = await json(await del("tok_owner"));
    expect(res.status).toBe(502);
    expect(String(res.body.error)).toMatch(/photo/);
    expect(db.state.deletedUsers).toEqual([]);
  });
});
