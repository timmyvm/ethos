import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bestFor, ladderState, roundsToday, type LadderRow } from "./ladder";
import type { GameRound } from "./round";

/** Noon on day `d` of November 2026, on the device's own calendar. */
const at = (d: number, h = 12) => new Date(2026, 10, d, h).toISOString();
const NOW = new Date(2026, 10, 20, 18);

type Over = Partial<Omit<GameRound, "game">> & Record<string, unknown>;

function round(game: GameRound["game"], over: Over = {}): GameRound {
  const base = {
    v: 1 as const,
    level: 1 as const,
    cap: 90,
    durationS: 40,
    stoppedBy: "you" as const,
    lastWord: 39.5,
    stars: 3,
    scorable: true,
    counted: true,
    best: null,
  };
  if (game === "qa") return { ...base, game, cutIns: [], best: 20, ...over } as GameRound;
  if (game === "rush") return { ...base, game, cap: 45, spare: 3, landed: true, ...over } as GameRound;
  return {
    ...base,
    game,
    firstWord: 1,
    inWindow: true,
    numberAtEnd: null,
    cutIns: [],
    best: 600,
    ...over,
  } as GameRound;
}

function row(day: number, r: GameRound | null, extra: Partial<LadderRow> = {}): LadderRow {
  return {
    created_at: at(day),
    lesson_id: r ? `game:${r.game}:x1` : "game:qa:qa1",
    stars: r?.stars ?? 3,
    ethos_index: 600,
    round: r,
    ...extra,
  };
}

describe("opening the next level (M3)", () => {
  it("starts at level 1, 0 of 2, with nothing counted", () => {
    expect(ladderState([], "qa", NOW)).toEqual({
      open: 1,
      counted: 0,
      of: 2,
      countedToday: false,
      mastered: false,
      best: { 1: null, 2: null, 3: null },
      chain: 0,
    });
  });

  it("stays 1 of 2 after two counted rounds on one day", () => {
    const rows = [row(3, round("qa")), { ...row(3, round("qa")), created_at: at(3, 15) }];
    expect(ladderState(rows, "qa", NOW)).toMatchObject({ open: 1, counted: 1, of: 2 });
  });

  it("opens level 2 with a counted round on a second day", () => {
    const rows = [row(3, round("qa")), row(5, round("qa"))];
    expect(ladderState(rows, "qa", NOW)).toMatchObject({ open: 2, counted: 0, of: 2 });
  });

  it("counts a day once, toward one level: the day that opened it is not the next's", () => {
    const rows = [
      row(3, round("qa")),
      row(5, round("qa")),
      { ...row(5, round("qa", { level: 2 })), created_at: at(5, 16) },
    ];
    expect(ladderState(rows, "qa", NOW)).toMatchObject({ open: 2, counted: 0 });
    const tomorrow = [...rows, row(6, round("qa", { level: 2 }))];
    expect(ladderState(tomorrow, "qa", NOW)).toMatchObject({ open: 2, counted: 1 });
  });

  it("skips rounds that did not count, rounds at another level, and other games", () => {
    const rows = [
      row(3, round("qa", { counted: false })),
      row(4, round("qa", { level: 2 })),
      row(5, round("rush")),
      row(6, null),
      row(7, round("qa")),
    ];
    expect(ladderState(rows, "qa", NOW)).toMatchObject({ open: 1, counted: 1 });
  });

  it("reads rows in any order", () => {
    const rows = [row(9, round("qa")), row(3, round("qa"))];
    expect(ladderState(rows, "qa", NOW).open).toBe(2);
  });

  it("knows when today already gave its count", () => {
    const today = [row(20, round("qa"))];
    expect(ladderState(today, "qa", NOW).countedToday).toBe(true);
    expect(ladderState([row(19, round("qa"))], "qa", NOW).countedToday).toBe(false);
    expect(ladderState([row(20, round("qa", { counted: false }))], "qa", NOW).countedToday).toBe(false);
  });

  it("counts days on the device's calendar, not UTC's", () => {
    // 23:30 and 00:30 local are two days here, whatever UTC says.
    const late = { ...row(3, round("qa")), created_at: new Date(2026, 10, 3, 23, 30).toISOString() };
    const early = { ...row(4, round("qa")), created_at: new Date(2026, 10, 4, 0, 30).toISOString() };
    expect(ladderState([late, early], "qa", NOW).open).toBe(2);
  });
});

describe("mastering a game (M3)", () => {
  const climb = (game: GameRound["game"]) => [
    row(1, round(game)),
    row(2, round(game)),
    row(3, round(game, { level: 2 })),
    row(4, round(game, { level: 2 })),
  ];

  it("opens level 3 after two days at level 2", () => {
    expect(ladderState(climb("qa"), "qa", NOW)).toMatchObject({ open: 3, counted: 0, of: 3 });
  });

  it("counts a three-star day at level 3 toward mastery, and a two-star one not", () => {
    const rows = [
      ...climb("qa"),
      row(5, round("qa", { level: 3, stars: 3 })),
      row(6, round("qa", { level: 3, stars: 2 }), { stars: 2 }),
    ];
    expect(ladderState(rows, "qa", NOW)).toMatchObject({ open: 3, counted: 1, of: 3, mastered: false });
  });

  it("masters on the third such day", () => {
    const rows = [
      ...climb("interview"),
      row(5, round("interview", { level: 3 })),
      row(7, round("interview", { level: 3 })),
      row(9, round("interview", { level: 3 })),
    ];
    expect(ladderState(rows, "interview", NOW)).toMatchObject({
      open: 3,
      counted: 3,
      of: 3,
      mastered: true,
    });
  });

  it("never goes down: misses after a level opens change nothing", () => {
    const rows = [
      ...climb("qa"),
      row(10, round("qa", { level: 3, counted: false, stars: 1 })),
      row(11, round("qa", { level: 1, counted: false })),
      row(12, round("qa", { level: 3, counted: false, scorable: false })),
    ];
    expect(ladderState(rows, "qa", NOW).open).toBe(3);
  });
});

describe("bests per game and level (M4)", () => {
  it("keeps Q&A's most seconds clean, from scorable rounds only", () => {
    const rows = [
      row(1, round("qa", { best: 22 })),
      row(2, round("qa", { best: 31, counted: false })),
      row(3, round("qa", { best: 40, scorable: false, counted: false })),
      row(4, round("qa", { best: null, counted: false })),
      row(5, round("qa", { level: 2, best: 12 })),
    ];
    expect(bestFor(rows, "qa", 1)).toBe(31);
    expect(bestFor(rows, "qa", 2)).toBe(12);
    expect(bestFor(rows, "qa", 3)).toBeNull();
    expect(ladderState(rows, "qa", NOW).best).toEqual({ 1: 31, 2: 12, 3: null });
  });

  it("keeps Interview's best Index", () => {
    const rows = [
      row(1, round("interview", { best: 612 })),
      row(2, round("interview", { best: 648, counted: false })),
      row(3, round("interview", { best: null }), { ethos_index: 700 }),
    ];
    expect(bestFor(rows, "interview", 1)).toBe(700);
  });

  it("keeps Speed rush's longest run of counted rounds", () => {
    const rows = [
      row(1, round("rush")),
      row(2, round("rush")),
      row(3, round("rush")),
      row(4, round("rush", { counted: false, landed: false })),
      row(5, round("rush")),
    ];
    expect(bestFor(rows, "rush", 1)).toBe(3);
    expect(bestFor(rows, "rush", 2)).toBeNull();
  });
});

describe("Speed rush's chain (M3)", () => {
  it("resets on a scorable miss and skips an unscorable take", () => {
    const rows = [
      row(1, round("rush")),
      row(2, round("rush", { counted: false })),
      row(3, round("rush")),
      row(4, round("rush", { counted: false, scorable: false })),
      row(4, round("rush"), { created_at: at(4, 15) }),
    ];
    // Two days counted at level 1 open level 2, where nothing has run yet.
    expect(ladderState(rows, "rush", NOW)).toMatchObject({ open: 2, chain: 0 });
    expect(bestFor(rows, "rush", 1)).toBe(2);
  });

  it("is the run at the open level", () => {
    const rows = [
      row(1, round("rush")),
      row(1, round("rush"), { created_at: at(1, 14) }),
      row(1, round("rush"), { created_at: at(1, 16) }),
    ];
    expect(ladderState(rows, "rush", NOW)).toMatchObject({ open: 1, counted: 1, chain: 3 });
    expect(ladderState(rows, "qa", NOW).chain).toBe(0);
  });
});

describe("rounds today", () => {
  it("counts this game's recordings today, measured or not", () => {
    const rows = [
      row(20, round("rush")),
      { ...row(20, null), lesson_id: "game:rush:ru2" },
      row(19, round("rush")),
      row(20, round("qa")),
      { ...row(20, null), lesson_id: "topic:t1" },
    ];
    expect(roundsToday(rows, "rush", NOW)).toBe(2);
    expect(roundsToday(rows, "qa", NOW)).toBe(1);
    expect(roundsToday(rows, "interview", NOW)).toBe(0);
  });
});

/** Every module `file` imports, and theirs, skipping type-only imports. */
function importsOf(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/^import\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gms)) {
    if (m[1]) continue;
    const spec = m[2];
    let base: string | null = null;
    if (spec.startsWith("@/")) base = path.resolve(__dirname, "..", spec.slice(2));
    else if (spec.startsWith(".")) base = path.resolve(path.dirname(file), spec);
    if (!base) continue;
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      try {
        readFileSync(base + ext);
        importsOf(base + ext, seen);
        break;
      } catch {
        /* the next extension */
      }
    }
  }
  return seen;
}

describe("the ladder reads no plan (M3's rule)", () => {
  it("imports nothing from entitlement, billing or pricing, however deep", () => {
    const files = [...importsOf(path.resolve(__dirname, "ladder.ts"))].map((f) =>
      path.relative(path.resolve(__dirname, ".."), f)
    );
    expect(files).toContain("lib/ladder.ts");
    expect(files).toContain("lib/challenge.ts");
    expect(files.filter((f) => /entitlement|billing|pricing/.test(f))).toEqual([]);
  });
});
