import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase-browser", () => ({ supabaseBrowser: () => null, sessionToken: async () => null, currentSession: async () => null }));

/* The phone's localStorage, by hand: the store is node's, the test is the browser's. */
const disk = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => (disk.has(k) ? disk.get(k)! : null),
    setItem: (k: string, v: string) => void disk.set(k, String(v)),
    removeItem: (k: string) => void disk.delete(k),
    clear: () => disk.clear(),
    key: (i: number) => [...disk.keys()][i] ?? null,
    get length() {
      return disk.size;
    },
  },
});

const {
  FREEZES_KEY,
  KEPT_STORE,
  KEPT_VERSION,
  PROFILE_KEY,
  SPINE_KEY,
  forget,
  forgetBalance,
  forgetProfile,
  forgetRecordings,
  held,
  heldFor,
  heldMark,
  hold,
  once,
  phoneAccount,
  resetHeld,
  restoreHeld,
  reuseHeld,
} = await import("./held");
// The modules that read these keys register how each is kept.
const { profileOf, spineOf } = await import("./client-data");
const { keptFreezes, heldFreezes } = await import("./freeze-sync");

/*
 * Today's numbers kept between opens (#508, lib/held.ts rule 4): the
 * spine, the profile row and the freezes, written to the phone under the
 * account they belong to, never a transcript, and never drawn for anyone
 * else.
 */
const spine = [
  { id: "r1", created_at: "2026-11-16T09:00:00.000Z", lesson_id: "the-landing", stars: 2, ethos_index: 61, mode: "daily", scorable: true },
  { id: "r2", created_at: "2026-11-17T09:00:00.000Z", lesson_id: null, stars: 3, ethos_index: 64, mode: "daily", scorable: true },
];
const profile = { display_name: "Timothy", premium: false, premium_until: null, equipped_pose: "hello" };
const freezes = (now = new Date("2026-11-17T12:00:00.000Z")) => ({
  streak: { current: 2, longest: 2, atRisk: false, didToday: true, frozenInRun: 0 },
  frozenDays: [new Date("2026-11-15T12:00:00.000Z")],
  equipped: 1,
  rescued: [] as Date[],
  now,
});
const onPhone = () => {
  const raw = disk.get(KEPT_STORE);
  return raw ? (JSON.parse(raw) as { v: number; owner: string; items: Record<string, unknown> }) : null;
};
/** A fresh open of the app: memory empty, the phone as it was left. */
const reopen = () => resetHeld();

describe("Today's numbers kept between opens", () => {
  beforeEach(() => {
    disk.clear();
    resetHeld();
  });

  it("writes the spine, the profile and the freezes under the account, and nothing else", () => {
    heldFor("user-a");
    hold("reps:90", [{ id: "r2", transcript: "the words I said" }], heldMark());
    hold(SPINE_KEY, spine, heldMark());
    hold(PROFILE_KEY, profile, heldMark());
    const { now, ...f } = freezes();
    void now;
    hold(FREEZES_KEY, f, heldMark());
    hold("lexicon:100", [{ original: "stuff", upgrade: "material" }], heldMark());
    hold("coins", { balance: 40 }, heldMark());
    const rec = onPhone()!;
    expect(rec.v).toBe(KEPT_VERSION);
    expect(rec.owner).toBe("user-a");
    expect(Object.keys(rec.items).sort()).toEqual([FREEZES_KEY, PROFILE_KEY, SPINE_KEY].sort());
    const text = disk.get(KEPT_STORE)!;
    expect(text).not.toMatch(/transcript|the words I said|stuff|material|balance/);
    expect(rec.items[FREEZES_KEY]).toEqual({ frozenDays: ["2026-11-15T12:00:00.000Z"], equipped: 1 });
  });

  it("a fresh open of the same account draws them in its first frame", () => {
    heldFor("user-a");
    hold(SPINE_KEY, spine, heldMark());
    hold(PROFILE_KEY, profile, heldMark());
    hold(FREEZES_KEY, freezes(), heldMark());
    reopen();
    expect(held(SPINE_KEY)).toBeUndefined();
    expect(restoreHeld("user-a")).toBe(true);
    expect(held(SPINE_KEY)).toEqual(spine);
    expect(held(PROFILE_KEY)).toEqual(profile);
    expect(heldFreezes()?.frozenDays.map((d) => d.toISOString())).toEqual(["2026-11-15T12:00:00.000Z"]);
    expect(heldFreezes()?.equipped).toBe(1);
  });

  it("another account's numbers are never drawn, and are dropped from the phone", () => {
    heldFor("user-a");
    hold(SPINE_KEY, spine, heldMark());
    hold(PROFILE_KEY, profile, heldMark());
    reopen();
    expect(restoreHeld("user-b")).toBe(false);
    expect(held(SPINE_KEY)).toBeUndefined();
    expect(held(PROFILE_KEY)).toBeUndefined();
    expect(onPhone()).toBeNull();
    // And A, back on this phone later, reads as a cold open did.
    reopen();
    expect(restoreHeld("user-a")).toBe(false);
  });

  it("no session on the phone: nothing is drawn, and nothing is left", () => {
    heldFor("user-a");
    hold(SPINE_KEY, spine, heldMark());
    reopen();
    expect(restoreHeld(null)).toBe(false);
    expect(onPhone()).toBeNull();
  });

  it("an account switch inside the visit empties the phone with the memory", () => {
    heldFor("user-a");
    hold(SPINE_KEY, spine, heldMark());
    heldFor("user-b");
    expect(onPhone()).toBeNull();
    hold(SPINE_KEY, [spine[0]], heldMark());
    expect(onPhone()?.owner).toBe("user-b");
    expect(onPhone()?.items[SPINE_KEY]).toEqual([spine[0]]);
  });

  it("a sign-out empties it", () => {
    heldFor("user-a");
    hold(PROFILE_KEY, profile, heldMark());
    heldFor(null);
    expect(onPhone()).toBeNull();
    hold(PROFILE_KEY, profile, heldMark());
    expect(onPhone()).toBeNull(); // nobody's numbers are written for nobody
  });

  it("a restored store that turns out to be someone else's is dropped when the session answers", () => {
    heldFor("user-a");
    hold(SPINE_KEY, spine, heldMark());
    reopen();
    restoreHeld("user-a");
    heldFor("user-b");
    expect(held(SPINE_KEY)).toBeUndefined();
    expect(onPhone()).toBeNull();
  });

  it("a read that was out across a switch is never written", () => {
    heldFor("user-a");
    const mark = heldMark();
    heldFor("user-b");
    hold(SPINE_KEY, spine, mark);
    expect(onPhone()).toBeNull();
  });

  it("is written once the account is known, when the read landed first", () => {
    hold(SPINE_KEY, spine, heldMark());
    expect(onPhone()).toBeNull();
    heldFor("user-a");
    expect(onPhone()?.owner).toBe("user-a");
    expect(onPhone()?.items[SPINE_KEY]).toEqual(spine);
  });

  it("a stored recording drops the spine and the freezes from the phone, and keeps the profile", () => {
    heldFor("user-a");
    hold(SPINE_KEY, spine, heldMark());
    hold(PROFILE_KEY, profile, heldMark());
    hold(FREEZES_KEY, freezes(), heldMark());
    forgetRecordings();
    expect(Object.keys(onPhone()!.items)).toEqual([PROFILE_KEY]);
    forgetProfile();
    expect(onPhone()).toBeNull();
  });

  it("coins spent drop the kept freezes", () => {
    heldFor("user-a");
    hold(SPINE_KEY, spine, heldMark());
    hold(FREEZES_KEY, freezes(), heldMark());
    forgetBalance();
    expect(Object.keys(onPhone()!.items)).toEqual([SPINE_KEY]);
    forget();
    expect(onPhone()).toBeNull();
  });

  it("an old shape or junk on the phone is dropped, never drawn", () => {
    disk.set(KEPT_STORE, JSON.stringify({ v: KEPT_VERSION + 1, owner: "user-a", items: { spine } }));
    expect(restoreHeld("user-a")).toBe(false);
    expect(onPhone()).toBeNull();
    disk.set(KEPT_STORE, "{not json");
    expect(restoreHeld("user-a")).toBe(false);
    disk.set(KEPT_STORE, JSON.stringify({ v: KEPT_VERSION, owner: "user-a", items: { spine: [{ id: 1 }], profile: { premium: "yes" } } }));
    expect(restoreHeld("user-a")).toBe(false);
    expect(held(SPINE_KEY)).toBeUndefined();
    expect(held(PROFILE_KEY)).toBeUndefined();
  });

  it("a restored answer stands in for a first frame only: the read still runs", async () => {
    heldFor("user-a");
    hold(SPINE_KEY, spine, heldMark());
    reopen();
    restoreHeld("user-a");
    reuseHeld(true);
    const run = vi.fn(async () => [spine[0]]);
    expect(await once(SPINE_KEY, run)).toEqual([spine[0]]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("the streak is counted again at the moment it is read back", () => {
    heldFor("user-a");
    hold(SPINE_KEY, spine, heldMark());
    hold(FREEZES_KEY, freezes(), heldMark());
    reopen();
    restoreHeld("user-a");
    const kept = onPhone()!.items[FREEZES_KEY];
    // Read back on the same day as the last recording: spoken today.
    const same = keptFreezes(kept, new Date("2026-11-17T20:00:00.000Z"))!;
    expect(same.streak.didToday).toBe(true);
    // Read back the next day: not yet, and the run is at risk.
    const next = keptFreezes(kept, new Date("2026-11-18T20:00:00.000Z"))!;
    expect(next.streak.didToday).toBe(false);
    expect(next.streak.current).toBeGreaterThan(0);
  });

  it("reads the account from the auth client's own key, and nothing else", () => {
    expect(phoneAccount("http://supabase.local")).toBeNull();
    disk.set("sb-supabase-auth-token", JSON.stringify({ access_token: "x", user: { id: "user-a" } }));
    expect(phoneAccount("http://supabase.local")).toBe("user-a");
    expect(phoneAccount("https://abcd.supabase.co")).toBeNull();
    disk.set("sb-abcd-auth-token", "{broken");
    expect(phoneAccount("https://abcd.supabase.co")).toBeNull();
    expect(phoneAccount(undefined)).toBeNull();
  });
});

describe("what each kept key reads back", () => {
  it("the spine: its seven columns, or nothing", () => {
    expect(spineOf(spine)).toEqual(spine);
    // Read from a database before 0037: no `scorable`, and none is made up.
    const { scorable, ...before0037 } = spine[0];
    void scorable;
    expect(spineOf([before0037])).toEqual([before0037]);
    expect(Object.keys(spineOf([before0037])![0])).not.toContain("scorable");
    expect(spineOf([{ ...spine[0], scorable: null }])).toEqual([{ ...spine[0], scorable: null }]);
    expect(spineOf([{ ...spine[0], scorable: "yes" }])).toBeNull();
    expect(spineOf([{ ...spine[0], transcript: "words" }])).toEqual([spine[0]]);
    expect(spineOf([{ ...spine[0], created_at: "not a date" }])).toBeNull();
    expect(spineOf([{ ...spine[0], mode: "other" }])).toBeNull();
    expect(spineOf({})).toBeNull();
  });

  /* #508 review: a stale shape after an upgrade. A record kept by the last
     build is read back by this one: a column added to a read but not to its
     codec would be drawn as undefined in the first frame, and one added to
     both under the same KEPT_VERSION would read an old record as whole.
     These fail when a read's columns move, so the codec and the version
     move with them. */
  it("each codec reads back exactly the columns its read asks for (a change moves KEPT_VERSION)", async () => {
    const { SPINE_COLUMNS } = await import("./client-data");
    const cols = (s: string) => s.split(",").map((c) => c.trim()).sort();
    expect(Object.keys(spineOf(spine)![0]).sort()).toEqual(cols(SPINE_COLUMNS));
    const data = readFileSync(path.join(__dirname, "client-data.ts"), "utf8");
    const select = data.match(/async function readProfile\(\)[\s\S]*?\.select\("([^"]+)"\)/);
    expect(select).not.toBeNull();
    expect(Object.keys(profileOf(profile)!).sort()).toEqual(cols(select![1]));
    // The shape these were written against. A new column is a new number here and in lib/held.ts.
    expect(cols(SPINE_COLUMNS)).toEqual(["created_at", "ethos_index", "id", "lesson_id", "mode", "scorable", "stars"]);
    expect(cols(select![1])).toEqual(["display_name", "equipped_pose", "premium", "premium_until"]);
    expect(KEPT_VERSION).toBe(2);
  });

  it("a record of another version is dropped, never read as this one's", () => {
    reopen();
    disk.clear();
    disk.set(KEPT_STORE, JSON.stringify({ v: KEPT_VERSION + 1, owner: "user-a", items: { spine, profile } }));
    expect(restoreHeld("user-a")).toBe(false);
    expect(held(SPINE_KEY)).toBeUndefined();
    expect(disk.has(KEPT_STORE)).toBe(false);
  });

  it("the profile: its four fields, and a lapsed plan read as it would be now", () => {
    expect(profileOf(profile)).toEqual(profile);
    expect(profileOf({ ...profile, email: "x@y.z" })).toEqual(profile);
    const lapsed = { ...profile, premium: true, premium_until: "2026-11-01T00:00:00.000Z" };
    expect(profileOf(lapsed, new Date("2026-11-18T00:00:00.000Z"))?.premium).toBe(false);
    expect(profileOf(lapsed, new Date("2026-10-18T00:00:00.000Z"))?.premium).toBe(true);
    expect(profileOf({ ...profile, premium: "true" })).toBeNull();
    expect(profileOf(null)).toBeNull();
  });
});

describe("Today draws what was kept on a fresh open, and only then", () => {
  const today = readFileSync(path.join(__dirname, "..", "app", "page.tsx"), "utf8");

  it("restores in a layout effect, after hydration, never in the hydrating render", () => {
    expect(today).toMatch(/const coldOpen = useRef\(!warm\);/);
    expect(today).toMatch(/useLayoutEffect\(\(\) => \{[\s\S]{0,200}if \(!coldOpen\.current \|\| !restoreHeld\(\)\) return leave;/);
    expect(today).not.toMatch(/useState[^\n]*restoreHeld/);
  });

  it("the card still waits for the newest 90 recordings, which are never kept", () => {
    expect(today).toMatch(/const loading = reps === null && !failed;/);
    expect(today).toMatch(/\(reps !== null \|\| spineKept\) &&/);
  });

  it("a kept streak is never traded for the bare count while the freezes are read again", () => {
    expect(today).toMatch(/if \(!quiet && !streakKept\.current\) setStreak\(computeStreak\(dates\)\);/);
  });

  it("sign-out and account deletion clear the phone's copy", () => {
    const auth = readFileSync(path.join(__dirname, "auth.ts"), "utf8");
    expect(auth).toMatch(/forgetCarriedCue\(\);\s*\/\*[^*]*\*\/\s*forgetHeld\(\);/);
    expect(auth).toMatch(/await db\.auth\.signOut\(\)\.catch\(\(\) => \{\}\);\s*forgetHeld\(\);/);
  });
});
