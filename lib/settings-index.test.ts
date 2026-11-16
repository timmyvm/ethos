import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SETTINGS_PAGES,
  SETTINGS_SUBPAGES,
  focusWord,
  goalWord,
  planWord,
  reminderValue,
  restoreOffered,
  themeWord,
  withFocus,
} from "./settings-index";
import { FAQ, STORED, WHATS_NEW, problemMailto } from "@/content/settings-help";
import { BANNED_PHRASES, HYPE_PHRASES, gymWord } from "./register";

/* Settings, done properly (#479): the index's values, the shared rules,
   and every page on disk with a way back. */

describe("what the index's rows say", () => {
  const label = (h: number) => (h === 18 ? "6 pm" : `${h}`);

  it("names the reminder's hour, or Off", () => {
    expect(reminderValue(18, label)).toBe("6 pm");
    expect(reminderValue(null, label)).toBe("Off");
  });

  it("names the plan as Premium or Free, and never guesses an unknown one", () => {
    expect(planWord("active")).toBe("Premium");
    expect(planWord("code")).toBe("Premium");
    expect(planWord("ending")).toBe("Premium");
    expect(planWord("floor")).toBe("Premium");
    // A plan with something to fix says what its row says, never Premium (review).
    expect(planWord("pastDue")).toBe("Card declined");
    expect(planWord("unpaid")).toBe("Card declined");
    expect(planWord("incomplete")).toBe("Payment pending");
    expect(planWord("free")).toBe("Free");
    expect(planWord("ended")).toBe("Free");
    expect(planWord("unknown")).toBeNull();
    expect(planWord(null)).toBeNull();
  });

  it("names the theme as its segment does", () => {
    expect(themeWord("system")).toBe("System");
    expect(themeWord("dark")).toBe("Dark");
  });
});

describe("the introduction's answers on their rows", () => {
  it("say the focus back as the introduction heard it", () => {
    expect(focusWord("fillers")).toBe("Fillers");
    expect(focusWord("flat")).toBe("Sounding flat");
    expect(focusWord(null)).toBe("Not set");
    expect(focusWord("blank")).toBe("Not set");
  });

  it("say the goal as it was offered", () => {
    expect(goalWord("feet")).toBe("Think on my feet when asked");
    expect(goalWord("work")).toBe("Not set");
  });
});

describe("a new focus", () => {
  it("goes first and keeps the rest in order, three at most", () => {
    expect(withFocus(["fillers", "rushing", "flat"], "flat")).toEqual(["flat", "fillers", "rushing"]);
    expect(withFocus(["fillers", "rushing", "flat"], "rambling")).toEqual(["rambling", "fillers", "rushing"]);
    expect(withFocus([], "freezing")).toEqual(["freezing"]);
    expect(withFocus(["fillers"], "fillers")).toEqual(["fillers"]);
  });
});

describe("restore purchases", () => {
  it("is drawn only inside the native build, never on the web", () => {
    expect(restoreOffered("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1")).toBe(false);
    expect(restoreOffered("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 EthosApp/1.0")).toBe(true);
  });
});

describe("every Settings page", () => {
  const all = [...SETTINGS_PAGES.map((p) => ({ ...p, parent: "/settings" })), ...SETTINGS_SUBPAGES];

  for (const p of all) {
    const file = `app${p.href}/page.tsx`;
    it(`${p.href} is on disk with its title and a way back to ${p.parent}`, () => {
      expect(existsSync(file), file).toBe(true);
      const src = readFileSync(file, "utf8");
      expect(src).toContain(`title="${p.title}"`);
      expect(src).toMatch(new RegExp(`back=\\{\\{\\s*href:\\s*"${p.parent.replace(/\//g, "\\/")}"`));
    });
  }

  it("is a door on the index, each once", () => {
    const index = readFileSync("app/settings/page.tsx", "utf8");
    for (const p of SETTINGS_PAGES) {
      expect(index.split(`"${p.href}"`).length - 1, p.href).toBe(1);
    }
  });
});

describe("Help's words", () => {
  const lines = [
    ...FAQ.flatMap((f) => [f.q, f.a]),
    ...WHATS_NEW.map((w) => w.line),
    ...[...STORED.account, ...STORED.phone, ...STORED.services].flatMap((s) => [s.label, s.note]),
  ];

  it("follow COPY-RULES: no em dash, no rep, nothing the gym would say", () => {
    for (const line of lines) {
      expect(line, line).not.toMatch(/—/);
      expect(gymWord(line), line).toBeNull();
      for (const word of [...BANNED_PHRASES, ...HYPE_PHRASES]) expect(line.toLowerCase(), line).not.toContain(word);
    }
  });

  it("keeps the FAQ short and what's new to a few lines", () => {
    expect(FAQ.length).toBeLessThanOrEqual(6);
    expect(WHATS_NEW.length).toBeLessThanOrEqual(5);
    for (const f of FAQ) expect(f.a.split(/\s+/).length, f.q).toBeLessThanOrEqual(30);
  });

  it("writes a problem report to the support address with the questions in it", () => {
    const href = problemMailto("Settings");
    expect(href.startsWith("mailto:hello@speakethos.com?subject=")).toBe(true);
    expect(decodeURIComponent(href)).toContain("What happened:");
  });
});

/* #479 review: a legal or About page opened from a Settings page goes
   back to that page, not to Settings' index (back retraces, #442). */
describe("the marketing pages opened from Settings", () => {
  const back = readFileSync("components/MarketingBack.tsx", "utf8");
  const pages = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? pages(`${dir}/${e.name}`) : e.name === "page.tsx" ? [`${dir}/${e.name}`] : []
    );

  for (const file of pages("app/settings")) {
    const route = file.replace(/^app/, "").replace(/\/page\.tsx$/, "");
    const froms = [...readFileSync(file, "utf8").matchAll(/\/(?:privacy|terms|about)\?from=([\w-]+)/g)].map((m) => m[1]);
    for (const from of new Set(froms)) {
      it(`${route} links in as "${from}", whose back is ${route}`, () => {
        const key = from === "settings" ? "settings" : `"${from}"`;
        expect(back).toContain(`${key}: { href: "${route}"`);
        expect(back).toMatch(new RegExp(`ORIGINS = \\[[^\\]]*"${from}"`));
      });
    }
  }
});
