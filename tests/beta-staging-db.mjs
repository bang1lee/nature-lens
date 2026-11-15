// Disposable PGlite only: node tests/beta-staging-db.mjs /absolute/path/to/pglite/dist/index.js
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const owner='10000000-0000-4000-8000-000000000001';
const other='10000000-0000-4000-8000-000000000002';
const id='20000000-0000-4000-8000-000000000001';
const hash='a'.repeat(64),path=`${id}.jpg`;
const original={id:'local-a',title:'합성',species:'',date:'2026-11-16',notes:'이전 메모'};
const updated={...original,species:'민들레 후보',notes:'수정된 메모'};
const competing={...original,notes:'다른 창의 메모'};
const checks=[];
const check=(condition,name)=>{assert.ok(condition,name);checks.push(name);};
const role=async(name,uid)=>{await db.exec(`reset role;set role ${name}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid||'']);};
const finalize=async(uid,expected,next,photoHash=hash)=>{
 await role('authenticated',uid);
 return (await db.query('select public.finalize_beta_public_observation($1::uuid,$2::jsonb,$3::jsonb,$4::text) as ok',[id,JSON.stringify(expected),JSON.stringify(next),photoHash])).rows[0].ok;
};
const stored=async()=>{await db.exec('reset role');return (await db.query('select id,owner_id,photo_path,photo_sha256,record,state from public.beta_public_observations where id=$1',[id])).rows[0];};
const denied=async(sql,label)=>{await assert.rejects(db.exec(sql),error=>error.code==='42501');checks.push(label);};
try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema public,auth to anon,authenticated,service_role;
  create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
  alter table storage.objects enable row level security; grant usage on schema storage to anon,authenticated,service_role;
  grant select,insert on storage.objects to authenticated;
  insert into auth.users values ('${owner}'),('${other}');`);
 await db.exec(await readFile('supabase/migrations/20261115000000_beta_public_observations.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261116010000_beta_finalize_staging.sql','utf8'));
 await role('authenticated',owner);
 await db.query(`insert into public.beta_public_observations(id,owner_id,local_id,photo_path,photo_sha256,record,public_consent,no_people)
  values($1,$2,'local-a',$3,$4,$5::jsonb,true,true)`,[id,owner,path,hash,JSON.stringify(original)]);

 await denied("update public.beta_public_observations set state='published'",'legacy direct publication denied');
 await denied("update public.beta_public_observations set record='{}'::jsonb",'direct metadata modification denied');
 await denied("update public.beta_public_observations set photo_sha256=repeat('b',64)",'direct hash modification denied');
 await denied("update public.beta_public_observations set photo_path='other.jpg'",'direct photo path modification denied');
 await denied(`update public.beta_public_observations set owner_id='${other}'`,'direct owner modification denied');
 check(await finalize(other,original,updated)===false,'another owner cannot finalize');
 check(await finalize(owner,competing,updated)===false,'stale metadata compare rejects');
 check(await finalize(owner,original,updated,'b'.repeat(64))===false,'photo hash mismatch rejects');
 check((await stored()).record.notes===original.notes,'rejected calls leave original staging metadata untouched');

 await assert.rejects(()=>finalize(owner,original,updated),error=>error.code==='P0001'&&error.message.includes('beta_photo_missing'));
 const failed=await stored();
 check(failed.state==='staging'&&failed.record.notes===original.notes,'missing photo rolls back staged metadata update');
 await role('authenticated',owner);
 await db.query("insert into storage.objects(bucket_id,name) values('nature-lens-beta-public',$1)",[path]);
 check(await finalize(owner,original,updated)===true,'owner atomically finalizes edited metadata with the reserved photo');
 const published=await stored();
 check(published.state==='published'&&published.record.notes===updated.notes&&published.record.species===updated.species,'published record contains edited values');
 check(published.owner_id===owner&&published.photo_path===path&&published.photo_sha256===hash,'owner, photo path and photo hash remain unchanged');
 check(await finalize(owner,original,competing)===false,'competing stale tab cannot publish a different version');
 check(await finalize(owner,updated,competing)===false,'published rows cannot be changed by the RPC');
 check((await stored()).record.notes===updated.notes,'the winning published metadata remains unchanged');
 await role('authenticated',owner);await denied("update public.beta_public_observations set record='{}'::jsonb",'published metadata cannot be edited directly');
 await role('anon',null);await denied(`select public.finalize_beta_public_observation('${id}','{}'::jsonb,'{}'::jsonb,'${hash}')`,'anon role cannot call finalization');
 const feed=await db.query('select title,species,notes from public.beta_public_feed');
 check(feed.rows.length===1&&feed.rows[0].notes===updated.notes,'public feed exposes the final version');
 console.log(JSON.stringify({passed:checks.length,checks,scope:'isolated PGlite with simulated roles; no live service or separate concurrent sessions'},null,2));
}finally{await db.close();}
