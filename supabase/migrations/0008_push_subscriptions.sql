-- Web push subscriptions (DECISIONS #186). One row per browser endpoint;
-- the row carries what the hourly cron needs to decide locally-honest
-- sends: the chosen hour, the device's UTC offset, its quiet hours, and
-- the last local date a send happened (one per day, whatever the
-- scheduler does). Only the service role touches this table - RLS is on
-- with no policies, so clients can't read each other's endpoints.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  reminder_hour int check (reminder_hour between 0 and 23),
  tz_offset int not null default 0,
  quiet_from int not null default 22,
  quiet_to int not null default 7,
  last_sent_on date,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
