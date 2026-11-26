-- Partner prospects (applied to the database on 23 Nov 2026, 15:29)
-- This change was made from another Claude conversation, not from the one that keeps this repository. It was found on
-- 26 Nov 2026 and copied here from the database's own record so the repository and the database match. Everything below
-- this note is exactly what was run.
-- What it adds: a list of businesses to approach (public.prospects), a permanent do-not-email list
-- (public.prospect_suppressions) and a log of every call, email or visit (public.outreach_log). Staff only. The list was
-- filled with the 22,974 MOT stations from the official DVSA list. "can_email" is only true for limited companies, LLPs
-- and PLCs that have an email address and have not opted out. Nothing on the website uses these tables yet.

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  partner_type text not null check (partner_type in ('mot_station','dealer','recovery','ev_charging','valeting','bodyshop','alloy_wheels','locksmith','auto_electrician','garage','mobile_mechanic','tyres')),
  business_name text not null,
  address text, town text, postcode text, phone text, website text,
  email text,
  email_source text,                 -- page where the email was found (e.g. the business's own contact page)
  legal_form text not null default 'unknown' check (legal_form in ('ltd','llp','plc','sole_trader','partnership','unknown')),
  company_number text,               -- Companies House number when Ltd/LLP/PLC
  status text not null default 'new' check (status in ('new','called','emailed','replied','interested','signed_up','not_interested','closed')),
  opted_out boolean not null default false,
  opted_out_at timestamptz,
  can_email boolean generated always as (email is not null and not opted_out and legal_form in ('ltd','llp','plc')) stored,
  last_contacted_at timestamptz,
  contact_count int not null default 0,
  notes text,
  source text not null default 'manual',   -- 'dvsa_mot_list', 'manual', 'referral', ...
  mot_site_number text unique,
  partner_id uuid references public.partners(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index prospects_type_status_idx on public.prospects (partner_type, status);
create index prospects_postcode_idx on public.prospects (upper(split_part(trim(postcode),' ',1)));
create unique index prospects_email_uidx on public.prospects (lower(email)) where email is not null;

-- permanent do-not-email list (kept even if a prospect row is deleted)
create table public.prospect_suppressions (
  email text primary key,
  reason text not null default 'unsubscribed',
  created_at timestamptz not null default now()
);

-- every call / email / visit logged against a prospect
create table public.outreach_log (
  id bigint generated always as identity primary key,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  channel text not null check (channel in ('email','phone','visit','contact_form','other')),
  template text,
  outcome text,
  by_user uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index outreach_log_prospect_idx on public.outreach_log (prospect_id);

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger prospects_touch before update on public.prospects
  for each row execute function private.touch_updated_at();

alter table public.prospects enable row level security;
alter table public.prospect_suppressions enable row level security;
alter table public.outreach_log enable row level security;

create policy "prospects: staff only" on public.prospects for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "suppressions: staff only" on public.prospect_suppressions for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "outreach_log: staff only" on public.outreach_log for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- seed from the official DVSA active MOT station list already in the database
insert into public.prospects (partner_type, business_name, address, town, postcode, phone, source, mot_site_number)
select 'mot_station', s.trading_name, s.address, s.town, s.postcode, s.phone, 'dvsa_mot_list', s.site_number
from public.mot_stations s
where s.trading_name is not null
on conflict (mot_site_number) do nothing;
