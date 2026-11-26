-- Automatic approval waits for the MOT check (26 Nov 2026)
-- With "Approve adverts automatically" on, a clean advert used to go live the moment it was saved, before anything
-- could ask the DVSA. A clocked car (mileage lower than at its last MOT) or a false registration could go live with no
-- person seeing the warning. Now such an advert waits (mot_wait) while the mot-history function checks its MOT record,
-- straight away and then every minute: clean -> live ("Approved automatically after the MOT check"); a warning -> it
-- stays for our team, with the reason in its flags. If the DVSA cannot be reached for 30 minutes it goes to our team;
-- if no DVSA key is set up it is approved as before. The seller and the owners get the "waiting" emails only when it
-- really waits for a person.
-- Also: a seller can no longer change an advert's flags (the warnings our team sees) without changing the advert.

alter table public.adverts add column if not exists mot_wait boolean not null default false;
alter table public.adverts add column if not exists mot_claim timestamptz;
create index if not exists adverts_mot_wait on public.adverts (created_at) where mot_wait;

create or replace function private.review_advert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s jsonb; auto boolean;
  -- our team, or our own server (the MOT check runs with the service key)
  staff boolean := private.is_staff() or coalesce((select auth.jwt()->>'role'), '') = 'service_role';
begin
  select summary into s from public.vehicle_checks where id = new.check_id;
  if tg_op = 'INSERT' then
    new.flags := private.advert_flags(new.data, s);
    new.review_note := null; new.reviewed_at := null; new.reviewed_by := null; new.mot_claim := null;
    select coalesce((value)::text = 'true', false) into auto from public.app_settings where key = 'auto_approve_adverts';
    new.status := 'pending';
    -- clean, with automatic approval on: it goes live once the MOT record has been checked (usually within a minute)
    new.mot_wait := coalesce(auto, false) and cardinality(new.flags) = 0;
    return new;
  end if;
  if not staff then
    new.review_note := old.review_note; new.reviewed_at := old.reviewed_at; new.reviewed_by := old.reviewed_by;
    new.flags := old.flags; new.mot_wait := old.mot_wait; new.mot_claim := old.mot_claim;
    if new.status <> old.status and new.status <> 'removed' then raise exception 'Only our team can approve adverts'; end if;
    if old.status = 'removed' and new.status <> 'removed' then raise exception 'This advert has been removed'; end if;
    if new.data is distinct from old.data then
      new.flags := private.advert_flags(new.data, s);
      if old.status = 'declined' then new.status := 'pending';
      elsif old.status = 'live' and not (new.flags <@ old.flags) then new.status := 'pending'; end if;
    end if;
  else
    if new.data is distinct from old.data then new.flags := private.advert_flags(new.data, s); end if;
    if new.status <> old.status and new.status in ('live','declined') then
      new.reviewed_at := now(); new.reviewed_by := (select auth.uid());
      if new.status = 'declined' and coalesce(trim(new.review_note),'') = '' then raise exception 'Give the seller a reason for declining'; end if;
      if new.status = 'live' then
        if old.status = 'pending' and old.reviewed_at is null and new.expires_at is not null then
          new.expires_at := new.expires_at + (now() - old.created_at); end if;
        if new.review_note is not distinct from old.review_note then new.review_note := null; end if;
      end if;
    end if;
  end if;
  if new.status <> 'pending' then new.mot_wait := false; end if;
  return new;
end $$;

create or replace function private.mail_advert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare em text := private.user_email(new.owner_id);
  title text := coalesce(nullif(concat_ws(' ', new.data->>'year', new.data->>'make', new.data->>'model'), ''), 'your vehicle');
  reg text := upper(coalesce(new.data->>'reg',''));
  who text := case when exists (select 1 from public.partners p where p.id = new.owner_id and p.role = 'dealer') then 'dealer' else 'seller' end;
  hi text := E'Hello,\n\n';
  waiting boolean := false;
begin
  if tg_op = 'INSERT' then
    -- waiting for a person (not just for the MOT check, which takes a minute)
    waiting := new.status = 'pending' and not new.mot_wait;
    if new.status = 'live' then
      perform private.mail(em, who, 'Your advert is live: ' || title,
        hi || 'Your advert for ' || title || E' is now live on The Motoring Central.\n\nBuyers can message you or ask for a viewing through the site, and we will email you each time.\n\nThe Motoring Central team',
        '/#' || new.kind, 'advert_live', 'advlive:' || new.owner_id);
    end if;
  else
    -- the MOT check found something (or automatic approval was switched off): now it waits for our team
    waiting := old.mot_wait and not new.mot_wait and new.status = 'pending' and old.status = 'pending';
    if new.status is distinct from old.status then
      if new.status = 'live' and old.status in ('pending','declined') then
        perform private.mail(em, who, 'Your advert is live: ' || title,
          hi || 'Good news: your advert for ' || title || coalesce(' (' || nullif(reg,'') || ')', '') ||
          E' has been approved and is now live.\n\nBuyers can message you or ask for a viewing through the site, and we will email you each time.\n\nThe Motoring Central team',
          '/#' || new.kind, 'advert_live', 'advlive:' || new.owner_id);
      elsif new.status = 'declined' then
        perform private.mail(em, who, 'Your advert needs a change: ' || title,
          hi || 'Our team could not put your advert for ' || title || coalesce(' (' || nullif(reg,'') || ')', '') || E' live yet.\n\n' ||
          coalesce('What to change: ' || nullif(trim(new.review_note),'') || E'\n\n', '') ||
          E'Log in, open your adverts, make the change and send it back. We will check it again straight away.\n\nThe Motoring Central team',
          '/#account', 'advert_declined', null);
      elsif new.status = 'pending' and old.status = 'declined' then
        perform private.mail_owners('Adverts are waiting for approval',
          'A seller has changed a declined advert and sent it back: ' || title || E'.\n\nOpen the admin page, "Adverts waiting for approval".',
          '/#admin', 'staff_advert_waiting', 'advq');
      end if;
    end if;
  end if;
  if waiting then
    perform private.mail_owners('Adverts are waiting for approval',
      E'New car or van adverts are waiting to be checked.\nLatest: ' || title || coalesce(' (' || nullif(reg,'') || ')', '') ||
      E'\n\nOpen the admin page, "Adverts waiting for approval".', '/#admin', 'staff_advert_waiting', 'advq');
    perform private.mail(em, who, 'We are checking your advert: ' || title,
      hi || 'Thank you. Your advert for ' || title || coalesce(' (' || nullif(reg,'') || ')', '') ||
      E' has been received. Our team checks every advert before it goes live, usually within a few hours.\nWe will email you as soon as it is live.\n\nThe Motoring Central team',
      '/#account', 'advert_received', 'advrec:' || new.owner_id);
  end if;
  return new;
exception when others then
  raise warning 'email not queued: %', sqlerrm;
  return new;
end $$;

-- one MOT check at a time per advert (the check may be started from two places at once)
create or replace function public.mot_claim(p_id bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.adverts set mot_claim = now()
   where id = p_id and mot_wait and status = 'pending' and (mot_claim is null or mot_claim < now() - interval '2 minutes');
  return found;
end $$;
revoke all on function public.mot_claim(bigint) from public, anon, authenticated;
grant execute on function public.mot_claim(bigint) to service_role;

-- start the MOT check (the same private key as the email sender)
create or replace function private.kick_mot() returns void
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if not exists (select 1 from public.adverts where mot_wait and status = 'pending') then return; end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'notify_cron_secret';
  perform net.http_post(
    url := 'https://hctboldpuyztugpwexdy.supabase.co/functions/v1/mot-history',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', k),
    body := '{"sweep":true}'::jsonb, timeout_milliseconds := 30000);
end $$;
create or replace function private.kick_mot_new() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.kick_mot();
  return null;
exception when others then
  return null;
end $$;
revoke all on function private.kick_mot(), private.kick_mot_new() from public, anon, authenticated;
drop trigger if exists adverts_mot_kick on public.adverts;
create trigger adverts_mot_kick after insert on public.adverts
  for each row when (new.mot_wait) execute function private.kick_mot_new();

do $$ begin
  if exists (select 1 from cron.job where jobname = 'mot-auto-approve') then perform cron.unschedule('mot-auto-approve'); end if;
  perform cron.schedule('mot-auto-approve', '* * * * *', 'select private.kick_mot()');
end $$;
