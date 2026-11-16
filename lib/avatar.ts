/**
 * The profile photo (#485, Timothy 16 Nov: "add a pfp option"). The
 * rules both ends agree on, with no React and no network: what a photo
 * is, how big, where it is kept, and the words around it.
 *
 * The phone crops what was picked to its centred square and draws it at
 * AVATAR_SIDE (lib/avatar-client.ts), WebP where the browser can encode
 * it and JPEG where it cannot. The server (app/api/avatar) takes only
 * those two, sniffed from the bytes rather than trusted from a header,
 * no larger than AVATAR_MAX_BYTES and AVATAR_MAX_SIDE, and keeps it in
 * the private `avatars` bucket (its migration, `*_avatars.sql`) under the account's own
 * id, as the recordings' audio is kept: uploaded with the service role,
 * read through a link the server signs after checking the caller. No
 * storage policy lets a browser near the bucket.
 */

export const AVATAR_BUCKET = "avatars";
/** The square the phone draws: four times the card's 64px coin at 2x, with room. */
export const AVATAR_SIDE = 256;
/** What the server takes, in px a side: a phone that skipped the resize is refused. */
export const AVATAR_MAX_SIDE = 512;
/** 256px at WebP 0.85 is about 15 to 30 KB; a JPEG of the same about 20 to 40. */
export const AVATAR_MAX_BYTES = 200 * 1024;
/** An hour, as a recording's playback link (app/api/audio). */
export const AVATAR_LINK_SECONDS = 3600;

export type AvatarType = "image/webp" | "image/jpeg";
export const AVATAR_TYPES: readonly AvatarType[] = ["image/webp", "image/jpeg"];
const EXT: Record<AvatarType, string> = { "image/webp": "webp", "image/jpeg": "jpg" };

/** What the bytes are, from their own header: WebP, JPEG, or neither. */
export function sniffAvatar(b: Uint8Array): AvatarType | null {
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}

/** A WebP's or a JPEG's width and height from its header; null where it cannot be read. */
export function avatarSize(b: Uint8Array): { width: number; height: number } | null {
  const type = sniffAvatar(b);
  if (type === "image/webp") return webpSize(b);
  if (type === "image/jpeg") return jpegSize(b);
  return null;
}

function webpSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 30) return null;
  const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (chunk === "VP8 ") {
    // The keyframe's start code, then 14-bit width and height.
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return {
      width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
      height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
    };
  }
  return null;
}

function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    // Fill bytes and the markers that carry no length.
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = (b[i + 2] << 8) | b[i + 3];
    // A start of frame (C0 to CF, less the tables C4, C8 and CC) holds the size.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

/** The centred square of a w x h picture: where to start and how far. */
export function centreSquare(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.max(0, Math.min(width, height));
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side };
}

/** One account's folder: its id, so a removal reaches every photo it ever kept. */
export function avatarFolder(userId: string): string {
  return userId;
}

/** A new photo's path: the account's folder, the time, the type's extension. */
export function avatarPath(userId: string, at: number, type: AvatarType): string {
  return `${avatarFolder(userId)}/${at}.${EXT[type]}`;
}

/** The newest photo among a folder's names (`<time>.<ext>`), or null. */
export function newestAvatar(names: readonly string[]): string | null {
  let best: string | null = null;
  let bestAt = -1;
  for (const name of names) {
    const m = /^(\d+)\.(webp|jpg)$/.exec(name);
    if (!m) continue;
    const at = Number(m[1]);
    if (at > bestAt) {
      bestAt = at;
      best = name;
    }
  }
  return best;
}

/**
 * Two links to the same stored photo: the server signs a new token on
 * every read, so only the path says whether the picture changed. A coin
 * already showing it keeps it rather than fetching it again.
 */
export function samePhoto(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return a === b;
  return a.split("?")[0] === b.split("?")[0];
}

/** Every string the photo says, in one place (COPY-RULES). */
export const AVATAR_COPY = {
  /** The coin's name when there is no photo yet. */
  add: "Add a photo",
  /** The coin's name with a photo: it opens the sheet. */
  change: "Change your photo",
  sheetTitle: "Your photo",
  choose: "Choose a new photo",
  remove: "Remove photo",
  saving: "Saving your photo…",
  /** 400, 413, 415: what was picked is not a photo the card can use. */
  notPhoto: "That file isn't a photo.",
  /** 503: the bucket's migration is not applied yet. */
  notYet: "Photos aren't on yet.",
  /** 429: past the hour's allowance (lib/rate-limit.ts `avatar`). */
  tooMany: "Too many photos for now. Try again in an hour.",
  failed: "Your photo didn't save.",
  removeFailed: "Your photo wasn't removed.",
  expired: "That session has expired. Sign in and try again.",
} as const;

/** What the server's answer to a save means for the person, in AVATAR_COPY's words. */
export function avatarError(status: number): string {
  if (status === 401) return AVATAR_COPY.expired;
  if (status === 400 || status === 413 || status === 415) return AVATAR_COPY.notPhoto;
  if (status === 503) return AVATAR_COPY.notYet;
  if (status === 429) return AVATAR_COPY.tooMany;
  return AVATAR_COPY.failed;
}

/**
 * The one door under a failed line, and what it does: the same photo
 * sent again, a new one picked, the removal again, or none where a tap
 * now could not help (photos not on yet, the hour's allowance spent, a
 * session to sign in to, each line saying what to do). Never the same
 * unusable file again (#485 review: "That file isn't a photo" offered
 * "Try again" on the file it had just refused).
 */
export type AvatarRetry = { label: "Try again" | "Choose another"; does: "again" | "choose" | "remove" } | null;

export function avatarRetry(error: string): AvatarRetry {
  if (error === AVATAR_COPY.failed) return { label: "Try again", does: "again" };
  if (error === AVATAR_COPY.removeFailed) return { label: "Try again", does: "remove" };
  if (error === AVATAR_COPY.notPhoto) return { label: "Choose another", does: "choose" };
  return null;
}
