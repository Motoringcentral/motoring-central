-- Driving lessons, second part (22 Nov 2026): moving a lesson, the instructor adding a lesson for a learner, payment for
-- a lesson the instructor added, reviews shown in the learner's search, and lesson-specific emails.
-- Rules from the owner:
--   * the instructor can move a lesson (both sides are assumed to have agreed). If the learner cannot make the new time
--     they can cancel free for 48 hours after the change: a single lesson is refunded, block hours go back to the block.
--   * the learner can move a lesson themselves up to 48 hours before it. Later than that it is a request and the
--     instructor decides.
--   * block and intensive hours are never refunded as money: they stay in the block to be booked again.
-- bookings.details gains: move {day,start,at} (a learner's request), moved {by,at,from_day,from_start},
--   added_by 'instructor', unpaid true + pay_by (a lesson the instructor added that the learner still has to pay for).

create or replace function private.lesson_when(d date, st int) returns text language sql immutable set search_path = '' as
$$ select to_char(d, 'FMDay FMDD FMMonth') || ' at ' || to_char(make_time(st / 60, st % 60, 0), 'HH24:MI') $$;

-- is the time free, leaving one booking's own slot out of the check? p_strict: also inside the instructor's hours and
-- notice (a learner choosing); not strict: the instructor placing a lesson in their own diary.
create or replace function private.lesson_free_x(g public.partners, p_day date, p_start int, p_len int, p_except uuid, p_strict boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare inst jsonb := g.details->'inst'; w jsonb; o int; c int; gap int := 0; notice int; at timestamptz;
begin
  if inst is null or p_day is null or p_start is null or p_start < 0 or p_start + p_len > 1440 then return false; end if;
  at := (p_day + make_interval(mins => p_start)) at time zone 'Europe/London';
  if p_strict then
    if coalesce(inst->>'on','true') = 'false' then return false; end if;
    w := inst->'week'->(extract(dow from p_day)::int);
    if w is null or jsonb_typeof(w) <> 'array' then return false; end if;
    o := private.hm(w->>0); c := private.hm(w->>1);
    if o is null or c is null or p_start < o or p_start + p_len > c then return false; end if;
    gap := least(120, greatest(0, coalesce((inst->>'gap')::int, 0)));
    notice := least(168, greatest(1, coalesce((inst->>'notice')::int, 24)));
    if at < now() + make_interval(hours => notice) or p_day > (now() at time zone 'Europe/London')::date + 60 then return false; end if;
  else
    if at < now() or p_day > (now() at time zone 'Europe/London')::date + 120 then return false; end if;
  end if;
  return not exists (select 1 from public.diary_slots s where s.partner_id = g.id and s.day = p_day
                     and (p_except is null or s.booking_id is distinct from p_except)
                     and p_start < s.start_min + s.dur_min + gap and s.start_min < p_start + p_len + gap);
end $$;
create or replace function private.lesson_free(g public.partners, p_day date, p_start int, p_len int) returns boolean
language sql stable security definer set search_path = '' as $$ select private.lesson_free_x(g, p_day, p_start, p_len, null, true) $$;

create or replace function private.lesson_apply_move(b public.bookings, p_day date, p_start int, p_by text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.bookings set slot_day = p_day, slot_start = p_start,
    summary = regexp_replace(summary, ' on [A-Za-z]+ [0-9]{1,2} [A-Za-z]+ at [0-9]{2}:[0-9]{2}\.', ' on ' || private.lesson_when(p_day, p_start) || '.'),
    details = (coalesce(details, '{}'::jsonb) - 'move') || jsonb_build_object('moved',
      jsonb_build_object('by', p_by, 'at', now(), 'from_day', b.slot_day, 'from_start', b.slot_start))
  where id = b.id;
  update public.diary_slots set day = p_day, start_min = p_start where booking_id = b.id;
end $$;

-- free times a lesson could move to (the learner's picker)
create or replace function public.lesson_move_slots(p_booking uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); b public.bookings; g public.partners; out jsonb := '[]'::jsonb; d date; s int; arr jsonb; len int;
        d0 date := (now() at time zone 'Europe/London')::date;
begin
  select * into b from public.bookings where id = p_booking and kind = 'Driving lesson' and (customer_id = uid or partner_id = uid);
  if not found then return out; end if;
  select * into g from public.partners where id = b.partner_id; len := coalesce((b.details->>'len')::int, 60);
  for i in 0 .. 20 loop
    d := d0 + i; arr := '[]'::jsonb; s := 6 * 60;
    while s <= 22 * 60 loop
      if not (d = b.slot_day and s = b.slot_start) and private.lesson_free_x(g, d, s, len, b.id, true) then arr := arr || to_jsonb(s); end if;
      s := s + 30;
    end loop;
    if jsonb_array_length(arr) > 0 then out := out || jsonb_build_object('day', d, 'starts', arr); end if;
  end loop;
  return out;
end $$;
revoke all on function public.lesson_move_slots(uuid) from public, anon; grant execute on function public.lesson_move_slots(uuid) to authenticated;

create or replace function public.move_lesson(p_booking uuid, p_day date, p_start int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); b public.bookings; g public.partners; len int; theirs boolean; late boolean; was text; nw text;
  cem text; hi text; ref text;
begin
  select * into b from public.bookings where id = p_booking and kind = 'Driving lesson' for update;
  if not found then raise exception 'not_found'; end if;
  theirs := b.partner_id = uid or (select private.is_staff());
  if not theirs and b.customer_id is distinct from uid then raise exception 'not_yours'; end if;
  if b.status <> 'confirmed' then raise exception 'already_closed'; end if;
  if ((b.slot_day + make_interval(mins => b.slot_start)) at time zone 'Europe/London') < now() then raise exception 'already_started'; end if;
  if p_day = b.slot_day and p_start = b.slot_start then raise exception 'same_time'; end if;
  select * into g from public.partners where id = b.partner_id;
  len := coalesce((b.details->>'len')::int, 60);
  perform pg_advisory_xact_lock(hashtextextended(g.id::text || p_day::text, 0));
  was := private.lesson_when(b.slot_day, b.slot_start); nw := private.lesson_when(p_day, p_start);
  cem := private.user_email(b.customer_id); hi := 'Hello ' || private.first_name(b.customer_name) || E',\n\n'; ref := upper(left(b.id::text, 8));
  if theirs then
    if not private.lesson_free_x(g, p_day, p_start, len, b.id, false) then raise exception 'slot_taken'; end if;
    perform private.lesson_apply_move(b, p_day, p_start, 'instructor');
    perform private.mail(cem, 'customer', 'Your driving lesson has moved to ' || nw,
      hi || g.name || ' has moved your driving lesson.' || E'\n\nWas: ' || was || E'\nNow: ' || nw ||
      E'\n\nIf you cannot make the new time, you can cancel it free of charge in My account for the next 48 hours: a single lesson is refunded, and block hours go back to your block to book again.' ||
      coalesce(E'\n\nYour instructor: ' || g.name || coalesce(', ' || nullif(g.phone,''), ''), '') || E'\nReference: ' || ref || E'\n\nThe Motoring Central',
      '/#account', 'lesson_moved', null, b.id);
    return jsonb_build_object('moved', true, 'when', nw);
  end if;
  if not private.lesson_free_x(g, p_day, p_start, len, b.id, true) then raise exception 'slot_taken'; end if;
  late := ((b.slot_day + make_interval(mins => b.slot_start)) at time zone 'Europe/London') < now() + interval '48 hours';
  if late then
    update public.bookings set details = coalesce(details, '{}'::jsonb) || jsonb_build_object('move', jsonb_build_object('day', p_day, 'start', p_start, 'at', now())) where id = b.id;
    if g.email is not null then
      perform private.mail(g.email, 'partner', 'A learner asks to move a lesson: ' || coalesce(b.customer_name, 'Learner'),
        E'Hello,\n\n' || coalesce(b.customer_name, 'A learner') || ' has asked to move a lesson that starts in less than 48 hours.' ||
        E'\n\nBooked: ' || was || E'\nAsks for: ' || nw ||
        E'\n\nIt is your choice. Open your diary to accept or decline. If you decline, the lesson stays where it is and is charged as normal.' ||
        E'\nReference: ' || ref || E'\n\nThe Motoring Central', '/#dashboard', 'lesson_move_ask', null, b.id);
    end if;
    return jsonb_build_object('asked', true, 'when', nw);
  end if;
  perform private.lesson_apply_move(b, p_day, p_start, 'learner');
  if g.email is not null then
    perform private.mail(g.email, 'partner', 'Lesson moved by the learner: ' || coalesce(b.customer_name, 'Learner'),
      E'Hello,\n\n' || coalesce(b.customer_name, 'A learner') || ' has moved a lesson to another free time in your diary.' ||
      E'\n\nWas: ' || was || E'\nNow: ' || nw || E'\nReference: ' || ref || E'\n\nYour diary is already up to date.\n\nThe Motoring Central', '/#dashboard', 'lesson_moved_partner', null, b.id);
  end if;
  return jsonb_build_object('moved', true, 'when', nw);
end $$;
revoke all on function public.move_lesson(uuid, date, int) from public, anon; grant execute on function public.move_lesson(uuid, date, int) to authenticated;

-- the instructor accepts or declines a learner's late request to move
create or replace function public.answer_lesson_move(p_booking uuid, p_ok boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); b public.bookings; g public.partners; d date; st int; cem text; hi text; nw text;
begin
  select * into b from public.bookings where id = p_booking and kind = 'Driving lesson' and partner_id = uid for update;
  if not found then raise exception 'not_found'; end if;
  if b.status <> 'confirmed' or jsonb_typeof(b.details->'move') <> 'object' then raise exception 'no_request'; end if;
  select * into g from public.partners where id = uid;
  d := (b.details->'move'->>'day')::date; st := (b.details->'move'->>'start')::int; nw := private.lesson_when(d, st);
  cem := private.user_email(b.customer_id); hi := 'Hello ' || private.first_name(b.customer_name) || E',\n\n';
  if p_ok then
    perform pg_advisory_xact_lock(hashtextextended(g.id::text || d::text, 0));
    if not private.lesson_free_x(g, d, st, coalesce((b.details->>'len')::int, 60), b.id, false) then raise exception 'slot_taken'; end if;
    perform private.lesson_apply_move(b, d, st, 'learner');
    perform private.mail(cem, 'customer', 'Your lesson has been moved to ' || nw,
      hi || g.name || ' has agreed to move your driving lesson.' || E'\n\nNew time: ' || nw || E'\nReference: ' || upper(left(b.id::text, 8)) || E'\n\nThe Motoring Central',
      '/#account', 'lesson_move_yes', null, b.id);
    return jsonb_build_object('moved', true);
  end if;
  update public.bookings set details = details - 'move' where id = b.id;
  perform private.mail(cem, 'customer', 'Your lesson could not be moved',
    hi || g.name || ' is not able to move your driving lesson at this short notice, so it stays as booked: ' || private.lesson_when(b.slot_day, b.slot_start) ||
    E'.\n\nLessons can be moved or cancelled free of charge up to 48 hours before they start. After that it is the instructor''s choice.' ||
    E'\nReference: ' || upper(left(b.id::text, 8)) || E'\n\nThe Motoring Central', '/#account', 'lesson_move_no', null, b.id);
  return jsonb_build_object('moved', false);
end $$;
revoke all on function public.answer_lesson_move(uuid, boolean) from public, anon; grant execute on function public.answer_lesson_move(uuid, boolean) to authenticated;

-- the instructor adds a lesson for one of their own learners: from hours already paid for, or for the learner to pay
create or replace function public.add_lesson(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.partners; prof public.profiles; inst jsonb; cust uuid := (p->>'customer')::uuid;
  len int := (p->>'len')::int; d date := (p->>'day')::date; st int := (p->>'start')::int; hrs numeric; pk public.lesson_packs; trans text := p->>'trans';
  rate numeric; val numeric; share numeric; unpaid boolean := false; summ text; bid uuid; left_h numeric; pay_by timestamptz; at timestamptz; cem text; hi text;
begin
  select * into g from public.partners where id = uid and role = 'instructor' and status = 'approved';
  if not found then raise exception 'not_instructor'; end if;
  inst := g.details->'inst';
  if not exists (select 1 from public.bookings where partner_id = uid and customer_id = cust and kind = 'Driving lesson')
     and not exists (select 1 from public.lesson_packs where partner_id = uid and customer_id = cust) then raise exception 'not_your_learner'; end if;
  select * into prof from public.profiles where id = cust; if not found then raise exception 'not_your_learner'; end if;
  if len is null or len not in (60, 90, 120) then raise exception 'bad_length'; end if;
  hrs := len / 60.0;
  perform pg_advisory_xact_lock(hashtextextended(g.id::text || d::text, 0));
  if not private.lesson_free_x(g, d, st, len, null, false) then raise exception 'slot_taken'; end if;
  at := (d + make_interval(mins => st)) at time zone 'Europe/London';
  if coalesce(p->>'pack', '') <> '' then
    select * into pk from public.lesson_packs where id = (p->>'pack')::uuid and customer_id = cust and partner_id = uid and status = 'active' for update;
    if not found then raise exception 'no_pack'; end if;
    if pk.hours_total - pk.hours_booked < hrs then raise exception 'not_enough_hours'; end if;
    trans := pk.trans; val := round(pk.price_total * hrs / pk.hours_total, 2);
    update public.lesson_packs set hours_booked = hours_booked + hrs where id = pk.id;
    left_h := pk.hours_total - pk.hours_booked - hrs;
  else
    if trans not in ('manual','auto') or not (inst->'trans' ? trans) then raise exception 'bad_trans'; end if;
    rate := coalesce((g.rates->>trans)::numeric, 0); if rate <= 0 then raise exception 'no_rate'; end if;
    if at < now() + interval '3 hours' then raise exception 'too_soon_to_pay'; end if;
    val := round(rate * hrs, 2); unpaid := true; pay_by := least(now() + interval '24 hours', at - interval '2 hours');
  end if;
  share := round(val * 0.12, 2);
  summ := 'Driving lesson (' || case trans when 'auto' then 'automatic' else 'manual' end || ', ' ||
    case len when 60 then '1 hour' when 90 then '1 hour 30 minutes' else '2 hours' end || ') with ' || g.name || ' on ' || private.lesson_when(d, st) || '. Pick-up: ' ||
    left(coalesce(nullif(btrim(p->>'pickup'), ''), 'to be agreed'), 200) || '.' ||
    case when pk.id is not null then ' Part of: ' || pk.title || ' (' || trim(to_char(left_h, 'FM990.0')) || ' hours left to book).' else '' end;
  insert into public.bookings (customer_id, kind, service, summary, status, made_at, partner_id, partner_name, customer_name, customer_phone,
      price_total, our_share, partner_payout, paid, slot_day, slot_start, details)
    values (cust, 'Driving lesson', 'Driving lesson', left(summ, 2000), 'confirmed', now(), g.id, g.name, prof.name, prof.phone,
      val, case when unpaid then null else share end, case when unpaid then null else val - share end, not unpaid, d, st,
      jsonb_build_object('len', len, 'trans', trans, 'pickup', left(coalesce(p->>'pickup',''), 200), 'pc', '', 'mode', case when unpaid then 'single' else 'pack' end,
        'pack', pk.id, 'pack_title', pk.title, 'added_by', 'instructor', 'moved', jsonb_build_object('by', 'instructor', 'at', now()))
      || case when unpaid then jsonb_build_object('unpaid', true, 'pay_by', pay_by) else '{}'::jsonb end)
    returning id into bid;
  insert into public.diary_slots (partner_id, booking_id, day, bay_name, start_min, dur_min, kind) values (g.id, bid, d, 'lessons', st, len, 'online');
  cem := private.user_email(cust); hi := 'Hello ' || private.first_name(prof.name) || E',\n\n';
  if unpaid then
    perform private.mail(cem, 'customer', 'Pay for your driving lesson on ' || private.lesson_when(d, st),
      hi || g.name || ' has booked a driving lesson for you.' || E'\n\n' || summ || E'\n\nPrice: £' || trim(to_char(val, 'FM99990.00')) ||
      '. No booking fee.' || E'\n\nPlease pay in My account by ' || to_char(pay_by at time zone 'Europe/London', 'FMDay FMDD FMMonth, HH24:MI') ||
      E' to keep this time. If it is not paid by then, the time is released.\nReference: ' || upper(left(bid::text, 8)) || E'\n\nThe Motoring Central',
      '/#account', 'lesson_added_pay', null, bid);
  else
    perform private.mail(cem, 'customer', 'Driving lesson booked for you: ' || private.lesson_when(d, st),
      hi || g.name || ' has booked a driving lesson for you from the hours you have paid for.' || E'\n\n' || summ ||
      E'\n\nIf you cannot make it, you can cancel it free of charge in My account for the next 48 hours, or at any time up to 48 hours before the lesson. The hours go back to your block.' ||
      E'\nReference: ' || upper(left(bid::text, 8)) || E'\n\nThe Motoring Central', '/#account', 'lesson_added', null, bid);
  end if;
  return jsonb_build_object('id', bid, 'unpaid', unpaid, 'value', val, 'hours_left', left_h);
end $$;
revoke all on function public.add_lesson(jsonb) from public, anon; grant execute on function public.add_lesson(jsonb) to authenticated;

-- the learner pays for a lesson the instructor added
create or replace function public.pay_lesson(p_booking uuid, p_paid text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); b public.bookings; g public.partners; share numeric;
begin
  select * into b from public.bookings where id = p_booking and kind = 'Driving lesson' and customer_id = uid for update;
  if not found then raise exception 'not_found'; end if;
  if b.status <> 'confirmed' or coalesce(b.details->>'unpaid', '') <> 'true' then raise exception 'nothing_to_pay'; end if;
  if coalesce(btrim(p_paid), '') = '' then raise exception 'not_paid'; end if;
  share := round(b.price_total * 0.12, 2);
  update public.bookings set paid = true, our_share = share, partner_payout = price_total - share,
    details = (details - 'unpaid' - 'pay_by') || jsonb_build_object('paid', left(p_paid, 100), 'paid_now', price_total) where id = b.id;
  select * into g from public.partners where id = b.partner_id;
  if g.email is not null then
    perform private.mail(g.email, 'partner', 'Lesson paid: ' || coalesce(b.customer_name, 'Learner') || ', ' || private.lesson_when(b.slot_day, b.slot_start),
      E'Hello,\n\n' || coalesce(b.customer_name, 'Your learner') || ' has paid for the lesson you added on ' || private.lesson_when(b.slot_day, b.slot_start) ||
      E'. It is confirmed in your diary.\nReference: ' || upper(left(b.id::text, 8)) || E'\n\nThe Motoring Central', '/#dashboard', 'lesson_paid', null, b.id);
  end if;
  return jsonb_build_object('paid', b.price_total);
end $$;
revoke all on function public.pay_lesson(uuid, text) from public, anon; grant execute on function public.pay_lesson(uuid, text) to authenticated;

-- lessons the instructor added that were not paid for in time: release the time
create or replace function private.drop_unpaid_lessons() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in select id from public.bookings where kind = 'Driving lesson' and status = 'confirmed' and details->>'unpaid' = 'true'
             and (details->>'pay_by')::timestamptz < now() for update loop
    delete from public.diary_slots where booking_id = r.id;
    update public.bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Not paid for in time, so the time was released',
      refund_amount = 0, partner_payout = 0, our_share = 0 where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
select cron.unschedule('lesson-unpaid') where exists (select 1 from cron.job where jobname = 'lesson-unpaid');
select cron.schedule('lesson-unpaid', '*/20 * * * *', 'select private.drop_unpaid_lessons()');

-- cancel: block hours always go back to the block and are never refunded as money; a learner who cancels inside 48 hours
-- still pays, unless the instructor moved or added the lesson in the last 48 hours
create or replace function public.cancel_lesson(p_booking uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); b public.bookings; late boolean; mine boolean; theirs boolean; hrs numeric; back numeric := 0; refund numeric := 0;
begin
  select * into b from public.bookings where id = p_booking and kind = 'Driving lesson' for update;
  if not found then raise exception 'not_found'; end if;
  mine := b.customer_id = uid; theirs := b.partner_id = uid or (select private.is_staff());
  if not mine and not theirs then raise exception 'not_yours'; end if;
  if b.status in ('cancelled','done') then raise exception 'already_closed'; end if;
  late := mine and not theirs and b.paid
    and ((b.slot_day + make_interval(mins => b.slot_start)) at time zone 'Europe/London') < now() + interval '48 hours'
    and not coalesce(b.details->'moved'->>'by' = 'instructor' and (b.details->'moved'->>'at')::timestamptz > now() - interval '48 hours', false);
  hrs := coalesce((b.details->>'len')::numeric, 60) / 60.0;
  delete from public.diary_slots where booking_id = b.id;
  if not late then
    if (b.details->>'pack') is not null then
      update public.lesson_packs set hours_booked = greatest(0, hours_booked - hrs) where id = (b.details->>'pack')::uuid; back := hrs;
    elsif b.paid then refund := coalesce(b.price_total, 0); end if;
  end if;
  perform set_config('mc.self_cancel', '1', true);
  update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = uid,
    cancel_reason = left(coalesce(nullif(btrim(p_reason), ''), case when mine then 'Cancelled by the learner' else 'Cancelled by the instructor' end), 300),
    refund_amount = refund, refund_status = case when refund > 0 then 'due' else null end,
    partner_payout = case when late then partner_payout else 0 end, our_share = case when late then our_share else 0 end,
    details = details - 'move'
  where id = b.id;
  perform set_config('mc.self_cancel', '', true);
  return jsonb_build_object('cancelled', true, 'late', late, 'hours_back', back, 'refund', refund);
end $$;

-- the diary also returns move requests, what was moved, unpaid lessons, and the instructor's learners (to add a lesson)
create or replace function public.instructor_diary(p_from date, p_days int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'lessons', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'day', b.slot_day, 'start', b.slot_start, 'len', coalesce((b.details->>'len')::int, 60),
        'trans', b.details->>'trans', 'status', b.status, 'name', b.customer_name, 'phone', b.customer_phone, 'pickup', b.details->>'pickup', 'pc', b.details->>'pc',
        'pack', b.details->>'pack_title', 'want', b.details->>'want', 'value', b.price_total, 'payout', b.partner_payout, 'ref', upper(left(b.id::text, 8)),
        'move', b.details->'move', 'moved', b.details->'moved', 'unpaid', coalesce(b.details->>'unpaid', '') = 'true', 'pay_by', b.details->>'pay_by',
        'added', coalesce(b.details->>'added_by', '') = 'instructor') order by b.slot_day, b.slot_start)
      from public.bookings b where b.partner_id = (select auth.uid()) and b.kind = 'Driving lesson'
        and b.slot_day >= coalesce(p_from, current_date) - 1 and b.slot_day < coalesce(p_from, current_date) + least(62, greatest(1, coalesce(p_days, 14)))), '[]'::jsonb),
    'blocks', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'day', s.day, 'start', s.start_min, 'dur', s.dur_min) order by s.day, s.start_min)
      from public.diary_slots s where s.partner_id = (select auth.uid()) and s.kind = 'own' and s.bay_name = 'lessons'
        and s.day >= coalesce(p_from, current_date) and s.day < coalesce(p_from, current_date) + 62), '[]'::jsonb),
    'packs', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'title', k.title, 'left', k.hours_total - k.hours_booked, 'total', k.hours_total,
        'name', (select pr.name from public.profiles pr where pr.id = k.customer_id)) order by k.created_at desc)
      from public.lesson_packs k where k.partner_id = (select auth.uid()) and k.status = 'active' and k.hours_total > k.hours_booked), '[]'::jsonb),
    'learners', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', coalesce(nullif(pr.name, ''), 'Learner'), 'phone', pr.phone, 'pickup', c.pickup,
        'packs', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'title', k.title, 'trans', k.trans, 'left', k.hours_total - k.hours_booked) order by k.created_at)
          from public.lesson_packs k where k.partner_id = (select auth.uid()) and k.customer_id = c.id and k.status = 'active' and k.hours_total > k.hours_booked), '[]'::jsonb))
        order by pr.name)
      from (select b.customer_id id, (array_agg(nullif(b.details->>'pickup', '') order by b.made_at desc))[1] pickup
            from public.bookings b where b.partner_id = (select auth.uid()) and b.kind = 'Driving lesson' and b.customer_id is not null
              and b.made_at > now() - interval '18 months' group by b.customer_id) c
      left join public.profiles pr on pr.id = c.id), '[]'::jsonb)) $$;

-- the learner's search also shows each instructor's star rating and latest reviews
do $$
declare d text := pg_get_functiondef('public.find_instructors(double precision, double precision, text, text)'::regprocedure);
begin
  if position('''stars''' in d) = 0 then
    d := replace(d, '''car'', q.inst->>''car''',
      '''stars'', (select round(avg(r.rating)::numeric, 1) from public.partner_reviews r where r.partner_id = q.id and not r.hidden), ' ||
      '''reviews'', (select count(*) from public.partner_reviews r where r.partner_id = q.id and not r.hidden), ' ||
      '''latest'', (select coalesce(jsonb_agg(jsonb_build_object(''who'', z.author_name, ''stars'', z.rating, ''text'', z.body, ''at'', z.created_at)), ''[]''::jsonb) ' ||
      'from (select r.author_name, r.rating, r.body, r.created_at from public.partner_reviews r where r.partner_id = q.id and not r.hidden and coalesce(r.body, '''') <> '''' order by r.created_at desc limit 3) z), ' ||
      '''car'', q.inst->>''car''');
    if position('''stars''' in d) = 0 then raise exception 'find_instructors: place not found'; end if;
    execute d;
  end if;
end $$;

-- lesson-specific emails for done and cancelled; no generic "booking confirmed" for a lesson the instructor added
do $$
declare d text := pg_get_functiondef('private.mail_booking'::regproc); k text := 'select * into g from public.partners where id = new.partner_id;';
begin
  if position('lesson_done' in d) = 0 then
    if position(k in d) = 0 then raise exception 'mail_booking: place not found'; end if;
    d := replace(d, k, k || $m$
  if new.kind = 'Driving lesson' then
    if tg_op = 'INSERT' and new.details ? 'added_by' then return new; end if;
    if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'done' then
      perform private.mail(cem, 'customer', 'How was your driving lesson?',
        hi || coalesce(nullif(g.name,''),'Your instructor') || E' has marked your driving lesson as done.\n\nHow did it go? A star rating and a few words take a minute and help other learners choose an instructor. Open My account and tap "Leave a review".' ||
        E'\n\nReference: ' || ref || E'\n\nThe Motoring Central', '/#account', 'lesson_done', null, new.id);
      return new;
    end if;
    if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'cancelled' then
      perform private.mail(cem, 'customer', 'Driving lesson cancelled: ' || private.lesson_when(new.slot_day, new.slot_start),
        hi || 'Your driving lesson with ' || coalesce(nullif(g.name,''),'your instructor') || ' on ' || private.lesson_when(new.slot_day, new.slot_start) || E' has been cancelled.\n' ||
        coalesce('Reason: ' || nullif(new.cancel_reason,'') || E'\n', '') ||
        case when coalesce(new.refund_amount, 0) > 0 then 'We are refunding £' || trim(to_char(new.refund_amount, 'FM99990.00')) || ' to the card you used.'
             when coalesce(new.partner_payout, 0) > 0 then 'It was cancelled less than 48 hours before the start, so it is still charged.'
             when (new.details->>'pack') is not null then 'The hours are back in your block. Book them again from My account whenever suits you.'
             else 'Nothing has been charged.' end ||
        E'\nReference: ' || ref || E'\n\nThe Motoring Central', '/#account', 'lesson_cancelled', null, new.id);
      if g.email is not null and new.cancelled_by is not distinct from new.customer_id then
        perform private.mail(g.email, 'partner', 'Lesson cancelled by the learner: ' || private.lesson_when(new.slot_day, new.slot_start),
          E'Hello,\n\n' || coalesce(new.customer_name, 'Your learner') || ' has cancelled the lesson on ' || private.lesson_when(new.slot_day, new.slot_start) || E'.\n' ||
          case when coalesce(new.partner_payout, 0) > 0 then 'It was cancelled less than 48 hours before the start, so you are still paid for it.' else 'The time is free in your diary again.' end ||
          E'\nReference: ' || ref || E'\n\nThe Motoring Central', '/#dashboard', 'lesson_cancelled_partner', null, new.id);
      end if;
      return new;
    end if;
  end if;$m$);
    execute d;
  end if;
end $$;
