import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DemosArt } from "@/components/DemosArt";
import { IntroDemos } from "@/components/IntroDemos";
import { CLIP_POSES } from "./idle-clips";

/*
 * The introduction keeps Demos's entrance and nothing after it (notes1,
 * Timothy: "the image like animates by moving the png around and then a
 * video animation plays after that image chop animation. Looks weird.
 * Lets js have the chopping image animation"). His idle clip (#316) is
 * off on every screen of /welcome, and on everywhere else.
 */
const welcome = readFileSync("app/welcome/page.tsx", "utf8");
const art = readFileSync("components/DemosArt.tsx", "utf8");

/*
 * Rendered, not read (notes1, round 2): the clip mounts its own host
 * (`data-clip`) inside DemosArt's frame, so the markup says whether a
 * Demos will play one. Every pose that has a clip, at every size the
 * introduction draws him at 120px and up.
 */
describe("the introduction's Demos, rendered", () => {
  const sizes = [120, 200, 300, 320];
  const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

  it("never mounts the clip, for any pose that has one, at any size", () => {
    for (const pose of CLIP_POSES) {
      for (const size of sizes) {
        expect(html(createElement(IntroDemos, { pose, size }))).not.toMatch(/data-clip/);
      }
    }
  });

  it("while the same Demos anywhere else mounts it", () => {
    for (const pose of CLIP_POSES) {
      for (const size of sizes) {
        expect(html(createElement(DemosArt, { pose, size }))).toMatch(new RegExp(`data-clip="${pose}"`));
      }
    }
  });

  it("keeps the still and its entrance: the picture and the pop", () => {
    const out = html(createElement(IntroDemos, { pose: "hello", size: 200, pop: true }));
    expect(out).toMatch(/<img[^>]+demos-onboard-hello/);
    expect(out).toMatch(/demos-pop|pop/);
  });
});

describe("the introduction's Demos", () => {
  it("is drawn through one wrapper that turns the idle clip off", () => {
    const wrapper = readFileSync("components/IntroDemos.tsx", "utf8");
    expect(wrapper).toMatch(/<DemosArt \{\.\.\.props\} idle=\{false\} \/>/);
    expect(welcome).toMatch(/import \{ IntroDemos \} from "@\/components\/IntroDemos"/);
  });

  it("has no Demos that skips the wrapper", () => {
    const raw = welcome.match(/<DemosArt\b/g) ?? [];
    expect(raw.length).toBe(0);
    expect((welcome.match(/<IntroDemos\b/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it("never mounts the clip itself", () => {
    expect(welcome).not.toMatch(/DemosClip|DemosFigure/);
  });
});

describe("the clip everywhere else", () => {
  it("still plays by default at 120px and up", () => {
    expect(art).toMatch(/idle = true/);
    expect(art).toMatch(/const clip = idle && size >= 120 && hasClip\(pose\)/);
  });
});
