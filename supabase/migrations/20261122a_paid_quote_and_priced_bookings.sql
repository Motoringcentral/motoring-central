-- Quote and priced (valet / alloy) bookings are paid online before they are made, so they are recorded as paid,
-- like MOT, EV and recovery bookings. Valet and alloy bookings now store the job day, so payouts and the partner's
-- diary use the real job date. Only paid bookings count towards a weekly payout. (22 Nov 2026)

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
      to_char(p_day, 'FMDay FMDD FMMonth') || ' (' || tl || '). Fixed price £' || to_char(o.price, 'FM999,990.00') || ' plus £3.00 booking fee. ' ||
      coalesce(nullif(j.summary,''), ''),
    j.vehicle, 'confirmed', now(), g.id, g.name, o.price + fee, round(fee + o.price * rate, 2), round(o.price * (1 - rate), 2), true, p_day,
    j.details || jsonb_build_object('quote_job', j.id, 'quote_offer', o.id, 'time', tl))
  returning id into bid;
  update public.quote_jobs set status = 'booked', booking_id = bid where id = j.id;
  update public.quote_offers set status = case when id = o.id then 'accepted' else 'not_chosen' end where job_id = j.id;
  return bid;
end $$;
create or replace function public.book_priced(p_kind text, p_partner uuid, p_opts jsonb, p_summary text, p_vehicle jsonb, p_day date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d date := case when p_day between (now() at time zone 'Europe/London')::date and (now() at time zone 'Europe/London')::date + 60 then p_day end; g public.partners; price numeric; fee numeric := 3; rate numeric; n int; k int; bid uuid; r jsonb; col text;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.profiles where id = (select auth.uid())) then raise exception 'not_customer'; end if;
  select * into g from public.partners where id = p_partner and status = 'approved';
  if not found then raise exception 'partner_unavailable'; end if;
  r := coalesce(g.rates, '{}'::jsonb);
  if p_kind = 'Valet' then
    if g.role <> 'valet' then raise exception 'bad_partner'; end if;
    k := (p_opts->>'size')::int; if k is null or k not between 0 and 3 then raise exception 'bad_size'; end if;
    price := (r->'p'->>k)::numeric;
  elsif p_kind = 'Alloy wheels' then
    if g.role <> 'body' then raise exception 'bad_partner'; end if;
    n := (p_opts->>'wheels')::int; if n is null or n not between 1 and 5 then raise exception 'bad_wheels'; end if;
    col := case (p_opts->>'finish')::int when 0 then 'wheel' when 1 then 'dcut' when 2 then 'col' when 3 then 'kerb' end;
    if col is null then raise exception 'bad_finish'; end if;
    if col = 'dcut' and coalesce(p_opts->>'where','') = 'mobile' then raise exception 'bad_finish'; end if;
    price := (r->>col)::numeric * n;
  else raise exception 'bad_kind'; end if;
  if price is null or price <= 0 then raise exception 'not_offered'; end if;
  rate := case when g.plan = 'pro' then 0 else 0.06 end;   -- Pay as you go: 5% + VAT; Pro: 0%
  insert into public.bookings (customer_id, kind, service, summary, vehicle, status, made_at, partner_id, partner_name,
    price_total, our_share, partner_payout, paid, slot_day, details)
  values ((select auth.uid()), p_kind, case when p_kind = 'Valet' then 'Full valet' else 'Alloy wheel refurb' end, left(coalesce(p_summary,''), 2000),
    p_vehicle, 'confirmed', now(), g.id, g.name, price + fee, round(fee + price * rate, 2), round(price * (1 - rate), 2), true, d, p_opts)
  returning id into bid;
  return jsonb_build_object('id', bid, 'price', price, 'total', price + fee);
end $$;
create or replace function private.week_lines(p_partner uuid, p_week date)
returns table (booking_id uuid, job_day date, kind text, service text, vehicle text, customer_paid numeric, our_fee numeric, payout numeric, status text)
language sql stable security definer set search_path = '' as $$
  select b.id, coalesce(b.slot_day, (b.made_at at time zone 'Europe/London')::date), b.kind, coalesce(nullif(b.service,''), b.kind),
         upper(coalesce(b.vehicle->>'reg','')), coalesce(b.price_total,0), coalesce(b.our_share,0), coalesce(b.partner_payout,0), b.status
  from public.bookings b
  where b.partner_id = p_partner and b.partner_payout is not null and b.paid
    and coalesce(b.slot_day, (b.made_at at time zone 'Europe/London')::date) between p_week and p_week + 6
    and (b.status <> 'cancelled' or (upper(coalesce(b.kind,'')) <> 'MOT' and b.partner_payout > 0))
  order by 2, b.made_at;
$$;

