-- Trade listings (26 Nov 2026)
-- Until now "Trade cars and vans" only existed in the visitor's browser: nothing was saved and nobody else saw a listing.
-- Now listings and offers are kept here. Trade only: approved partners and dealers can browse, list, buy and make offers.
-- Everything goes through the functions below (the tables cannot be read or written directly), so:
-- - an "open to offers" listing never shows its hidden minimum to anyone but the seller, and an offer below it is turned
--   down without saying what the minimum is;
-- - the seller's phone and email are only shown to the buyer once a sale is agreed, and the buyer's to the seller;
-- - dealers get 5 free listings a calendar month, then 9.99 + VAT each; other partners pay 9.99 + VAT per listing (until
--   Stripe is connected the page takes the payment in test mode and says so here with p.paid).
-- Both sides are emailed: a new offer, a sale (with each other's contact details), a declined offer, a withdrawn listing.

create table if not exists public.trade_listings (
  id bigint generated always as identity primary key,
  seller_id uuid not null references public.partners(id) on delete cascade,
  kind text not null check (kind in ('Car','Van')),
  reg text not null default '' check (reg ~ '^[A-Z0-9]{0,8}$'),
  make text not null check (char_length(make) between 1 and 40),
  model text not null check (char_length(model) between 1 and 60),
  variant text not null default '' check (char_length(variant) <= 80),
  year int not null check (year between 1950 and 2100),
  miles int not null check (miles between 0 and 2000000),
  fuel text not null default '' check (char_length(fuel) <= 20),
  gear text not null default '' check (char_length(gear) <= 20),
  body text not null default '' check (char_length(body) <= 30),
  col text not null default '' check (char_length(col) <= 30),
  town text not null check (char_length(town) between 1 and 80),
  mot date,
  v5 text not null default 'Yes' check (char_length(v5) <= 20),
  hist text not null default '' check (char_length(hist) <= 30),
  faults text not null check (char_length(faults) between 2 and 1000),
  descr text not null default '' check (char_length(descr) <= 2000),
  mode text not null check (mode in ('min','offers')),
  price numeric(10,2) not null check (price > 0 and price < 1000000),
  photos jsonb not null default '[]'::jsonb,
  stock_id bigint,
  fee text not null check (fee in ('free','paid')),
  status text not null default 'live' check (status in ('live','sold','withdrawn')),
  buyer_id uuid references public.partners(id) on delete set null,
  sold_price numeric(10,2),
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trade_listings_live on public.trade_listings (status, created_at desc);
create index if not exists trade_listings_seller on public.trade_listings (seller_id, created_at desc);

create table if not exists public.trade_offers (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.trade_listings(id) on delete cascade,
  buyer_id uuid not null references public.partners(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0 and amount < 1000000),
  note text not null default '' check (char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists trade_offers_listing on public.trade_offers (listing_id);
create index if not exists trade_offers_buyer on public.trade_offers (buyer_id, created_at desc);

alter table public.trade_listings enable row level security;
alter table public.trade_offers enable row level security;
revoke all on public.trade_listings from anon, authenticated;
revoke all on public.trade_offers from anon, authenticated;

-- the logged-in approved partner or dealer, or an error
create or replace function private.trade_me() returns public.partners
language plpgsql stable security definer set search_path = '' as $$
declare p public.partners;
begin
  select * into p from public.partners where id = (select auth.uid()) and status = 'approved';
  if not found then raise exception 'trade_only'; end if;
  return p;
end $$;

create or replace function private.trade_title(l public.trade_listings) returns text
language sql immutable set search_path = '' as $$ select l.year || ' ' || l.make || ' ' || l.model $$;

-- free listings used this calendar month (dealers only get free ones)
create or replace function private.trade_used(p_seller uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.trade_listings where seller_id = p_seller and fee = 'free'
    and created_at >= date_trunc('month', now() at time zone 'Europe/London') at time zone 'Europe/London'
$$;

-- everything the trade pages show, for the logged-in partner
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

-- list a vehicle
create or replace function public.trade_add(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.partners := private.trade_me(); fee text; l public.trade_listings; ph jsonb := '[]'::jsonb;
begin
  if (select count(*) from public.trade_listings where seller_id = me.id and created_at > now() - interval '1 hour') >= 30 then raise exception 'too_many'; end if;
  fee := case when me.role = 'dealer' and private.trade_used(me.id) < 5 then 'free'
              when coalesce((p->>'paid')::boolean, false) then 'paid' end;
  if fee is null then raise exception 'fee_due'; end if;
  if jsonb_typeof(p->'photos') = 'array' then
    select coalesce(jsonb_agg(v), '[]'::jsonb) into ph from (select v from jsonb_array_elements_text(p->'photos') v
      where v ~ '^https://[A-Za-z0-9.-]+\.supabase\.co/storage/v1/object/public/advert-photos/' limit 30) z;
  end if;
  insert into public.trade_listings (seller_id, kind, reg, make, model, variant, year, miles, fuel, gear, body, col, town, mot, v5, hist,
    faults, descr, mode, price, photos, stock_id, fee)
  values (me.id, case when p->>'kind' = 'Van' then 'Van' else 'Car' end,
    left(upper(regexp_replace(coalesce(p->>'reg',''), '[^A-Za-z0-9]', '', 'g')), 8),
    btrim(coalesce(p->>'make','')), btrim(coalesce(p->>'model','')), left(btrim(coalesce(p->>'variant','')), 80),
    (p->>'year')::int, (p->>'miles')::int, left(coalesce(p->>'fuel',''), 20), left(coalesce(p->>'gear',''), 20),
    left(coalesce(p->>'body',''), 30), left(coalesce(p->>'col',''), 30), left(btrim(coalesce(p->>'town', me.town, '')), 80),
    nullif(p->>'mot','')::date, left(coalesce(p->>'v5','Yes'), 20), left(coalesce(p->>'hist',''), 30),
    btrim(coalesce(p->>'faults','')), left(btrim(coalesce(p->>'desc','')), 2000),
    case when p->>'mode' = 'offers' then 'offers' else 'min' end, round((p->>'price')::numeric, 2), ph,
    nullif(p->>'stockId','')::bigint, fee)
  returning * into l;
  return jsonb_build_object('id', l.id, 'fee', l.fee);
end $$;

-- buy at the minimum price
create or replace function public.trade_buy(p_listing bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.partners := private.trade_me(); l public.trade_listings; s public.partners;
begin
  select * into l from public.trade_listings where id = p_listing for update;
  if not found or l.status <> 'live' then raise exception 'not_available'; end if;
  if l.seller_id = me.id then raise exception 'own_listing'; end if;
  if l.mode <> 'min' then raise exception 'offers_only'; end if;
  select * into s from public.partners where id = l.seller_id;
  update public.trade_listings set status = 'sold', buyer_id = me.id, sold_price = l.price, sold_at = now(), updated_at = now() where id = l.id;
  update public.trade_offers set status = 'declined', decided_at = now() where listing_id = l.id and status = 'pending';
  insert into public.trade_offers (listing_id, buyer_id, amount, note, status, decided_at) values (l.id, me.id, l.price, 'Bought at minimum price', 'accepted', now());
  perform private.trade_mail_sale(l.id);
  return jsonb_build_object('ok', true, 'phone', s.phone, 'email', s.email);
end $$;

-- make an offer (an "open to offers" listing)
create or replace function public.trade_offer(p_listing bigint, p_amount numeric, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.partners := private.trade_me(); l public.trade_listings; s public.partners; a numeric := round(coalesce(p_amount, 0), 2);
begin
  select * into l from public.trade_listings where id = p_listing for update;
  if not found or l.status <> 'live' then raise exception 'not_available'; end if;
  if l.seller_id = me.id then raise exception 'own_listing'; end if;
  if l.mode <> 'offers' then raise exception 'buy_only'; end if;
  if a <= 0 or a >= 1000000 then raise exception 'bad_amount'; end if;
  if a < l.price then raise exception 'below_min'; end if;
  if (select count(*) from public.trade_offers where buyer_id = me.id and created_at > now() - interval '1 hour') >= 30 then raise exception 'too_many'; end if;
  -- one live offer per buyer per listing: a new one replaces the old
  update public.trade_offers set status = 'withdrawn', decided_at = now() where listing_id = l.id and buyer_id = me.id and status = 'pending';
  insert into public.trade_offers (listing_id, buyer_id, amount, note) values (l.id, me.id, a, left(btrim(coalesce(p_note,'')), 300));
  select * into s from public.partners where id = l.seller_id;
  perform private.mail(s.email, 'seller', 'New trade offer: £' || to_char(a, 'FM999,999,990') || ' for your ' || private.trade_title(l),
    'Hello,' || E'\n\n' || me.name || ' has offered £' || to_char(a, 'FM999,999,990') || ' for your ' || private.trade_title(l) ||
    case when l.reg <> '' then ' (' || l.reg || ')' else '' end || ' on the trade section.' ||
    case when btrim(coalesce(p_note,'')) <> '' then E'\n\nTheir message: ' || left(btrim(p_note), 300) else '' end ||
    E'\n\nAccept or decline it under Trade, My listings. Accepting it agrees the sale, and you are both given each other''s contact details.\n\nThe Motoring Central',
    '/#trade', 'trade_offer', 'toffer:' || l.id || ':' || me.id || ':' || to_char(now(), 'YYYYMMDDHH24MI'));
  return jsonb_build_object('ok', true);
end $$;

-- the seller accepts or declines an offer
create or replace function public.trade_decide(p_offer bigint, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.partners := private.trade_me(); o public.trade_offers; l public.trade_listings; b public.partners;
begin
  select * into o from public.trade_offers where id = p_offer for update;
  if not found then raise exception 'not_found'; end if;
  select * into l from public.trade_listings where id = o.listing_id for update;
  if l.seller_id <> me.id then raise exception 'not_yours'; end if;
  if o.status <> 'pending' or l.status <> 'live' then raise exception 'not_open'; end if;
  select * into b from public.partners where id = o.buyer_id;
  if coalesce(p_accept, false) then
    update public.trade_offers set status = 'accepted', decided_at = now() where id = o.id;
    update public.trade_offers set status = 'declined', decided_at = now() where listing_id = l.id and status = 'pending' and id <> o.id;
    update public.trade_listings set status = 'sold', buyer_id = o.buyer_id, sold_price = o.amount, sold_at = now(), updated_at = now() where id = l.id;
    perform private.trade_mail_sale(l.id);
    return jsonb_build_object('ok', true, 'sold', true, 'name', b.name, 'phone', b.phone, 'email', b.email);
  end if;
  update public.trade_offers set status = 'declined', decided_at = now() where id = o.id;
  perform private.mail(b.email, 'buyer', 'Trade offer declined: ' || private.trade_title(l),
    'Hello,' || E'\n\n' || me.name || ' has declined your offer of £' || to_char(o.amount, 'FM999,999,990') || ' for the ' || private.trade_title(l) ||
    E'. You can make a new offer while the vehicle is still listed, under Trade.\n\nThe Motoring Central',
    '/#trade', 'trade_declined', 'tdecl:' || o.id);
  return jsonb_build_object('ok', true, 'sold', false);
end $$;

-- the seller takes a listing down; anyone with an offer waiting is told
create or replace function public.trade_withdraw(p_listing bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.partners := private.trade_me(); l public.trade_listings; r record; n int := 0;
begin
  select * into l from public.trade_listings where id = p_listing for update;
  if not found or l.seller_id <> me.id then raise exception 'not_yours'; end if;
  if l.status <> 'live' then return jsonb_build_object('ok', true, 'declined', 0); end if;
  update public.trade_listings set status = 'withdrawn', updated_at = now() where id = l.id;
  for r in select o.id, o.amount, b.email from public.trade_offers o join public.partners b on b.id = o.buyer_id
           where o.listing_id = l.id and o.status = 'pending' loop
    update public.trade_offers set status = 'declined', decided_at = now() where id = r.id;
    perform private.mail(r.email, 'buyer', 'Trade listing withdrawn: ' || private.trade_title(l),
      'Hello,' || E'\n\n' || me.name || ' has taken the ' || private.trade_title(l) || ' off the trade section, so your offer of £' ||
      to_char(r.amount, 'FM999,999,990') || E' has closed.\n\nThe Motoring Central', '/#trade', 'trade_withdrawn', 'twd:' || r.id);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'declined', n);
end $$;

-- the buyer withdraws an offer that is still waiting
create or replace function public.trade_offer_withdraw(p_offer bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.partners := private.trade_me();
begin
  update public.trade_offers set status = 'withdrawn', decided_at = now() where id = p_offer and buyer_id = me.id and status = 'pending';
  if not found then raise exception 'not_open'; end if;
end $$;

-- a sale is agreed: both sides get each other's details
create or replace function private.trade_mail_sale(p_listing bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.trade_listings; s public.partners; b public.partners; t text; amt text;
begin
  select * into l from public.trade_listings where id = p_listing;
  select * into s from public.partners where id = l.seller_id;
  select * into b from public.partners where id = l.buyer_id;
  t := private.trade_title(l) || case when l.reg <> '' then ' (' || l.reg || ')' else '' end;
  amt := '£' || to_char(l.sold_price, 'FM999,999,990');
  perform private.mail(s.email, 'seller', 'Trade sale agreed: ' || t || ' for ' || amt,
    'Hello,' || E'\n\nYou have sold the ' || t || ' to ' || b.name || ' for ' || amt || E'.\n\nContact them to arrange payment and collection:\n' ||
    b.name || E'\nPhone: ' || coalesce(nullif(b.phone,''), 'not given') || E'\nEmail: ' || b.email ||
    E'\n\nThe sale is between your two businesses: sold as seen, trade to trade, with no warranty. Hand over the vehicle only once you have been paid.\n\nThe Motoring Central',
    '/#trade', 'trade_sold', 'tsold:s:' || l.id);
  perform private.mail(b.email, 'buyer', 'Trade purchase agreed: ' || t || ' for ' || amt,
    'Hello,' || E'\n\nYou are buying the ' || t || ' from ' || s.name || ' for ' || amt || E'.\n\nContact them to arrange payment and collection:\n' ||
    s.name || E'\nPhone: ' || coalesce(nullif(s.phone,''), 'not given') || E'\nEmail: ' || s.email || E'\nVehicle location: ' || l.town ||
    E'\n\nIt is sold as seen, trade to trade, with no warranty. Check the vehicle yourself before you pay.\n\nThe Motoring Central',
    '/#trade', 'trade_sold', 'tsold:b:' || l.id);
end $$;

revoke all on function public.trade_state(), public.trade_add(jsonb), public.trade_buy(bigint), public.trade_offer(bigint, numeric, text),
  public.trade_decide(bigint, boolean), public.trade_withdraw(bigint), public.trade_offer_withdraw(bigint) from public, anon;
grant execute on function public.trade_state(), public.trade_add(jsonb), public.trade_buy(bigint), public.trade_offer(bigint, numeric, text),
  public.trade_decide(bigint, boolean), public.trade_withdraw(bigint), public.trade_offer_withdraw(bigint) to authenticated;
revoke all on function private.trade_me(), private.trade_used(uuid), private.trade_mail_sale(bigint) from public, anon, authenticated;
