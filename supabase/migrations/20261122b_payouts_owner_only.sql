-- Building payouts and marking them paid is for the owner only (the screens already showed those buttons only to the
-- owner); reviewers can still see them. Tidier date in the payout email. (22 Nov 2026)

create or replace function public.staff_build_payouts(p_week date) returns int
language plpgsql security definer set search_path = '' as $$
declare wk date := p_week - ((extract(isodow from p_week)::int) - 1); r record; n int := 0; lj jsonb; sbj jsonb;
begin
  if not (select private.is_owner()) then raise exception 'not_owner'; end if;
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
create or replace function public.staff_set_payout(p_id uuid, p_status text, p_ref text) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.payouts; g public.partners;
begin
  if not (select private.is_owner()) then raise exception 'not_owner'; end if;
  if p_status not in ('due','paid','held') then raise exception 'bad_status'; end if;
  update public.payouts set status = p_status, paid_at = case when p_status = 'paid' then now() else null end,
    paid_ref = case when p_status = 'paid' then left(nullif(btrim(coalesce(p_ref,'')),''), 60) else null end
  where id = p_id returning * into p;
  if not found then raise exception 'not_found'; end if;
  if p_status = 'paid' then
    select * into g from public.partners where id = p.partner_id;
    perform private.mail(g.email, 'partner', 'Your payout for the week of ' || to_char(p.week_start, 'FMDD Mon YYYY') || ': £' || to_char(p.payout, 'FM999990.00'),
      E'Hello,\n\nWe have paid you £' || to_char(p.payout, 'FM999990.00') || ' for ' || p.jobs || ' job' || case when p.jobs = 1 then '' else 's' end ||
      ' in the week starting ' || to_char(p.week_start, 'FMDay FMDD FMMonth YYYY') || E'.\n\nSelf-billing invoice: ' || coalesce(p.invoice_no,'') ||
      coalesce(E'\nPayment reference: ' || p.paid_ref, '') ||
      E'\n\nYou can see and print the statement and invoice in your dashboard.\n\nThe Motoring Central',
      '/#dashboard', 'payout_paid', 'payout:' || p.id);
  end if;
end $$;
