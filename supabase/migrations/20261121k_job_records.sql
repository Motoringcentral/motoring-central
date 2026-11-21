-- Inspections, PDIs and service sheets saved against the booking (21 Nov 2026)
-- The partner's record (and its PDF, for inspections and PDIs) is kept on our system. The customer of that booking can
-- see and download it in My account; staff can see all of them.
create table if not exists public.job_records (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null default auth.uid() references public.partners(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  kind text not null check (kind in ('inspection','pdi','service')),
  job_ref text,
  reg text,
  summary jsonb not null default '{}'::jsonb,
  pdf_path text,
  created_at timestamptz not null default now()
);
create index if not exists job_records_booking on public.job_records(booking_id);
create index if not exists job_records_partner on public.job_records(partner_id, created_at desc);
alter table public.job_records enable row level security;

create or replace function private.my_booking_as_partner(p_booking uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_booking is null or exists (select 1 from public.bookings b where b.id = p_booking and b.partner_id = (select auth.uid()));
$$;
create or replace function private.my_booking_as_customer(p_booking uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bookings b where b.id = p_booking and b.customer_id = (select auth.uid()));
$$;
revoke all on function private.my_booking_as_partner(uuid) from public;
revoke all on function private.my_booking_as_customer(uuid) from public;
grant execute on function private.my_booking_as_partner(uuid) to authenticated;
grant execute on function private.my_booking_as_customer(uuid) to authenticated;

drop policy if exists "job records: partner adds own" on public.job_records;
create policy "job records: partner adds own" on public.job_records for insert to authenticated
  with check (partner_id = (select auth.uid()) and (select private.is_approved_partner()) and private.my_booking_as_partner(booking_id)
              and (pdf_path is null or (storage.foldername(pdf_path))[1] = (select auth.uid())::text));
drop policy if exists "job records: partner, the booking's customer, or staff" on public.job_records;
create policy "job records: partner, the booking's customer, or staff" on public.job_records for select to authenticated
  using (partner_id = (select auth.uid()) or (booking_id is not null and private.my_booking_as_customer(booking_id)) or (select private.is_staff()));
grant select, insert on public.job_records to authenticated;
revoke update, delete on public.job_records from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-records', 'job-records', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

create or replace function private.record_for_me(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.job_records r join public.bookings b on b.id = r.booking_id
                 where r.pdf_path = p_name and b.customer_id = (select auth.uid()));
$$;
revoke all on function private.record_for_me(text) from public;
grant execute on function private.record_for_me(text) to authenticated;

drop policy if exists "job records files: partner uploads own" on storage.objects;
create policy "job records files: partner uploads own" on storage.objects for insert to authenticated
  with check (bucket_id = 'job-records' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_approved_partner()));
drop policy if exists "job records files: partner, customer or staff read" on storage.objects;
create policy "job records files: partner, customer or staff read" on storage.objects for select to authenticated
  using (bucket_id = 'job-records' and ((storage.foldername(name))[1] = (select auth.uid())::text or private.record_for_me(name) or (select private.is_staff())));
