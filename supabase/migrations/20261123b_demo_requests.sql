-- Demo on request (23 Nov 2026)
-- The try-it demo is no longer open to everyone. A business asks for it on the "Request a demo" page, the request shows on
-- the admin page, and staff send a personal link for that business's trade. The link (/#mydemo-<code>) works for 30 days
-- and we can see whether it has been opened. The demo itself still runs in the visitor's browser on sample data.

create table if not exists public.demo_requests (
  id bigint generated always as identity primary key,
  ref text unique,
  trade text not null check (trade in ('mot','valet','instructor','body','autoelec','dealer','recovery','evcharge')),
  name text not null check (char_length(name) between 2 and 120),
  business text not null check (char_length(business) between 2 and 160),
  email text not null check (char_length(email) between 3 and 200),
  phone text check (char_length(phone) <= 40),
  town text check (char_length(town) <= 80),
  note text check (char_length(note) <= 1000),
  source text check (char_length(source) <= 60),
  status text not null default 'new' check (status in ('new','sent','closed')),
  code text unique,
  sent_at timestamptz,
  sent_by text,
  sends int not null default 0,
  ends_at timestamptz,
  opened_at timestamptz,
  last_open_at timestamptz,
  opens int not null default 0,
  staff_note text check (char_length(staff_note) <= 1000),
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists demo_requests_status on public.demo_requests (status, created_at desc);
create index if not exists demo_requests_email on public.demo_requests (email, created_at desc);
alter table public.demo_requests enable row level security;
revoke all on public.demo_requests from anon, authenticated;

-- the eight trades that have a demo: what we call them, and the page a business joins on
create or replace function private.demo_trade(p text) returns table(label text, join_hash text)
language sql immutable set search_path = '' as $$
  select t.label, t.join_hash from (values
    ('mot', 'MOT test stations', 'mot-station'),
    ('valet', 'valeters', 'valets'),
    ('instructor', 'driving instructors', 'instructors'),
    ('body', 'body shops and alloy wheel refurbishers', 'bodyshop'),
    ('autoelec', 'auto electricians and locksmiths', 'auto-electrician'),
    ('dealer', 'car and van dealers', 'dealers'),
    ('recovery', 'recovery companies', 'recovery'),
    ('evcharge', 'mobile EV charging companies', 'evcharging')
  ) as t(k, label, join_hash) where t.k = p
$$;

-- anyone: ask for a demo
create or replace function public.request_demo(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare tr text := lower(btrim(coalesce(p->>'trade','')));
        nm text := left(btrim(coalesce(p->>'name','')), 120);
        biz text := left(btrim(coalesce(p->>'business','')), 160);
        em text := lower(btrim(coalesce(p->>'email','')));
        ph text := left(btrim(coalesce(p->>'phone','')), 40);
        tw text := left(btrim(coalesce(p->>'town','')), 80);
        nt text := left(btrim(coalesce(p->>'note','')), 1000);
        src text := left(btrim(coalesce(p->>'source','')), 60);
        lab text; r public.demo_requests; recent int;
begin
  select t.label into lab from private.demo_trade(tr) t;
  if lab is null then raise exception 'bad_trade'; end if;
  if char_length(nm) < 2 then raise exception 'bad_name'; end if;
  if char_length(biz) < 2 then raise exception 'bad_business'; end if;
  if char_length(em) > 200 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email'; end if;
  -- the same person asking again for the same trade while we have not answered: keep the one request
  select * into r from public.demo_requests where email = em and trade = tr and status = 'new'
    and created_at > now() - interval '7 days' order by id desc limit 1;
  if found then return jsonb_build_object('ref', r.ref, 'again', true); end if;
  select count(*) into recent from public.demo_requests where email = em and created_at > now() - interval '1 day';
  if recent >= 4 then raise exception 'too_many'; end if;
  select count(*) into recent from public.demo_requests where created_at > now() - interval '10 minutes';
  if recent >= 40 then raise exception 'too_many'; end if;
  insert into public.demo_requests (trade, name, business, email, phone, town, note, source, history)
  values (tr, nm, biz, em, nullif(ph,''), nullif(tw,''), nullif(nt,''), nullif(src,''),
          jsonb_build_array(jsonb_build_object('at', now(), 'what', 'Asked for a demo')))
  returning * into r;
  update public.demo_requests set ref = 'DEM-' || lpad(r.id::text, 5, '0') where id = r.id returning * into r;
  perform private.mail_owners('New demo request ' || r.ref || ': ' || biz || ' (' || lab || ')',
    'A business has asked for a demo.' || E'\n\nBusiness: ' || biz || E'\nTrade: ' || lab || E'\nName: ' || nm || E'\nEmail: ' || em ||
    coalesce(E'\nPhone: ' || r.phone, '') || coalesce(E'\nTown or postcode: ' || r.town, '') || coalesce(E'\nCame from: ' || r.source, '') ||
    coalesce(E'\n\nThey wrote: ' || r.note, '') ||
    E'\n\nTo send it: open the admin page, Partners, Demo requests, and tap "Send the demo".',
    '/#admin', 'staff_demo', 'demo:' || r.id);
  perform private.mail(em, 'partner', 'We have your demo request (' || r.ref || ')',
    'Hello ' || private.first_name(nm) || E',\n\nThank you for asking to see The Motoring Central for ' || lab ||
    E'. We will email you your personal demo link, usually within one working day.\n\nIf you have any questions before then, just reply to this email.\n\nThe Motoring Central',
    null, 'demo_received', 'demoack:' || r.id);
  return jsonb_build_object('ref', r.ref);
end $$;
revoke all on function public.request_demo(jsonb) from public;
grant execute on function public.request_demo(jsonb) to anon, authenticated;

-- staff: the list
create or replace function public.staff_demo_requests() returns setof public.demo_requests
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  return query select * from public.demo_requests
    order by (status = 'closed'), (status <> 'new'), created_at desc limit 500;
end $$;
revoke all on function public.staff_demo_requests() from public, anon;
grant execute on function public.staff_demo_requests() to authenticated;

-- staff: send the demo (or send it again). Makes the personal link, good for 30 days from now.
-- p_email false: make the link but send no email (staff will paste it into their own message).
create or replace function public.staff_demo_send(p_id bigint, p_email boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.demo_requests; me text; lab text; jh text; mail boolean := coalesce(p_email, true);
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  select * into r from public.demo_requests where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  select coalesce(s.name, 'Staff') into me from public.staff s where s.user_id = (select auth.uid());
  select t.label, t.join_hash into lab, jh from private.demo_trade(r.trade) t;
  update public.demo_requests set
    code = coalesce(code, substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    status = 'sent', sent_at = now(), sent_by = coalesce(me, 'Staff'), sends = sends + case when mail then 1 else 0 end,
    ends_at = now() + interval '30 days', updated_at = now(),
    history = history || jsonb_build_array(jsonb_build_object('at', now(), 'by', coalesce(me, 'Staff'), 'what',
      case when mail then case when sends > 0 then 'Demo link emailed again' else 'Demo link emailed' end else 'Demo link made (not emailed)' end))
  where id = p_id returning * into r;
  if mail then
    perform private.mail(r.email, 'partner', 'Your demo of The Motoring Central for ' || lab,
      'Hello ' || private.first_name(r.name) || E',\n\nThank you for asking to see The Motoring Central. Here is your personal demo for ' || lab || E'.\n\n' ||
      E'It opens the same dashboard our partners use, with a sample business and sample jobs already in it. A step-by-step guide shows you round in about two minutes. Nothing is saved or sent, and you cannot break anything.\n\n' ||
      E'Your link works until ' || to_char(r.ends_at at time zone 'Europe/London', 'FMDay FMDD FMMonth YYYY') || E'. It is for you and your business.\n\n' ||
      E'When you are ready, joining takes about five minutes: ' || private.site_url() || '/#' || jh || E'\n\n' ||
      E'Any questions, just reply to this email.\n\nThe Motoring Central',
      '/#mydemo-' || r.code, 'demo_link', 'demolink:' || r.id || ':' || r.sends);
  end if;
  return jsonb_build_object('link', private.site_url() || '/#mydemo-' || r.code, 'ends_at', r.ends_at, 'emailed', mail, 'email', r.email);
end $$;
revoke all on function public.staff_demo_send(bigint, boolean) from public, anon;
grant execute on function public.staff_demo_send(bigint, boolean) to authenticated;

-- staff: close a request, reopen it, stop its link, or keep a note
create or replace function public.staff_demo_set(p_id bigint, p_action text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare me text; nt text := nullif(left(btrim(coalesce(p_note,'')), 1000), '');
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  if p_action not in ('close','reopen','stop','note') then raise exception 'bad_action'; end if;
  select coalesce(s.name, 'Staff') into me from public.staff s where s.user_id = (select auth.uid());
  update public.demo_requests set updated_at = now(),
    status = case p_action when 'close' then 'closed' when 'reopen' then case when code is null then 'new' else 'sent' end else status end,
    ends_at = case when p_action = 'stop' then now() else ends_at end,
    staff_note = case when nt is not null then nt else staff_note end,
    history = history || jsonb_build_array(jsonb_build_object('at', now(), 'by', coalesce(me, 'Staff'), 'what',
      case p_action when 'close' then 'Closed' when 'reopen' then 'Reopened' when 'stop' then 'Link stopped' else 'Note saved' end))
  where id = p_id;
  if not found then raise exception 'not_found'; end if;
end $$;
revoke all on function public.staff_demo_set(bigint, text, text) from public, anon;
grant execute on function public.staff_demo_set(bigint, text, text) to authenticated;

-- anyone with a personal link: check it and say which demo to open. Counts the visit (not when staff open it).
create or replace function public.demo_open(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c text := lower(btrim(coalesce(p_code,''))); r public.demo_requests;
begin
  if c !~ '^[a-f0-9]{12}$' then raise exception 'bad_link'; end if;
  select * into r from public.demo_requests where code = c;
  if not found then raise exception 'bad_link'; end if;
  if r.ends_at is null or r.ends_at < now() then return jsonb_build_object('ended', true, 'trade', r.trade); end if;
  if not coalesce((select private.is_staff()), false) then
    update public.demo_requests set opens = opens + 1, opened_at = coalesce(opened_at, now()), last_open_at = now() where id = r.id;
  end if;
  return jsonb_build_object('trade', r.trade, 'name', private.first_name(r.name), 'ends_at', r.ends_at);
end $$;
revoke all on function public.demo_open(text) from public;
grant execute on function public.demo_open(text) to anon, authenticated;

-- the admin page's counts: add demo requests waiting to be sent
create or replace function public.staff_counts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  return jsonb_build_object(
    'refunds', (select count(*) from public.bookings where refund_status = 'due'),
    'refunds_total', (select coalesce(sum(refund_amount), 0) from public.bookings where refund_status = 'due'),
    'messages', (select count(*) from public.contact_messages where kind = 'message' and status in ('new','in_progress','escalated')),
    'complaints', (select count(*) from public.contact_messages where kind = 'complaint' and status in ('new','in_progress','escalated')),
    'complaints_late', (select count(*) from public.contact_messages where kind = 'complaint' and status in ('new','in_progress','escalated') and respond_by < current_date),
    'lessons_unpaid', (select count(*) from public.bookings where kind = 'Driving lesson' and status = 'confirmed' and details->>'unpaid' = 'true'),
    'demos', (select count(*) from public.demo_requests where status = 'new'));
end $$;
