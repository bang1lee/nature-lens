-- Anonymous Auth sessions use the authenticated role. Restrict member-only
-- community data without changing the separately consented public beta flow.
begin;

create policy profiles_members_only on public.profiles as restrictive for all to authenticated
 using ((select (auth.jwt()->>'is_anonymous')::boolean) is false)
 with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false);

create policy submissions_members_only on public.community_submissions as restrictive for all to authenticated
 using ((select (auth.jwt()->>'is_anonymous')::boolean) is false)
 with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false);

commit;
