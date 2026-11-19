-- MOT bay hours (19 Nov 2026): each garage sets, for up to 3 MOT bays, the days it tests, the first MOT,
-- the closing time and the time per MOT (30, 45 or 60 minutes). Stored in partners.details->'motSet',
-- keyed by bay name: {"MOT bay": {"days":[1,2,3,4,5,6], "open":480, "close":1080, "step":45}}
-- (days: 0 = Sunday ... 6 = Saturday; times in minutes after midnight). Defaults: Mon to Sat, 8am to 6pm, 1 hour.

create or replace function private.mot_bays(d jsonb) returns text[] language plpgsql immutable set search_path = '' as $$
declare r text[] := '{}'; mb int; i int;
begin
  if jsonb_typeof(d->'bays') = 'array' then
    select coalesce(array_agg(x order by o), '{}') into r
      from jsonb_array_elements_text(d->'bays') with ordinality as t(x, o) where x ilike '%MOT%';
    return r[1:3];
  end if;
  mb := least(3, coalesce(nullif(d->>'motBays','')::int, case when (d->>'motOnly')::boolean then 1 else 0 end));
  if mb = 1 then return array['MOT bay']; end if;
  for i in 1..greatest(mb,0) loop r := r || ('MOT bay ' || i); end loop;
  return r;
exception when others then return '{}';
end $$;

-- one MOT bay's settings, with defaults and safe limits
create or replace function private.mot_cfg(d jsonb, bay text, out days int[], out open_min int, out close_min int, out step int)
language plpgsql immutable set search_path = '' as $$
declare c jsonb := coalesce(d->'motSet'->bay, '{}'::jsonb);
begin
  begin
    if jsonb_typeof(c->'days') = 'array' then select coalesce(array_agg(x::int), '{}') into days from jsonb_array_elements_text(c->'days') x where x ~ '^[0-6]$';
    else days := array[1,2,3,4,5,6]; end if;
    open_min := coalesce(nullif(c->>'open','')::int, 480);
    close_min := coalesce(nullif(c->>'close','')::int, 1080);
    step := coalesce(nullif(c->>'step','')::int, 60);
  exception when others then days := array[1,2,3,4,5,6]; open_min := 480; close_min := 1080; step := 60;
  end;
  if step not in (30,45,60) then step := 60; end if;
  open_min := greatest(0, least(open_min, 1380)); close_min := greatest(open_min, least(close_min, 1440));
end $$;

drop function if exists public.garage_busy(uuid, date, date);
create function public.garage_busy(p_partner uuid, p_from date, p_to date)
returns table(day date, bay_name text, start_min int, dur_min int, mot_bays text[], mot_set jsonb)
language sql stable security definer set search_path = '' as $$
  select s.day, s.bay_name, s.start_min, s.dur_min, null::text[], null::jsonb
  from public.partners p join public.diary_slots s on s.partner_id = p.id
  where p.id = p_partner and p.status = 'approved'
    and s.day between p_from and least(p_to, p_from + 62)
  union all
  select null::date, null::text, null::int, null::int, private.mot_bays(p.details),
    (select coalesce(jsonb_object_agg(b, jsonb_build_object('days', to_jsonb(c.days), 'open', c.open_min, 'close', c.close_min, 'step', c.step)), '{}'::jsonb)
       from unnest(private.mot_bays(p.details)) b, lateral private.mot_cfg(p.details, b) c)
  from public.partners p where p.id = p_partner and p.status = 'approved'
$$;
grant execute on function public.garage_busy(uuid, date, date) to anon, authenticated;

create or replace function public.book_mot(p_partner uuid, p_day date, p_start int, p_class text, p_reg text,
  p_vehicle jsonb, p_label text, p_made_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.partners; prof public.profiles; bays text[]; bay text := null; b text;
  mx numeric; pay numeric; bid uuid; dur int; at timestamptz; summ text; c record; any_open boolean := false;
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
  at := (p_day + make_interval(mins => p_start)) at time zone 'Europe/London';
  if at < now() + interval '1 hour' or p_day > current_date + 60 then raise exception 'bad_time'; end if;
  bays := private.mot_bays(g.details);
  if coalesce(array_length(bays,1),0) = 0 then raise exception 'no_mot_bay'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_partner::text || p_day::text, 0));
  foreach b in array bays loop
    select * into c from private.mot_cfg(g.details, b);
    -- the bay must test on that day, and the time must be one of its MOT slots
    if not (extract(dow from p_day)::int = any(c.days)) or p_start < c.open_min or p_start + c.step > c.close_min
       or (p_start - c.open_min) % c.step <> 0 then continue; end if;
    any_open := true;
    if not exists (select 1 from public.diary_slots s where s.partner_id = p_partner and s.day = p_day and s.bay_name = b
                   and p_start < s.start_min + s.dur_min and s.start_min < p_start + c.step) then bay := b; dur := c.step; exit; end if;
  end loop;
  if not any_open then raise exception 'bad_time'; end if;
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
