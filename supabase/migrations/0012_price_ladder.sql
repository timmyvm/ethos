-- 0012: the price ladder (DECISIONS #377).
--
-- One plan, billed monthly through Stripe, whose price drops each month
-- it is paid in a row. Stripe is the record; this table is the copy the
-- app reads, written only by the server (the webhook, checkout and sync
-- routes, all on the service role through lib/billing.ts).

create table if not exists billing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  -- The plan this account is on now, or its last one. Null before any.
  stripe_subscription_id text,
  -- Stripe's subscription status as it last synced: active, past_due,
  -- canceled, incomplete, unpaid... Null before any plan.
  status text,
  -- Months paid in a row on this plan: 0 before the first payment, then
  -- 1, 2, 3... The price this month is the ladder at ladder_month, and the
  -- next renewal is the ladder at ladder_month + 1 (lib/pricing.ts).
  ladder_month integer not null default 0 check (ladder_month >= 0),
  -- What the current month cost and what the next renewal will charge,
  -- in cents, as Stripe has them: the app shows these, never a guess.
  price_cents integer,
  next_price_cents integer,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table billing enable row level security;

drop policy if exists "own billing" on billing;
create policy "own billing" on billing for select using (auth.uid() = user_id);
-- No insert, update or delete policy: only the service role writes here.

-- profiles.premium is the gate every premium read checks, and 0003 let
-- its owner update their own row: harmless while premium came from an
-- invite, not once it costs money. A browser session (anon or
-- authenticated) can still write its name and its pose, but the
-- entitlement columns keep the value the server gave them.
alter table profiles add column if not exists premium_source text
  check (premium_source in ('code', 'stripe'));

create or replace function guard_profile_entitlement() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.premium := false;
      new.premium_until := null;
      new.premium_source := null;
    else
      new.premium := old.premium;
      new.premium_until := old.premium_until;
      new.premium_source := old.premium_source;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_entitlement on profiles;
create trigger guard_profile_entitlement
  before insert or update on profiles
  for each row execute function guard_profile_entitlement();

-- Invite-code premium predates this column; name its source so a plan
-- ending never switches off a premium the account was given.
update profiles set premium_source = 'code'
  where premium and premium_source is null;
