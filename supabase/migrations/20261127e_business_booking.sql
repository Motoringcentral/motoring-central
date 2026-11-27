-- BUSINESS ACCOUNTS, part 2 of 3: pricing and making the booking (27 Nov 2026).

create or replace function private.biz_size_label(k int) returns text language sql immutable set search_path = '' as $$
  select (array['Small','Medium','Large','Extra large or van'])[k + 1]
$$;
create or replace function private.biz_slot_min(p text) returns int language sql immutable set search_path = '' as $$
  select case p when '8:00am' then 480 when '10:00am' then 600 when '12:00pm' then 720 when '2:00pm' then 840 end
$$;

-- Works out the price of a job from the partner's own rates. Never trusts a price from the page.
create or replace function private.biz_price(p_kind text, p_partner uuid, p jsonb, p_class text,
  out price numeric, out fee numeric, out total numeric, out payout numeric, out ours numeric, out partner_name text)
language plpgsql stable security definer set search_path = '' as $$
declare g public.partners; r jsonb; k int; n int; col text; vs text; rate numeric := 0.12;
begin
  select * into g from public.partners where id = p_partner and status = 'approved';
  if not found then raise exception 'partner_unavailable'; end if;
  partner_name := g.name; r := coalesce(g.rates, '{}'::jsonb); vs := lower(coalesce(g.sub, ''));
  if p_kind = 'Valet' then
    if g.role <> 'valet' then raise exception 'bad_partner'; end if;
    k := (p->>'size')::int; if k is null or k not between 0 and 3 then raise exception 'bad_size'; end if;
    if p->>'where' = 'mobile' and not (vs = '' or vs ~ 'mobile') then raise exception 'not_offered'; end if;
    if p->>'where' = 'shop' and vs !~ '(premises|centre)' then raise exception 'not_offered'; end if;
    if coalesce(p->>'where','') not in ('mobile','shop') then raise exception 'bad_place'; end if;
    price := (r->'p'->>k)::numeric;
    fee := private.biz_setting('fee', 9.99);
  elsif p_kind = 'Alloy wheels' then
    if g.role <> 'body' then raise exception 'bad_partner'; end if;
    n := (p->>'wheels')::int; if n is null or n not between 1 and 5 then raise exception 'bad_wheels'; end if;
    col := case (p->>'finish')::int when 0 then 'wheel' when 1 then 'dcut' when 2 then 'col' when 3 then 'kerb' end;
    if col is null then raise exception 'bad_finish'; end if;
    if coalesce(p->>'where','') not in ('mobile','shop') then raise exception 'bad_place'; end if;
    if col = 'dcut' and p->>'where' = 'mobile' then raise exception 'bad_finish'; end if;
    price := (r->>col)::numeric * n;
    fee := private.biz_setting('fee', 9.99);
  elsif p_kind = 'MOT' then
    if not (g.role = 'mechanic' and g.sub = 'garage') then raise exception 'no_garage'; end if;
    total := private.mot_max(p_class);
    if total is null then raise exception 'bad_class'; end if;
    price := total; fee := 0; payout := private.mot_payout(p_class); ours := total - payout;
    return;
  else raise exception 'bad_kind'; end if;
  if price is null or price <= 0 then raise exception 'not_offered'; end if;
  price := round(price, 2); fee := round(fee, 2);
  total := price + fee; payout := round(price * (1 - rate), 2); ours := total - payout;
end $$;

-- Turns an approved / paid job into a real booking. Re-checks everything. Returns the booking id.
create or replace function private.biz_make_booking(p_job uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare j public.business_jobs; a public.business_accounts; v public.business_vehicles; pr record; g public.partners;
  d date; t text; bid uuid; m jsonb; summ text; veh jsonb; wk jsonb; dmin int; old_claims text; old_sub text; res jsonb; biz jsonb;
  today date := (now() at time zone 'Europe/London')::date;
begin
  select * into j from public.business_jobs where id = p_job for update;
  if not found then raise exception 'no_job'; end if;
  if j.booking_id is not null then return j.booking_id; end if;
  select * into a from public.business_accounts where id = j.account_id;
  if a.status <> 'approved' then raise exception 'account_not_approved'; end if;
  if j.vehicle_id is not null then select * into v from public.business_vehicles where id = j.vehicle_id; end if;
  veh := jsonb_strip_nulls(jsonb_build_object('reg', j.reg, 'make', v.make, 'model', v.model, 'colour', v.colour));
  biz := jsonb_strip_nulls(jsonb_build_object('account', a.id, 'account_ref', a.ref, 'name', a.name, 'job', j.ref, 'po', j.po, 'pay', j.pay_method));
  d := (j.params->>'day')::date;
  if d is null or d < today or d > today + 60 then raise exception 'bad_day'; end if;
  select * into g from public.partners where id = (j.params->>'partner')::uuid and status = 'approved';
  if not found then raise exception 'partner_unavailable'; end if;

  if j.kind = 'MOT' then
    old_claims := current_setting('request.jwt.claims', true); old_sub := current_setting('request.jwt.claim.sub', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', j.booked_by, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', j.booked_by::text, true);
    res := public.book_mot(g.id, d, (j.params->>'start')::int, coalesce(j.params->>'class', '4-goods'), j.reg, veh,
             'MOT test for ' || a.name || coalesce(' (PO ' || j.po || ')', ''), now());
    perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);
    bid := (res->>'id')::uuid;
    if (select b.price_total from public.bookings b where b.id = bid) <> j.total then raise exception 'price_changed'; end if;
    update public.bookings b set details = coalesce(b.details, '{}'::jsonb) || jsonb_build_object('biz', biz),
      customer_name = left(a.name || ' (' || coalesce(nullif(b.customer_name,''), 'business account') || ')', 160),
      customer_phone = coalesce(nullif(b.customer_phone,''), a.phone, '')
    where b.id = bid;
  else
    select * into pr from private.biz_price(j.kind, g.id, j.params, null);
    if pr.total <> j.total then raise exception 'price_changed'; end if;
    t := j.params->>'slot';
    dmin := private.biz_slot_min(t);
    if dmin is null then raise exception 'bad_time'; end if;
    if d = today and dmin < extract(hour from now() at time zone 'Europe/London') * 60 + 120 then raise exception 'bad_time'; end if;
    wk := g.details->'area'->'week';
    if jsonb_typeof(wk) = 'array' then
      if jsonb_typeof(wk->extract(dow from d)::int) <> 'array' then raise exception 'partner_closed'; end if;
      if dmin < split_part(wk->extract(dow from d)::int->>0, ':', 1)::int * 60 + split_part(wk->extract(dow from d)::int->>0, ':', 2)::int
         or dmin >= split_part(wk->extract(dow from d)::int->>1, ':', 1)::int * 60 + split_part(wk->extract(dow from d)::int->>1, ':', 2)::int then
        raise exception 'partner_closed';
      end if;
    end if;
    if j.kind = 'Valet' then
      summ := 'Full valet (' || private.biz_size_label((j.params->>'size')::int) || ') for ' || j.reg;
    else
      summ := 'Alloy wheel refurb, ' || (j.params->>'wheels') || ' wheel' || case when (j.params->>'wheels')::int > 1 then 's' else '' end ||
        ' (' || (array['standard refurb','diamond cut','colour change','kerb damage repair'])[(j.params->>'finish')::int + 1] || ') for ' || j.reg;
    end if;
    summ := summ || case when j.params->>'where' = 'mobile' then ' at ' || coalesce(j.params->>'address','') || ', ' || coalesce(j.params->>'post','')
                         else ' at ' || g.name || '''s premises' end ||
      ', ' || to_char(d, 'FMDay FMDD FMMonth') || ' (' || t || '). Business account: ' || a.name || coalesce(', PO ' || j.po, '') ||
      '. Paid from the business account: fixed price ' || private.biz_money(pr.price) || ' plus ' || private.biz_money(pr.fee) || ' booking fee.' ||
      coalesce(' Note: ' || nullif(j.note,''), '');
    m := jsonb_strip_nulls(jsonb_build_object('size', (j.params->>'size')::int, 'wheels', (j.params->>'wheels')::int, 'finish', (j.params->>'finish')::int,
           'where', j.params->>'where', 'post', j.params->>'post', 'address', j.params->>'address', 'day', d, 'slot', t, 'biz', biz));
    insert into public.bookings (customer_id, kind, service, summary, vehicle, status, made_at, partner_id, partner_name,
      price_total, our_share, partner_payout, paid, slot_day, slot_start, details)
    values (j.booked_by, j.kind, case when j.kind = 'Valet' then 'Full valet' else 'Alloy wheel refurb' end, left(summ, 2000),
      veh, 'confirmed', now(), g.id, g.name, pr.total, pr.ours, pr.payout, true, d, dmin, m)
    returning id into bid;
  end if;
  update public.business_jobs set booking_id = bid, status = 'booked', fail_reason = null where id = j.id;
  return bid;
end $$;

-- The core of every business booking: checks, limits, price, money. Used by the website and the repeat valets.
-- Returns the job as jsonb. p_by is the member who books.
create or replace function private.biz_book_core(p_account uuid, p_by uuid, p jsonb, p_schedule uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.business_accounts; me public.business_members; v public.business_vehicles; j public.business_jobs; pr record;
  v_kind text := p->>'kind'; v_reg text; v_pay text := coalesce(p->>'pay', 'wallet'); v_idem text := left(btrim(coalesce(p->>'idem','')), 80);
  needs_ok boolean := false; q jsonb; cls text; pc text; n_hour int; n_day int; bal record; bid uuid; err text;
begin
  if length(v_idem) < 8 then raise exception 'bad_request'; end if;
  select * into a from public.business_accounts where id = p_account for update;           -- one money move at a time
  if not found then raise exception 'not_allowed'; end if;
  select * into j from public.business_jobs where account_id = p_account and business_jobs.idem = v_idem;   -- a repeat of the same tap
  if found then return to_jsonb(j); end if;
  select * into me from public.business_members where account_id = p_account and user_id = p_by and status = 'active';
  if not found or private.biz_rank(me.role) < 2 then raise exception 'not_allowed'; end if;
  if a.status <> 'approved' then raise exception 'account_not_approved'; end if;
  if a.frozen then raise exception 'account_frozen'; end if;
  if v_kind is null or not (v_kind = any(a.services)) then raise exception 'service_not_allowed'; end if;
  if v_pay not in ('wallet','card') then raise exception 'bad_pay'; end if;
  if v_pay = 'card' and not exists (select 1 from public.business_cards c where c.account_id = p_account and c.status = 'active') then raise exception 'no_card'; end if;
  if v_pay = 'card' and p_schedule is not null then raise exception 'bad_pay'; end if;

  -- too many bookings too fast = a lost login or a mistake: stop and tell the owners
  select count(*) into n_hour from public.business_jobs where booked_by = p_by and account_id = p_account and created_at > now() - interval '1 hour' and schedule_id is null;
  select count(*) into n_day from public.business_jobs where account_id = p_account and created_at > now() - interval '24 hours' and schedule_id is null;
  if p_schedule is null and (n_hour >= private.biz_setting('max_per_hour', 15) or n_day >= private.biz_setting('max_per_day', 60)) then
    update public.business_accounts set frozen = true, frozen_at = now(), frozen_by = null,
      frozen_reason = 'Stopped automatically: unusually many bookings in a short time.' where id = p_account;
    perform private.biz_log(p_account, 'auto_frozen', jsonb_build_object('last_hour_by_member', n_hour, 'last_day', n_day), p_by);
    perform private.biz_mail_admins(p_account, 'Business account paused: unusual activity',
      'We have paused bookings on your business account because ' || coalesce(me.name, me.email) || ' (or their login) made an unusual number of bookings in a short time. ' ||
      E'Nothing new can be booked until an owner restarts bookings on the Business account page.\n\nIf you did not expect this, change that person''s password and check the bookings list.', 'bizfreeze:' || p_account || ':' || to_char(now(),'YYYYMMDDHH24'));
    return jsonb_build_object('error', 'account_frozen');
  end if;

  -- the vehicle
  if p->>'vehicle_id' is not null then
    select * into v from public.business_vehicles where id = (p->>'vehicle_id')::uuid and account_id = p_account and active;
    if not found then raise exception 'bad_vehicle'; end if;
    v_reg := v.reg;
  else
    if a.fleet_only then raise exception 'fleet_only'; end if;
    v_reg := private.biz_reg(p->>'reg');
    if v_reg is null or v_reg !~ '^[A-Z0-9]{2,8}$' then raise exception 'bad_reg'; end if;
  end if;

  -- what is booked (only known keys are kept; nothing else from the page is stored)
  q := jsonb_build_object('partner', p->>'partner', 'day', p->>'day');
  if v_kind = 'Valet' then
    q := q || jsonb_build_object('size', coalesce((p->>'size')::int, v.size), 'where', p->>'where', 'slot', p->>'slot');
  elsif v_kind = 'Alloy wheels' then
    q := q || jsonb_build_object('wheels', (p->>'wheels')::int, 'finish', (p->>'finish')::int, 'where', p->>'where', 'slot', p->>'slot');
  elsif v_kind = 'MOT' then
    cls := coalesce(nullif(p->>'class',''), v.mot_class, '4-goods');
    q := q || jsonb_build_object('start', (p->>'start')::int, 'class', cls);
  end if;
  if q->>'where' = 'mobile' then
    pc := private.biz_pc(p->>'post');
    if pc is null or length(btrim(coalesce(p->>'address',''))) < 4 then raise exception 'bad_address'; end if;
    q := q || jsonb_build_object('post', pc, 'address', left(btrim(p->>'address'), 200));
  end if;
  select * into pr from private.biz_price(v_kind, (q->>'partner')::uuid, q, cls);

  -- spending limits
  if a.monthly_cap is not null and private.biz_month_spend(p_account) + pr.total > a.monthly_cap then raise exception 'over_monthly_cap'; end if;
  if me.monthly_limit is not null and private.biz_month_spend(p_account, p_by) + pr.total > me.monthly_limit then raise exception 'over_your_limit'; end if;
  needs_ok := me.role = 'booker' and a.approval_over is not null and pr.total > a.approval_over and p_schedule is null;

  insert into public.business_jobs (account_id, kind, vehicle_id, reg, params, price, fee, total, pay_method, status, booked_by,
    po, note, schedule_id, idem, card_until)
  values (p_account, v_kind, v.id, v_reg, q, pr.price, pr.fee, pr.total, v_pay,
    case when needs_ok then 'awaiting_approval' when v_pay = 'card' then 'awaiting_card' else 'booked' end, p_by,
    nullif(left(btrim(coalesce(p->>'po','')), 40), ''), nullif(left(btrim(coalesce(p->>'note','')), 500), ''), p_schedule, v_idem,
    case when v_pay = 'card' and not needs_ok then now() + interval '30 minutes' end)
  returning * into j;

  if v_pay = 'wallet' then
    perform private.biz_move(p_account, 'hold', pr.total, j.id, null, null, j.ref || ' ' || v_kind || ' ' || v_reg, p_by);   -- raises if not enough money
  end if;

  if j.status = 'booked' then
    bid := private.biz_make_booking(j.id);       -- any problem here undoes the hold too (same transaction)
  end if;
  perform private.biz_log(p_account, case when needs_ok then 'booking_needs_approval' when v_pay = 'card' then 'booking_awaiting_card' else 'booked' end,
    jsonb_build_object('job', j.ref, 'kind', v_kind, 'reg', v_reg, 'total', pr.total, 'partner', pr.partner_name, 'day', q->>'day', 'schedule', p_schedule), p_by);
  if needs_ok then
    perform private.biz_mail_admins(p_account, 'Booking to approve: ' || v_kind || ', ' || v_reg || ', ' || private.biz_money(pr.total),
      coalesce(me.name, me.email) || ' would like to book ' || v_kind || ' for ' || v_reg || ' with ' || pr.partner_name || ' on ' ||
      to_char((q->>'day')::date, 'FMDay FMDD FMMonth') || ' for ' || private.biz_money(pr.total) || E'.\n\nIt is over your approval limit of ' ||
      private.biz_money(a.approval_over) || E', so it waits for an owner or admin. The money is set aside until you decide.\nOpen the Business account page to approve or decline it.',
      'bizok:' || j.id);
  end if;
  -- low balance warning, at most once a day
  if v_pay = 'wallet' then
    select * into bal from private.biz_balance(p_account);
    if bal.available < a.low_balance and not exists (select 1 from public.notifications n
         where n.ref like 'bizlow:' || p_account || ':%' and n.created_at > now() - interval '24 hours') then
      perform private.biz_mail_admins(p_account, 'Low balance on your business account: ' || private.biz_money(bal.available),
        'Your business account balance is down to ' || private.biz_money(bal.available) || ' (your warning level is ' || private.biz_money(a.low_balance) ||
        E').\n\nTop up on the Business account page so bookings and repeat valets are not stopped.', 'bizlow:' || p_account || ':' || to_char(now(),'YYYYMMDD'), true);
    end if;
  end if;
  select * into j from public.business_jobs where id = j.id;
  return to_jsonb(j);
end $$;

-- When a business booking is cancelled the held money goes back; when it is done the money is taken.
create or replace function private.biz_booking_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j public.business_jobs; back numeric;
begin
  if new.status is not distinct from old.status or not (coalesce(new.details,'{}'::jsonb) ? 'biz') then return new; end if;
  select * into j from public.business_jobs where booking_id = new.id;
  if not found then return new; end if;
  if new.status = 'cancelled' then
    update public.business_jobs set status = 'cancelled' where id = j.id;
    if j.pay_method = 'wallet' and not exists (select 1 from public.business_ledger where job_id = j.id and kind in ('release','take')) then
      back := least(coalesce(new.refund_amount, j.total), j.total);
      if back > 0 then perform private.biz_move(j.account_id, 'release', back, j.id, null, new.id, j.ref || ' cancelled: money back', new.cancelled_by); end if;
      if j.total - back > 0 then
        perform private.biz_move(j.account_id, 'take', j.total - back, j.id, null, new.id, j.ref || ' cancelled late: charged', new.cancelled_by);
      end if;
      update public.bookings set refund_status = case when back > 0 then 'refunded' else refund_status end where id = new.id;
      perform private.biz_log(j.account_id, 'booking_cancelled', jsonb_build_object('job', j.ref, 'back', back, 'reason', new.cancel_reason), new.cancelled_by);
      perform private.biz_mail_admins(j.account_id, 'Booking cancelled: ' || j.kind || ', ' || j.reg,
        'The ' || j.kind || ' booking ' || j.ref || ' for ' || j.reg || ' has been cancelled.' || coalesce(' Reason: ' || nullif(new.cancel_reason,'') || '.', '') ||
        case when back > 0 then E'\n' || private.biz_money(back) || ' is back in your business account balance.' else '' end, 'bizcx:' || j.id);
    end if;
  elsif new.status = 'done' and j.pay_method = 'wallet' and not exists (select 1 from public.business_ledger where job_id = j.id and kind in ('release','take')) then
    perform private.biz_move(j.account_id, 'take', j.total, j.id, null, new.id, j.ref || ' done: ' || j.kind || ' ' || j.reg, null);
    perform private.biz_log(j.account_id, 'job_done', jsonb_build_object('job', j.ref), null);
  end if;
  return new;
end $$;
create trigger bookings_business after update of status on public.bookings for each row execute function private.biz_booking_status();

-- The cancellation email to the booker says the money is back in the account, not "refunded to the card you used".
do $$ declare d text;
begin
  d := pg_get_functiondef('private.mail_booking()'::regprocedure);
  if position('If you have paid, we will refund you to the card you used.' in d) = 0 then raise exception 'mail_booking changed: check the wording'; end if;
  d := replace(d, $q$E'If you have paid, we will refund you to the card you used.\nReference: '$q$,
    $q$case when coalesce(new.details,'{}'::jsonb) ? 'biz' and new.details->'biz'->>'pay' = 'wallet' then E'Any money for it is back in your business account balance.\nReference: ' else E'If you have paid, we will refund you to the card you used.\nReference: ' end$q$);
  if position('Any money for it is back in your business account balance.' in d) = 0 then raise exception 'mail_booking wording not replaced'; end if;
  execute d;
end $$;

-- Business bookings show the business name to the partner, so the valeter knows it is a fleet job.
do $$ declare d text;
begin
  d := pg_get_functiondef('private.fill_booking()'::regprocedure);
  d := replace(d, $q$  new.customer_name := coalesce(new.customer_name, ''); new.customer_phone := coalesce(new.customer_phone, '');$q$,
    $q$  new.customer_name := coalesce(new.customer_name, ''); new.customer_phone := coalesce(new.customer_phone, '');
  if coalesce(new.details, '{}'::jsonb) ? 'biz' and current_user <> 'authenticated' then
    new.customer_name := left(coalesce(new.details->'biz'->>'name', 'Business') || ' (' || coalesce(nullif(new.customer_name,''), 'business account') || ')', 160);
  end if;$q$);
  if position($q$? 'biz'$q$ in d) = 0 then raise exception 'fill_booking not changed'; end if;
  execute d;
end $$;
