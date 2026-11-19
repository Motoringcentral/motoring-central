-- Live MOT diary (19 Nov 2026)
-- Online MOT bookings take a slot in the garage's diary, and the garage's own bookings
-- (walk-ins, phone bookings, blocked time) close those times on the website.
-- Customers pay the legal maximum MOT fee for the class and nothing more: our booking fee is part of it.
-- The garage is paid the fee agreed with it at sign-up (partners.mot_agreed, set by staff on the admin page);
-- our share (maximum minus the garage's fee) includes VAT.
-- Garages can move an online booking when the customer asks; customer and garage get an email and a text
-- for every booking and every move (notifications outbox, sent by the 'notify' edge function).

alter table public.partners add column if not exists mot_agreed jsonb not null default '{}'::jsonb;
alter table public.bookings add column if not exists price_total numeric(10,2),
  add column if not exists our_share numeric(10,2),
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

-- outbox of confirmation emails and texts (sent by the 'notify' edge function; staff can read it)
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  booking_id uuid references public.bookings(id) on delete cascade,
  to_who text not null check (to_who in ('customer','garage')),
  channel text not null check (channel in ('email','sms')),
  to_addr text not null,
  subject text,
  body text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  error text,
  tries int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists notifications_queued on public.notifications(status, created_at);
create index if not exists notifications_booking on public.notifications(booking_id);
alter table public.notifications enable row level security;
drop policy if exists "notifications: staff read" on public.notifications;
create policy "notifications: staff read" on public.notifications for select to authenticated using ((select private.is_staff()));
revoke insert, update, delete, truncate on public.notifications from anon, authenticated;

create or replace function private.uk_mobile(p text) returns text language sql immutable set search_path = '' as $$
  select case when d ~ '^07[0-9]{9}$' then '+44' || substr(d, 2) when d ~ '^447[0-9]{9}$' then '+' || d else null end
  from (select regexp_replace(coalesce(p,''), '[^0-9]', '', 'g') d) x $$;

-- queue the email and text to the customer and the garage for a booking ('booked' or 'moved')
create or replace function private.queue_notes(p_booking uuid, p_what text) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bookings; g public.partners; cemail text; when_txt text; veh text; c_sub text; c_body text; g_sub text; g_body text;
begin
  select * into b from public.bookings where id = p_booking;
  if not found then return; end if;
  select * into g from public.partners where id = b.partner_id;
  select email into cemail from auth.users where id = b.customer_id;
  when_txt := to_char(b.slot_day, 'FMDay FMDD FMMonth') || ' at ' || to_char(make_time(b.slot_start/60, b.slot_start%60, 0), 'FMHH12:MI') || lower(to_char(make_time(b.slot_start/60, b.slot_start%60, 0), 'AM'));
  veh := coalesce(nullif(upper(b.vehicle->>'reg'),''), 'your vehicle');
  if p_what = 'moved' then
    c_sub := 'Your MOT has been moved: ' || when_txt;
    c_body := 'Hello ' || coalesce(split_part(b.customer_name,' ',1),'') || E',\n\nAs you asked, ' || coalesce(g.name,'the garage') || ' has moved your MOT for ' || veh || ' to ' || when_txt || E'.\n\nGarage: ' || coalesce(g.name,'') || ', ' || coalesce(g.town,'') || ', ' || coalesce(g.phone,'') || E'\nYou have already paid £' || to_char(b.price_total,'FM990.00') || E'. Nothing more to pay.\n\nIf you did not ask for this change, reply to this email or call us.\n\nThe Motoring Central';
    g_sub := 'MOT moved: ' || veh || ', now ' || when_txt;
    g_body := 'The online MOT for ' || veh || ' (' || coalesce(b.customer_name,'customer') || ', ' || coalesce(b.customer_phone,'') || ') is now on ' || when_txt || E' in your diary.\nYou are paid £' || to_char(b.partner_payout,'FM990.00') || E' for this test.\n\nThe Motoring Central';
  else
    c_sub := 'MOT booked: ' || when_txt || ' at ' || coalesce(g.name,'the garage');
    c_body := 'Hello ' || coalesce(split_part(b.customer_name,' ',1),'') || E',\n\nYour MOT for ' || veh || ' is booked for ' || when_txt || E'.\n\nGarage: ' || coalesce(g.name,'') || ', ' || coalesce(g.town,'') || ', ' || coalesce(g.phone,'') || E'\nPaid: £' || to_char(b.price_total,'FM990.00') || E' (nothing more to pay for the test).\nBooking reference: ' || upper(left(b.id::text, 8)) || E'\n\nPlease arrive a few minutes early and bring the vehicle''s V5C or reg. To move the booking, call the garage. To cancel, contact us.\n\nThe Motoring Central';
    g_sub := 'New MOT booked online: ' || when_txt || ', ' || veh;
    g_body := 'A customer has booked and paid for an MOT. It is already in your diary.' || E'\n\nWhen: ' || when_txt || E'\nVehicle: ' || veh || coalesce(' ' || nullif(trim(concat_ws(' ', b.vehicle->>'make', b.vehicle->>'model', b.vehicle->>'year')),''), '') || E'\nCustomer: ' || coalesce(b.customer_name,'') || ', ' || coalesce(b.customer_phone,'') || E'\nYou are paid: £' || to_char(b.partner_payout,'FM990.00') || E'\nReference: ' || upper(left(b.id::text, 8)) || E'\n\nThe Motoring Central';
  end if;
  if cemail is not null then insert into public.notifications(booking_id,to_who,channel,to_addr,subject,body) values (p_booking,'customer','email',cemail,c_sub,c_body); end if;
  if private.uk_mobile(b.customer_phone) is not null then insert into public.notifications(booking_id,to_who,channel,to_addr,body) values (p_booking,'customer','sms',private.uk_mobile(b.customer_phone),left(c_sub || '. ' || coalesce(g.name,'') || ' ' || coalesce(g.phone,'') || '. Ref ' || upper(left(b.id::text,8)) || '. The Motoring Central',600)); end if;
  if g.email is not null then insert into public.notifications(booking_id,to_who,channel,to_addr,subject,body) values (p_booking,'garage','email',g.email,g_sub,g_body); end if;
  if private.uk_mobile(g.phone) is not null then insert into public.notifications(booking_id,to_who,channel,to_addr,body) values (p_booking,'garage','sms',private.uk_mobile(g.phone),left(g_sub || '. ' || coalesce(b.customer_name,'') || ' ' || coalesce(b.customer_phone,'') || '. In your diary. The Motoring Central',600)); end if;
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

-- a customer books an MOT. Price = legal maximum for the class, with our booking fee included in it.
-- The slot is taken in the first free MOT bay, under a lock, so two people cannot book the same time.
create or replace function public.book_mot(p_partner uuid, p_day date, p_start int, p_class text, p_reg text,
  p_vehicle jsonb, p_label text, p_made_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.partners; prof public.profiles; bays text[]; bay text := null; b text;
  mx numeric; pay numeric; bid uuid; dur int := 60; at timestamptz; summ text;
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
       customer_name, customer_phone, price_total, our_share, partner_payout, paid, slot_day, slot_start)
  values (uid, 'MOT', 'MOT test', summ, p_vehicle, 'confirmed', coalesce(p_made_at, now()), p_partner, g.name,
       prof.name, prof.phone, mx, mx - pay, pay, true, p_day, p_start)
  returning id into bid;
  insert into public.diary_slots(partner_id, booking_id, day, bay_name, start_min, dur_min, kind)
  values (p_partner, bid, p_day, bay, p_start, dur, 'online');
  perform private.queue_notes(bid, 'booked');
  return jsonb_build_object('id', bid, 'bay', bay, 'total', mx, 'summary', summ);
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

-- the garage moves an online booking (when the customer asks). Checks the new time is free in that bay.
create or replace function public.move_online_booking(p_booking uuid, p_day date, p_start int, p_bay text, p_dur int default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); s public.diary_slots; d int;
begin
  select * into s from public.diary_slots where booking_id = p_booking and kind = 'online' and partner_id = uid;
  if not found then raise exception 'not_yours'; end if;
  d := coalesce(p_dur, s.dur_min);
  if p_day < current_date or p_day > current_date + 120 or p_start < 0 or p_start + d > 1440 or p_start % 15 <> 0 or d < 15 or d > 480
     or coalesce(length(p_bay),0) = 0 then raise exception 'bad_time'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || p_day::text, 0));
  if exists (select 1 from public.diary_slots x where x.partner_id = uid and x.day = p_day and x.bay_name = p_bay and x.id <> s.id
             and x.kind = 'online' and p_start < x.start_min + x.dur_min and x.start_min < p_start + d) then raise exception 'slot_taken'; end if;
  if s.day = p_day and s.start_min = p_start and s.bay_name = p_bay and s.dur_min = d then return jsonb_build_object('moved', false); end if;
  update public.diary_slots set day = p_day, start_min = p_start, bay_name = left(p_bay,40), dur_min = d where id = s.id;
  update public.bookings set slot_day = p_day, slot_start = p_start,
    summary = regexp_replace(summary, ', [A-Za-z]+ [0-9]+ [A-Za-z]+ at [0-9]{2}:[0-9]{2}', ', ' || to_char(p_day, 'FMDay FMDD Mon') || ' at ' || to_char(make_time(p_start/60, p_start%60, 0), 'HH24:MI'))
  where id = p_booking;
  if s.day <> p_day or s.start_min <> p_start then perform private.queue_notes(p_booking, 'moved'); end if;
  return jsonb_build_object('moved', true);
end $$;
revoke execute on function public.move_online_booking(uuid,date,int,text,int) from anon, public;
grant execute on function public.move_online_booking(uuid,date,int,text,int) to authenticated;

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
