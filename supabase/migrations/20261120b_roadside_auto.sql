-- Automatic bookings for recovery and mobile EV charging partners, 20 Nov 2026
-- A partner sets their weekly hours once. During those hours they count as available for jobs needed now, without
-- pressing "Available", and customers can book a set time only inside those hours. "vans" is how many jobs they can
-- run at once and "mins" how long a job takes, so the roadside function never books more jobs than they have vans.
-- All stored in partners.details: week = 7 entries (Sunday first, UK time), each null (closed) or ["07:00","22:00"].
create or replace function public.set_roadside_auto(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.partners; w jsonb := '[]'::jsonb; i int; e jsonb; f text; t text; v int; m int;
begin
  select * into me from public.partners where id = (select auth.uid());
  if not found or me.role not in ('recovery','evcharge') then raise exception 'not_roadside'; end if;
  if jsonb_typeof(p->'week') <> 'array' or jsonb_array_length(p->'week') <> 7 then raise exception 'bad_week'; end if;
  for i in 0..6 loop
    e := p->'week'->i;
    if e is null or jsonb_typeof(e) = 'null' then w := w || 'null'::jsonb; continue; end if;
    f := e->>0; t := e->>1;
    if f !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or t !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' or f = t then raise exception 'bad_hours'; end if;
    w := w || jsonb_build_array(jsonb_build_array(f, t));
  end loop;
  v := greatest(1, least(50, coalesce((p->>'vans')::int, 1)));
  m := greatest(30, least(480, coalesce((p->>'mins')::int, case when me.role = 'evcharge' then 60 else 120 end)));
  update public.partners set details = coalesce(details,'{}'::jsonb)
    || jsonb_build_object('week', w, 'auto', coalesce((p->>'auto')::boolean, true), 'vans', v, 'mins', m)
    where id = me.id;
  return jsonb_build_object('week', w, 'auto', coalesce((p->>'auto')::boolean, true), 'vans', v, 'mins', m);
end $$;
revoke all on function public.set_roadside_auto(jsonb) from public, anon;
grant execute on function public.set_roadside_auto(jsonb) to authenticated;
