-- Saved cars and vans, saved searches on the account with email alerts, partner reviews kept on our system, and a
-- staff tool to hide unfair reviews (21 Nov 2026)

-- 1. saved cars/vans and saved searches
create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('advert','search')),
  advert_id bigint references public.adverts(id) on delete cascade,
  search jsonb,
  search_kind text check (search_kind in ('cars','vans')),
  name text,
  alerts boolean not null default true,
  last_price numeric(10,2),
  seen_ids bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  check ((kind = 'advert' and advert_id is not null) or (kind = 'search' and search is not null and search_kind is not null))
);
create unique index if not exists saved_items_one_advert on public.saved_items(user_id, advert_id) where kind = 'advert';
alter table public.saved_items enable row level security;
drop policy if exists "saved items: own" on public.saved_items;
create policy "saved items: own" on public.saved_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.saved_items to authenticated;

-- the price and the ids already seen are set by the database, not the browser
create or replace function private.saved_items_fill() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'advert' then
    select (a.data->>'price')::numeric into new.last_price from public.adverts a where a.id = new.advert_id;
  elsif tg_op = 'INSERT' then
    new.seen_ids := coalesce((select array_agg(a.id) from public.adverts a
      where a.status = 'live' and a.kind = new.search_kind and private.advert_matches(new.search, a.data)), '{}');
  end if;
  if tg_op = 'UPDATE' then new.seen_ids := old.seen_ids; new.last_price := old.last_price; new.user_id := old.user_id; end if;
  new.name := left(coalesce(new.name,''), 200);
  return new;
end $$;

-- does an advert match a saved search? (distance and monthly price are not checked for alerts)
create or replace function private.advert_matches(s jsonb, d jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare price numeric; yr int; mi int;
begin
  begin price := (d->>'price')::numeric; exception when others then price := null; end;
  begin yr := (d->>'year')::int; exception when others then yr := null; end;
  begin mi := (d->>'miles')::int; exception when others then mi := null; end;
  if coalesce(s->>'make','') <> '' and coalesce(d->>'make','') <> s->>'make' then return false; end if;
  if coalesce(s->>'model','') <> '' and coalesce(d->>'model','') <> s->>'model' then return false; end if;
  if coalesce((s->>'pmin')::numeric,0) > 0 and coalesce(price,0) < (s->>'pmin')::numeric then return false; end if;
  if coalesce((s->>'pmax')::numeric,0) > 0 and coalesce(price,0) > (s->>'pmax')::numeric then return false; end if;
  if coalesce((s->>'ymin')::int,0) > 0 and coalesce(yr,0) < (s->>'ymin')::int then return false; end if;
  if coalesce((s->>'ymax')::int,0) > 0 and coalesce(yr,9999) > (s->>'ymax')::int then return false; end if;
  if coalesce((s->>'miles')::int,0) > 0 and coalesce(mi,0) > (s->>'miles')::int then return false; end if;
  if coalesce(s->>'gear','') <> '' and coalesce(d->>'gear','') <> s->>'gear' then return false; end if;
  if jsonb_typeof(s->'fuel') = 'array' and jsonb_array_length(s->'fuel') > 0 and not (s->'fuel') ? coalesce(d->>'fuel','') then return false; end if;
  if jsonb_typeof(s->'body') = 'array' and jsonb_array_length(s->'body') > 0 and not (s->'body') ? coalesce(d->>'body','') then return false; end if;
  if jsonb_typeof(s->'col') = 'array' and jsonb_array_length(s->'col') > 0 and not (s->'col') ? coalesce(d->>'col','') then return false; end if;
  if s->>'seller' = 'private' and coalesce((d->>'private')::boolean, false) = false then return false; end if;
  if s->>'seller' = 'trade' and coalesce((d->>'private')::boolean, false) = true then return false; end if;
  if s->>'wo' = 'hide' and coalesce(d->>'wo','no') not in ('no','') then return false; end if;
  return true;
exception when others then return false;
end $$;

drop trigger if exists saved_items_fill on public.saved_items;
create trigger saved_items_fill before insert or update on public.saved_items
  for each row execute function private.saved_items_fill();

-- daily: price drops on saved cars and new matches for saved searches, one email per person
create or replace function private.queue_saved_alerts() returns int
language plpgsql security definer set search_path = '' as $$
declare u record; lines text; n int := 0; r record; newids bigint[]; nm int;
begin
  for u in select distinct s.user_id from public.saved_items s where s.alerts loop
    lines := '';
    for r in select s.id, a.id aid, a.data, s.last_price, (a.data->>'price')::numeric now_price
             from public.saved_items s join public.adverts a on a.id = s.advert_id
             where s.user_id = u.user_id and s.kind = 'advert' and s.alerts and a.status = 'live'
               and s.last_price is not null and (a.data->>'price')::numeric < s.last_price loop
      lines := lines || E'\n- Price drop: ' || coalesce(r.data->>'year','') || ' ' || coalesce(r.data->>'make','') || ' ' || coalesce(r.data->>'model','') ||
        ' now £' || to_char(r.now_price, 'FM999,999,990') || ' (was £' || to_char(r.last_price, 'FM999,999,990') || ')';
      update public.saved_items set last_price = r.now_price where id = r.id;
    end loop;
    update public.saved_items s set last_price = (a.data->>'price')::numeric from public.adverts a
      where a.id = s.advert_id and s.user_id = u.user_id and s.kind = 'advert' and (a.data->>'price')::numeric > coalesce(s.last_price,0);
    for r in select s.id, s.name, s.search, s.search_kind, s.seen_ids from public.saved_items s
             where s.user_id = u.user_id and s.kind = 'search' and s.alerts loop
      select array_agg(a.id) into newids from public.adverts a
        where a.status = 'live' and a.kind = r.search_kind and not (a.id = any(r.seen_ids)) and private.advert_matches(r.search, a.data);
      nm := coalesce(array_length(newids,1),0);
      if nm > 0 then
        lines := lines || E'\n- ' || nm || ' new ' || case when r.search_kind = 'vans' then 'van' else 'car' end || case when nm = 1 then '' else 's' end ||
          ' for your saved search: ' || coalesce(nullif(r.name,''),'your search');
        update public.saved_items set seen_ids = (seen_ids || newids)[greatest(1, array_length(seen_ids || newids,1) - 999):] where id = r.id;
      end if;
    end loop;
    if lines <> '' then
      perform private.mail(private.user_email(u.user_id), 'customer', 'Updates on the cars and vans you saved',
        E'Hello,\n\nHere is what changed since yesterday:\n' || lines ||
        E'\n\nOpen My account to see them. You can turn these emails off for each saved car or search there.\n\nThe Motoring Central',
        '/#account', 'saved_alerts', 'saved:' || u.user_id || ':' || to_char(now(), 'YYYYMMDD'));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

select cron.unschedule('saved-alerts') where exists (select 1 from cron.job where jobname = 'saved-alerts');
select cron.schedule('saved-alerts', '0 8 * * *', 'select private.queue_saved_alerts(); select private.kick_notify()');

-- 2. partner reviews kept on our system (one per finished booking)
create table if not exists public.partner_reviews (
  id bigint generated always as identity primary key,
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  partner_name text,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text,
  rating int not null check (rating between 1 and 5),
  body text check (length(body) <= 600),
  recommend boolean not null default true,
  service text,
  hidden boolean not null default false,
  hidden_reason text,
  hidden_at timestamptz,
  hidden_by uuid,
  created_at timestamptz not null default now()
);
alter table public.partner_reviews enable row level security;

create or replace function private.partner_review_fill() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = new.booking_id;
  if not found or b.customer_id is distinct from (select auth.uid()) or b.partner_id is null then raise exception 'not_your_booking'; end if;
  if b.status <> 'done' then raise exception 'not_finished'; end if;
  new.author_id := b.customer_id; new.partner_id := b.partner_id;
  new.partner_name := (select name from public.partners where id = b.partner_id);
  new.service := coalesce(nullif(b.service,''), b.kind);
  new.author_name := left(coalesce(nullif(btrim(new.author_name),''), 'Customer'), 60);
  new.hidden := false; new.hidden_reason := null; new.hidden_at := null; new.hidden_by := null;
  return new;
end $$;
drop trigger if exists partner_review_fill on public.partner_reviews;
create trigger partner_review_fill before insert on public.partner_reviews
  for each row execute function private.partner_review_fill();

drop policy if exists "partner reviews: visible to everyone" on public.partner_reviews;
create policy "partner reviews: visible to everyone" on public.partner_reviews for select to anon, authenticated
  using (not hidden or author_id = (select auth.uid()) or (select private.is_staff()));
drop policy if exists "partner reviews: customer adds for own finished booking" on public.partner_reviews;
create policy "partner reviews: customer adds for own finished booking" on public.partner_reviews for insert to authenticated
  with check (author_id = (select auth.uid()));
grant select on public.partner_reviews to anon, authenticated;
grant insert (booking_id, rating, body, recommend, author_name) on public.partner_reviews to authenticated;

-- 3. dealer reviews can be hidden too
alter table public.dealer_reviews add column if not exists hidden boolean not null default false;
alter table public.dealer_reviews add column if not exists hidden_reason text;
alter table public.dealer_reviews add column if not exists hidden_at timestamptz;
alter table public.dealer_reviews add column if not exists hidden_by uuid;

-- 4. staff: hide or show a review, with a reason
create or replace function public.staff_review_hide(p_kind text, p_id bigint, p_hide boolean, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  if p_hide and length(btrim(coalesce(p_reason,''))) < 3 then raise exception 'need_reason'; end if;
  if p_kind = 'partner' then
    update public.partner_reviews set hidden = p_hide, hidden_reason = case when p_hide then left(p_reason,300) end,
      hidden_at = case when p_hide then now() end, hidden_by = case when p_hide then (select auth.uid()) end where id = p_id;
  elsif p_kind = 'dealer' then
    update public.dealer_reviews set hidden = p_hide, hidden_reason = case when p_hide then left(p_reason,300) end,
      hidden_at = case when p_hide then now() end, hidden_by = case when p_hide then (select auth.uid()) end where id = p_id;
  else raise exception 'bad_kind'; end if;
  if not found then raise exception 'not_found'; end if;
end $$;
revoke all on function public.staff_review_hide(text, bigint, boolean, text) from public, anon;
grant execute on function public.staff_review_hide(text, bigint, boolean, text) to authenticated;

drop policy if exists "dealer reviews: public read" on public.dealer_reviews;
create policy "dealer reviews: public read" on public.dealer_reviews for select to anon, authenticated
  using (not hidden or author_id = (select auth.uid()) or (select private.is_staff()));
revoke update on public.dealer_reviews from anon, authenticated;
grant update (rating, body) on public.dealer_reviews to authenticated;

-- (fix) people can only change the name and alerts; the daily alert job (no logged-in user) moves the price and seen list
create or replace function private.saved_items_fill() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (select auth.uid()) is not null then
      new.seen_ids := old.seen_ids; new.last_price := old.last_price; new.user_id := old.user_id;
      new.kind := old.kind; new.advert_id := old.advert_id; new.search := old.search; new.search_kind := old.search_kind;
    end if;
  elsif new.kind = 'advert' then
    select (a.data->>'price')::numeric into new.last_price from public.adverts a where a.id = new.advert_id;
  else
    new.seen_ids := coalesce((select array_agg(a.id) from public.adverts a
      where a.status = 'live' and a.kind = new.search_kind and private.advert_matches(new.search, a.data)), '{}');
  end if;
  new.name := left(coalesce(new.name,''), 200);
  return new;
end $$;

-- (fix) visitors who are not logged in cannot run private.is_staff(), so they get their own read rules
drop policy if exists "partner reviews: visible to everyone" on public.partner_reviews;
create policy "partner reviews: visible to everyone" on public.partner_reviews for select to anon using (not hidden);
create policy "partner reviews: visible to logged-in" on public.partner_reviews for select to authenticated
  using (not hidden or author_id = (select auth.uid()) or (select private.is_staff()));
drop policy if exists "dealer reviews: public read" on public.dealer_reviews;
create policy "dealer reviews: public read" on public.dealer_reviews for select to anon using (not hidden);
create policy "dealer reviews: logged-in read" on public.dealer_reviews for select to authenticated
  using (not hidden or author_id = (select auth.uid()) or (select private.is_staff()));
