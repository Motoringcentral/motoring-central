-- Recovery extras: several extras in ONE request.
-- Before: a driver could only send one extra at a time and the customer approved and paid each one separately.
-- Now: the driver picks everything that is needed, gives one reason and sends it as one request ("batch"). The customer
-- signs once on the driver's phone, or approves once in My account (they may untick an extra they do not agree to),
-- and pays once. Each extra is still its own row in job_extras; rows sent together share the same batch id.
-- The old one-at-a-time functions are left in place and still work.

alter table public.job_extras add column if not exists batch uuid;
update public.job_extras set batch = id where batch is null;
alter table public.job_extras alter column batch set default gen_random_uuid();
alter table public.job_extras alter column batch set not null;
create index if not exists job_extras_batch_idx on public.job_extras (batch);

-- driver: send one or more extras for approval
create or replace function public.request_extras(p_booking uuid, p_items jsonb, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare b public.bookings; poss jsonb; it jsonb; bt uuid := gen_random_uuid(); v_code text; q int; pr numeric; lb text; note text;
  n int := 0; total numeric := 0; lines text := ''; why text := left(btrim(coalesce(p_reason, '')), 500);
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found or b.partner_id is distinct from (select auth.uid()) then raise exception 'not_yours'; end if;
  if b.status not in ('confirmed','onway','started') then raise exception 'not_open'; end if;
  if char_length(why) < 3 then raise exception 'need_reason'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then raise exception 'no_items'; end if;
  if jsonb_array_length(p_items) > 10 then raise exception 'too_many'; end if;
  if exists (select 1 from public.job_extras where booking_id = b.id and status = 'pending') then raise exception 'one_at_a_time'; end if;
  poss := coalesce(b.details->'possible', '[]'::jsonb);
  for it in select * from jsonb_array_elements(p_items) loop
    v_code := left(coalesce(it->>'code', ''), 20);
    q := case when coalesce(it->>'qty', '') ~ '^[0-9]{1,3}$' then greatest(1, least(100, (it->>'qty')::int)) else 1 end;
    if v_code = 'other' then
      note := left(btrim(coalesce(it->>'note', '')), 80);
      if char_length(note) < 3 then raise exception 'need_note'; end if;
      if coalesce(it->>'price', '') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' then raise exception 'bad_price'; end if;
      pr := round((it->>'price')::numeric, 2);
      if pr <= 0 or pr > 1000 then raise exception 'bad_price'; end if;
      lb := 'Other: ' || note; q := 1;
    else
      pr := null;
      select (y->>'price')::numeric, y->>'label' into pr, lb from jsonb_array_elements(poss) y where y->>'code' = v_code limit 1;
      if pr is null then raise exception 'not_on_price_list'; end if;
      if exists (select 1 from public.job_extras where batch = bt and code = v_code) then raise exception 'twice'; end if;
      if v_code not in ('wait','storage') then q := 1; end if;
      pr := round(pr * q, 2);
      if q > 1 then lb := lb || ' x ' || q; end if;
    end if;
    insert into public.job_extras (booking_id, partner_id, customer_id, code, label, qty, price, reason, batch)
    values (b.id, b.partner_id, b.customer_id, v_code, left(lb, 120), q, pr, why, bt);
    n := n + 1; total := total + pr;
    lines := lines || lb || ': £' || to_char(pr, 'FM999990.00') || E'\n';
  end loop;
  perform private.mail(private.user_email(b.customer_id), 'customer',
    'Please approve ' || case when n = 1 then 'an extra charge' else n || ' extra charges' end || ': £' || to_char(total, 'FM999990.00'),
    'Hello ' || private.first_name((select name from public.profiles where id = b.customer_id)) || E',\n\n' ||
    coalesce(b.partner_name, 'Your recovery company') || ' needs to add ' || case when n = 1 then 'an extra' else 'these extras' end || E' to your job before they carry on:\n\n' ||
    lines || case when n > 1 then 'Total: £' || to_char(total, 'FM999990.00') || E'\n' else '' end || 'Why: ' || why ||
    E'\n\nNothing is added unless you agree. Open My account to approve and pay, or to say no.\n\nThe Motoring Central',
    '/#account', 'extra_request', 'extras:' || bt);
  return jsonb_build_object('batch', bt, 'count', n, 'total', total);
end $function$;

-- driver: the customer is with them and signs once for everything in the request
create or replace function public.sign_extras(p_batch uuid, p_name text, p_sig text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare n int; total numeric; lines text; cust uuid; why text; nm text := left(btrim(coalesce(p_name, '')), 120);
begin
  perform 1 from public.job_extras where batch = p_batch and partner_id = (select auth.uid()) and status = 'pending' for update;
  if not found then raise exception 'not_possible'; end if;
  if char_length(nm) < 2 then raise exception 'need_name'; end if;
  if coalesce(p_sig, '') !~ '^data:image/png;base64,' or char_length(p_sig) < 400 then raise exception 'need_signature'; end if;
  update public.job_extras set status = 'approved', method = 'signature', signer_name = nm, signature = p_sig, decided_at = now()
  where batch = p_batch and partner_id = (select auth.uid()) and status = 'pending';
  select count(*), sum(price), string_agg(label || ': £' || to_char(price, 'FM999990.00'), E'\n' order by created_at, label), min(customer_id::text)::uuid, min(reason)
    into n, total, lines, cust, why
  from public.job_extras where batch = p_batch and status = 'approved';
  perform private.mail(private.user_email(cust), 'customer', 'You approved ' || case when n = 1 then 'an extra' else n || ' extras' end || ': please pay £' || to_char(total, 'FM999990.00'),
    'Hello ' || private.first_name((select name from public.profiles where id = cust)) || E',\n\nYou signed to approve ' || case when n = 1 then 'this extra' else 'these extras' end || E' on your recovery:\n' ||
    lines || case when n > 1 then E'\nTotal: £' || to_char(total, 'FM999990.00') else '' end || E'\nWhy: ' || why || E'\nSigned by: ' || nm ||
    E'\n\nPlease pay in My account. If you did not sign this, tell us straight away by replying to this email.\n\nThe Motoring Central',
    '/#account', 'extra_signed', 'extrassigned:' || p_batch);
  return jsonb_build_object('batch', p_batch, 'count', n, 'total', total);
end $function$;

-- driver: take back a request the customer has not answered yet
create or replace function public.withdraw_extras(p_batch uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.job_extras set status = 'withdrawn', decided_at = now() where batch = p_batch and partner_id = (select auth.uid()) and status = 'pending';
  if not found then raise exception 'not_possible'; end if;
end $function$;

-- every approved extra in a request is paid together: one change to the booking and one email to the company
create or replace function private.extras_paid(p_batch uuid, p_ref text)
returns numeric
language plpgsql
security definer
set search_path to ''
as $function$
declare b public.bookings; rate numeric; total numeric; lines text; n int; bid uuid; pid uuid;
begin
  select min(booking_id::text)::uuid, min(partner_id::text)::uuid, count(*), sum(price), string_agg(label || ': £' || to_char(price, 'FM999990.00'), E'\n' order by created_at, label)
    into bid, pid, n, total, lines
  from public.job_extras where batch = p_batch and status = 'approved';
  if coalesce(n, 0) = 0 then return 0; end if;
  select * into b from public.bookings where id = bid for update;
  rate := coalesce((b.details->'price'->>'rate')::numeric, 0.12);
  update public.job_extras set status = 'paid', paid_at = now(), paid_ref = left(coalesce(p_ref, ''), 100) where batch = p_batch and status = 'approved';
  update public.bookings set price_total = coalesce(price_total, 0) + total,
    our_share = coalesce(our_share, 0) + round(total * rate, 2),
    partner_payout = coalesce(partner_payout, 0) + round(total * (1 - rate), 2)
  where id = b.id;
  perform private.mail((select email from public.partners where id = pid), 'partner',
    case when n = 1 then 'Extra approved and paid' else n || ' extras approved and paid' end || ': £' || to_char(total, 'FM999990.00'),
    E'Hello,\n\nThe customer has approved and paid for ' || case when n = 1 then 'an extra' else 'these extras' end || ' on job ' || upper(left(b.id::text, 8)) || E':\n' || lines ||
    case when n > 1 then E'\nTotal: £' || to_char(total, 'FM999990.00') else '' end ||
    E'\n\nIt is added to your payout for this job. You can carry on.\n\nThe Motoring Central', '/#dashboard', 'extra_paid', 'extraspaid:' || p_batch);
  return total;
end $function$;

-- customer: approve (all, or only the ones they keep ticked) and pay once, or say no
create or replace function public.decide_extras(p_batch uuid, p_ok boolean, p_name text, p_paid text, p_keep uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare me uuid := (select auth.uid()); nm text := left(btrim(coalesce(p_name, '')), 120); pid uuid; n_pending int; n_no int := 0; no_lines text; paid numeric;
begin
  perform 1 from public.job_extras where batch = p_batch and customer_id = me and status in ('pending','approved') for update;
  if not found then raise exception 'not_possible'; end if;
  select count(*) filter (where status = 'pending'), min(partner_id::text)::uuid into n_pending, pid from public.job_extras where batch = p_batch and customer_id = me and status in ('pending','approved');
  if not p_ok and n_pending = 0 then raise exception 'not_possible'; end if;   -- already signed for: it cannot be declined online
  if p_ok and n_pending > 0 and char_length(nm) < 2 then raise exception 'need_name'; end if;
  if p_ok and exists (select 1 from public.job_extras where batch = p_batch and customer_id = me and (status = 'approved' or (status = 'pending' and (p_keep is null or id = any(p_keep)))))
     and char_length(btrim(coalesce(p_paid, ''))) < 3 then raise exception 'not_paid'; end if;
  -- the ones the customer says no to
  select count(*), string_agg(label || ': £' || to_char(price, 'FM999990.00'), E'\n' order by created_at, label) into n_no, no_lines
  from public.job_extras where batch = p_batch and customer_id = me and status = 'pending' and (not p_ok or (p_keep is not null and not (id = any(p_keep))));
  update public.job_extras set status = 'declined', method = 'online', signer_name = nullif(nm, ''), decided_at = now()
  where batch = p_batch and customer_id = me and status = 'pending' and (not p_ok or (p_keep is not null and not (id = any(p_keep))));
  if n_no > 0 then
    perform private.mail((select email from public.partners where id = pid), 'partner', case when n_no = 1 then 'Extra declined' else n_no || ' extras declined' end,
      E'Hello,\n\nThe customer has said no to ' || case when n_no = 1 then 'this extra' else 'these extras' end || E':\n' || no_lines ||
      E'\n\nDo not carry out that part of the job or charge for it. Call the customer to agree what happens next, or call us.\n\nThe Motoring Central',
      '/#dashboard', 'extra_declined', 'extrasdec:' || p_batch);
  end if;
  if not p_ok then return jsonb_build_object('status', 'declined', 'declined', n_no); end if;
  update public.job_extras set status = 'approved', method = 'online', signer_name = nm, decided_at = now()
  where batch = p_batch and customer_id = me and status = 'pending';
  paid := private.extras_paid(p_batch, p_paid);
  return jsonb_build_object('status', case when paid > 0 then 'paid' else 'declined' end, 'paid', paid, 'declined', n_no);
end $function$;

revoke all on function public.request_extras(uuid, jsonb, text) from public, anon;
revoke all on function public.sign_extras(uuid, text, text) from public, anon;
revoke all on function public.withdraw_extras(uuid) from public, anon;
revoke all on function public.decide_extras(uuid, boolean, text, text, uuid[]) from public, anon;
revoke all on function private.extras_paid(uuid, text) from public, anon, authenticated;
grant execute on function public.request_extras(uuid, jsonb, text) to authenticated;
grant execute on function public.sign_extras(uuid, text, text) to authenticated;
grant execute on function public.withdraw_extras(uuid) to authenticated;
grant execute on function public.decide_extras(uuid, boolean, text, text, uuid[]) to authenticated;
