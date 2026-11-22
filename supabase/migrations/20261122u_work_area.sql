-- Area and working days for MOT stations, garages, mobile mechanics, auto electricians, valeters, body shops and tyre
-- fitters (22 Nov 2026). Found in the full test: these partners were offered to every customer in the country, because
-- only recovery, EV charging and driving lessons were matched by distance.
-- partners.details.area = { post, lat, lng, radius (miles they travel for mobile work), week [[from,to]|null x 7, Sunday first] }
-- A customer's search calls partners_near(), which gives back only how far away each partner is: no addresses, no
-- co-ordinates. A partner with no area set is not offered until they set one.
create or replace function public.set_work_area(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); me public.partners; o jsonb; wk jsonb := '[]'::jsonb; x jsonb; k int; pc text;
begin
  select * into me from public.partners where id = uid and role in ('mechanic','valet','body','tyres');
  if not found then raise exception 'not_allowed'; end if;
  o := coalesce(me.details->'area', '{}'::jsonb);
  if (p->>'lat') is not null and (p->>'lng') is not null then
    if not ((p->>'lat')::float8 between 49 and 61 and (p->>'lng')::float8 between -9 and 2) then raise exception 'bad_place'; end if;
    pc := upper(left(btrim(coalesce(p->>'post', '')), 9));
    o := o || jsonb_build_object('lat', round((p->>'lat')::numeric, 5), 'lng', round((p->>'lng')::numeric, 5), 'post', pc);
  end if;
  if p ? 'radius' then o := o || jsonb_build_object('radius', least(100, greatest(1, coalesce((p->>'radius')::int, 10)))); end if;
  if jsonb_typeof(p->'week') = 'array' and jsonb_array_length(p->'week') = 7 then
    for k in 0 .. 6 loop x := p->'week'->k;
      if jsonb_typeof(x) = 'array' and private.hm(x->>0) is not null and private.hm(x->>1) is not null and private.hm(x->>0) < private.hm(x->>1)
        then wk := wk || jsonb_build_array(jsonb_build_array(x->>0, x->>1));
      else wk := wk || 'null'::jsonb; end if;
    end loop;
    o := o || jsonb_build_object('week', wk);
  end if;
  update public.partners set details = coalesce(details, '{}'::jsonb) || jsonb_build_object('area', o),
    town = case when pc is not null and pc <> '' and (coalesce(town, '') = '' or upper(town) ~ '^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$') then pc else town end
  where id = uid;
  return o;
end $$;
revoke all on function public.set_work_area(jsonb) from public, anon;
grant execute on function public.set_work_area(jsonb) to authenticated;

-- approved partners within reach of a place: only the id, the distance in miles, how far they travel and their days
create or replace function public.partners_near(p_lat double precision, p_lng double precision) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'miles', round(q.miles::numeric, 1), 'radius', coalesce((q.area->>'radius')::int, 10), 'week', q.area->'week')), '[]'::jsonb)
  from (select p.id, p.details->'area' area,
          3958.8 * 2 * asin(sqrt(power(sin(radians(((p.details->'area'->>'lat')::float8 - p_lat) / 2)), 2) +
            cos(radians(p_lat)) * cos(radians((p.details->'area'->>'lat')::float8)) * power(sin(radians(((p.details->'area'->>'lng')::float8 - p_lng) / 2)), 2))) * 1.2 miles
        from public.partners p
        where p.status = 'approved' and p.role in ('mechanic','valet','body','tyres') and (p.details->'area'->>'lat') is not null
          and p_lat between 49 and 61 and p_lng between -9 and 2) q
  where q.miles <= 100 $$;
revoke all on function public.partners_near(double precision, double precision) from public;
grant execute on function public.partners_near(double precision, double precision) to anon, authenticated;

-- the dashboard's general settings sync must never overwrite the area (it is saved by set_work_area)
create or replace function public.save_partner_settings(p_rates jsonb, p_details jsonb, p_plan text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.partners set
    rates = case when role = 'instructor' then rates when jsonb_typeof(p_rates) = 'object' then p_rates else rates end,
    details = case when jsonb_typeof(p_details) <> 'object' then details
                   when role = 'instructor' then (p_details - 'inst' - 'post' - 'radius' - 'area') ||
                     jsonb_strip_nulls(jsonb_build_object('inst', details->'inst', 'post', details->'post', 'radius', details->'radius'))
                   else (p_details - 'area') || jsonb_strip_nulls(jsonb_build_object('area', details->'area')) end,
    plan = case when role = 'dealer' then plan else coalesce(nullif(left(p_plan, 30), ''), plan) end
  where id = (select auth.uid());
end $$;
