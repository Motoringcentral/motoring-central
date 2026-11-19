-- Car sales tools (19 Nov 2026): leads inbox, reported adverts, "price reduced", and renewing private adverts properly.

-- 1. Leads: the seller's own status, note and follow-up date for each buyer conversation
create table if not exists public.advert_leads (
  seller_id uuid not null references auth.users(id) on delete cascade,
  advert_id bigint not null references public.adverts(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'new' check (status in ('new','contacted','viewing','sold','lost')),
  note text check (char_length(note) <= 1000),
  follow_up date,
  updated_at timestamptz not null default now(),
  primary key (advert_id, buyer_id)
);
alter table public.advert_leads enable row level security;
create index if not exists advert_leads_seller_idx on public.advert_leads (seller_id);
drop policy if exists "leads: own" on public.advert_leads;
create policy "leads: own" on public.advert_leads for select to authenticated using (seller_id = (select auth.uid()));
drop policy if exists "leads: add own" on public.advert_leads;
create policy "leads: add own" on public.advert_leads for insert to authenticated
  with check (seller_id = (select auth.uid()) and exists (select 1 from public.adverts a where a.id = advert_id and a.owner_id = (select auth.uid())));
drop policy if exists "leads: change own" on public.advert_leads;
create policy "leads: change own" on public.advert_leads for update to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
drop policy if exists "leads: delete own" on public.advert_leads;
create policy "leads: delete own" on public.advert_leads for delete to authenticated using (seller_id = (select auth.uid()));

-- 2. Reported adverts: any logged-in buyer can report; only staff can see and act on reports
create table if not exists public.advert_reports (
  id bigint generated always as identity primary key,
  advert_id bigint not null references public.adverts(id) on delete cascade,
  reporter_id uuid default auth.uid() references auth.users(id) on delete set null,
  reason text not null check (reason in ('scam','sold','wrong','undeclared','offensive','other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','dismissed','removed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null,
  unique (advert_id, reporter_id)
);
alter table public.advert_reports enable row level security;
create index if not exists advert_reports_open_idx on public.advert_reports (created_at) where status = 'open';
drop policy if exists "reports: send" on public.advert_reports;
create policy "reports: send" on public.advert_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');
drop policy if exists "reports: staff read" on public.advert_reports;
create policy "reports: staff read" on public.advert_reports for select to authenticated using ((select private.is_staff()));
drop policy if exists "reports: staff update" on public.advert_reports;
create policy "reports: staff update" on public.advert_reports for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create or replace function private.report_advert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int; a public.adverts;
begin
  if tg_op = 'INSERT' then
    select count(*) into n from public.advert_reports where reporter_id = new.reporter_id and created_at > now() - interval '1 hour';
    if n >= 10 then raise exception 'Too many reports. Please try again later'; end if;
    select * into a from public.adverts where id = new.advert_id;
    if not found or a.status <> 'live' then raise exception 'That advert is no longer listed'; end if;
    if a.owner_id = new.reporter_id then raise exception 'You cannot report your own advert'; end if;
    new.status := 'open'; new.handled_at := null; new.handled_by := null;
  else
    if new.status is distinct from old.status then new.handled_at := now(); new.handled_by := (select auth.uid()); end if;
  end if;
  return new;
end $$;
drop trigger if exists advert_reports_check on public.advert_reports;
create trigger advert_reports_check before insert or update on public.advert_reports
  for each row execute function private.report_advert();

create or replace function private.mail_report() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a public.adverts; t text;
begin
  select * into a from public.adverts where id = new.advert_id;
  t := coalesce(nullif(concat_ws(' ', a.data->>'year', a.data->>'make', a.data->>'model'), ''), 'an advert');
  perform private.mail_owners('An advert has been reported: ' || t,
    'A buyer has reported the advert for ' || t || coalesce(' (' || nullif(upper(a.data->>'reg'),'') || ')', '') || E'.\n\nReason: ' ||
    case new.reason when 'scam' then 'Looks like a scam or fraud' when 'sold' then 'Already sold' when 'wrong' then 'Wrong details or price'
      when 'undeclared' then 'Write-off, damage or finance not declared' when 'offensive' then 'Offensive or inappropriate' else 'Other' end ||
    coalesce(E'\nTheir note: "' || nullif(left(new.details, 500), '') || '"', '') ||
    E'\n\nOpen the admin page, "Reported adverts", to check it and remove it if needed.',
    '/#admin', 'staff_advert_reported', 'rep:' || new.advert_id);
  return new;
exception when others then
  raise warning 'email not queued: %', sqlerrm;
  return new;
end $$;
drop trigger if exists advert_reports_mail on public.advert_reports;
create trigger advert_reports_mail after insert on public.advert_reports
  for each row execute function private.mail_report();

-- 3. Price reduced: worked out on the server, so a seller cannot fake a "Reduced" label.
--    Also: only staff, or renew_advert(), can change when an advert ends.
create or replace function private.advert_price() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pn numeric; po numeric; w numeric; wj jsonb; rj jsonb;
begin
  if tg_op = 'INSERT' then
    new.data := new.data - 'was' - 'reduced_at';
    return new;
  end if;
  if not private.is_staff() and coalesce(current_setting('mc.renew', true), '') <> 'on' then
    new.expires_at := old.expires_at;
    if old.data ? 'exp' then new.data := jsonb_set(new.data, '{exp}', old.data->'exp'); end if;
  end if;
  begin pn := (new.data->>'price')::numeric; exception when others then pn := null; end;
  begin po := (old.data->>'price')::numeric; exception when others then po := null; end;
  begin w := (old.data->>'was')::numeric; exception when others then w := null; end;
  wj := old.data->'was'; rj := old.data->'reduced_at';
  if pn is not null and po is not null and pn < po then
    wj := to_jsonb(greatest(coalesce(w, po), po)); rj := to_jsonb(to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  elsif pn is not null and w is not null and pn >= w then
    wj := null; rj := null;
  end if;
  new.data := (new.data - 'was' - 'reduced_at') || jsonb_strip_nulls(jsonb_build_object('was', wj, 'reduced_at', rj));
  return new;
end $$;
drop trigger if exists adverts_price on public.adverts;
create trigger adverts_price before insert or update on public.adverts
  for each row execute function private.advert_price();

-- 4. Renewing a private advert for another 30 days (the payment screen comes first on the site;
--    when real card payments are switched on, this must also check the payment on the server)
create or replace function public.renew_advert(p_id bigint) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare a public.adverts; e timestamptz;
begin
  select * into a from public.adverts where id = p_id;
  if not found or a.owner_id is distinct from (select auth.uid()) then raise exception 'That is not your advert'; end if;
  if a.status not in ('live') then raise exception 'Only a live advert can be renewed'; end if;
  if coalesce(a.data->>'private', '') <> 'true' then raise exception 'Dealer adverts do not need renewing'; end if;
  e := greatest(now(), coalesce(a.expires_at, now())) + interval '30 days';
  perform set_config('mc.renew', 'on', true);
  update public.adverts set expires_at = e, data = jsonb_set(data, '{exp}', to_jsonb((extract(epoch from e) * 1000)::bigint)) where id = p_id;
  perform set_config('mc.renew', '', true);
  return e;
end $$;
revoke all on function public.renew_advert(bigint) from public, anon;
grant execute on function public.renew_advert(bigint) to authenticated;
