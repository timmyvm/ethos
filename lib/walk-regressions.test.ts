import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScoringStage } from "@/components/rep/ScoringStage";

/*
 * What the games work moved on screens that are not a game (the
 * regression review of bf236d6 and e004b1d, today F1 to F3, road F1 and
 * F2, edges F2 and F3). Each was a change meant for a game round that
 * reached every recording. These read app/rep/page.tsx and the card's
 * source, since the walk renders only in a browser; the browser repros
 * (verify-today f1, f2, f3) measured the same on the build.
 */
const page = readFileSync("app/rep/page.tsx", "utf8");

describe("the last step's closing", () => {
  /* Was "stands at a section's distance only for a level opened or a
     game mastered" (today F1): the closing was a card, and a card under
     "Records broken" kept the stack's 12px. Since #423 (Timothy, 6 Nov)
     no closing is a card: every one is the closing note, the take's
     last word, at a section's distance for every recording alike, so
     nothing a game round does can move another recording's ending. */
  it("is the same note at the same distance for every recording, game or not", () => {
    const at = page.indexOf("{last && closingNow && ");
    expect(at).toBeGreaterThan(0);
    const wrapper = page.slice(at, at + 120);
    expect(wrapper).toContain('<ClosingNote moment={closingNow} className="mt-7" />');
    expect(wrapper).not.toContain("ladder?.moment ?");
    expect(page).toMatch(/const closingNow = ladder\?\.moment \?\? closing;/);
  });
});

describe("the scoring wait on a take that is not a game", () => {
  it("passes the wave only a game round's cut-ins", () => {
    expect(page).toMatch(/cutIns=\{waitTicks\(\{ gameId, cutIns: waitNow\?\.cutIns \?\? \[\] \}\)\}/);
    expect(page).not.toMatch(/cutIns=\{waitNow\?\.cutIns \?\? \[\]\}/);
  });

  it("draws a plain wave with no ticks, at the baseline's foot", () => {
    const html = renderToStaticMarkup(
      createElement(ScoringStage, { levels: [0.2, 0.5, 0.1], seconds: 30, cutIns: [] })
    );
    expect(html).not.toContain("bg-ink");
    expect(html).toContain("-mx-1 -mt-1 pb-4");
    const game = renderToStaticMarkup(
      createElement(ScoringStage, { levels: [0.2, 0.5, 0.1], seconds: 30, cutIns: [14.5], fact: "Demos cut in at 0:14." })
    );
    expect(game).toContain("bg-ink");
    expect(game).toContain("-mx-1 -mt-1 pb-6");
  });
});

describe("the recording card's words on Record", () => {
  const card = readFileSync("components/rep/TopicCard.tsx", "utf8");

  it("fade in only when the question is revealed, never on No notes' swap", () => {
    expect(card).toMatch(/if \(!compact \|\| !reveal\) return;/);
    expect(card).toMatch(/reveal = false,/);
    expect(page).toMatch(/reveal=\{config\.revealOnRecord\}/);
  });
});
