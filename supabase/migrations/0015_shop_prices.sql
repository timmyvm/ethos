-- 0015: the shop's prices live on the server, and purchased_freezes
-- shows each account only its own rows.
--
-- 1. THE PRICE. 0005's spend_coins checked the session, the reason's
--    shape and the balance, but charged whatever amount the caller sent.
--    A direct RPC call with p_amount 1 and 'shop:streak_freeze' bought a
--    freeze for one coin, and the same worked for every pose. The price
--    now comes from shop_prices, a copy of lib/shop.ts's SHOP that
--    lib/shop.test.ts compares item for item, price for price.
--
--    An unknown reason is refused. An amount that is not the catalog's
--    price is refused too, rather than charged the catalog's price
--    anyway: the shop sends the price its button shows, so the two only
--    differ when a client is stale or forged, and then the honest answer
--    is "that didn't go through, your coins are untouched" (what the shop
--    already says for any refusal), never a charge the person was not
--    shown.
--
--    Rows bought at the wrong price before this file may already be in
--    the ledger. lib/shop.ts ownedFrom counts a spend only when it paid
--    the catalog's price in full, so none of them proves a purchase.

create table if not exists public.shop_prices (
  reason text primary key check (reason ~ '^shop:[a-z0-9_-]{1,40}$'),
  price integer not null check (price > 0)
);

-- Read only by spend_coins, which runs as its owner. No policy, so the
-- browser's roles read nothing here.
alter table public.shop_prices enable row level security;
revoke all on table public.shop_prices from public, anon, authenticated;

insert into public.shop_prices (reason, price) values
  ('shop:streak_freeze', 14),
  ('shop:pose_speaking', 8),
  ('shop:pose_workout', 8),
  ('shop:pose_celebrate', 12)
on conflict (reason) do update set price = excluded.price;

create or replace function public.spend_coins(p_reason text, p_amount integer)
returns table (ok boolean, balance integer, detail text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_price integer;
  bal integer;
begin
  if uid is null then
    return query select false, 0, 'not signed in';
    return;
  end if;

  select sp.price into v_price
  from public.shop_prices sp
  where sp.reason = p_reason;
  if v_price is null then
    return query select false, 0, 'unknown item';
    return;
  end if;
  if p_amount is distinct from v_price then
    return query select false, 0, 'wrong price';
    return;
  end if;

  -- Lock this user's ledger rows for the duration of the transaction so
  -- two taps can't both read the same balance and both succeed.
  perform 1 from public.coin_ledger where user_id = uid for update;

  select coalesce(sum(case when kind = 'earned' then amount else -amount end), 0)
    into bal
  from public.coin_ledger
  where user_id = uid;

  if bal < v_price then
    return query select false, bal, 'not enough coins';
    return;
  end if;

  insert into public.coin_ledger (user_id, kind, amount, reason)
  values (uid, 'spent', v_price, p_reason);

  return query select true, bal - v_price, 'ok';
end;
$$;

-- Every session the app makes is `authenticated`, anonymous-first ones
-- included. The anon key alone has no one to charge.
revoke all on function public.spend_coins(text, integer) from public, anon;
grant execute on function public.spend_coins(text, integer) to authenticated;

-- 2. THE VIEW. 0005's purchased_freezes ran as its owner, so it counted
--    shop:streak_freeze spends over every account, grouped by user_id,
--    and anon and authenticated could read all of it: every buyer's id.
--    As the invoker, coin_ledger's "own coins" policy applies and a
--    session sees only its own row.
--
--    Nothing reads it: lib/client-data.ts purchasedFreezes reads
--    coin_ledger itself, and no route or script names the view. It is
--    kept, not removed, so this file holds no destructive statement.
alter view public.purchased_freezes set (security_invoker = true);
revoke select on public.purchased_freezes from anon;
comment on view public.purchased_freezes is
  'Unused by the app (lib/client-data.ts purchasedFreezes reads coin_ledger). Security invoker since 0015, so it shows a session only its own row.';
