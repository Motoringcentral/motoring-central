-- Quotes on the website for bodywork, alloy damage and auto electrician / locksmith jobs (21 Nov 2026)
-- The customer sends one request (with photos for bodywork) to up to 3 approved partners. Each partner replies with a
-- fixed price on their dashboard. The customer compares, accepts one and picks a day; that becomes a normal booking
-- (with our booking fee and the partner's plan fee). Contact details are shared only once a quote is accepted.

create table if not exists public.quote_jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('body','autoelec')),
  service text not null,
  summary text,
  vehicle jsonb,
  details jsonb not null default '{}'::jsonb,   -- {photos:[], where, post, insurer, claim}
  partner_ids uuid[] not null,
  status text not null default 'open' check (status in ('open','booked','closed')),
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.quote_offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.quote_jobs(id) on delete cascade,
  partner_id uuid not null default auth.uid() references public.partners(id) on delete cascade,
  partner_name text,
  price numeric(10,2) not null check (price > 0 and price < 20000),
  note text check (length(note) <= 800),
  days int check (days between 0 and 60),
  status text not null default 'sent' check (status in ('sent','accepted','not_chosen','withdrawn')),
  created_at timestamptz not null default now(),
  unique (job_id, partner_id)
);
alter table public.quote_jobs enable row level security;
alter table public.quote_offers enable row level security;

-- customers: send a request to 1 to 3 approved partners of the right trade
create or replace function private.quote_job_fill() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  new.customer_id := (select auth.uid());
  new.status := 'open'; new.booking_id := null;
  new.partner_ids := (select array_agg(distinct x) from unnest(new.partner_ids) x);
  if new.partner_ids is null or array_length(new.partner_ids,1) not between 1 and 3 then raise exception 'pick_1_to_3'; end if;
  select count(*) into n from public.partners p where p.id = any(new.partner_ids) and p.status = 'approved'
    and ((new.kind = 'body' and p.role = 'body') or (new.kind = 'autoelec' and p.role = 'mechanic' and p.sub = 'autoelec'));
  if n <> array_length(new.partner_ids,1) then raise exception 'bad_partner'; end if;
  new.service := left(new.service, 200); new.summary := left(coalesce(new.summary,''), 2000);
  return new;
end $$;
drop trigger if exists quote_job_fill on public.quote_jobs;
create trigger quote_job_fill before insert on public.quote_jobs for each row execute function private.quote_job_fill();

drop policy if exists "quote jobs: customer adds own" on public.quote_jobs;
create policy "quote jobs: customer adds own" on public.quote_jobs for insert to authenticated with check (customer_id = (select auth.uid()));
drop policy if exists "quote jobs: customer reads own" on public.quote_jobs;
create policy "quote jobs: customer reads own" on public.quote_jobs for select to authenticated
  using (customer_id = (select auth.uid()) or (select private.is_staff()));
grant select, insert on public.quote_jobs to authenticated;

drop policy if exists "quote offers: partner or the job's customer" on public.quote_offers;
create policy "quote offers: partner or the job's customer" on public.quote_offers for select to authenticated
  using (partner_id = (select auth.uid()) or exists (select 1 from public.quote_jobs j where j.id = job_id and j.customer_id = (select auth.uid())) or (select private.is_staff()));
grant select on public.quote_offers to authenticated;

-- partners: the requests sent to them, without the customer's contact details
create or replace function public.my_quote_jobs() returns table (id uuid, kind text, service text, summary text, vehicle jsonb,
  photos jsonb, place text, insurer text, first_name text, status text, created_at timestamptz,
  my_price numeric, my_note text, my_days int, my_status text, chosen boolean)
language sql stable security definer set search_path = '' as $$
  select j.id, j.kind, j.service, j.summary, j.vehicle, coalesce(j.details->'photos','[]'::jsonb),
    case when coalesce(j.details->>'where','') = 'mobile' then 'At the customer’s address' when coalesce(j.details->>'where','') = 'shop' then 'At your premises' else 'Mobile or at your premises' end
      || coalesce(', ' || nullif(split_part(upper(j.details->>'post'),' ',1),''), ''),
    nullif(j.details->>'insurer',''), private.first_name(p.name), j.status, j.created_at,
    o.price, o.note, o.days, o.status, (o.status = 'accepted')
  from public.quote_jobs j left join public.profiles p on p.id = j.customer_id
  left join public.quote_offers o on o.job_id = j.id and o.partner_id = (select auth.uid())
  where (select auth.uid()) = any(j.partner_ids) and j.created_at > now() - interval '60 days'
  order by j.created_at desc limit 100;
$$;
revoke all on function public.my_quote_jobs() from public, anon;
grant execute on function public.my_quote_jobs() to authenticated;

-- photos of a request can be opened by the partners it was sent to
create or replace function private.photo_for_partner(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bookings b where b.partner_id = (select auth.uid()) and b.details -> 'photos' ? p_name)
      or exists (select 1 from public.quote_jobs j where (select auth.uid()) = any(j.partner_ids) and j.details -> 'photos' ? p_name);
$$;

-- partners: send or change a fixed price
create or replace function public.send_quote(p_job uuid, p_price numeric, p_note text, p_days int) returns void
language plpgsql security definer set search_path = '' as $$
declare j public.quote_jobs; me public.partners;
begin
  select * into me from public.partners where id = (select auth.uid()) and status = 'approved';
  if not found then raise exception 'not_partner'; end if;
  select * into j from public.quote_jobs where id = p_job;
  if not found or not (me.id = any(j.partner_ids)) then raise exception 'not_yours'; end if;
  if j.status <> 'open' then raise exception 'closed'; end if;
  if p_price is null or p_price <= 0 or p_price >= 20000 then raise exception 'bad_price'; end if;
  insert into public.quote_offers as o (job_id, partner_id, partner_name, price, note, days)
  values (p_job, me.id, me.name, round(p_price, 2), left(nullif(btrim(coalesce(p_note,'')),''), 800), p_days)
  on conflict (job_id, partner_id) do update set price = excluded.price, note = excluded.note, days = excluded.days,
    partner_name = excluded.partner_name, status = 'sent', created_at = now() where o.status in ('sent','withdrawn');
  perform private.mail(private.user_email(j.customer_id), 'customer', 'New quote for your ' || lower(j.service) || ': £' || to_char(round(p_price,2), 'FM999,990.00'),
    'Hello ' || private.first_name((select name from public.profiles where id = j.customer_id)) || E',\n\n' || me.name || ' has sent you a fixed price of £' ||
    to_char(round(p_price,2), 'FM999,990.00') || ' for: ' || j.service || '.' || coalesce(E'\nTheir note: ' || nullif(btrim(coalesce(p_note,'')),''), '') ||
    E'\n\nOpen My account to compare quotes and book the one you want. Nothing is booked until you accept.\n\nThe Motoring Central',
    '/#account', 'quote_offer', 'qo:' || p_job || ':' || me.id || ':' || to_char(now(),'YYYYMMDDHH24'));
end $$;
revoke all on function public.send_quote(uuid, numeric, text, int) from public, anon;
grant execute on function public.send_quote(uuid, numeric, text, int) to authenticated;

-- customers: accept a quote and pick a day; this makes the booking
create or replace function public.accept_quote(p_offer uuid, p_day date, p_time text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare o public.quote_offers; j public.quote_jobs; g public.partners; rate numeric; fee numeric := 3; bid uuid; tl text := left(coalesce(nullif(btrim(p_time),''),'Any time'), 40);
begin
  select * into o from public.quote_offers where id = p_offer;
  if not found then raise exception 'not_found'; end if;
  select * into j from public.quote_jobs where id = o.job_id for update;
  if j.customer_id is distinct from (select auth.uid()) then raise exception 'not_yours'; end if;
  if j.status <> 'open' or o.status <> 'sent' then raise exception 'closed'; end if;
  if p_day is null or p_day < (now() at time zone 'Europe/London')::date or p_day > (now() at time zone 'Europe/London')::date + 60 then raise exception 'bad_day'; end if;
  select * into g from public.partners where id = o.partner_id and status = 'approved';
  if not found then raise exception 'partner_unavailable'; end if;
  rate := case when g.plan = 'pro' then 0 else 0.06 end;   -- Pay as you go: 5% + VAT; Pro: 0%
  insert into public.bookings (customer_id, kind, service, summary, vehicle, status, made_at, partner_id, partner_name,
    price_total, our_share, partner_payout, paid, slot_day, details)
  values (j.customer_id, case when j.kind = 'body' then 'Bodywork' else 'Auto electrics' end, j.service,
    'Booked: ' || j.service || coalesce(' on ' || nullif(upper(j.vehicle->>'reg'),''), '') || ' with ' || g.name || ', ' ||
      to_char(p_day, 'FMDay DD Month') || ' (' || tl || '). Fixed price £' || to_char(o.price, 'FM999,990.00') || ' plus £3.00 booking fee. ' ||
      coalesce(nullif(j.summary,''), ''),
    j.vehicle, 'confirmed', now(), g.id, g.name, o.price + fee, round(fee + o.price * rate, 2), round(o.price * (1 - rate), 2), false, p_day,
    j.details || jsonb_build_object('quote_job', j.id, 'quote_offer', o.id, 'time', tl))
  returning id into bid;
  update public.quote_jobs set status = 'booked', booking_id = bid where id = j.id;
  update public.quote_offers set status = case when id = o.id then 'accepted' else 'not_chosen' end where job_id = j.id;
  return bid;
end $$;
revoke all on function public.accept_quote(uuid, date, text) from public, anon;
grant execute on function public.accept_quote(uuid, date, text) to authenticated;

-- customers: close a request without booking
create or replace function public.close_quote_job(p_job uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.quote_jobs set status = 'closed' where id = p_job and customer_id = (select auth.uid()) and status = 'open';
  if not found then raise exception 'not_found'; end if;
  update public.quote_offers set status = 'not_chosen' where job_id = p_job and status = 'sent';
end $$;
revoke all on function public.close_quote_job(uuid) from public, anon;
grant execute on function public.close_quote_job(uuid) to authenticated;

-- emails: new request to each partner, and a copy for the customer
create or replace function private.mail_quote_job() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record; veh text := coalesce(nullif(upper(new.vehicle->>'reg'),''), 'a vehicle');
begin
  for r in select p.id, p.email, p.name from public.partners p where p.id = any(new.partner_ids) loop
    perform private.mail(r.email, 'partner', 'New quote request: ' || new.service || ', ' || veh,
      E'Hello,\n\nA customer has asked you for a fixed price through The Motoring Central.\n\nJob: ' || new.service ||
      coalesce(E'\nWhat they say: ' || nullif(new.summary,''), '') ||
      E'\n\nOpen your dashboard to see the details' || case when jsonb_array_length(coalesce(new.details->'photos','[]')) > 0 then ' and photos' else '' end ||
      E', and send your price. The customer sees up to 3 quotes and books the one they choose. Their contact details are shared when they book you.\n\nThe Motoring Central',
      '/#dashboard', 'quote_request_partner', 'qj:' || new.id || ':' || r.id);
  end loop;
  perform private.mail(private.user_email(new.customer_id), 'customer', 'Quote request sent: ' || new.service,
    'Hello ' || private.first_name((select name from public.profiles where id = new.customer_id)) || E',\n\nWe have sent your request for ' || lower(new.service) ||
    ' (' || veh || ') to ' || array_length(new.partner_ids,1) || ' partner' || case when array_length(new.partner_ids,1) = 1 then '' else 's' end ||
    E'. They usually reply within 24 hours with a fixed price.\n\nCompare the quotes in My account and book the one you want. Nothing is booked until you accept.\n\nThe Motoring Central',
    '/#account', 'quote_request_customer', 'qjc:' || new.id);
  return new;
exception when others then raise warning 'email not queued: %', sqlerrm; return new;
end $$;
drop trigger if exists quote_job_mail on public.quote_jobs;
create trigger quote_job_mail after insert on public.quote_jobs for each row execute function private.mail_quote_job();
