import {expect,it,vi} from 'vitest';
import {createGateway} from '../server/gateway.mjs';
import {QuotaLedger} from '../server/quota.mjs';
import {createSupabaseAuthenticator} from '../server/supabase-auth.mjs';

const config={enabled:true,origins:['https://app.test'],keys:{plant:'test'},policyUrl:'https://app.test/policy'};
const answer={state:'uncertain',provider:'plantnet',modelVersion:'test',candidates:[],needsHumanReview:true};
const photo={observationId:'record',photo:'data:image/jpeg;base64,YQ==',taxonGroup:'plant',transmissionConsent:true,noPeople:true};
const request=(path:string,token:string,body:unknown)=>new Request(`https://gateway.test${path}`,{
 method:'POST',headers:{Origin:'https://app.test','Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body),
});

it('lets verified guests identify within the real per-account and project quotas',async()=>{
 const ledger=new QuotaLedger(':memory:');
 const seen=vi.fn(async()=>({ok:true}));
 const provider=vi.fn(async()=>answer);
 const fetchAuth=async(_url:string,options:RequestInit)=>{
  const token=(options.headers as Record<string,string>).Authorization.slice(7);
  if(token==='invalid')return new Response('{}',{status:401});
  const [kind,id]=token.split(':');
  return Response.json({id,is_anonymous:kind==='guest'});
 };
 const run=createGateway(config,{
  authenticate:createSupabaseAuthenticator('https://auth.example','public-key',fetchAuth as unknown as typeof fetch),
  ledger,discovery:{action:seen},sanitize:async()=>Buffer.from('photo'),provider,
 } as any);
 const identify=(token:string)=>run(request('/identify',token,{...photo,requestId:crypto.randomUUID()}));
 const guest=crypto.randomUUID(),otherGuest=crypto.randomUUID(),member=crypto.randomUUID();
 try{
  expect((await identify('invalid')).status).toBe(401);
  expect(provider).not.toHaveBeenCalled();
  for(let i=0;i<5;i++)expect((await identify(`guest:${guest}`)).status).toBe(200);
  expect((await identify(`guest:${guest}`)).status).toBe(429);
  expect((await identify(`guest:${otherGuest}`)).status).toBe(200);
  expect((await identify(`member:${member}`)).status).toBe(200);
  for(let i=0;i<43;i++)expect((await identify(`guest:${crypto.randomUUID()}`)).status).toBe(200);
  expect((await identify(`guest:${crypto.randomUUID()}`)).status).toBe(429);
  expect(provider).toHaveBeenCalledTimes(50);
  expect(seen).toHaveBeenCalledWith(guest,'seen',expect.objectContaining({observationId:'record'}));
  expect(seen).toHaveBeenCalledWith(member,'seen',expect.objectContaining({observationId:'record'}));
 }finally{ledger.close();}
});

it('never lets an anonymous session access prediction actions',async()=>{
 const action=vi.fn();const reserve=vi.fn();const provider=vi.fn();
 const run=createGateway(config,{authenticate:async()=>({id:'guest',isAnonymous:true}),ledger:{reserve},discovery:{action},provider} as any);
 for(const path of ['/discovery/submit','/discovery/read','/discovery/reveal']){
  const response=await run(request(path,'valid-guest',{...photo,requestId:crypto.randomUUID(),prediction:'guess',reason:''}));
  expect(response.status).toBe(401);
 }
 expect(action).not.toHaveBeenCalled();expect(reserve).not.toHaveBeenCalled();expect(provider).not.toHaveBeenCalled();
});
