/**
 * Delete one tester's data on request (docs/testers.md).
 *
 * The same steps as the app's own Delete my account (app/api/account),
 * run by Timothy with the service role, for a tester who asked him
 * rather than tapping it themselves:
 *
 *   1. their audio files, the one thing the cascade cannot reach;
 *   2. their rate-limit rows, keyed by a string, not a reference;
 *   3. the auth user, whose cascade takes every row they own:
 *      recordings, scores, transcripts, progress, the testers row and
 *      their match answers (migrations 0001 to 0020).
 *
 * A dry run by default: it prints what it would delete. `--yes` does it.
 * `--tester-only` keeps the account and removes only the tester rows
 * (the consent and the match answers), for a friend who wants to stop
 * testing and keep practising.
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
const tester = must("testers", await db.from("testers").select("consented_at").eq("user_id", id).maybeSingle());
const answers = await count("tester_feedback");
console.log(`${name ?? "(no name)"} <${who.user.email ?? "anonymous"}> ${id}`);
console.log(`  tester since ${tester?.consented_at ?? "never"}, ${answers} match answers`);

if (testerOnly) {
  if (!yes) {
    console.log("Dry run. Add --yes to remove the tester row and the match answers, keeping the account.");
    process.exit(0);
  }
  must("tester_feedback", await db.from("tester_feedback").delete().eq("user_id", id));
  must("testers", await db.from("testers").delete().eq("user_id", id));
  console.log("Done: no longer a tester; the account and its recordings stay.");
  process.exit(0);
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
  console.log("Dry run. Add --yes to delete the audio, then the account and everything it owns.");
  process.exit(0);
}

for (let i = 0; i < paths.length; i += 100) {
  must("audio", await db.storage.from("audio").remove(paths.slice(i, i + 100)));
}
must("rate limits", await db.from("rate_limits").delete().like("subject", `%u:${id}`));
const gone = await db.auth.admin.deleteUser(id);
if (gone.error) {
  console.error(`The audio is gone, but the account didn't delete: ${gone.error.message}. Run it again.`);
  process.exit(1);
}
console.log("Done: the audio, the account and every row it owned are deleted.");
