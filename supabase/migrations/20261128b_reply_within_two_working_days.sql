-- APPLIED to the live database on 28 Nov 2026. Do not re-apply (it is safe if you do: it does nothing the second time).
-- The contact form's confirmation email: "We aim to reply within 2 working days" (it said 1 working day).
-- The owner's decision of 28 Nov 2026; the Contact us page and the on-screen thank-you say the same.
-- Safe to run twice: the second time it does nothing.
do $$
declare d text; o oid;
begin
  select p.oid, pg_get_functiondef(p.oid) into o, d
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='send_contact';
  if d is null then raise exception 'send_contact not found'; end if;
  if position('We aim to reply within 1 working day.' in d)=0 then
    raise notice 'wording already changed'; return;
  end if;
  d := replace(d,'We aim to reply within 1 working day.','We aim to reply within 2 working days.');
  execute d;
end $$;
