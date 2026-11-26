-- Advert emails when the MOT check holds an advert for our team (26 Nov 2026)
-- The advert email trigger only ran when the status changed. When the MOT check holds an advert, its status stays
-- "pending" and only mot_wait changes, so the seller's "We are checking your advert" and the owners' "Adverts are
-- waiting for approval" emails were not sent. The trigger now also runs when mot_wait changes.
drop trigger if exists adverts_mail on public.adverts;
create trigger adverts_mail after insert or update of status, mot_wait on public.adverts
  for each row execute function private.mail_advert();
