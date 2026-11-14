import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const localRequire=createRequire('/tmp/nature-map-pg/package.json');
const {PGlite}=await import(pathToFileURL(localRequire.resolve('@electric-sql/pglite')).href);
import {readFile} from 'node:fs/promises';
const dir=process.cwd();
const db=new PGlite();
try {
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role; create publication supabase_realtime;`);
 await db.exec(await readFile(dir+'/supabase/migrations/20260929000000_community_pilot.sql','utf8'));
 await db.exec(await readFile(dir+'/docs/integration-20261025/system-20261026/community-map-20261103/release-20261114/preflight.sql','utf8'));
 await db.exec(await readFile(dir+'/supabase/migrations/20261103000000_community_map.sql','utf8'));
 await db.exec(await readFile(dir+'/docs/integration-20261025/system-20261026/community-map-20261103/release-20261114/seed.sql','utf8'));
 await db.exec(await readFile(dir+'/docs/integration-20261025/system-20261026/community-map-20261103/release-20261114/seed.sql','utf8'));
 await db.exec(`create function public.plan(int) returns text language sql as $$select 'plan'::text$$;
 create function public.is(anyelement,anyelement,text) returns text language plpgsql as $$begin if $1 is distinct from $2 then raise exception 'assertion failed: %, actual %, expected %',$3,$1,$2; end if; return 'ok';end$$;
 create function public.throws_ok(text,text,text,text) returns text language plpgsql as $$declare caught text;begin begin execute $1; exception when others then get stacked diagnostics caught=returned_sqlstate;end; if caught is distinct from $2 then raise exception 'assertion failed: %, actual SQLSTATE %, expected %',$4,caught,$2;end if;return 'ok';end$$;
 create function public.finish() returns text language sql as $$select 'finished'::text$$;`);
 await db.exec(await readFile(dir+'/supabase/tests/community_map.test.sql','utf8'));
 await db.exec(await readFile(dir+'/docs/integration-20261025/system-20261026/community-map-20261103/release-20261114/postcheck.sql','utf8'));
 console.log('isolated PGlite: base migration, map migration, seed twice, all 12 SQL assertions passed');
} catch(e){console.error('isolated migration failed:',e.message);process.exitCode=1;} finally{await db.close();}
