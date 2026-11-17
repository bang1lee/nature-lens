-- Permanently delete ONLY the exact synthetic probe after recording events.
-- Stop on any unexpected reference; do not broaden deletion to repair this automatically.
begin;
do $$
declare rel record; referenced_id uuid; has_reference boolean;
begin
 if not exists(select 1 from auth.users where id='fd1f30a0-5fd2-43b8-a666-bf2111100001' and raw_app_meta_data->>'nature_lens_probe'='20261114-map-realtime' and raw_user_meta_data->>'synthetic'='true' and email is null and encrypted_password is null)
 or not exists(select 1 from public.profiles where user_id='fd1f30a0-5fd2-43b8-a666-bf2111100001' and alias='NL_MapProbe_1114')
 or not exists(select 1 from public.community_submissions where id='fd1f30a0-5fd2-43b8-a666-bf2111100002' and owner_id='fd1f30a0-5fd2-43b8-a666-bf2111100001' and title='합성 연결 시험, 실제 생태 관찰 아님') then
  raise exception 'probe identity or marker mismatch; nothing deleted';
 end if;
 if exists(select 1 from public.community_submissions where owner_id='fd1f30a0-5fd2-43b8-a666-bf2111100001' and id<>'fd1f30a0-5fd2-43b8-a666-bf2111100002') then
  raise exception 'probe owner has unexpected submissions; nothing deleted';
 end if;
 -- discovery_rounds may contain unreferenced user IDs (no FK), so check separately.
 if to_regclass('public.discovery_rounds') is not null then
  execute 'select exists(select 1 from public.discovery_rounds where user_id=$1)' into has_reference using 'fd1f30a0-5fd2-43b8-a666-bf2111100001'::uuid;
  if has_reference then raise exception 'unexpected discovery rows; nothing deleted'; end if;
 end if;
 -- A cascade must not silently remove unrelated rows from newer schemas.
 for rel in select c.conrelid,c.confrelid,c.conkey,c.confkey,a.attname
  from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
  where c.contype='f' and c.confrelid in ('auth.users'::regclass,'public.profiles'::regclass,'public.community_submissions'::regclass)
 loop
  if array_length(rel.conkey,1)<>1 or array_length(rel.confkey,1)<>1 then raise exception 'unexpected composite reference; nothing deleted'; end if;
  if (rel.conrelid='public.profiles'::regclass and rel.confrelid='auth.users'::regclass)
   or (rel.conrelid='public.community_submissions'::regclass and rel.confrelid='public.profiles'::regclass)
   or (rel.conrelid='public.community_map_points'::regclass and rel.confrelid='public.community_submissions'::regclass) then continue; end if;
  referenced_id:=case when rel.confrelid='public.community_submissions'::regclass then 'fd1f30a0-5fd2-43b8-a666-bf2111100002'::uuid else 'fd1f30a0-5fd2-43b8-a666-bf2111100001'::uuid end;
  execute format('select exists(select 1 from %s where %I=$1)',rel.conrelid::regclass,rel.attname) into has_reference using referenced_id;
  if has_reference then raise exception 'unexpected dependent row in %; nothing deleted',rel.conrelid::regclass; end if;
 end loop;
end $$;
delete from public.community_submissions where id='fd1f30a0-5fd2-43b8-a666-bf2111100002' and owner_id='fd1f30a0-5fd2-43b8-a666-bf2111100001' and title='합성 연결 시험, 실제 생태 관찰 아님';
delete from public.profiles where user_id='fd1f30a0-5fd2-43b8-a666-bf2111100001' and alias='NL_MapProbe_1114';
delete from auth.users where id='fd1f30a0-5fd2-43b8-a666-bf2111100001' and raw_app_meta_data->>'nature_lens_probe'='20261114-map-realtime';
do $$ begin
 if exists(select 1 from auth.users where id='fd1f30a0-5fd2-43b8-a666-bf2111100001') or exists(select 1 from public.profiles where user_id='fd1f30a0-5fd2-43b8-a666-bf2111100001') or exists(select 1 from public.community_submissions where id='fd1f30a0-5fd2-43b8-a666-bf2111100002') or exists(select 1 from public.community_map_points where id='fd1f30a0-5fd2-43b8-a666-bf2111100002') then
  raise exception 'probe residue found; cleanup rolled back';
 end if;
end $$;
commit;
