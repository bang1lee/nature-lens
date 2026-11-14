-- Run only on a disposable local Supabase stack after all migrations.
begin;
select plan(12);
insert into auth.users(id) values ('20000000-0000-4000-8000-000000000001');
insert into public.map_areas(id,label,latitude,longitude,radius_m) values ('test-area','시험 구역',37.02,127.31,1000);
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
insert into public.profiles(alias) values ('지도시험자');
reset role;
insert into public.community_submissions(owner_id,id,title,species,scientific_name,observed_on,notes,habitat,taxon_group,region,protection,photo,consent_upload,no_people,ai_assisted,map_area_id,consent_map) values
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','꽃','꽃','',current_date,'시험','','plant',null,'common','data:image/png;base64,YQ==',true,true,false,'test-area',true),
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','꽃','꽃','',current_date,'시험','','plant',null,'unknown','data:image/png;base64,YQ==',true,true,false,'test-area',true),
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','꽃','꽃','',current_date,'시험','','plant',null,'common','data:image/png;base64,YQ==',true,true,false,null,false);
set local role authenticated;
select is((select count(*)::int from public.community_map_points),0,'pending is not public');
select throws_ok($$update public.community_submissions set status='approved',approved_at=now()$$,'42501',null,'client cannot approve');
select throws_ok($$update public.map_areas set latitude=38$$,'42501',null,'client cannot move public area');
reset role;
update public.community_submissions set status='approved',approved_at=now();
set local role anon;
select is((select count(*)::int from public.community_map_points),1,'only common consented approved record is public');
select is((select latitude from public.community_map_points),37.02::float8,'representative area coordinate');
select throws_ok($$select owner_id from public.community_map_points$$,'42703',null,'owner is not projected');
select throws_ok($$select photo from public.community_map_points$$,'42703',null,'photo is not projected');
reset role;
update public.community_submissions set consent_map=false where id='30000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.community_map_points),0,'consent withdrawal removes point');
update public.community_submissions set consent_map=true where id='30000000-0000-4000-8000-000000000001';
update public.map_areas set active=false where id='test-area';
select is((select count(*)::int from public.community_map_points),0,'inactive area removes point');
update public.map_areas set active=true where id='test-area';
select is((select count(*)::int from public.community_map_points),1,'reactivation restores eligible point');
update public.community_submissions set protection='protected' where id='30000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.community_map_points),0,'protected change removes point');
update public.community_submissions set protection='common' where id='30000000-0000-4000-8000-000000000001';
delete from public.community_submissions where id='30000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.community_map_points),0,'source deletion removes point');
select * from finish();
rollback;
