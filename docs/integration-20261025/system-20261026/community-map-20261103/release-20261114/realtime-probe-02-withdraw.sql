-- Run only after recording both listeners' creation event. Revoke map consent.
begin;
do $$ begin
 if not exists(select 1 from auth.users where id='fd1f30a0-5fd2-43b8-a666-bf2111100001' and raw_app_meta_data->>'nature_lens_probe'='20261114-map-realtime')
 or not exists(select 1 from public.community_submissions where id='fd1f30a0-5fd2-43b8-a666-bf2111100002' and owner_id='fd1f30a0-5fd2-43b8-a666-bf2111100001' and title='합성 연결 시험, 실제 생태 관찰 아님' and consent_map) then
  raise exception 'matching active probe not found; no changes made';
 end if;
end $$;
update public.community_submissions set consent_map=false,status='rejected' where id='fd1f30a0-5fd2-43b8-a666-bf2111100002' and owner_id='fd1f30a0-5fd2-43b8-a666-bf2111100001';
do $$ begin
 if exists(select 1 from public.community_feed where id='fd1f30a0-5fd2-43b8-a666-bf2111100002') then
  raise exception 'probe remains in feed; withdrawal rolled back';
 end if;
 if exists(select 1 from public.community_map_points where id='fd1f30a0-5fd2-43b8-a666-bf2111100002') then
  raise exception 'probe point remains; withdrawal rolled back';
 end if;
end $$;
commit;
