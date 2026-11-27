-- Business account emails are queued with to_who = 'business' (27 Nov 2026).
alter table public.notifications drop constraint notifications_to_who_check;
alter table public.notifications add constraint notifications_to_who_check
  check (to_who = any (array['customer','garage','partner','dealer','seller','buyer','staff','business']));
