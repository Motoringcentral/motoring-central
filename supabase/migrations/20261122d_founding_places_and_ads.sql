-- Founding dealers (owner's decision, 22 Nov 2026)
-- * A founding place is kept only by a dealer who stays past the free trial. Cancelling during the trial frees the
--   place for the next dealer approved. "Keep my membership" before the trial ends takes a free place again, if any.
-- * Places are numbered 1 to 30; a freed number is given to the next dealer approved (lowest free number first).
-- * Founding dealers get 5 free premium ads a month from approval until 2 months after their trial ends (shown and
--   counted on the dealer dashboard; nothing to charge until Stripe is live).

alter table public.partners add column if not exists founding_freed boolean not null default false;
grant select (founding_freed) on public.partners to authenticated;

create or replace function private.next_founding_no() returns int
language sql volatile security definer set search_path = '' as $$
  select min(g)::int from generate_series(1, 30) g
  where not exists (select 1 from public.partners p where p.founding_no = g);
$$;

create or replace function private.dealer_on_approve() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ks text[]; had boolean;
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
  new.founding_no := private.next_founding_no();
  return new;
end $$;

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
    txt := txt || E'\n\nYou are founding dealer number ' || new.founding_no || E' of 30. As a founding dealer you get:\n' ||
      E'- 5 free premium ads a month on our front-page banner, from today until ' ||
      to_char((new.trial_ends + interval '2 months') at time zone 'Europe/London', 'FMDD FMMonth YYYY') || E' (your trial plus 2 months)\n' ||
      E'- the yearly price of 8 months for 12 (everyone else pays for 9), whenever you choose it in your dashboard.\n' ||
      E'Your founding place is kept as long as you stay past the free trial.';
  else
    txt := txt || E'\n\nPrefer to pay yearly? Pay for 9 months and get 12. Choose it in your dashboard whenever you like.';
  end if;
  perform private.mail(new.email, 'partner', 'Your dealer membership: what happens next',
    E'Hello,\n\n' || txt || E'\n\nThe Motoring Central', '/#dashboard', 'dealer_offer', 'dealeroffer:' || new.id);
  return new;
exception when others then raise warning 'dealer offer email not queued: %', sqlerrm; return new;
end $$;

-- cancelling in the trial frees the founding place
create or replace function public.dealer_cancel() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.partners; e timestamptz; tr boolean; freed boolean := false;
begin
  select * into p from public.partners where id = (select auth.uid()) and role = 'dealer' for update;
  if not found then raise exception 'not_dealer'; end if;
  if p.cancel_requested_at is not null and p.ends_at > now() then
    return jsonb_build_object('ends_at', p.ends_at, 'trial', p.trial_ends > p.cancel_requested_at, 'founding_freed', p.founding_freed);
  end if;
  tr := p.trial_ends is not null and p.trial_ends > now();
  e := case when tr then p.trial_ends
            when p.billing = 'annual' and p.paid_until > now() then p.paid_until
            else now() + interval '1 month' end;
  freed := tr and p.founding_no is not null;
  update public.partners set cancel_requested_at = now(), ends_at = e,
    founding_no = case when freed then null else founding_no end,
    founding_freed = founding_freed or freed
  where id = p.id;
  perform private.mail(p.email, 'partner', 'Your dealer membership is cancelled',
    E'Hello,\n\nWe have cancelled your dealer membership as you asked. ' ||
    case when tr then E'You are in your free trial, so there is nothing to pay. '
         when p.billing = 'annual' and p.paid_until > now() then E'Your yearly plan is paid up to that date. '
         else E'Plans need one month''s notice, so your last payment covers you up to that date. ' end ||
    E'Your adverts stay live until ' || to_char(e at time zone 'Europe/London', 'FMDay FMDD FMMonth YYYY') || '.' ||
    case when freed then E'\nYour founding dealer place has been released for another dealer.' else '' end ||
    E'\n\nChanged your mind? Tap Keep my membership in your dashboard before then.' ||
    case when freed then E' If a founding place is still free, you will get one back.' else '' end ||
    E'\n\nThe Motoring Central',
    '/#dashboard', 'dealer_cancel', 'dealercancel:' || p.id || ':' || to_char(now(), 'YYYYMMDDHH24MI'));
  return jsonb_build_object('ends_at', e, 'trial', tr, 'founding_freed', freed);
end $$;

-- keeping the membership in the trial takes a free founding place again, if one is left
drop function if exists public.dealer_keep();
create or replace function public.dealer_keep() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.partners; n int;
begin
  select * into p from public.partners where id = (select auth.uid()) and role = 'dealer' and ends_at > now() for update;
  if not found then raise exception 'not_possible'; end if;
  if p.founding_no is null and p.founding_freed and p.trial_ends > now() then
    perform pg_advisory_xact_lock(hashtext('mc_founding_dealers'));
    n := private.next_founding_no();
  end if;
  update public.partners set cancel_requested_at = null, ends_at = null,
    founding_no = coalesce(founding_no, n),
    founding_freed = case when n is not null then false else founding_freed end
  where id = p.id;
  return jsonb_build_object('founding_no', coalesce(p.founding_no, n));
end $$;

revoke all on function public.dealer_cancel() from public, anon;
revoke all on function public.dealer_keep() from public, anon;
grant execute on function public.dealer_cancel() to authenticated;
grant execute on function public.dealer_keep() to authenticated;
