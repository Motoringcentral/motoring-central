-- Partner emails: the reason in plain words (27 Nov 2026)
-- When staff send an application back or pause an account, the reason is stored as {"reason": "...", "note": "..."}.
-- The "Your application needs attention" and "Your account has been paused" emails showed that raw, for example
-- Reason: {"note": "", "reason": "Document unclear or unreadable"}. They now say: Reason: Document unclear or unreadable
-- (and the note after a colon when staff wrote one).
create or replace function private.review_reason(j jsonb) returns text
language sql immutable set search_path = '' as $$
  select nullif(trim(case jsonb_typeof(j)
    when 'object' then concat_ws(': ', nullif(trim(coalesce(j->>'reason', '')), ''), nullif(trim(coalesce(j->>'note', '')), ''))
    when 'string' then j #>> '{}'
    else '' end), '')
$$;
revoke all on function private.review_reason(jsonb) from public, anon, authenticated;

do $$
declare d text := pg_get_functiondef('private.mail_partner'::regproc);
begin
  d := replace(d, $q$why := nullif(trim(coalesce(new.review->>'reject','')), '');$q$, $q$why := private.review_reason(new.review->'reject');$q$);
  d := replace(d, $q$why := nullif(trim(coalesce(new.review->>'suspend','')), '');$q$, $q$why := private.review_reason(new.review->'suspend');$q$);
  if (length(d) - length(replace(d, 'private.review_reason', ''))) / length('private.review_reason') <> 2 then
    raise exception 'mail_partner was not as expected; nothing changed';
  end if;
  execute d;
end $$;
