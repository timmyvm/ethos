import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LESSONS } from "@/content/lessons";
import { TRAITS } from "@/content/traits";
import { COMMANDS, TAB_LABELS, commandsAllowed, findCommands, groupCommands, tabForKey } from "./commands";
import { TAB_HREFS } from "./tabs";

const nav = readFileSync("components/Nav.tsx", "utf8");
const titles = (rows: { title: string }[]) => rows.map((r) => r.title);

/*
 * The command menu's list and its rules (#438). The menu is how a
 * keyboard gets around, so what it lists, what a few letters find and
 * where it stays shut are pinned here, without a browser.
 */
describe("what the menu lists", () => {
  it("every row goes somewhere or does something, under its own id", () => {
    const ids = new Set(COMMANDS.map((c) => c.id));
    expect(ids.size).toBe(COMMANDS.length);
    for (const c of COMMANDS) {
      const does = [c.href, c.theme, c.today].filter((v) => v !== undefined);
      expect(does.length, c.id).toBe(1);
      if (c.href) expect(c.href, c.id).toMatch(/^\/[\w/-]*$/);
    }
  });

  it("the five tabs, named as the bar names them, in its order, on the digits 1 to 5", () => {
    const tabs = COMMANDS.filter((c) => c.key);
    expect(tabs.map((c) => c.href)).toEqual([...TAB_HREFS]);
    expect(tabs.map((c) => c.key)).toEqual(["1", "2", "3", "4", "5"]);
    expect(titles(tabs)).toEqual([...TAB_LABELS]);
    // Nav.tsx draws the same words: `{ href: "/games", label: "Practice", ... }`.
    TAB_HREFS.forEach((href, i) => {
      expect(nav, href).toContain(`{ href: "${href}", label: "${TAB_LABELS[i]}"`);
    });
  });

  it("every lesson and every trait, by its own name", () => {
    for (const l of LESSONS) {
      expect(COMMANDS.find((c) => c.href === `/lessons/${l.id}`)?.title, l.id).toBe(l.title);
    }
    for (const t of TRAITS) {
      expect(COMMANDS.find((c) => c.href === `/practice/${t.id}`)?.title, t.id).toBe(t.name);
    }
  });

  it("opens on the list itself, Start first", () => {
    expect(findCommands("")).toEqual([...COMMANDS]);
    expect(findCommands("   ")[0].title).toBe("Start today's practice");
  });

  it("keeps its words inside the copy rules", () => {
    for (const c of COMMANDS) {
      expect(c.title, c.id).not.toMatch(/—|–/);
      expect(`${c.title} ${c.also ?? ""}`, c.id).not.toMatch(/\b(gym|workout|drill|rep|reps|training)\b/i);
    }
  });
});

describe("what a few letters find", () => {
  it("a word typed must start a word of the row", () => {
    expect(titles(findCommands("pa")).slice(0, 2)).toEqual(["Pausing", "Pace"]);
    // "Up" is not "pa", and neither is the middle of a word.
    expect(titles(findCommands("pa"))).not.toContain("Upload a recording");
    expect(titles(findCommands("og"))).not.toContain("Log");
  });

  it("a title that starts with the query leads", () => {
    expect(findCommands("set")[0].title).toBe("Settings");
    expect(findCommands("log")[0].title).toBe("Log");
    expect(findCommands("the closed")[0].title).toBe("The closed mouth");
  });

  it("answers to other names, case and accents aside", () => {
    expect(titles(findCommands("history"))).toContain("Log");
    expect(titles(findCommands("DARK"))).toEqual(["Theme: Dark"]);
    expect(titles(findCommands("coins"))).toEqual(["Shop"]);
    expect(titles(findCommands("q&a"))).toContain("Hostile Q&A");
  });

  it("finds a trait's lessons by the trait's name", () => {
    const found = findCommands("fillers");
    expect(found[0].title).toBe("Fillers");
    const lessons = found.filter((c) => c.group === "Lessons");
    expect(lessons.length).toBe(LESSONS.filter((l) => l.trait === "fillers").length);
  });

  it("every word typed must be found", () => {
    expect(titles(findCommands("theme li"))).toEqual(["Theme: Light"]);
    expect(findCommands("theme zzz")).toEqual([]);
    expect(findCommands("zzz")).toEqual([]);
  });

  it("never prints a group's head twice", () => {
    for (const q of ["pa", "the", "s", "l", "p", "t", "a", "re", "lesson"]) {
      const heads = groupCommands(findCommands(q)).map((g) => g.group);
      expect(new Set(heads).size, q).toBe(heads.length);
    }
  });

  it("draws the rows it found, all of them, in order", () => {
    const found = findCommands("p");
    expect(groupCommands(found).flatMap((g) => g.rows)).toEqual(found);
  });
});

describe("where the menu and its keys answer", () => {
  it("on every tab, a lesson, a stored recording and the screens behind You", () => {
    for (const path of [...TAB_HREFS, "/lessons/the-cold-open", "/rep/8b1f0c1e-22aa", "/settings", "/shop", "/words", "/upload"]) {
      expect(commandsAllowed(path), path).toBe(true);
    }
  });

  it("never on a screen that keeps the keyboard: the same ones the tab bar leaves", () => {
    const bare = nav.slice(nav.indexOf("const BARE"), nav.indexOf("const DETAIL"));
    const routes = [...bare.matchAll(/^\s*"(\/[\w-]+)",/gm)].map((m) => m[1]);
    expect(routes.length).toBeGreaterThan(10);
    for (const route of routes) {
      expect(commandsAllowed(route), route).toBe(false);
      // A stored recording is the one page under them that is a page to read.
      if (route !== "/rep") expect(commandsAllowed(`${route}/anything`), `${route}/anything`).toBe(false);
    }
    expect(commandsAllowed("/rep")).toBe(false);
    expect(commandsAllowed("/rep/new/extra")).toBe(false);
  });

  it("a digit opens its tab, and nothing else is a tab's key", () => {
    expect(tabForKey("1")).toBe("/");
    expect(tabForKey("3")).toBe("/games");
    expect(tabForKey("5")).toBe("/you");
    for (const key of ["0", "6", "k", "", "Enter", "11"]) expect(tabForKey(key), key).toBeNull();
  });
});
