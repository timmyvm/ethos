"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AVATAR_COPY, avatarRetry, samePhoto, type AvatarRetry } from "@/lib/avatar";
import { fetchAvatar, heldAvatar, makeAvatar, removeAvatar, uploadAvatar, type MadeAvatar } from "@/lib/avatar-client";
import { fetchProfile, updateEquippedPose } from "@/lib/client-data";
import { initialOf } from "@/lib/home";
import {
  INITIAL,
  PHOTO,
  PICTURE_COPY,
  afterBrokenPhoto,
  needsLedger,
  photoPath,
  needsPhoto,
  pictureChoices,
  pictureRow,
  resolvePicture,
  type Picture,
  type PictureRow,
} from "@/lib/picture";
import { deviceChoice, fetchOwnedPoses, heldOwnedPoses, onPhotoBroke } from "@/lib/picture-client";
import { adoptAccountPose, wearPose } from "@/lib/pose-save";
import { useRevalidate } from "@/lib/use-revalidate";
import { useWarm } from "@/lib/use-warm";

export interface PictureState {
  /** What to draw. */
  picture: Picture;
  /** The row the choices check: the picture on screen. */
  shown: PictureRow | null;
  /** Every choice, in the list's order (lib/picture.ts `pictureChoices`). */
  rows: PictureRow[];
  /** The photo kept, or the phone's own copy while it saves; null for none, undefined unread. */
  photo: string | null | undefined;
  letter: string | null;
  /** Whether the name has been read: until then the initial's row draws nothing, never the outline. */
  nameKnown: boolean;
  saving: boolean;
  /** A failed line, or null. */
  error: string | null;
  /** The one door under a failed photo line (lib/avatar.ts `avatarRetry`), and what it does. */
  retry: { label: NonNullable<AvatarRetry>["label"]; run: () => void } | null;
  choose: (row: PictureRow) => void;
  /** Opens the phone's own picker (#485's, the only one). */
  pickPhoto: () => void;
  removePhoto: () => void;
  /** The hidden file input and the saving line: render it once, anywhere on the page. */
  input: ReactNode;
}

/**
 * One picture (#488), from the phone: the choice, the photo and the
 * poses owned, read and kept here for every surface that shows a picture
 * of the person, and the three ways to change it (choose a row, keep a
 * photo, remove the photo). You's card, Settings' index and its Profile,
 * and Today's corner all draw through this; nothing else reads the
 * choice, the photo or the ledger for a picture.
 *
 * What is read, and when:
 *  - the choice: this phone's copy (`prefs.pose`) for the first paint,
 *    then the account's (`profiles.equipped_pose`) unless a save from
 *    here is still landing (lib/pose-save.ts);
 *  - the photo: only where drawing the choice could need it, or where
 *    the choices are listed (`choices`);
 *  - the ledger: only for a paid pose, which it has to prove, or where
 *    the choices are listed.
 * Each is held for the visit (lib/held.ts), so a tab opens on its
 * picture, and read again behind it on a return (`useRevalidate`).
 *
 * The photo's saving is #485's, moved here whole: the square the phone
 * made is drawn at once, dimmed, while it is sent; a saved photo becomes
 * the choice, the latest one winning; a removal takes the photo and
 * leaves the choice, so a pose or the initial stands where it was.
 */
export function usePicture({
  name,
  nameKnown,
  choices = false,
}: {
  name: string | null;
  nameKnown: boolean;
  /** This surface lists the choices: read the photo and the ledger whatever is chosen. */
  choices?: boolean;
}): PictureState {
  const warm = useWarm();
  const [choice, setChoice] = useState<string | null | undefined>(() => (warm ? deviceChoice() : undefined));
  const [photo, setPhoto] = useState<string | null | undefined>(() => (warm ? heldAvatar() : undefined));
  const [owned, setOwned] = useState<ReadonlySet<string> | null>(() => (warm ? (heldOwnedPoses() ?? null) : null));
  /** The picked photo, drawn from the phone while the server keeps it. */
  const [local, setLocal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null);
  /** Which choice is the latest, so an older save's failure stays quiet. */
  const turn = useRef(0);
  const asked = useRef({ photo: false, ledger: false });

  const readChoice = () => {
    fetchProfile()
      .then((p) => {
        if (p) setChoice(adoptAccountPose(p.equipped_pose));
      })
      // The account unread: this phone's copy stands.
      .catch(() => setChoice((was) => (was === undefined ? deviceChoice() : was)));
  };
  const readPhoto = () => {
    asked.current.photo = true;
    fetchAvatar()
      // A link signed again for the same photo keeps the one drawn.
      .then((url) => setPhoto((was) => (samePhoto(was, url) ? was : url)))
      // A failed read leaves what is drawn; an unread photo is none.
      .catch(() => setPhoto((was) => (was === undefined ? null : was)));
  };
  const readLedger = () => {
    asked.current.ledger = true;
    // A failed read leaves the choice trusted (owned stays null).
    fetchOwnedPoses().then(setOwned).catch(() => {});
  };

  useEffect(() => {
    setChoice((was) => (was === undefined ? deviceChoice() : was));
    readChoice();
  }, []);
  /* A photo whose link would not load in any coin: read once more for a
     fresh link, then draw the initial (lib/picture.ts `afterBrokenPhoto`).
     The photo as last set is mirrored here, so a second coin reporting
     the same dead link finds it already gone and changes nothing. */
  const photoNow = useRef(photo);
  photoNow.current = photo;
  const retried = useRef(new Set<string>());
  useEffect(
    () =>
      onPhotoBroke((url) => {
        const next = afterBrokenPhoto(photoNow.current, url, retried.current);
        if (next.photo === photoNow.current) return;
        photoNow.current = next.photo;
        setPhoto(next.photo);
        if (next.refetch) {
          retried.current.add(photoPath(url));
          readPhoto();
        }
      }),
    []
  );
  // The photo and the ledger only once the choice says they are needed.
  const wantPhoto = choices || (choice !== undefined && needsPhoto(choice, owned));
  const wantLedger = choices || needsLedger(choice);
  useEffect(() => {
    if (wantPhoto && !asked.current.photo) readPhoto();
  }, [wantPhoto]);
  useEffect(() => {
    if (wantLedger && !asked.current.ledger) readLedger();
  }, [wantLedger]);
  useRevalidate(() => {
    readChoice();
    if (wantPhoto) readPhoto();
    if (wantLedger) readLedger();
  });
  // The phone's copy of a picked photo is let go once nothing draws it.
  useEffect(() => () => void (local && URL.revokeObjectURL(local)), [local]);

  const letter = initialOf(name);
  const kept = local ?? photo;
  const picture = resolvePicture({ choice, photo: kept, owned, letter, nameKnown });
  const shown = pictureRow(picture);
  const rows = pictureChoices({ hasPhoto: !!kept, owned, shown });

  /** Wear a choice: on this phone at once, then on the account, as a pose always was. */
  function wear(row: PictureRow) {
    setChoice(row);
    const mine = ++turn.current;
    void wearPose(row, updateEquippedPose).then((saved) => {
      if (saved || mine !== turn.current) return;
      setError(PICTURE_COPY.failed);
      fetchProfile()
        .then((p) => {
          if (p && mine === turn.current) setChoice(adoptAccountPose(p.equipped_pose));
        })
        .catch(() => {});
    });
  }

  function choose(row: PictureRow) {
    setError(null);
    if (row === shown) return;
    wear(row);
  }

  async function keep(file: File) {
    lastFile.current = file;
    setError(null);
    setSaving(true);
    // The square the server will keep is made first, and that is what
    // the coin draws while it saves: the same crop, 256px, never the
    // camera's 12 to 48 MP original decoded for a 64px coin.
    let picture: MadeAvatar;
    try {
      picture = await makeAvatar(file);
    } catch {
      setSaving(false);
      setError(AVATAR_COPY.notPhoto);
      return;
    }
    const was = choice;
    const mine = ++turn.current;
    setLocal(URL.createObjectURL(picture.blob));
    // The new photo shows at once, over whatever was chosen.
    setChoice(PHOTO);
    const saved = await uploadAvatar(picture);
    setSaving(false);
    if (!saved.ok) {
      setLocal(null);
      if (mine === turn.current) setChoice(was);
      setError(saved.error);
      return;
    }
    // The phone's copy stays on screen for this visit: the signed link
    // is the same picture, fetched again.
    setPhoto(saved.url);
    // A photo saved is the latest choice (#488).
    if (mine === turn.current) wear(PHOTO);
  }

  async function removePhoto() {
    setError(null);
    const was = photo;
    setLocal(null);
    setPhoto(null);
    const gone = await removeAvatar();
    if (!gone.ok) {
      setPhoto(was);
      setError(gone.error);
    }
  }

  const pickPhoto = () => input.current?.click();

  /* One door under a failed photo line, or none where a tap now could
     not help (lib/avatar.ts `avatarRetry`): never the refused file sent
     again. A failed choice has none: the list is the way to try again. */
  const door = error ? avatarRetry(error) : null;
  const run =
    door?.does === "again" && lastFile.current
      ? () => void keep(lastFile.current!)
      : door?.does === "remove"
        ? () => void removePhoto()
        : door
          ? pickPhoto
          : null;
  const retry = door && run ? { label: door.label, run } : null;

  const inputNode = (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void keep(file);
        }}
      />
      {saving && (
        <span role="status" className="sr-only">
          {AVATAR_COPY.saving}
        </span>
      )}
    </>
  );

  return {
    picture,
    shown,
    rows,
    photo: kept,
    letter,
    nameKnown,
    saving,
    error,
    retry,
    choose,
    pickPhoto,
    removePhoto: () => void removePhoto(),
    input: inputNode,
  };
}

/** The picture a row of the choices draws. */
export function rowPicture(row: PictureRow, state: Pick<PictureState, "photo" | "letter" | "nameKnown">): Picture {
  if (row === PHOTO) return state.photo ? { kind: "photo", url: state.photo } : { kind: "unknown" };
  if (row === INITIAL) return state.nameKnown ? { kind: "initial", letter: state.letter } : { kind: "unknown" };
  return resolvePicture({ choice: row, photo: null, owned: null, letter: state.letter, nameKnown: true });
}
