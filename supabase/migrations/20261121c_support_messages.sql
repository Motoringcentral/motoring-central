-- 21 Nov 2026: real chat between a customer or partner and The Motoring Central team, in the same Messages panel.
-- One conversation per person (user_id). Staff can read and answer every conversation.
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_role text not null check (from_role in ('user','team')),
  staff_id uuid references auth.users(id) on delete set null,
  user_name text, user_role text, user_phone text, user_email text,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists support_messages_user on public.support_messages (user_id, created_at);

alter table public.support_messages enable row level security;
revoke all on public.support_messages from anon;
grant select, insert on public.support_messages to authenticated;

drop policy if exists "support: own conversation, or all for staff" on public.support_messages;
create policy "support: own conversation, or all for staff" on public.support_messages for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
drop policy if exists "support: send as yourself, or as the team if staff" on public.support_messages;
create policy "support: send as yourself, or as the team if staff" on public.support_messages for insert to authenticated
  with check ((from_role = 'user' and user_id = (select auth.uid())) or (from_role = 'team' and (select private.is_staff())));

-- who is writing always comes from the log-in, never from what the browser sends
create or replace function private.support_message_fill() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); p record; c record;
begin
  new.body := btrim(new.body);
  new.created_at := now();
  if new.from_role = 'user' then
    new.user_id := uid; new.staff_id := null;
    select name, phone, role, sub into p from public.partners where id = uid;
    select name, phone into c from public.profiles where id = uid;
    new.user_name := coalesce(nullif(p.name,''), nullif(c.name,''), 'Customer');
    new.user_phone := coalesce(nullif(p.phone,''), nullif(c.phone,''), '');
    new.user_role := coalesce(nullif(p.sub,''), nullif(p.role,''), 'customer');
    new.user_email := private.user_email(uid);
  else
    new.staff_id := uid; new.user_name := null; new.user_role := null; new.user_phone := null; new.user_email := null;
    if not exists (select 1 from auth.users where id = new.user_id) then raise exception 'That person no longer has an account'; end if;
  end if;
  return new;
end $$;
drop trigger if exists support_messages_fill on public.support_messages;
create trigger support_messages_fill before insert on public.support_messages
  for each row execute function private.support_message_fill();

-- emails: a new message goes to the owners; a reply from the team goes to the person (one each way every 30 minutes)
create or replace function private.mail_support_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare txt text := left(coalesce(new.body,''), 800); nm text; link text := '/#account';
begin
  if new.from_role = 'user' then
    perform private.mail_owners('New support message from ' || coalesce(new.user_name,'a customer') || ' (' || coalesce(new.user_role,'customer') || ')',
      coalesce(new.user_name,'A customer') || E' sent a message to the team:\n\n"' || txt || E'"\n\n' ||
      'Email: ' || coalesce(new.user_email,'') || coalesce(E'\nPhone: ' || nullif(new.user_phone,''), '') ||
      E'\n\nLog in and open Messages to reply.', '/#admin', 'support_message', 'sup:' || new.user_id || ':u');
  else
    if exists (select 1 from public.partners where id = new.user_id) then link := '/#dashboard'; end if;
    select user_name into nm from public.support_messages where user_id = new.user_id and from_role = 'user' order by created_at desc limit 1;
    perform private.mail(private.user_email(new.user_id), 'customer', 'The Motoring Central team replied to your message',
      'Hello ' || private.first_name(coalesce(nm,'')) || E',\n\nOur team replied to your message:\n\n"' || txt ||
      E'"\n\nLog in and open Messages to reply.\n\nThe Motoring Central', link, 'support_reply', 'sup:' || new.user_id || ':t');
  end if;
  return new;
exception when others then
  raise warning 'email not queued: %', sqlerrm;
  return new;
end $$;
drop trigger if exists support_messages_mail on public.support_messages;
create trigger support_messages_mail after insert on public.support_messages
  for each row execute function private.mail_support_message();
