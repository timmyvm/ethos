-- 0024: saved words, bounded per account.
--
-- 0023 lets any session save its own swaps through the anon key, and
-- nothing capped how many. An anonymous session is free, and the unique
-- key only stops a pair saved twice, so one script could store rows
-- without end and push the database toward its size cap, which stops
-- writes for the whole app: the risk 0021 closed for tester answers.
--
-- So an account keeps 500 swaps at most, as many as Your words reads
-- (lib/saved-words.ts fetchSavedWords): every kept swap is on the list
-- and marked saved on the word sheet. A trigger refuses the next new
-- one, and the sheet says "That didn't save." A pair saved already goes
-- through to the unique key, whose answer (23505) the phone reads back
-- as the row it is, at the cap too.
--
-- The deploy connector stalls on two words (0020's head), so neither
-- appears here: the function and trigger are "create or replace".
-- Running the file twice is safe.

create or replace function public.saved_words_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- One writer per account at a time, so two saves at 499 cannot both
  -- pass. A row-level BEFORE trigger sees the rows its own statement has
  -- already written, so a bulk insert counts as it goes.
  perform pg_advisory_xact_lock(hashtext('saved_words:' || new.user_id::text));
  if exists (
    select 1 from public.saved_words s
     where s.user_id = new.user_id and s.word = new.word and s.instead = new.instead
  ) then
    -- Saved already: the unique key answers it, not the cap.
    return new;
  end if;
  if (select count(*) from public.saved_words s where s.user_id = new.user_id) >= 500 then
    raise exception 'saved_words: an account keeps 500 swaps at most'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.saved_words_cap() from public, anon, authenticated;

create or replace trigger saved_words_cap
  before insert on public.saved_words
  for each row execute function public.saved_words_cap();
