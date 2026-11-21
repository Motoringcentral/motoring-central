-- Valet and alloy wheel bookings with a real partner: the price is worked out on the server from the partner's own
-- rates, so it is recorded on the booking and counts in the weekly payout (21 Nov 2026)
create or replace function public.book_priced(p_kind text, p_partner uuid, p_opts jsonb, p_summary text, p_vehicle jsonb, p_day date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g public.partners; price numeric; fee numeric := 3; rate numeric; n int; k int; bid uuid; r jsonb; col text;
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
    p_vehicle, 'confirmed', now(), g.id, g.name, price + fee, round(fee + price * rate, 2), round(price * (1 - rate), 2), false, p_day, p_opts)
  returning id into bid;
  return jsonb_build_object('id', bid, 'price', price, 'total', price + fee);
end $$;
revoke all on function public.book_priced(text, uuid, jsonb, text, jsonb, date) from public, anon;
grant execute on function public.book_priced(text, uuid, jsonb, text, jsonb, date) to authenticated;
