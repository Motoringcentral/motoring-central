-- Demo on request, part 2 (23 Nov 2026): a link of their own for each member of staff, for showing the dashboard to
-- someone in person. It opens a page with all eight trades to choose from, and works for a year (renewed each time the
-- admin page asks for it). It is kept as a row with trade 'all', which the list of requests leaves out.

alter table public.demo_requests drop constraint if exists demo_requests_trade_check;
alter table public.demo_requests add constraint demo_requests_trade_check
  check (trade in ('mot','valet','instructor','body','autoelec','dealer','recovery','evcharge','all'));

-- p_new true: throw the old link away and make a new one (if the old one has been passed on)
create or replace function public.staff_demo_own(p_new boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); em text; nm text; r public.demo_requests;
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  select lower(u.email), coalesce(nullif(btrim(s.name), ''), 'Staff') into em, nm
    from public.staff s join auth.users u on u.id = s.user_id where s.user_id = me;
  if em is null then raise exception 'not_staff'; end if;
  select * into r from public.demo_requests where trade = 'all' and email = em order by id limit 1 for update;
  if not found then
    insert into public.demo_requests (trade, name, business, email, status, code, ends_at, history)
    values ('all', nm, 'The Motoring Central (staff link)', em, 'closed',
            substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), now() + interval '1 year',
            jsonb_build_array(jsonb_build_object('at', now(), 'by', nm, 'what', 'Staff link made')))
    returning * into r;
  else
    update public.demo_requests set ends_at = now() + interval '1 year', updated_at = now(),
      code = case when coalesce(p_new, false) or code is null then substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) else code end,
      history = case when coalesce(p_new, false) then history || jsonb_build_array(jsonb_build_object('at', now(), 'by', nm, 'what', 'Staff link replaced')) else history end
    where id = r.id returning * into r;
  end if;
  return jsonb_build_object('link', private.site_url() || '/#mydemo-' || r.code, 'ends_at', r.ends_at);
end $$;
revoke all on function public.staff_demo_own(boolean) from public, anon;
grant execute on function public.staff_demo_own(boolean) to authenticated;

-- the list of requests leaves the staff links out
create or replace function public.staff_demo_requests() returns setof public.demo_requests
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  return query select * from public.demo_requests where trade <> 'all'
    order by (status = 'closed'), (status <> 'new'), created_at desc limit 500;
end $$;

-- a staff link cannot be emailed out, closed or reopened as if it were a request
create or replace function public.staff_demo_send(p_id bigint, p_email boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.demo_requests; me text; lab text; jh text; mail boolean := coalesce(p_email, true);
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  select * into r from public.demo_requests where id = p_id and trade <> 'all' for update;
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
  where id = p_id and trade <> 'all';
  if not found then raise exception 'not_found'; end if;
end $$;
