-- The dashboard's general settings sync replaces rates and details wholesale. An instructor's prices, packages,
-- availability, area and profile are saved by set_instructor_setup, so the general sync must never overwrite them
-- with the older copy the browser loaded at sign-in.
create or replace function public.save_partner_settings(p_rates jsonb, p_details jsonb, p_plan text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.partners set
    rates = case when role = 'instructor' then rates when jsonb_typeof(p_rates) = 'object' then p_rates else rates end,
    details = case when jsonb_typeof(p_details) <> 'object' then details
                   when role = 'instructor' then (p_details - 'inst' - 'post' - 'radius') ||
                     jsonb_strip_nulls(jsonb_build_object('inst', details->'inst', 'post', details->'post', 'radius', details->'radius'))
                   else p_details end,
    plan = case when role = 'dealer' then plan else coalesce(nullif(left(p_plan, 30), ''), plan) end
  where id = (select auth.uid());
end $$;
