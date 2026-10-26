-- 0016: a recording sent twice is stored once.
--
-- The outbox (lib/rep-outbox.ts) resends a recording whenever an upload
-- did not come back: a dropped connection after the server had already
-- stored it, or a second tab flushing the same entry. Each resend used to
-- insert another reps row, another XP event, another lexicon entry and
-- another audio file, and the first send had already spent the day's
-- judged read, so the copy the person saw said "Measured, not judged".
--
-- The outbox id now travels as `clientId`. /api/analyze answers a resend
-- with the row it already stored, and this index makes the database the
-- referee when two sends race past that lookup. Postgres treats nulls as
-- distinct, so older rows and uploads without a key are untouched.

alter table public.reps add column if not exists client_id text;

create unique index if not exists reps_user_client_id_uniq
  on public.reps (user_id, client_id);
