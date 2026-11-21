-- 21 Nov 2026: clearer quote email. The old subject put the job name in the middle of a sentence, which read
-- badly for jobs like "Not sure: please check and advise". The subject now names the partner and the price.
create or replace function private.mail_quote() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.quote_requests; who text; price text;
begin
  select * into r from public.quote_requests where id = new.request_id;
  if not found then return new; end if;
  who := coalesce(nullif(new.partner_name,''),'a partner');
  price := '£' || to_char(new.price, 'FM999,999,990.00');
  perform private.mail(private.user_email(r.customer_id), 'customer',
    'You have a new quote: ' || price || ' from ' || who,
    'Hello ' || private.first_name(r.first_name) || E',\n\n' ||
    upper(left(who,1)) || substr(who,2) || ' has sent you a quote of ' || price || ' for your request' ||
    coalesce(' for ' || nullif(upper(r.vehicle->>'reg'),''), '') || E'.\n\n' ||
    'What you asked for: ' || r.job || E'\n' ||
    case when coalesce(new.note,'') <> '' then E'Their note: "' || left(new.note, 300) || E'"\n' else '' end ||
    E'\nLog in to compare your quotes and book the one you want. Quote request ' || r.id || E'.\n\nThe Motoring Central',
    '/#account', 'quote_received', 'q:' || new.request_id || ':' || new.partner_id);
  return new;
exception when others then
  raise warning 'email not queued: %', sqlerrm;
  return new;
end $$;
