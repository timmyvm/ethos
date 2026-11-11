/**
 * Where an iPhone sends a take's sound (the playback bug, 12 Nov, #436).
 *
 * Timothy: "Playback doesnt work." His phone's own record of it (he is
 * a tester) reads: Play on a stored take, Pause four seconds later, Play
 * again, and no error. The recording had loaded and the player's clock
 * ran, with nothing to hear. That is what an iPhone does once a page has
 * used the microphone: the audio session stays set up as for a call, and
 * what plays next comes out of the earpiece at a call's volume, or obeys
 * the silent switch, until the page says otherwise.
 *
 * `navigator.audioSession` (WebKit, iOS 16.4 on) is how a page says
 * otherwise. A take being played asks for "playback": the speaker, at
 * media volume, whatever the silent switch says. Everything else is
 * "auto", the browser's own choice, and it has to be: a page left on
 * "playback" records silence, because that session has no microphone.
 * So a take asks only while it sounds (components/TakeAudio.tsx), and a
 * recorder says "auto" again before it opens the mic.
 *
 * Not heard on a phone from here. If a stored take still plays silent
 * with this in, the next suspect is the recording's format: WebM from
 * the iPhone's own recorder, played through Safari's newer WebM path.
 */
export type AudioSessionType = "auto" | "playback";

/**
 * Ask for a session type. True when the browser has the API and took
 * the value; false everywhere else (Chrome, Android, a server), where
 * there is nothing to set and nothing is wrong.
 */
export function setAudioSession(
  type: AudioSessionType,
  nav: unknown = typeof navigator === "undefined" ? undefined : navigator
): boolean {
  const session = (nav as { audioSession?: unknown } | undefined)?.audioSession;
  if (!session || typeof session !== "object") return false;
  try {
    (session as { type: string }).type = type;
    return (session as { type: string }).type === type;
  } catch {
    return false;
  }
}
