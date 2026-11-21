-- 21 Nov 2026 (owner's decision): in a dealer's free first 3 months (92 days from joining, as in the vehicle-history
-- function), history checks are not included. The dealer may pay for one (£3.50 + VAT) or list without one. An advert
-- without a check carries data.nochk = true, is flagged for our team, and is shown to buyers as "Not history checked"
-- (they still see the DVSA MOT history and the mileage recorded at each test). Everyone else still needs a check.
create or replace function private.check_advert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.vehicle_checks%rowtype; r text; trial boolean;
begin
  if tg_op = 'INSERT' then
    r := upper(regexp_replace(coalesce(new.data->>'reg', ''), '[^A-Za-z0-9]', '', 'g'));
    new.data := new.data - 'nochk';
    if new.check_id is null then
      select exists (select 1 from public.partners p where p.id = new.owner_id and p.role = 'dealer' and p.status = 'approved'
                     and p.created_at > now() - interval '92 days') into trial;
      if not coalesce(trial, false) or coalesce(new.data->>'private', '') = 'true' then
        raise exception 'A vehicle history check is needed before listing'; end if;
      if length(r) < 2 then raise exception 'Enter the registration'; end if;
      if coalesce(new.data->>'wo', '') = '' then raise exception 'Tell us if it has ever been an insurance write-off'; end if;
      if coalesce(new.data->>'wo', '') in ('A','B','AB') then raise exception 'Category A and B write-offs cannot be listed'; end if;
      new.data := jsonb_set(jsonb_set(new.data, '{reg}', to_jsonb(r)), '{nochk}', 'true'::jsonb);
    else
      select * into c from public.vehicle_checks where id = new.check_id;
      if not found or c.owner_id <> new.owner_id then raise exception 'A vehicle history check is needed before listing'; end if;
      if c.created_at < now() - interval '7 days' then raise exception 'The history check is more than 7 days old. Please check the vehicle again'; end if;
      if r <> c.reg then raise exception 'The history check is for a different registration'; end if;
      if c.kind <> new.kind then raise exception 'The history check is for a different type of vehicle'; end if;
      if coalesce(c.summary->'stolen'->>'found', '') = 'true' or coalesce(c.summary->>'scrapped', '') = 'true' then
        raise exception 'This vehicle cannot be listed'; end if;
      if coalesce(c.summary->'writeoff'->>'cat', '') in ('A','B') or coalesce(new.data->>'wo', '') in ('A','B','AB') then
        raise exception 'Category A and B write-offs cannot be listed'; end if;
      if coalesce(new.data->>'private', '') = 'true' and coalesce(c.summary->'finance'->>'found', '') = 'true' then
        raise exception 'Outstanding finance must be cleared before a private sale'; end if;
      new.data := jsonb_set(new.data, '{reg}', to_jsonb(r));
    end if;
  else
    if coalesce(old.data->>'wo', '') in ('S','N','C','D','yes') then new.data := jsonb_set(new.data, '{wo}', old.data->'wo'); end if;
    new.data := jsonb_set(new.data, '{reg}', coalesce(old.data->'reg', 'null'::jsonb));
    -- whether an advert was listed without a check is fixed when it is created
    new.data := new.data - 'nochk';
    if old.data ? 'nochk' then new.data := jsonb_set(new.data, '{nochk}', old.data->'nochk'); end if;
  end if;
  new.data := new.data - 'chk';
  return new;
end $$;

-- our team sees adverts listed without a check (they are not approved automatically)
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'advert_flags';
  if position('No history check' in d) = 0 then
    d := replace(d, '  if coalesce(s->''finance''->>''found'','''') = ''true'' then',
      '  if coalesce(d->>''nochk'','''') = ''true'' then f := array_append(f, ''No history check (dealer''''s free months)''); end if;' || chr(10) ||
      '  if coalesce(s->''finance''->>''found'','''') = ''true'' then');
    execute d;
  end if;
end $$;
