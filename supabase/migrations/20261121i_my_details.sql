-- Partners and dealers change their own name and phone; email changes (confirmed by link) are copied to partners (21 Nov 2026)
create or replace function public.update_my_contact(p_name text, p_phone text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.partners; n text := left(btrim(coalesce(p_name,'')), 120); t text := left(btrim(coalesce(p_phone,'')), 30);
begin
  select * into me from public.partners where id = (select auth.uid());
  if not found then raise exception 'not_partner'; end if;
  if length(n) < 2 then raise exception 'bad_name'; end if;
  if length(regexp_replace(t, '\D', '', 'g')) < 10 then raise exception 'bad_phone'; end if;
  update public.partners set name = n, phone = t where id = me.id;
  if me.status = 'approved' and n is distinct from me.name then
    perform private.mail_owners('Partner changed their business name: ' || n,
      E'Hello,\n\nAn approved partner has changed their business name.\n\nWas: ' || coalesce(me.name,'') || E'\nNow: ' || n ||
      E'\nAccount: ' || coalesce(me.email,'') || E'\n\nCheck the new name matches their insurance and ID documents on the Staff page.\n\nThe Motoring Central',
      '/#staff', 'partner_renamed', 'rename:' || me.id || ':' || md5(n));
  end if;
  return jsonb_build_object('name', n, 'phone', t);
end $$;
revoke all on function public.update_my_contact(text, text) from public, anon;
grant execute on function public.update_my_contact(text, text) to authenticated;

create or replace function private.sync_partner_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.partners set email = lower(new.email) where id = new.id;
  end if;
  return new;
exception when others then
  raise warning 'partner email not copied: %', sqlerrm;
  return new;
end $$;
drop trigger if exists partner_email_sync on auth.users;
create trigger partner_email_sync after update of email on auth.users
  for each row execute function private.sync_partner_email();
