-- 21 Nov 2026: with "Confirm email" on, a new partner's documents arrive at their first log-in, after the
-- "New application to review" email. Tell the owners when the documents are in (or sent again after a decline).
create or replace function public.resubmit_application() returns void
language plpgsql security definer set search_path = '' as $$
declare p public.partners;
begin
  update public.partners set status = 'pending', review = '{}'::jsonb, submitted_at = now()
   where id = (select auth.uid()) and status in ('pending','rejected') returning * into p;
  if p.id is not null then
    begin
      perform private.mail_owners('Documents received: ' || coalesce(p.name,'a partner') || ' (' || coalesce(nullif(p.sub,''), p.role, 'partner') || ')',
        coalesce(p.name,'A partner') || E' has uploaded their insurance certificates and photo ID.\n\nOpen the Staff page to check them and approve or reject the application.',
        '/#admin', 'staff_docs_received', 'docs:' || p.id);
    exception when others then raise warning 'resubmit email: %', sqlerrm;
    end;
  end if;
end $$;
