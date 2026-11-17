-- Read-only structural checks; does not disclose observation contents.
select c.relname,c.relrowsecurity,c.relreplident from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('map_areas','community_map_points');
select tablename,policyname,roles,cmd from pg_policies where schemaname='public' and tablename in ('map_areas','community_map_points');
select schemaname,tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('community_submissions','community_map_points');
select event_object_table,trigger_name from information_schema.triggers where trigger_schema='public' and trigger_name in ('community_map_area_validate','community_map_sync','community_map_area_sync');
select id,label,latitude,longitude,radius_m,active from public.map_areas where id='anseong-cheongnyangsan-area';
select count(*) as map_point_count from public.community_map_points;
select count(*) as ineligible_points from public.community_map_points p left join public.community_submissions s on s.id=p.id left join public.map_areas a on a.id=p.area_id where s.id is null or a.id is null or not a.active or s.status<>'approved' or s.approved_at is null or s.protection<>'common' or not s.consent_upload or not s.no_people or not s.consent_map or s.map_area_id is distinct from p.area_id;
select has_table_privilege('anon','public.community_map_points','SELECT') as anon_can_select_points,
 has_table_privilege('anon','public.community_map_points','INSERT') as anon_can_insert_points,
 has_table_privilege('authenticated','public.community_map_points','UPDATE') as user_can_update_points,
 has_table_privilege('anon','public.community_submissions','SELECT') as anon_can_select_private_submissions,
 has_column_privilege('authenticated','public.community_submissions','map_area_id','INSERT') as user_can_choose_area,
 has_column_privilege('authenticated','public.community_submissions','status','UPDATE') as user_can_moderate;
