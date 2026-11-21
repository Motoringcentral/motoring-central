-- 21 Nov 2026: real messages between a customer and the partner doing their booking (garage, MOT station, mobile
-- mechanic, recovery, tyres, valeting, EV charging and so on). Same Messages panel as car and van messages.
create table if not exists public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  from_role text not null check (from_role in ('customer','partner')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists booking_messages_booking on public.booking_messages (booking_id, created_at);
create index if not exists booking_messages_customer on public.booking_messages (customer_id);
create index if not exists booking_messages_partner on public.booking_messages (partner_id);

alter table public.booking_messages enable row level security;
revoke all on public.booking_messages from anon;
grant select, insert on public.booking_messages to authenticated;

drop policy if exists "booking messages: the customer and the partner" on public.booking_messages;
create policy "booking messages: the customer and the partner" on public.booking_messages for select to authenticated
  using (customer_id = (select auth.uid()) or partner_id = (select auth.uid()));
drop policy if exists "booking messages: send as customer or partner" on public.booking_messages;
create policy "booking messages: send as customer or partner" on public.booking_messages for insert to authenticated
  with check ((from_role = 'customer' and customer_id = (select auth.uid())) or (from_role = 'partner' and partner_id = (select auth.uid())));

-- the two people in the conversation always come from the booking itself, never from what the browser sends
create or replace function private.booking_message_fill() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = new.booking_id;
  if not found or b.partner_id is null then raise exception 'This booking has no partner to message'; end if;
  new.customer_id := b.customer_id;
  new.partner_id := b.partner_id;
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end $$;
drop trigger if exists booking_messages_fill on public.booking_messages;
create trigger booking_messages_fill before insert on public.booking_messages
  for each row execute function private.booking_message_fill();

-- email the other person (at most one email per booking and direction every 30 minutes)
create or replace function private.mail_booking_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b public.bookings; what text; txt text := left(coalesce(new.body,''), 800);
begin
  select * into b from public.bookings where id = new.booking_id;
  if not found then return new; end if;
  what := coalesce(nullif(b.service,''), nullif(b.kind,''), 'your') || ' booking';
  if new.from_role = 'customer' then
    perform private.mail(private.user_email(new.partner_id), 'partner',
      'New message from ' || coalesce(nullif(b.customer_name,''),'your customer') || ' about their ' || what,
      E'Hello,\n\n' || coalesce(nullif(b.customer_name,''),'Your customer') || ' sent you a message about their ' || what ||
      coalesce(' (' || nullif(upper(b.vehicle->>'reg'),'') || ')', '') || E':\n\n"' || txt ||
      E'"\n\nLog in and open Messages to reply.\n\nThe Motoring Central',
      '/#dashboard', 'booking_message_partner', 'bm:' || new.booking_id || ':c', new.booking_id);
  else
    perform private.mail(private.user_email(new.customer_id), 'customer',
      'New message from ' || coalesce(nullif(b.partner_name,''),'your partner') || ' about your ' || what,
      'Hello ' || private.first_name(b.customer_name) || E',\n\n' || coalesce(nullif(b.partner_name,''),'Your partner') ||
      ' sent you a message about your ' || what || E':\n\n"' || txt ||
      E'"\n\nLog in and open Messages to reply. Keep bookings and payments on The Motoring Central so you stay protected.\n\nThe Motoring Central',
      '/#account', 'booking_message_customer', 'bm:' || new.booking_id || ':p', new.booking_id);
  end if;
  return new;
exception when others then
  raise warning 'email not queued: %', sqlerrm;
  return new;
end $$;
drop trigger if exists booking_messages_mail on public.booking_messages;
create trigger booking_messages_mail after insert on public.booking_messages
  for each row execute function private.mail_booking_message();
