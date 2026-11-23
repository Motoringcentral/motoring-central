-- The demo is handed out by the server (23 Nov 2026)
-- Until now the demo's sample businesses and guide were a file on the website (js/demo.js), and the check that a
-- visitor had a personal link was made in the browser, so anyone technical could open the demo without being sent it.
-- Now the content lives here, in private.demo_kit, and public.demo_kit gives it only to a link that is right and has
-- not ended, and only the part for that link's trade (a staff link gets every trade). The check is made on every page
-- load, so a link that is stopped stops working straight away.

create table if not exists private.demo_kit (
  pos int primary key,
  part text not null unique,
  trade text check (trade in ('mot','valet','instructor','body','autoelec','dealer','recovery','evcharge')),
  body text not null,
  updated_at timestamptz not null default now()
);
revoke all on private.demo_kit from public, anon, authenticated;

-- a one-time key that lets tools/demo-kit.js read and replace the kit. Empty, so normally nothing can.
create table if not exists private.demo_kit_key (
  hash text primary key,
  ends_at timestamptz not null
);
revoke all on private.demo_kit_key from public, anon, authenticated;

create or replace function private.demo_kit_key_ok(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select char_length(coalesce(p_key, '')) >= 32 and exists (
    select 1 from private.demo_kit_key k
    where k.hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex') and k.ends_at > now() and k.ends_at < now() + interval '1 hour')
$$;

create or replace function public.demo_kit_get(p_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.demo_kit_key_ok(p_key) then raise exception 'no_key'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('pos', k.pos, 'part', k.part, 'trade', k.trade, 'body', k.body) order by k.pos), '[]'::jsonb)
          from private.demo_kit k);
end $$;
revoke all on function public.demo_kit_get(text) from public;
grant execute on function public.demo_kit_get(text) to anon, authenticated;

-- replaces the whole kit in one go
create or replace function public.demo_kit_put(p_key text, p_parts jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int; t int;
begin
  if not private.demo_kit_key_ok(p_key) then raise exception 'no_key'; end if;
  if jsonb_typeof(p_parts) <> 'array' or jsonb_array_length(p_parts) < 9 then raise exception 'bad_kit'; end if;
  delete from private.demo_kit where true;
  insert into private.demo_kit (pos, part, trade, body)
  select (x->>'pos')::int, x->>'part', nullif(x->>'trade', ''), x->>'body' from jsonb_array_elements(p_parts) x;
  select count(*), count(trade) into n, t from private.demo_kit;
  if t <> 8 then raise exception 'bad_kit'; end if;
  return jsonb_build_object('parts', n, 'trades', t, 'characters', (select sum(char_length(body)) from private.demo_kit));
end $$;
revoke all on function public.demo_kit_put(text, jsonb) from public;
grant execute on function public.demo_kit_put(text, jsonb) to anon, authenticated;

-- a visitor with a personal link: check it, and hand over the demo for its trade.
-- p_resume true: the page is carrying on a demo it already opened (a reload), so the visit is not counted again.
create or replace function public.demo_kit(p_code text, p_resume boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c text := lower(btrim(coalesce(p_code,''))); r public.demo_requests; kit text;
begin
  if c !~ '^[a-f0-9]{12}$' then raise exception 'bad_link'; end if;
  select * into r from public.demo_requests where code = c;
  if not found then raise exception 'bad_link'; end if;
  if r.ends_at is null or r.ends_at < now() then return jsonb_build_object('ended', true, 'trade', r.trade); end if;
  select string_agg(k.body, E'\n' order by k.pos) into kit from private.demo_kit k
    where k.trade is null or r.trade = 'all' or k.trade = r.trade;
  if kit is null or not exists (select 1 from private.demo_kit k where r.trade = 'all' or k.trade = r.trade) then raise exception 'no_kit'; end if;
  if not coalesce(p_resume, false) and not coalesce((select private.is_staff()), false) then
    update public.demo_requests set opens = opens + 1, opened_at = coalesce(opened_at, now()), last_open_at = now() where id = r.id;
  end if;
  return jsonb_build_object('trade', r.trade, 'name', private.first_name(r.name), 'ends_at', r.ends_at, 'kit', kit);
end $$;
revoke all on function public.demo_kit(text, boolean) from public;
grant execute on function public.demo_kit(text, boolean) to anon, authenticated;

-- the earlier check, which answered without handing anything over, is no longer used
drop function if exists public.demo_open(text);
