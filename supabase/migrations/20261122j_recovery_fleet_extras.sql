-- Recovery: each partner's fleet and price list, and extras that need the customer's approval (22 Nov 2026)
-- * Fleet: the truck types a recovery partner runs, each with its own call-out charge, price per mile and miles
--   included in the call-out. Quotes use the partner's cheapest truck that can do the job.
-- * Extras: one price list (dollies, skates, winching, accident damage, spill clean-up, no keys, low car, waiting time,
--   storage, out of hours). Extras the customer's answers make certain are in the price they pay when booking; the
--   rest are shown "only if needed, and only with your approval", at prices fixed at booking.
-- * On the day the partner can only add an extra by asking the customer: the customer signs on the partner's phone
--   or approves online. The booking's price changes only when the customer approves and pays.

create or replace function public.set_recovery_setup(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.partners; f jsonb := '[]'::jsonb; e jsonb := '{}'::jsonb; x jsonb; k text; v numeric;
        types text[] := array['trailer','beaver','spec','slide75','heavy','transporter','bike'];
        codes text[] := array['dollies','skates','winch','accident','spill','nokeys','low','wait','storage','ooh'];
        mc numeric; mm numeric;
begin
  select * into me from public.partners where id = (select auth.uid());
  if not found or me.role <> 'recovery' then raise exception 'not_recovery'; end if;
  if jsonb_typeof(p->'fleet') <> 'array' or jsonb_array_length(p->'fleet') = 0 then raise exception 'no_fleet'; end if;
  for x in select * from jsonb_array_elements(p->'fleet') loop
    if not (x->>'type' = any(types)) then raise exception 'bad_type'; end if;
    if exists (select 1 from jsonb_array_elements(f) y where y->>'type' = x->>'type') then continue; end if;
    f := f || jsonb_build_array(jsonb_build_object(
      'type', x->>'type',
      'n', greatest(1, least(50, coalesce((x->>'n')::int, 1))),
      'call', greatest(0, least(2000, round(coalesce((x->>'call')::numeric, 0), 2))),
      'mile', greatest(0, least(50, round(coalesce((x->>'mile')::numeric, 0), 2))),
      'incl', greatest(0, least(200, coalesce((x->>'incl')::int, 0)))));
  end loop;
  if jsonb_typeof(p->'extras') = 'object' then
    foreach k in array codes loop
      if p->'extras' ? k and jsonb_typeof(p->'extras'->k) = 'number' then
        v := (p->'extras'->>k)::numeric;
        if v >= 0 and v <= 2000 then e := e || jsonb_build_object(k, round(v, 2)); end if;
      end if;
    end loop;
  end if;
  select min((y->>'call')::numeric), min((y->>'mile')::numeric) into mc, mm from jsonb_array_elements(f) y;
  update public.partners set
    details = coalesce(details, '{}'::jsonb) || jsonb_build_object('trucks', f, 'extras', e,
      'types', (select jsonb_agg(y->>'type') from jsonb_array_elements(f) y), 'vans', (select sum((y->>'n')::int) from jsonb_array_elements(f) y)),
    rates = coalesce(rates, '{}'::jsonb) || jsonb_build_object('call', mc, 'mile', mm, 'winch', coalesce((e->>'winch')::numeric, 0))
  where id = me.id;
  return jsonb_build_object('fleet', f, 'extras', e);
end $$;
revoke all on function public.set_recovery_setup(jsonb) from public, anon;
grant execute on function public.set_recovery_setup(jsonb) to authenticated;

create table if not exists public.job_extras (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  code text not null check (char_length(code) <= 20),
  label text not null check (char_length(label) <= 120),
  qty int not null default 1 check (qty between 1 and 100),
  price numeric(10,2) not null check (price > 0 and price <= 5000),
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'pending' check (status in ('pending','approved','declined','paid','withdrawn')),
  method text check (method in ('signature','online')),
  signer_name text check (char_length(signer_name) <= 120),
  signature text check (char_length(signature) <= 120000),
  paid_ref text check (char_length(paid_ref) <= 100),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  paid_at timestamptz
);
create index if not exists job_extras_booking on public.job_extras (booking_id);
alter table public.job_extras enable row level security;
drop policy if exists "job extras: partner, customer or staff" on public.job_extras;
create policy "job extras: partner, customer or staff" on public.job_extras for select to authenticated
  using (partner_id = (select auth.uid()) or customer_id = (select auth.uid()) or (select private.is_staff()));
revoke all on public.job_extras from anon, authenticated;
grant select on public.job_extras to authenticated;

-- partner: ask the customer to approve an extra (prices come from the booking, fixed when it was made)
create or replace function public.request_extra(p_booking uuid, p_code text, p_qty int, p_reason text, p_price numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.bookings; pr numeric; lb text; q int := greatest(1, least(100, coalesce(p_qty, 1))); x public.job_extras; poss jsonb;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found or b.partner_id is distinct from (select auth.uid()) then raise exception 'not_yours'; end if;
  if b.status not in ('confirmed','onway','started') then raise exception 'not_open'; end if;
  if char_length(btrim(coalesce(p_reason,''))) < 3 then raise exception 'need_reason'; end if;
  if exists (select 1 from public.job_extras where booking_id = b.id and status = 'pending') then raise exception 'one_at_a_time'; end if;
  poss := coalesce(b.details->'possible', '[]'::jsonb);
  if p_code = 'other' then
    pr := round(coalesce(p_price, 0), 2); lb := 'Other: ' || left(btrim(p_reason), 80);
    if pr <= 0 or pr > 1000 then raise exception 'bad_price'; end if;
  else
    select (y->>'price')::numeric, y->>'label' into pr, lb from jsonb_array_elements(poss) y where y->>'code' = p_code limit 1;
    if pr is null then raise exception 'not_on_price_list'; end if;
    if p_code not in ('wait','storage') then q := 1; end if;
    pr := round(pr * q, 2);
    if q > 1 then lb := lb || ' x ' || q; end if;
  end if;
  insert into public.job_extras (booking_id, partner_id, customer_id, code, label, qty, price, reason)
  values (b.id, b.partner_id, b.customer_id, left(p_code, 20), left(lb, 120), q, pr, left(btrim(p_reason), 500)) returning * into x;
  perform private.mail(private.user_email(b.customer_id), 'customer', 'Please approve an extra charge: £' || to_char(pr, 'FM999990.00'),
    'Hello ' || private.first_name((select name from public.profiles where id = b.customer_id)) || E',\n\n' ||
    coalesce(b.partner_name, 'Your recovery company') || E' needs to add an extra to your job before they carry on:\n\n' ||
    lb || ': £' || to_char(pr, 'FM999990.00') || E'\nWhy: ' || btrim(p_reason) ||
    E'\n\nNothing is added unless you agree. Open My account to approve and pay, or to say no.\n\nThe Motoring Central',
    '/#account', 'extra_request', 'extra:' || x.id);
  return jsonb_build_object('id', x.id, 'label', x.label, 'price', x.price);
end $$;
revoke all on function public.request_extra(uuid, text, int, text, numeric) from public, anon;
grant execute on function public.request_extra(uuid, text, int, text, numeric) to authenticated;

-- partner: withdraw an extra still waiting
create or replace function public.withdraw_extra(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.job_extras set status = 'withdrawn', decided_at = now() where id = p_id and partner_id = (select auth.uid()) and status = 'pending';
  if not found then raise exception 'not_possible'; end if;
end $$;
revoke all on function public.withdraw_extra(uuid) from public, anon;
grant execute on function public.withdraw_extra(uuid) to authenticated;

-- the booking's price and payout change only when an extra is paid
create or replace function private.extra_paid(x public.job_extras, p_ref text) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bookings; rate numeric;
begin
  select * into b from public.bookings where id = x.booking_id for update;
  rate := coalesce((b.details->'price'->>'rate')::numeric, 0.06);
  update public.job_extras set status = 'paid', paid_at = now(), paid_ref = left(coalesce(p_ref, ''), 100) where id = x.id;
  update public.bookings set price_total = coalesce(price_total, 0) + x.price,
    our_share = coalesce(our_share, 0) + round(x.price * rate, 2),
    partner_payout = coalesce(partner_payout, 0) + round(x.price * (1 - rate), 2)
  where id = b.id;
  perform private.mail((select email from public.partners where id = x.partner_id), 'partner', 'Extra approved and paid: ' || x.label,
    E'Hello,\n\nThe customer has approved and paid for an extra on job ' || upper(left(b.id::text, 8)) || ':\n' || x.label || ': £' || to_char(x.price, 'FM999990.00') ||
    E'\n\nIt is added to your payout for this job. You can carry on.\n\nThe Motoring Central', '/#dashboard', 'extra_paid', 'extrapaid:' || x.id);
end $$;
revoke all on function private.extra_paid(public.job_extras, text) from public;

-- partner: the customer signs on the partner's screen (they still pay through the site)
create or replace function public.sign_extra(p_id uuid, p_name text, p_sig text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x public.job_extras;
begin
  select * into x from public.job_extras where id = p_id and partner_id = (select auth.uid()) and status = 'pending' for update;
  if not found then raise exception 'not_possible'; end if;
  if char_length(btrim(coalesce(p_name,''))) < 2 then raise exception 'need_name'; end if;
  if coalesce(p_sig,'') !~ '^data:image/png;base64,' or char_length(p_sig) < 400 then raise exception 'need_signature'; end if;
  update public.job_extras set status = 'approved', method = 'signature', signer_name = left(btrim(p_name), 120), signature = p_sig, decided_at = now()
  where id = x.id returning * into x;
  perform private.mail(private.user_email(x.customer_id), 'customer', 'You approved an extra: please pay £' || to_char(x.price, 'FM999990.00'),
    'Hello ' || private.first_name((select name from public.profiles where id = x.customer_id)) || E',\n\nYou signed to approve this extra on your recovery:\n' ||
    x.label || ': £' || to_char(x.price, 'FM999990.00') || E'\nWhy: ' || x.reason || E'\nSigned by: ' || x.signer_name ||
    E'\n\nPlease pay it in My account. If you did not sign this, tell us straight away by replying to this email.\n\nThe Motoring Central',
    '/#account', 'extra_signed', 'extrasigned:' || x.id);
  return jsonb_build_object('id', x.id, 'status', x.status);
end $$;
revoke all on function public.sign_extra(uuid, text, text) from public, anon;
grant execute on function public.sign_extra(uuid, text, text) to authenticated;

-- customer: approve (with their name, and pay) or decline; or pay one they signed for
create or replace function public.decide_extra(p_id uuid, p_ok boolean, p_name text, p_paid text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x public.job_extras;
begin
  select * into x from public.job_extras where id = p_id and customer_id = (select auth.uid()) and status in ('pending','approved') for update;
  if not found then raise exception 'not_possible'; end if;
  if not p_ok then
    if x.status <> 'pending' then raise exception 'not_possible'; end if;
    update public.job_extras set status = 'declined', method = 'online', signer_name = left(btrim(coalesce(p_name,'')), 120), decided_at = now() where id = x.id;
    perform private.mail((select email from public.partners where id = x.partner_id), 'partner', 'Extra declined: ' || x.label,
      E'Hello,\n\nThe customer has said no to this extra:\n' || x.label || ': £' || to_char(x.price, 'FM999990.00') ||
      E'\n\nDo not carry out that part of the job or charge for it. Call the customer to agree what happens next, or call us.\n\nThe Motoring Central',
      '/#dashboard', 'extra_declined', 'extradec:' || x.id);
    return jsonb_build_object('status', 'declined');
  end if;
  if x.status = 'pending' then
    if char_length(btrim(coalesce(p_name,''))) < 2 then raise exception 'need_name'; end if;
    update public.job_extras set status = 'approved', method = 'online', signer_name = left(btrim(p_name), 120), decided_at = now() where id = x.id returning * into x;
  end if;
  if char_length(btrim(coalesce(p_paid,''))) < 3 then raise exception 'not_paid'; end if;
  perform private.extra_paid(x, p_paid);
  return jsonb_build_object('status', 'paid');
end $$;
revoke all on function public.decide_extra(uuid, boolean, text, text) from public, anon;
grant execute on function public.decide_extra(uuid, boolean, text, text) to authenticated;
