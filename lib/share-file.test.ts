import { describe, expect, it, vi } from "vitest";
import { canShareFile, shareFile } from "./share-file";

const file = new File([new Uint8Array([1, 2, 3])], "ethos-progress.png", { type: "image/png" });

describe("canShareFile (#447)", () => {
  it("is true only where the browser says it will share this file", () => {
    expect(canShareFile(file, { share: async () => {}, canShare: () => true })).toBe(true);
    expect(canShareFile(file, { share: async () => {}, canShare: () => false })).toBe(false);
  });

  it("asks about the file itself", () => {
    const canShare = vi.fn(() => true);
    canShareFile(file, { share: async () => {}, canShare });
    expect(canShare).toHaveBeenCalledWith({ files: [file] });
  });

  it("is false with half the API, with none, and with no browser", () => {
    expect(canShareFile(file, { share: async () => {} })).toBe(false);
    expect(canShareFile(file, { canShare: () => true })).toBe(false);
    expect(canShareFile(file, {})).toBe(false);
    expect(canShareFile(file, undefined)).toBe(false);
  });

  it("a browser that throws for asking cannot share", () => {
    expect(
      canShareFile(file, {
        share: async () => {},
        canShare: () => {
          throw new TypeError("no");
        },
      })
    ).toBe(false);
  });
});

describe("shareFile (#447)", () => {
  it("hands over the file alone, with no words to push it out of the post", async () => {
    const share = vi.fn(async () => {});
    expect(await shareFile(file, { share })).toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file] });
  });

  it("a closed sheet is an answer, never an error", async () => {
    const share = async () => {
      throw Object.assign(new Error("cancelled"), { name: "AbortError" });
    };
    expect(await shareFile(file, { share })).toBe("dismissed");
  });

  it("a refusal fails, so the caller can offer the link", async () => {
    const share = async () => {
      throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
    };
    expect(await shareFile(file, { share })).toBe("failed");
    expect(await shareFile(file, {})).toBe("failed");
    expect(await shareFile(file, undefined)).toBe("failed");
  });
});
