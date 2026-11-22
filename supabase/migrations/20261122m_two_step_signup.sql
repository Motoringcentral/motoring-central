-- Two-step sign-up for partners (22 Nov 2026; used by recovery first).
-- Step 1: the business registers with an email and a password only. A partner row is made with status 'started'.
-- Step 2: signed in, they watch the "how it works" video and send the application (submit_application), which moves
--         the row to 'pending' exactly as a one-step application did. Staff see 'started' rows as leads to chase.
alter table public.partners drop constraint if exists partners_status_check;
alter table public.partners add constraint partners_status_check
  check (status = any (array['started','pending','approved','rejected','suspended']));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $function$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if m->>'kind' = 'partner' and m->>'role' in ('mechanic','recovery','evcharge','body','tyres','valet','dealer') then
    insert into public.partners (id, email, role, sub, name, phone, town, website, plan, rates, details, status)
    values (
      new.id, coalesce(new.email, ''), m->>'role', left(m->>'sub', 40),
      left(coalesce(m->>'name', ''), 160), left(coalesce(m->>'phone', ''), 30), left(coalesce(m->>'town', ''), 80),
      left(m->>'website', 200), left(coalesce(m->>'plan', 'payg'), 30),
      case when jsonb_typeof(m->'rates') = 'object' then m->'rates' else '{}'::jsonb end,
      case when jsonb_typeof(m->'details') = 'object' then m->'details' else '{}'::jsonb end,
      case when m->>'stage' = 'started' then 'started' else 'pending' end
    );
  else
    insert into public.profiles (id, name, phone, postcode, news, terms_at)
    values (
      new.id,
      left(coalesce(m->>'name', ''), 120), left(coalesce(m->>'phone', ''), 30), left(coalesce(m->>'postcode', ''), 10),
      coalesce((m->>'news') = 'true', false), now()
    );
  end if;
  return new;
end $function$;

-- emails: a welcome when they register; "application received" (and the note to owners) when the application is sent
do $$
declare d text := pg_get_functiondef('private.mail_partner'::regproc);
begin
  if position('mc_started_welcome' in d) = 0 then
    if position('  if tg_op = ''INSERT'' then' in d) = 0 then raise exception 'mail_partner: insert branch not found'; end if;
    d := replace(d, '  if tg_op = ''INSERT'' then',
$r$  if tg_op = 'INSERT' and new.status = 'started' then
    perform private.mail(new.email, 'partner', 'Welcome: one more step to join The Motoring Central',
      E'Hello,\n\nThank you for registering as a ' || lbl || E'. Your account is ready.\n\n' ||
      E'One more step: log in, watch the short video on how it works, and send us your application with your insurance documents and photo ID. It takes about five minutes.\n\nThe Motoring Central team',
      '/#login', 'mc_started_welcome', 'start:' || new.id);
    perform private.mail_owners('New sign-up started: ' || coalesce(new.email,'') || ' (' || lbl || ')',
      'A ' || lbl || E' has registered but has not sent the application yet.\n\nEmail: ' || coalesce(new.email,'') ||
      E'\n\nThey appear on the Staff page under "Started, not finished". We remind them once after a day.',
      '/#staff', 'staff_signup_started', 'startapp:' || new.id);
    return new;
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status = 'started' and new.status = 'pending') then$r$);
    execute d;
  end if;
end $$;

create or replace function public.submit_application(p_name text, p_phone text, p_town text, p_website text, p_sub text, p_rates jsonb, p_details jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.partners;
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  select * into g from public.partners where id = uid for update;
  if not found then raise exception 'not_partner'; end if;
  if g.status <> 'started' then raise exception 'already_sent'; end if;
  if btrim(coalesce(p_name,'')) = '' then raise exception 'name_needed'; end if;
  if pg_column_size(coalesce(p_details,'{}'::jsonb)) > 40000 or pg_column_size(coalesce(p_rates,'{}'::jsonb)) > 2000 then raise exception 'too_big'; end if;
  perform set_config('mc.self_cancel', '1', true);   -- the partner moves their own row from started to pending
  update public.partners set name = left(btrim(p_name), 160), phone = left(coalesce(p_phone,''), 30), town = left(coalesce(p_town,''), 80),
    website = left(nullif(btrim(coalesce(p_website,'')),''), 200), sub = left(nullif(btrim(coalesce(p_sub,'')),''), 40),
    rates = case when jsonb_typeof(p_rates) = 'object' then p_rates else '{}'::jsonb end,
    details = case when jsonb_typeof(p_details) = 'object' then p_details else '{}'::jsonb end,
    status = 'pending', submitted_at = now()
  where id = uid;
  perform set_config('mc.self_cancel', '', true);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.submit_application(text,text,text,text,text,jsonb,jsonb) from public, anon;
grant execute on function public.submit_application(text,text,text,text,text,jsonb,jsonb) to authenticated;

-- one reminder, a day after registering, if the application has still not been sent
create or replace function private.queue_started_reminders() returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select p.id, p.email, p.role, p.sub from public.partners p
           where p.status = 'started' and p.created_at < now() - interval '24 hours' and p.created_at > now() - interval '14 days'
             and not exists (select 1 from public.notifications n where n.ref = 'startnudge:' || p.id) loop
    perform private.mail(r.email, 'partner', 'Finish joining The Motoring Central: about five minutes',
      E'Hello,\n\nYou registered as a ' || private.role_label(r.role, r.sub) || E' but have not sent your application yet.\n\n' ||
      E'Log in, watch the short video on how it works, and send your application with your insurance documents and photo ID. There is no joining fee and no monthly fee.\n\nIf you have any questions, just reply to this email.\n\nThe Motoring Central team',
      '/#login', 'mc_started_reminder', 'startnudge:' || r.id);
  end loop;
end $$;
select cron.unschedule('started-reminders') where exists (select 1 from cron.job where jobname = 'started-reminders');
select cron.schedule('started-reminders', '10 10 * * *', 'select private.queue_started_reminders(); select private.kick_notify()');
