import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SPEECH_BITS_PER_SECOND, speechRecorder, speechRecorderOptions, type RecorderMaker } from "./speech-recorder";

/*
 * A take is recorded as speech (#508, the speed audit's fix 1): 32 kbps,
 * a quarter of the browser's default, so a minute goes up in about two
 * and a half seconds on mobile data rather than ten.
 */
const root = path.resolve(__dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");

describe("a take's recorder options", () => {
  it("records WebM Opus at 32 kbps where the browser has it", () => {
    expect(speechRecorderOptions(() => true)).toEqual({
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 32_000,
    });
    expect(SPEECH_BITS_PER_SECOND).toBe(32_000);
  });

  it("leaves the format to the browser where it does not, at the same bitrate", () => {
    const asked: string[] = [];
    const opts = speechRecorderOptions((m) => {
      asked.push(m);
      return false;
    });
    expect(opts).toEqual({ audioBitsPerSecond: 32_000 });
    expect(opts.mimeType).toBeUndefined();
    expect(asked).toEqual(["audio/webm;codecs=opus"]);
  });

  it("answers without a MediaRecorder at all (the server's render, a test)", () => {
    expect(speechRecorderOptions()).toEqual({ audioBitsPerSecond: 32_000 });
  });
});

/*
 * #508 review: before #508 any browser that could make a recorder with
 * the format alone recorded. The bitrate is a new ask of the encoder, and
 * one that refuses it when the recorder is made must still record.
 */
describe("a take's recorder", () => {
  const stream = {} as MediaStream;
  function maker(opts: { webm: boolean; refuseBitrate: boolean; refuseMime?: boolean }) {
    const made: (MediaRecorderOptions | undefined)[] = [];
    const Maker = function (this: unknown, _s: MediaStream, o?: MediaRecorderOptions) {
      if (opts.refuseBitrate && o?.audioBitsPerSecond !== undefined) throw new DOMException("bitrate", "NotSupportedError");
      if (opts.refuseMime && o?.mimeType !== undefined) throw new DOMException("mime", "NotSupportedError");
      made.push(o);
      return { options: o } as unknown as MediaRecorder;
    } as unknown as RecorderMaker;
    Maker.isTypeSupported = () => opts.webm;
    return { Maker, made };
  }

  it("asks for speech at 32 kbps, in WebM Opus where there is one", () => {
    const { Maker, made } = maker({ webm: true, refuseBitrate: false });
    speechRecorder(stream, Maker);
    expect(made).toEqual([{ mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 32_000 }]);
  });

  it("an encoder that refuses the bitrate records as before #508: the format alone", () => {
    const { Maker, made } = maker({ webm: true, refuseBitrate: true });
    expect(() => speechRecorder(stream, Maker)).not.toThrow();
    expect(made).toEqual([{ mimeType: "audio/webm;codecs=opus" }]);
  });

  it("and with no WebM (Safari before 18.4), the browser's own choice, as before", () => {
    const { Maker, made } = maker({ webm: false, refuseBitrate: true });
    speechRecorder(stream, Maker);
    expect(made).toEqual([undefined]);
  });

  it("a recorder that cannot be made at all still says so to the page", () => {
    const { Maker } = maker({ webm: true, refuseBitrate: true, refuseMime: true });
    expect(() => speechRecorder(stream, Maker)).toThrow();
  });
});

describe("every recorder whose take leaves the phone records speech", () => {
  const files = globSync("{app,components,lib}/**/*.{ts,tsx}", { cwd: root }).filter(
    (f) => !f.endsWith(".test.ts")
  );
  const makers = files.flatMap((f) =>
    [...src(f).matchAll(/new MediaRecorder\(([^;]*?)\);/gs)].map((m) => ({ file: f, args: m[1] }))
  );

  it("the daily take and Hostile are made by speechRecorder", () => {
    expect(src("app/rep/page.tsx")).toMatch(/const recorder = speechRecorder\(audioOnly\);/);
    expect(src("app/hostile/page.tsx")).toMatch(/const recorder = speechRecorder\(stream\);/);
  });

  it("the only other recorder is the take's local video, which never leaves the phone", () => {
    expect(makers.map((m) => m.file)).toEqual(["app/rep/page.tsx"]);
    expect(src("app/rep/page.tsx")).toMatch(/videoRecorder = new MediaRecorder\(stream\);/);
  });
});
