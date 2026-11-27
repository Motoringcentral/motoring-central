-- BUSINESS ACCOUNTS (27 Nov 2026), part 1 of 3: tables, the money ledger and helpers.
--
-- A business (plumber, courier, builder...) opens one account, adds its team and its vehicles, and books valets,
-- alloy refurbs and MOTs on the account. It pays in one of two ways, never on credit:
--   * prepaid balance: the business tops up (bank transfer now; card once Stripe is on). A booking HOLDS the money
--     straight away, the hold is TAKEN when the partner marks the job done, and GIVEN BACK if it is cancelled.
--   * card on file (needs Stripe): the card is charged when the booking is made.
-- So every business job is paid for before the partner is paid in the weekly payout.
--
-- Security model:
--   * Every business table has row level security ON and NO policies: nobody can read or write them directly.
--     Everything goes through the functions below, which check who is asking and what their role allows.
--   * Prices are worked out on the server from the partner's own rates. Nothing the page sends is trusted.
--   * The ledger can only be added to. Changing or deleting a line is refused, and each line carries a hash of the
--     line before it, so any tampering breaks the chain (checked by private.biz_ledger_ok).
--   * Each booking request has an idempotency key, and the account row is locked while money moves, so a double tap
--     or two people booking at once can never spend the same money twice.

create sequence if not exists private.biz_account_no;
create sequence if not exists private.biz_job_no;

create table public.business_accounts (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('BA-' || lpad(nextval('private.biz_account_no')::text, 5, '0')),
  name text not null check (length(btrim(name)) between 2 and 160),
  kind text not null default 'company' check (kind in ('company','sole_trader','partnership','charity','other')),
  company_no text check (company_no is null or company_no ~ '^[A-Z0-9]{8}$'),
  vat_no text check (vat_no is null or vat_no ~ '^(GB)?[0-9]{9}([0-9]{3})?$'),
  billing_email text not null check (billing_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or length(phone) <= 30),
  address text check (address is null or length(address) <= 300),
  postcode text check (postcode is null or postcode ~ '^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$'),
  fleet_size int check (fleet_size is null or fleet_size between 1 and 5000),
  status text not null default 'pending' check (status in ('pending','approved','declined','suspended','closed')),
  -- spending controls (set by the account's owners and admins)
  approval_over numeric(10,2) check (approval_over is null or approval_over between 0 and 100000),  -- bookers need approval above this
  monthly_cap numeric(10,2) check (monthly_cap is null or monthly_cap between 1 and 1000000),         -- whole account, per calendar month
  fleet_only boolean not null default true,                                                          -- only vehicles on the fleet list
  services text[] not null default array['Valet','Alloy wheels','MOT'],
  low_balance numeric(10,2) not null default 100 check (low_balance between 0 and 100000),
  -- emergency stop
  frozen boolean not null default false,
  frozen_at timestamptz, frozen_by uuid, frozen_reason text,
  created_by uuid not null references auth.users(id),
  reviewed_by uuid, reviewed_at timestamptz, review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.business_accounts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name text check (name is null or length(name) <= 120),
  role text not null check (role in ('owner','admin','booker','viewer')),
  monthly_limit numeric(10,2) check (monthly_limit is null or monthly_limit between 1 and 1000000),
  status text not null default 'invited' check (status in ('invited','active','removed')),
  invite_hash text unique,
  invite_expires timestamptz,
  invited_by uuid,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (account_id, email)
);
create index on public.business_members (user_id) where status = 'active';

create table public.business_vehicles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.business_accounts(id) on delete cascade,
  reg text not null check (reg ~ '^[A-Z0-9]{2,8}$'),
  nickname text check (nickname is null or length(nickname) <= 60),
  make text check (make is null or length(make) <= 40),
  model text check (model is null or length(model) <= 60),
  colour text check (colour is null or length(colour) <= 30),
  size smallint not null default 3 check (size between 0 and 3),           -- valet size: 0 small .. 3 extra large or van
  mot_class text not null default '4-goods',
  mot_due date, tax_due date,
  driver text check (driver is null or length(driver) <= 80),
  active boolean not null default true,
  added_by uuid,
  created_at timestamptz not null default now()
);
create unique index business_vehicles_one_reg on public.business_vehicles (account_id, reg) where active;

create table public.business_cards (               -- card on file; written only by the payments function (Stripe)
  account_id uuid primary key references public.business_accounts(id) on delete cascade,
  stripe_customer text not null,
  stripe_pm text,
  brand text, last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'), exp_month int, exp_year int,
  status text not null default 'none' check (status in ('none','active','removed')),
  added_by uuid, added_at timestamptz
);

create table public.business_topups (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.business_accounts(id) on delete cascade,
  ref text not null unique,                                            -- the bank transfer reference, e.g. TMC-7K3QX9AB
  method text not null check (method in ('bank','card')),
  amount numeric(10,2) not null check (amount between 1 and 20000),
  received numeric(10,2),
  status text not null default 'pending' check (status in ('pending','credited','cancelled','expired')),
  stripe_session text unique,
  requested_by uuid not null,
  credited_by uuid, credited_at timestamptz, note text,
  created_at timestamptz not null default now()
);

create table public.business_schedules (            -- repeat valets, booked automatically 7 days ahead
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.business_accounts(id) on delete cascade,
  partner_id uuid not null references public.partners(id),
  vehicle_ids uuid[] not null check (cardinality(vehicle_ids) between 1 and 50),
  every_weeks int not null check (every_weeks in (1,2,4)),
  time_label text not null check (length(time_label) between 2 and 40),
  place text not null check (place in ('mobile','premises')),
  address text check (address is null or length(address) <= 300),
  postcode text,
  next_day date not null,
  po text check (po is null or length(po) <= 40),
  active boolean not null default true,
  created_by uuid not null,
  last_run timestamptz, last_result text,
  created_at timestamptz not null default now()
);

create table public.business_jobs (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('BJ-' || lpad(nextval('private.biz_job_no')::text, 6, '0')),
  account_id uuid not null references public.business_accounts(id) on delete cascade,
  kind text not null check (kind in ('Valet','Alloy wheels','MOT')),
  vehicle_id uuid references public.business_vehicles(id),
  reg text not null,
  params jsonb not null,                    -- what was asked for (checked again when the booking is made)
  price numeric(10,2) not null,             -- the partner's price
  fee numeric(10,2) not null,               -- our booking fee (0 for MOT)
  total numeric(10,2) not null check (total > 0),
  pay_method text not null check (pay_method in ('wallet','card')),
  status text not null check (status in ('awaiting_approval','awaiting_card','booked','declined','cancelled','failed','expired')),
  booking_id uuid unique references public.bookings(id),
  booked_by uuid not null,
  approved_by uuid, approved_at timestamptz, decline_reason text,
  card_until timestamptz, stripe_pi text unique,
  po text check (po is null or length(po) <= 40),
  note text check (note is null or length(note) <= 500),
  schedule_id uuid references public.business_schedules(id) on delete set null,
  idem text not null check (length(idem) between 8 and 80),
  fail_reason text,
  created_at timestamptz not null default now(),
  unique (account_id, idem)
);
create index on public.business_jobs (account_id, created_at desc);
create index on public.business_jobs (booked_by, created_at desc);

-- The money ledger. d_available: change to the money the business can spend. d_held: change to money set aside for
-- booked jobs. top up (+x, 0) | hold (-x, +x) | release (+x, -x) | take (0, -x) | adjust (+/-x, 0)
create table public.business_ledger (
  id bigserial primary key,
  account_id uuid not null references public.business_accounts(id),
  at timestamptz not null default now(),
  kind text not null check (kind in ('topup','hold','release','take','adjust')),
  d_available numeric(12,2) not null,
  d_held numeric(12,2) not null,
  job_id uuid references public.business_jobs(id),
  topup_id uuid references public.business_topups(id),
  booking_id uuid,
  note text,
  by_user uuid,
  prev_hash text,
  hash text not null
);
create index on public.business_ledger (account_id, id);
-- a job can be held once, released once and taken once: money can never move twice for the same job
create unique index business_ledger_once on public.business_ledger (job_id, kind) where job_id is not null;
create unique index business_ledger_topup_once on public.business_ledger (topup_id) where topup_id is not null;

create table public.business_audit (
  id bigserial primary key,
  account_id uuid not null references public.business_accounts(id) on delete cascade,
  at timestamptz not null default now(),
  by_user uuid,
  action text not null,
  detail jsonb not null default '{}'
);
create index on public.business_audit (account_id, id desc);

-- Lock everything down: RLS on, no policies, no direct table rights for the website's roles.
do $$ declare t text; begin
  foreach t in array array['business_accounts','business_members','business_vehicles','business_cards','business_topups',
                           'business_schedules','business_jobs','business_ledger','business_audit'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on sequence private.biz_account_no, private.biz_job_no from public;

-- The ledger is add-only and chained.
create or replace function private.biz_ledger_chain() returns trigger
language plpgsql security definer set search_path = '' as $$
declare prev text;
begin
  perform pg_advisory_xact_lock(hashtextextended('bizledger:' || new.account_id::text, 0));
  select l.hash into prev from public.business_ledger l where l.account_id = new.account_id order by l.id desc limit 1;
  new.at := now();
  new.prev_hash := prev;
  new.hash := encode(extensions.digest(concat_ws('|', coalesce(prev,'start'), new.id, new.account_id, new.kind,
    to_char(new.d_available,'FM9999999990.00'), to_char(new.d_held,'FM9999999990.00'), new.job_id, new.topup_id,
    new.booking_id, new.note, new.by_user, to_char(new.at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')), 'sha256'), 'hex');
  return new;
end $$;
create trigger business_ledger_chain before insert on public.business_ledger for each row execute function private.biz_ledger_chain();

create or replace function private.biz_ledger_locked() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'ledger_is_add_only'; end $$;
create trigger business_ledger_no_change before update or delete on public.business_ledger for each row execute function private.biz_ledger_locked();
create trigger business_ledger_no_truncate before truncate on public.business_ledger for each statement execute function private.biz_ledger_locked();
create trigger business_audit_no_change before update or delete on public.business_audit for each row execute function private.biz_ledger_locked();

create trigger business_accounts_touch before update on public.business_accounts for each row execute function private.touch_updated_at();

-- Checks the whole chain for one account (true = untouched).
create or replace function private.biz_ledger_ok(p_account uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare r public.business_ledger; prev text := null; h text;
begin
  for r in select * from public.business_ledger where account_id = p_account order by id loop
    if r.prev_hash is distinct from prev then return false; end if;
    h := encode(extensions.digest(concat_ws('|', coalesce(prev,'start'), r.id, r.account_id, r.kind,
      to_char(r.d_available,'FM9999999990.00'), to_char(r.d_held,'FM9999999990.00'), r.job_id, r.topup_id,
      r.booking_id, r.note, r.by_user, to_char(r.at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')), 'sha256'), 'hex');
    if h <> r.hash then return false; end if;
    prev := r.hash;
  end loop;
  return true;
end $$;

-- Money helpers. All callers lock the account row first (select ... for update).
create or replace function private.biz_balance(p_account uuid, out available numeric, out held numeric)
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(d_available),0), coalesce(sum(d_held),0) from public.business_ledger where account_id = p_account
$$;

create or replace function private.biz_move(p_account uuid, p_kind text, p_amount numeric, p_job uuid, p_topup uuid,
  p_booking uuid, p_note text, p_by uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare b record; da numeric; dh numeric;
begin
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then raise exception 'bad_amount'; end if;
  if p_kind = 'topup' then da := p_amount; dh := 0;
  elsif p_kind = 'hold' then da := -p_amount; dh := p_amount;
  elsif p_kind = 'release' then da := p_amount; dh := -p_amount;
  elsif p_kind = 'take' then da := 0; dh := -p_amount;
  elsif p_kind = 'adjust_in' then p_kind := 'adjust'; da := p_amount; dh := 0;
  elsif p_kind = 'adjust_out' then p_kind := 'adjust'; da := -p_amount; dh := 0;
  else raise exception 'bad_kind'; end if;
  select * into b from private.biz_balance(p_account);
  if b.available + da < 0 then raise exception 'not_enough_balance'; end if;
  if b.held + dh < 0 then raise exception 'ledger_mismatch'; end if;
  insert into public.business_ledger (account_id, kind, d_available, d_held, job_id, topup_id, booking_id, note, by_user)
  values (p_account, p_kind, da, dh, p_job, p_topup, p_booking, left(p_note, 300), p_by);
end $$;

create or replace function private.biz_rank(p_role text) returns int language sql immutable set search_path = '' as $$
  select case p_role when 'owner' then 4 when 'admin' then 3 when 'booker' then 2 when 'viewer' then 1 else 0 end
$$;

-- The caller's role on an account (null if not an active member).
create or replace function private.biz_role(p_account uuid, p_user uuid default null) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.business_members m
  where m.account_id = p_account and m.user_id = coalesce(p_user, (select auth.uid())) and m.status = 'active'
$$;

-- Raises unless the caller has at least p_min on the account. Returns the role.
create or replace function private.biz_need(p_account uuid, p_min text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare r text;
begin
  if (select auth.uid()) is null then raise exception 'not_logged_in'; end if;
  r := private.biz_role(p_account);
  if r is null or private.biz_rank(r) < private.biz_rank(p_min) then raise exception 'not_allowed'; end if;
  return r;
end $$;

create or replace function private.biz_log(p_account uuid, p_action text, p_detail jsonb default '{}', p_by uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.business_audit (account_id, by_user, action, detail)
  values (p_account, coalesce(p_by, (select auth.uid())), left(p_action, 60), coalesce(p_detail, '{}'::jsonb))
$$;

-- Email the account's owners and admins (and the billing address when asked).
create or replace function private.biz_mail_admins(p_account uuid, p_subject text, p_body text, p_ref text default null, p_billing boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.business_accounts; r record; sent text[] := '{}';
begin
  select * into a from public.business_accounts where id = p_account;
  if not found then return; end if;
  for r in select coalesce(u.email, m.email) em from public.business_members m left join auth.users u on u.id = m.user_id
           where m.account_id = p_account and m.status = 'active' and m.role in ('owner','admin') loop
    if not (lower(r.em) = any(sent)) then
      perform private.mail(r.em, 'business', p_subject, E'Hello,\n\n' || p_body || E'\n\nAccount: ' || a.name || ' (' || a.ref || E')\n\nThe Motoring Central',
        '/business.html', 'business', case when p_ref is null then null else p_ref || ':' || lower(r.em) end);
      sent := sent || lower(r.em);
    end if;
  end loop;
  if p_billing and not (lower(a.billing_email) = any(sent)) then
    perform private.mail(a.billing_email, 'business', p_subject, E'Hello,\n\n' || p_body || E'\n\nAccount: ' || a.name || ' (' || a.ref || E')\n\nThe Motoring Central',
      '/business.html', 'business', case when p_ref is null then null else p_ref || ':' || lower(a.billing_email) end);
  end if;
end $$;

create or replace function private.biz_money(p numeric) returns text language sql immutable set search_path = '' as $$
  select '£' || to_char(coalesce(p,0), 'FM999,999,990.00')
$$;

create or replace function private.biz_setting(p_key text, p_default numeric) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select nullif(s.value->>p_key,'')::numeric from public.app_settings s where s.key = 'business'), p_default)
$$;
insert into public.app_settings (key, value) values ('business', jsonb_build_object(
  'fee', 9.99,          -- booking fee per valet / alloy job, including VAT (MOTs have none)
  'min_topup', 50, 'max_topup', 10000,
  'max_per_hour', 15,   -- bookings one person can make in an hour before the account is frozen
  'max_per_day', 60,    -- bookings a whole account can make in a day before it is frozen
  'bank', jsonb_build_object('name', '', 'sort_code', '', 'account_no', '')))
on conflict (key) do nothing;

-- Spend this calendar month (London), for the whole account or one person. Counts everything not declined,
-- cancelled, failed or expired.
create or replace function private.biz_month_spend(p_account uuid, p_user uuid default null) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(j.total), 0) from public.business_jobs j
  where j.account_id = p_account and (p_user is null or j.booked_by = p_user)
    and j.status in ('awaiting_approval','awaiting_card','booked')
    and date_trunc('month', j.created_at at time zone 'Europe/London') = date_trunc('month', now() at time zone 'Europe/London')
$$;

create or replace function private.biz_reg(p text) returns text language sql immutable set search_path = '' as $$
  select nullif(upper(regexp_replace(coalesce(p,''), '[^A-Za-z0-9]', '', 'g')), '')
$$;
create or replace function private.biz_pc(p text) returns text language sql immutable set search_path = '' as $$
  select case when x ~ '^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$' then left(x, length(x)-3) || ' ' || right(x, 3) end
  from (select upper(regexp_replace(coalesce(p,''), '\s', '', 'g')) x) s
$$;
