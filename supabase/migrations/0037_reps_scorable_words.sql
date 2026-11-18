-- 0037: what a recording's words came to, kept on the row (DECISIONS #511,
-- the speed audit's fix 10, docs/speed/audit.md).
--
-- Today, You, the Log and the reminder read a person's newest recordings
-- to pick today's practice, draw the foot's figures and fill the trait
-- levels. Each of those reads pulled every recording's whole transcript
-- only to run lib/metrics.ts `substance` over it: whether the take had a
-- real answer to score (`isScorable`, 20 words or more and at least 0.3
-- distinct), how many words it had (the unit of "um or uh in 100 words")
-- and how many of them were different (Variety). The transcripts were a
-- third of that read's bytes. These three columns hold the answers:
--
--   scorable        isScorable(substance)
--   word_count      substance.wordCount
--   distinct_words  the distinct words substance counted, so Variety's
--                   distinctRatio is Math.round(d / n * 1000) / 1000, as
--                   substance rounds it
--
-- /api/analyze writes all three with every recording it stores, from the
-- transcript it stores (lib/db.ts saveRep). A row stored before that is
-- filled here, once, from its transcript, by the same rule the readers
-- ran on it until now (lib/trait-readings.ts `measured`):
--
--   * the text is lowercased as JavaScript's toLowerCase lowercases it,
--     for the only characters whose lowercase lands in a word: A to Z,
--     the Kelvin sign (to k) and I with a dot above (to i and a dot);
--   * a word is a run of a to z, 0 to 9 and the apostrophe, spelled out
--     letter by letter so no collation's range can widen it;
--   * the ratio is computed in double precision exactly as JavaScript
--     computes it, and Math.round(r * 1000) >= 300 is r * 1000 >= 299.5.
--
-- lib/migrations.test.ts holds the file to that on a real Postgres
-- (PGlite) against the real `substance` over generated transcripts: too
-- short, exactly 20 words, repetitive, exactly at the 0.3 line and just
-- under it, empty, missing, punctuation, digits, apostrophes, capitals
-- and the letters JavaScript lowercases differently. No score moves: a
-- reader given these columns answers what it answered from the
-- transcript (#422: nothing stored is rescored).
--
-- Nullable, and filled only where empty, so running the file twice is
-- safe and a row the server already wrote is never touched. Until it is
-- applied the app reads as before: a select naming a column the table
-- lacks fails with 42703 and every reader goes back to the transcript
-- (lib/rep-substance.ts). Row level security on reps is unchanged: no
-- policy, grant or owner moves here. The deploy connector stalls on two
-- words (0020's head), and neither is in this file.

alter table public.reps add column if not exists scorable boolean;
alter table public.reps add column if not exists word_count integer;
alter table public.reps add column if not exists distinct_words integer;

with said as (
  select r.id,
         count(t.word)::integer as n,
         count(distinct t.word)::integer as d
    from public.reps r
    left join lateral (
      select m[1] as word
        from regexp_matches(
               translate(
                 replace(coalesce(r.transcript, ''), chr(304), 'i' || chr(775)),
                 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' || chr(8490),
                 'abcdefghijklmnopqrstuvwxyz' || 'k'
               ),
               '([abcdefghijklmnopqrstuvwxyz0123456789'']+)',
               'g'
             ) as m
    ) t on true
   where r.scorable is null
      or r.word_count is null
      or r.distinct_words is null
   group by r.id
)
update public.reps r
   set word_count = said.n,
       distinct_words = said.d,
       scorable = case
         when said.n >= 20 then (said.d::float8 / said.n::float8) * 1000::float8 >= 299.5::float8
         else false
       end
  from said
 where r.id = said.id;

comment on column public.reps.scorable is
  'isScorable(substance) when it was stored (lib/metrics.ts, DECISIONS #511): a real answer of 20 words or more, at least 0.3 of them distinct.';
comment on column public.reps.word_count is
  'substance.wordCount: the words lib/metrics.ts counts (runs of a to z, 0 to 9 and the apostrophe), DECISIONS #511.';
comment on column public.reps.distinct_words is
  'The distinct words of word_count, so substance.distinctRatio is round(distinct_words / word_count, 3), DECISIONS #511.';
