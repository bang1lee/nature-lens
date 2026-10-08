import {identificationRequestSchema,identificationResultSchema} from '../src/lib/ai/contract.ts';
import {sanitizePhoto} from './photo.mjs';
import {identifyWithProvider} from './providers.mjs';
export function createGateway(config,{authenticate,ledger,sanitize=sanitizePhoto,provider=identifyWithProvider}) {
 return async request=>{
  const origin=request.headers.get('origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store',Vary:'Origin'};
  const send=(status,body)=>new Response(JSON.stringify(body),{status,headers});
  if(!origin||!config.origins.includes(origin))return send(403,{error:'origin-denied'});
  headers['Access-Control-Allow-Origin']=origin;
  headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const path=new URL(request.url).pathname;
  const policyOK=typeof config.policyUrl==='string'&&config.policyUrl.startsWith('https://');
  const available=Boolean(config.enabled&&policyOK);
  const groups=available?[...(config.keys.plant?['plant']:[]),...(config.keys.insect?['insect']:[])]:[];
  if(path==='/capabilities'&&request.method==='GET')return send(200,{groups,policyUrl:policyOK?config.policyUrl:null});
  if(path!=='/identify'||request.method!=='POST')return send(404,{error:'not-found'});
  if(!available)return send(503,{error:'not-configured'});
  const token=request.headers.get('authorization');
  if(!token?.startsWith('Bearer '))return send(401,{error:'login-required'});
  let user;try{user=await authenticate(token.slice(7));}catch{return send(401,{error:'login-required'});}
  if(!user)return send(401,{error:'login-required'});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return send(415,{error:'invalid-format'});
  let raw;
  try {
   // Bounded streaming read; do not trust Content-Length.
   const reader=request.body?.getReader();if(!reader)return send(400,{error:'invalid-request'});
   const chunks=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>5_650_000){await reader.cancel();return send(413,{error:'image-too-large'});}chunks.push(value);}
   raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }catch{return send(400,{error:'invalid-request'});}
  const parsed=identificationRequestSchema.safeParse(raw);
  if(!parsed.success)return send(400,{error:'invalid-request'});
  const data=parsed.data;
  if(!groups.includes(data.taxonGroup))return send(503,{error:'not-configured'});
  // Reserve before expensive decode or external work. Failures still consume one slot.
  let reserved;try{reserved=ledger.reserve(user,data.requestId);}catch{return send(503,{error:'temporarily-unavailable'});}
  if(reserved!=='ok')return send(reserved==='duplicate'?409:429,{error:reserved});
  let jpeg;try{jpeg=await sanitize(data.photo);}catch{return send(400,{error:'invalid-image'});}
  try{return send(200,identificationResultSchema.parse(await provider(data.taxonGroup,jpeg,config.keys)));}
  catch{return send(502,{error:'provider-unavailable'});}
 };
}
