-- Dealer plans, emails (26 Nov 2026)
-- Every email is labelled, and the same label is not sent twice within 30 minutes (to stop repeats). The plan-change
-- emails used the dealer and the new plan as the label, so a dealer who moved up, down and up again within half an hour
-- got no second email and the owners were not told of the last change, which matters for billing. The label now also
-- has the minute, so only a double press within the same minute is held back.

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
    '/#dashboard', 'dealer_plan', 'dplan:' || p.id || ':' || p_plan || ':' || to_char(now(), 'YYYYMMDDHH24MI'));
  perform private.mail_owners('Dealer plan change: ' || p.name || ', ' || a.name || ' to ' || b.name,
    p.name || ' (' || p.email || E') changed plan.\n\nFrom: ' || a.name || ', £' || a.price || ' + VAT a month' ||
    E'\nTo: ' || b.name || ', £' || b.price || ' + VAT a month' ||
    E'\nAdverts listed now: ' || n ||
    E'\nBilling: ' || case when inT then 'in the free trial until ' || to_char(p.trial_ends at time zone 'Europe/London', 'FMDD FMMonth YYYY')
                           when ann then 'YEARLY, paid to ' || to_char(p.paid_until at time zone 'Europe/London', 'FMDD FMMonth YYYY') || '. Invoice the difference for the rest of the year.'
                           else 'monthly. The new price applies from the next bill.' end,
    '/#admin', 'staff_dealer_plan', 'dplan:' || p.id || ':' || p_plan || ':' || to_char(now(), 'YYYYMMDDHH24MI'));
  return jsonb_build_object('plan', p_plan, 'from', old, 'adverts', n, 'name', b.name, 'price', b.price);
end $$;
