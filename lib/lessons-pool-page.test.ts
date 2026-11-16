import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LESSONS } from "@/content/lessons";
import { fitsPool, TOPICS } from "./topics";

/*
 * The lesson page as the server draws it (#492 review). Nobody's answers
 * are known there, so a practice whose topic one pool stands another in
 * for holds its line, and the page the server sends never names a topic
 * the school pool drops. Rendered for real, so a page that printed the
 * lesson's own prompt again (`p.prompt`) fails here even if it still
 * called `lessonFor` somewhere.
 */

const route = vi.hoisted(() => ({ id: "" }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: route.id }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push() {}, replace() {}, back() {}, prefetch() {} }),
  usePathname: () => `/lessons/${route.id}`,
  notFound: () => {
    throw new Error("notFound");
  },
}));

const { default: LessonPage } = await import("@/app/lessons/[id]/page");

/* The server escapes an apostrophe; compare against the text as drawn. */
const html = (id: string) => {
  route.id = id;
  return renderToString(createElement(LessonPage))
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
};

const DROPPED = TOPICS.filter((t) => !fitsPool(t, "school"));

describe("the lesson page the server sends (#492)", () => {
  beforeEach(() => {
    route.id = "";
  });

  it("names no topic the school pool drops, on any lesson", () => {
    for (const l of LESSONS) {
      const page = html(l.id);
      expect(page, l.id).toContain(l.title);
      for (const t of DROPPED) expect(page.includes(t.prompt), `${l.id}: ${t.prompt}`).toBe(false);
    }
  });

  it("holds the line of each practice the pools name differently, and prints every other", () => {
    for (const l of LESSONS) {
      const page = html(l.id);
      const held = l.practices.filter((p) => DROPPED.some((t) => t.id === p.topicId));
      for (const p of l.practices) {
        if (held.includes(p)) continue;
        expect(page.includes(p.prompt), `${l.id}: ${p.prompt}`).toBe(true);
      }
      /* One held line (the invisible measure under its skeleton) per practice held. */
      expect(page.split('class="invisible">Ag</span>').length - 1, l.id).toBe(held.length);
    }
  });
});
