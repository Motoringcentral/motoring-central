-- Cancelling during the free trial also ends the trial on the spot, so a dealer who is reinstated later starts a paid
-- plan and does not get the rest of the trial back (22 Nov 2026)
do $$
declare d text := pg_get_functiondef('public.dealer_cancel()'::regprocedure);
begin
  if position('trial_ends = now()' in d) = 0 then
    d := replace(d, $q$update public.partners set status = 'suspended', cancel_requested_at = now(), ends_at = now(),$q$,
                    $q$update public.partners set status = 'suspended', cancel_requested_at = now(), ends_at = now(), trial_ends = now(),$q$);
    if position('trial_ends = now()' in d) = 0 then raise exception 'dealer_cancel was not patched'; end if;
    execute d;
  end if;
end $$;
