-- The pause score, replayed (#476). Read only: one SELECT, nothing
-- written, no table or function made. Run it in the SQL editor as the
-- service role (tester_admin is closed to everyone else).
--
-- What it does. For every scored tester recording of the test (spoken
-- 2 to 15 November 2026 on the tester's own calendar, with an Index), it
-- recomputes the Pause dimension from what the recording stored, under
-- the rules #476 ships for new takes and under the rules before it, and
-- returns aggregates only: no transcript, no word, no id. Stored scores
-- stay as they are; this only reads them.
--
-- From the stored columns: reps.whisper_raw (`words[]` {word, start,
-- end} and `segments[]` {text, start, end}, exactly what the route
-- scored), reps.fillers ([{word, t}], t the filler's start), reps.pauses
-- (the judged pauses the take stored: {t, len, kind, verdict, note}) and
-- reps.duration_s. The gaps are rebuilt from the words as
-- `detectPauses` (lib/metrics.ts) builds them, in float8 so every sum
-- and comparison is the same double JavaScript computed.
--
-- The envelope (the phone's loudness trace) is not stored. It IS
-- recoverable for the pauses it decided: the judge checks it after dead
-- air and before everything else, and a gap it calls voiced is stored
-- as verdict "filled" with the note "... with a sound in it. The mic
-- heard it, the transcript didn't." Both rule sets check it at the same
-- point on the same gaps, so "new" and "current" read those stored notes
-- as the envelope, and "new_noenv" and "current_noenv" ignore it: the
-- like-for-like pair. One caution on the notes: until #422's amendment
-- on 6 Nov any envelope judged a pause, including the unmarked ones
-- #422 then stopped trusting (a sample seconds off reads speech as a
-- sound in the gap), so a note from 2 to 5 Nov may be a sound the phone
-- placed wrong, and those takes' "new" can sit lower than today's route
-- would score them. Read new_noenv against current_noenv first.
--
-- The rules (lib/sentence-ends.ts and lib/pause-quality.ts are the
-- reference; lib/pause-replay.test.ts runs this file on Postgres over
-- synthetic recordings and holds every recording's four scores to the
-- TypeScript's, exactly, and the answer to aggregates only):
--   new      a sentence ends where the segment text puts a . ? or !
--            after the word (not "..."), the text aligned to the words by
--            letters one segment at a time; a segment that does not align
--            keeps the segment-start rule. Filled: an um, uh or erm within
--            0.5s of either edge (from its start to its word's end), or
--            the envelope. Placement 67, no opening bonus, filled and dead
--            cost at most 15 together.
--   current  a sentence ends where the word carries punctuation (never,
--            on Whisper's list) or the next word starts a segment within
--            50 ms. Filled: any filler (like, you know, basically...)
--            within 1.2s of either edge, or the envelope. Placement 60,
--            opening 7, filled 10 and dead 12 each, uncapped.
--   both     beats under 0.8s, dead air over 3.5s, a pause mid-sentence
--            is searching, a landing needs 6 words since the last
--            sentence end, landings a minute in 2 to 9 earn 25, a landing
--            in the last fifth earns 8, no held pause at all scores 20.
--
-- The answer, one row per statistic, one column per score:
--   stored          the Pause score each recording stored
--   current_noenv   the rules before #476, without the envelope
--   current         the rules before #476, the envelope from the notes
--   new_noenv       #476's rules, without the envelope
--   new             #476's rules, the envelope from the notes
-- The checks: "share equal to stored" should be near 1 for current (a
-- recording scored before #422 on 6 Nov stored its words-only score, so a
-- take of those days with a voiced gap matches current_noenv instead),
-- and "stored held-pause verdicts rebuilt" near 1 says the replay reads
-- each recording as the route did. Either far from 1 means do not trust
-- the rest.
-- index_minus_pause is the stored Index less the stored Pause points
-- (150 at full marks): what the rest of the take scored, so a pause score
-- that tracks it is measuring something, and noise would not. felt is
-- rough 1, okay 2, strong 3; "within person" centres score and felt on
-- each person's own mean, over people with at least 3 felt recordings.

with
scope as (
  select distinct on (r.rep_id)
    r.rep_id,
    r.user_id as person,
    case r.felt when 'rough' then 1 when 'okay' then 2 when 'strong' then 3 end::float8 as felt_n,
    r.ethos_index::float8 as ethos_index,
    r.pause_score::float8 as stored,
    x.duration_s::float8 as dur,
    x.whisper_raw as raw,
    case when jsonb_typeof(x.pauses) = 'array' then x.pauses else '[]'::jsonb end as stored_pauses,
    case when jsonb_typeof(x.fillers) = 'array' then x.fillers else '[]'::jsonb end as fillers
  from tester_admin.recordings r
  join public.reps x on x.id = r.rep_id
  where r.spoken_on between date '2026-11-02' and date '2026-11-15'
    and r.ethos_index is not null
  order by r.rep_id
),
-- Whisper's words, in order, with their letters for alignment.
words as (
  select
    s.rep_id,
    (w.n - 1)::int as i,
    coalesce(w.v ->> 'word', '') as word,
    (w.v ->> 'start')::float8 as ws,
    (w.v ->> 'end')::float8 as we,
    regexp_replace(lower(coalesce(w.v ->> 'word', '')), '[^a-z0-9]', '', 'g') as letters
  from scope s
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.raw -> 'words') = 'array' then s.raw -> 'words' else '[]'::jsonb end
  ) with ordinality as w(v, n)
),
wo as (
  select
    w.*,
    length(w.letters) as len,
    coalesce(sum(length(w.letters)) over (
      partition by w.rep_id order by w.i rows between unbounded preceding and 1 preceding
    ), 0)::int as off,
    lead(w.ws) over (partition by w.rep_id order by w.i) as next_start,
    first_value(w.ws) over (partition by w.rep_id order by w.i) as first_at
  from words w
),
streams as (
  select rep_id, string_agg(letters, '' order by i) as stream
  from words
  group by rep_id
),
segs as (
  select
    s.rep_id,
    (g.n - 1)::int as si,
    (g.v ->> 'start')::float8 as ss,
    (g.v ->> 'end')::float8 as se,
    coalesce(g.v ->> 'text', '') as text,
    regexp_replace(lower(coalesce(g.v ->> 'text', '')), '[^a-z0-9]', '', 'g') as target
  from scope s
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.raw -> 'segments') = 'array' then s.raw -> 'segments' else '[]'::jsonb end
  ) with ordinality as g(v, n)
),
-- Where a word starts in the letters, and where they end: the boundaries
-- a segment's run of words may end on.
bounds as (
  select rep_id, off from wo
  union
  select rep_id, length(stream) from streams
),
-- Each segment's text against a run of consecutive words, by letters: the
-- run starts at a word between a second before the segment and its end,
-- the nearest to its start, and must end on a word boundary.
cand as (
  select distinct on (g.rep_id, g.si)
    g.rep_id, g.si, w.i as j, w.off as from_off, length(g.target) as tlen
  from segs g
  join streams st on st.rep_id = g.rep_id
  join wo w
    on w.rep_id = g.rep_id
   and w.len > 0
   and w.ws >= g.ss - 1.0
   and w.ws <= g.se
  join bounds b on b.rep_id = g.rep_id and b.off = w.off + length(g.target)
  where g.target <> ''
    and substr(st.stream, w.off + 1, length(g.target)) = g.target
  order by g.rep_id, g.si, abs(w.ws - g.ss), w.i
),
-- The text's runs of letters and what follows each: a sentence ends after
-- a run when what follows holds . ? or !, "..." and "…" taken out, and a
-- full stop between two digits ("3.5") does not count.
runs as (
  select
    c.rep_id, c.si, m.n, m.v[1] as run,
    regexp_replace(m.v[2], '\.{2,}|…', '', 'g') as gap,
    sum(length(m.v[1])) over (partition by c.rep_id, c.si order by m.n) as at_end,
    lead(m.v[1]) over (partition by c.rep_id, c.si order by m.n) as next_run
  from cand c
  join segs g on g.rep_id = c.rep_id and g.si = c.si
  cross join lateral regexp_matches(lower(g.text), '([a-z0-9]+)([^a-z0-9]*)', 'g') with ordinality as m(v, n)
),
stops_at as (
  select rep_id, si, at_end
  from runs
  where gap ~ '[?!]'
     or (strpos(gap, '.') > 0
         and not (gap = '.' and run ~ '[0-9]$' and coalesce(next_run, '') ~ '^[0-9]'))
),
-- Per word in an aligned segment: does its last letter end a run that a
-- sentence end follows? A word two aligned segments share takes either's.
marks as (
  select
    w.rep_id, w.i,
    bool_or(w.len > 0 and a.at_end is not null) as mark
  from cand c
  join wo w on w.rep_id = c.rep_id and w.i >= c.j and w.off < c.from_off + c.tlen
  left join stops_at a on a.rep_id = c.rep_id and a.si = c.si and a.at_end = w.off + w.len - c.from_off
  group by w.rep_id, w.i
),
-- The rule before: the next word starts a segment, within 50 ms.
seg_starts as (
  select distinct rep_id, floor(ss * 100 + 0.5) as cs from segs
),
next_seg as (
  select w.rep_id, w.i
  from wo w
  join seg_starts s
    on s.rep_id = w.rep_id
   and s.cs between floor(w.next_start * 100 + 0.5) - 5 and floor(w.next_start * 100 + 0.5) + 5
  where w.next_start is not null
  group by w.rep_id, w.i
),
-- Per word: does a sentence end after it, by each rule.
wstops as (
  select
    w.rep_id, w.i, w.word, w.ws, w.we, w.next_start, w.first_at,
    w.word ~ '[.?!][]"'')]*\s*$' as raw_stop,
    ns.i is not null as next_starts_segment,
    m.mark
  from wo w
  left join marks m on m.rep_id = w.rep_id and m.i = w.i
  left join next_seg ns on ns.rep_id = w.rep_id and ns.i = w.i
),
wstop as (
  select
    w.*,
    coalesce(w.mark, w.raw_stop or w.next_starts_segment) as stop_new,
    (w.raw_stop or w.next_starts_segment) as stop_cur
  from wstops w
),
-- The gaps, as detectPauses builds them.
gaps as (
  select
    w.rep_id, w.i, w.first_at,
    w.next_start - w.we as gap,
    floor(w.we * 100 + 0.5) / 100 as t,
    floor((w.next_start - w.we) * 100 + 0.5) / 100 as len,
    w.stop_new, w.stop_cur
  from wstop w
  where w.next_start is not null
    and w.next_start - w.we >= 0.3
),
-- Every filler the take stored ({word, t}, t where it was said).
filler_hits as (
  select s.rep_id, f.n, f.v ->> 'word' as label, (f.v ->> 't')::float8 as ft
  from scope s
  cross join lateral jsonb_array_elements(s.fillers) with ordinality as f(v, n)
),
-- The um, uh and erm, from their start to the end of their word.
ums as (
  select distinct on (h.rep_id, h.n)
    h.rep_id, h.ft as from_t, greatest(h.ft, coalesce(w.we, h.ft)) as to_t
  from filler_hits h
  left join wo w
    on w.rep_id = h.rep_id
   and abs(w.ws - h.ft) < 0.006
   and regexp_replace(regexp_replace(lower(w.word), '[^a-z0-9'']', '', 'g'), '^''+|''+$', '', 'g') = h.label
  where h.label in ('um', 'uh', 'erm')
  order by h.rep_id, h.n, w.i
),
-- New rule: an um, uh or erm within 0.5s of either edge.
near_new as (
  select p.rep_id, p.i
  from gaps p
  join ums u on u.rep_id = p.rep_id
  where greatest(0, u.from_t - p.t, p.t - u.to_t) <= 0.5
     or greatest(0, u.from_t - (p.t + p.len), (p.t + p.len) - u.to_t) <= 0.5
  group by p.rep_id, p.i
),
-- The rule before: any filler within 1.2s of either edge.
near_cur as (
  select p.rep_id, p.i
  from gaps p
  join filler_hits h on h.rep_id = p.rep_id
  where abs(h.ft - p.t) <= 1.2 or abs(h.ft - (p.t + p.len)) <= 1.2
  group by p.rep_id, p.i
),
-- Fewer than 6 words since the last sentence end, the walk back in
-- `wordsInSentenceEndingAt`: a sentence end 2 to 6 words back, or fewer
-- than 6 words said by then.
walk as (
  select
    p.rep_id, p.i as pi, w.stop_new, w.raw_stop,
    row_number() over (partition by p.rep_id, p.i order by w.i desc) as rk
  from gaps p
  join wstop w on w.rep_id = p.rep_id and w.we <= p.t + 0.05
),
shorts as (
  select
    rep_id, pi,
    count(*) <= 5 or coalesce(bool_or(stop_new) filter (where rk between 2 and 6), false) as short_new,
    count(*) <= 5 or coalesce(bool_or(raw_stop) filter (where rk between 2 and 6), false) as short_cur
  from walk
  group by rep_id, pi
),
-- The pauses as the take stored them: their verdicts, and the envelope's.
-- Matched to the rebuilt gaps on the centisecond both were rounded to (an
-- equality, so Postgres can hash it rather than compare every pair).
stored_p as (
  select
    s.rep_id, floor((sp ->> 't')::float8 * 100 + 0.5) as cs, sp ->> 'verdict' as verdict,
    coalesce(sp ->> 'note', '') as note
  from scope s
  cross join lateral jsonb_array_elements(s.stored_pauses) as sp
),
stored_at as (
  select
    p.rep_id, p.i,
    bool_or(sp.verdict = 'filled' and sp.note like '%The mic heard it%') as voiced,
    min(sp.verdict) as stored_verdict
  from gaps p
  join stored_p sp on sp.rep_id = p.rep_id and sp.cs = floor(p.t * 100 + 0.5)
  group by p.rep_id, p.i
),
facts as (
  select
    p.rep_id, p.t, p.len,
    case when p.gap < 0.8 then 'beat' when p.stop_new then 'pre' else 'mid' end as kind_new,
    case when p.gap < 0.8 then 'beat' when p.stop_cur then 'pre' else 'mid' end as kind_cur,
    p.t <= p.first_at + 0.5 as at_opening,
    coalesce(sa.voiced, false) as voiced,
    nn.i is not null as near_new,
    nc.i is not null as near_cur,
    coalesce(sh.short_new, true) as short_new,
    coalesce(sh.short_cur, true) as short_cur,
    sa.stored_verdict
  from gaps p
  left join stored_at sa on sa.rep_id = p.rep_id and sa.i = p.i
  left join near_new nn on nn.rep_id = p.rep_id and nn.i = p.i
  left join near_cur nc on nc.rep_id = p.rep_id and nc.i = p.i
  left join shorts sh on sh.rep_id = p.rep_id and sh.pi = p.i
),
-- Every pause judged four ways, in judgePauses's order.
verdicts as (
  select
    f.rep_id, f.t, f.stored_verdict, v.rules,
    case
      when v.kind = 'beat' then 'beat'
      when f.len > 3.5 then 'dead'
      when v.env and f.voiced then 'filled'
      when v.near then 'filled'
      when v.kind = 'mid' then 'hesitation'
      when f.len < 0.8 then 'beat'
      when f.at_opening then 'opening'
      when v.short then 'hesitation'
      else 'landing'
    end as verdict
  from facts f
  cross join lateral (values
    ('new', true, f.kind_new, f.near_new, f.short_new),
    ('new_noenv', false, f.kind_new, f.near_new, f.short_new),
    ('current', true, f.kind_cur, f.near_cur, f.short_cur),
    ('current_noenv', false, f.kind_cur, f.near_cur, f.short_cur)
  ) as v(rules, env, kind, near, short)
),
counts as (
  select
    s.rep_id, r.rules, s.dur,
    count(v.verdict) filter (where v.verdict <> 'beat') as held,
    count(v.verdict) filter (where v.verdict = 'landing') as landings,
    count(v.verdict) filter (where v.verdict = 'opening') as openings,
    count(v.verdict) filter (where v.verdict = 'filled') as filled,
    count(v.verdict) filter (where v.verdict = 'dead') as dead,
    coalesce(bool_or(v.verdict = 'landing' and s.dur > 0 and v.t >= s.dur * 0.8), false) as ending,
    count(v.verdict) filter (where v.rules = 'current' and v.stored_verdict is not null
      and v.stored_verdict <> 'beat') as stored_held,
    count(v.verdict) filter (where v.rules = 'current' and v.stored_verdict is not null
      and v.stored_verdict <> 'beat' and v.verdict = v.stored_verdict) as stored_held_matched
  from scope s
  join (select distinct rep_id from words) has_words on has_words.rep_id = s.rep_id
  cross join (values ('new'), ('new_noenv'), ('current'), ('current_noenv')) as r(rules)
  left join verdicts v on v.rep_id = s.rep_id and v.rules = r.rules
  group by s.rep_id, r.rules, s.dur
),
-- reportJudged's sum, term by term in its order, so the doubles match.
scored as (
  select
    c.*,
    case
      when c.held = 0 then 20::float8
      when c.rules like 'new%' then
        (c.landings + c.openings)::float8 / c.held * 67
        + z.zone * 25
        + (case when c.ending then 8 else 0 end)
        - least(15, c.filled * 10 + c.dead * 12)
      else
        (c.landings + c.openings)::float8 / c.held * 60
        + z.zone * 25
        + (case when c.openings > 0 then 7 else 0 end)
        + (case when c.ending then 8 else 0 end)
        - c.filled * 10
        - c.dead * 12
    end as raw_score
  from counts c
  cross join lateral (
    select case when c.dur > 0 then c.landings / (c.dur / 60) else 0 end as per_min
  ) pm
  cross join lateral (
    select case
      when pm.per_min >= 2 and pm.per_min <= 9 then 1::float8
      else greatest(0, 1 - (case when pm.per_min < 2 then 2 - pm.per_min else pm.per_min - 9 end) / 3.5)
    end as zone
  ) z
),
per_recording as (
  select
    s.rep_id,
    s.person,
    s.felt_n,
    s.stored,
    s.ethos_index - floor(s.stored / 100 * 150 + 0.5) as index_minus_pause,
    max(greatest(0, least(100, floor(x.raw_score + 0.5)))) filter (where x.rules = 'new') as new,
    max(greatest(0, least(100, floor(x.raw_score + 0.5)))) filter (where x.rules = 'new_noenv') as new_noenv,
    max(greatest(0, least(100, floor(x.raw_score + 0.5)))) filter (where x.rules = 'current') as current,
    max(greatest(0, least(100, floor(x.raw_score + 0.5)))) filter (where x.rules = 'current_noenv') as current_noenv,
    max(x.stored_held) filter (where x.rules = 'current') as stored_held,
    max(x.stored_held_matched) filter (where x.rules = 'current') as stored_held_matched
  from scope s
  left join scored x on x.rep_id = s.rep_id
  group by s.rep_id, s.person, s.felt_n, s.stored, s.ethos_index
)
-- [per-recording core ends here: lib/pause-replay.test.ts selects from per_recording above this line]
,
-- Only recordings the replay could read (a stored score and Whisper's words).
base as (
  select * from per_recording where new is not null and stored is not null
),
long as (
  select b.person, b.felt_n, b.index_minus_pause, b.stored as stored_score, v.variant, v.score
  from base b
  cross join lateral (values
    ('stored', b.stored),
    ('current_noenv', b.current_noenv),
    ('current', b.current),
    ('new_noenv', b.new_noenv),
    ('new', b.new)
  ) as v(variant, score)
),
felt_people as (
  select person from base where felt_n is not null group by person having count(*) >= 3
),
centred as (
  select
    l.variant, l.felt_n,
    l.score - avg(l.score) over (partition by l.variant, l.person) as dev_score,
    l.felt_n - avg(l.felt_n) over (partition by l.variant, l.person) as dev_felt
  from long l
  join felt_people fp on fp.person = l.person
  where l.felt_n is not null
),
stats as (
  select
    variant,
    count(*)::float8 as n,
    percentile_cont(0.5) within group (order by score) as median,
    percentile_cont(0.25) within group (order by score) as p25,
    percentile_cont(0.75) within group (order by score) as p75,
    avg((score < 40)::int::float8) as share_under_40,
    avg((score = 20)::int::float8) as share_at_20,
    corr(score, index_minus_pause) as corr_index_minus_pause,
    avg(score) filter (where felt_n = 1) as mean_felt_rough,
    avg(score) filter (where felt_n = 2) as mean_felt_okay,
    avg(score) filter (where felt_n = 3) as mean_felt_strong,
    avg((score = stored_score)::int::float8) as share_equal_to_stored
  from long
  group by variant
),
felt_stats as (
  select
    variant,
    count(*)::float8 as felt_recordings,
    corr(dev_score, dev_felt) as within_person_corr_felt,
    avg(dev_score) filter (where felt_n = 1) as centred_felt_rough,
    avg(dev_score) filter (where felt_n = 2) as centred_felt_okay,
    avg(dev_score) filter (where felt_n = 3) as centred_felt_strong
  from centred
  group by variant
),
lines as (
  select s.variant, m.ord, m.metric, m.value
  from stats s
  left join felt_stats f on f.variant = s.variant
  cross join lateral (values
    (1, 'n (replayed recordings)', s.n),
    (2, 'median', s.median),
    (3, 'p25', s.p25),
    (4, 'p75', s.p75),
    (5, 'share under 40', s.share_under_40),
    (6, 'share at exactly 20', s.share_at_20),
    (7, 'corr with Index minus pause', s.corr_index_minus_pause),
    (8, 'within-person corr with felt', f.within_person_corr_felt),
    (9, 'felt recordings (people with 3+)', f.felt_recordings),
    (10, 'people with 3+ felt', (select count(*)::float8 from felt_people)),
    (11, 'mean, felt rough', s.mean_felt_rough),
    (12, 'mean, felt okay', s.mean_felt_okay),
    (13, 'mean, felt strong', s.mean_felt_strong),
    (14, 'vs own mean, felt rough', f.centred_felt_rough),
    (15, 'vs own mean, felt okay', f.centred_felt_okay),
    (16, 'vs own mean, felt strong', f.centred_felt_strong),
    (17, 'share equal to stored', s.share_equal_to_stored)
  ) as m(ord, metric, value)
  union all
  -- The checks. How many scored recordings the window holds, how many
  -- the replay could read, and how many of the stored verdicts the
  -- "current" rules rebuild: near 1 means the replay reads the data as
  -- the route did.
  select v.variant, 18, 'scored recordings in the window', (select count(*)::float8 from per_recording)
  from (values ('stored')) v(variant)
  union all
  select 'current', 19, 'stored held-pause verdicts rebuilt',
    (select sum(stored_held_matched)::float8 / nullif(sum(stored_held), 0) from base)
)
select
  metric,
  round(max(value) filter (where variant = 'stored')::numeric, 3) as stored,
  round(max(value) filter (where variant = 'current_noenv')::numeric, 3) as current_noenv,
  round(max(value) filter (where variant = 'current')::numeric, 3) as current,
  round(max(value) filter (where variant = 'new_noenv')::numeric, 3) as new_noenv,
  round(max(value) filter (where variant = 'new')::numeric, 3) as new
from lines
group by ord, metric
order by ord;
