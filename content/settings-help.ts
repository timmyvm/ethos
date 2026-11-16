/**
 * Settings' Help page (#479): a short FAQ and what changed lately, in
 * plain words. Every answer is checked against the code that makes it
 * true, named beside it, so the next edit checks it again; COPY-RULES
 * holds every line (`lib/settings-help.test.ts`).
 */

export const SUPPORT_EMAIL = "hello@speakethos.com";

/** The report a problem link: a subject, and the two questions that make a report useful. */
export function problemMailto(where: string): string {
  const subject = "Something broke in Ethos";
  const body = `What happened:\n\n\nWhat you expected:\n\n\n(Sent from ${where})`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const FAQ: readonly { q: string; a: string }[] = [
  {
    // lib/dimension-rows.ts (#471): rows out of 100, the Index out of 1000; the glance's door (#427).
    q: "How is my score worked out?",
    a: "Each row on a result is out of 100, and together they make the Ethos Index, out of 1000. Tap Every number on a result to see them all.",
  },
  {
    // app/api/push/cron: never on a day already practised (#143), never in quiet hours; an iPhone tab cannot (#430).
    q: "Why didn't my reminder come?",
    a: "It skips a day you've already practised and never comes in quiet hours. On an iPhone, Ethos has to be on your Home Screen.",
  },
  {
    // lib/shop.ts: the freeze's blurb and MAX_EQUIPPED_FREEZES.
    q: "What does a streak freeze do?",
    a: "It covers one missed day by itself. You can hold three.",
  },
  {
    // lib/plan-view.ts confirmBody: Premium runs to the end of the paid month.
    q: "How do I cancel Premium?",
    a: "Settings, Plan, Manage plan, then Cancel plan. Premium runs to the end of the month you paid for.",
  },
  {
    // The privacy page (#452): OpenAI and Anthropic, under terms that keep it out of training.
    q: "Who hears my recordings?",
    a: "OpenAI turns your audio into words and Anthropic writes the feedback. Neither may use it to build their AI. The privacy policy has the rest.",
  },
];

/** The latest changes, newest first, a line each (DECISIONS, said plainly). */
export const WHATS_NEW: readonly { date: string; line: string }[] = [
  { date: "16 Nov", line: "Settings has a page for each thing: your account, notifications, practice, privacy and help." },
  { date: "16 Nov", line: "Every score is out of 100, with a word for how it went." },
  { date: "16 Nov", line: "While a recording is scored, your words show up the moment they exist." },
  { date: "16 Nov", line: "Sixty topics, and Another topic shows every one before any comes back." },
  { date: "12 Nov", line: "Swipe between tabs, and every password field has Show." },
];

/**
 * What Ethos keeps (#479), the privacy page's "What we store" (#452) as
 * rows: on the account, on this phone only, and who handles it. Every
 * row is a claim the privacy page already makes from the code; change one
 * there and here together.
 */
export const STORED: {
  account: readonly { label: string; note: string }[];
  phone: readonly { label: string; note: string }[];
  services: readonly { label: string; note: string }[];
} = {
  account: [
    { label: "Your camera", note: "Video never leaves the phone. Five numbers measured from it are kept." },
    { label: "Your recordings", note: "The audio, its transcript and the feedback written about it." },
    { label: "Your numbers", note: "Pace, fillers, pauses, scores and stars." },
    { label: "Your progress", note: "Streaks, freezes, XP, coins and the words saved from your recordings." },
    { label: "Your answers", note: "What you told the introduction, and the plan built from it." },
    { label: "Your account", note: "Your email, your name, the pose you wear and your plan." },
    { label: "Reminders", note: "If they're on: where to send them, the hour and your time zone." },
    { label: "Request times", note: "Kept two days, to stop abuse." },
  ],
  phone: [
    { label: "These settings", note: "Theme, sound, text size and the rest." },
    { label: "Your sign-in", note: "The session that keeps you signed in." },
    { label: "A recording still sending", note: "Until it reaches the server." },
  ],
  services: [
    { label: "Supabase", note: "Your account, the database and the audio." },
    { label: "OpenAI", note: "Turns your audio into words." },
    { label: "Anthropic", note: "Writes the feedback." },
    { label: "Stripe", note: "Takes payments. Ethos never sees your card." },
    { label: "Vercel", note: "Runs the app." },
  ],
};
