-- Weekly payouts and self-billing invoices (21 Nov 2026)
-- Each week (Monday to Sunday, by the job date) staff build one payout per partner from the paid bookings; the payout
-- has a self-billing invoice number. Partners accept a self-billing agreement and give their VAT number if they have one.
-- Real money moves once Stripe is live; until then staff mark a payout as paid after paying it by bank transfer.

alter table public.partners add column if not exists self_billing jsonb;  -- {agreed_at, vat_number, ends}
grant select (self_billing) on public.partners to authenticated;

create sequence if not exists private.selfbill_seq start 1;

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  week_start date not null,
  jobs int not null default 0,
  customer_paid numeric(10,2) not null default 0,
  our_fees numeric(10,2) not null default 0,
  payout numeric(10,2) not null default 0,
  lines jsonb not null default '[]'::jsonb,
  invoice_no text unique,
  vat_number text,
  sb_agreed boolean not null default false,
  status text not null default 'due' check (status in ('due','paid','held')),
  paid_at timestamptz,
  paid_ref text,
  created_at timestamptz not null default now(),
  unique (partner_id, week_start)
);
alter table public.payouts enable row level security;
drop policy if exists "payouts: own, or all for staff" on public.payouts;
create policy "payouts: own, or all for staff" on public.payouts for select to authenticated
  using (partner_id = (select auth.uid()) or (select private.is_staff()));
revoke insert, update, delete on public.payouts from anon, authenticated;
grant select on public.payouts to authenticated;

-- the jobs that count for a partner's week
create or replace function private.week_lines(p_partner uuid, p_week date)
returns table (booking_id uuid, job_day date, kind text, service text, vehicle text, customer_paid numeric, our_fee numeric, payout numeric, status text)
language sql stable security definer set search_path = '' as $$
  select b.id, coalesce(b.slot_day, (b.made_at at time zone 'Europe/London')::date), b.kind, coalesce(nullif(b.service,''), b.kind),
         upper(coalesce(b.vehicle->>'reg','')), coalesce(b.price_total,0), coalesce(b.our_share,0), coalesce(b.partner_payout,0), b.status
  from public.bookings b
  where b.partner_id = p_partner and b.partner_payout is not null
    and coalesce(b.slot_day, (b.made_at at time zone 'Europe/London')::date) between p_week and p_week + 6
    and (b.status <> 'cancelled' or (upper(coalesce(b.kind,'')) <> 'MOT' and b.partner_payout > 0))
  order by 2, b.made_at;
$$;

-- partner: their own week, before or after staff build it
create or replace function public.my_week(p_week date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare wk date := p_week - ((extract(isodow from p_week)::int) - 1);
begin
  if not exists (select 1 from public.partners where id = (select auth.uid())) then raise exception 'not_partner'; end if;
  return jsonb_build_object('week', wk,
    'lines', coalesce((select jsonb_agg(to_jsonb(l)) from private.week_lines((select auth.uid()), wk) l), '[]'::jsonb),
    'payout', (select to_jsonb(p) from public.payouts p where p.partner_id = (select auth.uid()) and p.week_start = wk));
end $$;
revoke all on function public.my_week(date) from public, anon;
grant execute on function public.my_week(date) to authenticated;

-- partner: accept the self-billing agreement (and VAT number, if VAT registered)
create or replace function public.set_self_billing(p_agree boolean, p_vat text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v text := upper(regexp_replace(coalesce(p_vat,''), '\s', '', 'g')); sbj jsonb;
begin
  if not exists (select 1 from public.partners where id = (select auth.uid())) then raise exception 'not_partner'; end if;
  if v <> '' and v !~ '^(GB)?([0-9]{9}|[0-9]{12})$' then raise exception 'bad_vat'; end if;
  if v <> '' and v !~ '^GB' then v := 'GB' || v; end if;
  sbj := case when p_agree then jsonb_build_object('agreed_at', now(), 'vat_number', nullif(v,''), 'ends', (now() + interval '1 year')::date) else null end;
  update public.partners set self_billing = sbj where id = (select auth.uid());
  return coalesce(sbj, '{}'::jsonb);
end $$;
revoke all on function public.set_self_billing(boolean, text) from public, anon;
grant execute on function public.set_self_billing(boolean, text) to authenticated;

-- staff: build (or rebuild, while still due) the payouts for a week
create or replace function public.staff_build_payouts(p_week date) returns int
language plpgsql security definer set search_path = '' as $$
declare wk date := p_week - ((extract(isodow from p_week)::int) - 1); r record; n int := 0; lj jsonb; sbj jsonb;
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  if wk + 6 >= (now() at time zone 'Europe/London')::date then raise exception 'week_not_finished'; end if;
  for r in select distinct b.partner_id from public.bookings b
           where b.partner_id is not null and b.partner_payout is not null
             and coalesce(b.slot_day, (b.made_at at time zone 'Europe/London')::date) between wk and wk + 6 loop
    select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) into lj from private.week_lines(r.partner_id, wk) l;
    if jsonb_array_length(lj) = 0 then continue; end if;
    select self_billing into sbj from public.partners where id = r.partner_id;
    if exists (select 1 from public.payouts where partner_id = r.partner_id and week_start = wk) then
      update public.payouts set jobs = jsonb_array_length(lj),
        customer_paid = (select coalesce(sum((x->>'customer_paid')::numeric),0) from jsonb_array_elements(lj) x),
        our_fees = (select coalesce(sum((x->>'our_fee')::numeric),0) from jsonb_array_elements(lj) x),
        payout = (select coalesce(sum((x->>'payout')::numeric),0) from jsonb_array_elements(lj) x),
        lines = lj, vat_number = sbj->>'vat_number', sb_agreed = sbj is not null
      where partner_id = r.partner_id and week_start = wk and status = 'due';
    else
      insert into public.payouts (partner_id, week_start, jobs, customer_paid, our_fees, payout, lines, invoice_no, vat_number, sb_agreed)
      select r.partner_id, wk, jsonb_array_length(lj),
             (select coalesce(sum((x->>'customer_paid')::numeric),0) from jsonb_array_elements(lj) x),
             (select coalesce(sum((x->>'our_fee')::numeric),0) from jsonb_array_elements(lj) x),
             (select coalesce(sum((x->>'payout')::numeric),0) from jsonb_array_elements(lj) x),
             lj, 'SB-' || to_char(wk, 'IYYY') || '-' || lpad(nextval('private.selfbill_seq')::text, 5, '0'), sbj->>'vat_number', sbj is not null;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.staff_build_payouts(date) from public, anon;
grant execute on function public.staff_build_payouts(date) to authenticated;

-- staff: list a week's payouts with partner details
create or replace function public.staff_payouts(p_week date) returns table (id uuid, partner_id uuid, partner_name text, partner_email text,
  role text, week_start date, jobs int, customer_paid numeric, our_fees numeric, payout numeric, invoice_no text, vat_number text,
  status text, paid_at timestamptz, paid_ref text, self_billing boolean)
language plpgsql stable security definer set search_path = '' as $$
declare wk date := p_week - ((extract(isodow from p_week)::int) - 1);
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  return query select p.id, p.partner_id, g.name, g.email, g.role, p.week_start, p.jobs, p.customer_paid, p.our_fees, p.payout,
    p.invoice_no, p.vat_number, p.status, p.paid_at, p.paid_ref, p.sb_agreed
  from public.payouts p join public.partners g on g.id = p.partner_id where p.week_start = wk order by g.name;
end $$;
revoke all on function public.staff_payouts(date) from public, anon;
grant execute on function public.staff_payouts(date) to authenticated;

-- staff: mark paid (or hold) and tell the partner
create or replace function public.staff_set_payout(p_id uuid, p_status text, p_ref text) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.payouts; g public.partners;
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  if p_status not in ('due','paid','held') then raise exception 'bad_status'; end if;
  update public.payouts set status = p_status, paid_at = case when p_status = 'paid' then now() else null end,
    paid_ref = case when p_status = 'paid' then left(nullif(btrim(coalesce(p_ref,'')),''), 60) else null end
  where id = p_id returning * into p;
  if not found then raise exception 'not_found'; end if;
  if p_status = 'paid' then
    select * into g from public.partners where id = p.partner_id;
    perform private.mail(g.email, 'partner', 'Your payout for the week of ' || to_char(p.week_start, 'FMDD Mon YYYY') || ': £' || to_char(p.payout, 'FM999990.00'),
      E'Hello,\n\nWe have paid you £' || to_char(p.payout, 'FM999990.00') || ' for ' || p.jobs || ' job' || case when p.jobs = 1 then '' else 's' end ||
      ' in the week starting ' || to_char(p.week_start, 'FMDay DD Month YYYY') || E'.\n\nSelf-billing invoice: ' || coalesce(p.invoice_no,'') ||
      coalesce(E'\nPayment reference: ' || p.paid_ref, '') ||
      E'\n\nYou can see and print the statement and invoice in your dashboard.\n\nThe Motoring Central',
      '/#dashboard', 'payout_paid', 'payout:' || p.id);
  end if;
end $$;
revoke all on function public.staff_set_payout(uuid, text, text) from public, anon;
grant execute on function public.staff_set_payout(uuid, text, text) to authenticated;
