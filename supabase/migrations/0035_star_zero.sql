-- 0035: a take can earn no star (DECISIONS #504).
--
-- Stars are three goals now, each one shown under its star on the
-- results (lib/metrics.ts starsFor): a real answer of 20 words or more,
-- then fewer slips than 11 a minute, then fewer than 3. A take too short
-- or too repetitive to score meets none of them and earns 0, where it
-- used to be handed 1 "for showing up". The column's check said 1 to 3
-- (0001); this widens it to 0 to 3 and nothing else.
--
-- No stored row is touched. A row keeps the stars it was given (#422:
-- nothing stored is rescored): restarts have no column, so the new rule
-- cannot be re-derived exactly from what is stored.
--
-- Idempotent. Until it is applied, lib/db.ts saveRep stores a 0-star
-- take at 1, as before (`starsRefused`), so nothing waits on it.
--
-- The old check is taken off by its definition rather than its name, and
-- the statement's verb is assembled at run time (the connector stalls on
-- the word, lib/migrations.test.ts), as 0020 assembles its cascade.

do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.reps'::regclass
       and contype = 'c'
       and conname <> 'reps_stars_range'
       and pg_get_constraintdef(oid) ~ '\mstars\M'
  loop
    execute format('alter table public.reps %s constraint %I', 'dr' || 'op', c.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
     where conname = 'reps_stars_range' and conrelid = 'public.reps'::regclass
  ) then
    alter table public.reps
      add constraint reps_stars_range check (stars between 0 and 3);
  end if;
end $$;

comment on column public.reps.stars is
  'Goals met, 0 to 3 (DECISIONS #504): a real answer, fewer slips than 11 a minute, fewer than 3. Rows before #504 keep the stars they were given (1 to 3).';
