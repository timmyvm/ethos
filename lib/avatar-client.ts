/**
 * The profile photo, from the phone (#485): read it, make one from a
 * picked file, save it, take it away, and hand it to the export.
 *
 * The picture is made here, never on the server: the picked photo is
 * decoded (its camera orientation applied), cut to its centred square,
 * drawn at AVATAR_SIDE and encoded as WebP, or as JPEG where the browser
 * cannot encode WebP (Safari before 17 hands back a PNG for a WebP ask).
 * A 12 MP camera photo leaves the phone as about 30 KB.
 *
 * The link the server signs lasts an hour and is held in memory for the
 * visit (lib/held.ts), so You draws the photo in its first frame on a
 * return and reads it again behind it. Nothing is written to the phone.
 */

import { AVATAR_COPY, AVATAR_SIDE, avatarError, centreSquare, type AvatarType } from "./avatar";
import { held, heldMark, hold, once } from "./held";
import { ensureSession, sessionToken } from "./supabase-browser";

const AVATAR_KEY = "avatar";

/** The photo's link as this visit last read it: undefined unread, null none. */
export function heldAvatar(): string | null | undefined {
  return held<string | null>(AVATAR_KEY);
}

/** The account's photo link, or null for none. Throws on a failed read (unknown is never "none"). */
export function fetchAvatar(): Promise<string | null> {
  return once(AVATAR_KEY, readAvatar);
}

async function readAvatar(): Promise<string | null> {
  const mark = heldMark();
  const token = await sessionToken();
  // No session: nobody to have a photo.
  if (!token) return hold(AVATAR_KEY, null, mark);
  const res = await fetch("/api/avatar", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  if (res.status === 404 || res.status === 401) return hold(AVATAR_KEY, null, mark);
  if (!res.ok) throw new Error(`avatar read ${res.status}`);
  const body = (await res.json().catch(() => null)) as { url?: unknown } | null;
  return hold(AVATAR_KEY, typeof body?.url === "string" ? body.url : null, mark);
}

export type AvatarResult = { ok: true; url: string | null } | { ok: false; error: string };

/** A picked file, made into the card's photo and saved. A guest's own session keeps it. */
export async function saveAvatar(file: Blob): Promise<AvatarResult> {
  let picture: MadeAvatar;
  try {
    picture = await makeAvatar(file);
  } catch {
    return { ok: false, error: AVATAR_COPY.notPhoto };
  }
  return uploadAvatar(picture);
}

/** The photo the phone made (makeAvatar): the 256px square, WebP or JPEG. */
export type MadeAvatar = { blob: Blob; type: AvatarType };

/**
 * A made photo, saved. The coin draws the same made square while this
 * runs (components/you/Avatar.tsx), never the camera's original: a 48 MP
 * photo decoded for a 64px coin is a phone's whole memory for nothing.
 */
export async function uploadAvatar(picture: MadeAvatar): Promise<AvatarResult> {
  const token = await ensureSession();
  if (!token) return { ok: false, error: AVATAR_COPY.failed };
  try {
    const res = await fetch("/api/avatar", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": picture.type },
      body: picture.blob,
    });
    if (!res.ok) return { ok: false, error: avatarError(res.status) };
    const body = (await res.json().catch(() => null)) as { url?: unknown } | null;
    const url = typeof body?.url === "string" ? body.url : null;
    hold(AVATAR_KEY, url);
    return { ok: true, url };
  } catch {
    return { ok: false, error: AVATAR_COPY.failed };
  }
}

/** The photo taken away. */
export async function removeAvatar(): Promise<AvatarResult> {
  const token = await sessionToken();
  if (!token) return { ok: false, error: AVATAR_COPY.expired };
  try {
    const res = await fetch("/api/avatar", { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return { ok: false, error: res.status === 401 ? AVATAR_COPY.expired : AVATAR_COPY.removeFailed };
    hold(AVATAR_KEY, null);
    return { ok: true, url: null };
  } catch {
    return { ok: false, error: AVATAR_COPY.removeFailed };
  }
}

/**
 * The photo for the data export (Settings, "Your data"): the image itself
 * as a data URL, so the file holds the picture and not an hour's link.
 * Null when there is none; throws when it could not be read, so an
 * export never passes a missing photo off as none.
 */
export async function avatarForExport(): Promise<{ contentType: string; dataUrl: string } | null> {
  const token = await sessionToken();
  if (!token) return null;
  const res = await fetch("/api/avatar", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) throw new Error(`avatar read ${res.status}`);
  const { url } = (await res.json()) as { url?: string | null };
  if (!url) return null;
  const image = await fetch(url);
  if (!image.ok) throw new Error(`avatar image ${image.status}`);
  const blob = await image.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { contentType: blob.type || "image/webp", dataUrl };
}

/* ------------------------------------------------------------------ */
/* The picture, made on the phone. */

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // The camera's own orientation applied, so a portrait photo stands up.
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
    } catch {
      /* Some formats (an iPhone's HEIC off the camera roll in an older
         engine) decode only through an <img>: fall through. */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function encode(canvas: HTMLCanvasElement, type: AvatarType): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
}

/** The picked file as the card's photo: its centred square at AVATAR_SIDE, WebP or JPEG. */
export async function makeAvatar(file: Blob): Promise<MadeAvatar> {
  const picture = await decode(file);
  try {
    const { sx, sy, side } = centreSquare(picture.width, picture.height);
    if (side < 1) throw new Error("empty picture");
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIDE;
    canvas.height = AVATAR_SIDE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(picture.source, sx, sy, side, side, 0, 0, AVATAR_SIDE, AVATAR_SIDE);
    const webp = await encode(canvas, "image/webp");
    // A browser that cannot encode WebP answers with a PNG instead.
    if (webp && webp.type === "image/webp") return { blob: webp, type: "image/webp" };
    // JPEG has no transparency: a cut-out PNG lands on white, not black.
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, AVATAR_SIDE, AVATAR_SIDE);
    const jpeg = await encode(canvas, "image/jpeg");
    if (jpeg && jpeg.type === "image/jpeg") return { blob: jpeg, type: "image/jpeg" };
    throw new Error("no encoder");
  } finally {
    picture.done();
  }
}
