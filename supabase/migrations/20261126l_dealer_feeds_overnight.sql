-- Stock feeds update overnight (26 Nov 2026)
-- A dealer's stock feed (a CSV file at a web address) was only checked when the dealer opened their dashboard, and the
-- address was only kept in their browser. Now the address is kept here, and every night (2:40am, with a second pass at
-- 3:40am for any left over) the stock-feed function checks each feed: price, mileage and description changes are made,
-- vehicles no longer in the feed are taken down, and the dealer is emailed about new vehicles to list (listing them
-- uses a history check from their plan, so that still happens on their dashboard). If a feed cannot be read, looks
-- empty, or would take down more than half the dealer's feed vehicles, nothing is taken down and the dealer is told.

create table if not exists public.dealer_feeds (
  dealer_id uuid primary key references public.partners(id) on delete cascade,
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  wo_ok boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_result jsonb
);
alter table public.dealer_feeds enable row level security;
revoke all on public.dealer_feeds from anon, authenticated;

-- the logged-in dealer's feed (null if none)
create or replace function public.dealer_feed_get() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('url', f.url, 'wo_ok', f.wo_ok, 'last_run_at', f.last_run_at, 'last_result', f.last_result)
  from public.dealer_feeds f where f.dealer_id = (select auth.uid())
$$;

create or replace function public.dealer_feed_set(p_url text, p_wo_ok boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare u text := btrim(coalesce(p_url, ''));
begin
  if not exists (select 1 from public.partners where id = (select auth.uid()) and role = 'dealer' and status = 'approved') then
    raise exception 'dealers_only'; end if;
  if u !~ '^https://[^\s/]+\.[^\s]+$' or char_length(u) > 500 then raise exception 'bad_url'; end if;
  if not coalesce(p_wo_ok, false) then raise exception 'confirm_writeoff'; end if;
  insert into public.dealer_feeds (dealer_id, url, wo_ok) values ((select auth.uid()), u, true)
  on conflict (dealer_id) do update set url = excluded.url, wo_ok = true, updated_at = now(),
    last_run_at = case when public.dealer_feeds.url = excluded.url then public.dealer_feeds.last_run_at end,
    last_result = case when public.dealer_feeds.url = excluded.url then public.dealer_feeds.last_result end;
end $$;

create or replace function public.dealer_feed_off() returns void
language sql security definer set search_path = '' as $$
  delete from public.dealer_feeds where dealer_id = (select auth.uid())
$$;

-- the overnight run emails the dealer through this (our own server only)
create or replace function public.feed_mail(p_dealer uuid, p_subject text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare em text;
begin
  select email into em from public.partners where id = p_dealer;
  perform private.mail(em, 'dealer', left(p_subject, 200), left(p_body, 5000), '/#dashboard', 'stock_feed',
    'feed:' || p_dealer || ':' || to_char(now() at time zone 'Europe/London', 'YYYYMMDD'));
end $$;

revoke all on function public.dealer_feed_get(), public.dealer_feed_set(text, boolean), public.dealer_feed_off(),
  public.feed_mail(uuid, text, text) from public, anon;
grant execute on function public.dealer_feed_get(), public.dealer_feed_set(text, boolean), public.dealer_feed_off() to authenticated;
revoke all on function public.feed_mail(uuid, text, text) from authenticated;
grant execute on function public.feed_mail(uuid, text, text) to service_role;

-- start the overnight run (the same private key as the email sender); emails go out on the next send
create or replace function private.kick_feeds() returns void
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if not exists (select 1 from public.dealer_feeds where last_run_at is null or last_run_at < now() - interval '20 hours') then return; end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'notify_cron_secret';
  perform net.http_post(
    url := 'https://hctboldpuyztugpwexdy.supabase.co/functions/v1/stock-feed',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', k),
    body := '{"cron":true}'::jsonb, timeout_milliseconds := 150000);
end $$;
revoke all on function private.kick_feeds() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'stock-feeds-night') then perform cron.unschedule('stock-feeds-night'); end if;
  perform cron.schedule('stock-feeds-night', '40 2,3 * * *', 'select private.kick_feeds()');
end $$;
