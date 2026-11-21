-- Bodywork quote requests go to the approved repairers the customer picks, with the damage photos (21 Nov 2026)
-- Photos: private bucket "job-photos". The customer uploads into their own folder; a partner can open a photo only
-- when it belongs to a booking sent to them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

drop policy if exists "job photos: customer uploads own" on storage.objects;
create policy "job photos: customer uploads own" on storage.objects for insert to authenticated
  with check (bucket_id = 'job-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "job photos: customer reads own" on storage.objects;
create policy "job photos: customer reads own" on storage.objects for select to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function private.photo_for_partner(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bookings b
    where b.partner_id = (select auth.uid()) and b.details -> 'photos' ? p_name);
$$;
revoke all on function private.photo_for_partner(text) from public;
grant execute on function private.photo_for_partner(text) to authenticated;

drop policy if exists "job photos: partner reads photos sent to them" on storage.objects;
create policy "job photos: partner reads photos sent to them" on storage.objects for select to authenticated
  using (bucket_id = 'job-photos' and private.photo_for_partner(name));

-- emails: a quote request is not a booking
create or replace function private.mail_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
declare g public.partners; cem text := private.user_email(new.customer_id);
  ref text := upper(left(new.id::text, 8)); svc text := case when lower(coalesce(new.kind,'')) = 'recovery' then 'Recovery' else coalesce(nullif(new.service,''), nullif(new.kind,''), 'your booking') end;
  veh text := coalesce(nullif(upper(new.vehicle->>'reg'),''), 'your vehicle');
  hi text := 'Hello ' || private.first_name(new.customer_name) || E',\n\n';
begin
  if upper(coalesce(new.kind,'')) = 'MOT' then return new; end if;
  select * into g from public.partners where id = new.partner_id;
  if tg_op = 'INSERT' and new.kind = 'Bodywork quote' then
    if g.email is not null then
      perform private.mail(g.email, 'partner', 'New quote request: ' || svc || ', ' || veh,
        E'Hello,\n\nA customer has asked you for a bodywork quote through The Motoring Central.\n\n' || coalesce(new.summary,'') ||
        E'\n\nCustomer: ' || coalesce(new.customer_name,'') || coalesce(', ' || nullif(new.customer_phone,''), '') ||
        E'\nReference: ' || ref ||
        E'\n\nOpen your dashboard to see the photos and contact the customer with your fixed price.\n\nThe Motoring Central',
        '/#dashboard', 'quote_request_partner', null, new.id);
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' and new.kind = 'Bodywork quotes' then
    perform private.mail(cem, 'customer', 'Quote request sent: ' || svc,
      hi || coalesce(new.summary,'') || E'\n\nThe repairers will contact you with fixed prices, usually within 24 hours. Nothing is booked until you accept a price.\nReference: ' || ref || E'\n\nThe Motoring Central',
      '/#account', 'quote_request_customer', null, new.id);
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform private.mail(cem, 'customer', 'Booking confirmed: ' || svc,
      hi || E'Thank you for booking with The Motoring Central.\n\n' || coalesce(new.summary,'') ||
      coalesce(E'\n\nYour partner: ' || nullif(g.name,'') || coalesce(', ' || nullif(g.phone,''), ''), '') ||
      E'\nBooking reference: ' || ref ||
      E'\n\nYou can follow the job in your account: we update it when your partner is on the way, starts and finishes.\n\nThe Motoring Central',
      '/#account', 'booking_customer', null, new.id);
    if g.email is not null then
      perform private.mail(g.email, 'partner', 'New job booked: ' || svc || ', ' || veh,
        E'Hello,\n\nA customer has booked you through The Motoring Central.\n\n' || coalesce(new.summary,'') ||
        E'\n\nCustomer: ' || coalesce(new.customer_name,'') || coalesce(', ' || nullif(new.customer_phone,''), '') ||
        E'\nReference: ' || ref ||
        E'\n\nOpen your dashboard to see the job and update the customer (on the way, started, completed).\n\nThe Motoring Central',
        '/#dashboard', 'booking_partner', null, new.id);
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'onway' then
      perform private.mail(cem, 'customer', coalesce(nullif(g.name,''),'Your partner') || ' is on the way',
        hi || coalesce(nullif(g.name,''),'Your partner') || ' is on the way for your ' || svc || ' (' || veh || ').' ||
        coalesce(E'\nTheir phone: ' || nullif(g.phone,''), '') || E'\nReference: ' || ref || E'\n\nThe Motoring Central',
        '/#account', 'booking_onway', null, new.id);
    elsif new.status = 'done' then
      perform private.mail(cem, 'customer', 'Job completed: ' || svc,
        hi || coalesce(nullif(g.name,''),'Your partner') || ' has marked your ' || svc || ' (' || veh || E') as completed.\n\n' ||
        E'How did it go? Leaving a review takes a minute and helps other drivers choose.\nAny warranty on the work is given by the partner who did it.\n\nReference: ' || ref || E'\n\nThe Motoring Central',
        '/#review', 'booking_done', null, new.id);
    elsif new.status = 'cancelled' then
      perform private.mail(cem, 'customer', 'Booking cancelled: ' || svc,
        hi || 'Your booking for ' || svc || ' (' || veh || E') has been cancelled.\n' ||
        coalesce('Reason: ' || nullif(new.cancel_reason,'') || E'\n', '') ||
        E'If you have paid, we will refund you to the card you used.\nReference: ' || ref || E'\n\nThe Motoring Central',
        '/#account', 'booking_cancelled', null, new.id);
    end if;
  end if;
  return new;
exception when others then
  raise warning 'email not queued: %', sqlerrm;
  return new;
end $$;
