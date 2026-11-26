-- Dealer plans (26 Nov 2026)
-- Found when testing the dealer tools: since the two-step sign-up (22 Nov) the plan a dealer picks on the join form was
-- never saved, so every dealer was stored as 'payg' and treated as Starter; and there was no way to change plan, although
-- the site says "switch plans or leave at the end of any month".
-- Plans are stored as their number: 0 Starter (up to 10 vehicles), 1 Standard (20), 2 Plus (30), 3 Pro (50), 4 Premier
-- (no limit). Names, limits and prices must match window.DPLANS in index.html.
-- Changing plan: it takes effect straight away for the number of adverts, and the new monthly price applies from the next
-- bill (or after the free trial). A smaller plan is refused while the dealer has more adverts than it allows. A dealer who
-- has paid for a year can move up (we invoice the difference) but not down until renewal. The owners and the dealer are
-- emailed. Every change is kept in details.planlog.
-- Also: anyone logged in may delete files in their own folder of the advert-photos bucket (until now nothing could be
-- deleted, so photos of removed adverts could never be cleaned up).

create or replace function private.dealer_plan(i int) returns table(name text, max_adverts int, price int, range_text text)
language sql immutable set search_path = '' as $$
  select t.name, t.max_adverts, t.price, t.range_text from (values
    (0, 'Starter', 10, 169, '1 to 10 cars'),
    (1, 'Standard', 20, 229, '11 to 20 cars'),
    (2, 'Plus', 30, 299, '21 to 30 cars'),
    (3, 'Pro', 50, 379, '31 to 50 cars'),
    (4, 'Premier', 1000000, 449, '51 or more cars')
  ) as t(i, name, max_adverts, price, range_text) where t.i = i
$$;

-- dealers stored as 'payg' (or anything else) have been treated as Starter: store that properly
update public.partners set plan = '0' where role = 'dealer' and coalesce(plan, '') !~ '^[0-4]$';

-- the application now carries the dealer's plan
drop function if exists public.submit_application(text, text, text, text, text, jsonb, jsonb);
create or replace function public.submit_application(p_name text, p_phone text, p_town text, p_website text, p_sub text,
  p_rates jsonb, p_details jsonb, p_plan text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.partners;
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  select * into g from public.partners where id = uid for update;
  if not found then raise exception 'not_partner'; end if;
  if g.status <> 'started' then raise exception 'already_sent'; end if;
  if btrim(coalesce(p_name,'')) = '' then raise exception 'name_needed'; end if;
  if pg_column_size(coalesce(p_details,'{}'::jsonb)) > 40000 or pg_column_size(coalesce(p_rates,'{}'::jsonb)) > 2000 then raise exception 'too_big'; end if;
  perform set_config('mc.self_cancel', '1', true);
  update public.partners set name = left(btrim(p_name), 160), phone = left(coalesce(p_phone,''), 30), town = left(coalesce(p_town,''), 80),
    website = left(nullif(btrim(coalesce(p_website,'')),''), 200), sub = left(nullif(btrim(coalesce(p_sub,'')),''), 40),
    rates = case when jsonb_typeof(p_rates) = 'object' then p_rates else '{}'::jsonb end,
    details = case when jsonb_typeof(p_details) = 'object' then p_details else '{}'::jsonb end,
    plan = case when g.role <> 'dealer' then plan
                when coalesce(p_plan, '') ~ '^[0-4]$' then p_plan
                when coalesce(plan, '') ~ '^[0-4]$' then plan else '0' end,
    status = 'pending', submitted_at = now()
  where id = uid;
  perform set_config('mc.self_cancel', '', true);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.submit_application(text, text, text, text, text, jsonb, jsonb, text) from public, anon;
grant execute on function public.submit_application(text, text, text, text, text, jsonb, jsonb, text) to authenticated;

-- a dealer changes plan
create or replace function public.dealer_change_plan(p_plan int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.partners; old int; n int; a record; b record; inT boolean; ann boolean; when_txt text;
begin
  select * into p from public.partners where id = (select auth.uid()) and role = 'dealer' and status = 'approved' for update;
  if not found then raise exception 'not_dealer'; end if;
  if p_plan is null or p_plan < 0 or p_plan > 4 then raise exception 'bad_plan'; end if;
  old := case when coalesce(p.plan, '') ~ '^[0-4]$' then p.plan::int else 0 end;
  if old = p_plan then raise exception 'same_plan'; end if;
  select * into a from private.dealer_plan(old);
  select * into b from private.dealer_plan(p_plan);
  select count(*) into n from public.adverts where owner_id = p.id and status in ('live', 'pending');
  if n > b.max_adverts then raise exception 'too_many_adverts:%', n; end if;
  inT := p.trial_ends is not null and p.trial_ends > now();
  ann := p.billing = 'annual' and p.paid_until is not null and p.paid_until > now();
  if ann and p_plan < old then raise exception 'annual_down'; end if;
  update public.partners set plan = p_plan::text,
    details = coalesce(details, '{}'::jsonb) || jsonb_build_object('planlog',
      coalesce(details->'planlog', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', now(), 'from', old, 'to', p_plan)))
  where id = p.id;
  when_txt := case when inT then 'after your free trial, which ends on ' || to_char(p.trial_ends at time zone 'Europe/London', 'FMDD FMMonth YYYY')
                   when ann then 'for the rest of your paid year: we will send you an invoice for the difference'
                   else 'from your next monthly bill' end;
  perform private.mail(p.email, 'dealer', 'Your plan is now ' || b.name,
    'Hello,' || E'\n\nYour plan has changed from ' || a.name || ' to ' || b.name || ' (' || b.range_text || ', £' || b.price || ' + VAT a month).' ||
    E'\n\nIt applies straight away, so you can now list ' ||
    case when p_plan = 4 then 'as many cars and vans as you like' else 'up to ' || b.max_adverts || ' cars and vans' end || '. ' ||
    'The new price applies ' || when_txt || '.' ||
    E'\n\nYou can change plan again at any time from your dashboard: Set-up, Plan and billing.\n\nThe Motoring Central',
    '/#dashboard', 'dealer_plan', 'dplan:' || p.id || ':' || p_plan);
  perform private.mail_owners('Dealer plan change: ' || p.name || ', ' || a.name || ' to ' || b.name,
    p.name || ' (' || p.email || E') changed plan.\n\nFrom: ' || a.name || ', £' || a.price || ' + VAT a month' ||
    E'\nTo: ' || b.name || ', £' || b.price || ' + VAT a month' ||
    E'\nAdverts listed now: ' || n ||
    E'\nBilling: ' || case when inT then 'in the free trial until ' || to_char(p.trial_ends at time zone 'Europe/London', 'FMDD FMMonth YYYY')
                           when ann then 'YEARLY, paid to ' || to_char(p.paid_until at time zone 'Europe/London', 'FMDD FMMonth YYYY') || '. Invoice the difference for the rest of the year.'
                           else 'monthly. The new price applies from the next bill.' end,
    '/#admin', 'staff_dealer_plan', 'dplan:' || p.id || ':' || p_plan);
  return jsonb_build_object('plan', p_plan, 'from', old, 'adverts', n, 'name', b.name, 'price', b.price);
end $$;
revoke all on function public.dealer_change_plan(int) from public, anon;
grant execute on function public.dealer_change_plan(int) to authenticated;

-- deleting your own files in the advert photos bucket
drop policy if exists "advert photos: delete own" on storage.objects;
create policy "advert photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'advert-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
