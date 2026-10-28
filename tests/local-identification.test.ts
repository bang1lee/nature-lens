import {test,expect} from 'vitest';
import sharp from 'sharp';
import {createLocalGateway} from '../server/local-identification.mjs';
const origin='http://127.0.0.1:3130';
const decision={state:'abstain',reason:'insufficient_evidence',provenance:{provider:'local-inat-small',modelVersion:'test',policyVersion:'test'},needsHumanReview:true};
async function payload(){return {requestId:crypto.randomUUID(),observationId:'test',photo:'data:image/png;base64,'+(await sharp({create:{width:32,height:32,channels:3,background:'green'}}).png().toBuffer()).toString('base64'),taxonGroup:'plant',transmissionConsent:true,noPeople:true};}
function req(body:unknown,from=origin){return new Request(origin+'/identify',{method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify(body)});}
test('local service rejects other origins, missing consent, invalid images and private fields before inference',async()=>{
 let calls=0;const gateway=createLocalGateway({origins:[origin],infer:async()=>{calls++;return {decision};}});const p=await payload();
 expect((await gateway(req(p,'https://evil.example'))).status).toBe(403);
 expect((await gateway(req({...p,transmissionConsent:false}))).status).toBe(400);
 expect((await gateway(req({...p,latitude:37}))).status).toBe(400);
 expect((await gateway(req({...p,photo:'data:image/png;base64,YQ=='}))).status).toBe(400);
 expect(calls).toBe(0);
 const r=await gateway(req(p));expect(r.status).toBe(200);expect((await r.json()).decision).toEqual(decision);expect(calls).toBe(1);
});
test('local model requests are serialized and failures release the slot',async()=>{
 let release!:()=>void;const hold=new Promise<void>(r=>{release=r;});
 const gateway=createLocalGateway({origins:[origin],infer:async()=>{await hold;throw Error('model-failed');}});
 const p=await payload();const first=gateway(req(p));expect((await gateway(req(p))).status).toBe(429);release();
 expect((await first).status).toBe(503);expect((await gateway(req(p))).status).toBe(503);
});
