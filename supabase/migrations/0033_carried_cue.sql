-- 0033: the cue being carried (DECISIONS #477, docs/plan-next.md section 9).
--
-- A take now ends on one cue to carry ("Tomorrow: pause where 'like'
-- was."), the next day's recorder warms up on it before Record, and the
-- next day's result answers it first and retires it, carries it, or
-- after three answers rests it (lib/carried-cue.ts). The cue follows the
-- account, as the worn pose does (0007): practise on a phone, answer it
-- on a laptop.
--
-- One nullable jsonb column on profiles, written by the browser as the
-- account's own (profiles' policies and 0029's grants already cover a new
-- column: a person reads and writes only their own row). Its shape is
-- lib/carried-cue.ts CueState: the kind, the filler or word, the numbers
-- it was set on and last measured, the days it was given and answered,
-- the answers that did not hold, one sentence of the take's own words
-- for the warm-up, and the cue set aside. The app writes about 400 bytes;
-- it is held to 2,000 so a session cannot fill the table with it (0030).
--
-- Additive and idempotent. Until it is applied the app keeps the cue on
-- the phone (lib/cue-store.ts reads the missing column as 42703 or
-- PGRST204 and goes on without it), so nothing waits on it.

alter table public.profiles add column if not exists carried_cue jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'profiles_carried_cue_size' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_carried_cue_size
      check (carried_cue is null or octet_length(carried_cue::text) <= 2000);
  end if;
end $$;

comment on column public.profiles.carried_cue is
  'The cue being carried (lib/carried-cue.ts CueState): kind, word, from, last, givenOn, answeredOn, tries, the warm-up line, the cue set aside. Null before the first.';
