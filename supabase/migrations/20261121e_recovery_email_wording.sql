-- 21 Nov 2026: a recovery booking keeps the reason ("Will not start") in "service", so emails read
-- "Booking confirmed: Will not start". Name recovery bookings "Recovery" in the booking and message emails.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'mail_booking';
  if position('svc text := coalesce(nullif(new.service,''''), nullif(new.kind,''''), ''your booking'');' in d) > 0 then
    d := replace(d, 'svc text := coalesce(nullif(new.service,''''), nullif(new.kind,''''), ''your booking'');',
      'svc text := case when lower(coalesce(new.kind,'''')) = ''recovery'' then ''Recovery'' else coalesce(nullif(new.service,''''), nullif(new.kind,''''), ''your booking'') end;');
    execute d;
  end if;
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'mail_booking_message';
  if position('what := coalesce(nullif(b.service,''''), nullif(b.kind,''''), ''your'') || '' booking'';' in d) > 0 then
    d := replace(d, 'what := coalesce(nullif(b.service,''''), nullif(b.kind,''''), ''your'') || '' booking'';',
      'what := case when lower(coalesce(b.kind,'''')) = ''recovery'' then ''recovery'' else coalesce(nullif(b.service,''''), nullif(b.kind,''''), ''your'') end || '' booking'';');
    execute d;
  end if;
end $$;
