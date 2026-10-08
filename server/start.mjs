// Node >=22.18. All secrets belong in process environment outside the repository.
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {homedir} from 'node:os';
import {QuotaLedger} from './quota.mjs';
import {createGateway} from './gateway.mjs';
const env=process.env;
const database=env.IDENTIFY_LEDGER_PATH||join(homedir(),'.local/share/nature-lens/identify.sqlite');
mkdirSync(dirname(database),{recursive:true,mode:0o700});
const ledger=new QuotaLedger(database);
const authURL=env.SUPABASE_URL||'';
if(authURL&&!authURL.startsWith('https://'))throw new Error('SUPABASE_URL must use HTTPS');
const gateway=createGateway({
 enabled:env.IDENTIFY_ENABLED==='true'&&Boolean(authURL&&env.SUPABASE_PUBLISHABLE_KEY),
 origins:(env.IDENTIFY_ALLOWED_ORIGINS||'http://127.0.0.1:3107,http://localhost:3107').split(',').map(x=>x.trim()),
 keys:{plant:env.PLANTNET_API_KEY||'',insect:env.KINDWISE_INSECT_API_KEY||''},policyUrl:env.IDENTIFY_POLICY_URL||'',
},{ledger,authenticate:async token=>{
 const r=await fetch(`${authURL}/auth/v1/user`,{headers:{Authorization:`Bearer ${token}`,apikey:env.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(5000)});
 if(!r.ok)return null;const user=await r.json();
 // Anonymous accounts must not reset a per-person pilot quota.
 return typeof user.id==='string'&&!user.is_anonymous?user.id:null;
}});
const server=createServer(async(req,res)=>{
 try {
  const request=new Request(`http://localhost${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
  const result=await gateway(request);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch{res.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"internal-error"}');}
});
server.requestTimeout=30_000;server.headersTimeout=10_000;
server.listen(Number(env.IDENTIFY_PORT||8787),env.IDENTIFY_HOST||'127.0.0.1',()=>console.log('Identification gateway listening; provider access requires explicit server configuration.'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>{ledger.close();process.exit(0);}));
