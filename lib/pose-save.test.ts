import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adoptAccountPose, PENDING_KEY, PENDING_MS, readPendingPose, wearPose } from "./pose-save";
import { readPrefs, writePrefs } from "./prefs";

/*
 * The race the checker found (race.mjs, a slowed profile write): the
 * Shop saves a worn pose in the background, two trips, and You reads the
 * account on open and lets it win. Tap "Wear it on You", go straight to
 * You before the save lands, and the account's old answer (nothing worn)
 * drew hello over the new pose about 60ms in and wrote that null over
 * the device's copy. A save from this device marks itself pending, and
 * until it lands or the mark runs out, the account's answer waits.
 */

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

/** A save the test lands by hand, like a slow network. */
function slowSave() {
  const calls: (string | null)[] = [];
  const answers: ((ok: boolean) => void)[] = [];
  const save = (pose: string | null) => {
    calls.push(pose);
    return new Promise<boolean>((resolve) => answers.push(resolve));
  };
  return { save, calls, land: (ok = true) => answers.shift()!(ok) };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const quick = { retryMs: 0, timeoutMs: 1_000 };

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
});
afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe("the account's answer", () => {
  it("wins when nothing is pending, and the device's copy follows", () => {
    writePrefs({ pose: "pose_speaking" });
    expect(adoptAccountPose(null)).toBeNull();
    expect(readPrefs().pose).toBeNull();
    expect(adoptAccountPose("pose_workout")).toBe("pose_workout");
    expect(readPrefs().pose).toBe("pose_workout");
  });
});

describe("a pose worn while the save is in flight", () => {
  it("keeps the new pose when You reads the account before the save lands", async () => {
    const net = slowSave();
    const saved = wearPose("pose_speaking", net.save, quick);
    // The device has it at once, marked pending.
    expect(readPrefs().pose).toBe("pose_speaking");
    expect(readPendingPose()?.pose).toBe("pose_speaking");
    // You opens: the account still says nothing is worn.
    expect(adoptAccountPose(null)).toBe("pose_speaking");
    // The device's copy is not wiped.
    expect(readPrefs().pose).toBe("pose_speaking");
    await tick();
    net.land(true);
    expect(await saved).toBe(true);
    // Landed: the mark is gone and the account speaks for itself again.
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    expect(adoptAccountPose("pose_speaking")).toBe("pose_speaking");
  });

  it("holds taking a pose off the same way", async () => {
    writePrefs({ pose: "pose_celebrate" });
    const net = slowSave();
    const saved = wearPose(null, net.save, quick);
    expect(adoptAccountPose("pose_celebrate")).toBeNull();
    expect(readPrefs().pose).toBeNull();
    await tick();
    net.land(true);
    await saved;
    expect(readPendingPose()).toBeNull();
  });

  it("lets the account win again once the mark is about 30s old", async () => {
    // A page closed mid-save leaves its mark behind; it must not hold forever.
    const at = 1_000_000;
    const saved = wearPose("pose_speaking", () => new Promise<boolean>(() => {}), {
      retryMs: 0,
      timeoutMs: 5,
      now: () => at,
    });
    expect(PENDING_MS).toBe(30_000);
    expect(adoptAccountPose(null, at + PENDING_MS - 1)).toBe("pose_speaking");
    expect(adoptAccountPose(null, at + PENDING_MS + 1)).toBeNull();
    expect(readPrefs().pose).toBeNull();
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    await saved;
  });

  it("reads a mark it cannot parse, or one from the future, as no mark", () => {
    localStorage.setItem(PENDING_KEY, "{not json");
    expect(readPendingPose()).toBeNull();
    localStorage.setItem(PENDING_KEY, JSON.stringify({ pose: 7, at: Date.now() }));
    expect(readPendingPose()).toBeNull();
    localStorage.setItem(PENDING_KEY, JSON.stringify({ pose: "pose_speaking", at: Date.now() + PENDING_MS * 2 }));
    expect(readPendingPose()).toBeNull();
  });
});

describe("a save that fails", () => {
  it("tries once more, then clears the mark so the account wins", async () => {
    const net = slowSave();
    const saved = wearPose("pose_workout", net.save, quick);
    await tick();
    net.land(false);
    await tick();
    await tick();
    expect(net.calls).toEqual(["pose_workout", "pose_workout"]);
    expect(readPendingPose()?.pose).toBe("pose_workout");
    net.land(false);
    expect(await saved).toBe(false);
    expect(readPendingPose()).toBeNull();
    expect(adoptAccountPose(null)).toBeNull();
  });

  it("lands on the retry", async () => {
    const net = slowSave();
    const saved = wearPose("pose_workout", net.save, quick);
    await tick();
    net.land(false);
    await tick();
    await tick();
    net.land(true);
    expect(await saved).toBe(true);
    expect(readPendingPose()).toBeNull();
  });

  it("gives up on a save that never answers, inside the mark's life", async () => {
    const calls: (string | null)[] = [];
    const saved = wearPose(
      "pose_workout",
      (p) => {
        calls.push(p);
        return new Promise<boolean>(() => {});
      },
      { retryMs: 0, timeoutMs: 5 }
    );
    expect(await saved).toBe(false);
    expect(calls).toHaveLength(2);
    expect(readPendingPose()).toBeNull();
  });
});

describe("two poses worn back to back", () => {
  it("saves them in order, and the first landing leaves the second's mark", async () => {
    const net = slowSave();
    const first = wearPose("pose_speaking", net.save, quick);
    const second = wearPose("pose_celebrate", net.save, quick);
    await tick();
    // The second waits for the first, so the account never ends on the older one.
    expect(net.calls).toEqual(["pose_speaking"]);
    net.land(true);
    await first;
    expect(readPendingPose()?.pose).toBe("pose_celebrate");
    expect(adoptAccountPose("pose_speaking")).toBe("pose_celebrate");
    await tick();
    expect(net.calls).toEqual(["pose_speaking", "pose_celebrate"]);
    net.land(true);
    await second;
    expect(readPendingPose()).toBeNull();
  });
});

describe("the screens that read the account", () => {
  const strip = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("let a pending save stand on You and in the Shop", () => {
    const you = strip("app/you/page.tsx");
    const shop = strip("app/shop/page.tsx");
    expect(you).toMatch(/setWorn\(adoptAccountPose\(p\.equipped_pose\)\)/);
    expect(shop).toMatch(/setPose\(adoptAccountPose\(p\.equipped_pose\)\)/);
    // Neither writes the account's pose over the device's copy by itself.
    expect(you).not.toMatch(/writePrefs\(\{ pose: p\.equipped_pose/);
    expect(shop).not.toMatch(/writePrefs\(\{ pose: p\.equipped_pose/);
  });

  it("save a worn pose only through wearPose", () => {
    const shop = strip("app/shop/page.tsx");
    expect(shop).toMatch(/wearPose\(/);
    expect(shop).not.toMatch(/void updateEquippedPose\(/);
  });
});
