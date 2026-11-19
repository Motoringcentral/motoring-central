-- Emails for everything the site does (19 Nov 2026).
-- Every email is written into public.notifications and sent by the edge function "notify" (Resend).
-- A timed job (pg_cron) runs "notify" every 2 minutes while anything is waiting, so emails go out
-- even when nobody has the site open. Until RESEND_API_KEY is set in Supabase they simply wait,
-- and anything older than 24 hours is dropped (so test messages are never sent later by surprise).

-- 1. notifications: more kinds of recipient, a button link, and a key to stop repeat emails
alter table public.notifications drop constraint if exists notifications_to_who_check;
alter table public.notifications add constraint notifications_to_who_check
  check (to_who = any (array['customer','garage','partner','dealer','seller','buyer','staff']));
alter table public.notifications drop constraint if exists notifications_status_check;
alter table public.notifications add constraint notifications_status_check
  check (status = any (array['queued','sent','failed','skipped']));
alter table public.notifications add column if not exists kind text;
alter table public.notifications add column if not exists link text;
alter table public.notifications add column if not exists ref text;
create index if not exists notifications_queued_idx on public.notifications (id) where status = 'queued';
create index if not exists notifications_ref_idx on public.notifications (ref, created_at) where ref is not null;

-- test and demo addresses are never sent (they would bounce and harm our sending reputation)
create or replace function private.skip_test_address() returns trigger
language plpgsql set search_path = '' as $$
declare d text := lower(split_part(coalesce(new.to_addr,''), '@', 2));
begin
  if new.channel = 'email' and (d in ('demo.com','example.com','example.org','example.net','test.com')
      or d like '%.test' or d like '%.invalid' or d like '%.example' or d like '%.localhost') then
    new.status := 'skipped'; new.error := 'Demo or test address: not sent';
  end if;
  return new;
end $$;
drop trigger if exists notifications_skip_test on public.notifications;
create trigger notifications_skip_test before insert on public.notifications
  for each row execute function private.skip_test_address();

-- 2. helpers
create or replace function private.site_url() returns text
language sql stable set search_path = '' as $$
  select coalesce((select value #>> '{}' from public.app_settings where key = 'site_url'), 'https://preview.motoringcentral.co.uk')
$$;
insert into public.app_settings(key, value) values ('site_url', to_jsonb('https://preview.motoringcentral.co.uk'::text))
  on conflict (key) do nothing;

create or replace function private.user_email(p uuid) returns text
language sql stable security definer set search_path = '' as $$ select email from auth.users where id = p $$;

create or replace function private.first_name(p text) returns text
language sql immutable set search_path = '' as $$ select coalesce(nullif(split_part(trim(coalesce(p,'')),' ',1),''), 'there') $$;

create or replace function private.role_label(p_role text, p_sub text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_role = 'mechanic' and p_sub = 'garage' then 'garage'
    when p_role = 'mechanic' and p_sub = 'mot' then 'MOT test station'
    when p_role = 'mechanic' and p_sub = 'electric' then 'auto electrician'
    when p_role = 'mechanic' then 'mobile mechanic'
    when p_role = 'recovery' then 'recovery and transport partner'
    when p_role = 'evcharge' then 'mobile EV charging partner'
    when p_role = 'body' then 'body shop and alloy wheel partner'
    when p_role = 'tyres' then 'mobile tyre fitter'
    when p_role = 'valet' then 'valeting partner'
    when p_role = 'dealer' then 'dealer'
    else 'partner' end
$$;

-- queue one email. p_ref stops the same kind of email going to the same person more than once in 30 minutes
create or replace function private.mail(p_to text, p_who text, p_subject text, p_body text,
  p_link text default null, p_kind text default null, p_ref text default null, p_booking uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_to is null or position('@' in p_to) = 0 then return; end if;
  if p_ref is not null and exists (select 1 from public.notifications where ref = p_ref and created_at > now() - interval '30 minutes') then
    return;
  end if;
  insert into public.notifications(booking_id, to_who, channel, to_addr, subject, body, kind, link, ref)
  values (p_booking, p_who, 'email', lower(trim(p_to)), left(p_subject, 200), left(p_body, 6000), p_kind,
          case when p_link is null then null when p_link like 'http%' then p_link else private.site_url() || p_link end, p_ref);
exception when others then
  raise warning 'email not queued: %', sqlerrm;
end $$;

create or replace function private.mail_owners(p_subject text, p_body text, p_link text, p_kind text, p_ref text)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select u.email from public.staff s join auth.users u on u.id = s.user_id where s.level = 'owner' loop
    perform private.mail(r.email, 'staff', p_subject, p_body, p_link, p_kind, case when p_ref is null then null else p_ref || ':' || r.email end);
  end loop;
end $$;

-- 3. partner and dealer applications
create or replace function private.mail_partner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lbl text := private.role_label(new.role, new.sub); hi text := 'Hello ' || private.first_name(new.name) || E',\n\n';
  why text; dash text := '/#dashboard';
begin
  if tg_op = 'INSERT' then
    perform private.mail(new.email, case when new.role = 'dealer' then 'dealer' else 'partner' end,
      'We have received your application',
      hi || 'Thank you for applying to join The Motoring Central as a ' || lbl || E'.\n\n' ||
      E'What happens next:\n1. Our team checks your insurance documents and photo ID, usually within 2 working days.\n' ||
      E'2. We email you as soon as you are approved.\n3. You can then log in, set your rates and start receiving work.\n\n' ||
      E'You can log in now to check your details and upload anything missing.\n\nThe Motoring Central team',
      '/#login', 'application_received', 'app:' || new.id);
    perform private.mail_owners('New application to review: ' || coalesce(nullif(new.name,''),'(no name)') || ' (' || lbl || ')',
      'A new ' || lbl || ' has applied to join.' || E'\n\nBusiness: ' || coalesce(new.name,'') ||
      E'\nTown: ' || coalesce(new.town,'') || E'\nPhone: ' || coalesce(new.phone,'') || E'\nEmail: ' || coalesce(new.email,'') ||
      E'\n\nOpen the Staff page to check their documents and approve or reject them.',
      '/#staff', 'staff_new_application', 'newapp:' || new.id);
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'approved' then
      perform private.mail(new.email, case when new.role = 'dealer' then 'dealer' else 'partner' end,
        case when old.status = 'suspended' then 'Your account is active again' else 'You are approved: welcome to The Motoring Central' end,
        hi || case when old.status = 'suspended'
          then E'Your account has been reinstated. Customers can find and book you again.\n\n'
          else 'Good news: your application to join as a ' || lbl || E' has been approved.\n\n' ||
               case when new.role = 'dealer'
                 then E'Next steps:\n- Log in and open your dashboard.\n- List your first cars and vans (or upload your stock from a spreadsheet).\n- Every advert is checked by our team before it goes live.\n\n'
                 else E'Next steps:\n- Log in and open your dashboard.\n- Check your rates, the services you offer and your working hours.\n- Keep your phone handy: new bookings appear in your dashboard and by email.\n\n' end
          end || 'The Motoring Central team',
        dash, 'application_approved', null);
    elsif new.status = 'rejected' then
      why := nullif(trim(coalesce(new.review->>'reject','')), '');
      perform private.mail(new.email, case when new.role = 'dealer' then 'dealer' else 'partner' end,
        'Your application needs attention',
        hi || E'We could not approve your application yet.\n\n' ||
        coalesce('Reason: ' || why || E'\n\n', '') ||
        E'You can log in, fix this (for example upload a clearer or up-to-date document) and send it back to us. We will look at it again straight away.\n\nThe Motoring Central team',
        '/#login', 'application_rejected', null);
    elsif new.status = 'suspended' then
      why := nullif(trim(coalesce(new.review->>'suspend','')), '');
      perform private.mail(new.email, case when new.role = 'dealer' then 'dealer' else 'partner' end,
        'Your account has been paused',
        hi || E'Your account has been paused, so customers cannot book you or see your adverts for now.\n\n' ||
        coalesce('Reason: ' || why || E'\n\n', '') ||
        E'Reply to this email or contact us and we will help you put it right.\n\nThe Motoring Central team',
        null, 'application_suspended', null);
    elsif new.status = 'pending' and old.status = 'rejected' then
      perform private.mail_owners('Application sent back for review: ' || coalesce(nullif(new.name,''),'(no name)'),
        'The ' || lbl || ' ' || coalesce(new.name,'') || E' has fixed their application and sent it back.\n\nOpen the Staff page to review it again.',
        '/#staff', 'staff_resubmitted', 'resub:' || new.id);
    end if;
  end if;
  return new;
exception when others then
  raise warning 'email not queued: %', sqlerrm;
  return new;
end $$;
drop trigger if exists partners_mail on public.partners;
create trigger partners_mail after insert or update of status on public.partners
  for each row execute function private.mail_partner();

-- 4. adverts: approved, declined, and a note to staff when adverts are waiting
create or replace function private.mail_advert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare em text := private.user_email(new.owner_id);
  title text := coalesce(nullif(concat_ws(' ', new.data->>'year', new.data->>'make', new.data->>'model'), ''), 'your vehicle');
  reg text := upper(coalesce(new.data->>'reg',''));
  who text := case when exists (select 1 from public.partners p where p.id = new.owner_id and p.role = 'dealer') then 'dealer' else 'seller' end;
  hi text := E'Hello,\n\n';
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform private.mail_owners('Adverts are waiting for approval',
        E'New car or van adverts are waiting to be checked.\nLatest: ' || title || coalesce(' (' || nullif(reg,'') || ')', '') ||
        E'\n\nOpen the admin page, "Adverts waiting for approval".', '/#admin', 'staff_advert_waiting', 'advq');
      perform private.mail(em, who, 'We are checking your advert: ' || title,
        hi || 'Thank you. Your advert for ' || title || coalesce(' (' || nullif(reg,'') || ')', '') ||
        E' has been received. Our team checks every advert before it goes live, usually within a few hours.\nWe will email you as soon as it is live.\n\nThe Motoring Central team',
        '/#account', 'advert_received', 'advrec:' || new.owner_id);
    elsif new.status = 'live' then
      perform private.mail(em, who, 'Your advert is live: ' || title,
        hi || 'Your advert for ' || title || E' is now live on The Motoring Central.\n\nBuyers can message you or ask for a viewing through the site, and we will email you each time.\n\nThe Motoring Central team',
        '/#' || new.kind, 'advert_live', 'advlive:' || new.owner_id);
    end if;
    return new;
  end if;
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
  return new;
exception when others then
  raise warning 'email not queued: %', sqlerrm;
  return new;
end $$;
drop trigger if exists adverts_mail on public.adverts;
create trigger adverts_mail after insert or update of status on public.adverts
  for each row execute function private.mail_advert();

-- 5. buyer and seller messages, viewing requests
create or replace function private.mail_advert_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare title text := coalesce(nullif(new.advert_title,''), 'your vehicle'); txt text := left(coalesce(new.body,''), 800);
  sub text; msg text; when_txt text := nullif(concat_ws(' ', new.meta->>'date', new.meta->>'time'), '');
  link text := '/#account';
begin
  if new.from_role = 'buyer' then
    if exists (select 1 from public.partners p where p.id = new.seller_id and p.role = 'dealer') then link := '/#dashboard'; end if;
    if new.kind = 'viewing' then
      sub := 'Viewing request: ' || title;
      msg := coalesce(nullif(new.buyer_name,''),'A buyer') || ' would like to view or test drive your ' || title ||
             coalesce(E'.\nWhen: ' || when_txt, '') || E'.\n' || case when txt <> '' then E'\nTheir message:\n"' || txt || E'"\n' else '' end ||
             E'\nLog in to confirm the viewing or suggest another time.';
    else
      sub := 'New message about your ' || title;
      msg := coalesce(nullif(new.buyer_name,''),'A buyer') || E' sent you a message:\n\n"' || txt || E'"\n\nLog in to reply. Keep talking through the site until you are happy: never send money or personal documents to someone you have not met.';
    end if;
    perform private.mail(private.user_email(new.seller_id), 'seller', sub, E'Hello,\n\n' || msg || E'\n\nThe Motoring Central',
      link, 'advert_message_seller', 'am:' || new.advert_id || ':' || new.buyer_id || ':' || new.kind);
  else
    sub := case new.kind when 'viewing_ok' then 'Your viewing is confirmed: ' || title
                         when 'viewing_no' then 'The seller cannot do that time: ' || title
                         else 'The seller replied about the ' || title end;
    msg := case new.kind when 'viewing_ok' then 'The seller has confirmed your viewing of the ' || title || coalesce(' for ' || when_txt, '') || E'.\n'
                         when 'viewing_no' then 'The seller cannot do the time you asked for to see the ' || title || E'. Log in to pick another time.\n'
                         else '' end ||
           case when txt <> '' then E'\nThe seller wrote:\n"' || txt || E'"\n' else '' end ||
           E'\nLog in to reply. Never pay a deposit or send money before you have seen the vehicle and its documents.';
    perform private.mail(private.user_email(new.buyer_id), 'buyer', sub, 'Hello ' || private.first_name(new.buyer_name) || E',\n\n' || msg || E'\n\nThe Motoring Central',
      '/#account', 'advert_message_buyer', 'am:' || new.advert_id || ':' || new.buyer_id || ':s:' || new.kind);
  end if;
  return new;
exception when others then
  raise warning 'email not queued: %', sqlerrm;
  return new;
end $$;
drop trigger if exists advert_messages_mail on public.advert_messages;
create trigger advert_messages_mail after insert on public.advert_messages
  for each row execute function private.mail_advert_message();

-- 6. bookings other than MOT (MOT emails are already queued by book_mot / move / cancel)
create or replace function private.mail_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
declare g public.partners; cem text := private.user_email(new.customer_id);
  ref text := upper(left(new.id::text, 8)); svc text := coalesce(nullif(new.service,''), nullif(new.kind,''), 'your booking');
  veh text := coalesce(nullif(upper(new.vehicle->>'reg'),''), 'your vehicle');
  hi text := 'Hello ' || private.first_name(new.customer_name) || E',\n\n';
begin
  if upper(coalesce(new.kind,'')) = 'MOT' then return new; end if;
  select * into g from public.partners where id = new.partner_id;
  if tg_op = 'INSERT' then
    perform private.mail(cem, 'customer', 'Booking confirmed: ' || svc,
      hi || E'Thank you for booking with The Motoring Central.\n\n' || coalesce(new.summary,'') ||
      coalesce(E'\n\nYour partner: ' || nullif(g.name,'') || coalesce(', ' || nullif(g.phone,''), ''), '') ||
      E'\nBooking reference: ' || ref ||
      E'\n\nYou can follow the job in your account: we update it when your partner is on the way, starts and finishes.\n\nThe Motoring Central',
      '/#account', 'booking_customer', null, new.id);
    if g.email is not null then
      perform private.mail(g.email, 'partner', 'New job booked: ' || svc || ', ' || veh,
        E'Hello,\n\nA customer has booked you through The Motoring Central.\n\n' || coalesce(new.summary,'') ||
        E'\n\nCustomer: ' || coalesce(new.customer_name,'') || coalesce(', ' || nullif(new.customer_phone,''), '') ||
        E'\nReference: ' || ref ||
        E'\n\nOpen your dashboard to see the job and update the customer (on the way, started, completed).\n\nThe Motoring Central',
        '/#dashboard', 'booking_partner', null, new.id);
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'onway' then
      perform private.mail(cem, 'customer', coalesce(nullif(g.name,''),'Your partner') || ' is on the way',
        hi || coalesce(nullif(g.name,''),'Your partner') || ' is on the way for your ' || svc || ' (' || veh || ').' ||
        coalesce(E'\nTheir phone: ' || nullif(g.phone,''), '') || E'\nReference: ' || ref || E'\n\nThe Motoring Central',
        '/#account', 'booking_onway', null, new.id);
    elsif new.status = 'done' then
      perform private.mail(cem, 'customer', 'Job completed: ' || svc,
        hi || coalesce(nullif(g.name,''),'Your partner') || ' has marked your ' || svc || ' (' || veh || E') as completed.\n\n' ||
        E'How did it go? Leaving a review takes a minute and helps other drivers choose.\nAny warranty on the work is given by the partner who did it.\n\nReference: ' || ref || E'\n\nThe Motoring Central',
        '/#review', 'booking_done', null, new.id);
    elsif new.status = 'cancelled' then
      perform private.mail(cem, 'customer', 'Booking cancelled: ' || svc,
        hi || 'Your booking for ' || svc || ' (' || veh || E') has been cancelled.\n' ||
        coalesce('Reason: ' || nullif(new.cancel_reason,'') || E'\n', '') ||
        E'If you have paid, we will refund you to the card you used.\nReference: ' || ref || E'\n\nThe Motoring Central',
        '/#account', 'booking_cancelled', null, new.id);
    end if;
  end if;
  return new;
exception when others then
  raise warning 'email not queued: %', sqlerrm;
  return new;
end $$;
drop trigger if exists bookings_mail on public.bookings;
create trigger bookings_mail after insert or update of status on public.bookings
  for each row execute function private.mail_booking();

-- 7. quotes reaching the customer
create or replace function private.mail_quote() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.quote_requests;
begin
  select * into r from public.quote_requests where id = new.request_id;
  if not found then return new; end if;
  perform private.mail(private.user_email(r.customer_id), 'customer',
    'New quote for your ' || r.job || ': £' || to_char(new.price, 'FM999990.00'),
    'Hello ' || private.first_name(r.first_name) || E',\n\n' ||
    coalesce(nullif(new.partner_name,''),'A partner') || ' has sent you a quote of £' || to_char(new.price, 'FM999990.00') ||
    ' for ' || r.job || coalesce(' (' || nullif(upper(r.vehicle->>'reg'),'') || ')', '') || E'.\n' ||
    case when coalesce(new.note,'') <> '' then E'\nTheir note: "' || left(new.note, 300) || E'"\n' else '' end ||
    E'\nLog in to compare your quotes and book the one you want. Quote request ' || r.id || E'.\n\nThe Motoring Central',
    '/#account', 'quote_received', 'q:' || new.request_id || ':' || new.partner_id);
  return new;
exception when others then
  raise warning 'email not queued: %', sqlerrm;
  return new;
end $$;
drop trigger if exists quotes_mail on public.quotes;
create trigger quotes_mail after insert on public.quotes
  for each row execute function private.mail_quote();

-- 8. MOT reminder the day before (customer), queued by the daily job below
create or replace function private.queue_mot_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare b record; n int := 0; tomorrow date := (now() at time zone 'Europe/London')::date + 1; when_txt text; mob text;
begin
  for b in select k.*, g.name gname, g.town gtown, g.phone gphone from public.bookings k left join public.partners g on g.id = k.partner_id
           where upper(k.kind) = 'MOT' and k.status = 'confirmed' and k.slot_day = tomorrow and k.cancelled_at is null
             and not exists (select 1 from public.notifications x where x.booking_id = k.id and x.kind = 'mot_reminder') loop
    when_txt := 'tomorrow at ' || to_char(make_time(b.slot_start/60, b.slot_start%60, 0), 'FMHH12:MI') || lower(to_char(make_time(b.slot_start/60, b.slot_start%60, 0), 'AM'));
    perform private.mail(private.user_email(b.customer_id), 'customer', 'Reminder: your MOT is ' || when_txt,
      'Hello ' || private.first_name(b.customer_name) || E',\n\nA quick reminder that your MOT for ' ||
      coalesce(nullif(upper(b.vehicle->>'reg'),''), 'your vehicle') || ' is ' || when_txt || E'.\n\nGarage: ' ||
      coalesce(b.gname,'') || ', ' || coalesce(b.gtown,'') || ', ' || coalesce(b.gphone,'') ||
      E'\nIt is already paid. Please arrive a few minutes early.\nBooking reference: ' || upper(left(b.id::text,8)) || E'\n\nThe Motoring Central',
      '/#account', 'mot_reminder', null, b.id);
    mob := private.uk_mobile(b.customer_phone);
    if mob is not null then
      insert into public.notifications(booking_id, to_who, channel, to_addr, body, kind)
      values (b.id, 'customer', 'sms', mob, left('Reminder: your MOT for ' || coalesce(nullif(upper(b.vehicle->>'reg'),''),'your vehicle') || ' is ' || when_txt ||
        ' at ' || coalesce(b.gname,'the garage') || '. Ref ' || upper(left(b.id::text,8)) || '. The Motoring Central', 600), 'mot_reminder');
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- 9. the timed jobs: send waiting emails every 2 minutes, MOT reminders every evening
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'notify_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'notify_cron_secret', 'Lets the timed job run the notify function');
  end if;
end $$;

-- the notify function checks the timed job's key with this (only the server can call it)
create or replace function public.notify_cron_ok(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'notify_cron_secret' and decrypted_secret = p_key)
$$;
revoke all on function public.notify_cron_ok(text) from public, anon, authenticated;
grant execute on function public.notify_cron_ok(text) to service_role;

create or replace function private.kick_notify() returns void
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if not exists (select 1 from public.notifications where status = 'queued') then return; end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'notify_cron_secret';
  perform net.http_post(
    url := 'https://hctboldpuyztugpwexdy.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', k),
    body := '{"cron":true}'::jsonb, timeout_milliseconds := 20000);
end $$;

revoke all on function private.kick_notify(), private.queue_mot_reminders(), private.mail(text,text,text,text,text,text,text,uuid),
  private.mail_owners(text,text,text,text,text), private.user_email(uuid) from public, anon, authenticated;

select cron.unschedule(jobname) from cron.job where jobname in ('send-notifications', 'mot-reminders');
select cron.schedule('send-notifications', '*/2 * * * *', $$select private.kick_notify()$$);
select cron.schedule('mot-reminders', '0 17 * * *', $$select private.queue_mot_reminders(); select private.kick_notify()$$);

-- (applied separately as 20261119f_first_name_case) first names in emails as "Vimen", not "VIMEN"
create or replace function private.first_name(p text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(initcap(lower(nullif(split_part(trim(coalesce(p,'')),' ',1),''))), 'there') $$;
