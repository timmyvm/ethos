/**
 * Tester mode's words (COPY-RULES.md, "Testers"). Timothy asks a few
 * friends to speak every day for two weeks and say, around each
 * recording, how it felt and whether the score felt right; these are
 * the only strings they meet that nobody else does.
 *
 * The consent is versioned. The server stores the version a tester
 * agreed to in the same write that makes them a tester (migration 0020,
 * app/api/tester), so a changed word here is a different consent:
 * `lib/tester.test.ts` pins the text to its version and fails until
 * CONSENT_VERSION goes up with it.
 *
 * Nothing secret lives here. The code itself is the server's alone.
 */

/**
 * 2 (30 Oct): says where every recording goes (the services Privacy
 * names, linked) where 1 said "Nothing is shared", and names the name,
 * age and email the report shows Timothy. Migration 0021 takes answers
 * only from a tester on 2 or later.
 *
 * 3 (30 Oct): Timothy's full list. Everything kept while testing is
 * named, the device, how the app is used, the connection and problems
 * among it, with how long it is kept and how fast it goes when asked.
 * The browser collects those only for a tester on 3 or later
 * (lib/tester-collect.ts, app/api/tester/collect), migration 0022 takes
 * answers only from 3 on, and a tester on 1 or 2 reads this once on
 * their next open and agrees again (components/tester/TesterLayer.tsx).
 */
export const CONSENT_VERSION = 3;

/**
 * The consent screen: everything kept, then what for, who sees it, how
 * long, deleting it and the parent. One negation, no em dash, one agree
 * tap, and the tap after the last line.
 */
export const CONSENT = {
  title: "Testing Ethos",
  line: "Everything Ethos keeps while you test, and why.",
  /** For a tester who agreed to an older list: what changed, once. */
  renewLine: "Testing keeps more now. Read it all, then agree again.",
  keptLead: "What's kept",
  kept: [
    {
      lead: "Your recordings",
      text: "Every audio recording you make, and the camera's numbers when it's on. Video stays on your phone.",
    },
    { lead: "Transcripts", text: "Everything you say, word for word, with timestamps." },
    { lead: "Your scores", text: "Every score, star, streak and number Ethos gives you." },
    {
      lead: "Your answers",
      text: "Everything you answer in the introduction (your name, age, goal and the hour you picked), your email if you make an account, and every answer and note after a recording.",
    },
    { lead: "How you use it", text: "Which screens you open, what you tap, when, and for how long." },
    {
      lead: "Your device",
      text: "Phone model, operating system, browser, screen size, language, time zone, and whether Ethos is on your home screen.",
    },
    { lead: "Your connection", text: "IP address and basic network info." },
    { lead: "Problems", text: "Errors and crashes, and what was on screen when they happened." },
  ],
  items: [
    { lead: "What for", text: "Making the scores accurate and fixing what breaks." },
    {
      lead: "Who sees it",
      text: "Only Timothy, who makes Ethos. Nothing is sold, and it goes only to the services that run the app, named in Privacy.",
      /** The word in `text` that opens the Privacy page's Testers section. */
      link: { word: "Privacy", href: "/privacy#testers" },
    },
    { lead: "How long", text: "Up to 12 months after the test ends, then it's deleted." },
    {
      lead: "Deleting it",
      text: "Ask Timothy and it's all deleted within 7 days. Deleting your account in Settings deletes it too.",
    },
    { lead: "Under 18?", text: "A parent or guardian has said yes." },
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
  /** Every place in the test is taken (TESTER_LIMIT). */
  full: "Testing is full. Message Timothy.",
} as const;

/** Testing, switched on (and what a tester sees from Settings). */
export const JOINED_COPY = {
  title: "You're testing Ethos",
  line: "After each recording, how it felt, then whether the score felt right.",
  since: (date: string) => `Since ${date}.`,
  agreed: "What you agreed to",
  saveFailed: "Testing didn't switch on. Try again in a minute.",
  changed: "This screen changed since it opened. Read it again.",
  toWelcome: "Back to the introduction",
  toSettings: "Back to Settings",
  /** How a friend tells Timothy which answers are theirs (lib/tester.ts testerNumber). */
  number: "Your tester number",
  demos: "Send Timothy your tester number.",
  copy: "Copy",
  copied: "Copied",
} as const;

/**
 * The one tap before the score shows (results, testers only): how the
 * recording felt, before any number can lean on the answer. Skip goes
 * straight to the score.
 */
export const FELT_COPY = {
  question: "How did that feel?",
  line: "Before you see the score.",
  options: [
    { value: "rough", label: "Rough" },
    { value: "okay", label: "Okay" },
    { value: "strong", label: "Strong" },
  ],
  skip: "Skip",
} as const;

/** The match check after the score: which way the score was off, if it was. */
export const MATCH_COPY = {
  question: "Did the score feel right?",
  options: [
    { value: "too_low", label: "Too low" },
    { value: "about_right", label: "About right" },
    { value: "too_high", label: "Too high" },
  ],
  notePrompt: "What felt off?",
  notePlaceholder: "Optional",
  saveNote: "Save note",
  saving: "Saving…",
  saved: "Saved",
  answerSaved: "Answer saved",
  noteSaved: "Note saved",
  failed: "Your answer didn't save.",
} as const;

/** The doors in. */
export const DOOR_COPY = {
  welcome: "Tester code",
  settingsCode: "Tester code",
  settingsTesting: "Testing Ethos",
  settingsOn: "On",
  /** A tester on an older consent: the door opens on the new one. */
  settingsRenew: "Agree again",
} as const;
