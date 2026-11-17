import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {Readable} from 'node:stream';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {identificationRequestSchema} from '../src/lib/ai/contract.ts';
import {decisionSchema} from '../src/lib/ai/decision-schema.ts';
import {sanitizePhoto} from './photo.mjs';
const research=resolve(process.env.NATURE_LENS_RESEARCH_DIR||'.research/claude-workspace/reverse-engineering/naturelens-seek');
export function runLocalInference(jpeg,group){
 return new Promise((accept,reject)=>{
  const child=spawn(resolve(research,'.venv/bin/python'),[resolve('server/local-inference.py'),research],{stdio:['pipe','pipe','pipe']});
  let output='',settled=false;
  const timer=setTimeout(()=>{child.kill('SIGKILL');finish(new Error('timeout'));},20_000);
  function finish(error,value){if(settled)return;settled=true;clearTimeout(timer);error?reject(error):accept(value);}
  child.on('error',e=>finish(e));child.stdin.on('error',e=>finish(e));
  child.stdout.on('data',b=>{output+=b;if(output.length>100_000){child.kill('SIGKILL');finish(new Error('invalid-output'));}});
  child.stderr.resume(); // model runtime diagnostics may not contain user images in logs
  child.on('close',code=>{try{if(code!==0)throw Error('model-failed');const value=JSON.parse(output);value.decision=decisionSchema.parse(value.decision);finish(null,value);}catch(e){finish(e);}});
  child.stdin.end(JSON.stringify({jpeg:jpeg.toString('base64'),group}));
 });
}
export function createLocalGateway({origins,infer=runLocalInference}){
 let busy=false;
 return async request=>{
  const origin=request.headers.get('origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store',Vary:'Origin'};
  const send=(status,value)=>new Response(JSON.stringify(value),{status,headers});
  // Explicit loopback origin allowlist; this is not the authenticated cloud gateway.
  if(!origins.includes(origin))return send(403,{error:'origin-denied'});
  headers['Access-Control-Allow-Origin']=origin;
  headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type';
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const path=new URL(request.url).pathname;
  if(path==='/capabilities'&&request.method==='GET')return send(200,{mode:'local',groups:['plant','insect'],externalTransmission:false});
  if(path!=='/identify'||request.method!=='POST')return send(404,{error:'not-found'});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return send(415,{error:'invalid-format'});
  if(busy)return send(429,{error:'busy'});
  busy=true;
  try{
   const reader=request.body?.getReader();if(!reader)return send(400,{error:'invalid-request'});
   let size=0;const chunks=[];
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5_650_000){await reader.cancel();return send(413,{error:'too-large'});}chunks.push(value);}
   let input;try{input=identificationRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString()));}catch{return send(400,{error:'invalid-request'});}
   let jpeg;try{jpeg=await sanitizePhoto(input.photo);}catch{return send(400,{error:'invalid-image'});}
   const result=await infer(jpeg,input.taxonGroup);
   return send(200,{decision:decisionSchema.parse(result.decision),metrics:result.metrics});
  }catch{return send(503,{error:'local-model-unavailable'});}finally{busy=false;}
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const origins=(process.env.LOCAL_IDENTIFY_ORIGINS||'http://127.0.0.1:3129,http://localhost:3129,http://127.0.0.1:3130').split(',');
 for(const origin of origins){const u=new URL(origin);if(u.protocol!=='http:'||!['127.0.0.1','localhost'].includes(u.hostname)||u.origin!==origin)throw Error('Loopback origins only');}
 const gateway=createLocalGateway({origins});
 const server=createServer(async(req,res)=>{try{
  const host=req.headers.host;if(!host||! /^(127\.0\.0\.1|localhost):\d+$/.test(host)){res.writeHead(403);res.end();return;}
  const request=new Request(`http://${host}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
  const result=await gateway(request);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch{res.writeHead(500);res.end();}});
 server.requestTimeout=30_000;server.headersTimeout=10_000;
 server.listen(Number(process.env.LOCAL_IDENTIFY_PORT||8788),'127.0.0.1',()=>console.log('Local-only identification on loopback; no external photo transmission.'));
}
