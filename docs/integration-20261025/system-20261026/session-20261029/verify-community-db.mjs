// Local PostgreSQL/WASM check. Not a live Supabase or JWT integration test.
// Pass an installed PGlite dist/index.js path; run from the app repository root.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const checks=[];
async function count(table,n,label){assert.equal((await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n,n);checks.push(label);}
async function denied(sql,label){await assert.rejects(db.exec(sql),e=>e.code==='42501');checks.push(label);}
const user1='10000000-0000-4000-8000-000000000001',user2='10000000-0000-4000-8000-000000000002';
async function role(name,user){await db.exec(`reset role; set role ${name};`);if(user)await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);}
try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;
 insert into auth.users values ('${user1}'),('${user2}');
 create table public.observations(id uuid primary key,title text);
 insert into public.observations values ('30000000-0000-4000-8000-000000000001','existing sentinel');`);
 await db.exec(await readFile('supabase/migrations/20260929000000_community_pilot.sql','utf8'));
 await count('observations',1,'existing observations preserved');
 await role('authenticated',user1);
 await db.exec("insert into public.profiles(alias) values ('관찰자하나');");
 await db.exec(`insert into public.community_submissions(title,species,scientific_name,observed_on,notes,habitat,taxon_group,region,protection,photo,consent_upload,no_people,ai_assisted)
 values ('합성 관찰','미확정','','2026-10-29','로컬 시험','','plant',null,'unknown','data:image/png;base64,YQ==',true,true,false);`);
 await count('community_submissions',1,'owner reads own pending');
 await count('community_feed',0,'pending absent from public feed');
 await denied("update public.community_submissions set status='approved',approved_at=now()",'client cannot approve');
 await denied(`insert into public.profiles(user_id,alias) values ('${user2}','위장별칭')`,'client cannot choose another owner');
 await role('authenticated',user2);
 await count('profiles',0,'other account cannot read profile');
 await count('community_submissions',0,'other account cannot read submission');
 await db.exec('delete from public.community_submissions');
 await role('postgres');
 await count('community_submissions',1,'other account cannot delete submission');
 await db.exec("update public.community_submissions set status='approved',approved_at=now()");
 await role('anon');
 await count('community_feed',1,'only operator-approved row visible');
 await denied('select * from public.community_submissions','anonymous cannot read base rows');
 const columns=(await db.query('select * from public.community_feed')).fields.map(f=>f.name);
 assert(!columns.includes('owner_id')&&!columns.includes('moderation_note'));checks.push('public view omits owner ID and moderation notes');
 await role('authenticated',user1);await db.exec('delete from public.community_submissions');
 await count('community_feed',0,'owner withdrawal removes public entry');
 console.log(JSON.stringify({passed:checks.length,checks,scope:'Local PGlite PostgreSQL with simulated auth.uid/roles. Not live auth, PostgREST, storage, or concurrency validation.'},null,2));
}finally{await db.close();}
