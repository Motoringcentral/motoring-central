-- Dealer sales: stock book storage and sales invoices (22 Nov 2026)
-- 1. The stock book was kept inside the partner's settings, which stop saving (silently) above about 30 KB, so a
--    dealer with a full stock book could lose changes. It now has its own row with room for hundreds of vehicles.
-- 2. Sales invoices: one record per sale. A deposit makes it a deposit receipt; once paid in full the dealer
--    finalises it as the sales invoice. Numbers run in order for each dealer and are never reused; a finalised or
--    cancelled invoice cannot be edited or deleted (it can only be cancelled).

create table if not exists public.dealer_books (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  stock jsonb not null default '[]'::jsonb check (jsonb_typeof(stock) = 'array' and pg_column_size(stock) <= 800000),
  updated_at timestamptz not null default now()
);
alter table public.dealer_books enable row level security;
drop policy if exists "dealer books: own, staff read" on public.dealer_books;
create policy "dealer books: own, staff read" on public.dealer_books for select to authenticated
  using (partner_id = (select auth.uid()) or (select private.is_staff()));
drop policy if exists "dealer books: add own" on public.dealer_books;
create policy "dealer books: add own" on public.dealer_books for insert to authenticated
  with check (partner_id = (select auth.uid()) and exists (select 1 from public.partners p where p.id = (select auth.uid()) and p.role = 'dealer'));
drop policy if exists "dealer books: change own" on public.dealer_books;
create policy "dealer books: change own" on public.dealer_books for update to authenticated
  using (partner_id = (select auth.uid())) with check (partner_id = (select auth.uid()));
revoke all on public.dealer_books from anon;
grant select, insert, update on public.dealer_books to authenticated;

-- existing stock books move across
insert into public.dealer_books (partner_id, stock)
  select id, details->'stock' from public.partners where role = 'dealer' and jsonb_typeof(details->'stock') = 'array'
  on conflict (partner_id) do nothing;

create table if not exists public.dealer_invoices (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null default auth.uid() references public.partners(id) on delete cascade,
  seq int,
  number text,
  status text not null default 'draft' check (status in ('draft','deposit','paid','cancelled')),
  stock_id bigint,
  advert_id bigint,
  vehicle jsonb not null default '{}'::jsonb,
  customer jsonb not null default '{}'::jsonb,
  seller jsonb not null default '{}'::jsonb,
  lines jsonb not null default '[]'::jsonb,
  payments jsonb not null default '[]'::jsonb,
  notes text check (char_length(notes) <= 2000),
  total numeric(12,2) not null default 0,
  paid numeric(12,2) not null default 0,
  sale_date date,
  finalised_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text check (char_length(cancel_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, seq),
  check (pg_column_size(lines) <= 20000 and pg_column_size(payments) <= 20000 and pg_column_size(vehicle) <= 4000
         and pg_column_size(customer) <= 4000 and pg_column_size(seller) <= 6000)
);
create index if not exists dealer_invoices_partner on public.dealer_invoices (partner_id, created_at desc);
alter table public.dealer_invoices enable row level security;
drop policy if exists "dealer invoices: own, staff read" on public.dealer_invoices;
create policy "dealer invoices: own, staff read" on public.dealer_invoices for select to authenticated
  using (partner_id = (select auth.uid()) or (select private.is_staff()));
drop policy if exists "dealer invoices: add own" on public.dealer_invoices;
create policy "dealer invoices: add own" on public.dealer_invoices for insert to authenticated
  with check (partner_id = (select auth.uid())
    and exists (select 1 from public.partners p where p.id = (select auth.uid()) and p.role = 'dealer' and p.status = 'approved'));
drop policy if exists "dealer invoices: change own" on public.dealer_invoices;
create policy "dealer invoices: change own" on public.dealer_invoices for update to authenticated
  using (partner_id = (select auth.uid())) with check (partner_id = (select auth.uid()));
revoke all on public.dealer_invoices from anon;
grant select, insert, update on public.dealer_invoices to authenticated;

create or replace function private.dealer_invoice_fill() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t numeric := 0; p numeric := 0;
begin
  if tg_op = 'INSERT' then
    new.partner_id := (select auth.uid());
    perform pg_advisory_xact_lock(hashtext('mc_inv_' || new.partner_id::text));
    select coalesce(max(seq), 0) + 1 into new.seq from public.dealer_invoices where partner_id = new.partner_id;
    new.number := 'INV-' || lpad(new.seq::text, 4, '0');
    new.created_at := now(); new.finalised_at := null; new.cancelled_at := null;
    if new.status not in ('draft','deposit') then new.status := 'draft'; end if;
  else
    new.partner_id := old.partner_id; new.seq := old.seq; new.number := old.number; new.created_at := old.created_at;
    if old.status = 'cancelled' then raise exception 'This invoice was cancelled and cannot be changed'; end if;
    if old.status = 'paid' then
      -- a finalised invoice can only be cancelled
      if new.status <> 'cancelled' then raise exception 'This invoice is final. Cancel it and raise a new one to change it'; end if;
      new.lines := old.lines; new.payments := old.payments; new.vehicle := old.vehicle; new.customer := old.customer;
      new.seller := old.seller; new.total := old.total; new.paid := old.paid; new.finalised_at := old.finalised_at; new.sale_date := old.sale_date;
    end if;
  end if;
  if jsonb_typeof(new.lines) <> 'array' or jsonb_typeof(new.payments) <> 'array' then raise exception 'bad_invoice'; end if;
  if tg_op = 'INSERT' or old.status <> 'paid' then
    select coalesce(sum(round((x->>'amount')::numeric, 2)), 0) into t from jsonb_array_elements(new.lines) x;
    select coalesce(sum(round((x->>'amount')::numeric, 2)), 0) into p from jsonb_array_elements(new.payments) x;
    new.total := t; new.paid := p;
  end if;
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status <> 'paid') then
    if new.total <= 0 then raise exception 'Add the vehicle price before finalising'; end if;
    if new.paid < new.total then raise exception 'The invoice is not paid in full yet'; end if;
    new.finalised_at := now(); new.sale_date := coalesce(new.sale_date, (now() at time zone 'Europe/London')::date);
  elsif new.status in ('draft','deposit') then
    new.status := case when new.paid > 0 then 'deposit' else 'draft' end;
  end if;
  if new.status = 'cancelled' and (tg_op = 'INSERT' or old.status <> 'cancelled') then new.cancelled_at := now(); end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists dealer_invoice_fill on public.dealer_invoices;
create trigger dealer_invoice_fill before insert or update on public.dealer_invoices
  for each row execute function private.dealer_invoice_fill();
