import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INTERVIEW, ROOM_COPY, ROOM_SCRIPTS, ruleOf, TURN, turnsOf, type RoomScript } from "./room-script";
import { POP, popTone } from "./room-sound";
import { rms } from "./room-media";

/*
 * The room's script (#475): Timothy's lines, word for word, as data, so
 * a second scene is a second object of the same shape.
 */
describe("the interview, as Timothy wrote it", () => {
  const lines = INTERVIEW.beats.flatMap((b) => (b.kind === "line" ? [b.text] : []));

  it("is his four lines, in order, word for word", () => {
    expect(lines).toEqual([
      "Sell me this pen.",
      "What are you even saying?",
      "Why would I need this pen?",
      "I'm sorry, but you're not who we're looking for.",
    ]);
  });

  it("gives you two turns: after the ask, and after the push back", () => {
    expect(INTERVIEW.beats.map((b) => (b.kind === "turn" ? "you" : b.id))).toEqual([
      "open",
      "you",
      "push",
      "why",
      "you",
      "verdict",
    ]);
  });

  it("ends on Demos, in words, from the level alone", () => {
    expect(INTERVIEW.verdict).toEqual({ alright: "That was alright.", horrible: "That was horrible." });
    /* Timothy's line, then the guide's (#501): what Ethos is for. */
    expect(INTERVIEW.after).toEqual(["What if that was real?", "Let's get you ready for it."]);
    expect(INTERVIEW.noMic).toBe("I couldn't hear you, so let's get you set up.");
    /* One plain sentence: no fragment standing as one (COPY-RULES). */
    expect(INTERVIEW.noMic.split(/[.!?]\s/).length).toBe(1);
  });

  it("opens on one hold", () => {
    expect(ROOM_COPY.hold).toBe("Hold to step in");
  });

  it("says, before anything is asked of you, what is behind the glass and what you do in it (#501)", () => {
    expect(ROOM_COPY.guide).toMatch(/interview/);
    expect(ROOM_COPY.guide).toMatch(/out loud/);
    /* And at your turn, the tap that ends it. */
    expect(ROOM_COPY.turnHint).toMatch(/Done/);
  });

  it("moves him from at ease, to unimpressed, to his verdict", () => {
    expect(INTERVIEW.beats.map((b) => b.mood)).toEqual(["idle", "listening", "unimpressed", "unimpressed", "listening", "verdict"]);
  });
});

describe("any script", () => {
  const scripts: RoomScript[] = Object.values(ROOM_SCRIPTS);

  it("has unique ids, a line first and a line last", () => {
    for (const s of scripts) {
      const ids = s.beats.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(s.beats[0].kind).toBe("line");
      expect(s.beats[s.beats.length - 1].kind).toBe("line");
    }
  });

  it("never gives you two turns in a row, and gives you at least one", () => {
    for (const s of scripts) {
      expect(turnsOf(s).length).toBeGreaterThan(0);
      for (let i = 1; i < s.beats.length; i++) {
        expect(s.beats[i].kind === "turn" && s.beats[i - 1].kind === "turn").toBe(false);
      }
    }
  });

  it("says no number, no em dash and nothing from the banned room", () => {
    for (const s of scripts) {
      const words = [
        s.name,
        ...s.beats.flatMap((b) => (b.kind === "line" ? [b.text] : [])),
        ...Object.values(s.verdict),
        ...s.after,
        s.noMic,
        ...Object.values(ROOM_COPY),
      ];
      for (const w of words) {
        expect(w).not.toMatch(/\d/);
        expect(w).not.toMatch(/—/);
        expect(w.toLowerCase()).not.toMatch(/\b(gym|workout|drill|reps?|training|confidence)\b/);
      }
    }
  });

  it("takes a turn's rule from the defaults, with its own values over them", () => {
    const [first] = turnsOf(INTERVIEW);
    expect(ruleOf(first)).toEqual(TURN);
    expect(ruleOf({ ...first, rule: { capMs: 12_000 } })).toEqual({ ...TURN, capMs: 12_000 });
    expect(TURN.silenceMs).toBe(2500);
    expect(TURN.capMs).toBe(25_000);
  });
});

describe("the room's sounds", () => {
  it("are short, quiet pops, his brighter than Demos's", () => {
    for (const v of ["him", "demos"] as const) {
      expect(POP[v].attackS).toBeLessThan(0.01);
      expect(POP[v].decayS).toBeGreaterThan(0.03);
      expect(POP[v].decayS).toBeLessThan(0.07);
      expect(POP[v].peak).toBeLessThan(0.1);
      expect(POP[v].endFreq).toBeLessThan(POP[v].freq);
    }
    expect(POP.demos.freq).toBeLessThan(POP.him.freq);
    expect(POP.demos.peak).toBeLessThan(POP.him.peak);
  });

  it("move their pitch a little each time, never far", () => {
    const lo = popTone("him", () => 0);
    const hi = popTone("him", () => 0.999999);
    expect(lo.freq).toBeCloseTo(POP.him.freq * (1 - POP.him.spread), 3);
    expect(hi.freq).toBeCloseTo(POP.him.freq * (1 + POP.him.spread), 1);
    expect(hi.endFreq / hi.freq).toBeCloseTo(POP.him.endFreq / POP.him.freq, 6);
  });

  it("come from no file: the room ships no audio", () => {
    const sound = readFileSync("lib/room-sound.ts", "utf8");
    const room = readFileSync("components/room/Room.tsx", "utf8");
    for (const f of [sound, room]) {
      expect(f).not.toMatch(/\.(mp3|wav|m4a|ogg|aac)\b/);
      expect(f).not.toMatch(/speechSynthesis|new Audio\(/);
    }
  });
});

describe("what the room hears", () => {
  it("is a level, the RMS of a frame", () => {
    expect(rms([])).toBe(0);
    expect(rms([0, 0, 0])).toBe(0);
    expect(rms([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(0.5, 6);
  });

  it("is never recorded or sent", () => {
    const media = readFileSync("lib/room-media.ts", "utf8");
    const room = readFileSync("components/room/Room.tsx", "utf8");
    for (const f of [media, room]) {
      expect(f).not.toMatch(/MediaRecorder|fetch\(|sendBeacon|XMLHttpRequest|supabase/);
    }
  });
});
