"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconCamera, IconYou } from "@/components/Icon";
import { Overlay } from "@/components/ui/Overlay";
import { SheetHead } from "@/components/ui/SheetHead";
import { AVATAR_COPY, samePhoto } from "@/lib/avatar";
import { fetchAvatar, heldAvatar, removeAvatar, saveAvatar } from "@/lib/avatar-client";
import { initialOf } from "@/lib/home";
import { useRevalidate } from "@/lib/use-revalidate";
import { useWarm } from "@/lib/use-warm";

/**
 * The profile photo on You's card (#485, Timothy 16 Nov: "remove demos
 * from that card and add a pfp option"). Today's initial coin, larger:
 * the photo when there is one, the name's initial when there is not, and
 * a person's outline before there is a name. A camera badge at its foot
 * says it takes a photo.
 *
 * With no photo a tap opens the phone's own picker (the camera roll or
 * the camera, `accept="image/*"`); with one, a sheet offers a new photo
 * or its removal. The picked photo is cut and shrunk on the phone
 * (lib/avatar-client.ts) and shows at once, dimmed, while it saves.
 *
 * The photo is undefined until read, so the coin holds its place with
 * nothing in it and never swaps a letter for a photo it already had.
 *
 * A hook, because its three parts stand in three places: the coin in the
 * card's row, a failure's line under the card, and the sheet over the
 * page.
 */
export function useYouAvatar({
  name,
  nameKnown,
}: {
  name: string | null;
  nameKnown: boolean;
}): { coin: ReactNode; problem: ReactNode; sheet: ReactNode } {
  const warm = useWarm();
  const [photo, setPhoto] = useState<string | null | undefined>(() => (warm ? heldAvatar() : undefined));
  /** The picked photo, drawn from the phone while the server keeps it. */
  const [local, setLocal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null);

  const read = () => {
    fetchAvatar()
      // A link signed again for the same photo keeps the one drawn.
      .then((url) => setPhoto((was) => (samePhoto(was, url) ? was : url)))
      // A failed read leaves what is drawn; an unread coin shows the initial.
      .catch(() => setPhoto((was) => (was === undefined ? null : was)));
  };
  useEffect(() => {
    read();
  }, []);
  useRevalidate(read);
  // The phone's copy of a picked photo is let go once nothing draws it.
  useEffect(() => () => void (local && URL.revokeObjectURL(local)), [local]);

  const shown = local ?? photo ?? null;
  const letter = initialOf(name);

  async function keep(file: File) {
    lastFile.current = file;
    setError(null);
    setSaving(true);
    setLocal(URL.createObjectURL(file));
    const saved = await saveAvatar(file);
    setSaving(false);
    if (!saved.ok) {
      setLocal(null);
      setError(saved.error);
      return;
    }
    // The phone's copy stays on screen for this visit: the signed link
    // is the same picture, fetched again.
    setPhoto(saved.url);
  }

  async function drop() {
    setSheet(false);
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

  const choose = () => input.current?.click();

  const coin = (
    <>
      <button
        type="button"
        data-look="avatar"
        aria-label={shown ? AVATAR_COPY.change : AVATAR_COPY.add}
        aria-haspopup={shown ? "dialog" : undefined}
        aria-busy={saving || undefined}
        onClick={() => (shown ? setSheet(true) : choose())}
        className="press you-avatar rounded-full"
        data-photo={shown ? "" : undefined}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed link or the phone's own copy
          <img
            src={shown}
            alt=""
            onLoad={() => setLoaded(true)}
            className={`dur-base transition-opacity ${loaded || local ? "" : "opacity-0"} ${saving ? "opacity-60" : ""}`}
          />
        ) : photo === undefined || !nameKnown ? null : letter ? (
          <span aria-hidden className="fade-in">
            {letter}
          </span>
        ) : (
          <span aria-hidden className="fade-in text-stone-500">
            <IconYou size={28} />
          </span>
        )}
        <span aria-hidden className="you-avatar-badge">
          <IconCamera size={14} />
        </span>
      </button>
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

  const problem = error ? (
    <p role="alert" data-look="avatar-error" className="mt-2 text-caption text-stone-500">
      {error}{" "}
      <button
        type="button"
        onClick={
          lastFile.current && error !== AVATAR_COPY.removeFailed
            ? () => void keep(lastFile.current!)
            : error === AVATAR_COPY.removeFailed
              ? () => void drop()
              : choose
        }
        className="relative font-semibold text-stone-600 underline underline-offset-2 after:absolute after:-inset-x-2 after:-inset-y-[13px] after:content-['']"
      >
        Try again
      </button>
    </p>
  ) : null;

  const overlay =
    sheet && shown ? (
      <Overlay label={AVATAR_COPY.sheetTitle} onClose={() => setSheet(false)} className="w-full max-w-[430px]">
        <div className="elev-3 w-full max-w-[430px] rounded-t-sheet bg-raised px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
          <SheetHead onClose={() => setSheet(false)} />
          <h2 className="detail-head text-center">{AVATAR_COPY.sheetTitle}</h2>
          <div className="mt-4 flex justify-center">
            <span className="you-avatar rounded-full" data-photo="" style={{ width: 112, height: 112 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the same photo, larger */}
              <img src={shown} alt="" />
            </span>
          </div>
          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => {
                choose();
                setSheet(false);
              }}
              className="press font-display min-h-12 w-full rounded-tap bg-surface px-6 text-body font-bold"
            >
              {AVATAR_COPY.choose}
            </button>
            <button
              type="button"
              onClick={() => void drop()}
              className="press font-display min-h-12 w-full rounded-tap px-6 text-body font-bold text-destructive"
            >
              {AVATAR_COPY.remove}
            </button>
          </div>
        </div>
      </Overlay>
    ) : null;

  return { coin, problem, sheet: overlay };
}
