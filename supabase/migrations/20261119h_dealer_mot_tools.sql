-- Dealer, car sales and MOT tools (19 Nov 2026, evening)
-- 1) Adverts: the server records when an advert was first listed (data.since) and every price change
--    (data.ph: up to 12 entries of {p: price, at: time}). Sellers cannot write either field themselves.
-- 2) Free MOT reminders for anyone, by registration and email (public.mot_reminders). Emails go out
--    30 days and 7 days before the MOT is due, once the email service is switched on. Every email has a stop link.
-- 3) MOT test stations can mark an online MOT as done or as a no-show (public.mot_outcome).

-- 1. advert price history and listed date -------------------------------------------------------
create or replace function private.advert_price() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pn numeric; po numeric; w numeric; wj jsonb; rj jsonb; ph jsonb; sj jsonb;
  nowj jsonb := to_jsonb(to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
begin
  begin pn := (new.data->>'price')::numeric; exception when others then pn := null; end;
  if tg_op = 'INSERT' then
    new.data := new.data - 'was' - 'reduced_at' - 'ph' - 'since';
    new.data := new.data || jsonb_build_object('since', nowj)
      || case when pn is not null then jsonb_build_object('ph', jsonb_build_array(jsonb_build_object('p', pn, 'at', nowj))) else '{}'::jsonb end;
    return new;
  end if;
  if not private.is_staff() and coalesce(current_setting('mc.renew', true), '') <> 'on' then
    new.expires_at := old.expires_at;
    if old.data ? 'exp' then new.data := jsonb_set(new.data, '{exp}', old.data->'exp'); end if;
  end if;
  begin po := (old.data->>'price')::numeric; exception when others then po := null; end;
  begin w := (old.data->>'was')::numeric; exception when others then w := null; end;
  wj := old.data->'was'; rj := old.data->'reduced_at';
  if pn is not null and po is not null and pn < po then
    wj := to_jsonb(greatest(coalesce(w, po), po)); rj := nowj;
  elsif pn is not null and w is not null and pn >= w then
    wj := null; rj := null;
  end if;
  -- price history: start it from the old price if it was never recorded, then add the change
  ph := case when jsonb_typeof(old.data->'ph') = 'array' then old.data->'ph' else '[]'::jsonb end;
  if pn is not null and po is distinct from pn then
    if jsonb_array_length(ph) = 0 and po is not null then
      ph := jsonb_build_array(jsonb_build_object('p', po, 'at', to_jsonb(to_char(old.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))));
    end if;
    ph := ph || jsonb_build_array(jsonb_build_object('p', pn, 'at', nowj));
    select coalesce(jsonb_agg(e order by i), '[]'::jsonb) into ph
      from (select e, i from jsonb_array_elements(ph) with ordinality as t(e, i) order by i desc limit 12) z;
  end if;
  sj := coalesce(old.data->'since', to_jsonb(to_char(old.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
  new.data := (new.data - 'was' - 'reduced_at' - 'ph' - 'since')
    || jsonb_strip_nulls(jsonb_build_object('was', wj, 'reduced_at', rj))
    || jsonb_build_object('since', sj)
    || case when jsonb_array_length(ph) > 0 then jsonb_build_object('ph', ph) else '{}'::jsonb end;
  return new;
end $$;

-- 2. free MOT reminders -----------------------------------------------------------------------
create table if not exists public.mot_reminders (
  id bigint generated always as identity primary key,
  reg text not null check (reg ~ '^[A-Z0-9]{2,8}$'),
  email text not null check (length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  due date,
  user_id uuid references auth.users(id) on delete set null,
  token uuid not null default gen_random_uuid(),
  stopped boolean not null default false,
  sent_30 date, sent_7 date,
  created_at timestamptz not null default now(),
  unique (reg, email)
);
alter table public.mot_reminders enable row level security;
drop policy if exists "mot reminders: own read" on public.mot_reminders;
create policy "mot reminders: own read" on public.mot_reminders for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
drop policy if exists "mot reminders: own delete" on public.mot_reminders;
create policy "mot reminders: own delete" on public.mot_reminders for delete to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, truncate on public.mot_reminders from anon, authenticated;
revoke all on public.mot_reminders from anon;

create or replace function public.add_mot_reminder(p_reg text, p_email text, p_due date default null) returns text
language plpgsql security definer set search_path = '' as $$
declare r text := upper(regexp_replace(coalesce(p_reg,''), '[^A-Za-z0-9]', '', 'g'));
  e text := lower(trim(coalesce(p_email,''))); uid uuid := (select auth.uid());
begin
  if r !~ '^[A-Z0-9]{2,8}$' then return 'bad_reg'; end if;
  if length(e) > 200 or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return 'bad_email'; end if;
  if p_due is not null and (p_due < current_date - 400 or p_due > current_date + 1500) then p_due := null; end if;
  if (select count(*) from public.mot_reminders where created_at > now() - interval '1 hour') >= 300 then return 'busy'; end if;
  if (select count(*) from public.mot_reminders where email = e) >= 10
     and not exists (select 1 from public.mot_reminders where email = e and reg = r) then return 'too_many'; end if;
  insert into public.mot_reminders(reg, email, due, user_id) values (r, e, p_due, uid)
  on conflict (reg, email) do update set due = coalesce(excluded.due, public.mot_reminders.due),
    stopped = false, user_id = coalesce(public.mot_reminders.user_id, excluded.user_id);
  return 'ok';
end $$;
revoke all on function public.add_mot_reminder(text, text, date) from public;
grant execute on function public.add_mot_reminder(text, text, date) to anon, authenticated;

create or replace function public.stop_mot_reminder(p_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.mot_reminders set stopped = true where token = p_token;
  return found;
end $$;
revoke all on function public.stop_mot_reminder(uuid) from public;
grant execute on function public.stop_mot_reminder(uuid) to anon, authenticated;

-- queued every afternoon with the other MOT reminders (cron job 'mot-reminders')
create or replace function private.queue_mot_due_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare m record; n int := 0; d date := (now() at time zone 'Europe/London')::date; days int;
begin
  for m in select * from public.mot_reminders
           where not stopped and due is not null and due >= d and due <= d + 30
             and ((due - d <= 30 and due - d > 7 and sent_30 is null) or (due - d <= 7 and sent_7 is null)) loop
    days := m.due - d;
    perform private.mail(m.email, 'customer',
      'MOT reminder: ' || m.reg || ' is due ' || case when days = 0 then 'today' when days = 1 then 'tomorrow' else 'in ' || days || ' days' end,
      E'Hello,\n\nThe MOT for ' || m.reg || ' is due on ' || to_char(m.due, 'FMDay FMDD FMMonth YYYY') ||
      E'.\nYou can have it tested up to a month (minus a day) before then and keep the same renewal date.\n\n' ||
      E'Book a local MOT test station online, any time of day, at the official maximum fee or less:\n' ||
      private.site_url() || E'/#drivers\n\nStop these reminders: ' || private.site_url() || '/?motstop=' || m.token ||
      E'\n\nThe Motoring Central', '/#drivers', 'mot_due', 'motdue:' || m.id || ':' || case when days <= 7 then '7' else '30' end, null);
    if days <= 7 then update public.mot_reminders set sent_7 = d, sent_30 = coalesce(sent_30, d) where id = m.id;
    else update public.mot_reminders set sent_30 = d where id = m.id; end if;
    n := n + 1;
  end loop;
  -- MOT done: roll the date on a year so the next reminder comes round
  update public.mot_reminders set due = due + interval '1 year', sent_30 = null, sent_7 = null
   where due is not null and due < d - 14 and not stopped;
  return n;
end $$;

do $$ begin
  perform cron.unschedule('mot-reminders');
exception when others then null; end $$;
select cron.schedule('mot-reminders', '0 17 * * *',
  'select private.queue_mot_reminders(); select private.queue_mot_due_reminders(); select private.kick_notify()');

-- 3. MOT outcome: the test station marks an online MOT as done or as a no-show ---------------------
-- A no-show is recorded on the booking (status 'no_show'). The customer did not cancel, so the booking stays paid
-- and the test centre is paid as normal. (Owner can change this rule.)
create or replace function public.mot_outcome(p_booking uuid, p_outcome text) returns text
language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  if p_outcome not in ('done', 'no_show', 'confirmed') then return 'bad_outcome'; end if;
  select * into b from public.bookings where id = p_booking;
  if not found or b.partner_id is distinct from (select auth.uid()) or upper(coalesce(b.kind,'')) <> 'MOT' then return 'not_yours'; end if;
  if b.status = 'cancelled' then return 'cancelled'; end if;
  if p_outcome <> 'confirmed' and b.slot_day > (now() at time zone 'Europe/London')::date then return 'too_early'; end if;
  update public.bookings set status = p_outcome where id = p_booking;
  return 'ok';
end $$;
revoke all on function public.mot_outcome(uuid, text) from public, anon;
grant execute on function public.mot_outcome(uuid, text) to authenticated;
