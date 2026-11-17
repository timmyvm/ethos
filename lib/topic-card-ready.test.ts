import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TopicCard } from "@/components/rep/TopicCard";

/*
 * The ready recorder (#431) after the #430 review: the card Start carried
 * over keeps Today's type, 40/800 (`.home-display`, 34 past 40
 * characters), where it set the recorder's 26px inside a bigger card.
 */
const card = (topic: string, display: boolean, compact = false) =>
  renderToStaticMarkup(
    createElement(TopicCard, { eyebrow: "Today's practice", topic, family: "pause", art: "the-landing", display, compact })
  );

describe("the ready card's topic", () => {
  it("is set in Today's display type when ready", () => {
    const html = card("The last time you were genuinely nervous", true);
    expect(html).toMatch(/<h1[^>]*class="[^"]*home-display/);
    expect(html).not.toMatch(/<h1[^>]*text-title/);
    expect(html).not.toMatch(/<h1[^>]*data-long/);
  });

  it("steps down past 40 characters, as Today's card does", () => {
    expect(card("Explain how interest works to someone who has never had a loan", true)).toMatch(/<h1[^>]*data-long="true"/);
  });

  /* #473: at 34px the one prompt over 60 ran five lines on Today's card
     and here; past 60 both take the reel's 28. */
  it("steps down again past 60 characters, and only past 60", () => {
    const longest = card("Explain how interest works to someone who's never had a bank account", true);
    expect(longest).toMatch(/<h1[^>]*data-long="true"/);
    expect(longest).toMatch(/<h1[^>]*data-longer="true"/);
    expect(card("Whether to be great at one thing or good at many", true)).not.toMatch(/data-longer/);
  });

  it("keeps the recorder's own type when not ready, and the compact type while recording", () => {
    expect(card("The last time you were genuinely nervous", false)).toMatch(/<h1[^>]*text-title/);
    const live = card("The last time you were genuinely nervous", true, true);
    expect(live).toMatch(/<h1[^>]*text-lead/);
    expect(live).not.toMatch(/home-display/);
  });
});

/*
 * The lit corner sits behind the object (app/globals.css, the family
 * fills). Where the card stands no object, none to stand or no room for
 * it at 320, the corner goes with it (#496, the morning tour,
 * docs/look/tour/03-ready-warmup-320-light.png: a pale blotch in the
 * card's top right).
 */
describe("the ready card's light", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const LIT = /radial-gradient\(46% 42% at 84% 6%, var\(--home-lit\)/;

  it("drops the lit corner on a card with no object, and keeps the rest of its fill", () => {
    const rule = css.match(/\.family-fill\[data-object="none"\]::before \{([^}]*)\}/)?.[1];
    expect(rule, "the no-object rule").toBeTruthy();
    expect(rule).not.toMatch(LIT);
    expect(rule).toMatch(/var\(--home-low\)/);
    expect(rule).toMatch(/linear-gradient\(172deg, var\(--home-a\) 0%, var\(--home-b\) 76%\)/);
    // The card that stands its object keeps its light.
    expect(css.match(/\.family-fill::before,\s*\.home-hero::before \{([^}]*)\}/)?.[1]).toMatch(LIT);
  });

  it("marks the card with no object, and only that card", () => {
    const bare = renderToStaticMarkup(createElement(TopicCard, { eyebrow: "Today's practice", topic: "Your hometown", family: "pause", display: true }));
    expect(bare).toMatch(/<section[^>]*data-object="none"/);
    // With an object the server's first frame leaves the card as it was, until the room for it is measured.
    expect(card("Your hometown", true)).not.toMatch(/data-object/);
    const src = readFileSync("components/rep/TopicCard.tsx", "utf8");
    expect(src).toMatch(/data-object=\{measured && !show \? "none" : undefined\}/);
  });
});
