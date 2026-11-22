-- Driving instructors (22 Nov 2026): a new partner type, lessons booked into a live diary, blocks of hours and intensive
-- courses. Our fee is 10% + VAT of each lesson's value (12%); the learner pays no booking fee.
-- An instructor's settings live in partners.details.inst:
--   trans ['manual','auto'], gender 'male'|'female'|'none', badge 'adi'|'pdi', adi (number), car, bio, lat, lng,
--   lens [60,90,120] (lesson lengths in minutes), blocks [{h,pct}], intensive [{name,hours,price,trans}],
--   week [[from,to]|null x 7, Sunday first], gap (minutes between lessons), notice (hours), on (taking bookings)
-- and partners.rates {manual, auto} (price per hour). details.post / details.radius are the base and miles covered.
alter table public.partners drop constraint if exists partners_role_check;
alter table public.partners add constraint partners_role_check
  check (role = any (array['mechanic','recovery','evcharge','body','tyres','valet','dealer','instructor']));
do $$
declare d text;
begin
  d := pg_get_functiondef('public.handle_new_user'::regproc);
  if position('''instructor''' in d) = 0 then
    d := replace(d, '(''mechanic'',''recovery'',''evcharge'',''body'',''tyres'',''valet'',''dealer'')', '(''mechanic'',''recovery'',''evcharge'',''body'',''tyres'',''valet'',''dealer'',''instructor'')');
    if position('''instructor''' in d) = 0 then raise exception 'handle_new_user: role list not found'; end if;
    execute d;
  end if;
  d := pg_get_functiondef('private.role_label'::regproc);
  if position('driving instructor' in d) = 0 then
    d := replace(d, 'when p_role = ''dealer'' then ''dealer''', 'when p_role = ''dealer'' then ''dealer''' || E'\n    when p_role = ''instructor'' then ''driving instructor''');
    execute d;
  end if;
end $$;

create table if not exists public.lesson_packs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  kind text not null check (kind in ('block','intensive')),
  title text not null check (char_length(title) <= 120),
  trans text not null check (trans in ('manual','auto')),
  hours_total numeric(5,1) not null check (hours_total > 0),
  hours_booked numeric(5,1) not null default 0 check (hours_booked >= 0),
  price_total numeric(10,2) not null check (price_total >= 0),
  paid_ref text, status text not null default 'active' check (status in ('active','refunded','closed')),
  created_at timestamptz not null default now()
);
create index if not exists lesson_packs_customer on public.lesson_packs (customer_id, created_at desc);
create index if not exists lesson_packs_partner on public.lesson_packs (partner_id, created_at desc);
alter table public.lesson_packs enable row level security;
drop policy if exists "lesson packs: learner, instructor, staff read" on public.lesson_packs;
create policy "lesson packs: learner, instructor, staff read" on public.lesson_packs for select to authenticated
  using (customer_id = (select auth.uid()) or partner_id = (select auth.uid()) or (select private.is_staff()));
revoke all on public.lesson_packs from anon; grant select on public.lesson_packs to authenticated;

create or replace function private.hm(t text) returns int language sql immutable set search_path = '' as
$$ select case when t ~ '^\d{1,2}:\d{2}$' then split_part(t,':',1)::int * 60 + split_part(t,':',2)::int else null end $$;

-- is this start time free for a lesson of p_len minutes? (inside the day's hours, enough notice, no clash with gap)
create or replace function private.lesson_free(g public.partners, p_day date, p_start int, p_len int) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare inst jsonb := g.details->'inst'; w jsonb; o int; c int; gap int; notice int; at timestamptz;
begin
  if inst is null or coalesce(inst->>'on','true') = 'false' then return false; end if;
  w := inst->'week'->(extract(dow from p_day)::int);
  if w is null or jsonb_typeof(w) <> 'array' then return false; end if;
  o := private.hm(w->>0); c := private.hm(w->>1);
  if o is null or c is null or p_start < o or p_start + p_len > c then return false; end if;
  gap := least(120, greatest(0, coalesce((inst->>'gap')::int, 0)));
  notice := least(168, greatest(1, coalesce((inst->>'notice')::int, 24)));
  at := (p_day + make_interval(mins => p_start)) at time zone 'Europe/London';
  if at < now() + make_interval(hours => notice) or p_day > (now() at time zone 'Europe/London')::date + 60 then return false; end if;
  return not exists (select 1 from public.diary_slots s where s.partner_id = g.id and s.day = p_day
                     and p_start < s.start_min + s.dur_min + gap and s.start_min < p_start + p_len + gap);
end $$;

-- instructors near a place, for the learner's search (no sign-in needed; only what a learner should see)
create or replace function public.find_instructors(p_lat double precision, p_lng double precision, p_trans text, p_gender text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by miles), '[]'::jsonb) from (
    select q.miles, jsonb_build_object('id', q.id, 'name', q.name, 'town', q.town, 'gender', q.inst->>'gender', 'badge', q.inst->>'badge',
      'trans', q.inst->'trans', 'rates', q.rates, 'lens', q.inst->'lens', 'blocks', q.inst->'blocks', 'intensive', q.inst->'intensive',
      'car', q.inst->>'car', 'bio', q.inst->>'bio', 'miles', round(q.miles::numeric, 0)) x
    from (select p.id, p.name, p.town, p.rates, p.details, p.details->'inst' inst,
            3958.8 * 2 * asin(sqrt(power(sin(radians(((p.details->'inst'->>'lat')::float8 - p_lat) / 2)), 2) +
              cos(radians(p_lat)) * cos(radians((p.details->'inst'->>'lat')::float8)) * power(sin(radians(((p.details->'inst'->>'lng')::float8 - p_lng) / 2)), 2))) * 1.2 miles
          from public.partners p
          where p.role = 'instructor' and p.status = 'approved' and jsonb_typeof(p.details->'inst') = 'object'
            and (p.details->'inst'->>'lat') is not null and coalesce(p.details->'inst'->>'on', 'true') <> 'false') q
    where q.miles <= least(100, greatest(1, coalesce(nullif(regexp_replace(coalesce(q.details->>'radius',''), '\D', '', 'g'), '')::int, 10)))
      and (p_trans not in ('manual','auto') or q.inst->'trans' ? p_trans)
      and (p_trans not in ('manual','auto') or coalesce((q.rates->>p_trans)::numeric, 0) > 0)
      and (p_gender not in ('male','female') or q.inst->>'gender' = p_gender)
  ) z $$;
grant execute on function public.find_instructors(double precision, double precision, text, text) to anon, authenticated;

-- free start times for the next days, straight from the instructor's live diary
create or replace function public.lesson_slots(p_partner uuid, p_from date, p_days int, p_len int)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare g public.partners; out jsonb := '[]'::jsonb; d date; s int; arr jsonb; n int := least(21, greatest(1, coalesce(p_days, 14)));
        d0 date := greatest(coalesce(p_from, current_date), (now() at time zone 'Europe/London')::date);
begin
  select * into g from public.partners where id = p_partner and role = 'instructor' and status = 'approved';
  if not found or p_len not in (60, 90, 120) then return out; end if;
  for i in 0 .. n - 1 loop
    d := d0 + i; arr := '[]'::jsonb; s := 6 * 60;
    while s <= 22 * 60 loop
      if private.lesson_free(g, d, s, p_len) then arr := arr || to_jsonb(s); end if;
      s := s + 30;
    end loop;
    if jsonb_array_length(arr) > 0 then out := out || jsonb_build_object('day', d, 'starts', arr); end if;
  end loop;
  return out;
end $$;
grant execute on function public.lesson_slots(uuid, date, int, int) to anon, authenticated;

-- book a lesson: a single lesson, the first lesson of a block or intensive course (which is paid for in full now),
-- or another lesson from hours already paid for (mode 'pack')
create or replace function public.book_lesson(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); prof public.profiles; g public.partners; inst jsonb; mode text := p->>'mode'; trans text := p->>'trans';
  len int := (p->>'len')::int; d date := (p->>'day')::date; st int := (p->>'start')::int; rate numeric; hrs numeric; val numeric; pay numeric := 0;
  pk public.lesson_packs; x jsonb; pct numeric; bid uuid; title text; summ text; left_h numeric; share numeric;
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  select * into prof from public.profiles where id = uid; if not found then raise exception 'not_customer'; end if;
  select * into g from public.partners where id = (p->>'partner')::uuid and role = 'instructor' and status = 'approved';
  if not found then raise exception 'no_instructor'; end if;
  inst := g.details->'inst';
  if len is null or not (inst->'lens' @> to_jsonb(len)) or len not in (60, 90, 120) then raise exception 'bad_length'; end if;
  hrs := len / 60.0;
  perform pg_advisory_xact_lock(hashtextextended(g.id::text || d::text, 0));
  if not private.lesson_free(g, d, st, len) then raise exception 'slot_taken'; end if;
  if mode = 'pack' then
    select * into pk from public.lesson_packs where id = (p->>'pack')::uuid and customer_id = uid and partner_id = g.id and status = 'active' for update;
    if not found then raise exception 'no_pack'; end if;
    if pk.hours_total - pk.hours_booked < hrs then raise exception 'not_enough_hours'; end if;
    trans := pk.trans; val := round(pk.price_total * hrs / pk.hours_total, 2);
    update public.lesson_packs set hours_booked = hours_booked + hrs where id = pk.id;
  else
    if trans not in ('manual','auto') or not (inst->'trans' ? trans) then raise exception 'bad_trans'; end if;
    rate := coalesce((g.rates->>trans)::numeric, 0); if rate <= 0 then raise exception 'no_rate'; end if;
    if coalesce(btrim(p->>'paid'), '') = '' then raise exception 'not_paid'; end if;
    if mode = 'single' then val := round(rate * hrs, 2); pay := val;
    elsif mode = 'block' then
      select b into x from jsonb_array_elements(coalesce(inst->'blocks','[]'::jsonb)) b where (b->>'h')::numeric = (p->>'block_h')::numeric limit 1;
      if x is null then raise exception 'no_block'; end if;
      pct := least(50, greatest(0, coalesce((x->>'pct')::numeric, 0)));
      pay := round(rate * (x->>'h')::numeric * (1 - pct / 100), 2);
      title := (x->>'h') || ' hours of lessons';
      insert into public.lesson_packs (customer_id, partner_id, kind, title, trans, hours_total, hours_booked, price_total, paid_ref)
        values (uid, g.id, 'block', title, trans, (x->>'h')::numeric, hrs, pay, left(p->>'paid', 100)) returning * into pk;
      val := round(pay * hrs / pk.hours_total, 2);
    elsif mode = 'intensive' then
      x := inst->'intensive'->((p->>'course')::int);
      if x is null or jsonb_typeof(x) <> 'object' then raise exception 'no_course'; end if;
      if coalesce(x->>'trans','') in ('manual','auto') and x->>'trans' <> trans then raise exception 'bad_trans'; end if;
      pay := round((x->>'price')::numeric, 2); if pay <= 0 or (x->>'hours')::numeric < hrs then raise exception 'no_course'; end if;
      title := left(coalesce(nullif(x->>'name',''), 'Intensive course'), 100) || ' (' || (x->>'hours') || ' hours)';
      insert into public.lesson_packs (customer_id, partner_id, kind, title, trans, hours_total, hours_booked, price_total, paid_ref)
        values (uid, g.id, 'intensive', title, trans, (x->>'hours')::numeric, hrs, pay, left(p->>'paid', 100)) returning * into pk;
      val := round(pay * hrs / pk.hours_total, 2);
    else raise exception 'bad_mode'; end if;
  end if;
  share := round(val * 0.12, 2);   -- our fee: 10% + VAT of the lesson's value
  left_h := case when pk.id is null then null else pk.hours_total - (case when mode = 'pack' then pk.hours_booked + hrs else pk.hours_booked end) end;
  summ := 'Driving lesson (' || case trans when 'auto' then 'automatic' else 'manual' end || ', ' ||
    case len when 60 then '1 hour' when 90 then '1 hour 30 minutes' else '2 hours' end || ') with ' || g.name || ' on ' ||
    to_char(d, 'FMDay FMDD FMMonth') || ' at ' || to_char(make_time(st / 60, st % 60, 0), 'HH24:MI') || '. Pick-up: ' ||
    left(coalesce(nullif(btrim(p->>'pickup'), ''), 'to be agreed'), 200) || coalesce(' ' || upper(left(nullif(btrim(p->>'pc'), ''), 9)), '') || '.' ||
    case when pk.id is not null then ' Part of: ' || pk.title || ' (' || trim(to_char(left_h, 'FM990.0')) || ' hours left to book).' else '' end;
  insert into public.bookings (customer_id, kind, service, summary, status, made_at, partner_id, partner_name, customer_name, customer_phone,
      price_total, our_share, partner_payout, paid, slot_day, slot_start, details)
    values (uid, 'Driving lesson', 'Driving lesson', left(summ, 2000), 'confirmed', now(), g.id, g.name, prof.name, prof.phone,
      val, share, val - share, true, d, st,
      jsonb_build_object('len', len, 'trans', trans, 'pickup', left(coalesce(p->>'pickup',''), 200), 'pc', upper(left(coalesce(p->>'pc',''), 9)),
        'mode', mode, 'pack', pk.id, 'pack_title', pk.title, 'paid_now', pay, 'paid', left(coalesce(p->>'paid',''), 100)))
    returning id into bid;
  insert into public.diary_slots (partner_id, booking_id, day, bay_name, start_min, dur_min, kind) values (g.id, bid, d, 'lessons', st, len, 'online');
  return jsonb_build_object('id', bid, 'ref', upper(left(bid::text, 8)), 'paid', pay, 'value', val, 'pack', pk.id, 'hours_left', left_h, 'summary', summ);
end $$;
revoke all on function public.book_lesson(jsonb) from public, anon; grant execute on function public.book_lesson(jsonb) to authenticated;

-- cancel a lesson. The learner: free up to 48 hours before (hours go back to the block, or a refund is due); later than
-- that the instructor is still paid. The instructor (or staff) can cancel at any time and the learner loses nothing.
create or replace function public.cancel_lesson(p_booking uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); b public.bookings; late boolean; mine boolean; theirs boolean; hrs numeric; back numeric := 0; refund numeric := 0;
begin
  select * into b from public.bookings where id = p_booking and kind = 'Driving lesson' for update;
  if not found then raise exception 'not_found'; end if;
  mine := b.customer_id = uid; theirs := b.partner_id = uid or (select private.is_staff());
  if not mine and not theirs then raise exception 'not_yours'; end if;
  if b.status in ('cancelled','done') then raise exception 'already_closed'; end if;
  late := mine and not theirs and ((b.slot_day + make_interval(mins => b.slot_start)) at time zone 'Europe/London') < now() + interval '48 hours';
  hrs := coalesce((b.details->>'len')::numeric, 60) / 60.0;
  delete from public.diary_slots where booking_id = b.id;
  if not late then
    if (b.details->>'pack') is not null then
      update public.lesson_packs set hours_booked = greatest(0, hours_booked - hrs) where id = (b.details->>'pack')::uuid; back := hrs;
    else refund := coalesce(b.price_total, 0); end if;
  end if;
  perform set_config('mc.self_cancel', '1', true);
  update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = uid,
    cancel_reason = left(coalesce(nullif(btrim(p_reason), ''), case when mine then 'Cancelled by the learner' else 'Cancelled by the instructor' end), 300),
    refund_amount = refund, refund_status = case when refund > 0 then 'due' else null end,
    partner_payout = case when late then partner_payout else 0 end, our_share = case when late then our_share else 0 end
  where id = b.id;
  perform set_config('mc.self_cancel', '', true);
  return jsonb_build_object('cancelled', true, 'late', late, 'hours_back', back, 'refund', refund);
end $$;
revoke all on function public.cancel_lesson(uuid, text) from public, anon; grant execute on function public.cancel_lesson(uuid, text) to authenticated;

-- the instructor's diary: lessons and blocked times
create or replace function public.instructor_diary(p_from date, p_days int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'lessons', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'day', b.slot_day, 'start', b.slot_start, 'len', coalesce((b.details->>'len')::int, 60),
        'trans', b.details->>'trans', 'status', b.status, 'name', b.customer_name, 'phone', b.customer_phone, 'pickup', b.details->>'pickup', 'pc', b.details->>'pc',
        'pack', b.details->>'pack_title', 'value', b.price_total, 'payout', b.partner_payout, 'ref', upper(left(b.id::text, 8))) order by b.slot_day, b.slot_start)
      from public.bookings b where b.partner_id = (select auth.uid()) and b.kind = 'Driving lesson'
        and b.slot_day >= coalesce(p_from, current_date) - 1 and b.slot_day < coalesce(p_from, current_date) + least(62, greatest(1, coalesce(p_days, 14)))), '[]'::jsonb),
    'blocks', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'day', s.day, 'start', s.start_min, 'dur', s.dur_min) order by s.day, s.start_min)
      from public.diary_slots s where s.partner_id = (select auth.uid()) and s.kind = 'own' and s.bay_name = 'lessons'
        and s.day >= coalesce(p_from, current_date) and s.day < coalesce(p_from, current_date) + 62), '[]'::jsonb),
    'packs', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'title', k.title, 'left', k.hours_total - k.hours_booked, 'total', k.hours_total,
        'name', (select pr.name from public.profiles pr where pr.id = k.customer_id)) order by k.created_at desc)
      from public.lesson_packs k where k.partner_id = (select auth.uid()) and k.status = 'active' and k.hours_total > k.hours_booked), '[]'::jsonb)) $$;
revoke all on function public.instructor_diary(date, int) from public, anon; grant execute on function public.instructor_diary(date, int) to authenticated;

create or replace function public.block_lesson_time(p_day date, p_start int, p_dur int) returns bigint
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); nid bigint;
begin
  if not exists (select 1 from public.partners where id = uid and role = 'instructor') then raise exception 'not_instructor'; end if;
  if p_day < current_date or p_day > current_date + 365 or p_start < 0 or p_start > 1425 or p_dur < 15 or p_dur > 720 or p_start + p_dur > 1440 then raise exception 'bad_time'; end if;
  insert into public.diary_slots (partner_id, day, bay_name, start_min, dur_min, kind) values (uid, p_day, 'lessons', p_start, p_dur, 'own') returning id into nid;
  return nid;
end $$;
create or replace function public.unblock_lesson_time(p_id bigint) returns void
language sql security definer set search_path = '' as $$
  delete from public.diary_slots where id = p_id and partner_id = (select auth.uid()) and kind = 'own' and bay_name = 'lessons' $$;
revoke all on function public.block_lesson_time(date, int, int) from public, anon; grant execute on function public.block_lesson_time(date, int, int) to authenticated;
revoke all on function public.unblock_lesson_time(bigint) from public, anon; grant execute on function public.unblock_lesson_time(bigint) to authenticated;

-- the instructor saves prices, packages, availability, area and profile
create or replace function public.set_instructor_setup(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); me public.partners; i jsonb; o jsonb; x jsonb; arr jsonb; wk jsonb := '[]'::jsonb; k int; rm numeric; ra numeric; tr jsonb := '[]'::jsonb;
begin
  select * into me from public.partners where id = uid and role = 'instructor';
  if not found then raise exception 'not_instructor'; end if;
  i := coalesce(p->'inst', '{}'::jsonb); o := coalesce(me.details->'inst', '{}'::jsonb);
  rm := least(200, greatest(0, coalesce((p->'rates'->>'manual')::numeric, (me.rates->>'manual')::numeric, 0)));
  ra := least(200, greatest(0, coalesce((p->'rates'->>'auto')::numeric, (me.rates->>'auto')::numeric, 0)));
  if i ? 'trans' then
    if i->'trans' ? 'manual' then tr := tr || '"manual"'::jsonb; end if; if i->'trans' ? 'auto' then tr := tr || '"auto"'::jsonb; end if;
    if jsonb_array_length(tr) = 0 then raise exception 'choose_transmission'; end if; o := o || jsonb_build_object('trans', tr);
  end if;
  if i->>'gender' in ('male','female','none') then o := o || jsonb_build_object('gender', i->>'gender'); end if;
  if i->>'badge' in ('adi','pdi') then o := o || jsonb_build_object('badge', i->>'badge'); end if;
  if i ? 'adi' then o := o || jsonb_build_object('adi', left(regexp_replace(coalesce(i->>'adi',''), '[^0-9A-Za-z]', '', 'g'), 12)); end if;
  if i ? 'car' then o := o || jsonb_build_object('car', left(coalesce(i->>'car',''), 60)); end if;
  if i ? 'bio' then o := o || jsonb_build_object('bio', left(coalesce(i->>'bio',''), 400)); end if;
  if i ? 'on' then o := o || jsonb_build_object('on', coalesce((i->>'on')::boolean, true)); end if;
  if i ? 'gap' then o := o || jsonb_build_object('gap', least(120, greatest(0, coalesce((i->>'gap')::int, 0)))); end if;
  if i ? 'notice' then o := o || jsonb_build_object('notice', least(168, greatest(1, coalesce((i->>'notice')::int, 24)))); end if;
  if (i->>'lat') is not null and (i->>'lng') is not null and (i->>'lat')::float8 between 49 and 61 and (i->>'lng')::float8 between -9 and 2 then
    o := o || jsonb_build_object('lat', round((i->>'lat')::numeric, 5), 'lng', round((i->>'lng')::numeric, 5)); end if;
  if jsonb_typeof(i->'lens') = 'array' then
    select coalesce(jsonb_agg(v order by v), '[]'::jsonb) into arr from (select distinct (e)::int v from jsonb_array_elements_text(i->'lens') e where e in ('60','90','120')) z;
    if jsonb_array_length(arr) = 0 then raise exception 'choose_length'; end if; o := o || jsonb_build_object('lens', arr);
  end if;
  if jsonb_typeof(i->'blocks') = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object('h', h, 'pct', pct) order by h), '[]'::jsonb) into arr from (
      select distinct on (h) h, pct from (select round((e->>'h')::numeric)::int h, least(50, greatest(0, round(coalesce((e->>'pct')::numeric, 0), 1))) pct
        from jsonb_array_elements(i->'blocks') e where (e->>'h') ~ '^\d+(\.\d+)?$') y where h between 2 and 60 order by h) z;
    o := o || jsonb_build_object('blocks', arr);
  end if;
  if jsonb_typeof(i->'intensive') = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object('name', left(coalesce(e->>'name','Intensive course'), 60), 'hours', least(80, greatest(4, round((e->>'hours')::numeric)::int)),
        'price', least(5000, greatest(0, round((e->>'price')::numeric, 2))), 'trans', case when e->>'trans' in ('manual','auto') then e->>'trans' else '' end)), '[]'::jsonb) into arr
      from (select e from jsonb_array_elements(i->'intensive') e where (e->>'hours') ~ '^\d+(\.\d+)?$' and (e->>'price') ~ '^\d+(\.\d+)?$' and (e->>'price')::numeric > 0 limit 6) z;
    o := o || jsonb_build_object('intensive', arr);
  end if;
  if jsonb_typeof(i->'week') = 'array' and jsonb_array_length(i->'week') = 7 then
    for k in 0 .. 6 loop x := i->'week'->k;
      if jsonb_typeof(x) = 'array' and private.hm(x->>0) is not null and private.hm(x->>1) is not null and private.hm(x->>0) < private.hm(x->>1) then wk := wk || jsonb_build_array(jsonb_build_array(x->>0, x->>1));
      else wk := wk || 'null'::jsonb; end if;
    end loop;
    o := o || jsonb_build_object('week', wk);
  end if;
  update public.partners set rates = coalesce(rates, '{}'::jsonb) || jsonb_build_object('manual', rm, 'auto', ra),
    details = coalesce(details, '{}'::jsonb) || jsonb_build_object('inst', o)
      || case when p ? 'post' then jsonb_build_object('post', upper(left(coalesce(p->>'post',''), 9))) else '{}'::jsonb end
      || case when p ? 'radius' then jsonb_build_object('radius', least(100, greatest(1, coalesce((p->>'radius')::int, 10)))) else '{}'::jsonb end,
    town = case when p ? 'post' and coalesce(p->>'post','') <> '' then upper(left(p->>'post', 9)) else town end
  where id = uid returning rates, details into x, arr;
  return jsonb_build_object('rates', x, 'details', arr);
end $$;
revoke all on function public.set_instructor_setup(jsonb) from public, anon; grant execute on function public.set_instructor_setup(jsonb) to authenticated;

-- the learner's blocks of hours (with the instructor's name)
create or replace function public.my_lesson_packs() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'title', k.title, 'trans', k.trans, 'total', k.hours_total, 'left', k.hours_total - k.hours_booked,
      'partner', k.partner_id, 'name', g.name, 'lens', g.details->'inst'->'lens', 'paid', k.price_total, 'made', k.created_at) order by k.created_at desc), '[]'::jsonb)
  from public.lesson_packs k join public.partners g on g.id = k.partner_id where k.customer_id = (select auth.uid()) and k.status = 'active' $$;
revoke all on function public.my_lesson_packs() from public, anon; grant execute on function public.my_lesson_packs() to authenticated;
