-- Synthetic probe only. Run once after both anonymous Realtime listeners subscribe.
-- This transaction briefly creates a publicly visible, clearly labelled synthetic entry.
begin;
do $$ begin
 if exists(select 1 from auth.users where id='fd1f30a0-5fd2-43b8-a666-bf2111100001')
 or exists(select 1 from public.profiles where user_id='fd1f30a0-5fd2-43b8-a666-bf2111100001' or alias='NL_MapProbe_1114')
 or exists(select 1 from public.community_submissions where id='fd1f30a0-5fd2-43b8-a666-bf2111100002')
 or exists(select 1 from public.community_map_points where id='fd1f30a0-5fd2-43b8-a666-bf2111100002') then
  raise exception 'probe identity collision; nothing created';
 end if;
 if not exists(select 1 from public.map_areas where id='anseong-cheongnyangsan-area' and active) then
  raise exception 'approved public area unavailable; nothing created';
 end if;
end $$;
-- A disabled synthetic identity: no email, password or session. Never used to sign in.
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data)
values ('fd1f30a0-5fd2-43b8-a666-bf2111100001','{"nature_lens_probe":"20261114-map-realtime"}'::jsonb,'{"synthetic":true}'::jsonb);
-- Some projects create a profile in an auth trigger. This identity was proven absent
-- before insertion, so set only that freshly created profile to the probe alias.
insert into public.profiles(user_id,alias) values ('fd1f30a0-5fd2-43b8-a666-bf2111100001','NL_MapProbe_1114')
on conflict(user_id) do update set alias=excluded.alias;
insert into public.community_submissions(id,owner_id,title,species,scientific_name,observed_on,notes,habitat,taxon_group,region,protection,photo,consent_upload,no_people,ai_assisted,map_area_id,consent_map,status,approved_at)
values ('fd1f30a0-5fd2-43b8-a666-bf2111100002','fd1f30a0-5fd2-43b8-a666-bf2111100001','합성 연결 시험, 실제 생태 관찰 아님','합성 연결 시험, 실제 생태 관찰 아님','',date '2026-11-14','합성 연결 시험, 실제 생태 관찰 아님','','other',null,'common','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',true,true,false,'anseong-cheongnyangsan-area',true,'approved',now());
do $$ begin
 if not exists(select 1 from public.community_map_points where id='fd1f30a0-5fd2-43b8-a666-bf2111100002' and area_id='anseong-cheongnyangsan-area') then
  raise exception 'probe projection missing; creation rolled back';
 end if;
end $$;
commit;
