-- Cancelling during the free trial is instant (owner's decision, 22 Nov 2026): the dealer's account is suspended
-- straight away, their adverts are taken down, and the founding place (if any) is released. One email confirms it
-- (the usual "account paused" email is not sent for a self-cancel). After the trial, one month's notice still applies.
-- If an owner reinstates the dealer later, the cancellation is cleared; there is no second free trial.

-- the guard lets a dealer's own trial cancellation change their status, and does not record them as the reviewer
create or replace function private.guard_partner_review() returns trigger
language plpgsql security definer set search_path = '' as $$
declare selfc boolean := coalesce(current_setting('mc.self_cancel', true), '') = '1';
begin
  if new.status is distinct from old.status and (select auth.uid()) is not null and not private.is_owner() and not selfc then
    raise exception 'Only an owner can approve, reject, suspend or reinstate a partner';
  end if;
  if (new.status is distinct from old.status or new.review is distinct from old.review) and not selfc then
    new.reviewed_at := now();
    new.reviewed_by := coalesce((select auth.uid()), new.reviewed_by);
  end if;
  return new;
end $$;

-- no "account paused" email for a self-cancel
do $$
declare d text := pg_get_functiondef('private.mail_partner'::regproc);
begin
  if position('mc.self_cancel' in d) = 0 then
    d := replace(d, $q$elsif new.status = 'suspended' then$q$,
                    $q$elsif new.status = 'suspended' and coalesce(current_setting('mc.self_cancel', true), '') <> '1' then$q$);
    if position('mc.self_cancel' in d) = 0 then raise exception 'mail_partner was not patched'; end if;
    execute d;
  end if;
end $$;

-- reinstating a dealer clears their cancellation
create or replace function private.dealer_on_approve() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ks text[]; had boolean;
begin
  if new.role = 'dealer' and new.status = 'approved' and old.status = 'suspended' and new.ends_at is not null and new.ends_at <= now() then
    new.cancel_requested_at := null; new.ends_at := null;
  end if;
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

create or replace function public.dealer_cancel() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.partners; e timestamptz; tr boolean; freed boolean := false; nads int := 0;
begin
  select * into p from public.partners where id = (select auth.uid()) and role = 'dealer' for update;
  if not found then raise exception 'not_dealer'; end if;
  if p.status <> 'approved' then raise exception 'not_active'; end if;
  if p.cancel_requested_at is not null and p.ends_at > now() then
    return jsonb_build_object('ends_at', p.ends_at, 'trial', false, 'founding_freed', p.founding_freed, 'suspended', false);
  end if;
  tr := p.trial_ends is not null and p.trial_ends > now();
  if tr then
    -- instant: suspend now, take the adverts down, release the founding place
    freed := p.founding_no is not null;
    perform set_config('mc.self_cancel', '1', true);
    update public.partners set status = 'suspended', cancel_requested_at = now(), ends_at = now(),
      founding_no = null, founding_freed = founding_freed or freed
    where id = p.id;
    perform set_config('mc.self_cancel', '', true);
    update public.adverts set status = 'removed' where owner_id = p.id and status in ('live','pending');
    get diagnostics nads = row_count;
    perform private.mail(p.email, 'dealer', 'Your free trial has been cancelled',
      E'Hello,\n\nWe have cancelled your free trial as you asked. There is nothing to pay.\n\n' ||
      E'Your dealer account is closed from today and your adverts have been taken down' ||
      case when nads > 0 then ' (' || nads || ')' else '' end || E'.' ||
      case when freed then E' Your founding dealer place has been released for another dealer.' else '' end ||
      E'\n\nThe free trial can only be used once per dealership. If you would like to come back, contact us and we will set up a paid plan for you.\n\nThe Motoring Central',
      '/#contact', 'dealer_cancel', 'dealercancel:' || p.id || ':' || to_char(now(), 'YYYYMMDDHH24MI'));
    return jsonb_build_object('ends_at', now(), 'trial', true, 'founding_freed', freed, 'suspended', true, 'adverts_removed', nads);
  end if;
  e := case when p.billing = 'annual' and p.paid_until > now() then p.paid_until else now() + interval '1 month' end;
  update public.partners set cancel_requested_at = now(), ends_at = e where id = p.id;
  perform private.mail(p.email, 'dealer', 'Your dealer membership is cancelled',
    E'Hello,\n\nWe have cancelled your dealer membership as you asked. ' ||
    case when p.billing = 'annual' and p.paid_until > now() then E'Your yearly plan is paid up to that date. '
         else E'Plans need one month''s notice, so your last payment covers you up to that date. ' end ||
    E'Your adverts stay live until ' || to_char(e at time zone 'Europe/London', 'FMDay FMDD FMMonth YYYY') ||
    E'.\n\nChanged your mind? Tap Keep my membership in your dashboard before then.\n\nThe Motoring Central',
    '/#dashboard', 'dealer_cancel', 'dealercancel:' || p.id || ':' || to_char(now(), 'YYYYMMDDHH24MI'));
  return jsonb_build_object('ends_at', e, 'trial', false, 'founding_freed', false, 'suspended', false);
end $$;
revoke all on function public.dealer_cancel() from public, anon;
grant execute on function public.dealer_cancel() to authenticated;
