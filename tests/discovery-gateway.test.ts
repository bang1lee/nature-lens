import {it,expect,vi} from 'vitest';
import {createGateway} from '../server/gateway.mjs';
const config={origins:['https://app.test'],enabled:true,keys:{plant:'test'},policyUrl:'https://app.test/privacy'};
const answer={state:'uncertain',provider:'plantnet',modelVersion:'test',candidates:[],needsHumanReview:true};
const input={requestId:crypto.randomUUID(),observationId:'one',photo:'data:image/jpeg;base64,YQ==',taxonGroup:'plant',noPeople:true,transmissionConsent:true,prediction:'민들레',reason:''};
const req=(path:string,body:unknown,token=true)=>new Request('https://gateway.test'+path,{method:'POST',headers:{Origin:'https://app.test','Content-Type':'application/json',...(token?{Authorization:'Bearer token'}:{})},body:JSON.stringify(body)});
it('discovery requires verified login and rejects forged completion actions',async()=>{
 const action=vi.fn();const run=createGateway(config,{authenticate:async()=>null,ledger:{reserve:()=> 'ok'},discovery:{action}} as any);
 expect((await run(req('/discovery/submit',input))).status).toBe(401);expect(action).not.toHaveBeenCalled();
 const authenticated=createGateway(config,{authenticate:async()=> 'owner',ledger:{reserve:()=> 'ok'},discovery:{action}} as any);
 expect((await authenticated(req('/discovery/complete',{id:crypto.randomUUID(),points:100}))).status).toBe(400);expect(action).not.toHaveBeenCalled();
});
it('server derives photo hash and sends provider results only to private store',async()=>{
 const action=vi.fn(async(_user:string,verb:string,data:any)=>verb==='begin'?{id:'round',fresh:true}:{id:'round',state:'waiting',result:null});
 const run=createGateway(config,{authenticate:async()=> 'owner',ledger:{reserve:()=> 'ok'},discovery:{action},sanitize:async()=>Buffer.from('pixels'),provider:async()=>answer} as any);
 const r=await run(req('/discovery/submit',input));expect(r.status).toBe(200);expect(await r.json()).not.toHaveProperty('candidates');
 expect(action.mock.calls[0][2].hash).toMatch(/^[a-f0-9]{64}$/);expect(action.mock.calls[0][0]).toBe('owner');expect(action.mock.calls[1][2].result).toEqual(answer);
});
it('direct immediate identification marks same photo ineligible before revealing',async()=>{
 const action=vi.fn(async(_user:string,_verb:string,_data:unknown)=>({ok:true}));const provider=vi.fn(async()=>answer);
 const run=createGateway(config,{authenticate:async()=> 'owner',ledger:{reserve:()=> 'ok'},discovery:{action},sanitize:async()=>Buffer.from('pixels'),provider} as any);
 const {prediction,reason,...body}=input;expect((await run(req('/identify',body))).status).toBe(200);
 expect(action.mock.calls[0][1]).toBe('seen');expect(action.mock.invocationCallOrder[0]).toBeLessThan(provider.mock.invocationCallOrder[0]);
});
