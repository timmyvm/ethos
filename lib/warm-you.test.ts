import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * You's first open without the waits (#508, the speed audit's fix 12):
 * Today, once drawn, asks for You's reads into what the visit holds, and
 * You reads its guest flag from the session the phone holds.
 */
const calls = vi.hoisted(() => ({ xp: 0, lexicon: 0, session: 0, say: 0, guest: true as boolean | null }));

vi.mock("./client-data", async () => {
  const held = await import("./held");
  return {
    fetchXp: vi.fn(async () => {
      calls.xp += 1;
      return held.hold("xp", { total: 10, week: 5, today: 0 });
    }),
    fetchLexicon: vi.fn(async () => {
      calls.lexicon += 1;
      return held.hold("lexicon:100", []);
    }),
    heldXp: () => held.held("xp") ?? null,
    heldLexicon: () => held.held("lexicon:100") ?? null,
  };
});
vi.mock("./auth", () => ({
  localSessionState: vi.fn(async () => {
    calls.session += 1;
    return calls.guest === null
      ? { signedIn: false, anonymous: false, email: null }
      : { signedIn: true, anonymous: calls.guest, email: null };
  }),
}));
vi.mock("./supabase-browser", () => ({ supabaseBrowser: () => null }));
/* Say it better's read (#507), as You's card makes it: held under "say". */
vi.mock("./say-store", async () => {
  const held = await import("./held");
  return {
    fetchSay: vi.fn(async () => {
      calls.say += 1;
      return held.hold("say", { items: [], takes: new Map() });
    }),
    heldSay: () => held.held("say") ?? null,
  };
});

const { warmYou } = await import("./warm-you");
const { GUEST_KEY, held, resetHeld, forgetRecordings } = await import("./held");

const flush = () => new Promise((r) => setTimeout(r, 0));
const root = path.resolve(__dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");

describe("Today warms You's reads", () => {
  beforeEach(() => {
    resetHeld();
    calls.xp = calls.lexicon = calls.session = calls.say = 0;
    calls.guest = true;
  });

  it("asks for the XP, the lexicon, Say it better and the guest flag into what the visit holds", async () => {
    warmYou();
    await flush();
    await flush();
    expect(held("xp")).toEqual({ total: 10, week: 5, today: 0 });
    expect(held("lexicon:100")).toEqual([]);
    expect(held("say")).toEqual({ items: [], takes: new Map() });
    expect(held(GUEST_KEY)).toBe(true);
  });

  it("asks again only for what is not held", async () => {
    warmYou();
    await flush();
    await flush();
    warmYou();
    await flush();
    await flush();
    expect([calls.xp, calls.lexicon, calls.say, calls.session]).toEqual([1, 1, 1, 1]);
    forgetRecordings(); // a recording landed: XP, the lexicon and Say it better's count are read again
    warmYou();
    await flush();
    await flush();
    expect([calls.xp, calls.lexicon, calls.say]).toEqual([2, 2, 2]);
  });

  it("holds no guest flag for a phone with no session", async () => {
    calls.guest = null;
    warmYou();
    await flush();
    expect(held(GUEST_KEY)).toBeUndefined();
  });
});

describe("the screens", () => {
  it("Today warms them once its own numbers are drawn, on idle", () => {
    expect(src("app/page.tsx")).toMatch(/markDrawn\(\);\s*if \(reps === null\) return;[\s\S]{0,200}return whenIdle\(warmYou, 4000\);/);
  });

  it("Say it better's store reaches Today only at idle, never in its first load", () => {
    const warm = src("lib/warm-you.ts");
    expect(warm).toMatch(/void import\("\.\/say-store"\)/);
    expect(warm).not.toMatch(/^import [^\n]*from "\.\/say-store"/m);
    expect(src("app/page.tsx")).not.toMatch(/from "@\/lib\/say-store"|from "@\/components\/say\//);
  });

  it("You's card reads on its own mount, never waiting on a draw: a direct open, or You before Today drew", () => {
    const card = src("components/say/SayCard.tsx");
    expect(card).toMatch(/useEffect\(\(\) => \{\s*void load\(\);\s*\}, \[load\]\);/);
    expect(card).not.toMatch(/onDrawn|afterFirstScreen|whenIdle/);
    // A tab from Today draws what Today warmed, in its first frame.
    expect(card).toMatch(/useState<SayRead \| null>\(\(\) => \(warm \? heldSay\(\) : null\)\)/);
  });

  it("You and Today read the guest flag from the phone's session, never the auth server", () => {
    const you = src("app/you/page.tsx");
    expect(you).toMatch(/localSessionState\(\)/);
    expect(you).not.toMatch(/auth\s*\.getUser\(\)/);
    expect(src("app/page.tsx")).toMatch(/localSessionState\(\)\s*\.then\(\(s\) => setAnon\(s\.signedIn && s\.anonymous\)\)/);
    expect(src("lib/auth.ts")).toMatch(/export async function localSessionState[\s\S]{0,200}db\.auth\.getSession\(\)/);
  });
});
