-- ALREADY APPLIED to the live database on 28 Nov 2026. Do not re-apply (it is safe if you do: it does nothing the second time).
-- Complaint confirmation email: do not promise "a member of our team"; say "We will contact you".
do $$
declare d text; o oid;
begin
  select p.oid, pg_get_functiondef(p.oid) into o, d
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='send_contact';
  if d is null then raise exception 'send_contact not found'; end if;
  if position('A member of our team will contact you within 2 working days.' in d)=0 then
    raise notice 'wording already changed'; return;
  end if;
  d := replace(d,'A member of our team will contact you within 2 working days.','We will contact you within 2 working days.');
  execute d;
end $$;
