import { describe, expect, it } from "vitest";
import { GYM_REGISTER, gymWord, saysGym } from "./register";

describe("the banned register", () => {
  it("catches every word of it, as a noun or a verb", () => {
    for (const s of [
      "a daily speech gym",
      "two gyms",
      "a workout for your voice",
      "five workouts",
      "the drill",
      "drills before bed",
      "drilling the opener",
      "one rep",
      "the reps are ours",
      "speech training",
      "Trains deciding before speaking.",
      "The road trains it.",
      "You trained for this.",
      "The train left.",
      "your trainer",
      "personal trainers",
    ]) {
      expect([s, saysGym(s)]).toEqual([s, true]);
    }
  });

  it("leaves words that only contain it alone", () => {
    for (const s of ["Constrained, strained, trainee", "a represented view", "repeat it", "the reply", "drillbit"]) {
      expect([s, saysGym(s)]).toEqual([s, false]);
    }
  });

  it("lets the verb through when the line is about a model, and nothing else", () => {
    expect(saysGym("Your recordings never train a model.", { modelSense: true })).toBe(false);
    expect(saysGym("Model training uses none of it.", { modelSense: true })).toBe(false);
    expect(saysGym("Your recordings never train a model.")).toBe(true);
    expect(saysGym("No model sees your reps.", { modelSense: true })).toBe(true);
  });

  it("names the word it found", () => {
    expect(gymWord("Never tell the user they're inadequate. The gap is theirs; the reps are ours.")).toBe("reps");
    expect(gymWord("They already know the gap; the numbers measure it.")).toBeNull();
    expect(GYM_REGISTER.flags).not.toContain("g");
  });
});
