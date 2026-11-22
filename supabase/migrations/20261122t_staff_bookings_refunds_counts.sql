-- Admin page (22 Nov 2026): staff views of driving lessons and of the other services' bookings, one list of every
-- refund that is due, and the numbers shown on the admin front page.
create or replace function public.staff_bookings(p_group text, p_from timestamptz default (now() - interval '60 days'))
returns table(id uuid, kind text, made_at timestamptz, slot_day date, slot_start int, status text, summary text, details jsonb,
  customer_name text, customer_phone text, customer_email text, partner_name text, partner_phone text,
  price_total numeric, partner_payout numeric, our_share numeric, paid boolean,
  cancelled_at timestamptz, cancel_reason text, refund_amount numeric, refund_status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  if p_group not in ('lessons','other','refunds') then raise exception 'bad_group'; end if;
  return query select b.id, b.kind, b.made_at, b.slot_day, b.slot_start, b.status, b.summary,
    case when b.kind = 'Driving lesson' then b.details - 'want' else jsonb_strip_nulls(jsonb_build_object('paid', b.details->>'paid')) end,
    b.customer_name, b.customer_phone, private.user_email(b.customer_id), b.partner_name, g.phone,
    b.price_total, b.partner_payout, b.our_share, b.paid, b.cancelled_at, b.cancel_reason, b.refund_amount, b.refund_status
  from public.bookings b left join public.partners g on g.id = b.partner_id
  where case p_group
          when 'lessons' then b.kind = 'Driving lesson' and (b.made_at >= p_from or b.slot_day >= current_date - 14)
          when 'other' then b.kind not in ('MOT','Recovery','EV charging','Driving lesson') and b.made_at >= p_from
          else b.refund_status = 'due' end
  order by case when p_group = 'refunds' then b.cancelled_at end asc nulls last,
           coalesce(b.slot_day, (b.made_at at time zone 'Europe/London')::date) desc, b.slot_start desc nulls last, b.made_at desc
  limit 500;
end $$;
revoke all on function public.staff_bookings(text, timestamptz) from public, anon;
grant execute on function public.staff_bookings(text, timestamptz) to authenticated;

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
    'lessons_unpaid', (select count(*) from public.bookings where kind = 'Driving lesson' and status = 'confirmed' and details->>'unpaid' = 'true'));
end $$;
revoke all on function public.staff_counts() from public, anon;
grant execute on function public.staff_counts() to authenticated;

-- when we (staff) cancel a lesson, or an unpaid lesson is released, the instructor is told as well
do $$
declare d text := pg_get_functiondef('private.mail_booking'::regproc);
  f1 text := $a$if g.email is not null and new.cancelled_by is not distinct from new.customer_id then$a$;
  f2 text := $a$'Lesson cancelled by the learner: ' ||$a$;
  f3 text := $a$coalesce(new.customer_name, 'Your learner') || ' has cancelled the lesson on ' || private.lesson_when(new.slot_day, new.slot_start) || E'.\n' ||$a$;
begin
  if position('Lesson cancelled: ' in d) = 0 then
    if position(f1 in d) = 0 or position(f2 in d) = 0 or position(f3 in d) = 0 then raise exception 'mail_booking: lesson cancel text not found'; end if;
    d := replace(d, f1, $a$if g.email is not null and new.cancelled_by is distinct from new.partner_id then$a$);
    d := replace(d, f2, $a$case when new.cancelled_by is not distinct from new.customer_id then 'Lesson cancelled by the learner: ' else 'Lesson cancelled: ' end ||$a$);
    d := replace(d, f3, $a$case when new.cancelled_by is not distinct from new.customer_id then coalesce(new.customer_name, 'Your learner') || ' has cancelled the lesson on '
               else 'The lesson with ' || coalesce(new.customer_name, 'your learner') || ' has been cancelled. It was on ' end || private.lesson_when(new.slot_day, new.slot_start) || E'.\n' ||
          case when new.cancelled_by is not distinct from new.customer_id then '' else coalesce('Reason: ' || nullif(new.cancel_reason,'') || E'\n', '') end ||$a$);
    execute d;
  end if;
end $$;
