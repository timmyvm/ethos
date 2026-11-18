import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GAMES_LOG_HREF,
  GAMES_LOG_LABEL,
  LOG_VIEW_KEY,
  logViewSearch,
  readLogView,
  storedLogView,
  storeLogView,
} from "./log-view";

/** #486: the Log's switch, Daily and Games. */
describe("which side the Log shows", () => {
  it("opens on Daily with nothing said", () => {
    expect(readLogView("", null)).toBe("daily");
    expect(readLogView("?from=rep", null)).toBe("daily");
  });

  it("opens on the side this phone last chose", () => {
    expect(readLogView("", "games")).toBe("games");
    expect(readLogView("", "daily")).toBe("daily");
  });

  it("lets the address name the side, over the phone's memory", () => {
    expect(readLogView("?view=games", null)).toBe("games");
    expect(readLogView("?view=games", "daily")).toBe("games");
    expect(readLogView("?view=daily", "games")).toBe("daily");
  });

  it("ignores a side it does not have, and a memory it did not write", () => {
    expect(readLogView("?view=weekly", null)).toBe("daily");
    expect(readLogView("?view=weekly", "games")).toBe("games");
    expect(readLogView("", "Games")).toBe("daily");
  });

  it("writes Games into the address and Daily out of it, keeping the rest", () => {
    expect(logViewSearch("", "games")).toBe("?view=games");
    expect(logViewSearch("?view=games", "daily")).toBe("");
    expect(logViewSearch("?paywall=1", "games")).toBe("?paywall=1&view=games");
    expect(logViewSearch("?paywall=1&view=games", "daily")).toBe("?paywall=1");
    expect(GAMES_LOG_HREF).toBe("/history?view=games");
    expect(readLogView(GAMES_LOG_HREF.slice(GAMES_LOG_HREF.indexOf("?")), null)).toBe("games");
  });
});

describe("the phone's memory of the side", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the choice under its own key", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    expect(storedLogView()).toBeNull();
    storeLogView("games");
    expect(store.get(LOG_VIEW_KEY)).toBe("games");
    expect(storedLogView()).toBe("games");
  });

  it("reads nothing and throws nothing where storage refuses", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(storedLogView()).toBeNull();
    expect(() => storeLogView("games")).not.toThrow();
  });
});

describe("the switch on the Log", () => {
  const page = readFileSync("app/history/page.tsx", "utf8");
  const control = readFileSync("components/log/LogSwitch.tsx", "utf8");

  it("is the house's segmented control, Daily then Games, under the title on every state", () => {
    expect(control).toContain("<Segmented");
    expect(control).toMatch(/value: "daily", label: "Daily"[\s\S]*value: "games", label: "Games"/);
    // Under the title in the Games side, the failure, the skeleton and the landed Log.
    expect(page.match(/<ScreenHeader title="Log" \/>\n\s*<LogSwitch view=\{view\} onChange=\{setView\} \/>/g)).toHaveLength(4);
  });

  it("reads the address and the phone after mount, and writes both on a choice", () => {
    expect(control).toContain("readLogView(window.location.search, storedLogView())");
    expect(control).toContain("storeLogView(next)");
    expect(control).toContain("window.history.replaceState(");
    // Only a warm mount reads them in its first render (the server drew Daily).
    expect(control).toMatch(/warm \? readLogView\(/);
  });

  /* #486 review: a cold open on Games drew the server's Daily, then slid
     the thumb across as the side was read; and the switch with its mt-5
     put the Log's content 64px lower, past the brief's "the switch's
     height". */
  it("draws the thumb where the side was read, and slides it only for a choice", () => {
    expect(control).toContain('className={still ? "segmented-still" : ""}');
    // Off two frames after mount, never on the tap: a tap that takes it off jumps.
    expect(control).toMatch(/requestAnimationFrame\(\(\) => \{\s*second = requestAnimationFrame\(\(\) => setStill\(false\)\);/);
    expect(control).not.toMatch(/setStill\(false\);\s*onChange/);
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/\.segmented-still \.segmented-thumb \{\s*transition: none;\s*\}/);
  });

  it("moves the Log's content down by the switch's 44 and no more", () => {
    // 8 above it, and the side's own mt-5 (20) less 8 under it: 8 + 44 + 12 - 20 = 44.
    expect(control).toContain('className="mt-2 -mb-2" data-look="log-switch"');
  });

  it("puts Games in its own file, and both sides draw the same row (#506)", () => {
    expect(page).toContain('if (view === "games")');
    expect(page).toContain("<GamesLog />");
    // Daily: the stage and one list (What moved and its tables went).
    expect(page).toContain("<LogStage");
    expect(page).toContain("<LogRow");
    expect(page).not.toMatch(/movedRows|MetricRow|Sparkline|FillerHeatmap/);
    expect(readFileSync("components/log/GamesLog.tsx", "utf8")).toContain("<LogRow");
    // No caps column heads on either side.
    for (const f of ["app/history/page.tsx", "components/log/GamesLog.tsx", "components/log/LogRow.tsx"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/label-micro/);
    }
  });
});

/*
 * #491: the Games side had no door. One now stands where games are chosen
 * (Practice, the quiet link under the boss's Start) and where a round is
 * finished (under the round card in its results), each one tap to the
 * Games side, under one name.
 */
describe("the doors to the Log's Games side (#491)", () => {
  const practice = readFileSync("app/games/page.tsx", "utf8");
  const rep = readFileSync("app/rep/page.tsx", "utf8");

  it("opens the Games side in one tap", () => {
    expect(GAMES_LOG_HREF.startsWith("/history?")).toBe(true);
    expect(readLogView(GAMES_LOG_HREF.slice(GAMES_LOG_HREF.indexOf("?")), "daily")).toBe("games");
  });

  it("is named in a few plain words", () => {
    expect(GAMES_LOG_LABEL).toBe("Your game scores");
    expect(GAMES_LOG_LABEL.split(" ").length).toBeLessThanOrEqual(5);
    expect(GAMES_LOG_LABEL).not.toMatch(/—|[←→]|\.$/);
  });

  it("stands on Practice as the quiet link under the boss's Start, never a second filled tap", () => {
    const at = practice.indexOf("data-games-log-door");
    expect(at).toBeGreaterThan(practice.indexOf('href="/boss"'));
    const door = practice.slice(practice.lastIndexOf("<Link", at), practice.indexOf("</Link>", at));
    expect(door).toContain("href={GAMES_LOG_HREF}");
    expect(door).toContain("{GAMES_LOG_LABEL}");
    expect(door).toContain("text-link");
    expect(door).toContain("min-h-11");
    /* No fill: not the house tap (`.tap`, ACTION_CLASS) nor an ink ground. */
    expect(door).not.toMatch(/ACTION_CLASS|bg-ink|["\s]tap["\s]/);
  });

  it("stands under the round card in a game's results, and leaves through exit() so an owed moment still plays", () => {
    const at = rep.indexOf("data-games-log-door");
    expect(at).toBeGreaterThan(rep.indexOf("{roundCard}"));
    const door = rep.slice(rep.lastIndexOf("<button", at), rep.indexOf("</button>", at));
    expect(door).toContain("exit(GAMES_LOG_HREF, { leaves: true })");
    expect(door).toContain("{GAMES_LOG_LABEL}");
    expect(door).toContain("min-h-11");
    /* The review: Retake's pill, so the press veil is a pill and not a
       square, with the words kept on the card's edge. */
    expect(door).toMatch(/rounded-tap/);
    expect(door).toMatch(/\bpx-3\b/);
    expect(door).toMatch(/-ml-3/);
  });
});
