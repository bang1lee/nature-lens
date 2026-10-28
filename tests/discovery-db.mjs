// Real migration against isolated PostgreSQL; simulated roles, no live data.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.argv[2]);const db=new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role;');
await db.exec(await readFile('supabase/migrations/20261029000000_discovery_game.sql','utf8'));
const user='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const action=async(a,data,u=user)=>(await db.query('select public.discovery_action($1,$2,$3::jsonb) as r',[u,a,JSON.stringify(data)])).rows[0].r;
const result={state:'candidates',provider:'plantnet',modelVersion:'test',needsHumanReview:true,candidates:[{scientificName:'Taraxacum officinale',commonName:'민들레',score:.95},{scientificName:'Other plant',commonName:'다른 식물',score:.1}]};
const checks=[];
const check=(condition,name)=>{assert.ok(condition,name);checks.push(name);};
try{
 const r=await action('begin',{hash:'a'.repeat(64),observationId:'one',prediction:'민들레',reason:'노란 꽃'});
 check(r.fresh&&r.result===null,'submission conceals result');
 check((await action('begin',{hash:'a'.repeat(64),observationId:'changed',prediction:'수정',reason:''})).prediction==='민들레','duplicate photo cannot change prediction');
 const waiting=await action('complete',{id:r.id,result});check(waiting.result===null,'completed result still concealed');
 check((await action('read',{id:r.id},other)).error==='not-found','other user denied');
 check((await action('reveal',{id:r.id})).error==='too-early','server time blocks early reveal');
 await db.query("update public.discovery_rounds set ready_at=now()-interval '1 minute' where id=$1",[r.id]);
 const revealed=await action('reveal',{id:r.id});check(revealed.points===10&&revealed.totalPoints===10,'matching name awarded 10');
 check((await action('reveal',{id:r.id})).totalPoints===10,'repeat reveal never awards twice');
 const early=await action('begin',{hash:'b'.repeat(64),observationId:'two',prediction:'민들레',reason:''});await action('complete',{id:early.id,result});
 check((await action('reveal',{id:early.id,early:true})).points===0,'early reveal forfeits score');
 await action('seen',{hash:'c'.repeat(64),observationId:'three'});
 check((await action('begin',{hash:'c'.repeat(64),observationId:'new-id',prediction:'민들레',reason:''})).state==='seen','immediate answer excludes prediction under another record ID');
 const low=await action('begin',{hash:'d'.repeat(64),observationId:'four',prediction:'민들레',reason:''});
 await action('complete',{id:low.id,result:{...result,candidates:[{...result.candidates[0],score:.5}]}});
 await db.query("update public.discovery_rounds set ready_at=now()-interval '1 minute' where id=$1",[low.id]);
 check((await action('reveal',{id:low.id})).points===0,'uncertain result not scored');
 const circumvent=await action('begin',{hash:'e'.repeat(64),observationId:'five',prediction:'민들레',reason:''});
 await action('complete',{id:circumvent.id,result});await action('seen',{hash:'e'.repeat(64),observationId:'x'});
 await db.query("update public.discovery_rounds set ready_at=now()-interval '1 minute' where id=$1",[circumvent.id]);
 check((await action('reveal',{id:circumvent.id})).points===0,'direct immediate endpoint forfeits pending points');
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  await assert.rejects(()=>action('read',{id:r.id}));await assert.rejects(()=>db.query('select * from public.discovery_rounds'));await db.exec('reset role');checks.push(`${role} cannot read table or call scoring RPC`);
 }
 console.log(JSON.stringify({passed:checks.length,checks,scope:'isolated PGlite SQL; not live service'},null,2));
}finally{await db.close();}
