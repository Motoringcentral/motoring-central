-- MOT history: ready for the DVSA key (26 Nov 2026)
-- When someone lists a vehicle and types its registration, the free DVLA look-up gives the make but not the model.
-- The DVSA MOT record has the model, so the mot-history function can give a logged-in person the make and model
-- (never the MOT history itself) for their own registration. This table counts those look-ups so each person is
-- limited to 20 a day. Only the function (service role) reads or writes it.
create table if not exists public.mot_lookups (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  reg text not null check (reg ~ '^[A-Z0-9]{2,8}$'),
  at timestamptz not null default now()
);
create index if not exists mot_lookups_user_at on public.mot_lookups (user_id, at desc);
alter table public.mot_lookups enable row level security;
revoke all on public.mot_lookups from anon, authenticated;

-- old look-up counts are not needed after a few days
create or replace function private.mot_lookups_tidy() returns void
language sql security definer set search_path = '' as $$
  delete from public.mot_lookups where at < now() - interval '7 days'
$$;
revoke all on function private.mot_lookups_tidy() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from cron.job where jobname = 'mot-lookups-tidy') then perform cron.unschedule('mot-lookups-tidy'); end if;
  perform cron.schedule('mot-lookups-tidy', '17 3 * * *', 'select private.mot_lookups_tidy()');
end $$;
