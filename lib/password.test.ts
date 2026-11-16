import { describe, expect, it } from "vitest";
import { COMMON_LINE, MIN_PASSWORD, commonPassword, passwordState, progress } from "./password";
import { passwordProblem } from "./auth";

describe("a password everyone tries first (#462)", () => {
  it("is caught, with the digits and punctuation people add", () => {
    for (const p of ["password", "Password1!", "password123", "passw0rd", "football2024", "Sunshine99", "iloveyou!", "qwertyuiop", "1q2w3e4r", "letmein12"]) {
      expect(commonPassword(p), p).toBe(true);
    }
  });

  it("is caught as a run or a repeat", () => {
    for (const p of ["12345678", "123456789", "87654321", "aaaaaaaa", "11111111", "12121212", "123123123"]) {
      expect(commonPassword(p), p).toBe(true);
    }
  });

  it("is caught when it is the person's own email or its name", () => {
    expect(commonPassword("tim@example.com", "tim@example.com")).toBe(true);
    expect(commonPassword("timothym", "timothym@example.com")).toBe(true);
    expect(commonPassword("timothym2024", "timothym@example.com")).toBe(true);
  });

  it("leaves a real password alone, a phrase above all", () => {
    for (const p of ["correct horse battery", "my red bike 1998", "Kitchen-Window-7", "passwordless login", "football club pies", "zq8!vT2m"]) {
      expect(commonPassword(p, "tim@example.com"), p).toBe(false);
    }
    expect(commonPassword("")).toBe(false);
  });
});

describe("where a new password stands", () => {
  it("fills toward the length rule, and never past it", () => {
    expect(progress("")).toBe(0);
    expect(progress("abcd")).toBe(4 / MIN_PASSWORD);
    expect(progress("a".repeat(30))).toBe(1);
  });

  it("is never called too short while it is typed: it is typing", () => {
    expect(passwordState("")).toBe("empty");
    expect(passwordState("my r")).toBe("typing");
    expect(passwordState("my red bike")).toBe("good");
  });

  it("says common at once, even before the length rule is met", () => {
    expect(passwordState("qwerty")).toBe("common");
    expect(passwordState("password1")).toBe("common");
  });
});

describe("Create and Save refuse what the field already said", () => {
  it("too short, said once, on the tap", () => {
    expect(passwordProblem("short")).toBe(`Use ${MIN_PASSWORD} characters or more.`);
  });
  it("a common password, in the field's own words", () => {
    expect(passwordProblem("Password1!")).toBe(COMMON_LINE);
    expect(passwordProblem("timothym1", "timothym@example.com")).toBe(COMMON_LINE);
  });
  it("a real one passes", () => {
    expect(passwordProblem("my red bike 1998", "tim@example.com")).toBeNull();
  });
  it("the line has no em dash and no exclamation", () => {
    expect(COMMON_LINE).not.toMatch(/—|!/);
  });
});
