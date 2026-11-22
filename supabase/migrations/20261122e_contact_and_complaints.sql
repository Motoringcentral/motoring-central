-- Contact form messages and the complaints procedure (22 Nov 2026)
-- Until now the Contact page form did not reach anyone. Every message is now kept here, the owners are emailed, and
-- the sender gets an acknowledgement with a reference. A message about "A problem or complaint" is a complaint: it
-- gets a CMP- reference, a full-response date ([14 days]) and a final date ([8 weeks]), and staff track it to the end.

create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  ref text unique,
  kind text not null default 'message' check (kind in ('message','complaint')),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 200),
  phone text check (char_length(phone) <= 40),
  topic text check (char_length(topic) <= 80),
  reference text check (char_length(reference) <= 80),
  about text check (char_length(about) <= 160),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'new' check (status in ('new','in_progress','responded','escalated','closed')),
  respond_by date,
  final_by date,
  outcome text check (char_length(outcome) <= 2000),
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contact_messages_kind on public.contact_messages (kind, status, created_at desc);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;

-- anyone (logged in or not): send a message or a complaint
create or replace function public.send_contact(p_name text, p_email text, p_phone text, p_topic text, p_reference text,
  p_message text, p_complaint boolean, p_about text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare em text := lower(btrim(coalesce(p_email,''))); nm text := left(btrim(coalesce(p_name,'')), 120);
        msg text := left(btrim(coalesce(p_message,'')), 4000); k text := case when p_complaint then 'complaint' else 'message' end;
        r public.contact_messages; recent int; who text;
begin
  if nm = '' then raise exception 'bad_name'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email'; end if;
  if char_length(msg) < 10 then raise exception 'bad_message'; end if;
  select count(*) into recent from public.contact_messages where email = em and created_at > now() - interval '1 hour';
  if recent >= 5 then raise exception 'too_many'; end if;
  select count(*) into recent from public.contact_messages where created_at > now() - interval '10 minutes';
  if recent >= 60 then raise exception 'too_many'; end if;
  insert into public.contact_messages (kind, user_id, name, email, phone, topic, reference, about, message, respond_by, final_by, history)
  values (k, (select auth.uid()), nm, em, left(btrim(coalesce(p_phone,'')), 40), left(coalesce(p_topic,''), 80),
          left(btrim(coalesce(p_reference,'')), 80), nullif(left(btrim(coalesce(p_about,'')), 160), ''), msg,
          case when p_complaint then (now() at time zone 'Europe/London')::date + 14 end,
          case when p_complaint then (now() at time zone 'Europe/London')::date + 56 end,
          jsonb_build_array(jsonb_build_object('at', now(), 'what', 'Received')))
  returning * into r;
  update public.contact_messages set ref = case when p_complaint then 'CMP-' else 'MSG-' end || lpad(r.id::text, 5, '0')
  where id = r.id returning * into r;
  who := nm || ' <' || em || '>' || coalesce(', ' || nullif(r.phone,''), '');
  perform private.mail_owners(
    case when p_complaint then 'New complaint ' || r.ref || ' from ' || nm else 'New message ' || r.ref || ': ' || coalesce(nullif(r.topic,''),'Contact form') end,
    E'From: ' || who || coalesce(E'\nTopic: ' || nullif(r.topic,''), '') || coalesce(E'\nBooking or registration: ' || nullif(r.reference,''), '') ||
    coalesce(E'\nAbout: ' || r.about, '') || E'\n\n' || msg ||
    case when p_complaint then E'\n\nComplaint timescales: full response by ' || to_char(r.respond_by, 'FMDay FMDD FMMonth') ||
      E', final response by ' || to_char(r.final_by, 'FMDD FMMonth YYYY') || E'. Track it under Staff > Complaints.' else '' end ||
    E'\n\nReply to the sender at ' || em || '.',
    '/#admin', case when p_complaint then 'staff_complaint' else 'staff_contact' end, 'contact:' || r.id);
  perform private.mail(em, 'customer',
    case when p_complaint then 'We have received your complaint (' || r.ref || ')' else 'We have received your message (' || r.ref || ')' end,
    'Hello ' || split_part(nm, ' ', 1) || E',\n\n' ||
    case when p_complaint then
      E'Thank you for telling us. Your complaint reference is ' || r.ref || E'.\n\n' ||
      E'What happens next:\n- A member of our team will contact you within 2 working days.\n' ||
      E'- We aim to give you a full response by ' || to_char(r.respond_by, 'FMDay FMDD FMMonth YYYY') || E'. If we need longer, we will tell you why.\n' ||
      E'- If you are not happy with our response, reply to that email and ask for it to be reviewed by the owner of the business.\n\n' ||
      E'You can read our complaints procedure at ' || private.site_url() || E'/#complaints.\n\nThis does not affect your legal rights.'
    else
      E'Thank you for getting in touch. Your reference is ' || r.ref || E'. We aim to reply within 1 working day.'
    end || E'\n\nThe Motoring Central', null, case when p_complaint then 'complaint_received' else 'contact_received' end, 'contactack:' || r.id);
  return jsonb_build_object('ref', r.ref, 'kind', r.kind, 'respond_by', r.respond_by);
end $$;
revoke all on function public.send_contact(text, text, text, text, text, text, boolean, text) from public;
grant execute on function public.send_contact(text, text, text, text, text, text, boolean, text) to anon, authenticated;

-- staff: messages and complaints
create or replace function public.staff_contact(p_kind text) returns setof public.contact_messages
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  return query select * from public.contact_messages where kind = p_kind
    order by (status = 'closed'), created_at desc limit 300;
end $$;
revoke all on function public.staff_contact(text) from public, anon;
grant execute on function public.staff_contact(text) to authenticated;

create or replace function public.staff_contact_set(p_id bigint, p_status text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare me text;
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  if p_status not in ('new','in_progress','responded','escalated','closed') then raise exception 'bad_status'; end if;
  select coalesce(s.name, 'Staff') into me from public.staff s where s.user_id = (select auth.uid());
  update public.contact_messages set status = p_status, updated_at = now(),
    outcome = case when p_status in ('responded','closed') and nullif(btrim(coalesce(p_note,'')),'') is not null then left(btrim(p_note), 2000) else outcome end,
    history = history || jsonb_build_array(jsonb_build_object('at', now(), 'by', me, 'what',
      case p_status when 'in_progress' then 'Being looked at' when 'responded' then 'Full response sent' when 'escalated' then 'Review by the owner asked for'
                    when 'closed' then 'Closed' else 'Reopened' end || coalesce(': ' || nullif(btrim(coalesce(p_note,'')),''), '')))
  where id = p_id;
  if not found then raise exception 'not_found'; end if;
end $$;
revoke all on function public.staff_contact_set(bigint, text, text) from public, anon;
grant execute on function public.staff_contact_set(bigint, text, text) to authenticated;

-- daily: tell the owners about complaints that are close to, or past, their response date
create or replace function private.queue_complaint_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0; today date := (now() at time zone 'Europe/London')::date;
begin
  for r in select * from public.contact_messages where kind = 'complaint' and status in ('new','in_progress','escalated')
           and respond_by <= today + 2 loop
    perform private.mail_owners('Complaint ' || r.ref || ' ' || case when r.respond_by < today then 'is overdue' else 'is due ' || to_char(r.respond_by, 'FMDay FMDD FMMonth') end,
      E'Complaint ' || r.ref || ' from ' || r.name || ' <' || r.email || E'> needs a full response by ' || to_char(r.respond_by, 'FMDay FMDD FMMonth YYYY') ||
      E' (final date ' || to_char(r.final_by, 'FMDD FMMonth YYYY') || E').\n\nTheir complaint:\n' || r.message ||
      E'\n\nUpdate it under Staff > Complaints once you have replied.', '/#admin', 'staff_complaint_due', 'cmpdue:' || r.id || ':' || to_char(today, 'YYYYMMDD'));
    n := n + 1;
  end loop;
  return n;
end $$;
select cron.unschedule('complaint-reminders') where exists (select 1 from cron.job where jobname = 'complaint-reminders');
select cron.schedule('complaint-reminders', '40 8 * * 1-5', 'select private.queue_complaint_reminders(); select private.kick_notify()');
