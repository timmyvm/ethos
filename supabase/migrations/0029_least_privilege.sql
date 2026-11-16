-- 0029: the browser's roles hold only the grants a policy answers
-- (security audit, 11 Nov).
--
-- Supabase hands every new public table ALL to anon and authenticated.
-- The first nineteen migrations kept that, so the browser's roles could
-- still name every verb on every early table, the truncate and trigger
-- ones included. Row level security has been the only wall: nothing got
-- through, but one policy written too wide would have been a breach with
-- nothing behind it. From here a table gives the browser exactly the
-- verbs its policies use, as 0020 to 0023 already do for theirs.
--
-- What the browser does, read from lib/client-data.ts, lib/saved-words.ts
-- and lib/reminder-account.ts:
--   reads and writes (select, insert, update): profiles, onboarding,
--     streaks, streak_freezes, coin_ledger
--   reads only: reps, lexicon, xp_events, billing, purchased_freezes
--   never touches: rate_limits, push_subscriptions, shop_prices (the
--     server's own client only; they have no policy at all)
--
-- A caller with no session (anon) keeps select where a policy exists, so
-- a read before sign-in still answers with no rows, as it does today,
-- and loses every write.
--
-- Safe to run twice. Nothing here removes data or a policy.

-- 1. The server's tables: no grant at all for the browser.
revoke all on table public.rate_limits from public, anon, authenticated;
revoke all on table public.push_subscriptions from public, anon, authenticated;
revoke all on table public.shop_prices from public, anon, authenticated;

-- 2. Tables the browser reads and writes.
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'onboarding', 'streaks', 'streak_freezes', 'coin_ledger']
  loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update on table public.%I to authenticated', t);
    execute format('grant select on table public.%I to anon', t);
  end loop;
end $$;

-- 3. Tables and the one view the browser only reads.
do $$
declare
  t text;
begin
  foreach t in array array['reps', 'lexicon', 'xp_events', 'billing']
  loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated, anon', t);
  end loop;
end $$;

revoke all on table public.purchased_freezes from public, anon, authenticated;
grant select on table public.purchased_freezes to authenticated;

-- 4. The audio bucket takes nothing over 50 MB. Only the server writes
--    to it (it has no storage policy) and /api/analyze stops at 25 MB,
--    so this is a second wall behind the route's own check. The type is
--    left open: an uploaded file can arrive with no type of its own.
update storage.buckets
   set file_size_limit = 52428800
 where id = 'audio';

-- 5. A table made later starts with no grant for the browser, so a
--    migration has to give each verb on purpose.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
