import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TalkLines } from "@/components/Talk";

/*
 * Demos talking, rendered (#501 review). A said line starts with every
 * word waiting (no `data-on`) and lands them one by one; a line that
 * follows the keys being typed (the name's reply) is whole from its first
 * frame, so a key typed never blanks his bubble and replays its words.
 */
const words = (html: string) => [...html.matchAll(/<span class="says-word talk-word"( data-on="")?( data-still="")?>/g)].map((m) => !!m[1]);
const still = (html: string) => [...html.matchAll(/<span class="says-word talk-word"( data-on="")?( data-still="")?>/g)].map((m) => !!m[2]);

describe("TalkLines, first frame", () => {
  it("a said line waits for its words", () => {
    const html = renderToStaticMarkup(
      createElement(TalkLines, { lines: ["Good to meet you, Sam."], lead: 0, classes: [undefined] })
    );
    expect(words(html)).toEqual([false, false, false, false, false]);
    expect(still(html)).toEqual([false, false, false, false, false]);
  });

  it("a typed line is there whole", () => {
    const html = renderToStaticMarkup(
      createElement(TalkLines, { lines: ["Good to meet you, Sam."], lead: 0, classes: [undefined], instant: true })
    );
    expect(words(html)).toEqual([true, true, true, true, true]);
    /* And still: no word pops of its own, so a key typed never shrinks them. */
    expect(still(html)).toEqual([true, true, true, true, true]);
  });
});
