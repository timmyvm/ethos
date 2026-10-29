import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItemArt } from "@/components/shop/ItemArt";
import { YouDemos } from "@/components/you/YouDemos";
import { hasClip } from "./idle-clips";
import { itemById, ownedFrom, POSE_STAGE, SHOP, YOU_POSE, youPose } from "./shop";

/*
 * A bought pose has to show somewhere (money buys cosmetics only, and a
 * cosmetic that never shows is a broken purchase). #393 took Demos off
 * Today, where the Shop's poses used to stand, and the Shop went on
 * selling them "on your card" with nothing drawing them. You's identity
 * stage is where Demos stands every day now, so that is where they go.
 */
const price = (id: string) => SHOP.find((i) => i.id === id)?.price ?? 1;
const bought = (...ids: string[]) =>
  ids.map((id) => ({ kind: "spent", reason: `shop:${id}`, amount: price(id) }));
const earned = [{ kind: "earned", reason: "streak_day", amount: 1 }];
const POSES = SHOP.filter((i) => i.kind === "cosmetic").map((i) => i.id);

const stage = (props: Parameters<typeof YouDemos>[0]) =>
  renderToStaticMarkup(createElement(YouDemos, props));
/** The Demos still a stage draws, or null for an empty stage. */
const drawn = (html: string) => html.match(/demos-onboard-([a-z]+)\.webp/)?.[1] ?? null;

describe("youPose", () => {
  it("wears the equipped pose the ledger proves was bought", () => {
    expect(youPose("pose_speaking", ownedFrom(bought("pose_speaking")))).toBe("speaking");
    expect(youPose("pose_workout", ownedFrom(bought("pose_workout")))).toBe("clock");
    expect(youPose("pose_celebrate", ownedFrom(bought("pose_celebrate")))).toBe("celebrate");
  });

  it("is hello with nothing worn, a pose not owned, one short-paid, or one the shop does not sell", () => {
    expect(YOU_POSE).toBe("hello");
    expect(youPose(null, ownedFrom(bought("pose_speaking")))).toBe("hello");
    expect(youPose("pose_speaking", ownedFrom(earned))).toBe("hello");
    expect(youPose("pose_celebrate", ownedFrom(bought("pose_speaking")))).toBe("hello");
    expect(
      youPose("pose_celebrate", ownedFrom([{ kind: "spent", reason: "shop:pose_celebrate", amount: 1 }]))
    ).toBe("hello");
    expect(youPose("pose_unknown", ownedFrom([{ kind: "spent", reason: "shop:pose_unknown", amount: 99 }]))).toBe(
      "hello"
    );
  });
});

describe("You's stage, rendered", () => {
  it("draws every pose the shop sells once it is bought and worn", () => {
    for (const id of POSES) {
      const html = stage({ worn: id, ledger: [...earned, ...bought(id)] });
      expect([id, drawn(html)]).toEqual([id, POSE_STAGE[id]]);
    }
  });

  it("falls back to hello when the worn pose is not owned", () => {
    for (const id of POSES) {
      expect(drawn(stage({ worn: id, ledger: earned }))).toBe("hello");
      // Owning another pose proves nothing about this one.
      const other = POSES.find((p) => p !== id)!;
      expect(drawn(stage({ worn: id, ledger: bought(other) }))).toBe("hello");
    }
  });

  it("falls back to hello for a pose the shop does not sell", () => {
    const ledger = [{ kind: "spent", reason: "shop:pose_unknown", amount: 99 }];
    expect(drawn(stage({ worn: "pose_unknown", ledger }))).toBe("hello");
    // The device's copy, before the ledger answers, cannot name one either.
    expect(drawn(stage({ worn: "pose_unknown", ledger: null }))).toBe("hello");
  });

  it("keeps hello with nothing worn", () => {
    expect(drawn(stage({ worn: null, ledger: bought("pose_speaking") }))).toBe("hello");
    expect(drawn(stage({ worn: null, ledger: null }))).toBe("hello");
  });

  it("paints the device's copy until the ledger answers, so a bought pose never flashes hello", () => {
    expect(drawn(stage({ worn: "pose_celebrate", ledger: null }))).toBe("celebrate");
  });

  it("stands nobody on the stage before anything is read", () => {
    const html = stage({ worn: undefined, ledger: null });
    expect(drawn(html)).toBeNull();
    expect(html).toMatch(/demos-halo/);
  });

  it("steps a worn pose off for a moment with its own Demos, keeping the stage's light", () => {
    for (const id of POSES) {
      const html = stage({ worn: id, ledger: bought(id), away: true });
      expect(drawn(html)).toBeNull();
      expect(html).not.toMatch(/data-clip/);
      expect(html).toMatch(/demos-halo/);
    }
  });

  it("plays the idle clip only for a pose that has one", () => {
    for (const id of [null, ...POSES]) {
      const html = stage({ worn: id, ledger: id ? bought(id) : earned });
      const pose = drawn(html)!;
      if (hasClip(pose)) expect(html).toMatch(new RegExp(`data-clip="${pose}"`));
      else expect(html).not.toMatch(/data-clip/);
    }
  });

  it("springs back in when the moment goes", () => {
    expect(stage({ worn: "pose_speaking", ledger: bought("pose_speaking"), back: true })).toMatch(/demos-pop/);
    expect(stage({ worn: "pose_speaking", ledger: bought("pose_speaking") })).not.toMatch(/demos-pop/);
  });
});

/*
 * What the Shop shows is what You wears. "Demos, mid-practice" sold a
 * Demos holding out a stopwatch and put one hugging an alarm clock on
 * You's stage (Practice's boss); the speaking and celebrating stills were
 * other renders too. The Shop's slot draws the stage's own still now,
 * from the same source, and each blurb names what it shows.
 */
describe("the Shop's picture of a pose", () => {
  it("is the still You's stage draws once the pose is worn", () => {
    for (const id of POSES) {
      const shop = drawn(renderToStaticMarkup(createElement(ItemArt, { id })));
      const you = drawn(stage({ worn: id, ledger: [...earned, ...bought(id)] }));
      expect([id, shop]).toEqual([id, you]);
      expect([id, shop]).toEqual([id, POSE_STAGE[id]]);
    }
  });

  it("keeps the freeze its own tile", () => {
    const html = renderToStaticMarkup(createElement(ItemArt, { id: "streak_freeze" }));
    expect(drawn(html)).toBeNull();
    expect(html).toMatch(/you-freeze/);
  });

  it("names the pose each blurb puts on You", () => {
    expect(itemById("pose_speaking")!.blurb).toBe("Puts the speaking pose on You.");
    expect(itemById("pose_workout")!.blurb).toBe("Puts the alarm-clock pose on You.");
    expect(itemById("pose_celebrate")!.blurb).toBe("Puts the arms-up pose on You.");
    // The id is a ledger key: purchases are stored under it.
    expect(POSE_STAGE.pose_workout).toBe("clock");
    for (const item of SHOP) expect(item.blurb, item.id).not.toMatch(/stopwatch|milestone/i);
  });
});

describe("You's page", () => {
  const you = readFileSync("app/you/page.tsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("draws its stage's Demos through YouDemos, with the worn pose, the whole ledger and both moments", () => {
    expect(you).toMatch(
      /<YouDemos worn=\{worn\} ledger=\{poseLedger\} away=\{momentUp \|\| drop\.open\} back=\{back\} \/>/
    );
    // One whole-ledger read per visit: the pose is proven from the coin
    // sync's ledger, not from a second read of the same rows.
    expect(you).toMatch(/setPoseLedger\(read\.data\.ledger\)/);
    expect(you).not.toMatch(/fetchWholeLedger\b/);
    expect(you).not.toMatch(/<DemosArt\b/);
    expect(you).not.toMatch(/pose="hello"/);
  });

  it("lets the account's pose win over the device's copy, once this device's save has landed", () => {
    expect(you).toMatch(/setWorn\(readPrefs\(\)\.pose\)/);
    expect(you).toMatch(/setWorn\(adoptAccountPose\(p\.equipped_pose\)\)/);
  });
});
