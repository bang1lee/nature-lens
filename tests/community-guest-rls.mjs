// Disposable PGlite only; pass an absolute path to @electric-sql/pglite/dist/index.js.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const member='10000000-0000-4000-8000-000000000001';
const guest='10000000-0000-4000-8000-000000000002';
const betaId='20000000-0000-4000-8000-000000000001';
const submission=`(title,species,scientific_name,observed_on,notes,habitat,taxon_group,region,protection,photo,consent_upload,no_people,ai_assisted)
 values ('합성 관찰','미확정','','2026-11-16','격리 시험','','plant',null,'unknown','data:image/png;base64,YQ==',true,true,false)`;
const count=async table=>(await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n;
const role=async(name,id,anonymous)=>{
 await db.exec(`reset role; set role ${name}`);
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,is_anonymous:anonymous})]);
};
const denied=async sql=>assert.rejects(db.exec(sql),error=>error.code==='42501');
try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
  create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
  grant usage on schema public,auth to anon,authenticated,service_role;
  create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
  alter table storage.objects enable row level security; grant usage on schema storage to anon,authenticated,service_role;
  grant select,insert on storage.objects to authenticated;
  insert into auth.users values ('${member}'),('${guest}');`);
 await db.exec(await readFile('supabase/migrations/20260929000000_community_pilot.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261115000000_beta_public_observations.sql','utf8'));
 if(!process.argv.includes('--baseline'))await db.exec(await readFile('supabase/migrations/20261116000000_member_community_rls.sql','utf8'));

 await role('authenticated',member,false);
 await db.exec("insert into public.profiles(alias) values ('회원별칭')");
 await db.exec(`insert into public.community_submissions ${submission}`);
 assert.equal(await count('profiles'),1);assert.equal(await count('community_submissions'),1);
 await db.exec('reset role; update public.community_submissions set status=\'approved\',approved_at=now()');

 await role('authenticated',guest,true);
 await denied("insert into public.profiles(alias) values ('게스트별칭')");
 // Existing guest-owned rows must remain hidden and cannot be withdrawn as a guest.
 await db.exec('reset role');
 await db.query("insert into public.profiles(user_id,alias) values($1,'이전게스트')",[guest]);
 await db.query(`insert into public.community_submissions(owner_id,title,species,scientific_name,observed_on,notes,habitat,taxon_group,region,protection,photo,consent_upload,no_people,ai_assisted)
  values($1,'기존 합성','미확정','','2026-11-16','격리 시험','','plant',null,'unknown','data:image/png;base64,YQ==',true,true,false)`,[guest]);
 await role('authenticated',guest,true);
 assert.equal(await count('profiles'),0);assert.equal(await count('community_submissions'),0);
 await denied(`insert into public.community_submissions ${submission}`);
 assert.equal((await db.query('delete from public.community_submissions returning id')).rows.length,0);
 assert.equal(await count('community_feed'),1);

 // Anonymous beta ownership, upload and publication are deliberately preserved.
 await db.query(`insert into public.beta_public_observations(id,owner_id,local_id,photo_path,photo_sha256,record,public_consent,no_people)
  values($1,$2,'local-a',$3,repeat('a',64),'{"id":"local-a","title":"합성","species":"","date":"2026-11-16","notes":""}',true,true)`,[betaId,guest,`${betaId}.jpg`]);
 await db.query("insert into storage.objects(bucket_id,name) values('nature-lens-beta-public',$1)",[`${betaId}.jpg`]);
 await db.exec("update public.beta_public_observations set state='published' where local_id='local-a'");
 assert.equal(await count('beta_public_observations'),1);assert.equal(await count('beta_public_feed'),1);
 await role('anon',null,true);assert.equal(await count('community_feed'),1);assert.equal(await count('beta_public_feed'),1);

 await role('authenticated',member,false);
 assert.equal(await count('profiles'),1);assert.equal(await count('community_submissions'),1);
 assert.equal((await db.query('delete from public.community_submissions returning id')).rows.length,1);
 assert.equal(await count('community_feed'),0);
 // An authenticated token without an explicit permanent-user claim fails closed.
 await role('authenticated',member,undefined);assert.equal(await count('profiles'),0);
 await db.exec('reset role');assert.equal(await count('community_submissions'),1);
 console.log('Isolated PGlite: guest community access denied; member, public feed and guest beta publication preserved.');
}finally{await db.close();}
