-- 0028: the hourly reminder clock and the founder's /active page need no
-- hosting setting (DECISIONS #430, #431).
--
-- The clock (0027) calls GET /api/push/cron with a bearer read from Vault.
-- Rather than copy that secret into Vercel as well, the sender asks the
-- database whether a bearer is it: public.push_tick_ok compares the two
-- inside the database, so the secret is made here and never leaves it:
--
--   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_tick_secret');
--
-- /active is the founder's page. Besides ADMIN_EMAILS on the server, it
-- accepts a confirmed email listed in private.founders, which only the
-- database's owner can write.
--
-- Both functions answer the service role only (the server's own client);
-- anon and signed-in callers cannot reach them, and private is closed to
-- the API (PostgREST serves public only).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.founders (
  email text primary key check (email = lower(btrim(email)))
);
revoke all on private.founders from public, anon, authenticated;

create or replace function public.push_tick_ok(token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select extensions.digest(s.decrypted_secret, 'sha256') = extensions.digest(token, 'sha256')
      from vault.decrypted_secrets s
     where s.name = 'push_tick_secret'
       and length(btrim(coalesce(s.decrypted_secret, ''))) >= 32
     limit 1
  ), false)
$$;
revoke all on function public.push_tick_ok(text) from public, anon, authenticated;
grant execute on function public.push_tick_ok(text) to service_role;

create or replace function public.is_founder_email(addr text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.founders f where f.email = lower(btrim(addr)))
$$;
revoke all on function public.is_founder_email(text) from public, anon, authenticated;
grant execute on function public.is_founder_email(text) to service_role;
