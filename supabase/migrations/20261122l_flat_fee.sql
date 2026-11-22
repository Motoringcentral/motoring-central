-- Flat fee for all partners (22 Nov 2026): the Pro membership is gone. Every job: our fee 10% + VAT (12% of the
-- partner's price) and the customer pays a booking fee of £9.99 including VAT (£8.33 + VAT). MOT pricing unchanged.
-- Bookings already made keep the fee they were made with (roadside bookings store their rate).
do $$
declare f text; d text;
begin
  foreach f in array array['public.accept_quote(uuid,date,text)','public.book_priced(text,uuid,jsonb,text,jsonb,date)',
                           'public.cancel_roadside(uuid,text)','private.extra_paid(public.job_extras,text)'] loop
    d := pg_get_functiondef(f::regprocedure);
    d := replace(d, 'fee numeric := 3;', 'fee numeric := 9.99;');
    d := replace(d, 'rate := case when g.plan = ''pro'' then 0 else 0.06 end;', 'rate := 0.12;');
    d := replace(d, ' plus £3.00 booking fee. ', ' plus £9.99 booking fee. ');
    d := replace(d, '0.06)', '0.12)');
    if d ~ '(0\.06|:= 3;|£3\.00|''pro'')' then raise exception 'not all replaced in %', f; end if;
    execute d;
  end loop;
end $$;
update public.partners set plan = 'payg' where plan = 'pro';
update public.partners set details = details - 'proActive' where details ? 'proActive';
