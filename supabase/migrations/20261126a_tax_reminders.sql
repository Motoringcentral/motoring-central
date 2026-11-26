-- Vehicle tax reminders, and the "My garage" reminder box connected (26 Nov 2026)
-- The DVLA look-up now gives each vehicle's tax due date. A customer's saved vehicles keep it, and the daily reminder job
-- emails them a month and a week before the tax is due, in the same way as MOT reminders. One row per vehicle and email
-- covers both, and the stop link in either email stops both.
-- p_auto: the page refreshing dates it read from the DVLA. It only updates a reminder that already exists and belongs to
-- the logged-in customer, and never restarts one they stopped. Without it (the customer asked), the reminder is created
-- or restarted.

alter table public.mot_reminders add column if not exists tax_due date;
alter table public.mot_reminders add column if not exists tax_sent_30 date;
alter table public.mot_reminders add column if not exists tax_sent_7 date;

drop function if exists public.add_mot_reminder(text, text, date);
create or replace function public.add_mot_reminder(p_reg text, p_email text, p_due date default null,
  p_tax_due date default null, p_auto boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare r text := upper(regexp_replace(coalesce(p_reg,''), '[^A-Za-z0-9]', '', 'g'));
  e text := lower(trim(coalesce(p_email,''))); uid uuid := (select auth.uid()); tx date := p_tax_due;
begin
  if r !~ '^[A-Z0-9]{2,8}$' then return 'bad_reg'; end if;
  if length(e) > 200 or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return 'bad_email'; end if;
  if p_due is not null and (p_due < current_date - 400 or p_due > current_date + 1500) then p_due := null; end if;
  if tx is not null and (tx < current_date - 400 or tx > current_date + 800) then tx := null; end if;
  if coalesce(p_auto, false) then
    update public.mot_reminders set
      due = coalesce(p_due, due),
      sent_30 = case when p_due is not null and p_due is distinct from due then null else sent_30 end,
      sent_7 = case when p_due is not null and p_due is distinct from due then null else sent_7 end,
      tax_due = coalesce(tx, tax_due),
      tax_sent_30 = case when tx is not null and tx is distinct from tax_due then null else tax_sent_30 end,
      tax_sent_7 = case when tx is not null and tx is distinct from tax_due then null else tax_sent_7 end
    where reg = r and email = e and uid is not null and user_id = uid;
    return case when found then 'ok' else 'none' end;
  end if;
  if (select count(*) from public.mot_reminders where created_at > now() - interval '1 hour') >= 300 then return 'busy'; end if;
  if (select count(*) from public.mot_reminders where email = e) >= 10
     and not exists (select 1 from public.mot_reminders where email = e and reg = r) then return 'too_many'; end if;
  insert into public.mot_reminders(reg, email, due, tax_due, user_id) values (r, e, p_due, tx, uid)
  on conflict (reg, email) do update set due = coalesce(excluded.due, public.mot_reminders.due),
    tax_due = coalesce(excluded.tax_due, public.mot_reminders.tax_due),
    stopped = false, user_id = coalesce(public.mot_reminders.user_id, excluded.user_id);
  return 'ok';
end $$;
revoke all on function public.add_mot_reminder(text, text, date, date, boolean) from public;
grant execute on function public.add_mot_reminder(text, text, date, date, boolean) to anon, authenticated;

-- queued every afternoon with the MOT reminders (cron job 'mot-reminders')
create or replace function private.queue_tax_due_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare m record; n int := 0; d date := (now() at time zone 'Europe/London')::date; days int;
begin
  for m in select * from public.mot_reminders
           where not stopped and tax_due is not null and tax_due >= d and tax_due <= d + 30
             and ((tax_due - d <= 30 and tax_due - d > 7 and tax_sent_30 is null) or (tax_due - d <= 7 and tax_sent_7 is null)) loop
    days := m.tax_due - d;
    perform private.mail(m.email, 'customer',
      'Vehicle tax reminder: ' || m.reg || ' is due ' || case when days = 0 then 'today' when days = 1 then 'tomorrow' else 'in ' || days || ' days' end,
      E'Hello,\n\nThe vehicle tax for ' || m.reg || ' is due on ' || to_char(m.tax_due, 'FMDay FMDD FMMonth YYYY') || E', according to the DVLA.\n\n' ||
      E'You can tax it on GOV.UK, the official site, with the 11-digit reference from your V5C logbook or the 16-digit ' ||
      E'reference from a DVLA reminder letter:\nhttps://www.gov.uk/vehicle-tax\n\n' ||
      E'If the vehicle is off the road, you must make a SORN instead.\n\nStop these reminders: ' || private.site_url() || '/?motstop=' || m.token ||
      E'\n\nThe Motoring Central', '/#account', 'tax_due', 'taxdue:' || m.id || ':' || case when days <= 7 then '7' else '30' end, null);
    if days <= 7 then update public.mot_reminders set tax_sent_7 = d, tax_sent_30 = coalesce(tax_sent_30, d) where id = m.id;
    else update public.mot_reminders set tax_sent_30 = d where id = m.id; end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function private.queue_tax_due_reminders() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('mot-reminders');
exception when others then null; end $$;
select cron.schedule('mot-reminders', '0 17 * * *',
  'select private.queue_mot_reminders(); select private.queue_mot_due_reminders(); select private.queue_tax_due_reminders(); select private.kick_notify()');
