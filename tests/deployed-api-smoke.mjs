import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
const run = promisify(execFile);
const target = process.env.LIVE_BASE_URL;
if (!target || new URL(target).protocol !== 'https:') throw new Error('LIVE_BASE_URL must be the authorized HTTPS deployment');
const base=target.replace(/\/$/,'');
const summary={target:base,checks:[],database:[],tail:{connected:false,applicationMessages:0,secretsInApplicationLogs:false,secretsInPlatformEvents:false}};
let transfer, tail, tailOutput='';
const secretStrings=[];
const headers={ 'Content-Type':'application/octet-stream' };
try {
 for(const [route,method,status,error] of [['/api/health','GET',200],['/api/capabilities','GET',200],['/api/nope','GET',404,'not-found'],['/api/health','PUT',405,'method-not-allowed'],['/api/transfers','OPTIONS',405,'method-not-allowed'],['/api/identify','POST',503,'not-configured']]){
  const r=await fetch(base+route,{method});assert.equal(r.status,status,`${method} ${route}`);assert.equal(r.headers.get('cache-control'),'no-store');const d=await r.json();if(error)assert.equal(d.error,error);if(route==='/api/capabilities')assert.equal(d.transfer.available,true);summary.checks.push(`${method} ${route} ${status}`);
 }
 tail=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','tail','nature-lens','--format','json'],{stdio:['ignore','pipe','pipe']});
 tail.stdout.on('data',b=>{tailOutput+=b.toString();if(tailOutput.includes('Connected to'))summary.tail.connected=true;});
 tail.stderr.on('data',b=>{tailOutput+=b.toString();});
 // Tail is diagnostic only; network setup is bounded and never blocks deployment.
 await new Promise(resolve=>setTimeout(resolve,5000));
 const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));const magic=new TextEncoder().encode('NLT1');
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:magic},key,new Uint8Array(1048576-32)));
 const payload=new Uint8Array(16+ciphertext.length);payload.set(magic);payload.set(iv,4);payload.set(ciphertext,16);assert.equal(payload.length,1048576);
 const response=await fetch(base+'/api/transfers',{method:'POST',headers,body:payload});assert.equal(response.status,201,'remote exact 1MiB creation');transfer=await response.json();secretStrings.push(transfer.readToken,transfer.deleteToken);assert.equal(transfer.size,1048576);
 summary.checks.push('remote encrypted BLOB exact 1MiB accepted');
 const db=await run(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','nature-lens-transfers','--remote','--json','--command','SELECT size, typeof(payload) AS storage_type, hex(substr(payload,1,4)) AS magic, length(read_hash) AS read_hash_length, length(delete_hash) AS delete_hash_length FROM transfers WHERE size=1048576;'],{maxBuffer:1024*1024});
 const rows=JSON.parse(db.stdout).flatMap(d=>d.results||[]);assert(rows.some(r=>r.size===1048576&&r.storage_type==='blob'&&r.magic==='4E4C5431'&&r.read_hash_length===64&&r.delete_hash_length===64));summary.database=rows;
 const read=await fetch(base+'/api/transfers/'+transfer.id,{headers:{Authorization:'Bearer '+transfer.readToken}});assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'no-store');assert.deepEqual(new Uint8Array(await read.arrayBuffer()),payload);summary.checks.push('remote binary read matches encrypted upload');
 const invalid=await fetch(base+'/api/transfers/'+transfer.id,{method:'DELETE',headers:{Authorization:'Bearer '+transfer.readToken}});assert.equal(invalid.status,404);summary.checks.push('read token cannot delete');
 const deletion=await fetch(base+'/api/transfers/'+transfer.id,{method:'DELETE',headers:{Authorization:'Bearer '+transfer.deleteToken}});assert.equal(deletion.status,200);
 const gone=await fetch(base+'/api/transfers/'+transfer.id,{headers:{Authorization:'Bearer '+transfer.readToken}});assert.equal(gone.status,404);transfer=null;summary.checks.push('delete token revokes subsequent read');
 await new Promise(resolve=>setTimeout(resolve,1500));
 // Parse NDJSON/pretty JSON objects without ever writing raw platform events.
 const starts=[];let depth=0,start=-1,inString=false,escaped=false;
 for(let i=0;i<tailOutput.length;i++){const c=tailOutput[i];if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inString=false;continue;}if(c==='"'){inString=true;continue;}if(c==='{'){if(depth===0)start=i;depth++;}else if(c==='}'&&depth>0){depth--;if(depth===0){try{starts.push(JSON.parse(tailOutput.slice(start,i+1)));}catch{}}}}
 for(const event of starts){if(event.event)summary.tail.connected=true;for(const log of event.logs||[]){summary.tail.applicationMessages++;if(secretStrings.some(s=>JSON.stringify(log).includes(s)))summary.tail.secretsInApplicationLogs=true;}if(secretStrings.some(s=>JSON.stringify(event.event||{}).includes(s)))summary.tail.secretsInPlatformEvents=true;}
 assert.equal(summary.tail.secretsInApplicationLogs,false,'application logs must not contain tokens');
 await mkdir('test-results',{recursive:true});await writeFile('test-results/deployed-api-summary.json',JSON.stringify(summary,null,2));
 console.log(JSON.stringify(summary));
} catch(error){console.error(String(error?.message||error).replace(/Bearer [A-Za-z0-9_-]+/g,'Bearer [redacted]'));process.exitCode=1;}
finally{if(transfer){const r=await fetch(base+'/api/transfers/'+transfer.id,{method:'DELETE',headers:{Authorization:'Bearer '+transfer.deleteToken}}).catch(()=>null);if(!r?.ok)console.error('Synthetic test transfer cleanup incomplete; it expires within 24h.');}tail?.kill('SIGTERM');}
