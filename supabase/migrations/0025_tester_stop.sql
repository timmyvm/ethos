-- 0025: a tester can stop testing (#416).
--
-- Collection carries on after the test (#405, Timothy's call), and the
-- consent says "while you test", so a tester needs a way out that is not
-- deleting their account. Stop testing (the Testing Ethos page) marks
-- the row with the time instead of removing it: the record of what they
-- agreed to, and when, stays beside the answers and events they already
-- sent under it, and from that moment nothing more is taken. The collect
-- route and the phone read the mark (lib/tester.ts `isCurrentTester`).
--
-- The browser never writes it: /api/tester sets it with the service role
-- for the caller's own row, so no policy changes here.

alter table public.testers
  add column if not exists stopped_at timestamptz;

comment on column public.testers.stopped_at is
  'When the tester tapped Stop testing (#416). Set: nothing more is collected or asked.';
