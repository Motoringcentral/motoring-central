-- Staff only: list MOT test stations by postcode district.
-- Used to draw up lists of stations to invite in a launch area. The list
-- itself is the public DVSA register; it stays readable by staff only.
create or replace function public.staff_mot_stations(p_outcodes text[])
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
begin
  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  if p_outcodes is null or cardinality(p_outcodes) = 0 or cardinality(p_outcodes) > 400 then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_array(s.site_number, s.trading_name, s.address, s.town, s.postcode, s.phone,
             array_to_string(s.classes, ',')) order by s.postcode, s.trading_name)
    from public.mot_stations s
    where upper(split_part(trim(s.postcode), ' ', 1)) in (select upper(trim(x)) from unnest(p_outcodes) x)
  ), '[]'::jsonb);
end
$function$;

revoke all on function public.staff_mot_stations(text[]) from public, anon;
grant execute on function public.staff_mot_stations(text[]) to authenticated;
