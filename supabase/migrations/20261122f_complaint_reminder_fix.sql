-- Complaint reminders: still send if a complaint has no final date (22 Nov 2026)
create or replace function private.queue_complaint_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0; today date := (now() at time zone 'Europe/London')::date;
begin
  for r in select * from public.contact_messages where kind = 'complaint' and status in ('new','in_progress','escalated')
           and respond_by <= today + 2 loop
    perform private.mail_owners('Complaint ' || r.ref || ' ' || case when r.respond_by < today then 'is overdue' else 'is due ' || to_char(r.respond_by, 'FMDay FMDD FMMonth') end,
      E'Complaint ' || r.ref || ' from ' || r.name || ' <' || r.email || E'> needs a full response by ' || to_char(r.respond_by, 'FMDay FMDD FMMonth YYYY') ||
      coalesce(E' (final date ' || to_char(r.final_by, 'FMDD FMMonth YYYY') || ')', '') || E'.\n\nTheir complaint:\n' || r.message ||
      E'\n\nUpdate it under Staff > Complaints once you have replied.', '/#admin', 'staff_complaint_due', 'cmpdue:' || r.id || ':' || to_char(today, 'YYYYMMDD'));
    n := n + 1;
  end loop;
  return n;
end $$;
