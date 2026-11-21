-- Staff: two-step log-in (authenticator app) and the owner adds or removes reviewers (21 Nov 2026)
-- Once a staff member has set up their authenticator app, every staff permission needs the second step in that
-- session (aal2). The site makes every staff member set it up at their first log-in.
create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s where s.user_id = (select auth.uid()))
     and (coalesce((select auth.jwt()->>'aal'), '') = 'aal2'
          or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified'));
$$;

create or replace function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.is_staff()) and exists (select 1 from public.staff s where s.user_id = (select auth.uid()) and s.level = 'owner');
$$;

-- owner: the team, with recent log-ins and whether the two-step log-in is set up
create or replace function public.staff_team() returns table (user_id uuid, name text, email text, level text, added timestamptz,
  last_sign_in timestamptz, two_step boolean, recent_sign_ins timestamptz[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_owner()) then raise exception 'not_owner'; end if;
  return query select s.user_id, s.name, u.email::text, s.level, s.created_at, u.last_sign_in_at,
    exists (select 1 from auth.mfa_factors f where f.user_id = s.user_id and f.status = 'verified'),
    coalesce((select array_agg(x.created_at order by x.created_at desc) from (select a.created_at from auth.audit_log_entries a
       where a.payload->>'actor_id' = s.user_id::text and a.payload->>'action' in ('login','mfa_challenge_verified')
       order by a.created_at desc limit 8) x), '{}')
  from public.staff s join auth.users u on u.id = s.user_id order by s.level desc, s.name;
end $$;
revoke all on function public.staff_team() from public, anon;
grant execute on function public.staff_team() to authenticated;

-- owner: make an existing account a reviewer (they create a normal account first, with their work email)
create or replace function public.staff_add_reviewer(p_email text, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; nm text := left(btrim(coalesce(p_name,'')), 80);
begin
  if not (select private.is_owner()) then raise exception 'not_owner'; end if;
  if length(nm) < 2 then raise exception 'bad_name'; end if;
  select id into uid from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
  if uid is null then raise exception 'no_account'; end if;
  if exists (select 1 from public.partners where id = uid) then raise exception 'is_partner'; end if;
  if exists (select 1 from public.staff where user_id = uid) then raise exception 'already_staff'; end if;
  insert into public.staff (user_id, level, name) values (uid, 'reviewer', nm);
  perform private.mail(btrim(p_email), 'staff', 'You have been added to The Motoring Central team',
    E'Hello ' || nm || E',\n\nYou can now review partner and dealer applications. Log in with Staff log in, using the email and password of your account.\nAt your first log-in you will set up a two-step log-in with an authenticator app (for example Google Authenticator or Microsoft Authenticator).\n\nThe Motoring Central',
    '/#login', 'staff_added', 'staffadd:' || uid);
  return jsonb_build_object('user_id', uid, 'name', nm);
end $$;
revoke all on function public.staff_add_reviewer(text, text) from public, anon;
grant execute on function public.staff_add_reviewer(text, text) to authenticated;

-- owner: remove a reviewer (owners cannot be removed here)
create or replace function public.staff_remove(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_owner()) then raise exception 'not_owner'; end if;
  if p_user = (select auth.uid()) then raise exception 'not_yourself'; end if;
  delete from public.staff where user_id = p_user and level = 'reviewer';
  if not found then raise exception 'not_found'; end if;
end $$;
revoke all on function public.staff_remove(uuid) from public, anon;
grant execute on function public.staff_remove(uuid) to authenticated;
