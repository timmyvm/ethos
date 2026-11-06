import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UPLOAD_MAX_MB, UPLOAD_TOO_BIG, uploadFailure, uploadTooBig } from "./upload";

/*
 * Vercel refuses a request body over 4.5MB before the scoring function
 * runs, with a 413 whose body is not JSON. Upload promised 25MB, so a
 * phone video of 6 to 25MB went all the way up and came back as "The
 * scoring server didn't answer."
 */
describe("what Upload can send", () => {
  const VERCEL_BODY = 4.5 * 1000 * 1000;

  it("stays under the platform's ceiling, with room for the form", () => {
    expect(UPLOAD_MAX_MB * 1024 * 1024).toBeLessThan(VERCEL_BODY - 100_000);
    expect(uploadTooBig(4 * 1024 * 1024)).toBe(false);
    expect(uploadTooBig(4.5 * 1000 * 1000)).toBe(true);
    expect(uploadTooBig(20 * 1024 * 1024)).toBe(true);
  });

  it("names the real limit on the tile", () => {
    const page = readFileSync("app/upload/page.tsx", "utf8");
    expect(page).toMatch(/Up to \{UPLOAD_MAX_MB\}MB/);
    expect(page).not.toMatch(/MAX_MB = 25/);
  });

  it("says too big for the platform's 413, whose body is not JSON", () => {
    expect(uploadFailure(413, undefined, 6)).toBe(UPLOAD_TOO_BIG);
    expect(uploadFailure(413, "Audio exceeds 25MB limit.", 6)).toBe(UPLOAD_TOO_BIG);
  });

  it("keeps the route's own reason, and the timeout and no-answer lines", () => {
    expect(uploadFailure(422, "Not enough said.", 6)).toBe("Not enough said.");
    expect(uploadFailure(504, undefined, 6)).toMatch(/timed out\. Files under about 6 minutes/);
    expect(uploadFailure(500, undefined, 6)).toBe("The scoring server didn't answer.");
  });

  it("speaks plainly", () => {
    for (const s of [UPLOAD_TOO_BIG, uploadFailure(504, null, 6), uploadFailure(0, null, 6)]) {
      expect(s).not.toMatch(/—|–/);
      expect(s).not.toMatch(/\b(gym|workout|drill|rep|training)\b/i);
    }
  });
});
