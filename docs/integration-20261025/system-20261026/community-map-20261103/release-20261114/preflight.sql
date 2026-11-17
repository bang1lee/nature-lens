-- Read-only: run as project SQL administrator. No records or credentials are returned.
-- Apply the map migration only when base community_submissions exists, publication
-- exists with puballtables=false, and ALL map objects/columns/publication rows are absent.
select current_database() as database_name,
 to_regclass('public.community_submissions') is not null as base_table_exists,
 to_regclass('public.community_feed') is not null as feed_exists,
 to_regclass('public.map_areas') is not null as map_areas_exists,
 to_regclass('public.community_map_points') is not null as map_points_exists,
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='community_submissions' and column_name='map_area_id') as map_area_column_exists,
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='community_submissions' and column_name='consent_map') as map_consent_column_exists,
 exists(select 1 from pg_publication where pubname='supabase_realtime') as publication_exists,
 (select puballtables from pg_publication where pubname='supabase_realtime') as publication_all_tables;
select n.nspname as schema_name,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('validate_community_map_area','sync_community_map_point','sync_community_map_area');
select event_object_table,trigger_name from information_schema.triggers where trigger_schema='public' and trigger_name in ('community_map_area_validate','community_map_sync','community_map_area_sync');
select schemaname,tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('community_submissions','community_map_points');
