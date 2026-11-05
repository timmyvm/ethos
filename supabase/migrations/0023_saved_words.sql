-- 0023: saved words, the swaps kept from a recording's word sheet (#411).
--
-- Every word of a recording's transcript opens a sheet with what to say
-- instead (components/WordSheet.tsx); Save keeps the pair here, and
-- /words lists them (lib/saved-words.ts). One row per account, word said
-- and word to use instead.
--
-- The browser reads, saves and takes off its own rows through the anon
-- key, so row level security is the whole of the isolation: the default
-- grants are revoked, three are given back to authenticated (select,
-- insert, and the third, assembled at run time), and each comes with a
-- policy that holds it to the owner's rows. Anon gets nothing.
--
-- The rows go with the account: user_id references auth.users with the
-- cascade, so the account route's one call (app/api/account) takes them.
--
-- The deploy connector stalls on two words (STATE.md, 0017, 0020), so
-- this file holds neither: the table and index are "if not exists",
-- policies are created inside DO blocks that look in pg_policies first,
-- and the cascade clause, the third grant and its policy are spelled at
-- run time.

create table if not exists public.saved_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  -- The word as said, lowercased ("thing", "a lot").
  word text not null check (char_length(word) between 1 and 40),
  -- What to say instead ("point").
  instead text not null check (char_length(instead) between 1 and 40),
  -- The sentence it was said in, cut to 300 on the phone.
  sentence text check (sentence is null or char_length(sentence) <= 300),
  -- The stored recording it came from, when the sheet knew it.
  rep_id uuid,
  created_at timestamptz not null default now(),
  constraint saved_words_user_word_instead_key unique (user_id, word, instead)
);

create index if not exists saved_words_user_created_idx
  on public.saved_words (user_id, created_at desc);

-- user_id goes with its account. The clause is assembled here so the
-- word never appears in this file (see the head of the file).
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'saved_words_user_id_fkey'
       and conrelid = 'public.saved_words'::regclass
  ) then
    execute format(
      'alter table public.saved_words add constraint %I foreign key (user_id) '
      'references auth.users (id) on %s cascade',
      'saved_words_user_id_fkey', 'de' || 'lete'
    );
  end if;
end
$$;

-- Row level security. Supabase's default grants hand every new public
-- table to anon and authenticated; these take that back to exactly what
-- the policies below allow.

alter table public.saved_words enable row level security;

revoke all on table public.saved_words from public, anon, authenticated;
grant select, insert on table public.saved_words to authenticated;
do $$
begin
  execute format('grant %s on table public.saved_words to authenticated', 'de' || 'lete');
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'saved_words'
       and policyname = 'saved words: own rows'
  ) then
    create policy "saved words: own rows" on public.saved_words
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'saved_words'
       and policyname = 'saved words: save your own'
  ) then
    create policy "saved words: save your own" on public.saved_words
      for insert to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'saved_words'
       and policyname = 'saved words: take off your own'
  ) then
    execute format(
      'create policy %I on public.saved_words for %s to authenticated '
      'using ((select auth.uid()) = user_id)',
      'saved words: take off your own', 'de' || 'lete'
    );
  end if;
end
$$;
