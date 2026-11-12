/**
 * What a new password is checked against while it is typed (#462, from
 * Charles Liu's password reel: "reward early, punish late" and "inline
 * validation").
 *
 * One rule stays the rule: length (`MIN_PASSWORD`, lib/auth.ts). Too
 * short is never said while typing, because every password is too short
 * until it isn't; it is said once, on Create (punish late). The field
 * shows the length filling instead (reward early, `progress`).
 *
 * A password everyone uses is different: it is a definite problem the
 * moment it is typed, and a list of them is the first thing anyone
 * tries, so it is said at once (inline validation). The list is short
 * and on purpose: the passwords at the top of every leaked-password
 * count that are long enough to pass the length rule, with the trailing
 * digits and punctuation people add to them ("football2024",
 * "Password1!"). No composition rules: those push people toward exactly
 * these.
 */

/** The one rule: a password this long or longer (lib/auth.ts re-exports it). */
export const MIN_PASSWORD = 8;

/** Words that are the whole password, once trailing digits and punctuation are taken off. */
const COMMON_WORDS = new Set([
  "password", "passw0rd", "p@ssw0rd", "p@ssword", "qwerty", "qwertyuiop", "asdfghjkl", "azerty",
  "iloveyou", "sunshine", "princess", "football", "baseball", "basketball", "superman", "batman",
  "starwars", "trustno", "welcome", "letmein", "admin", "monkey", "dragon", "master", "shadow",
  "michael", "charlie", "jordan", "computer", "whatever", "freedom", "abc", "abcd", "abcdef",
  "qwer", "asdf", "zxcv", "zaq12wsx", "1q2w3e4r", "1qaz2wsx", "123qwe", "qwe123", "changeme",
  "secret", "hello", "login", "ethos", "speakethos", "demos",
]);

/** The trailing digits and punctuation people add to a word to pass a rule. */
const TAIL = /[\d!@#$%^&*.?_\-]+$/;

/** Whether this password is one of the few everyone tries first. */
export function commonPassword(password: string, email = ""): boolean {
  const p = password.trim().toLowerCase();
  if (!p) return false;
  // One character over and over: "aaaaaaaa", "11111111".
  if (/^(.)\1+$/.test(p)) return true;
  // A run of the keyboard's digits, either way: "12345678", "87654321".
  if (/^\d+$/.test(p) && ("01234567890".includes(p) || "09876543210".includes(p))) return true;
  const word = p.replace(TAIL, "");
  if (COMMON_WORDS.has(p) || (word.length > 0 && COMMON_WORDS.has(word))) return true;
  if (/^\d+$/.test(p) && /^(\d{2,4})\1+$/.test(p)) return true; // "12121212", "123123123"
  // Their own email, or its name before the @.
  const mail = email.trim().toLowerCase();
  if (mail) {
    const name = mail.split("@")[0];
    if (p === mail || (name.length >= 3 && (p === name || word === name))) return true;
  }
  return false;
}

/** How full the field's outline is: the share of the length rule typed, 0 to 1. */
export function progress(password: string): number {
  return Math.max(0, Math.min(1, password.length / MIN_PASSWORD));
}

export type PasswordState = "empty" | "typing" | "common" | "good";

/** Where a new password stands, for the field's outline and the line under it. */
export function passwordState(password: string, email = ""): PasswordState {
  if (!password) return "empty";
  if (commonPassword(password, email)) return "common";
  return password.length >= MIN_PASSWORD ? "good" : "typing";
}

/** Said at once under the field, and again by Create. */
export const COMMON_LINE = "That's one of the first passwords anyone tries. Pick another.";
