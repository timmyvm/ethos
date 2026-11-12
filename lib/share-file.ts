/**
 * A file, handed to the phone's own share sheet (#447).
 *
 * A picture made to be posted was offered as a download link. On an
 * iPhone that is the Files app at best, and from the Home Screen often
 * nothing at all; what every app does with a picture is raise the share
 * sheet, which holds Save Image, Messages and wherever it is going.
 * Where the browser can share a file, the tap raises that sheet; where
 * it cannot, the link is still the way to keep it.
 *
 * Files only: a title or text sent with a picture makes some apps post
 * the words and drop the picture.
 */

type ShareNav = {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: { files: File[] }) => Promise<void>;
};

const here = (): ShareNav | undefined =>
  typeof navigator === "undefined" ? undefined : (navigator as unknown as ShareNav);

/** Whether this browser will raise its share sheet for `file`. */
export function canShareFile(file: File, nav: ShareNav | undefined = here()): boolean {
  try {
    return (
      typeof nav?.share === "function" &&
      typeof nav.canShare === "function" &&
      nav.canShare({ files: [file] }) === true
    );
  } catch {
    return false;
  }
}

/**
 * `shared`: it went somewhere. `dismissed`: the sheet was closed, which
 * is an answer and not an error. `failed`: the browser refused, and the
 * caller falls back to the link.
 */
export type ShareOutcome = "shared" | "dismissed" | "failed";

export async function shareFile(file: File, nav: ShareNav | undefined = here()): Promise<ShareOutcome> {
  if (typeof nav?.share !== "function") return "failed";
  try {
    await nav.share({ files: [file] });
    return "shared";
  } catch (e) {
    return (e as { name?: string } | null)?.name === "AbortError" ? "dismissed" : "failed";
  }
}
