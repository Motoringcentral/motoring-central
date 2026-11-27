-- Business MOT bookings: after booking the MOT for the member, put the login context back exactly as it was (27 Nov 2026).
-- (This change is already in 20261127e_business_booking.sql; this file applies it to a database that ran the earlier version.)
do $$ declare d text;
begin
  d := pg_get_functiondef('private.biz_make_booking(uuid)'::regprocedure);
  if position('old_sub' in d) > 0 then return; end if;
  d := replace(d, 'old_claims text; res jsonb;', 'old_claims text; old_sub text; res jsonb;');
  d := replace(d, $q$old_claims := current_setting('request.jwt.claims', true);$q$, $q$old_claims := current_setting('request.jwt.claims', true); old_sub := current_setting('request.jwt.claim.sub', true);$q$);
  d := replace(d, $q$perform set_config('request.jwt.claim.sub', coalesce(nullif(old_claims,'')::jsonb->>'sub', ''), true);$q$, $q$perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);$q$);
  if (length(d) - length(replace(d, 'old_sub', ''))) / 7 <> 3 then raise exception 'biz_make_booking not patched'; end if;
  execute d;
end $$;

-- A business with no phone number on file: keep the booking's phone blank rather than empty (the column is not null).
do $$ declare d text;
begin
  d := pg_get_functiondef('private.biz_make_booking(uuid)'::regprocedure);
  if position($q$a.phone, '')$q$ in d) > 0 then return; end if;
  d := replace(d, $q$customer_phone = coalesce(nullif(b.customer_phone,''), a.phone)$q$, $q$customer_phone = coalesce(nullif(b.customer_phone,''), a.phone, '')$q$);
  if position($q$a.phone, '')$q$ in d) = 0 then raise exception 'phone fix not applied'; end if;
  execute d;
end $$;

-- Repeat valets are booked by the morning job, not by a person: they do not count towards the speed limit.
do $$ declare d text;
begin
  d := pg_get_functiondef('private.biz_book_core(uuid,uuid,jsonb,uuid)'::regprocedure);
  if position('schedule_id is null' in d) > 0 then return; end if;
  d := replace(d, $q$created_at > now() - interval '1 hour';$q$, $q$created_at > now() - interval '1 hour' and schedule_id is null;$q$);
  d := replace(d, $q$created_at > now() - interval '24 hours';$q$, $q$created_at > now() - interval '24 hours' and schedule_id is null;$q$);
  d := replace(d, $q$  if n_hour >= private.biz_setting('max_per_hour', 15) or n_day >= private.biz_setting('max_per_day', 60) then$q$,
                  $q$  if p_schedule is null and (n_hour >= private.biz_setting('max_per_hour', 15) or n_day >= private.biz_setting('max_per_day', 60)) then$q$);
  if position('p_schedule is null and (n_hour' in d) = 0 or (length(d) - length(replace(d, 'schedule_id is null', ''))) / 19 <> 2 then raise exception 'speed fix not applied'; end if;
  execute d;
end $$;

-- Only an owner (not a reviewer) approves, declines, suspends or reopens a business account, as for partners.
do $$ declare d text;
begin
  d := pg_get_functiondef('public.staff_biz_review(uuid,text,text)'::regprocedure);
  if position('owner_only''; end if;   -- like partners' in d) > 0 then return; end if;
  d := replace(d, $q$  if not (select private.is_staff()) then raise exception 'not_staff'; end if;
  select * into a from public.business_accounts where id = p_account for update;$q$, $q$  if not (select private.is_owner()) then raise exception 'owner_only'; end if;   -- like partners: only an owner decides
  select * into a from public.business_accounts where id = p_account for update;$q$);
  if position('owner_only''; end if;   -- like partners' in d) = 0 then raise exception 'review fix not applied'; end if;
  execute d;
end $$;
