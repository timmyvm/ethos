/**
 * Tester mode's words (COPY-RULES.md, "Testers"). Timothy asks a few
 * friends to speak every day for two weeks and say, after each
 * recording, whether the score matched how it felt; these are the only
 * strings they meet that nobody else does.
 *
 * The consent is versioned. The server stores the version a tester
 * agreed to in the same write that makes them a tester (migration 0020,
 * app/api/tester), so a changed word here is a different consent:
 * `lib/tester.test.ts` pins the text to its version and fails until
 * CONSENT_VERSION goes up with it.
 *
 * Nothing secret lives here. The code itself is the server's alone.
 */

export const CONSENT_VERSION = 1;

/** The consent screen: one negation, no em dash, one agree tap. */
export const CONSENT = {
  title: "Testing Ethos",
  line: "Here's what happens to your recordings while you test.",
  items: [
    {
      lead: "What's kept",
      text: "Your recordings, transcripts and scores, and your answer to one question after each recording.",
    },
    { lead: "What for", text: "Making the scores accurate." },
    { lead: "Who sees it", text: "Only Timothy, who makes Ethos. Nothing is shared or sold." },
    {
      lead: "Deleting it",
      text: "Ask Timothy and it's all deleted, any time. Deleting your account in Settings deletes it too.",
    },
    { lead: "Under 18?", text: "A parent has said yes." },
  ],
  agree: "I agree",
  decline: "Not now",
} as const;

/** The code entry: four digits, checked by the server. */
export const CODE_COPY = {
  title: "Tester code",
  line: "The four digits you were sent.",
  label: "Tester code",
  action: "Continue",
  busy: "Checking…",
  /** The server's sentences, kept here so the route and its tests agree. */
  wrong: "That code doesn't match. Check it and try again.",
  tooMany: "Too many tries. Give it an hour.",
  offline: "The server didn't answer. Try again.",
} as const;

/** Testing, switched on (and what a tester sees from Settings). */
export const JOINED_COPY = {
  title: "You're testing Ethos",
  line: "After each recording, one question: did the score match how it felt?",
  since: (date: string) => `Since ${date}.`,
  agreed: "What you agreed to",
  saveFailed: "Testing didn't switch on. Try again in a minute.",
  changed: "This screen changed since it opened. Read it again.",
  toWelcome: "Back to the introduction",
  toSettings: "Back to Settings",
} as const;

/** The match check on results. */
export const MATCH_COPY = {
  question: "Did this score match how it felt?",
  options: [
    { value: "yes", label: "Yes" },
    { value: "roughly", label: "Roughly" },
    { value: "no", label: "No" },
  ],
  notePrompt: "What felt off?",
  notePlaceholder: "Optional",
  saveNote: "Save note",
  saving: "Saving…",
  saved: "Saved",
  noteSaved: "Note saved",
  failed: "Your answer didn't save.",
} as const;

/** The doors in. */
export const DOOR_COPY = {
  welcome: "I have a tester code",
  settingsCode: "Tester code",
  settingsTesting: "Testing Ethos",
  settingsOn: "On",
} as const;
