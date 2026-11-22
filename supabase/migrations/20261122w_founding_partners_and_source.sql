-- Founding partners and where each application came from (22 Nov 2026), ready for recruiting.
-- Founding partners: the first 10 partners approved in each trade (dealers have their own founding offer) get a
-- "Founding partner" badge and first place in customers' results until the date in app_settings.founding_top_until
-- (to be set to three months after launch; while it is not set, founding partners are first).
-- partners.founder_no / founder_at hold it (columns, not details, because the dashboard's settings sync rewrites details).
-- partners.source: the tag on the link or QR code the business arrived with (leaflet, advert, word of mouth).
alter table public.partners add column if not exists founder_no int;
alter table public.partners add column if not exists founder_at timestamptz;
alter table public.partners add column if not exists source text check (source is null or char_length(source) <= 60);

create or replace function private.trade_key(p_role text, p_sub text, p_details jsonb) returns text
language sql immutable set search_path = '' as $$
  select case when p_role = 'mechanic' and coalesce(p_details->>'motOnly', '') = 'true' then 'mot'
              when p_role = 'mechanic' then coalesce(nullif(p_sub, ''), 'mechanic') else p_role end $$;

create or replace function private.founding_top() returns boolean language sql stable security definer set search_path = '' as $$
  select current_date <= coalesce((select nullif(s.value #>> '{}', '')::date from public.app_settings s where s.key = 'founding_top_until'), date '2999-12-31') $$;

create or replace function private.partner_founding() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text; n int; mx int;
begin
  if new.role = 'dealer' or new.status <> 'approved' or coalesce(old.status, '') = 'approved' or new.founder_no is not null then return new; end if;
  k := private.trade_key(new.role, new.sub, new.details);
  perform pg_advisory_xact_lock(hashtext('mc_founder_' || k));
  select count(*), coalesce(max(p.founder_no), 0) into n, mx from public.partners p
    where p.id <> new.id and p.role <> 'dealer' and p.founder_no is not null and private.trade_key(p.role, p.sub, p.details) = k;
  if n < 10 then new.founder_no := mx + 1; new.founder_at := now(); end if;
  return new;
end $$;
drop trigger if exists partners_founder on public.partners;
create trigger partners_founder before update of status on public.partners for each row execute function private.partner_founding();

-- how many founding places are left in each trade (shown on the join pages)
create or replace function public.founding_places() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_object_agg(t.k, greatest(0, 10 - (select count(*) from public.partners p
           where p.role <> 'dealer' and p.founder_no is not null and private.trade_key(p.role, p.sub, p.details) = t.k)))
  from unnest(array['mot','garage','mobile','autoelec','valet','body','recovery','evcharge','tyres','instructor']) t(k) $$;
revoke all on function public.founding_places() from public;
grant execute on function public.founding_places() to anon, authenticated;

-- the public list of approved partners also says who is a founding partner, and whether they are still shown first
create or replace view public.partner_directory as
 select id, role, sub, name, town, rates,
    jsonb_build_object('svcs', details -> 'svcs', 'motOnly', details -> 'motOnly', 'aeWhere', details -> 'aeWhere', 'bays', details -> 'bays',
      'motBays', details -> 'motBays', 'radius', details -> 'radius', 'types', details -> 'types', 'plugs', details -> 'plugs', 'kit', details -> 'kit',
      'online', online_until is not null and online_until > now(),
      'founding', case when role <> 'dealer' then founder_no end,
      'ftop', role <> 'dealer' and founder_no is not null and current_date <= coalesce((select nullif(s.value #>> '{}', '')::date
                from public.app_settings s where s.key = 'founding_top_until'), date '2999-12-31')) as info
   from public.partners
  where status = 'approved';
revoke all on public.partner_directory from anon, authenticated;
grant select on public.partner_directory to anon, authenticated;

-- instructors in the learner's search carry the same two facts
do $$
declare d text := pg_get_functiondef('public.find_instructors(double precision, double precision, text, text)'::regprocedure);
begin
  if position('''founding''' in d) = 0 then
    d := replace(d, '''car'', q.inst->>''car''', '''founding'', q.founder_no, ''ftop'', (q.founder_no is not null and private.founding_top()), ''car'', q.inst->>''car''');
    d := replace(d, 'select p.id, p.name, p.town, p.rates, p.details, p.details->''inst'' inst,', 'select p.id, p.name, p.town, p.rates, p.details, p.founder_no, p.details->''inst'' inst,');
    if position('''founding''' in d) = 0 or position('p.founder_no' in d) = 0 then raise exception 'find_instructors: place not found'; end if;
    execute d;
  end if;
end $$;

-- a new partner account remembers the tag it arrived with
do $$
declare d text := pg_get_functiondef('public.handle_new_user'::regproc);
begin
  if position('source' in d) = 0 then
    d := replace(d, 'insert into public.partners (id, email, role, sub, name, phone, town, website, plan, rates, details, status)', 'insert into public.partners (id, email, role, sub, name, phone, town, website, plan, rates, details, status, source)');
    d := replace(d, E'case when m->>''stage'' = ''started'' then ''started'' else ''pending'' end\n    );', E'case when m->>''stage'' = ''started'' then ''started'' else ''pending'' end,\n      nullif(left(regexp_replace(coalesce(m->>''src'', ''''), ''[^A-Za-z0-9 _.:-]'', '''', ''g''), 60), '''')\n    );');
    if position('source)' in d) = 0 or position('m->>''src''' in d) = 0 then raise exception 'handle_new_user: place not found'; end if;
    execute d;
  end if;
end $$;
