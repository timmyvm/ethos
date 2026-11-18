/*
 * What a Whisper failure means for a resend, read from the message
 * lib/transcribe.ts throws ("Whisper API <status>: <body>"). Its own
 * module, with no key in it, so the routes and their tests read it
 * without the transcriber.
 */

/**
 * A Whisper refusal of the FILE itself: it cannot be decoded, it is too
 * big, or its type is wrong. A resend gets the same answer, so a route
 * lets the take go (422) and keeps its slot. A 400 about the MODEL is not
 * the file's: whisper-1 is retired on 26 Feb 2027 (OpenAI's deprecations
 * page) and a retired or misnamed model may answer 400 with
 * `"param": "model"` or `model_not_found`. Read as the file's, every take
 * on that day would be thrown away on the phone and the server alike
 * (docs/scale/audit.md M1), so it is ours, and stays retryable.
 */
export function isFileFault(message: string): boolean {
  const m = /^Whisper API (400|413|415):([\s\S]*)$/.exec(message);
  if (!m) return false;
  const body = m[2];
  const aboutModel =
    /"param"\s*:\s*"model"/.test(body) ||
    /model_not_found/i.test(body) ||
    /\bmodel\b[^"]*\b(deprecat\w*|does not exist|not found|retired|shut ?down|no longer|access)/i.test(body);
  return !aboutModel;
}
