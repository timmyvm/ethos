/**
 * /api/avatar: the caller's profile photo (#485).
 *
 *   GET     a short-lived link to the photo, or 404 when there is none
 *   POST    a new photo: the body is the image itself, WebP or JPEG, the
 *           phone's centred 256px square (lib/avatar-client.ts)
 *   DELETE  every photo the account kept
 *
 * Kept the way recordings are (app/api/audio, docs/testers.md): the
 * server uploads with the service role into the private `avatars`
 * bucket under the caller's own id, and signs a read link only for the
 * caller it has checked. The browser holds no storage policy at all. A
 * guest's session has its own id, so a guest can keep a photo too, and
 * it goes with the account (app/api/account).
 *
 * Until the bucket's migration is applied, GET answers none (the card
 * draws the initial), POST answers 503 and DELETE has nothing to take.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, supabaseAdmin } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  AVATAR_COPY,
  AVATAR_MAX_BYTES,
  AVATAR_MAX_SIDE,
  AVATAR_TYPES,
  avatarSize,
  sniffAvatar,
  type AvatarType,
} from "@/lib/avatar";
import { putAvatar, removeAvatars, signedAvatar } from "@/lib/avatar-server";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

async function caller(req: NextRequest) {
  return getUserFromAuthHeader(req.headers.get("authorization")).catch(() => null);
}

const expired = () => json({ error: AVATAR_COPY.expired }, 401);
const unconfigured = () => json({ error: "Accounts aren't configured on this server." }, 503);

export async function GET(req: NextRequest) {
  const user = await caller(req);
  if (!user) return expired();
  const db = supabaseAdmin();
  if (!db) return unconfigured();
  const read = await signedAvatar(db, user.id);
  if ("none" in read) return json({ none: true }, 404);
  if ("failed" in read) {
    console.error("avatar: read failed", read.failed);
    return json({ error: "Your photo didn't load." }, 502);
  }
  return json({ url: read.url });
}

export async function POST(req: NextRequest) {
  const user = await caller(req);
  if (!user) return expired();

  const declared = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!AVATAR_TYPES.includes(declared as AvatarType)) return json({ error: AVATAR_COPY.notPhoto }, 415);
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > AVATAR_MAX_BYTES) return json({ error: AVATAR_COPY.notPhoto }, 413);

  const db = supabaseAdmin();
  if (!db) return unconfigured();

  const verdict = await consumeRateLimit(`avatar:u:${user.id}`, "avatar");
  if (!verdict.allowed) return json({ error: AVATAR_COPY.tooMany }, 429);

  const bytes = new Uint8Array(await req.arrayBuffer().catch(() => new ArrayBuffer(0)));
  if (bytes.byteLength === 0) return json({ error: AVATAR_COPY.notPhoto }, 400);
  if (bytes.byteLength > AVATAR_MAX_BYTES) return json({ error: AVATAR_COPY.notPhoto }, 413);
  // The bytes say what they are; a header that disagrees is not believed.
  const type = sniffAvatar(bytes);
  if (!type || type !== declared) return json({ error: AVATAR_COPY.notPhoto }, 415);
  const size = avatarSize(bytes);
  if (!size || size.width < 1 || size.height < 1) return json({ error: AVATAR_COPY.notPhoto }, 415);
  if (size.width > AVATAR_MAX_SIDE || size.height > AVATAR_MAX_SIDE) {
    return json({ error: AVATAR_COPY.notPhoto }, 413);
  }

  const put = await putAvatar(db, user.id, bytes, type);
  if ("missing" in put) return json({ error: AVATAR_COPY.notYet }, 503);
  if ("failed" in put) {
    console.error("avatar: upload failed", put.failed);
    return json({ error: AVATAR_COPY.failed }, 502);
  }
  const read = await signedAvatar(db, user.id);
  return json({ url: "url" in read ? read.url : null });
}

export async function DELETE(req: NextRequest) {
  const user = await caller(req);
  if (!user) return expired();
  const db = supabaseAdmin();
  if (!db) return unconfigured();
  const gone = await removeAvatars(db, user.id);
  if ("failed" in gone) {
    console.error("avatar: removal failed", gone.failed);
    return json({ error: AVATAR_COPY.removeFailed }, 502);
  }
  return json({ ok: true });
}
