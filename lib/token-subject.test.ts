import { describe, expect, it } from "vitest";
import { tokenSubject } from "./token-subject";

/* The account a token names, read without trusting it (#508). */
const ID = "11111111-1111-4111-8111-111111111111";
const jwt = (payload: unknown) => `Bearer h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;

describe("tokenSubject", () => {
  it("reads a JWT's user id", () => {
    expect(tokenSubject(jwt({ sub: ID, role: "authenticated" }))).toBe(ID);
  });

  it("is null for anything that is not a JWT naming a user id", () => {
    expect(tokenSubject(null)).toBeNull();
    expect(tokenSubject("Basic abc")).toBeNull();
    expect(tokenSubject("Bearer abc")).toBeNull();
    expect(tokenSubject("Bearer a..c")).toBeNull();
    expect(tokenSubject("Bearer a.!!!.c")).toBeNull();
    expect(tokenSubject(jwt({ sub: "anon" }))).toBeNull();
    expect(tokenSubject(jwt({ sub: 42 }))).toBeNull();
    expect(tokenSubject(jwt(null))).toBeNull();
    expect(tokenSubject(jwt({ sub: `${ID}' or 1=1` }))).toBeNull();
  });
});
