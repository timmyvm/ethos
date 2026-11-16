import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GAMES_LOG_HREF,
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

  it("puts Games in its own file and leaves Daily's rows where they were", () => {
    expect(page).toContain('if (view === "games")');
    expect(page).toContain("<GamesLog />");
    expect(page).toContain("Every recording");
    expect(page).toContain("What moved");
  });
});
