-- Live MOT diary (19 Nov 2026)
-- Online MOT bookings take a slot in the garage's diary, and the garage's own bookings
-- (walk-ins, phone bookings, blocked time) close those times on the website.
-- Customers pay the legal maximum MOT fee plus our booking fee; the garage is paid the fee
-- agreed with it at sign-up (partners.mot_agreed), set by staff on the admin page.

alter table public.partners add column if not exists mot_agreed jsonb not null default '{}'::jsonb;
alter table public.bookings add column if not exists price_total numeric(10,2),
  add column if not exists booking_fee numeric(10,2),
  add column if not exists partner_payout numeric(10,2),
  add column if not exists paid boolean not null default false,
  add column if not exists slot_day date,
  add column if not exists slot_start int;

create table if not exists public.diary_slots (
  id bigint generated always as identity primary key,
  partner_id uuid not null references public.partners(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  day date not null,
  bay_name text not null check (length(bay_name) <= 40),
  start_min int not null check (start_min between 0 and 1440),
  dur_min int not null check (dur_min between 15 and 720),
  kind text not null check (kind in ('online','own')),
  created_at timestamptz not null default now()
);
create index if not exists diary_slots_partner_day on public.diary_slots(partner_id, day);
create index if not exists diary_slots_booking on public.diary_slots(booking_id);
alter table public.diary_slots enable row level security;
drop policy if exists "diary: partner reads own, staff read all" on public.diary_slots;
create policy "diary: partner reads own, staff read all" on public.diary_slots for select to authenticated
  using (partner_id = (select auth.uid()) or (select private.is_staff()));
revoke insert, update, delete, truncate on public.diary_slots from anon, authenticated;

-- legal maximum MOT fee for each test type (DVSA). Keep in step with MCMOT in index.html.
create or replace function private.mot_max(p_class text) returns numeric language sql immutable set search_path = '' as $$
  select case p_class
    when '1' then 29.65 when '1-side' then 37.80 when '2' then 29.65 when '2-side' then 37.80 when '3' then 37.80
    when '4-car' then 54.85 when '4-goods' then 54.85 when '4-camper' then 54.85 when '4-taxi' then 54.85
    when '4-dual' then 54.85 when '4-trike' then 54.85 when '4-quad' then 54.85 when '4-9' then 57.30
    when '4a' then 64.00 when '5-13' then 59.55 when '5-17' then 80.65 when '5-play' then 80.65
    when '5a-13' then 80.50 when '5a-17' then 124.50 when '7' then 58.60 else null end::numeric $$;

-- names of a garage's MOT bays (same rule as bayNames() in the site's diary)
create or replace function private.mot_bays(d jsonb) returns text[] language plpgsql immutable set search_path = '' as $$
declare r text[] := '{}'; mb int; i int;
begin
  if jsonb_typeof(d->'bays') = 'array' then
    select coalesce(array_agg(x), '{}') into r from jsonb_array_elements_text(d->'bays') x where x ilike '%MOT%';
    return r;
  end if;
  mb := coalesce(nullif(d->>'motBays','')::int, case when (d->>'motOnly')::boolean then 1 else 0 end);
  if mb = 1 then return array['MOT bay']; end if;
  for i in 1..greatest(mb,0) loop r := r || ('MOT bay ' || i); end loop;
  return r;
exception when others then return '{}';
end $$;

-- busy times in a garage's diary (no customer details), for the booking page.
-- The last row (day null) only carries the garage's MOT bay names.
create or replace function public.garage_busy(p_partner uuid, p_from date, p_to date)
returns table(day date, bay_name text, start_min int, dur_min int, mot_bays text[])
language sql stable security definer set search_path = '' as $$
  select s.day, s.bay_name, s.start_min, s.dur_min, private.mot_bays(p.details)
  from public.partners p join public.diary_slots s on s.partner_id = p.id
  where p.id = p_partner and p.status = 'approved'
    and s.day between p_from and least(p_to, p_from + 62)
  union all
  select null::date, null::text, null::int, null::int, private.mot_bays(p.details)
  from public.partners p where p.id = p_partner and p.status = 'approved'
$$;
grant execute on function public.garage_busy(uuid, date, date) to anon, authenticated;

-- a customer books an MOT. Price = legal maximum for the class + £3.00 booking fee (incl. VAT).
-- The slot is taken in the first free MOT bay, under a lock, so two people cannot book the same time.
create or replace function public.book_mot(p_partner uuid, p_day date, p_start int, p_class text, p_reg text,
  p_vehicle jsonb, p_label text, p_made_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.partners; prof public.profiles; bays text[]; bay text := null; b text;
  mx numeric; fee numeric := 3.00; pay numeric; bid uuid; dur int := 60; at timestamptz; summ text;
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  select * into prof from public.profiles where id = uid;
  if not found then raise exception 'not_customer'; end if;
  select * into g from public.partners where id = p_partner and status = 'approved' and role = 'mechanic' and sub = 'garage';
  if not found then raise exception 'no_garage'; end if;
  mx := private.mot_max(p_class);
  if mx is null then raise exception 'bad_class'; end if;
  if jsonb_typeof(g.rates->'motc') = 'object' then
    if not (g.rates->'motc' ? p_class) then raise exception 'class_not_tested'; end if;
  elsif p_class not like '4-%' then raise exception 'class_not_tested'; end if;
  if p_start % 30 <> 0 or p_start < 480 or p_start + dur > 1080 or extract(dow from p_day) = 0 then raise exception 'bad_time'; end if;
  at := (p_day + make_interval(mins => p_start)) at time zone 'Europe/London';
  if at < now() + interval '1 hour' or p_day > current_date + 60 then raise exception 'bad_time'; end if;
  bays := private.mot_bays(g.details);
  if coalesce(array_length(bays,1),0) = 0 then raise exception 'no_mot_bay'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_partner::text || p_day::text, 0));
  foreach b in array bays loop
    if not exists (select 1 from public.diary_slots s where s.partner_id = p_partner and s.day = p_day and s.bay_name = b
                   and p_start < s.start_min + s.dur_min and s.start_min < p_start + dur) then bay := b; exit; end if;
  end loop;
  if bay is null then raise exception 'slot_taken'; end if;
  pay := least(mx, coalesce(nullif(g.mot_agreed->>p_class,'')::numeric, nullif(g.mot_agreed->>'all','')::numeric,
                             nullif(g.rates->'motc'->>p_class,'')::numeric, mx));
  summ := left(coalesce(nullif(p_label,''), 'MOT test') || ' at ' || coalesce(g.name,'the garage') || ', ' ||
          to_char(p_day, 'FMDay FMDD Mon') || ' at ' || to_char(make_time(p_start/60, p_start%60, 0), 'HH24:MI') ||
          coalesce('. Reg ' || nullif(upper(left(p_reg,10)),''), '') || '. Paid online.', 2000);
  insert into public.bookings(customer_id, kind, service, summary, vehicle, status, made_at, partner_id, partner_name,
       customer_name, customer_phone, price_total, booking_fee, partner_payout, paid, slot_day, slot_start)
  values (uid, 'MOT', 'MOT test', summ, p_vehicle, 'confirmed', coalesce(p_made_at, now()), p_partner, g.name,
       prof.name, prof.phone, mx + fee, fee, pay, true, p_day, p_start)
  returning id into bid;
  insert into public.diary_slots(partner_id, booking_id, day, bay_name, start_min, dur_min, kind)
  values (p_partner, bid, p_day, bay, p_start, dur, 'online');
  return jsonb_build_object('id', bid, 'bay', bay, 'total', mx + fee, 'summary', summ);
end $$;
revoke execute on function public.book_mot(uuid,date,int,text,text,jsonb,text,timestamptz) from anon, public;
grant execute on function public.book_mot(uuid,date,int,text,text,jsonb,text,timestamptz) to authenticated;

-- the garage's own bookings and blocked time close those times online (replaced in full on each save)
create or replace function public.sync_own_diary(p_entries jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); n int := 0; e jsonb;
begin
  if uid is null or not exists (select 1 from public.partners where id = uid) then raise exception 'not_partner'; end if;
  if jsonb_typeof(p_entries) <> 'array' then raise exception 'bad_input'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || 'own', 0));
  delete from public.diary_slots where partner_id = uid and kind = 'own';
  for e in select * from jsonb_array_elements(p_entries) limit 1500 loop
    begin
      if (e->>'day')::date between current_date - 1 and current_date + 120 then
        insert into public.diary_slots(partner_id, day, bay_name, start_min, dur_min, kind)
        values (uid, (e->>'day')::date, left(e->>'bay',40), (e->>'start')::int, (e->>'dur')::int, 'own');
        n := n + 1;
      end if;
    exception when others then null;
    end;
  end loop;
  return n;
end $$;
revoke execute on function public.sync_own_diary(jsonb) from anon, public;
grant execute on function public.sync_own_diary(jsonb) to authenticated;

-- online bookings shown in the garage's own diary, with the customer's details
create or replace function public.my_online_diary(p_from date) returns table(slot_id bigint, booking_id uuid, day date, bay_name text,
  start_min int, dur_min int, customer_name text, customer_phone text, vehicle jsonb, summary text, partner_payout numeric, status text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.booking_id, s.day, s.bay_name, s.start_min, s.dur_min, b.customer_name, b.customer_phone, b.vehicle, b.summary, b.partner_payout, b.status
  from public.diary_slots s join public.bookings b on b.id = s.booking_id
  where s.partner_id = (select auth.uid()) and s.kind = 'online' and s.day >= p_from and b.status <> 'cancelled'
  order by s.day, s.start_min limit 1000
$$;
revoke execute on function public.my_online_diary(date) from anon, public;
grant execute on function public.my_online_diary(date) to authenticated;
