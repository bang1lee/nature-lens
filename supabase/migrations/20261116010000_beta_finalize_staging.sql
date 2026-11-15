-- Atomically update a caller's staged metadata and publish that exact version.
-- Published rows and the owner, photo path and photo hash remain immutable.
begin;

-- Older clients must not publish a different version without a comparison.
revoke update on public.beta_public_observations from public, anon, authenticated;
revoke update(state) on public.beta_public_observations from authenticated;

create function public.finalize_beta_public_observation(
 p_id uuid, p_expected_record jsonb, p_new_record jsonb, p_photo_sha256 text
)
returns boolean language plpgsql security definer set search_path='' as $$
declare caller uuid := auth.uid();
begin
 if caller is null then raise exception 'login_required' using errcode='42501'; end if;
 -- The row lock is held until publication, so two tabs cannot publish
 -- different versions after both reading the same staging row.
 update public.beta_public_observations
 set record=p_new_record
 where id=p_id and owner_id=caller and state='staging'
  and record=p_expected_record and photo_sha256=p_photo_sha256;
 if not found then return false; end if;

 -- The existing trigger verifies that the reserved photo exists.
 update public.beta_public_observations set state='published'
 where id=p_id and owner_id=caller and state='staging';
 if not found then raise exception 'staging_changed'; end if;
 return true;
end;
$$;
revoke all on function public.finalize_beta_public_observation(uuid,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.finalize_beta_public_observation(uuid,jsonb,jsonb,text) to authenticated;

commit;
