-- The recovery sign-up form already stores a "fleet" answer (fleet size, e.g. "2 to 5") in partner details, so the
-- truck list is stored as "trucks" instead (22 Nov 2026). Applied as a patch to set_recovery_setup.
do $$ declare d text := pg_get_functiondef('public.set_recovery_setup(jsonb)'::regprocedure); begin
  d := replace(d, $q$jsonb_build_object('fleet', f, 'extras', e,$q$, $q$jsonb_build_object('trucks', f, 'extras', e,$q$);
  if position($q$'trucks', f$q$ in d) = 0 then raise exception 'not patched'; end if; execute d; end $$;
