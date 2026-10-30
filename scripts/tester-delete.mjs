/**
 * Delete one tester's data on request (docs/testers.md).
 *
 * The same steps as the app's own Delete my account (app/api/account),
 * run by Timothy with the service role, for a tester who asked him
 * rather than tapping it themselves:
 *
 *   1. their audio files, the one thing the cascade cannot reach;
 *   2. their rate-limit rows, keyed by a string, not a reference;
 *   3. any anonymous session they signed in from while testing (the
 *      testers row's `carried_from`, 0022): its recordings stayed under
 *      its own id, so it goes the same way, audio, rate limits and auth
 *      user, once the auth service confirms it is still anonymous;
 *   4. the auth user, whose cascade takes every row they own:
 *      recordings, scores, transcripts, progress, the testers row,
 *      their match answers, and their device, usage and error rows
 *      (migrations 0001 to 0022).
 *
 * A dry run by default: it prints what it would delete. `--yes` does it.
 * `--tester-only` keeps the account and removes only what testing added,
 * for a friend who wants to stop testing and keep practising, and for
 * the 12-month removal of one still using Ethos: the testers row first
 * (the phone stops sending the moment the server sees none), then the
 * device, usage and error rows, the match answers, the tester rate-limit
 * rows, and any anonymous session they signed in from (step 3, which
 * nobody can open again). It counts the rows again at the end.
 *
 * It refuses an account with a plan on it: that one deletes itself from
 * Settings, which cancels the plan at Stripe first.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/tester-delete.mjs <user id> [--yes] [--tester-only]
 *
 * The user id is the first column of `tester_admin.testers`.
 */
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const yes = args.includes("--yes");
const testerOnly = args.includes("--tester-only");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
  console.error("Usage: node scripts/tester-delete.mjs <user id> [--yes] [--tester-only]");
  process.exit(2);
}
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(2);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const must = (label, { data, error, count }) => {
  if (error) {
    console.error(`${label}: ${error.message}. Nothing more was done.`);
    process.exit(1);
  }
  return count ?? data;
};
const count = async (table) =>
  must(table, await db.from(table).select("*", { count: "exact", head: true }).eq("user_id", id));

const { data: who, error: whoError } = await db.auth.admin.getUserById(id);
if (whoError || !who?.user) {
  console.error(`No account ${id}: ${whoError?.message ?? "not found"}.`);
  process.exit(1);
}
const name = must("profile", await db.from("profiles").select("display_name").eq("user_id", id).maybeSingle())?.display_name;
// Read whole: `carried_from` is 0022's.
const tester = must("testers", await db.from("testers").select("*").eq("user_id", id).maybeSingle());
const answers = await count("tester_feedback");
const events = await count("tester_events");
console.log(`${name ?? "(no name)"} <${who.user.email ?? "anonymous"}> ${id}`);
console.log(`  tester since ${tester?.consented_at ?? "never"}, ${answers} match answers, ${events} device, usage and error rows`);

/* The anonymous sessions their testing was carried from (step 3). */
const sessions = [];
for (const from of tester?.carried_from ?? []) {
  if (typeof from !== "string" || from === id) continue;
  const { data, error } = await db.auth.admin.getUserById(from);
  if (error || !data?.user) {
    console.log(`  carried from ${from}: already gone`);
    continue;
  }
  if (!data.user.is_anonymous) {
    console.log(`  carried from ${from}: a real account now, left alone`);
    continue;
  }
  const reps = must(`reps of ${from}`, await db.from("reps").select("audio_path").eq("user_id", from));
  sessions.push({ id: from, recordings: reps.length, paths: reps.map((r) => r.audio_path).filter(Boolean) });
  console.log(`  carried from anonymous session ${from}: ${reps.length} recordings`);
}

async function removeSession(s) {
  for (let i = 0; i < s.paths.length; i += 100) {
    must("audio", await db.storage.from("audio").remove(s.paths.slice(i, i + 100)));
  }
  must("rate limits", await db.from("rate_limits").delete().like("subject", `%u:${s.id}`));
  const gone = await db.auth.admin.deleteUser(s.id);
  if (gone.error) {
    console.error(`The anonymous session ${s.id} didn't delete: ${gone.error.message}. Run it again.`);
    process.exit(1);
  }
}

if (testerOnly) {
  if (!yes) {
    console.log(
      "Dry run. Add --yes to remove the tester row, the device, usage and error rows, the match answers" +
        (sessions.length ? ` and the ${sessions.length} anonymous session(s) above` : "") +
        ", keeping the account."
    );
    process.exit(0);
  }
  // The testers row first: the server refuses the phone's next batch, so
  // nothing lands after the rows below are gone.
  must("testers", await db.from("testers").delete().eq("user_id", id));
  must("tester_events", await db.from("tester_events").delete().eq("user_id", id));
  must("tester_feedback", await db.from("tester_feedback").delete().eq("user_id", id));
  // `tester:u:<id>` and `tester-collect:u:<id>`; the account's others stay.
  must("rate limits", await db.from("rate_limits").delete().like("subject", `tester%:u:${id}`));
  for (const s of sessions) await removeSession(s);
  const left = { events: await count("tester_events"), answers: await count("tester_feedback") };
  console.log(`Done: no longer a tester; the account and its recordings stay. Left: ${left.events} events, ${left.answers} answers (both should be 0).`);
  process.exit(left.events || left.answers ? 1 : 0);
}

const plan = must("billing", await db.from("billing").select("status").eq("user_id", id).maybeSingle());
if (plan) {
  console.error(`This account has a plan (${plan.status}). Ask them to use Settings, Delete my account, which cancels it at Stripe first.`);
  process.exit(1);
}
const reps = must("reps", await db.from("reps").select("audio_path").eq("user_id", id));
const paths = reps.map((r) => r.audio_path).filter(Boolean);
console.log(`  ${reps.length} recordings, ${paths.length} audio files`);

if (!yes) {
  console.log(
    "Dry run. Add --yes to delete the audio, " +
      (sessions.length ? `the ${sessions.length} anonymous session(s) above, ` : "") +
      "then the account and everything it owns."
  );
  process.exit(0);
}

for (let i = 0; i < paths.length; i += 100) {
  must("audio", await db.storage.from("audio").remove(paths.slice(i, i + 100)));
}
must("rate limits", await db.from("rate_limits").delete().like("subject", `%u:${id}`));
for (const s of sessions) await removeSession(s);
const gone = await db.auth.admin.deleteUser(id);
if (gone.error) {
  console.error(`The audio is gone, but the account didn't delete: ${gone.error.message}. Run it again.`);
  process.exit(1);
}
console.log("Done: the audio, the account, any session it was carried from, and every row they owned are deleted.");
