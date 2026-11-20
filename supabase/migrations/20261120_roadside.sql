-- Recovery and mobile EV charging ("roadside" services), 20 Nov 2026
-- Prices and distances are worked out on the server (Edge Function "roadside") from each partner's own rates and
-- real postcode locations, and the booking is written by that function. These are the database parts.

-- partners: depot location (filled by the roadside function from the depot postcode) and "available now"
alter table public.partners add column if not exists base_pc text;
alter table public.partners add column if not exists base_lat double precision;
alter table public.partners add column if not exists base_lng double precision;
alter table public.partners add column if not exists online_until timestamptz;
-- bookings: where to collect, where to take it, miles and the customer's answers
alter table public.bookings add column if not exists details jsonb;

-- what customers' pages may see about approved partners (no exact depot location, no contact details)
create or replace view public.partner_directory with (security_invoker = false) as
  select id, role, sub, name, town, rates,
    jsonb_build_object('svcs', details -> 'svcs', 'motOnly', details -> 'motOnly', 'aeWhere', details -> 'aeWhere',
      'bays', details -> 'bays', 'motBays', details -> 'motBays',
      'radius', details -> 'radius', 'types', details -> 'types', 'plugs', details -> 'plugs', 'kit', details -> 'kit',
      'online', (online_until is not null and online_until > now())) as info
  from public.partners where status = 'approved';

-- partner: go available / unavailable, and set coverage and equipment
create or replace function public.set_roadside(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.partners; d jsonb; pc text; hrs int; r int;
begin
  select * into me from public.partners where id = (select auth.uid());
  if not found or me.role not in ('recovery','evcharge') then raise exception 'not_roadside'; end if;
  d := coalesce(me.details, '{}'::jsonb);
  if p ? 'post' then
    pc := upper(regexp_replace(coalesce(p->>'post',''), '[^A-Za-z0-9]', '', 'g'));
    if pc !~ '^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$' then raise exception 'bad_postcode'; end if;
    pc := left(pc, length(pc)-3) || ' ' || right(pc, 3);
    if pc is distinct from me.base_pc then
      update public.partners set base_pc = pc, base_lat = null, base_lng = null where id = me.id;
    end if;
    d := d || jsonb_build_object('post', pc);
  end if;
  if p ? 'radius' then
    r := nullif(p->>'radius','')::int;
    d := d || jsonb_build_object('radius', case when r is null or r <= 0 then null else least(r, 600) end);
  end if;
  if jsonb_typeof(p->'types') = 'array' then d := d || jsonb_build_object('types', p->'types'); end if;
  if jsonb_typeof(p->'plugs') = 'array' then d := d || jsonb_build_object('plugs', p->'plugs'); end if;
  if jsonb_typeof(p->'kit') = 'array' then d := d || jsonb_build_object('kit', p->'kit'); end if;
  if jsonb_typeof(p->'svcs') = 'array' then d := d || jsonb_build_object('svcs', p->'svcs'); end if;
  if p ? 'winch' then
    update public.partners set rates = coalesce(rates,'{}'::jsonb) || jsonb_build_object('winch', greatest(0, least(500, coalesce((p->>'winch')::numeric,0)))) where id = me.id;
  end if;
  update public.partners set details = d where id = me.id;
  if p ? 'online' then
    hrs := greatest(1, least(24, coalesce((p->>'hours')::int, 12)));
    update public.partners set online_until = case when (p->>'online')::boolean then now() + make_interval(hours => hrs) else null end where id = me.id;
  end if;
  select * into me from public.partners where id = me.id;
  return jsonb_build_object('online_until', me.online_until, 'post', me.details->>'post', 'radius', me.details->'radius');
end $$;
revoke all on function public.set_roadside(jsonb) from public, anon;
grant execute on function public.set_roadside(jsonb) to authenticated;

-- partners may only move their own jobs forwards (cancelling or refunding goes through the functions below)
create or replace function private.booking_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.status is distinct from old.status then
    if old.status = 'cancelled' or new.status = 'cancelled' then raise exception 'not_allowed'; end if;
    if not ((old.status = 'confirmed' and new.status in ('onway','started','done')) or (old.status = 'onway' and new.status in ('started','done','confirmed'))
            or (old.status = 'started' and new.status in ('done','onway')) or (old.status = 'done' and new.status in ('started'))) then
      raise exception 'not_allowed';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists bookings_guard on public.bookings;
create trigger bookings_guard before update of status on public.bookings for each row execute function private.booking_guard();

-- customer: cancel a recovery or EV charging booking.
-- Before the driver sets off: full refund. Once they are on the way: the call-out fee is kept (paid to the partner).
-- Once the job has started: it cannot be cancelled online.
create or replace function public.cancel_roadside(p_booking uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.bookings; amt numeric; keep numeric := 0; call numeric;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found or b.customer_id is distinct from (select auth.uid()) or b.kind not in ('Recovery','EV charging') then raise exception 'not_yours'; end if;
  if b.status = 'cancelled' then raise exception 'already_cancelled'; end if;
  if b.status in ('started','done') then raise exception 'too_late'; end if;
  if b.status = 'onway' then
    call := coalesce((b.details->'price'->>'call')::numeric, 0);
    keep := least(call, coalesce(b.price_total,0));
  end if;
  amt := greatest(0, coalesce(b.price_total,0) - keep);
  update public.bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = left(coalesce(nullif(p_reason,''),'Cancelled by the customer'),300),
    cancelled_by = (select auth.uid()), refund_amount = amt, refund_status = case when amt > 0 then 'due' else null end,
    partner_payout = case when keep > 0 then round(keep * (1 - coalesce((b.details->'price'->>'rate')::numeric, 0.06)), 2) else 0 end,
    our_share = case when keep > 0 then round(keep * coalesce((b.details->'price'->>'rate')::numeric, 0.06), 2) else 0 end
  where id = p_booking;
  return jsonb_build_object('cancelled', true, 'refund', amt, 'kept', keep);
end $$;
revoke all on function public.cancel_roadside(uuid, text) from public, anon;
grant execute on function public.cancel_roadside(uuid, text) to authenticated;

-- partner: cannot do a job they were booked for (before they set off). The customer gets a full refund.
create or replace function public.decline_roadside(p_booking uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found or b.partner_id is distinct from (select auth.uid()) or b.kind not in ('Recovery','EV charging') then raise exception 'not_yours'; end if;
  if b.status <> 'confirmed' then raise exception 'too_late'; end if;
  update public.bookings set status = 'cancelled', cancelled_at = now(),
    cancel_reason = left('The partner could not take this job' || coalesce(': ' || nullif(trim(p_reason),''), ''), 300),
    cancelled_by = (select auth.uid()), refund_amount = price_total, refund_status = case when coalesce(price_total,0) > 0 then 'due' else null end,
    partner_payout = 0, our_share = 0
  where id = p_booking;
  return jsonb_build_object('cancelled', true);
end $$;
revoke all on function public.decline_roadside(uuid, text) from public, anon;
grant execute on function public.decline_roadside(uuid, text) to authenticated;

-- customer: their recovery and charging bookings, with the partner's phone so they can call the driver
create or replace function public.my_roadside(p_from timestamptz default now() - interval '60 days')
returns table(id uuid, kind text, service text, summary text, vehicle jsonb, details jsonb, status text, made_at timestamptz,
  partner_name text, partner_phone text, price_total numeric, cancelled_at timestamptz, cancel_reason text, refund_amount numeric, refund_status text)
language sql stable security definer set search_path = '' as $$
  select b.id, b.kind, b.service, b.summary, b.vehicle, b.details, b.status, b.made_at, b.partner_name,
    case when b.status in ('confirmed','onway','started') then g.phone else null end,
    b.price_total, b.cancelled_at, b.cancel_reason, b.refund_amount, b.refund_status
  from public.bookings b left join public.partners g on g.id = b.partner_id
  where b.customer_id = (select auth.uid()) and b.kind in ('Recovery','EV charging') and b.made_at >= p_from
  order by b.made_at desc limit 100
$$;
revoke all on function public.my_roadside(timestamptz) from public, anon;
grant execute on function public.my_roadside(timestamptz) to authenticated;

-- partner: their recovery or charging jobs with full details (for the dashboard and the monthly statement)
create or replace function public.my_roadside_jobs(p_from timestamptz default now() - interval '40 days')
returns table(id uuid, kind text, service text, summary text, vehicle jsonb, details jsonb, status text, made_at timestamptz,
  customer_name text, customer_phone text, partner_payout numeric, price_total numeric, our_share numeric, cancelled_at timestamptz, cancel_reason text)
language sql stable security definer set search_path = '' as $$
  select b.id, b.kind, b.service, b.summary, b.vehicle, b.details, b.status, b.made_at,
    b.customer_name, case when b.status = 'cancelled' then null else b.customer_phone end,
    b.partner_payout, b.price_total, b.our_share, b.cancelled_at, b.cancel_reason
  from public.bookings b
  where b.partner_id = (select auth.uid()) and b.kind in ('Recovery','EV charging') and b.made_at >= p_from
  order by b.made_at desc limit 500
$$;
revoke all on function public.my_roadside_jobs(timestamptz) from public, anon;
grant execute on function public.my_roadside_jobs(timestamptz) to authenticated;

-- staff: list, cancel with a refund, mark refunded (staff_mark_refunded already works for any booking)
create or replace function public.staff_roadside_bookings(p_from timestamptz default now() - interval '30 days')
returns table(id uuid, kind text, made_at timestamptz, status text, summary text, vehicle jsonb, details jsonb, customer_name text, customer_phone text,
  partner_name text, partner_phone text, price_total numeric, partner_payout numeric, our_share numeric, cancelled_at timestamptz, cancel_reason text,
  refund_amount numeric, refund_status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  return query select b.id, b.kind, b.made_at, b.status, b.summary, b.vehicle, b.details, b.customer_name, b.customer_phone,
    b.partner_name, g.phone, b.price_total, b.partner_payout, b.our_share, b.cancelled_at, b.cancel_reason, b.refund_amount, b.refund_status
  from public.bookings b left join public.partners g on g.id = b.partner_id
  where b.kind in ('Recovery','EV charging') and b.made_at >= p_from order by b.made_at desc limit 500;
end $$;
revoke all on function public.staff_roadside_bookings(timestamptz) from public, anon;
grant execute on function public.staff_roadside_bookings(timestamptz) to authenticated;

create or replace function public.staff_cancel_roadside(p_booking uuid, p_reason text, p_refund numeric default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.bookings; amt numeric;
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  select * into b from public.bookings where id = p_booking and kind in ('Recovery','EV charging') for update;
  if not found then raise exception 'no_booking'; end if;
  if b.status = 'cancelled' then raise exception 'already_cancelled'; end if;
  amt := coalesce(p_refund, b.price_total, 0);
  if amt < 0 or amt > coalesce(b.price_total,0) then raise exception 'bad_amount'; end if;
  update public.bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = left(coalesce(p_reason,''),300),
    cancelled_by = (select auth.uid()), refund_amount = amt, refund_status = case when amt > 0 then 'due' else null end,
    partner_payout = case when amt >= coalesce(b.price_total,0) then 0 else partner_payout end,
    our_share = case when amt >= coalesce(b.price_total,0) then 0 else our_share end
  where id = p_booking;
  return jsonb_build_object('cancelled', true, 'refund', amt);
end $$;
revoke all on function public.staff_cancel_roadside(uuid, text, numeric) from public, anon;
grant execute on function public.staff_cancel_roadside(uuid, text, numeric) to authenticated;

-- tell the partner when a recovery or charging job is cancelled (the customer already gets an email from mail_booking)
create or replace function private.mail_roadside_cancel() returns trigger
language plpgsql security definer set search_path = '' as $$
declare g public.partners;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and new.kind in ('Recovery','EV charging') and new.partner_id is not null
     and new.cancelled_by is distinct from new.partner_id then
    select * into g from public.partners where id = new.partner_id;
    if g.email is not null then
      perform private.mail(g.email, 'partner', 'Job cancelled: ' || new.kind || ' for ' || coalesce(nullif(new.customer_name,''),'a customer'),
        E'Hello,\n\nThis ' || lower(new.kind) || ' job has been cancelled: ' || coalesce(new.summary,'') ||
        E'\n\nReason: ' || coalesce(new.cancel_reason,'') ||
        case when coalesce(new.partner_payout,0) > 0 then E'\nYou were already on your way, so you are paid £' || to_char(new.partner_payout,'FM990.00') || ' for the call-out.' else E'\nPlease do not attend.' end ||
        E'\nReference: ' || upper(left(new.id::text,8)) || E'\n\nThe Motoring Central', '/#dashboard', 'roadside_cancel', 'rcan:' || new.id, new.id);
    end if;
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists bookings_roadside_cancel on public.bookings;
create trigger bookings_roadside_cancel after update of status on public.bookings for each row execute function private.mail_roadside_cancel();
