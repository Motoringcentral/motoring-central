-- BUSINESS ACCOUNTS, part 3 of 3: what the website, the staff page and the payments function can call (27 Nov 2026).
-- Roles on an account: owner > admin > booker > viewer.
--   owner:  everything, including other owners and admins, restarting bookings after a pause and the billing email.
--   admin:  team (bookers and viewers), vehicles, settings, top-ups, approving bookings, repeat valets, pausing bookings.
--   booker: books and cancels their own bookings, within the limits.
--   viewer: sees bookings and statements (for the accounts office). Cannot book.

-- ---------- my accounts, applying ----------
create or replace function public.biz_my_accounts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'ref', a.ref, 'name', a.name, 'status', a.status, 'role', m.role, 'frozen', a.frozen)
         order by a.name), '[]'::jsonb)
  from public.business_members m join public.business_accounts a on a.id = m.account_id
  where m.user_id = (select auth.uid()) and m.status = 'active' and a.status <> 'closed'
$$;

create or replace function public.biz_apply(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); em text; a public.business_accounts; k text := coalesce(p->>'kind','company');
  cno text := nullif(upper(regexp_replace(coalesce(p->>'company_no',''), '\s', '', 'g')), '');
  vat text := nullif(upper(regexp_replace(coalesce(p->>'vat_no',''), '[\s]', '', 'g')), '');
  bill text := lower(btrim(coalesce(p->>'billing_email',''))); prof public.profiles;
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  select * into prof from public.profiles where id = uid;
  if not found then raise exception 'not_customer'; end if;          -- partners and staff use their own logins
  em := private.user_email(uid);
  if (select count(*) from public.business_members m where m.user_id = uid and m.role = 'owner' and m.status = 'active') >= 3 then raise exception 'too_many_accounts'; end if;
  if exists (select 1 from public.business_accounts x where x.created_by = uid and x.status = 'pending') then raise exception 'already_pending'; end if;
  if (select count(*) from public.business_accounts x where x.created_by = uid and x.created_at > now() - interval '1 day') >= 2 then raise exception 'try_later'; end if;
  if k = 'company' and (cno is null or cno !~ '^[A-Z0-9]{8}$') then raise exception 'bad_company_no'; end if;
  if cno is not null and exists (select 1 from public.business_accounts x where x.company_no = cno and x.status in ('pending','approved','suspended')) then raise exception 'company_has_account'; end if;
  if bill = '' then bill := em; end if;
  insert into public.business_accounts (name, kind, company_no, vat_no, billing_email, phone, address, postcode, fleet_size, created_by)
  values (left(btrim(coalesce(p->>'name','')), 160), k, cno, vat, bill, nullif(left(btrim(coalesce(p->>'phone','')), 30), ''),
          nullif(left(btrim(coalesce(p->>'address','')), 300), ''), private.biz_pc(p->>'postcode'),
          nullif(p->>'fleet_size','')::int, uid)
  returning * into a;
  insert into public.business_members (account_id, user_id, email, name, role, status, joined_at)
  values (a.id, uid, lower(em), nullif(prof.name,''), 'owner', 'active', now());
  perform private.biz_log(a.id, 'applied', jsonb_build_object('name', a.name, 'company_no', a.company_no));
  perform private.mail_owners('New business account to check: ' || a.name,
    E'A business has applied for an account.\n\nBusiness: ' || a.name || E'\nType: ' || replace(a.kind,'_',' ') ||
    coalesce(E'\nCompany number: ' || a.company_no || ' (check it on Companies House: https://find-and-update.company-information.service.gov.uk/company/' || a.company_no || ')', '') ||
    E'\nApplied by: ' || coalesce(nullif(prof.name,''), em) || ' (' || em || ')' || coalesce(E'\nVehicles: ' || a.fleet_size, '') ||
    E'\n\nOpen Business accounts from the Staff page to approve or decline it.', '/business.html#staff', 'business', 'bizapply:' || a.id);
  perform private.mail(em, 'business', 'We have your business account application: ' || a.name,
    E'Hello,\n\nThank you for applying for a business account for ' || a.name || E'.\n\nWe check every business before it can book, usually within one working day. ' ||
    E'Meanwhile you can add your vehicles and invite your team.\n\nReference: ' || a.ref || E'\n\nThe Motoring Central', '/business.html', 'business', 'bizapplied:' || a.id);
  return jsonb_build_object('id', a.id, 'ref', a.ref);
end $$;

-- ---------- everything the dashboard shows ----------
create or replace function public.biz_state(p_account uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, 'viewer'); a public.business_accounts; bal record; uid uuid := (select auth.uid()); res jsonb; c public.business_cards;
begin
  select * into a from public.business_accounts where id = p_account;
  select * into bal from private.biz_balance(p_account);
  select * into c from public.business_cards where account_id = p_account;
  res := jsonb_build_object(
    'account', jsonb_build_object('id', a.id, 'ref', a.ref, 'name', a.name, 'kind', a.kind, 'company_no', a.company_no, 'vat_no', a.vat_no,
       'billing_email', a.billing_email, 'phone', a.phone, 'address', a.address, 'postcode', a.postcode, 'status', a.status,
       'approval_over', a.approval_over, 'monthly_cap', a.monthly_cap, 'fleet_only', a.fleet_only, 'services', to_jsonb(a.services),
       'low_balance', a.low_balance, 'frozen', a.frozen, 'frozen_reason', a.frozen_reason, 'frozen_at', a.frozen_at, 'review_note', case when a.status in ('declined','suspended') then a.review_note end),
    'me', jsonb_build_object('role', r, 'user', uid,
       'limit', (select m.monthly_limit from public.business_members m where m.account_id = p_account and m.user_id = uid and m.status = 'active'),
       'spent', private.biz_month_spend(p_account, uid)),
    'money', jsonb_build_object('available', bal.available, 'held', bal.held, 'month_spend', private.biz_month_spend(p_account)),
    'card', case when c.status = 'active' then jsonb_build_object('brand', c.brand, 'last4', c.last4, 'exp', lpad(c.exp_month::text,2,'0') || '/' || c.exp_year) end,
    'settings', jsonb_build_object('fee', private.biz_setting('fee', 9.99), 'min_topup', private.biz_setting('min_topup', 50), 'max_topup', private.biz_setting('max_topup', 10000)),
    'vehicles', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'reg', v.reg, 'nickname', v.nickname, 'make', v.make, 'model', v.model, 'colour', v.colour,
         'size', v.size, 'mot_class', v.mot_class, 'mot_due', v.mot_due, 'tax_due', v.tax_due, 'driver', v.driver) order by v.reg), '[]'::jsonb)
       from public.business_vehicles v where v.account_id = p_account and v.active),
    'jobs', (select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) from (
       select jsonb_build_object('id', j.id, 'ref', j.ref, 'kind', j.kind, 'reg', j.reg, 'total', j.total, 'price', j.price, 'fee', j.fee, 'status', j.status,
         'pay', j.pay_method, 'po', j.po, 'note', j.note, 'day', j.params->>'day', 'slot', coalesce(j.params->>'slot', case when j.params ? 'start' then to_char(make_time((j.params->>'start')::int/60, (j.params->>'start')::int%60, 0), 'FMHH12:MIam') end),
         'partner', b.partner_name, 'booking_status', b.status, 'booking', upper(left(b.id::text, 8)), 'mine', j.booked_by = uid,
         'by', (select coalesce(m.name, m.email) from public.business_members m where m.account_id = p_account and m.user_id = j.booked_by limit 1),
         'decline_reason', j.decline_reason, 'fail_reason', j.fail_reason, 'card_until', j.card_until, 'schedule', j.schedule_id is not null, 'created_at', j.created_at) x
       from public.business_jobs j left join public.bookings b on b.id = j.booking_id
       where j.account_id = p_account and (r <> 'booker' or j.booked_by = uid)
       order by j.created_at desc limit 200) s),
    'schedules', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'partner', g.name, 'partner_id', s.partner_id, 'every_weeks', s.every_weeks, 'time', s.time_label,
         'place', s.place, 'address', s.address, 'postcode', s.postcode, 'next_day', s.next_day, 'po', s.po, 'last_result', s.last_result,
         'regs', (select jsonb_agg(v.reg order by v.reg) from public.business_vehicles v where v.id = any(s.vehicle_ids) and v.active))), '[]'::jsonb)
       from public.business_schedules s join public.partners g on g.id = s.partner_id where s.account_id = p_account and s.active),
    'topups', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'ref', t.ref, 'method', t.method, 'amount', t.amount, 'received', t.received, 'status', t.status, 'created_at', t.created_at)
         order by t.created_at desc), '[]'::jsonb) from (select * from public.business_topups t where t.account_id = p_account order by created_at desc limit 30) t)
  );
  if private.biz_rank(r) >= 3 then
    res := res || jsonb_build_object(
      'members', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'email', m.email, 'name', m.name, 'role', m.role, 'status', m.status,
           'limit', m.monthly_limit, 'spent', case when m.user_id is not null then private.biz_month_spend(p_account, m.user_id) end,
           'me', m.user_id = uid, 'expires', m.invite_expires) order by private.biz_rank(m.role) desc, m.email), '[]'::jsonb)
         from public.business_members m where m.account_id = p_account and m.status <> 'removed'),
      'audit', (select coalesce(jsonb_agg(jsonb_build_object('at', x.at, 'action', x.action, 'detail', x.detail,
           'by', (select coalesce(m.name, m.email) from public.business_members m where m.account_id = p_account and m.user_id = x.by_user limit 1)) order by x.id desc), '[]'::jsonb)
         from (select * from public.business_audit u where u.account_id = p_account order by u.id desc limit 100) x),
      'bank', (select s.value->'bank' from public.app_settings s where s.key = 'business'));
  end if;
  return res;
end $$;

-- ---------- settings ----------
create or replace function public.biz_settings_save(p_account uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, 'admin'); a public.business_accounts; sv text[]; bill text;
begin
  select * into a from public.business_accounts where id = p_account for update;
  if p ? 'services' then
    select coalesce(array_agg(x), '{}') into sv from jsonb_array_elements_text(p->'services') x where x in ('Valet','Alloy wheels','MOT');
  end if;
  bill := lower(btrim(coalesce(p->>'billing_email', a.billing_email)));
  if bill <> a.billing_email and r <> 'owner' then raise exception 'owner_only'; end if;
  update public.business_accounts set
    approval_over = case when p ? 'approval_over' then nullif(p->>'approval_over','')::numeric else approval_over end,
    monthly_cap = case when p ? 'monthly_cap' then nullif(p->>'monthly_cap','')::numeric else monthly_cap end,
    fleet_only = case when p ? 'fleet_only' then (p->>'fleet_only')::boolean else fleet_only end,
    low_balance = case when p ? 'low_balance' then coalesce(nullif(p->>'low_balance','')::numeric, 0) else low_balance end,
    services = coalesce(sv, services),
    phone = case when p ? 'phone' then nullif(left(btrim(p->>'phone'), 30), '') else phone end,
    address = case when p ? 'address' then nullif(left(btrim(p->>'address'), 300), '') else address end,
    postcode = case when p ? 'postcode' then private.biz_pc(p->>'postcode') else postcode end,
    vat_no = case when p ? 'vat_no' then nullif(upper(regexp_replace(p->>'vat_no', '\s', '', 'g')), '') else vat_no end,
    billing_email = bill
  where id = p_account;
  perform private.biz_log(p_account, 'settings_changed', p - 'services' || jsonb_build_object('services', to_jsonb(sv)));
  if bill <> a.billing_email then
    perform private.biz_mail_admins(p_account, 'Billing email changed on your business account',
      'The billing email was changed from ' || a.billing_email || ' to ' || bill || E'.\nIf you did not make this change, contact us straight away.', null);
    perform private.mail(a.billing_email, 'business', 'Billing email changed: ' || a.name,
      E'Hello,\n\nThe billing email for ' || a.name || ' has been changed to ' || bill || E'. Statements will now go there.\nIf you did not expect this, contact us straight away.\n\nThe Motoring Central', null, 'business', null);
  end if;
end $$;

-- ---------- team ----------
create or replace function public.biz_invite(p_account uuid, p_email text, p_role text, p_limit numeric default null, p_name text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, 'admin'); em text := lower(btrim(coalesce(p_email,''))); tok text; a public.business_accounts; m public.business_members;
  inviter text;
begin
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email'; end if;
  if p_role not in ('owner','admin','booker','viewer') then raise exception 'bad_role'; end if;
  if private.biz_rank(p_role) >= 3 and r <> 'owner' then raise exception 'owner_only'; end if;
  if (select count(*) from public.business_audit x where x.account_id = p_account and x.action = 'invited' and x.at > now() - interval '1 day') >= 20 then raise exception 'try_later'; end if;
  if (select count(*) from public.business_members x where x.account_id = p_account and x.status <> 'removed') >= 200 then raise exception 'too_many_members'; end if;
  select * into a from public.business_accounts where id = p_account;
  if a.status in ('declined','closed') then raise exception 'account_closed'; end if;
  select * into m from public.business_members where account_id = p_account and email = em;
  if found and m.status = 'active' then raise exception 'already_member'; end if;
  tok := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.business_members (account_id, email, name, role, monthly_limit, status, invite_hash, invite_expires, invited_by)
  values (p_account, em, nullif(left(btrim(coalesce(p_name,'')), 120), ''), p_role, p_limit, 'invited',
          encode(extensions.digest(tok, 'sha256'), 'hex'), now() + interval '7 days', (select auth.uid()))
  on conflict (account_id, email) do update set role = excluded.role, monthly_limit = excluded.monthly_limit, status = 'invited', user_id = null,
     invite_hash = excluded.invite_hash, invite_expires = excluded.invite_expires, invited_by = excluded.invited_by, name = coalesce(excluded.name, business_members.name);
  select coalesce(m2.name, m2.email) into inviter from public.business_members m2 where m2.account_id = p_account and m2.user_id = (select auth.uid());
  perform private.biz_log(p_account, 'invited', jsonb_build_object('email', em, 'role', p_role, 'limit', p_limit));
  perform private.mail(em, 'business', inviter || ' has invited you to ' || a.name || ' on The Motoring Central',
    E'Hello,\n\n' || inviter || ' has invited you to join the business account for ' || a.name || ' as ' ||
    case p_role when 'owner' then 'an owner' when 'admin' then 'an admin' when 'booker' then 'a booker (you can book jobs for the business vehicles)' else 'a viewer (you can see bookings and statements)' end ||
    E'.\n\nOpen this link to accept. It works once and only for ' || em || E', and it runs out in 7 days:\n' ||
    private.site_url() || '/business.html#join-' || tok || E'\n\nIf you were not expecting this, ignore this email.\n\nThe Motoring Central', null, 'business', null);
  return jsonb_build_object('invited', em);
end $$;

create or replace function public.biz_invite_info(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('account', a.name, 'role', m.role,
           'email', left(m.email, 2) || repeat('•', greatest(length(split_part(m.email,'@',1)) - 2, 1)) || '@' || split_part(m.email,'@',2))
  from public.business_members m join public.business_accounts a on a.id = m.account_id
  where p_token ~ '^[0-9a-f]{48}$' and m.invite_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and m.status = 'invited' and m.invite_expires > now() and a.status not in ('declined','closed')
$$;

create or replace function public.biz_accept_invite(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); m public.business_members; em text; a public.business_accounts; nm text;
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  if p_token !~ '^[0-9a-f]{48}$' then raise exception 'bad_invite'; end if;
  select * into m from public.business_members where invite_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found or m.status <> 'invited' or m.invite_expires < now() then raise exception 'bad_invite'; end if;
  em := lower(private.user_email(uid));
  if em is distinct from m.email then raise exception 'wrong_email'; end if;     -- the link only works for the person it was sent to
  if not exists (select 1 from public.profiles p where p.id = uid) then raise exception 'not_customer'; end if;
  if exists (select 1 from auth.users u where u.id = uid and u.email_confirmed_at is null) then raise exception 'email_not_confirmed'; end if;
  select * into a from public.business_accounts where id = m.account_id;
  if a.status in ('declined','closed') then raise exception 'bad_invite'; end if;
  select nullif(p.name,'') into nm from public.profiles p where p.id = uid;
  update public.business_members set user_id = uid, status = 'active', invite_hash = null, invite_expires = null, joined_at = now(), name = coalesce(nm, name)
  where id = m.id;
  perform private.biz_log(m.account_id, 'joined', jsonb_build_object('email', em, 'role', m.role));
  perform private.biz_mail_admins(m.account_id, 'New team member on your business account: ' || coalesce(nm, em),
    coalesce(nm, em) || ' (' || em || ') has joined as ' || m.role || E'.\nIf you did not invite them, remove them on the Business account page straight away.', 'bizjoin:' || m.id);
  return jsonb_build_object('account', m.account_id, 'name', a.name, 'role', m.role);
end $$;

create or replace function public.biz_member_set(p_account uuid, p_member uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, case when exists (select 1 from public.business_members x where x.id = p_member and x.user_id = (select auth.uid()) and coalesce((p->>'remove')::boolean, false)) then 'viewer' else 'admin' end);
  m public.business_members; nr text; owners int; is_self boolean;
begin
  select * into m from public.business_members where id = p_member and account_id = p_account for update;
  if not found or m.status = 'removed' then raise exception 'not_found'; end if;
  is_self := coalesce(m.user_id = (select auth.uid()), false);
  if is_self and not coalesce((p->>'remove')::boolean, false) and coalesce(p->>'role', m.role) <> m.role then raise exception 'not_yourself'; end if;
  if private.biz_rank(m.role) >= 3 and r <> 'owner' and not (is_self and coalesce((p->>'remove')::boolean, false)) then raise exception 'owner_only'; end if;   -- admins cannot touch admins or owners (but can leave)
  select count(*) into owners from public.business_members where account_id = p_account and role = 'owner' and status = 'active';
  if coalesce((p->>'remove')::boolean, false) then
    if m.role = 'owner' and m.status = 'active' and owners <= 1 then raise exception 'last_owner'; end if;
    update public.business_members set status = 'removed', invite_hash = null, invite_expires = null where id = m.id;
    update public.business_schedules set active = false, last_result = 'Stopped: the person who set it up left the account.'
      where account_id = p_account and created_by = m.user_id and active;
    perform private.biz_log(p_account, 'member_removed', jsonb_build_object('email', m.email, 'role', m.role));
    perform private.biz_mail_admins(p_account, 'Team member removed: ' || coalesce(m.name, m.email), coalesce(m.name, m.email) || ' can no longer use the business account.', null);
    return;
  end if;
  nr := coalesce(p->>'role', m.role);
  if nr not in ('owner','admin','booker','viewer') then raise exception 'bad_role'; end if;
  if private.biz_rank(nr) >= 3 and r <> 'owner' then raise exception 'owner_only'; end if;
  if m.role = 'owner' and nr <> 'owner' and m.status = 'active' and owners <= 1 then raise exception 'last_owner'; end if;
  update public.business_members set role = nr,
    monthly_limit = case when p ? 'limit' then nullif(p->>'limit','')::numeric else monthly_limit end
  where id = m.id;
  perform private.biz_log(p_account, 'member_changed', jsonb_build_object('email', m.email, 'from', m.role, 'to', nr, 'limit', p->'limit'));
  if nr <> m.role then
    perform private.biz_mail_admins(p_account, 'Team role changed: ' || coalesce(m.name, m.email), coalesce(m.name, m.email) || ' is now ' || nr || ' (was ' || m.role || ').', null);
  end if;
end $$;

-- ---------- vehicles ----------
create or replace function public.biz_vehicle_save(p_account uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, 'admin'); rg text := private.biz_reg(p->>'reg'); vid uuid; cls text := coalesce(nullif(p->>'mot_class',''), '4-goods');
begin
  if rg is null or rg !~ '^[A-Z0-9]{2,8}$' then raise exception 'bad_reg'; end if;
  if private.mot_max(cls) is null then raise exception 'bad_class'; end if;
  if (p->>'id') is null and (select count(*) from public.business_vehicles v where v.account_id = p_account and v.active) >= 2000 then raise exception 'too_many_vehicles'; end if;
  if (p->>'id') is not null then
    update public.business_vehicles set reg = rg, nickname = nullif(left(btrim(coalesce(p->>'nickname','')), 60), ''), make = nullif(left(btrim(coalesce(p->>'make','')), 40), ''),
      model = nullif(left(btrim(coalesce(p->>'model','')), 60), ''), colour = nullif(left(btrim(coalesce(p->>'colour','')), 30), ''),
      size = coalesce((p->>'size')::smallint, size), mot_class = cls, mot_due = nullif(p->>'mot_due','')::date, tax_due = nullif(p->>'tax_due','')::date,
      driver = nullif(left(btrim(coalesce(p->>'driver','')), 80), '')
    where id = (p->>'id')::uuid and account_id = p_account and active returning id into vid;
    if vid is null then raise exception 'not_found'; end if;
  else
    insert into public.business_vehicles (account_id, reg, nickname, make, model, colour, size, mot_class, mot_due, tax_due, driver, added_by)
    values (p_account, rg, nullif(left(btrim(coalesce(p->>'nickname','')), 60), ''), nullif(left(btrim(coalesce(p->>'make','')), 40), ''),
      nullif(left(btrim(coalesce(p->>'model','')), 60), ''), nullif(left(btrim(coalesce(p->>'colour','')), 30), ''), coalesce((p->>'size')::smallint, 3), cls,
      nullif(p->>'mot_due','')::date, nullif(p->>'tax_due','')::date, nullif(left(btrim(coalesce(p->>'driver','')), 80), ''), (select auth.uid()))
    returning id into vid;
  end if;
  perform private.biz_log(p_account, case when (p->>'id') is null then 'vehicle_added' else 'vehicle_changed' end, jsonb_build_object('reg', rg));
  return vid;
exception when unique_violation then raise exception 'reg_already_on_fleet';
end $$;

create or replace function public.biz_vehicle_remove(p_account uuid, p_vehicle uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, 'admin'); rg text;
begin
  update public.business_vehicles set active = false where id = p_vehicle and account_id = p_account and active returning reg into rg;
  if rg is null then raise exception 'not_found'; end if;
  perform private.biz_log(p_account, 'vehicle_removed', jsonb_build_object('reg', rg));
end $$;

-- ---------- partners and prices near the job ----------
create or replace function public.biz_options(p_account uuid, p_kind text, p_lat double precision, p_lng double precision) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, 'booker');
begin
  if not (p_lat between 49 and 61 and p_lng between -9 and 2) then raise exception 'bad_place'; end if;
  return (select coalesce(jsonb_agg(x order by (x->>'miles')::numeric), '[]'::jsonb) from (
    select jsonb_build_object('id', g.id, 'name', g.name, 'town', g.town, 'sub', g.sub, 'miles', round(q.miles::numeric, 1),
             'radius', coalesce((g.details->'area'->>'radius')::int, 10), 'week', g.details->'area'->'week', 'rates', g.rates,
             'mot_bays', case when p_kind = 'MOT' then to_jsonb(private.mot_bays(g.details)) end,
             'motc', case when p_kind = 'MOT' then g.rates->'motc' end) x, q.miles
    from public.partners g,
      lateral (select 3958.8 * 2 * asin(sqrt(power(sin(radians((coalesce((g.details->'area'->>'lat')::float8, g.base_lat) - p_lat) / 2)), 2) +
         cos(radians(p_lat)) * cos(radians(coalesce((g.details->'area'->>'lat')::float8, g.base_lat))) *
         power(sin(radians((coalesce((g.details->'area'->>'lng')::float8, g.base_lng) - p_lng) / 2)), 2))) * 1.2 miles) q
    where g.status = 'approved' and coalesce((g.details->'area'->>'lat')::float8, g.base_lat) is not null
      and ((p_kind = 'Valet' and g.role = 'valet') or (p_kind = 'Alloy wheels' and g.role = 'body')
           or (p_kind = 'MOT' and g.role = 'mechanic' and g.sub = 'garage' and coalesce(array_length(private.mot_bays(g.details),1),0) > 0))
      and q.miles <= 60
    order by q.miles limit 30) s);
end $$;

create or replace function public.biz_quote(p_account uuid, p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, 'booker'); pr record; cls text := coalesce(nullif(p->>'class',''), '4-goods');
begin
  select * into pr from private.biz_price(p->>'kind', (p->>'partner')::uuid, p, cls);
  return jsonb_build_object('price', pr.price, 'fee', pr.fee, 'total', pr.total, 'partner', pr.partner_name);
end $$;

-- ---------- booking ----------
create or replace function public.biz_book(p_account uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  perform private.biz_need(p_account, 'booker');
  return private.biz_book_core(p_account, uid, p, null);
end $$;

create or replace function public.biz_decide(p_account uuid, p_job uuid, p_ok boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, 'admin'); a public.business_accounts; j public.business_jobs; err text; bid uuid;
begin
  select * into a from public.business_accounts where id = p_account for update;
  select * into j from public.business_jobs where id = p_job and account_id = p_account for update;
  if not found then raise exception 'not_found'; end if;
  if j.status <> 'awaiting_approval' then raise exception 'already_decided'; end if;
  if j.booked_by = (select auth.uid()) and r <> 'owner' then raise exception 'not_yourself'; end if;   -- no approving your own booking
  if not p_ok then
    update public.business_jobs set status = 'declined', decline_reason = nullif(left(btrim(coalesce(p_reason,'')), 300), ''), approved_by = (select auth.uid()), approved_at = now() where id = j.id;
    if j.pay_method = 'wallet' then perform private.biz_move(p_account, 'release', j.total, j.id, null, null, j.ref || ' declined: money back', (select auth.uid())); end if;
    perform private.biz_log(p_account, 'booking_declined', jsonb_build_object('job', j.ref, 'reason', p_reason));
    perform private.mail(private.user_email(j.booked_by), 'business', 'Booking not approved: ' || j.kind || ', ' || j.reg,
      E'Hello,\n\nYour booking request ' || j.ref || ' (' || j.kind || ' for ' || j.reg || ') was not approved.' || coalesce(E'\nReason: ' || nullif(btrim(p_reason),''), '') ||
      E'\n\nThe Motoring Central', '/business.html', 'business', null);
    return jsonb_build_object('status', 'declined');
  end if;
  if a.frozen then raise exception 'account_frozen'; end if;
  update public.business_jobs set approved_by = (select auth.uid()), approved_at = now() where id = j.id;
  if j.pay_method = 'card' then
    update public.business_jobs set status = 'awaiting_card', card_until = now() + interval '30 minutes' where id = j.id;
    perform private.biz_log(p_account, 'booking_approved', jsonb_build_object('job', j.ref, 'pay', 'card'));
    return jsonb_build_object('status', 'awaiting_card');
  end if;
  begin
    update public.business_jobs set status = 'booked' where id = j.id;
    bid := private.biz_make_booking(j.id);
  exception when others then
    err := sqlerrm;
  end;
  if err is not null then
    update public.business_jobs set status = 'failed', fail_reason = err where id = j.id;
    perform private.biz_move(p_account, 'release', j.total, j.id, null, null, j.ref || ' could not be booked: money back', (select auth.uid()));
    perform private.biz_log(p_account, 'booking_failed', jsonb_build_object('job', j.ref, 'why', err));
    return jsonb_build_object('status', 'failed', 'why', err);
  end if;
  perform private.biz_log(p_account, 'booking_approved', jsonb_build_object('job', j.ref));
  perform private.mail(private.user_email(j.booked_by), 'business', 'Booking approved: ' || j.kind || ', ' || j.reg,
    E'Hello,\n\nYour booking ' || j.ref || ' (' || j.kind || ' for ' || j.reg || E') has been approved and booked. You will get the booking confirmation separately.\n\nThe Motoring Central', '/business.html', 'business', null);
  return jsonb_build_object('status', 'booked');
end $$;

create or replace function public.biz_cancel(p_account uuid, p_job uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, 'booker'); j public.business_jobs; b public.bookings; g public.partners;
  today date := (now() at time zone 'Europe/London')::date; why text := nullif(left(btrim(coalesce(p_reason,'')), 300), '');
begin
  perform 1 from public.business_accounts where id = p_account for update;
  select * into j from public.business_jobs where id = p_job and account_id = p_account for update;
  if not found then raise exception 'not_found'; end if;
  if r = 'booker' and j.booked_by <> (select auth.uid()) then raise exception 'not_allowed'; end if;
  if j.status in ('awaiting_approval','awaiting_card') then
    update public.business_jobs set status = 'cancelled' where id = j.id;
    if j.pay_method = 'wallet' and j.status = 'awaiting_approval' then perform private.biz_move(p_account, 'release', j.total, j.id, null, null, j.ref || ' withdrawn: money back', (select auth.uid())); end if;
    perform private.biz_log(p_account, 'request_withdrawn', jsonb_build_object('job', j.ref));
    return jsonb_build_object('status', 'cancelled');
  end if;
  if j.status <> 'booked' then raise exception 'cannot_cancel'; end if;
  select * into b from public.bookings where id = j.booking_id for update;
  if b.status <> 'confirmed' then raise exception 'job_started'; end if;
  if b.slot_day <= today then raise exception 'too_late'; end if;            -- free cancellation up to the day before
  update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = (select auth.uid()),
    cancel_reason = coalesce(why, 'Cancelled by the business'), refund_amount = j.total,
    refund_status = case when j.pay_method = 'card' then 'due' else refund_status end
  where id = b.id;                                                            -- the trigger gives held money back
  if b.kind = 'MOT' then
    delete from public.diary_slots where booking_id = b.id;
    perform private.queue_notes(b.id, 'cancelled');
  else
    select * into g from public.partners where id = b.partner_id;
    perform private.mail(g.email, 'partner', 'Job cancelled: ' || coalesce(b.service, b.kind) || ', ' || j.reg || ', ' || to_char(b.slot_day, 'FMDay FMDD FMMonth'),
      E'Hello,\n\nThe business customer has cancelled this job (more than a day before it):\n\n' || coalesce(b.summary,'') ||
      coalesce(E'\nReason: ' || why, '') || E'\nReference: ' || upper(left(b.id::text, 8)) || E'\n\nThe day is free again. Nothing is paid for this job.\n\nThe Motoring Central',
      '/#dashboard', 'booking_cancelled_partner', null, b.id);
  end if;
  return jsonb_build_object('status', 'cancelled');
end $$;

-- ---------- pause / restart all bookings ----------
create or replace function public.biz_freeze(p_account uuid, p_on boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, case when p_on then 'admin' else 'owner' end); who text;
begin
  select coalesce(m.name, m.email) into who from public.business_members m where m.account_id = p_account and m.user_id = (select auth.uid());
  update public.business_accounts set frozen = p_on, frozen_at = case when p_on then now() end, frozen_by = case when p_on then (select auth.uid()) end,
    frozen_reason = case when p_on then coalesce(nullif(left(btrim(coalesce(p_reason,'')), 200), ''), 'Paused by ' || who) end
  where id = p_account;
  perform private.biz_log(p_account, case when p_on then 'paused' else 'restarted' end, jsonb_build_object('reason', p_reason));
  perform private.biz_mail_admins(p_account, case when p_on then 'Bookings paused on your business account' else 'Bookings restarted on your business account' end,
    case when p_on then who || E' has paused all new bookings. Bookings already made are not affected.\nAn owner can restart bookings on the Business account page.'
         else who || ' has restarted bookings.' end, null);
end $$;

-- ---------- repeat valets ----------
create or replace function public.biz_schedule_save(p_account uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, 'admin'); ids uuid[]; sid uuid; d date := (p->>'next_day')::date; g public.partners; place text := p->>'place';
  today date := (now() at time zone 'Europe/London')::date;
begin
  select coalesce(array_agg(v.id), '{}') into ids from public.business_vehicles v
  where v.account_id = p_account and v.active and v.id in (select (x)::uuid from jsonb_array_elements_text(coalesce(p->'vehicles','[]'::jsonb)) x);
  if cardinality(ids) = 0 then raise exception 'no_vehicles'; end if;
  if d is null or d <= today or d > today + 90 then raise exception 'bad_day'; end if;
  select * into g from public.partners where id = (p->>'partner')::uuid and status = 'approved' and role = 'valet';
  if not found then raise exception 'partner_unavailable'; end if;
  if private.biz_slot_min(p->>'slot') is null then raise exception 'bad_time'; end if;
  if place not in ('mobile','shop') then raise exception 'bad_place'; end if;
  if place = 'mobile' and (private.biz_pc(p->>'post') is null or length(btrim(coalesce(p->>'address',''))) < 4) then raise exception 'bad_address'; end if;
  if (select count(*) from public.business_schedules s where s.account_id = p_account and s.active) >= 50 then raise exception 'too_many_schedules'; end if;
  insert into public.business_schedules (account_id, partner_id, vehicle_ids, every_weeks, time_label, place, address, postcode, next_day, po, created_by)
  values (p_account, g.id, ids, (p->>'every_weeks')::int, p->>'slot', case when place = 'shop' then 'premises' else 'mobile' end,
          case when place = 'mobile' then left(btrim(p->>'address'), 200) end, case when place = 'mobile' then private.biz_pc(p->>'post') end, d,
          nullif(left(btrim(coalesce(p->>'po','')), 40), ''), (select auth.uid()))
  returning id into sid;
  perform private.biz_log(p_account, 'repeat_valet_set', jsonb_build_object('partner', g.name, 'vehicles', cardinality(ids), 'every_weeks', p->>'every_weeks', 'first', d));
  return sid;
end $$;

create or replace function public.biz_schedule_stop(p_account uuid, p_schedule uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, 'admin');
begin
  update public.business_schedules set active = false, last_result = 'Stopped by the business.' where id = p_schedule and account_id = p_account and active;
  if not found then raise exception 'not_found'; end if;
  perform private.biz_log(p_account, 'repeat_valet_stopped', jsonb_build_object('schedule', p_schedule));
end $$;

-- Runs every morning: books repeat valets 7 days ahead, from the balance only.
create or replace function private.biz_run_schedules() returns int
language plpgsql security definer set search_path = '' as $$
declare s public.business_schedules; vid uuid; res jsonb; err text; n int := 0; today date := (now() at time zone 'Europe/London')::date; okc int; bad text;
begin
  for s in select * from public.business_schedules where active and next_day <= today + 7 order by next_day loop
    while s.next_day < today loop s.next_day := s.next_day + s.every_weeks * 7; end loop;     -- a missed day is skipped, never booked late
    if s.next_day > today + 7 then update public.business_schedules set next_day = s.next_day where id = s.id; continue; end if;
    okc := 0; bad := null;
    foreach vid in array s.vehicle_ids loop
      begin
        res := private.biz_book_core(s.account_id, s.created_by, jsonb_build_object('kind', 'Valet', 'partner', s.partner_id, 'vehicle_id', vid, 'day', s.next_day,
                 'slot', s.time_label, 'where', case when s.place = 'premises' then 'shop' else 'mobile' end, 'address', s.address, 'post', s.postcode,
                 'po', s.po, 'pay', 'wallet', 'idem', 'sch:' || s.id || ':' || s.next_day || ':' || vid), s.id);
        if res ? 'error' then bad := res->>'error'; else okc := okc + 1; n := n + 1; end if;
      exception when others then bad := sqlerrm;
      end;
    end loop;
    update public.business_schedules set next_day = s.next_day + s.every_weeks * 7, last_run = now(),
      last_result = to_char(s.next_day, 'FMDy DD Mon') || ': ' || okc || ' of ' || cardinality(s.vehicle_ids) || ' booked' || coalesce(' (' || bad || ')', '')
    where id = s.id;
    if bad is not null then
      perform private.biz_mail_admins(s.account_id, 'Repeat valet not fully booked for ' || to_char(s.next_day, 'FMDay FMDD FMMonth'),
        okc || ' of ' || cardinality(s.vehicle_ids) || ' vehicles were booked for the repeat valet on ' || to_char(s.next_day, 'FMDay FMDD FMMonth') || '. ' ||
        case when bad ~ 'not_enough_balance' then 'There was not enough money in the balance. Top up and book the rest from the Business account page.'
             when bad ~ 'partner' then 'The valeter is not taking bookings that day. Book another valeter from the Business account page.'
             when bad ~ 'frozen' then 'Bookings on the account are paused.'
             else 'Please book the rest from the Business account page. (' || bad || ')' end, 'bizsch:' || s.id || ':' || s.next_day, true);
    end if;
  end loop;
  return n;
end $$;

-- ---------- top ups ----------
create or replace function private.biz_new_ref() returns text language plpgsql volatile security definer set search_path = '' as $$
declare r text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea; i int;
begin
  loop
    b := extensions.gen_random_bytes(8); r := 'TMC-';
    for i in 0..7 loop r := r || substr(alphabet, (get_byte(b, i) % 32) + 1, 1); end loop;
    exit when not exists (select 1 from public.business_topups where ref = r);
  end loop;
  return r;
end $$;

create or replace function public.biz_topup_request(p_account uuid, p_amount numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, 'admin'); a public.business_accounts; t public.business_topups;
begin
  select * into a from public.business_accounts where id = p_account;
  if a.status <> 'approved' then raise exception 'account_not_approved'; end if;
  if p_amount is null or p_amount <> round(p_amount, 2) or p_amount < private.biz_setting('min_topup', 50) or p_amount > private.biz_setting('max_topup', 10000) then raise exception 'bad_amount'; end if;
  if (select count(*) from public.business_topups x where x.account_id = p_account and x.status = 'pending') >= 3 then raise exception 'too_many_pending'; end if;
  insert into public.business_topups (account_id, ref, method, amount, requested_by) values (p_account, private.biz_new_ref(), 'bank', p_amount, (select auth.uid()))
  returning * into t;
  perform private.biz_log(p_account, 'topup_requested', jsonb_build_object('ref', t.ref, 'amount', p_amount, 'method', 'bank'));
  return jsonb_build_object('ref', t.ref, 'amount', t.amount, 'bank', (select s.value->'bank' from public.app_settings s where s.key = 'business'));
end $$;

create or replace function public.biz_topup_cancel(p_account uuid, p_topup uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, 'admin');
begin
  update public.business_topups set status = 'cancelled' where id = p_topup and account_id = p_account and status = 'pending' and method = 'bank';
  if not found then raise exception 'not_found'; end if;
  perform private.biz_log(p_account, 'topup_cancelled', jsonb_build_object('topup', p_topup));
end $$;

-- ---------- statement ----------
create or replace function public.biz_statement(p_account uuid, p_month date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r text := private.biz_need(p_account, 'viewer'); a public.business_accounts;
  m0 timestamptz := (date_trunc('month', p_month)::timestamp at time zone 'Europe/London'); m1 timestamptz := ((date_trunc('month', p_month) + interval '1 month')::timestamp at time zone 'Europe/London');
begin
  if r = 'booker' then raise exception 'not_allowed'; end if;
  select * into a from public.business_accounts where id = p_account;
  return jsonb_build_object(
    'account', jsonb_build_object('name', a.name, 'ref', a.ref, 'company_no', a.company_no, 'vat_no', a.vat_no, 'address', a.address, 'postcode', a.postcode, 'billing_email', a.billing_email),
    'company', (select s.value from public.app_settings s where s.key = 'company'),
    'month', to_char(date_trunc('month', p_month), 'YYYY-MM'),
    'opening', (select coalesce(sum(d_available), 0) from public.business_ledger l where l.account_id = p_account and l.at < m0),
    'closing', (select coalesce(sum(d_available), 0) from public.business_ledger l where l.account_id = p_account and l.at < m1),
    'held_at_end', (select coalesce(sum(d_held), 0) from public.business_ledger l where l.account_id = p_account and l.at < m1),
    'chain_ok', private.biz_ledger_ok(p_account),
    'ledger', (select coalesce(jsonb_agg(jsonb_build_object('at', l.at, 'kind', l.kind, 'available', l.d_available, 'held', l.d_held, 'note', l.note,
                 'job', j.ref, 'po', j.po) order by l.id), '[]'::jsonb)
               from public.business_ledger l left join public.business_jobs j on j.id = l.job_id where l.account_id = p_account and l.at >= m0 and l.at < m1),
    'jobs', (select coalesce(jsonb_agg(jsonb_build_object('ref', j.ref, 'kind', j.kind, 'reg', j.reg, 'day', coalesce(b.slot_day::text, j.params->>'day'), 'partner', b.partner_name,
                 'price', j.price, 'fee', j.fee, 'total', j.total, 'pay', j.pay_method, 'status', coalesce(b.status, j.status), 'po', j.po,
                 'booking', upper(left(b.id::text, 8)),
                 'by', (select coalesce(m.name, m.email) from public.business_members m where m.account_id = p_account and m.user_id = j.booked_by limit 1)) order by j.created_at), '[]'::jsonb)
             from public.business_jobs j left join public.bookings b on b.id = j.booking_id
             where j.account_id = p_account and j.status in ('booked','cancelled') and j.created_at >= m0 and j.created_at < m1));
end $$;

-- ---------- staff ----------
create or replace function public.staff_biz_accounts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  return jsonb_build_object(
    'accounts', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'ref', a.ref, 'name', a.name, 'kind', a.kind, 'company_no', a.company_no, 'vat_no', a.vat_no,
       'billing_email', a.billing_email, 'phone', a.phone, 'address', a.address, 'postcode', a.postcode, 'fleet_size', a.fleet_size, 'status', a.status,
       'frozen', a.frozen, 'frozen_reason', a.frozen_reason, 'created_at', a.created_at, 'review_note', a.review_note,
       'applied_by', (select u.email from auth.users u where u.id = a.created_by),
       'available', (select coalesce(sum(l.d_available),0) from public.business_ledger l where l.account_id = a.id),
       'held', (select coalesce(sum(l.d_held),0) from public.business_ledger l where l.account_id = a.id),
       'members', (select count(*) from public.business_members m where m.account_id = a.id and m.status = 'active'),
       'vehicles', (select count(*) from public.business_vehicles v where v.account_id = a.id and v.active),
       'jobs', (select count(*) from public.business_jobs j where j.account_id = a.id and j.status = 'booked')) order by (a.status = 'pending') desc, a.created_at desc), '[]'::jsonb)
       from public.business_accounts a),
    'topups', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'ref', t.ref, 'account', a.name, 'account_ref', a.ref, 'amount', t.amount, 'method', t.method,
       'status', t.status, 'created_at', t.created_at) order by t.created_at), '[]'::jsonb)
       from public.business_topups t join public.business_accounts a on a.id = t.account_id where t.status = 'pending'),
    'owner', (select private.is_owner()),
    'settings', (select s.value from public.app_settings s where s.key = 'business'));
end $$;

create or replace function public.staff_biz_review(p_account uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.business_accounts; ns text; note text := nullif(left(btrim(coalesce(p_note,'')), 500), '');
begin
  if not (select private.is_owner()) then raise exception 'owner_only'; end if;   -- like partners: only an owner decides
  select * into a from public.business_accounts where id = p_account for update;
  if not found then raise exception 'not_found'; end if;
  ns := case p_action when 'approve' then 'approved' when 'decline' then 'declined' when 'suspend' then 'suspended' when 'reinstate' then 'approved' when 'close' then 'closed' end;
  if ns is null then raise exception 'bad_action'; end if;
  if p_action = 'approve' and a.status <> 'pending' then raise exception 'not_pending'; end if;
  if p_action = 'reinstate' and a.status <> 'suspended' then raise exception 'not_suspended'; end if;
  if p_action in ('decline','suspend','close') and note is null then raise exception 'reason_needed'; end if;
  if p_action = 'close' and not (select private.is_owner()) then raise exception 'owner_only'; end if;
  if p_action = 'close' and ((select available from private.biz_balance(p_account)) <> 0 or (select held from private.biz_balance(p_account)) <> 0) then raise exception 'balance_not_zero'; end if;
  update public.business_accounts set status = ns, reviewed_by = (select auth.uid()), reviewed_at = now(), review_note = coalesce(note, review_note) where id = p_account;
  if ns in ('suspended','closed','declined') then
    update public.business_schedules set active = false, last_result = 'Stopped: account ' || ns || '.' where account_id = p_account and active;
  end if;
  perform private.biz_log(p_account, 'staff_' || p_action, jsonb_build_object('note', note));
  perform private.biz_mail_admins(p_account,
    case p_action when 'approve' then 'Your business account is approved: ' || a.name when 'reinstate' then 'Your business account is open again: ' || a.name
      when 'decline' then 'Your business account application: ' || a.name when 'suspend' then 'Your business account is on hold: ' || a.name else 'Your business account is closed: ' || a.name end,
    case p_action when 'approve' then E'Good news: your business account is approved.\n\nTop up your balance (or add a company card once card payments are on), add your vehicles and start booking.'
      when 'reinstate' then 'Your business account is open again and you can book.'
      when 'decline' then E'We are sorry, we cannot open a business account for you at the moment.\nReason: ' || note
      when 'suspend' then E'We have put your business account on hold, so no new bookings can be made.\nReason: ' || note || E'\nBookings already made still go ahead. Reply to this email or call us to sort it out.'
      else E'Your business account is now closed.\n' || coalesce('Note: ' || note, '') end, null, true);
end $$;

-- Owners only (with their second login step): money in.
create or replace function public.staff_biz_credit(p_topup uuid, p_received numeric, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.business_topups; a public.business_accounts;
begin
  if not (select private.is_owner()) then raise exception 'owner_only'; end if;
  select * into t from public.business_topups where id = p_topup for update;
  if not found or t.status <> 'pending' or t.method <> 'bank' then raise exception 'not_pending'; end if;
  if p_received is null or p_received <= 0 or p_received > 20000 or p_received <> round(p_received, 2) then raise exception 'bad_amount'; end if;
  select * into a from public.business_accounts where id = t.account_id for update;
  update public.business_topups set status = 'credited', received = p_received, credited_by = (select auth.uid()), credited_at = now(),
    note = nullif(left(btrim(coalesce(p_note,'')), 300), '') where id = t.id;
  perform private.biz_move(t.account_id, 'topup', p_received, null, t.id, null, 'Bank transfer ' || t.ref, (select auth.uid()));
  perform private.biz_log(t.account_id, 'topup_credited', jsonb_build_object('ref', t.ref, 'asked', t.amount, 'received', p_received));
  perform private.biz_mail_admins(t.account_id, 'Top up received: ' || private.biz_money(p_received),
    'We have received your bank transfer ' || t.ref || ' and added ' || private.biz_money(p_received) || ' to your business account balance.' ||
    case when p_received <> t.amount then E'\n(You asked to top up ' || private.biz_money(t.amount) || '; we have added what arrived.)' else '' end ||
    E'\nNew balance: ' || private.biz_money((select available from private.biz_balance(t.account_id))) || '.', 'biztop:' || t.id, true);
end $$;

-- Owners only: a correction, goodwill credit, or money paid back to the business's bank (negative). Always needs a note.
create or replace function public.staff_biz_adjust(p_account uuid, p_amount numeric, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare note text := btrim(coalesce(p_note,''));
begin
  if not (select private.is_owner()) then raise exception 'owner_only'; end if;
  if length(note) < 10 then raise exception 'note_needed'; end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 20000 then raise exception 'bad_amount'; end if;
  perform 1 from public.business_accounts where id = p_account for update;
  if not found then raise exception 'not_found'; end if;
  perform private.biz_move(p_account, case when p_amount > 0 then 'adjust_in' else 'adjust_out' end, abs(p_amount), null, null, null, 'Adjustment by The Motoring Central: ' || note, (select auth.uid()));
  perform private.biz_log(p_account, 'staff_adjustment', jsonb_build_object('amount', p_amount, 'note', note));
  perform private.biz_mail_admins(p_account, 'Balance adjusted: ' || case when p_amount > 0 then '+' else '-' end || private.biz_money(abs(p_amount)),
    'The Motoring Central has ' || case when p_amount > 0 then 'added ' else 'taken ' end || private.biz_money(abs(p_amount)) || case when p_amount > 0 then ' to' else ' from' end ||
    ' your business account balance.' || E'\nReason: ' || note, null, true);
end $$;

create or replace function public.staff_biz_check() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_owner()) then raise exception 'owner_only'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('ref', a.ref, 'name', a.name, 'ok', private.biz_ledger_ok(a.id))), '[]'::jsonb) from public.business_accounts a);
end $$;

-- ---------- payments function (Stripe). Only the server's service key can call these. ----------
create or replace function public.biz_srv_role(p_account uuid, p_user uuid) returns text
language sql stable security definer set search_path = '' as $$ select private.biz_role(p_account, p_user) $$;

create or replace function public.biz_srv_account(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', a.name, 'ref', a.ref, 'status', a.status, 'frozen', a.frozen, 'billing_email', a.billing_email,
    'stripe_customer', c.stripe_customer, 'stripe_pm', case when c.status = 'active' then c.stripe_pm end,
    'min_topup', private.biz_setting('min_topup', 50), 'max_topup', private.biz_setting('max_topup', 10000))
  from public.business_accounts a left join public.business_cards c on c.account_id = a.id where a.id = p_account
$$;

create or replace function public.biz_srv_customer(p_account uuid, p_customer text) returns void
language sql security definer set search_path = '' as $$
  insert into public.business_cards (account_id, stripe_customer, status) values (p_account, p_customer, 'none')
  on conflict (account_id) do nothing
$$;

create or replace function public.biz_srv_card_saved(p_account uuid, p_customer text, p_pm text, p_brand text, p_last4 text, p_m int, p_y int, p_by uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare had boolean;
begin
  select status = 'active' into had from public.business_cards where account_id = p_account;
  insert into public.business_cards (account_id, stripe_customer, stripe_pm, brand, last4, exp_month, exp_year, status, added_by, added_at)
  values (p_account, p_customer, p_pm, left(p_brand, 20), p_last4, p_m, p_y, 'active', p_by, now())
  on conflict (account_id) do update set stripe_customer = excluded.stripe_customer, stripe_pm = excluded.stripe_pm, brand = excluded.brand, last4 = excluded.last4,
    exp_month = excluded.exp_month, exp_year = excluded.exp_year, status = 'active', added_by = excluded.added_by, added_at = now();
  perform private.biz_log(p_account, 'card_added', jsonb_build_object('brand', p_brand, 'last4', p_last4), p_by);
  perform private.biz_mail_admins(p_account, case when had then 'Company card changed' else 'Company card added' end || ' on your business account',
    'A ' || coalesce(p_brand,'card') || ' ending ' || p_last4 || ' is now the card on file for card bookings.' || E'\nIf you did not do this, remove it on the Business account page and contact us.', null);
end $$;

create or replace function public.biz_srv_card_removed(p_account uuid, p_by uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.business_cards set status = 'removed', stripe_pm = null where account_id = p_account;
  perform private.biz_log(p_account, 'card_removed', '{}'::jsonb, p_by);
  perform private.biz_mail_admins(p_account, 'Company card removed from your business account', 'The card on file has been removed. Card bookings are off until a new card is added.', null);
end $$;

create or replace function public.biz_srv_topup_new(p_account uuid, p_user uuid, p_amount numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.business_topups;
begin
  if private.biz_rank(private.biz_role(p_account, p_user)) < 3 then raise exception 'not_allowed'; end if;
  if (select status from public.business_accounts where id = p_account) <> 'approved' then raise exception 'account_not_approved'; end if;
  if p_amount is null or p_amount <> round(p_amount, 2) or p_amount < private.biz_setting('min_topup', 50) or p_amount > private.biz_setting('max_topup', 10000) then raise exception 'bad_amount'; end if;
  insert into public.business_topups (account_id, ref, method, amount, requested_by) values (p_account, private.biz_new_ref(), 'card', p_amount, p_user) returning * into t;
  perform private.biz_log(p_account, 'topup_requested', jsonb_build_object('ref', t.ref, 'amount', p_amount, 'method', 'card'), p_user);
  return jsonb_build_object('id', t.id, 'ref', t.ref);
end $$;

create or replace function public.biz_srv_topup_session(p_topup uuid, p_session text) returns void
language sql security definer set search_path = '' as $$
  update public.business_topups set stripe_session = p_session where id = p_topup and status = 'pending' and stripe_session is null
$$;

-- Called from the Stripe webhook once Stripe says the money is paid. Safe to call twice.
create or replace function public.biz_srv_topup_paid(p_topup uuid, p_session text, p_paid numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.business_topups;
begin
  select * into t from public.business_topups where id = p_topup for update;
  if not found or t.method <> 'card' or t.stripe_session is distinct from p_session then raise exception 'not_found'; end if;
  if t.status = 'credited' then return; end if;
  if p_paid <> t.amount then raise exception 'amount_mismatch'; end if;
  perform 1 from public.business_accounts where id = t.account_id for update;
  update public.business_topups set status = 'credited', received = p_paid, credited_at = now() where id = t.id;
  perform private.biz_move(t.account_id, 'topup', p_paid, null, t.id, null, 'Card top up ' || t.ref, t.requested_by);
  perform private.biz_log(t.account_id, 'topup_credited', jsonb_build_object('ref', t.ref, 'received', p_paid, 'method', 'card'), t.requested_by);
  perform private.biz_mail_admins(t.account_id, 'Top up received: ' || private.biz_money(p_paid),
    private.biz_money(p_paid) || ' paid by card (' || t.ref || ') has been added to your business account balance.', 'biztop:' || t.id, true);
end $$;

create or replace function public.biz_srv_job(p_job uuid, p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare j public.business_jobs; r text;
begin
  select * into j from public.business_jobs where id = p_job;
  if not found then raise exception 'not_found'; end if;
  r := private.biz_role(j.account_id, p_user);
  if r is null or not (j.booked_by = p_user or private.biz_rank(r) >= 3) then raise exception 'not_allowed'; end if;
  if j.status <> 'awaiting_card' or j.card_until < now() or j.pay_method <> 'card' then raise exception 'not_payable'; end if;
  if (select frozen from public.business_accounts where id = j.account_id) then raise exception 'account_frozen'; end if;
  return jsonb_build_object('id', j.id, 'ref', j.ref, 'account', j.account_id, 'total', j.total, 'kind', j.kind, 'reg', j.reg, 'stripe_pi', j.stripe_pi);
end $$;

create or replace function public.biz_srv_job_pi(p_job uuid, p_pi text) returns void
language sql security definer set search_path = '' as $$
  update public.business_jobs set stripe_pi = p_pi where id = p_job and status = 'awaiting_card' and stripe_pi is null
$$;

-- Stripe has taken the money: make the booking. If it cannot be made, say so and the function refunds the card.
create or replace function public.biz_srv_job_paid(p_job uuid, p_pi text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare j public.business_jobs; bid uuid; err text;
begin
  select * into j from public.business_jobs where id = p_job for update;
  if not found or j.stripe_pi is distinct from p_pi then raise exception 'not_found'; end if;
  if j.status = 'booked' then return jsonb_build_object('booking', j.booking_id); end if;
  if j.status <> 'awaiting_card' then return jsonb_build_object('error', 'not_payable'); end if;
  perform 1 from public.business_accounts where id = j.account_id for update;
  begin
    update public.business_jobs set status = 'booked' where id = j.id;
    bid := private.biz_make_booking(j.id);
  exception when others then err := sqlerrm;
  end;
  if err is not null then
    update public.business_jobs set status = 'failed', fail_reason = err where id = j.id;
    perform private.biz_log(j.account_id, 'booking_failed', jsonb_build_object('job', j.ref, 'why', err, 'refund', 'card'), j.booked_by);
    return jsonb_build_object('error', err);
  end if;
  perform private.biz_log(j.account_id, 'booked', jsonb_build_object('job', j.ref, 'pay', 'card', 'total', j.total), j.booked_by);
  return jsonb_build_object('booking', bid);
end $$;

create or replace function public.biz_srv_job_failed(p_job uuid, p_reason text) returns void
language sql security definer set search_path = '' as $$
  update public.business_jobs set status = 'failed', fail_reason = left(p_reason, 300) where id = p_job and status = 'awaiting_card'
$$;

-- ---------- housekeeping ----------
create or replace function private.biz_tidy() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.business_jobs set status = 'expired' where status = 'awaiting_card' and card_until < now() - interval '5 minutes' and stripe_pi is null;
  update public.business_topups set status = 'expired' where status = 'pending' and created_at < now() - interval '30 days';
  update public.business_members set status = 'removed', invite_hash = null where status = 'invited' and invite_expires < now() - interval '30 days';
end $$;

select cron.schedule('business-repeat-valets', '15 6 * * *', 'select private.biz_run_schedules(); select private.kick_notify()');
select cron.schedule('business-tidy', '*/10 * * * *', 'select private.biz_tidy()');

-- ---------- who can call what ----------
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'biz\_%' or p.proname like 'staff\_biz\_%') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname like 'biz\_srv\_%' then
      execute format('grant execute on function %s to service_role', f.sig);
    elsif f.proname = 'biz_invite_info' then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname like 'biz\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
