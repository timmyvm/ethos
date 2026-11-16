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
