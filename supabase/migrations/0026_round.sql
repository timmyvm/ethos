-- 0026: a game round, measured (the games plan, items 3 and 10).
--
-- A game used to end as an ordinary recording: when Demos cut in, the
-- silence after it, whether you or the clock stopped it, none of it was
-- sent or kept. /api/analyze now measures the round on the server from
-- Whisper's word times and the engine's own thresholds (lib/round.ts)
-- and stores what it found here: the level it ran at, each cut-in and
-- the silence after it, the last word against the clock, and whether
-- the round counted toward the next level (lib/ladder.ts).
--
-- One nullable column. Every recording that is not a game, and every
-- game recorded before this, keeps null. The reps policies already cover
-- it: a person reads and writes only their own rows. Additive and
-- idempotent; saveRep stores a recording without it until it is applied.

alter table public.reps add column if not exists round jsonb;

comment on column public.reps.round is
  'A game round as lib/round.ts measured it (GameRound): level, cut-ins, last word, counted. Null when not a game.';
