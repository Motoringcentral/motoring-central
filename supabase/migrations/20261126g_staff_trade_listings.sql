-- Staff screen for trade listings (26 Nov 2026)
-- Staff can see every trade listing (live, sold, withdrawn) with the seller, the buyer, the hidden minimum, the fee and
-- every offer, so they can answer a partner who gets in touch. They can take a live listing down when it breaks the
-- rules: a reason is required, the seller is emailed it and sees it on their trade page, anyone with an offer waiting is
-- told the listing has closed, and who did it and when is kept on the listing.

alter table public.trade_listings add column if not exists removed_reason text check (char_length(removed_reason) <= 500);
alter table public.trade_listings add column if not exists removed_by text;
alter table public.trade_listings add column if not exists removed_at timestamptz;

create or replace function public.staff_trade_listings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  return coalesce((select jsonb_agg(x order by x->>'listed' desc) from (
    select jsonb_build_object(
      'id', l.id, 'kind', l.kind, 'reg', l.reg, 'make', l.make, 'model', l.model, 'variant', l.variant, 'year', l.year, 'miles', l.miles,
      'town', l.town, 'faults', l.faults, 'desc', l.descr, 'mode', l.mode, 'price', l.price, 'photos', l.photos, 'fee', l.fee,
      'from_stock', l.stock_id is not null, 'status', l.status, 'listed', l.created_at, 'updated', l.updated_at,
      'seller', jsonb_build_object('name', s.name, 'role', s.role, 'email', s.email, 'phone', s.phone, 'town', s.town),
      'buyer', case when b.id is not null then jsonb_build_object('name', b.name, 'role', b.role, 'email', b.email, 'phone', b.phone) end,
      'sold_price', l.sold_price, 'sold_at', l.sold_at,
      'removed', case when l.removed_at is not null then jsonb_build_object('reason', l.removed_reason, 'by', l.removed_by, 'at', l.removed_at) end,
      'offers', coalesce((select jsonb_agg(jsonb_build_object('from', ob.name, 'amount', o.amount, 'note', o.note, 'status', o.status, 't', o.created_at)
          order by o.created_at) from public.trade_offers o join public.partners ob on ob.id = o.buyer_id where o.listing_id = l.id), '[]'::jsonb)
    ) as x
    from public.trade_listings l join public.partners s on s.id = l.seller_id left join public.partners b on b.id = l.buyer_id
    order by l.created_at desc limit 1000) q), '[]'::jsonb);
end $$;

create or replace function public.staff_trade_remove(p_listing bigint, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me text; why text := left(btrim(coalesce(p_reason,'')), 500); l public.trade_listings; s public.partners; r record; n int := 0;
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  if char_length(why) < 3 then raise exception 'need_reason'; end if;
  select coalesce(st.name, 'Staff') into me from public.staff st where st.user_id = (select auth.uid());
  select * into l from public.trade_listings where id = p_listing for update;
  if not found then raise exception 'not_found'; end if;
  if l.status <> 'live' then raise exception 'not_live'; end if;
  update public.trade_listings set status = 'withdrawn', removed_reason = why, removed_by = coalesce(me, 'Staff'), removed_at = now(), updated_at = now()
    where id = l.id;
  select * into s from public.partners where id = l.seller_id;
  perform private.mail(s.email, 'seller', 'Your trade listing has been taken down: ' || private.trade_title(l),
    'Hello,' || E'\n\nWe have taken your ' || private.trade_title(l) || case when l.reg <> '' then ' (' || l.reg || ')' else '' end ||
    E' off the trade section.\n\nThe reason: ' || why ||
    E'\n\nIf you think this is a mistake, or you would like to list it again once it is put right, just reply to this email.\n\nThe Motoring Central',
    '/#trade', 'trade_removed', 'trem:' || l.id);
  for r in select o.id, o.amount, b.email from public.trade_offers o join public.partners b on b.id = o.buyer_id
           where o.listing_id = l.id and o.status = 'pending' loop
    update public.trade_offers set status = 'declined', decided_at = now() where id = r.id;
    perform private.mail(r.email, 'buyer', 'Trade listing closed: ' || private.trade_title(l),
      'Hello,' || E'\n\nThe ' || private.trade_title(l) || ' is no longer listed on the trade section, so your offer of £' ||
      to_char(r.amount, 'FM999,999,990') || E' has closed.\n\nThe Motoring Central', '/#trade', 'trade_withdrawn', 'twd:' || r.id);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'offers_closed', n, 'email', s.email);
end $$;

-- the trade pages (as 20261126f) now also tell the seller why staff took a listing down
create or replace function public.trade_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.partners := private.trade_me();
begin
  return jsonb_build_object(
    'me', me.id, 'role', me.role, 'used', private.trade_used(me.id),
    'listings', coalesce((
      select jsonb_agg(x order by x->>'listed' desc) from (
        select jsonb_build_object(
          'id', l.id, 'kind', l.kind, 'make', l.make, 'model', l.model, 'variant', l.variant, 'year', l.year, 'miles', l.miles,
          'fuel', l.fuel, 'gear', l.gear, 'body', l.body, 'col', l.col, 'town', l.town, 'mot', l.mot, 'v5', l.v5, 'hist', l.hist,
          'faults', l.faults, 'desc', l.descr, 'mode', l.mode, 'photos', l.photos, 'status', l.status, 'listed', l.created_at,
          'mine', l.seller_id = me.id, 'seller', s.name, 'stype', case when s.role = 'dealer' then 'dealer' else 'partner' end,
          -- the price is public only for "minimum price" listings; the hidden minimum is for the seller's eyes only
          'price', case when l.mode = 'min' or l.seller_id = me.id then l.price end,
          'reg', case when l.seller_id = me.id then l.reg else '' end,
          'fee', case when l.seller_id = me.id then l.fee end,
          'stockId', case when l.seller_id = me.id then l.stock_id end,
          'removed', case when l.seller_id = me.id and l.removed_at is not null then l.removed_reason end,
          -- contact details once a sale is agreed
          'phone', case when l.buyer_id = me.id then s.phone end,
          'email', case when l.buyer_id = me.id then s.email end,
          'buyer', case when l.status = 'sold' and (l.seller_id = me.id or l.buyer_id = me.id) then jsonb_build_object(
            'name', b.name, 'amount', l.sold_price, 'phone', case when l.seller_id = me.id then b.phone end,
            'email', case when l.seller_id = me.id then b.email end, 'me', l.buyer_id = me.id) end,
          'offers', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'from', ob.name, 'amount', o.amount, 'note', o.note,
              'status', o.status, 't', o.created_at, 'mine', o.buyer_id = me.id) order by o.created_at)
            from public.trade_offers o join public.partners ob on ob.id = o.buyer_id
            where o.listing_id = l.id and (l.seller_id = me.id or o.buyer_id = me.id)), '[]'::jsonb)
        ) as x
        from public.trade_listings l join public.partners s on s.id = l.seller_id left join public.partners b on b.id = l.buyer_id
        where l.status = 'live' or l.seller_id = me.id or l.buyer_id = me.id
           or exists (select 1 from public.trade_offers o where o.listing_id = l.id and o.buyer_id = me.id)
        order by l.created_at desc limit 500) q), '[]'::jsonb));
end $$;

revoke all on function public.staff_trade_listings(), public.staff_trade_remove(bigint, text) from public, anon;
grant execute on function public.staff_trade_listings(), public.staff_trade_remove(bigint, text) to authenticated;
