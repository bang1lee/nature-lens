import {it,expect,vi} from 'vitest';
import {createGateway} from '../server/gateway.mjs';
const body={requestId:crypto.randomUUID(),observationId:'r',taxonGroup:'insect',photo:'data:image/jpeg;base64,YQ==',noPeople:true,transmissionConsent:true};
const config={origins:['http://localhost:3107'],enabled:true,keys:{plant:'test',insect:'test'},policyUrl:'https://example.org/privacy'};
function request(payload:unknown=body,token=true){return new Request('http://localhost/identify',{method:'POST',headers:{Origin:'http://localhost:3107','Content-Type':'application/json',...(token?{Authorization:'Bearer user-token'}:{})},body:JSON.stringify(payload)});}
it('rejects disabled, unauthorized, private extra input and bad origins without calling provider',async()=>{
 const provider=vi.fn();const reserve=vi.fn(()=> 'ok');
 const deps={authenticate:async()=> 'user',sanitize:async()=>Buffer.from('image'),provider,ledger:{reserve}};
 expect((await createGateway({...config,enabled:false},deps)(request())).status).toBe(503);
 expect((await createGateway(config,deps)(request(body,false))).status).toBe(401);
 expect((await createGateway(config,{...deps,authenticate:async()=>null})(request())).status).toBe(401);
 expect((await createGateway(config,deps)(request({...body,latitude:37}))).status).toBe(400);
 expect((await createGateway(config,deps)(new Request('http://localhost/identify',{method:'POST'}))).status).toBe(403);
 expect(provider).not.toHaveBeenCalled();expect(reserve).not.toHaveBeenCalled();
});
it('reserves once before provider, returns safe errors, and rejects duplicate/quota',async()=>{
 const provider=vi.fn(async()=>{throw new Error('secret-key-provider-url');});
 const deps={authenticate:async()=> 'user',sanitize:async()=>Buffer.from('image'),provider,ledger:{reserve:()=> 'ok'}};
 const response=await createGateway(config,deps)(request());expect(response.status).toBe(502);expect(await response.text()).not.toContain('secret');
 for(const [result,status] of [['duplicate',409],['quota',429]] as const)expect((await createGateway(config,{...deps,ledger:{reserve:()=>result}})(request())).status).toBe(status);
 expect(provider).toHaveBeenCalledTimes(1);
});
it('returns validated success and a minimal capabilities response without secret keys',async()=>{
 const answer={state:'uncertain',provider:'kindwise-insect',modelVersion:'v1',candidates:[],needsHumanReview:true};
 const run=createGateway(config,{authenticate:async()=> 'user',sanitize:async()=>Buffer.from('image'),provider:async()=>answer,ledger:{reserve:()=> 'ok'}});
 expect(await (await run(request())).json()).toEqual(answer);
 const cap=await run(new Request('http://localhost/capabilities',{headers:{Origin:'http://localhost:3107'}}));
 expect(await cap.json()).toEqual({groups:['plant','insect'],policyUrl:'https://example.org/privacy'});
});
it('rejects an oversized streaming body before provider execution',async()=>{
 const provider=vi.fn();const run=createGateway(config,{authenticate:async()=> 'user',provider,ledger:{reserve:()=> 'ok'}});
 expect((await run(request({photo:'x'.repeat(5_650_001)}))).status).toBe(413);expect(provider).not.toHaveBeenCalled();
});
