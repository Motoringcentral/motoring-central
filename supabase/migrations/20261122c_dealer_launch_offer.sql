-- Dealer launch offer (owner's decision, 22 Nov 2026)
-- * 30-day free trial from the day a dealer is approved, with 3 vehicle history checks included. More checks are
--   £3.50 + VAT each, or the dealer lists without one (shown to buyers as "Not history checked").
-- * One free trial per dealership: the same email, phone number, or business name in the same town cannot have a
--   second trial (a new account, or a dealer who left and comes back, starts paying from the day they are approved).
-- * After the trial: monthly at the plan price, one month's notice to cancel. During the trial: cancel any time and
--   pay nothing.
-- * Annual option any time: pay for 9 months, get 12. Founding dealers (the first 30 dealers approved) pay for 8.
-- * A reminder email 7 days before the trial ends.
-- Card payments are not live yet: the screens show the payment step and these dates; charging follows with Stripe.

alter table public.partners
  add column if not exists trial_ends timestamptz,
  add column if not exists founding_no int,
  add column if not exists billing text not null default 'monthly',
  add column if not exists paid_until timestamptz,
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists ends_at timestamptz;
do $$ begin
  alter table public.partners add constraint partners_billing_check check (billing in ('monthly','annual'));
exception when duplicate_object then null; end $$;
grant select (trial_ends, founding_no, billing, paid_until, cancel_requested_at, ends_at) on public.partners to authenticated;

-- the details that identify a dealership, kept even if the account is deleted
create table if not exists private.trial_keys (
  key text primary key,
  partner_id uuid,
  created_at timestamptz not null default now()
);
revoke all on private.trial_keys from public, anon, authenticated;

create or replace function private.dealer_keys(p public.partners) returns text[]
language sql immutable set search_path = '' as $$
  select array_remove(array[
    case when coalesce(p.email,'') <> '' then 'e:' || lower(btrim(p.email)) end,
    case when length(regexp_replace(coalesce(p.phone,''), '\D', '', 'g')) >= 10
         then 'p:' || right(regexp_replace(coalesce(p.phone,''), '\D', '', 'g'), 10) end,
    case when length(regexp_replace(lower(coalesce(p.name,'')), '[^a-z0-9]', '', 'g')) >= 3
         then 'n:' || regexp_replace(regexp_replace(lower(coalesce(p.name,'')), '\m(ltd|limited|the|uk)\M', '', 'g'), '[^a-z0-9]', '', 'g')
              || '|' || regexp_replace(lower(coalesce(p.town,'')), '[^a-z0-9]', '', 'g') end
  ], null);
$$;

-- when a dealer is approved for the first time: start the trial (or not, if they had one), give a founding place
create or replace function private.dealer_on_approve() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ks text[]; had boolean; n int;
begin
  if new.role <> 'dealer' or new.status <> 'approved' or coalesce(old.status,'') = 'approved' or new.trial_ends is not null then
    return new;
  end if;
  ks := private.dealer_keys(new);
  select exists (select 1 from private.trial_keys k where k.key = any(ks) and k.partner_id is distinct from new.id) into had;
  if had then
    new.trial_ends := now();
    new.review := coalesce(new.review, '{}'::jsonb) || jsonb_build_object('noTrial', true);
  else
    new.trial_ends := now() + interval '30 days';
  end if;
  insert into private.trial_keys (key, partner_id) select k, new.id from unnest(ks) k on conflict (key) do nothing;
  perform pg_advisory_xact_lock(hashtext('mc_founding_dealers'));
  select count(*) into n from public.partners where founding_no is not null;
  if n < 30 then new.founding_no := n + 1; end if;
  return new;
end $$;
drop trigger if exists partners_launch on public.partners;
create trigger partners_launch before update of status on public.partners
  for each row execute function private.dealer_on_approve();

-- a welcome email with the offer, after the approval email
create or replace function private.dealer_offer_mail() returns trigger
language plpgsql security definer set search_path = '' as $$
declare txt text;
begin
  if new.role <> 'dealer' or old.trial_ends is not null or new.trial_ends is null then return new; end if;
  if new.trial_ends > now() + interval '1 day' then
    txt := E'Your 30-day free trial has started today and ends on ' || to_char(new.trial_ends at time zone 'Europe/London', 'FMDay FMDD FMMonth YYYY') ||
      E'.\nIt includes 3 vehicle history checks. Extra checks are £3.50 + VAT, or you can list without one.\n' ||
      E'Cancel any time during the trial from your dashboard and you pay nothing. We will email you 7 days before it ends.';
  else
    txt := E'Our records show this dealership has had a free trial before, so your plan starts today. ' ||
      E'Cancelling needs one month''s notice, from your dashboard.';
  end if;
  if new.founding_no is not null then
    txt := txt || E'\n\nYou are founding dealer number ' || new.founding_no || E' of 30. As a founding dealer, you can pay for 8 months and get 12 ' ||
      E'(everyone else pays for 9). Choose the yearly option in your dashboard whenever you like.';
  else
    txt := txt || E'\n\nPrefer to pay yearly? Pay for 9 months and get 12. Choose it in your dashboard whenever you like.';
  end if;
  perform private.mail(new.email, 'partner', 'Your dealer membership: what happens next',
    E'Hello,\n\n' || txt || E'\n\nThe Motoring Central', '/#dashboard', 'dealer_offer', 'dealeroffer:' || new.id);
  return new;
exception when others then raise warning 'dealer offer email not queued: %', sqlerrm; return new;
end $$;
drop trigger if exists partners_offer_mail on public.partners;
create trigger partners_offer_mail after update of status on public.partners
  for each row execute function private.dealer_offer_mail();

-- dealers who are already approved: a fresh 30-day trial from today, and their details recorded
update public.partners set trial_ends = now() + interval '30 days' where role = 'dealer' and status = 'approved' and trial_ends is null;
insert into private.trial_keys (key, partner_id)
  select k, p.id from public.partners p cross join lateral unnest(private.dealer_keys(p)) k where p.role = 'dealer'
  on conflict (key) do nothing;

-- dealer: cancel. In the trial: ends when the trial ends, nothing to pay. Yearly: ends when the paid year ends.
-- Monthly: one month's notice.
create or replace function public.dealer_cancel() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.partners; e timestamptz; tr boolean;
begin
  select * into p from public.partners where id = (select auth.uid()) and role = 'dealer' for update;
  if not found then raise exception 'not_dealer'; end if;
  if p.cancel_requested_at is not null and p.ends_at > now() then
    return jsonb_build_object('ends_at', p.ends_at, 'trial', p.trial_ends > p.cancel_requested_at);
  end if;
  tr := p.trial_ends is not null and p.trial_ends > now();
  e := case when tr then p.trial_ends
            when p.billing = 'annual' and p.paid_until > now() then p.paid_until
            else now() + interval '1 month' end;
  update public.partners set cancel_requested_at = now(), ends_at = e where id = p.id;
  perform private.mail(p.email, 'partner', 'Your dealer membership is cancelled',
    E'Hello,\n\nWe have cancelled your dealer membership as you asked. ' ||
    case when tr then E'You are in your free trial, so there is nothing to pay. '
         when p.billing = 'annual' and p.paid_until > now() then E'Your yearly plan is paid up to that date. '
         else E'Plans need one month''s notice, so your last payment covers you up to that date. ' end ||
    E'Your adverts stay live until ' || to_char(e at time zone 'Europe/London', 'FMDay FMDD FMMonth YYYY') ||
    E'.\n\nChanged your mind? Tap Keep my membership in your dashboard before then.\n\nThe Motoring Central',
    '/#dashboard', 'dealer_cancel', 'dealercancel:' || p.id || ':' || to_char(now(), 'YYYYMMDDHH24MI'));
  return jsonb_build_object('ends_at', e, 'trial', tr);
end $$;

create or replace function public.dealer_keep() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.partners set cancel_requested_at = null, ends_at = null
  where id = (select auth.uid()) and role = 'dealer' and ends_at > now();
  if not found then raise exception 'not_possible'; end if;
end $$;

-- dealer: switch to the yearly plan (after the payment step). 12 months from the end of the trial, or from today.
create or replace function public.dealer_go_annual() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.partners; st timestamptz; pu timestamptz;
begin
  select * into p from public.partners where id = (select auth.uid()) and role = 'dealer' and status = 'approved' for update;
  if not found then raise exception 'not_dealer'; end if;
  if p.billing = 'annual' and p.paid_until > now() + interval '30 days' then raise exception 'already_annual'; end if;
  st := greatest(now(), coalesce(p.trial_ends, now()), coalesce(p.paid_until, now()));
  pu := st + interval '12 months';
  update public.partners set billing = 'annual', paid_until = pu, cancel_requested_at = null, ends_at = null where id = p.id;
  return jsonb_build_object('paid_until', pu, 'months_paid', case when p.founding_no is not null then 8 else 9 end);
end $$;

-- anyone: how many founding places are left (for the dealer page)
create or replace function public.founding_places_left() returns int
language sql stable security definer set search_path = '' as $$
  select greatest(0, 30 - (select count(*)::int from public.partners where founding_no is not null));
$$;

revoke all on function public.dealer_cancel() from public, anon;
revoke all on function public.dealer_keep() from public, anon;
revoke all on function public.dealer_go_annual() from public, anon;
grant execute on function public.dealer_cancel() to authenticated;
grant execute on function public.dealer_keep() to authenticated;
grant execute on function public.dealer_go_annual() to authenticated;
grant execute on function public.founding_places_left() to anon, authenticated;

-- history checks: the 3 free checks belong to the trial (from trial_ends, not 92 days from joining)
create or replace function private.in_trial(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.partners p where p.id = p_id and p.role = 'dealer' and p.status = 'approved'
                 and p.trial_ends > now());
$$;

-- daily: the reminder 7 days before a trial ends
create or replace function private.queue_trial_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in select p.* from public.partners p
           where p.role = 'dealer' and p.status = 'approved' and p.cancel_requested_at is null
             and p.trial_ends between now() + interval '6 days' and now() + interval '7 days'
             and not (p.billing = 'annual' and p.paid_until > p.trial_ends) loop
    perform private.mail(r.email, 'partner', 'Your free trial ends in 7 days',
      E'Hello,\n\nYour free trial with The Motoring Central ends on ' || to_char(r.trial_ends at time zone 'Europe/London', 'FMDay FMDD FMMonth YYYY') ||
      E'. After that your plan is charged monthly, and cancelling needs one month''s notice.\n\n' ||
      E'Happy to carry on? There is nothing to do.\nPrefer to pay yearly? Pay for ' || case when r.founding_no is not null then '8' else '9' end ||
      E' months and get 12, in your dashboard.\nNot for you? Cancel in your dashboard before the trial ends and you pay nothing.\n\nThe Motoring Central',
      '/#dashboard', 'dealer_trial_end', 'trialend:' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

select cron.unschedule('dealer-trial-reminders') where exists (select 1 from cron.job where jobname = 'dealer-trial-reminders');
select cron.schedule('dealer-trial-reminders', '20 9 * * *', 'select private.queue_trial_reminders(); select private.kick_notify()');

-- adverts without a history check: allowed during the 30-day trial (was 92 days from joining)
create or replace function private.check_advert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.vehicle_checks%rowtype; r text; trial boolean;
begin
  if tg_op = 'INSERT' then
    r := upper(regexp_replace(coalesce(new.data->>'reg', ''), '[^A-Za-z0-9]', '', 'g'));
    new.data := new.data - 'nochk';
    if new.check_id is null then
      trial := private.in_trial(new.owner_id);
      if not coalesce(trial, false) or coalesce(new.data->>'private', '') = 'true' then
        raise exception 'A vehicle history check is needed before listing'; end if;
      if length(r) < 2 then raise exception 'Enter the registration'; end if;
      if coalesce(new.data->>'wo', '') = '' then raise exception 'Tell us if it has ever been an insurance write-off'; end if;
      if coalesce(new.data->>'wo', '') in ('A','B','AB') then raise exception 'Category A and B write-offs cannot be listed'; end if;
      new.data := jsonb_set(jsonb_set(new.data, '{reg}', to_jsonb(r)), '{nochk}', 'true'::jsonb);
    else
      select * into c from public.vehicle_checks where id = new.check_id;
      if not found or c.owner_id <> new.owner_id then raise exception 'A vehicle history check is needed before listing'; end if;
      if c.created_at < now() - interval '7 days' then raise exception 'The history check is more than 7 days old. Please check the vehicle again'; end if;
      if r <> c.reg then raise exception 'The history check is for a different registration'; end if;
      if c.kind <> new.kind then raise exception 'The history check is for a different type of vehicle'; end if;
      if coalesce(c.summary->'stolen'->>'found', '') = 'true' or coalesce(c.summary->>'scrapped', '') = 'true' then
        raise exception 'This vehicle cannot be listed'; end if;
      if coalesce(c.summary->'writeoff'->>'cat', '') in ('A','B') or coalesce(new.data->>'wo', '') in ('A','B','AB') then
        raise exception 'Category A and B write-offs cannot be listed'; end if;
      if coalesce(new.data->>'private', '') = 'true' and coalesce(c.summary->'finance'->>'found', '') = 'true' then
        raise exception 'Outstanding finance must be cleared before a private sale'; end if;
      new.data := jsonb_set(new.data, '{reg}', to_jsonb(r));
    end if;
  else
    if coalesce(old.data->>'wo', '') in ('S','N','C','D','yes') then new.data := jsonb_set(new.data, '{wo}', old.data->'wo'); end if;
    new.data := jsonb_set(new.data, '{reg}', coalesce(old.data->'reg', 'null'::jsonb));
    -- whether an advert was listed without a check is fixed when it is created
    new.data := new.data - 'nochk';
    if old.data ? 'nochk' then new.data := jsonb_set(new.data, '{nochk}', old.data->'nochk'); end if;
  end if;
  new.data := new.data - 'chk';
  return new;
end $$;
