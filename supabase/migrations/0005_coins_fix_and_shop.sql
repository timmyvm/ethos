-- Schema v5 — the coin grant has never worked, and the shop.
--
-- 1. THE BUG. `grantCoins()` upserts with onConflict "user_id,earned_on",
--    but 0004's unique index is PARTIAL (`where reason = 'streak_day'`).
--    Postgres will not match a partial index to an ON CONFLICT clause
--    unless the statement repeats the predicate, which PostgREST cannot
--    express — so every insert failed with 42P10, `grantCoins` returned 0
--    on error, and `syncCoins` swallowed it. Nobody has ever earned a
--    coin. Reported by Timothy as "coins don't get added".
--
--    The fix is a full unique index including `reason`, so it is matchable
--    and still allows future earn reasons on the same day. Spends carry
--    `earned_on = null`, and Postgres treats nulls as distinct, so any
--    number of purchases can share a day.

drop index if exists coin_ledger_streak_day_uniq;

create unique index if not exists coin_ledger_earn_uniq
  on coin_ledger (user_id, reason, earned_on);

-- 2. SPENDING. The client is allowed to grant its own streak-day coin
--    (0004's insert policy is what keeps that honest). It is NOT allowed
--    to write spends: a balance check in a policy races against itself,
--    and two taps could buy two things with one coin's worth of balance.
--    Purchases go through this function instead — one statement, one
--    lock, balance verified against the ledger it is about to append to.
create or replace function spend_coins(p_reason text, p_amount integer)
returns table (ok boolean, balance integer, detail text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  bal integer;
begin
  if uid is null then
    return query select false, 0, 'not signed in';
    return;
  end if;
  if p_amount is null or p_amount <= 0 then
    return query select false, 0, 'invalid amount';
    return;
  end if;
  if p_reason is null or p_reason !~ '^shop:[a-z0-9_-]{1,40}$' then
    return query select false, 0, 'unknown item';
    return;
  end if;

  -- Lock this user's ledger rows for the duration of the transaction so
  -- two taps can't both read the same balance and both succeed.
  perform 1 from coin_ledger where user_id = uid for update;

  select coalesce(sum(case when kind = 'earned' then amount else -amount end), 0)
    into bal
  from coin_ledger
  where user_id = uid;

  if bal < p_amount then
    return query select false, bal, 'not enough coins';
    return;
  end if;

  insert into coin_ledger (user_id, kind, amount, reason)
  values (uid, 'spent', p_amount, p_reason);

  return query select true, bal - p_amount, 'ok';
end;
$$;

revoke all on function spend_coins(text, integer) from public;
grant execute on function spend_coins(text, integer) to authenticated, anon;

-- 3. Purchased freezes. `freezeBalance` derives what should be equipped
--    from the streak, so a bought freeze would be reset on the next sync
--    unless the derivation knows about it. Reading it off the ledger keeps
--    the same "derived, never incremented" property that makes the freeze
--    logic safe to re-run.
create or replace view purchased_freezes as
  select user_id, count(*)::integer as bought
  from coin_ledger
  where kind = 'spent' and reason = 'shop:streak_freeze'
  group by user_id;

grant select on purchased_freezes to authenticated, anon;
