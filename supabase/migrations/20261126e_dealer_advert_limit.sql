-- Dealer advert limit (26 Nov 2026)
-- A dealer may have at most as many adverts (live or waiting for approval) as their plan allows: Starter 10, Standard 20,
-- Plus 30, Pro 50, Premier no limit. Until now only the spreadsheet upload stopped at the limit; listing one car at a time
-- did not, and the database did not check. Sold cars still showing on the site count until the dealer takes them down.
-- The trigger is named so it runs before the other advert checks. Private sellers are not affected.

create or replace function private.dealer_advert_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pl text; n int; b record;
begin
  select plan into pl from public.partners where id = new.owner_id and role = 'dealer';
  if not found then return new; end if;
  select * into b from private.dealer_plan(case when coalesce(pl, '') ~ '^[0-4]$' then pl::int else 0 end);
  select count(*) into n from public.adverts where owner_id = new.owner_id and status in ('live', 'pending');
  if n >= b.max_adverts then
    raise exception 'your % plan allows % adverts and you have %. Take one down, or move to a bigger plan under Set-up, Plan and billing',
      b.name, b.max_adverts, n;
  end if;
  return new;
end $$;

drop trigger if exists adverts_a_plan_limit on public.adverts;
create trigger adverts_a_plan_limit before insert on public.adverts
  for each row execute function private.dealer_advert_limit();
