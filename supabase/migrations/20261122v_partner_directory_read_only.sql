-- The public list of approved partners is a view over the partners table. It is for reading only, but it carried the
-- default grants, and because a simple view can be written through, a visitor who was not logged in could have
-- changed or deleted approved partners with it. Reading is all anyone needs. (Found and fixed 22 Nov 2026.)
revoke all on public.partner_directory from anon, authenticated;
grant select on public.partner_directory to anon, authenticated;
