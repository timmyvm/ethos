/**
 * How a take is recorded (#508, the speed audit's fix 1).
 *
 * The browser's default for Opus is 128 kbps, music quality: a 60 second
 * take was 897 KB, and on mobile data the server heard nothing for ten
 * seconds after Stop while it went up. Speech needs a quarter of that.
 * At 32 kbps the same minute is about 170 KB and is heard in about two
 * and a half seconds; Opus at that rate is still wideband speech, which
 * is what Whisper was built on.
 *
 * Every recorder whose take leaves the phone is made here (`speechRecorder`):
 * the daily take (app/rep/page.tsx) and Hostile (app/hostile/page.tsx).
 * The mime type logic is unchanged: WebM Opus where the browser has it,
 * the browser's own choice where it does not (Safari before 18.4 records
 * MP4/AAC, which honours the same bitrate). A browser that ignores
 * `audioBitsPerSecond` records at its default, as before.
 */

/** The take's bitrate: speech, not music. */
export const SPEECH_BITS_PER_SECOND = 32_000;

const OPUS = "audio/webm;codecs=opus";

/** The options for a take's MediaRecorder, given whether the browser can record WebM Opus. */
export function speechRecorderOptions(
  supports: (mime: string) => boolean = (m) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)
): MediaRecorderOptions {
  return supports(OPUS)
    ? { mimeType: OPUS, audioBitsPerSecond: SPEECH_BITS_PER_SECOND }
    : { audioBitsPerSecond: SPEECH_BITS_PER_SECOND };
}

/** What a take's recorder is built from: the browser's MediaRecorder, or a test's stand-in. */
export interface RecorderMaker {
  new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder;
  isTypeSupported(mime: string): boolean;
}

/**
 * A take's recorder, with the speech options above. A browser whose
 * encoder refuses the bitrate when the recorder is made (an AAC encoder
 * on an older iPhone is the one this lab cannot try) gets the recorder
 * it had before #508, with the format alone, or with nothing: a take
 * recorded at the default rate is better than no take.
 */
export function speechRecorder(
  stream: MediaStream,
  Maker: RecorderMaker = MediaRecorder
): MediaRecorder {
  const options = speechRecorderOptions((m) => Maker.isTypeSupported(m));
  try {
    return new Maker(stream, options);
  } catch {
    return new Maker(stream, options.mimeType ? { mimeType: options.mimeType } : undefined);
  }
}
