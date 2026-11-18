import { describe, expect, it } from "vitest";
import { StageClock, stageLine } from "./analyze-timing";

/*
 * The take's stage times (#508): one line a take, numbers and labels
 * only, so a week of production's Whisper and coach times can be read
 * before the audit's fixes 15, 16 and 20 are chosen between.
 */
function clock() {
  let t = 1_000;
  const c = new StageClock(() => t);
  return { c, at: (ms: number) => (t = 1_000 + ms) };
}

describe("a take's stage clock", () => {
  it("reports each stage as the span between its marks", () => {
    const { c, at } = clock();
    at(2_500);
    c.mark("uploadEnd");
    at(2_560);
    c.mark("gateEnd");
    c.mark("whisperStart");
    at(7_000);
    c.mark("whisperEnd");
    at(7_010);
    c.mark("coachStart");
    c.coachAttempts = 2;
    at(19_000);
    c.mark("coachEnd");
    c.mark("saveStart");
    at(19_080);
    c.mark("saveEnd");
    c.audioBytes = 174_080;
    c.takeS = 60.04;
    c.mode = "daily";
    at(19_090);
    expect(c.report(200, "icn1")).toEqual({
      status: 200,
      duplicate: false,
      mode: "daily",
      region: "icn1",
      audioKB: 170,
      takeS: 60,
      uploadMs: 2_500,
      gateMs: 60,
      whisperMs: 4_440,
      coachMs: 11_990,
      coachAttempts: 2,
      coachTokens: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 },
      coachError: null,
      saveMs: 80,
      totalMs: 19_090,
    });
  });

  it("leaves a stage that never ran empty rather than zero", () => {
    const { c, at } = clock();
    at(900);
    c.mark("uploadEnd");
    c.duplicate = true;
    const r = c.report(200, null);
    expect(r.whisperMs).toBeNull();
    expect(r.coachMs).toBeNull();
    expect(r.saveMs).toBeNull();
    expect(r.gateMs).toBeNull();
    expect(r.duplicate).toBe(true);
  });

  it("reads the region Vercel names", () => {
    const was = process.env.VERCEL_REGION;
    process.env.VERCEL_REGION = "icn1";
    try {
      expect(new StageClock().report(200).region).toBe("icn1");
    } finally {
      if (was === undefined) delete process.env.VERCEL_REGION;
      else process.env.VERCEL_REGION = was;
    }
  });
});

/*
 * What a take cost, measured (docs/scale/audit.md M5, M9): every coach
 * call's billed tokens added up, and a failed call's status and type,
 * never its message.
 */
describe("the coach's tokens and failures", () => {
  it("adds every attempt's billed tokens, cache reads and writes apart", () => {
    const { c } = clock();
    c.addUsage({ input_tokens: 812, cache_creation_input_tokens: 2_310, cache_read_input_tokens: 0, output_tokens: 940 });
    c.addUsage({ input_tokens: 830, cache_read_input_tokens: 2_310, output_tokens: 610 });
    c.addUsage(null);
    const line = JSON.parse(stageLine(c.report(200, "icn1")));
    expect(line).toMatchObject({ coach_in_tok: 1_642, coach_cache_read_tok: 2_310, coach_cache_write_tok: 2_310, coach_out_tok: 1_550, coach_error: null });
  });

  it("names a provider failure by status and type, never by its message", async () => {
    const { providerError } = await import("./analyze-timing");
    const capped = Object.assign(new Error("You have reached your specified API usage limits: my take text"), {
      status: 429,
      error: { type: "error", error: { type: "rate_limit_error", message: "my take text" } },
    });
    expect(providerError(capped)).toBe("429 rate_limit_error");
    expect(providerError(Object.assign(new Error("x"), { status: 529, error: { type: "error", error: { type: "overloaded_error" } } }))).toBe("529 overloaded_error");
    expect(providerError(new TypeError("fetch failed"))).toBe("TypeError");
    expect(providerError(new Error("my take text"))).toBe("unknown");
  });
});

describe("the line", () => {
  it("is one line of JSON with the report's own keys and nothing else", () => {
    const { c } = clock();
    const line = stageLine(c.report(429, "icn1"));
    expect(line).not.toContain("\n");
    expect(Object.keys(JSON.parse(line))).toEqual([
      "evt", "status", "duplicate", "mode", "region", "audio_kb", "take_s", "upload_ms",
      "gate_ms", "whisper_ms", "coach_ms", "coach_attempts",
      "coach_in_tok", "coach_cache_read_tok", "coach_cache_write_tok", "coach_out_tok", "coach_error",
      "save_ms", "total_ms",
    ]);
    expect(JSON.parse(line).evt).toBe("analyze.stages");
  });

  it("carries nothing that rode along on the report", () => {
    const { c } = clock();
    const report = { ...c.report(200, "icn1"), transcript: "my own words", userId: "user-1" };
    const line = stageLine(report);
    expect(line).not.toMatch(/my own words|user-1|transcript|userId/);
  });
});
