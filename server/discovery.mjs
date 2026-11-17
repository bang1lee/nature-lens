import {createHash} from 'node:crypto';
import {z} from 'zod';
import {identificationRequestSchema,identificationResultSchema} from '../src/lib/ai/contract.ts';
export const photoHash=jpeg=>createHash('sha256').update(jpeg).digest('hex');
const submission=identificationRequestSchema.extend({taxonGroup:z.literal('plant'),prediction:z.string().trim().min(1).max(140),reason:z.string().max(1000)});
const actionSchema=z.object({id:z.uuid(),early:z.boolean().optional()}).strict();
export async function discoveryRequest({path,raw,user,store,ledger,sanitize,provider,keys,send}){
 if(!store)return send(503,{error:'discovery-not-configured'});
 if(path!=='/discovery/submit'){
  const p=actionSchema.safeParse(raw);if(!p.success||!['/discovery/read','/discovery/reveal'].includes(path))return send(400,{error:'invalid-request'});
  const result=await store.action(user,path.endsWith('/read')?'read':'reveal',p.data);
  return send(result.error==='not-found'?404:result.error?409:200,result);
 }
 const p=submission.safeParse(raw);if(!p.success)return send(400,{error:'invalid-request'});
 const d=p.data;
 const reserved=await ledger.reserve(user,d.requestId);if(reserved!=='ok')return send(reserved==='duplicate'?409:429,{error:reserved});
 let jpeg;try{jpeg=await sanitize(d.photo);}catch{return send(400,{error:'invalid-image'});}
 const round=await store.action(user,'begin',{hash:photoHash(jpeg),observationId:d.observationId,prediction:d.prediction,reason:d.reason});
 if(!round.fresh)return send(200,round);
 try{
  const result=identificationResultSchema.parse(await provider('plant',jpeg,keys));
  return send(200,await store.action(user,'complete',{id:round.id,result}));
 }catch{
  await store.action(user,'fail',{id:round.id});return send(502,{error:'provider-unavailable',id:round.id});
 }
}
