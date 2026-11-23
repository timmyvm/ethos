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
 * The lit corner that stood behind the 3D object (#496: on a card with no
 * object it was a pale blotch in the top right) is gone from every family
 * fill since the flat set: a flat object stands on its own solid disc, so
 * no card, with an object or without, carries a light of its own there.
 */
describe("the ready card's light", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const LIT = /radial-gradient\(46% 42% at 84% 6%|--home-lit/;

  it("no family fill carries the lit corner, and the fill keeps its glow and its fall", () => {
    expect(css).not.toMatch(LIT);
    const rule = css.match(/\.family-fill::before,\s*\.home-hero::before \{([^}]*)\}/)?.[1];
    expect(rule, "the shared fill").toBeTruthy();
    expect(rule).toMatch(/var\(--home-low\)/);
    expect(rule).toMatch(/linear-gradient\(172deg, var\(--home-a\) 0%, var\(--home-b\) 76%\)/);
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
