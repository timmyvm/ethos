/**
 * The profile photo's storage, server side (#485). Every call is made
 * with the service role on the private `avatars` bucket, under the
 * account's own folder, and only for the caller the route has already
 * checked: the browser never touches the bucket.
 *
 * The bucket is made by its migration (`*_avatars.sql`), applied by hand
 * like every migration here. Until it is, storage answers "Bucket not
 * found": a read is "no photo" (the card draws the initial), a save says
 * photos are not on yet, and an account's removal has nothing to take.
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AVATAR_BUCKET,
  AVATAR_LINK_SECONDS,
  avatarFolder,
  avatarPath,
  newestAvatar,
  type AvatarType,
} from "./avatar";

type StorageError = { message?: string; statusCode?: string | number; status?: number } | null | undefined;

/** Storage's answer for a bucket that does not exist (the migration not applied). */
export function bucketMissing(error: StorageError): boolean {
  return !!error && /bucket not found/i.test(error.message ?? "");
}

type Listed = { names: string[] } | { missing: true } | { failed: string };

/** The names in one account's folder. */
export async function listAvatars(db: SupabaseClient, userId: string): Promise<Listed> {
  const { data, error } = await db.storage.from(AVATAR_BUCKET).list(avatarFolder(userId), { limit: 100 });
  if (error) return bucketMissing(error) ? { missing: true } : { failed: error.message };
  return { names: (data ?? []).map((o) => o.name).filter(Boolean) };
}

export type SignedAvatar = { url: string } | { none: true } | { failed: string };

/** A short-lived link to the account's newest photo, or none. */
export async function signedAvatar(db: SupabaseClient, userId: string): Promise<SignedAvatar> {
  const listed = await listAvatars(db, userId);
  if ("missing" in listed) return { none: true };
  if ("failed" in listed) return listed;
  const name = newestAvatar(listed.names);
  if (!name) return { none: true };
  const { data, error } = await db.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(`${avatarFolder(userId)}/${name}`, AVATAR_LINK_SECONDS);
  if (error || !data?.signedUrl) return { failed: error?.message ?? "no link" };
  return { url: data.signedUrl };
}

export type PutAvatar = { path: string } | { missing: true } | { failed: string };

/**
 * A new photo in, then every older one in the folder out, so the folder
 * holds one photo. A new path every time: a link signed for the old one
 * never shows the new picture from a cache. If the tidy fails the new
 * photo still stands (the newest is the one read); the next save or the
 * account's removal takes what is left.
 */
export async function putAvatar(
  db: SupabaseClient,
  userId: string,
  bytes: Uint8Array,
  type: AvatarType,
  now = Date.now()
): Promise<PutAvatar> {
  const path = avatarPath(userId, now, type);
  const up = await db.storage.from(AVATAR_BUCKET).upload(path, bytes, {
    contentType: type,
    upsert: false,
    cacheControl: "3600",
  });
  if (up.error) return bucketMissing(up.error) ? { missing: true } : { failed: up.error.message };
  const listed = await listAvatars(db, userId);
  if ("names" in listed) {
    const own = path.slice(path.lastIndexOf("/") + 1);
    const older = listed.names.filter((n) => n !== own).map((n) => `${avatarFolder(userId)}/${n}`);
    if (older.length) await db.storage.from(AVATAR_BUCKET).remove(older);
  }
  return { path };
}

/**
 * Every photo the account kept, gone: "Remove photo", and the account's
 * own removal (app/api/account). A bucket that does not exist holds
 * nothing to take, so it is done.
 */
export async function removeAvatars(db: SupabaseClient, userId: string): Promise<{ ok: true } | { failed: string }> {
  const listed = await listAvatars(db, userId);
  if ("missing" in listed) return { ok: true };
  if ("failed" in listed) return listed;
  if (listed.names.length === 0) return { ok: true };
  const paths = listed.names.map((n) => `${avatarFolder(userId)}/${n}`);
  const { error } = await db.storage.from(AVATAR_BUCKET).remove(paths);
  if (error && !bucketMissing(error)) return { failed: error.message };
  return { ok: true };
}
