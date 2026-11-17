import { existsSync, readFileSync, statSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PictureCoin } from "@/components/picture/PictureCoin";
import { ItemArt } from "@/components/shop/ItemArt";
import { SheetHead } from "@/components/ui/SheetHead";
import {
  HELLO,
  INITIAL,
  PHOTO,
  PICTURE_COPY,
  afterBrokenPhoto,
  bustSrc,
  isPaidPose,
  needsLedger,
  needsPhoto,
  photoPath,
  pictureChoices,
  pictureRow,
  resolvePicture,
  rowName,
  rowPose,
  type Picture,
  type PictureInput,
} from "./picture";
import { onPhotoBroke, photoBroke } from "./picture-client";
import { POSE_STAGE, SHOP, SHOP_PICTURE, itemById, ownedFrom } from "./shop";

/*
 * One picture (#488). Before it, one person had three: You's card drew
 * #485's photo or the initial, Settings drew Demos in the pose worn
 * (#479), Today's corner drew the initial, and the Shop sold poses "on
 * You" that showed nowhere. These hold the rules of the one picture, its
 * fallback, the Shop's words, and that every surface draws it from one
 * source.
 */

const URL_A = "https://x.supabase.co/storage/v1/object/sign/avatars/u1/1.webp?token=a";
const POSES = Object.keys(POSE_STAGE);
const owns = (...ids: string[]) => new Set(ids);
const at = (over: Partial<PictureInput>): Picture =>
  resolvePicture({ choice: null, photo: null, owned: owns(), letter: "T", nameKnown: true, ...over });

describe("the choice's rules", () => {
  it("draws the photo when the photo is chosen", () => {
    expect(at({ choice: PHOTO, photo: URL_A })).toEqual({ kind: "photo", url: URL_A });
  });

  it("draws a pose the ledger proves, as Demos in that pose", () => {
    for (const id of POSES) {
      expect(at({ choice: id, owned: owns(id) })).toEqual({ kind: "pose", id, pose: POSE_STAGE[id] });
    }
  });

  it("draws Hello for everyone: it needs no purchase", () => {
    expect(at({ choice: HELLO, owned: owns() })).toEqual({ kind: "pose", id: HELLO, pose: HELLO });
  });

  it("draws the initial when the initial is chosen, even over a kept photo", () => {
    expect(at({ choice: INITIAL, photo: URL_A })).toEqual({ kind: "initial", letter: "T" });
  });

  it("lets the latest choice win when a photo and a pose both exist, and never takes the photo away", () => {
    // A pose chosen over a kept photo: the pose shows ...
    const pose = at({ choice: "pose_speaking", photo: URL_A, owned: owns("pose_speaking") });
    expect(pose).toEqual({ kind: "pose", id: "pose_speaking", pose: "speaking" });
    // ... and the photo is still a row to go back to.
    expect(pictureChoices({ hasPhoto: true, owned: owns("pose_speaking"), shown: pictureRow(pose) })[0]).toBe(PHOTO);
    // The photo chosen again over the owned pose: the photo shows.
    expect(at({ choice: PHOTO, photo: URL_A, owned: owns("pose_speaking") })).toEqual({ kind: "photo", url: URL_A });
  });

  it("trusts a worn pose until the ledger is read, so a bought pose never flashes the initial", () => {
    expect(at({ choice: "pose_celebrate", owned: null })).toEqual({ kind: "pose", id: "pose_celebrate", pose: "celebrate" });
  });

  it("never draws a pose the ledger does not prove: a hand-edited choice unlocks nothing", () => {
    expect(at({ choice: "pose_celebrate", owned: owns("pose_speaking") })).toEqual({ kind: "initial", letter: "T" });
    expect(at({ choice: "pose_celebrate", owned: owns(), photo: URL_A })).toEqual({ kind: "photo", url: URL_A });
    // A short-paid spend proves nothing (ownedFrom's own rule).
    const short = ownedFrom([{ kind: "spent", reason: "shop:pose_celebrate", amount: 1 }]).ids;
    expect(at({ choice: "pose_celebrate", owned: short })).toEqual({ kind: "initial", letter: "T" });
    // An id the Shop does not sell is no pose at all.
    expect(isPaidPose("pose_unknown")).toBe(false);
    expect(at({ choice: "pose_unknown", owned: owns("pose_unknown") })).toEqual({ kind: "initial", letter: "T" });
  });

  it("draws nothing while the choice, or the photo it needs, is unread", () => {
    expect(at({ choice: undefined })).toEqual({ kind: "unknown" });
    expect(at({ choice: null, photo: undefined })).toEqual({ kind: "unknown" });
    expect(at({ choice: PHOTO, photo: undefined })).toEqual({ kind: "unknown" });
    // A pose or Hello needs no photo, so it draws at once.
    expect(at({ choice: HELLO, photo: undefined })).toEqual({ kind: "pose", id: HELLO, pose: HELLO });
    // The initial waits for the name, so a letter never swaps for the outline.
    expect(at({ choice: INITIAL, nameKnown: false })).toEqual({ kind: "unknown" });
  });

  it("reads the photo only where the choice could need it, and the ledger only for a paid pose", () => {
    expect(needsPhoto(null, null)).toBe(true);
    expect(needsPhoto(PHOTO, null)).toBe(true);
    expect(needsPhoto(HELLO, null)).toBe(false);
    expect(needsPhoto(INITIAL, null)).toBe(false);
    expect(needsPhoto("pose_speaking", null)).toBe(false);
    expect(needsPhoto("pose_speaking", owns("pose_speaking"))).toBe(false);
    // A pose the ledger refused falls back to the photo, so the photo is read.
    expect(needsPhoto("pose_speaking", owns())).toBe(true);
    expect(needsLedger("pose_speaking")).toBe(true);
    for (const c of [null, PHOTO, INITIAL, HELLO]) expect(needsLedger(c)).toBe(false);
  });
});

describe("the fallback with no choice", () => {
  it("is the photo when one is kept", () => {
    expect(at({ choice: null, photo: URL_A })).toEqual({ kind: "photo", url: URL_A });
  });

  it("is the initial with no photo, never Demos (#485: he left You's card; he is furniture nowhere)", () => {
    const fallback = at({ choice: null, photo: null });
    expect(fallback).toEqual({ kind: "initial", letter: "T" });
    expect(fallback.kind).not.toBe("pose");
  });

  it("is a person's outline with no name", () => {
    expect(at({ choice: null, letter: null })).toEqual({ kind: "initial", letter: null });
    expect(rowName(INITIAL, null)).toBe(PICTURE_COPY.none);
  });
});

describe("the choices", () => {
  it("list your photo, your initial, Hello, then each pose owned in the Shop's order", () => {
    expect(pictureChoices({ hasPhoto: true, owned: owns("pose_celebrate", "pose_speaking"), shown: PHOTO })).toEqual([
      PHOTO,
      INITIAL,
      HELLO,
      "pose_speaking",
      "pose_celebrate",
    ]);
    expect(pictureChoices({ hasPhoto: false, owned: owns(), shown: INITIAL })).toEqual([INITIAL, HELLO]);
  });

  it("keep the pose on screen as a row while the ledger is unread", () => {
    expect(pictureChoices({ hasPhoto: false, owned: null, shown: "pose_workout" })).toEqual([INITIAL, HELLO, "pose_workout"]);
  });

  it("check the picture on screen, so a fallback is checked as what it is", () => {
    expect(pictureRow(at({ choice: null, photo: URL_A }))).toBe(PHOTO);
    expect(pictureRow(at({ choice: null, photo: null }))).toBe(INITIAL);
    expect(pictureRow(at({ choice: "pose_speaking", owned: owns() }))).toBe(INITIAL);
    expect(pictureRow({ kind: "unknown" })).toBeNull();
  });

  it("name each row so a first-timer knows it in two seconds", () => {
    expect(rowName(PHOTO, "T")).toBe("Your photo");
    expect(rowName(INITIAL, "T")).toBe("Your initial");
    expect(rowName(HELLO, "T")).toBe("Hello");
    expect(rowName("pose_speaking", "T")).toBe("Talking");
    expect(rowName("pose_workout", "T")).toBe("Mid-practice");
    expect(rowName("pose_celebrate", "T")).toBe("Celebrating");
    expect(rowPose(PHOTO)).toBeNull();
    expect(rowPose(INITIAL)).toBeNull();
  });
});

describe("Demos in a coin", () => {
  const drawn = (picture: Picture, size = 44) => renderToStaticMarkup(createElement(PictureCoin, { picture, size }));

  it("is a bust cut for the coin, never his full figure", () => {
    for (const pose of [HELLO, ...Object.values(POSE_STAGE)] as const) {
      const html = drawn({ kind: "pose", id: pose, pose });
      expect(html).toContain(`src="${bustSrc(pose)}"`);
      expect(html).not.toMatch(/demos-onboard-/);
      expect(html).toMatch(/data-picture="pose"/);
    }
  });

  it("has a cut file for every pose, small enough for a coin, and the offline shell keeps them", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    for (const pose of [HELLO, ...Object.values(POSE_STAGE)]) {
      const file = `public${bustSrc(pose as never)}`;
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeLessThan(24_000);
      expect(sw).toContain(`"${bustSrc(pose as never)}"`);
    }
  });

  it("grows a changed picture in on the snappy spring, a fade under reduced motion, never on a first paint", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/\.picture-swap \{\s*animation: picture-swap var\(--spring-snappy-duration\) var\(--spring-snappy\) backwards;/);
    expect(css).toMatch(/:root\[data-motion="reduce"\] \.picture-swap \{\s*animation: fade-in /);
    for (const picture of [
      { kind: "pose", id: HELLO, pose: HELLO },
      { kind: "photo", url: URL_A },
      { kind: "initial", letter: "T" },
    ] as Picture[]) {
      expect(drawn(picture)).not.toMatch(/picture-swap/);
    }
  });

  it("draws the photo, the letter, the outline, or nothing", () => {
    expect(drawn({ kind: "photo", url: URL_A })).toContain(`src="${URL_A.replace(/&/g, "&amp;")}"`);
    expect(drawn({ kind: "initial", letter: "T" })).toMatch(/>T</);
    expect(drawn({ kind: "initial", letter: null })).toMatch(/<svg/);
    const empty = drawn({ kind: "unknown" });
    expect(empty).not.toMatch(/<img|<svg|>T</);
  });

  it("is what the Shop sells: its slot draws the coin the pose becomes", () => {
    for (const id of POSES) {
      const shop = renderToStaticMarkup(createElement(ItemArt, { id }));
      expect(shop).toContain(`src="${bustSrc(POSE_STAGE[id])}"`);
      expect(shop).toMatch(/class="picture-coin/);
    }
    const freeze = renderToStaticMarkup(createElement(ItemArt, { id: "streak_freeze" }));
    expect(freeze).toContain('src="/icons/3d/freeze.webp"');
    expect(freeze).not.toMatch(/picture-coin/);
  });
});

/*
 * You's picture sheet is an information sheet, so its head is theirs:
 * one row, its name at the left and Done at the right, as Every
 * number's sheet stands its own (#496, the morning tour: "Done" alone
 * on a row over a centred "Your picture").
 */
describe("the picture sheet's head", () => {
  it("is one row: the name at the left, Done at the right", () => {
    const head = renderToStaticMarkup(createElement(SheetHead, { onClose: () => {}, title: "Your picture" }));
    expect(head).toMatch(/justify-between/);
    const name = head.indexOf("<h2");
    const done = head.indexOf('data-look="sheet-done"');
    expect(name).toBeGreaterThan(-1);
    expect(name).toBeLessThan(done);
    expect(head).toMatch(/<h2 class="detail-head[^"]*">Your picture<\/h2>/);
    expect(head).not.toMatch(/text-center/);
    // Without a name it is the Done row every other sheet has.
    const bare = renderToStaticMarkup(createElement(SheetHead, { onClose: () => {} }));
    expect(bare).toMatch(/justify-end/);
    expect(bare).not.toMatch(/<h2/);
  });

  it("is what You's sheet draws, with no second head under it", () => {
    const sheet = readFileSync("components/picture/PictureChoices.tsx", "utf8");
    const body = sheet.slice(sheet.indexOf("export function PictureSheet"), sheet.indexOf("function SheetChoices"));
    expect(body).toMatch(/<SheetHead onClose=\{onClose\} title=\{PICTURE_COPY\.sheetTitle\} \/>/);
    expect(body).not.toMatch(/<h2/);
  });
});

describe("the Shop's words", () => {
  const shop = readFileSync("app/shop/page.tsx", "utf8");
  const lib = readFileSync("lib/shop.ts", "utf8");
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("sell a pose as your picture, in two seconds", () => {
    for (const id of POSES) expect(itemById(id)!.blurb, id).toBe("Wear it as your picture.");
    expect(SHOP_PICTURE).toEqual({
      blurb: "Wear it as your picture.",
      wear: "Wear it as your picture",
      worn: "Your picture",
      bought: "It's yours, and it's your picture now.",
    });
    expect(shop).toMatch(/SHOP_PICTURE\.worn : SHOP_PICTURE\.wear/);
    expect(shop).toMatch(/\? SHOP_PICTURE\.bought/);
  });

  it("no longer say a pose goes on You, which nothing on You draws", () => {
    for (const item of SHOP) expect(item.blurb, item.id).not.toMatch(/on You\b/);
    for (const src of [code(shop), code(lib)]) {
      expect(src).not.toMatch(/["'`][^"'`]*\bon You\b[^"'`]*["'`]/);
      expect(src).not.toMatch(/On You/);
    }
  });
});

describe("every picture surface reads one source", () => {
  const src = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const SURFACES = {
    you: "components/you/Avatar.tsx",
    today: "components/home/AvatarCoin.tsx",
    settings: "app/settings/page.tsx",
    profile: "app/settings/profile/page.tsx",
  };

  it("each surface reads the one hook and draws the one coin or the one list", () => {
    for (const [name, path] of Object.entries(SURFACES)) {
      const s = src(path);
      expect(s, name).toMatch(/usePicture\(\{/);
      expect(s, name).toMatch(/<PictureCoin\b|<PictureChoices\b/);
    }
    expect(src("app/you/page.tsx")).toMatch(/useYouAvatar\(/);
    expect(src("app/page.tsx")).toMatch(/<AvatarCoin\b/);
  });

  it("no surface reads the choice, the photo or the ledger for a picture by itself", () => {
    for (const [name, path] of Object.entries({ ...SURFACES, youPage: "app/you/page.tsx", todayPage: "app/page.tsx" })) {
      const s = src(path);
      expect(s, name).not.toMatch(/fetchAvatar|heldAvatar|adoptAccountPose|readPrefs\(\)\.pose|fetchWholeLedger|equipped_pose/);
      expect(s, name).not.toMatch(/PoseAvatar|YouDemos|you-avatar"|demos-onboard-/);
    }
  });

  it("the hook saves a choice the way the worn pose always was, and a pose never deletes the photo", () => {
    const hook = src("components/picture/usePicture.tsx");
    expect(hook).toMatch(/wearPose\(row, updateEquippedPose\)/);
    expect(hook).toMatch(/adoptAccountPose\(p\.equipped_pose\)/);
    // Only "Remove photo" removes it: choosing never reaches removeAvatar.
    const choose = hook.slice(hook.indexOf("function choose("), hook.indexOf("async function keep("));
    expect(choose).not.toMatch(/removeAvatar/);
    expect(hook.match(/removeAvatar\(\)/g)?.length).toBe(1);
    // A saved photo is the latest choice.
    const keep = hook.slice(hook.indexOf("async function keep("), hook.indexOf("async function removePhoto("));
    expect(keep.indexOf("uploadAvatar(")).toBeLessThan(keep.indexOf("wear(PHOTO)"));
  });

  it("both doors open the same choices: Settings' Profile inline, You's coin on a sheet", () => {
    expect(src("app/settings/profile/page.tsx")).toMatch(/<PictureChoices state=\{picture\} \/>/);
    const you = src("components/you/Avatar.tsx");
    expect(you).toMatch(/<PictureSheet state=\{state\}/);
    expect(src("components/picture/PictureChoices.tsx")).toMatch(/<PictureChoices state=\{state\} onPicked=\{close\} \/>/);
    // The photo is picked through #485's one picker, never a second.
    for (const path of ["components/picture/PictureChoices.tsx", "app/settings/profile/page.tsx", "components/you/Avatar.tsx"]) {
      expect(src(path), path).not.toMatch(/type="file"/);
    }
    expect(src("components/picture/usePicture.tsx").match(/type="file"/g)?.length).toBe(1);
  });
});

/*
 * A photo whose link will not load (#488 review). The link is signed for
 * an hour and held for the visit: a phone left open past it drew the dead
 * link on the next mount, read again, kept the dead one (`samePhoto`: the
 * new link names the same photo), and every coin, Today's corner first,
 * stayed an empty circle. The same happened to a photo removed on another
 * phone, and to a storage outage.
 */
describe("a photo that will not load", () => {
  const DEAD = "https://x.supabase.co/storage/v1/object/sign/avatars/u1/1.webp?token=old";
  const none = new Set<string>();

  it("asks once more for a fresh link, then draws the initial, never an empty coin", () => {
    // First failure: the link is forgotten and read again.
    expect(afterBrokenPhoto(DEAD, DEAD, none)).toEqual({ photo: undefined, refetch: true });
    // The same photo failing again (its fresh link too): no photo, so the initial.
    const retried = new Set([photoPath(DEAD)]);
    const fresh = DEAD.replace("token=old", "token=new");
    expect(afterBrokenPhoto(fresh, fresh, retried)).toEqual({ photo: null, refetch: false });
    expect(resolvePicture({ choice: PHOTO, photo: null, owned: owns(), letter: "T", nameKnown: true })).toEqual({ kind: "initial", letter: "T" });
    expect(photoPath(fresh)).toBe(photoPath(DEAD));
  });

  it("changes nothing for a link no longer drawn, a second coin's report, or the phone's own copy", () => {
    expect(afterBrokenPhoto(URL_A, DEAD, none)).toEqual({ photo: URL_A, refetch: false });
    expect(afterBrokenPhoto(undefined, DEAD, none)).toEqual({ photo: undefined, refetch: false });
    expect(afterBrokenPhoto(null, DEAD, none)).toEqual({ photo: null, refetch: false });
    expect(afterBrokenPhoto("blob:http://x/1", "blob:http://x/1", none)).toEqual({ photo: "blob:http://x/1", refetch: false });
  });

  it("is heard from any coin by the hook that drew it", () => {
    const heard: string[] = [];
    const stop = onPhotoBroke((url) => heard.push(url));
    photoBroke(DEAD);
    stop();
    photoBroke(URL_A);
    expect(heard).toEqual([DEAD]);
    const strip = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // The coin reports a photo's error, and only a photo's: a bust is a file of the app's own.
    expect(strip("components/picture/PictureCoin.tsx")).toMatch(/onError=\{picture\.kind === "photo" \? \(\) => photoBroke\(url\) : undefined\}/);
    const hook = strip("components/picture/usePicture.tsx");
    expect(hook).toMatch(/onPhotoBroke\(\(url\) => \{/);
    expect(hook).toMatch(/afterBrokenPhoto\(photoNow\.current, url, retried\.current\)/);
    expect(hook).toMatch(/if \(next\.refetch\) \{\s*retried\.current\.add\(photoPath\(url\)\);\s*readPhoto\(\);/);
  });
});

describe("the Shop's owned pose", () => {
  it("says what to do once: the button, not the blurb over it as well", () => {
    const page = readFileSync("app/shop/page.tsx", "utf8");
    // The blurb is drawn for a pose still for sale, never over the wear button.
    expect(page).toMatch(/\{isOwned \? null : \(\s*<p className="mt-1 text-caption text-pretty text-stone-500">\s*\{item\.blurb\}/);
    expect(page.match(/\{item\.blurb\}/g)?.length).toBe(1);
    expect(SHOP_PICTURE.wear).toBe(SHOP_PICTURE.blurb.replace(/\.$/, ""));
  });
});
