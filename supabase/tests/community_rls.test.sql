-- Run with supabase test db in a disposable local Supabase stack. Not yet executed.
begin;
select plan(8);
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.profiles(alias) values ('관찰자하나');
insert into public.community_submissions(title,species,scientific_name,observed_on,notes,habitat,taxon_group,region,protection,photo,consent_upload,no_people,ai_assisted)
values ('꽃','미확정 꽃','',current_date,'산책 중 관찰','','plant',null,'unknown','data:image/png;base64,YQ==',true,true,false);
select is((select count(*)::int from public.community_submissions),1,'owner sees pending');
select is((select count(*)::int from public.community_feed),0,'pending absent from feed');
select throws_ok($$update public.community_submissions set status='approved',approved_at=now()$$,'42501',null,'client cannot approve');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from public.community_submissions),0,'other account cannot read');
delete from public.community_submissions;
reset role;
select is((select count(*)::int from public.community_submissions),1,'other account cannot delete');
update public.community_submissions set status='approved',approved_at=now();
set local role anon;
select is((select count(*)::int from public.community_feed),1,'approved visible publicly');
select throws_ok($$select * from public.community_submissions$$,'42501',null,'anonymous cannot read base');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
delete from public.community_submissions;
select is((select count(*)::int from public.community_feed),0,'withdrawal removes public entry');
select * from finish();
rollback;
