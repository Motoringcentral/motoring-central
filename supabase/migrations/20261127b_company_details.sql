-- The company's legal details, kept in one place (27 Nov 2026).
-- app_settings 'company' holds {name, number, office, postal, ico, vat, updated_at}. Everyone can read it (the site
-- shows it in every footer, the terms, the privacy policy, About us, Contact us and the complaints page; emails and
-- self-billing invoices print it). Only an owner changes it, through owner_company_set, which tidies and checks it.
insert into public.app_settings(key, value) values ('company', '{}'::jsonb) on conflict (key) do nothing;

create or replace function public.owner_company_set(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c jsonb := '{}'::jsonb; k text; v text; n text; i text; t text;
begin
  if not (select private.is_owner()) then raise exception 'not_owner'; end if;
  foreach k in array array['name','number','office','postal','ico','vat'] loop
    v := regexp_replace(coalesce(p ->> k, ''), '[[:cntrl:]]+', ' ', 'g');
    v := btrim(regexp_replace(v, '\s{2,}', ' ', 'g'));
    c := c || jsonb_build_object(k, left(v, case when k in ('office','postal') then 300 else 160 end));
  end loop;
  -- company number: 8 digits, or 2 letters and 6 digits (for example SC123456)
  n := upper(replace(c ->> 'number', ' ', ''));
  if n ~ '^[0-9]{1,7}$' then n := lpad(n, 8, '0'); end if;
  if n <> '' and n !~ '^([0-9]{8}|[A-Z]{2}[0-9]{6})$' then raise exception 'bad_number'; end if;
  -- ICO registration number: Z and 7 more letters or digits (for example ZA123456)
  i := upper(replace(c ->> 'ico', ' ', ''));
  if i <> '' and i !~ '^Z[A-Z0-9][0-9]{6}$' then raise exception 'bad_ico'; end if;
  -- VAT number: GB and 9 digits (or 12 for a branch), shown as GB 123 4567 89
  t := upper(regexp_replace(c ->> 'vat', '[^A-Za-z0-9]', '', 'g'));
  if t <> '' then
    if t !~ '^(GB)?([0-9]{9}|[0-9]{12})$' then raise exception 'bad_vat'; end if;
    t := regexp_replace(t, '^GB', '');
    t := 'GB ' || substr(t, 1, 3) || ' ' || substr(t, 4, 4) || ' ' || substr(t, 8, 2) || case when length(t) = 12 then ' ' || substr(t, 10, 3) else '' end;
  end if;
  if (c ->> 'name') <> '' and char_length(c ->> 'name') < 3 then raise exception 'bad_name'; end if;
  c := c || jsonb_build_object('number', n, 'ico', i, 'vat', t, 'updated_at', now());
  update public.app_settings set value = c, updated_at = now() where key = 'company';
  return c;
end $$;
revoke all on function public.owner_company_set(jsonb) from public, anon;
grant execute on function public.owner_company_set(jsonb) to authenticated;
