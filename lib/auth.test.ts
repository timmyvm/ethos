import { describe, expect, it } from "vitest";
import { emailProblem, MIN_PASSWORD, passwordProblem } from "./auth";

describe("password rules", () => {
  it("asks for length and nothing else", () => {
    expect(passwordProblem("a".repeat(MIN_PASSWORD))).toBeNull();
    // No composition rule: a long simple passphrase is fine, which is
    // the point — "one symbol, one digit" pushes people to Password1!.
    expect(passwordProblem("correct horse battery staple")).toBeNull();
  });

  it("rejects a short one with the reason, not a red border", () => {
    expect(passwordProblem("short")).toContain(String(MIN_PASSWORD));
  });
});

describe("email rules", () => {
  it("accepts an ordinary address", () => {
    expect(emailProblem("tim@speakethos.com")).toBeNull();
    expect(emailProblem("  tim@speakethos.com  ")).toBeNull();
  });

  it("rejects what obviously isn't one", () => {
    expect(emailProblem("tim")).not.toBeNull();
    expect(emailProblem("tim@localhost")).not.toBeNull();
    expect(emailProblem("")).not.toBeNull();
  });
});
