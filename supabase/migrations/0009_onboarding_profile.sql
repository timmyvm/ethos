-- The self-diagnosis (DECISIONS #231): what the person noticed about
-- their own speech, and their age band, answered by tap at the end of
-- the introduction and skippable. Device-local first (the answers exist
-- before any session does), then here, so the plan follows the account
-- to the next phone. Both are closed sets the client validates too, and
-- neither feeds a score: the plan names the path's own order and gates,
-- and the measured numbers stay the coach.
alter table public.profiles
  add column if not exists goal text
    check (goal in ('fillers', 'pace', 'structure', 'fire')),
  add column if not exists age_band text
    check (age_band in ('u18', '18_24', '25_34', '35_plus'));
