-- Dealer plans, fix (26 Nov 2026)
-- private.dealer_plan(i) always returned Starter: inside the function the parameter "i" was taken as the table's own column
-- "i", so every row matched and the first one won. The plan change itself was saved correctly; only the plan names in the
-- two emails were wrong (those emails were stopped before sending). The parameter is now read by position.
-- Also: the storage service needs to see a file before it can delete it, so logged-in users may now list the files in
-- their own folder of the advert-photos bucket (the photos are public anyway).

create or replace function private.dealer_plan(i int) returns table(name text, max_adverts int, price int, range_text text)
language sql immutable set search_path = '' as $$
  select t.name, t.max_adverts, t.price, t.range_text from (values
    (0, 'Starter', 10, 169, '1 to 10 cars'),
    (1, 'Standard', 20, 229, '11 to 20 cars'),
    (2, 'Plus', 30, 299, '21 to 30 cars'),
    (3, 'Pro', 50, 379, '31 to 50 cars'),
    (4, 'Premier', 1000000, 449, '51 or more cars')
  ) as t(n, name, max_adverts, price, range_text) where t.n = $1
$$;

drop policy if exists "advert photos: see own" on storage.objects;
create policy "advert photos: see own" on storage.objects for select to authenticated
  using (bucket_id = 'advert-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
