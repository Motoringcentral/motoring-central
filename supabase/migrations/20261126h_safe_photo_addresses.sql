-- Safe photo addresses (26 Nov 2026)
-- Advert and trade listing photos are uploaded to our own storage, so a real photo address always looks like
--   https://<project>.supabase.co/storage/v1/object/public/advert-photos/<folder>/<file>.jpg
-- Until now the database did not check advert photos at all, and trade listings only checked how the address started.
-- Someone sending their own request could have saved an address with extra characters that the page then treated as
-- code (in the browsers of staff approving adverts, or of other dealers on the trade pages). The page now makes every
-- picture address safe before showing it; this also stops such addresses being saved: anything else is dropped.

create or replace function private.safe_photos(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(e.v) order by e.n), '[]'::jsonb)
  from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) with ordinality e(v, n)
  where e.n <= 100 and e.v ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/advert-photos/[A-Za-z0-9/_.-]+$'
$$;

create or replace function private.advert_photos_ok() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.data ? 'photos' then new.data := jsonb_set(new.data, '{photos}', private.safe_photos(new.data->'photos')); end if;
  return new;
end $$;
drop trigger if exists adverts_photos_ok on public.adverts;
create trigger adverts_photos_ok before insert or update of data on public.adverts
  for each row execute function private.advert_photos_ok();

create or replace function private.trade_photos_ok() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.photos := private.safe_photos(new.photos);
  return new;
end $$;
drop trigger if exists trade_listings_photos_ok on public.trade_listings;
create trigger trade_listings_photos_ok before insert or update of photos on public.trade_listings
  for each row execute function private.trade_photos_ok();

revoke all on function private.safe_photos(jsonb), private.advert_photos_ok(), private.trade_photos_ok() from public, anon, authenticated;
