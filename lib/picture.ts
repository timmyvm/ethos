/**
 * One picture of the person (#488): the rules, with no React and no
 * network.
 *
 * Before this there were three. You's card drew #485's photo (else the
 * name's initial), Settings drew Demos in the pose worn (#479), Today's
 * corner drew the initial, and the Shop sold poses "on You" that showed
 * nowhere since #485 took Demos off You's card. Now a person has one
 * picture, picked in one place, and every surface that shows a picture
 * of them draws it from here: You's card, Today's corner, Settings'
 * index and its Profile.
 *
 * A picture is one of:
 *  - **your photo**, kept in the private `avatars` bucket (#485);
 *  - **Demos in a pose you own**: Hello for everyone, and each pose the
 *    coin ledger proves was bought (`ownedFrom`), drawn as a bust in a
 *    sky coin (`bustSrc`), never a full figure in a 44pt circle;
 *  - **your initial**, the name's first letter (a person's outline before
 *    there is a name).
 *
 * **Where the choice lives.** In the column that held the worn pose,
 * `profiles.equipped_pose` (0007; text, 40 at most since 0030), saved the
 * way a pose always was: on the phone at once (`prefs.pose`), marked
 * pending, then on the account (lib/pose-save.ts `wearPose`), the
 * account's answer winning once it lands (`adoptAccountPose`). It holds
 * a pose's Shop id, or one of PHOTO, INITIAL and HELLO, or null for no
 * choice made. No migration: the words fit the column.
 *
 * **Which wins when both exist.** The latest choice. Saving a photo
 * chooses it; choosing a pose (or Hello, or the initial) shows that and
 * leaves the photo where it is, one tap away in the same list; only
 * "Remove photo" removes it. A choice of a pose never deletes a photo.
 *
 * **With no choice** (null, an old account, a pose the ledger cannot
 * prove): the photo if there is one, else the initial. Not Demos's
 * Hello: Timothy took Demos off You's card ("remove demos from that card
 * and add a pfp option", #485), and Demos appears at moments, never as
 * furniture (CLAUDE.md). He is on your picture only when you put him
 * there. Both were drawn and compared in docs/look/picture/.
 */

import { itemById, POSE_STAGE, type StagePose } from "./shop";

/** The stored choice for "my photo". */
export const PHOTO = "photo";
/** The stored choice for "my initial". */
export const INITIAL = "initial";
/** The stored choice for Demos's hello, the pose every account owns. */
export const HELLO = "hello";

/** A Demos pose a picture can draw: his hello, or one the Shop sells. */
export type PicturePose = StagePose | typeof HELLO;

/** What a picture of the person draws. */
export type Picture =
  | { kind: "photo"; url: string }
  | { kind: "pose"; id: string; pose: PicturePose }
  /** The name's first letter; null draws a person's outline. */
  | { kind: "initial"; letter: string | null }
  /** Not read yet: the coin holds its place with nothing in it. */
  | { kind: "unknown" };

/** A row in the list of choices: PHOTO, INITIAL, HELLO, or a pose's Shop id. */
export type PictureRow = string;

/** A paid pose's Shop id (`pose_speaking` and the rest). */
export function isPaidPose(id: string | null | undefined): id is string {
  return !!id && id in POSE_STAGE;
}

export interface PictureInput {
  /** The stored choice: undefined until read, null for none. */
  choice: string | null | undefined;
  /** The photo's link: undefined until read, null for none. */
  photo: string | null | undefined;
  /** The paid poses the ledger proves; null while it is unread or failed (the choice is trusted). */
  owned: ReadonlySet<string> | null;
  /** The name's first letter, or null with no name. */
  letter: string | null;
  /** Whether the name has been read: the initial waits for it, so a letter never swaps for the outline. */
  nameKnown: boolean;
}

/**
 * The picture to draw. A paid pose stands until the ledger is read (the
 * device's copy paints first, as the pose always did, so a bought pose
 * never flashes the initial), and once read only what it proves.
 */
export function resolvePicture({ choice, photo, owned, letter, nameKnown }: PictureInput): Picture {
  if (choice === undefined) return { kind: "unknown" };
  if (isPaidPose(choice) && (owned === null || owned.has(choice))) {
    return { kind: "pose", id: choice, pose: POSE_STAGE[choice] };
  }
  if (choice === HELLO) return { kind: "pose", id: HELLO, pose: HELLO };
  if (choice !== INITIAL) {
    // PHOTO, nothing chosen, or a pose the ledger cannot prove: the photo if there is one.
    if (photo === undefined) return { kind: "unknown" };
    if (photo) return { kind: "photo", url: photo };
  }
  return nameKnown ? { kind: "initial", letter } : { kind: "unknown" };
}

/** Whether drawing this choice could need the photo: every choice but a Demos or the initial. */
export function needsPhoto(choice: string | null | undefined, owned: ReadonlySet<string> | null): boolean {
  if (choice === HELLO || choice === INITIAL) return false;
  if (isPaidPose(choice)) return owned !== null && !owned.has(choice);
  return true;
}

/** Whether drawing this choice needs the ledger: only a paid pose has to be proved. */
export function needsLedger(choice: string | null | undefined): boolean {
  return isPaidPose(choice);
}

/**
 * What the photo becomes when its link will not load in a coin (the
 * img's error). A link is signed for an hour and held for the visit, so
 * a phone left open draws a dead one on its next mount, and reading
 * again cannot fix it alone: the new link names the same stored photo,
 * and `samePhoto` keeps the one already drawn. So the first failure of a
 * photo forgets the link and asks again (`refetch`); a second failure of
 * the same photo draws as no photo, the initial in its place, never an
 * empty circle. A link that is not the one drawn (already replaced, or
 * reported by a second coin) and the phone's own copy change nothing.
 */
export function afterBrokenPhoto(
  drawn: string | null | undefined,
  broken: string,
  retried: ReadonlySet<string>
): { photo: string | null | undefined; refetch: boolean } {
  if (broken.startsWith("blob:") || drawn !== broken) return { photo: drawn, refetch: false };
  return retried.has(photoPath(broken)) ? { photo: null, refetch: false } : { photo: undefined, refetch: true };
}

/** A photo's stored path, without the signature that changes on every read. */
export function photoPath(url: string): string {
  return url.split("?")[0];
}

/** The row a list of choices checks: the picture on screen, named as a choice. Null while unknown. */
export function pictureRow(picture: Picture): PictureRow | null {
  switch (picture.kind) {
    case "photo":
      return PHOTO;
    case "pose":
      return picture.id;
    case "initial":
      return INITIAL;
    default:
      return null;
  }
}

/**
 * The choices, in order: your photo (when there is one), your initial,
 * Hello, then each pose the ledger proves, in the Shop's order. While the
 * ledger is unread the pose on screen stands in the list too, so the
 * picture showing is always a row here.
 */
export function pictureChoices({
  hasPhoto,
  owned,
  shown,
}: {
  hasPhoto: boolean;
  owned: ReadonlySet<string> | null;
  shown: PictureRow | null;
}): PictureRow[] {
  const rows: PictureRow[] = [];
  if (hasPhoto) rows.push(PHOTO);
  rows.push(INITIAL, HELLO);
  for (const id of Object.keys(POSE_STAGE)) {
    if (owned ? owned.has(id) : id === shown) rows.push(id);
  }
  return rows;
}

/** The Demos a row draws, or null for the photo and the initial. */
export function rowPose(row: PictureRow): PicturePose | null {
  if (row === HELLO) return HELLO;
  return isPaidPose(row) ? POSE_STAGE[row] : null;
}

/**
 * Demos's bust for a coin (scripts/cut-busts.mjs): his head and
 * shoulders cut from the pose's still, 256px, so a 44pt coin shows a
 * face rather than a figure with a tail.
 */
export function bustSrc(pose: PicturePose): string {
  return `/demos-bust/${pose}.webp`;
}

/** A row's name in the list: what the picture is, in two seconds. */
export function rowName(row: PictureRow, letter: string | null): string {
  if (row === PHOTO) return PICTURE_COPY.photo;
  if (row === INITIAL) return letter ? PICTURE_COPY.initial : PICTURE_COPY.none;
  if (row === HELLO) return "Hello";
  // The Shop's name without "Demos, ": "Talking", "Celebrating".
  const name = itemById(row)?.name.replace(/^Demos,\s*/, "") ?? row;
  return `${name[0].toUpperCase()}${name.slice(1)}`;
}

/** Every string the picture says, in one place (COPY-RULES). */
export const PICTURE_COPY = {
  /** The sheet's title on You, and the coin's name. */
  sheetTitle: "Your picture",
  /** Settings' Profile section. */
  section: "Picture",
  /** The coin on You: a tap opens the choices. */
  change: "Change your picture",
  photo: "Your photo",
  initial: "Your initial",
  /** The initial's row when there is no name to take a letter from. */
  none: "No picture",
  /** A choice that did not reach the account; the account's picture is put back. */
  failed: "Your picture didn't change. Try again.",
  shop: "More poses in the Shop",
} as const;
