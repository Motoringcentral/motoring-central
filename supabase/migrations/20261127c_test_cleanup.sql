-- Removing the test data before launch (prepared 27 Nov 2026; run only when the owner says so).
-- private.test_cleanup(p_delete, p_data_only, p_extra, p_go):
--   p_delete     email addresses of test accounts to remove completely, with everything they own or booked;
--   p_data_only  email addresses of accounts to keep (for example the owner's own log-in), whose test adverts,
--                bookings, history checks, reminders, messages and saved items are removed;
--   p_extra      email addresses with no account (contact form, demo requests, emails sent) to remove;
--   p_go         false (the default) only counts what would go; true removes it, in one go.
-- It refuses to remove an owner's account. It lists the stored files (photos, documents) that belonged to the
-- removed accounts: files can only be deleted in Supabase > Storage, not from the database. Once the tables are
-- empty, reference numbers (messages, self-billing invoices, trade listings, reviews and so on) start again at 1.
-- The email addresses are given when it is run, never written here (this repository is public).
create or replace function private.test_cleanup(p_delete text[], p_data_only text[] default '{}', p_extra text[] default '{}', p_go boolean default false)
returns jsonb language plpgsql set search_path = '' as $$
declare
  em text[]; d uuid[]; k uuid[]; a uuid[]; r jsonb := '{}'::jsonb; n bigint; files jsonb; missing text[]; t record;
begin
  em := array(select distinct lower(btrim(x)) from unnest(coalesce(p_delete,'{}') || coalesce(p_data_only,'{}') || coalesce(p_extra,'{}')) x where btrim(x) <> '');
  d := array(select u.id from auth.users u where lower(u.email) = any(array(select lower(btrim(x)) from unnest(coalesce(p_delete,'{}')) x)));
  k := array(select u.id from auth.users u where lower(u.email) = any(array(select lower(btrim(x)) from unnest(coalesce(p_data_only,'{}')) x)));
  a := d || k;
  missing := array(select x from unnest(coalesce(p_delete,'{}') || coalesce(p_data_only,'{}')) x where not exists (select 1 from auth.users u where lower(u.email) = lower(btrim(x))));
  if exists (select 1 from public.staff s where s.user_id = any(d) and s.level = 'owner') then
    raise exception 'refused: an owner''s account is in the list to remove';
  end if;

  -- what would go
  select count(*) into n from public.adverts where owner_id = any(a); r := r || jsonb_build_object('adverts', n);
  select count(*) into n from public.vehicle_checks where owner_id = any(a); r := r || jsonb_build_object('history_checks', n);
  select count(*) into n from public.bookings where customer_id = any(a) or partner_id = any(d); r := r || jsonb_build_object('bookings', n);
  select count(*) into n from public.quote_jobs where customer_id = any(a); r := r || jsonb_build_object('quote_requests', n);
  select count(*) into n from public.trade_listings where seller_id = any(d); r := r || jsonb_build_object('trade_listings', n);
  select count(*) into n from public.partners where id = any(d); r := r || jsonb_build_object('partner_accounts', n);
  select count(*) into n from public.staff where user_id = any(d); r := r || jsonb_build_object('staff_accounts', n);
  select count(*) into n from public.mot_reminders where user_id = any(a) or lower(email) = any(em); r := r || jsonb_build_object('mot_reminders', n);
  select count(*) into n from public.contact_messages where user_id = any(a) or lower(email) = any(em); r := r || jsonb_build_object('contact_messages', n);
  select count(*) into n from public.demo_requests where lower(email) = any(em); r := r || jsonb_build_object('demo_requests', n);
  select count(*) into n from public.notifications where lower(to_addr) = any(em); r := r || jsonb_build_object('emails_sent_log', n);
  r := r || jsonb_build_object('accounts_removed', coalesce(array_length(d,1),0), 'accounts_kept_data_removed', coalesce(array_length(k,1),0), 'emails_not_found', to_jsonb(missing));
  select coalesce(jsonb_agg(o.bucket_id || '/' || o.name order by o.bucket_id, o.name), '[]'::jsonb) into files from storage.objects o
    where o.owner = any(a) or split_part(o.name, '/', 1) = any(array(select x::text from unnest(a) x));
  r := r || jsonb_build_object('files_to_delete_in_storage', files);
  if not p_go then return r || jsonb_build_object('done', false); end if;

  -- remove it (adverts and history checks first: an advert keeps its history check)
  delete from public.adverts where owner_id = any(a);
  delete from public.vehicle_checks where owner_id = any(a);
  delete from public.bookings where customer_id = any(a) or partner_id = any(d);
  delete from public.quote_jobs where customer_id = any(a);
  delete from public.quote_requests where customer_id = any(k);
  delete from public.enquiries where customer_id = any(k);
  delete from public.saved_items where user_id = any(k);
  delete from public.mot_lookups where user_id = any(k);
  delete from public.support_messages where user_id = any(k);
  delete from public.partner_reviews where author_id = any(k);
  delete from public.dealer_reviews where author_id = any(k) or dealer_id = any(k);
  delete from public.lesson_packs where customer_id = any(k);
  delete from public.job_extras where customer_id = any(k);
  delete from public.advert_messages where buyer_id = any(k) or seller_id = any(k);
  delete from public.advert_leads where buyer_id = any(k) or seller_id = any(k);
  delete from public.mot_reminders where user_id = any(a) or lower(email) = any(em);
  delete from public.contact_messages where user_id = any(a) or lower(email) = any(em);
  delete from public.demo_requests where lower(email) = any(em);
  delete from public.notifications where lower(to_addr) = any(em);
  delete from auth.users where id = any(d);  -- partners, staff, profiles and the rest go with the account

  -- reference numbers start again on tables that are now empty
  for t in select * from (values
      ('public.contact_messages','public.contact_messages_id_seq'), ('public.demo_requests','public.demo_requests_id_seq'),
      ('public.trade_listings','public.trade_listings_id_seq'), ('public.trade_offers','public.trade_offers_id_seq'),
      ('public.partner_reviews','public.partner_reviews_id_seq'), ('public.dealer_reviews','public.dealer_reviews_id_seq'),
      ('public.mot_reminders','public.mot_reminders_id_seq'), ('public.mot_lookups','public.mot_lookups_id_seq'),
      ('public.diary_slots','public.diary_slots_id_seq'), ('public.adverts','public.adverts_id_seq'),
      ('public.advert_reports','public.advert_reports_id_seq'), ('public.payouts','private.selfbill_seq')) v(tbl, seq) loop
    if to_regclass(t.seq) is null or to_regclass(t.tbl) is null then continue; end if;
    execute format('select count(*) from %s', t.tbl) into n;
    if n = 0 then
      execute format('select setval(%L, (select start_value from pg_sequences where schemaname || %L || sequencename = %L), false)', t.seq, '.', t.seq);
    end if;
  end loop;
  return r || jsonb_build_object('done', true);
end $$;
revoke all on function private.test_cleanup(text[], text[], text[], boolean) from public, anon, authenticated;
