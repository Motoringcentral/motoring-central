-- Recovery: each truck has a maximum payload, and a vehicle is only matched to a truck that can carry it (22 Nov 2026).
-- 1. vehicle_specs: the kerb / gross weight found for a registration (paid look-up), kept so it is never paid for twice.
--    Only the roadside function (service role) reads and writes it.
-- 2. set_recovery_setup keeps a "payload" (kg) on every truck, with a sensible figure when none is given.
create table if not exists public.vehicle_specs (
  reg text primary key check (reg ~ '^[A-Z0-9]{2,8}$'),
  kerb_kg int, gross_kg int, make text, model text, found text, source text not null default 'vdg',
  fetched_at timestamptz not null default now()
);
alter table public.vehicle_specs enable row level security;
revoke all on public.vehicle_specs from anon, authenticated;

do $$
declare d text := pg_get_functiondef('public.set_recovery_setup'::regproc);
begin
  if position('''payload''' in d) = 0 then
    if position('''incl'', greatest(0, least(200, coalesce((x->>''incl'')::int, 0)))));' in d) = 0 then raise exception 'set_recovery_setup: truck fields not found'; end if;
    d := replace(d, '''incl'', greatest(0, least(200, coalesce((x->>''incl'')::int, 0)))));',
      '''incl'', greatest(0, least(200, coalesce((x->>''incl'')::int, 0))),' || E'\n      ' ||
      '''payload'', greatest(100, least(60000, coalesce(nullif((x->>''payload'')::int, 0), case x->>''type'' when ''trailer'' then 2000 when ''beaver'' then 1300 when ''spec'' then 2000 when ''slide75'' then 3000 when ''heavy'' then 18000 when ''transporter'' then 1700 else 400 end)))));');
    execute d;
  end if;
end $$;
-- trucks already saved get the starting figure for their type
update public.partners p set details = jsonb_set(details, '{trucks}', (
  select jsonb_agg(case when t ? 'payload' then t else t || jsonb_build_object('payload',
    case t->>'type' when 'trailer' then 2000 when 'beaver' then 1300 when 'spec' then 2000 when 'slide75' then 3000 when 'heavy' then 18000 when 'transporter' then 1700 else 400 end) end)
  from jsonb_array_elements(details->'trucks') t))
where role = 'recovery' and jsonb_typeof(details->'trucks') = 'array' and jsonb_array_length(details->'trucks') > 0;
