import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import {decisionSchema,fromGatewayResult} from '../src/lib/ai/decision';
import {newObservation,canPublish} from '../src/lib/domain';
import {saveObservation,readLibrary,deleteObservation} from '../src/lib/storage';
const provenance={provider:'sample-local',modelVersion:'v1',policyVersion:'exploratory-v1'};
const taxon={scientificName:'Acer',koreanName:null,taxonId:null,rank:'genus',score:.8,scoreMeaning:'uncalibrated'};
it('keeps ancestor predictions distinct from species candidates',()=>{
 expect(decisionSchema.safeParse({state:'ancestor',provenance,taxon,needsHumanReview:true}).success).toBe(true);
 expect(decisionSchema.safeParse({state:'candidates',provenance,candidates:[taxon],needsHumanReview:true}).success).toBe(false);
});
it('rejects empty candidates, unversioned evidence and unsupported certainty',()=>{
 for(const input of [
  {state:'candidates',provenance,candidates:[],needsHumanReview:true},
  {state:'abstain',reason:'insufficient_evidence',provenance:{...provenance,policyVersion:''},needsHumanReview:true},
  {state:'ancestor',provenance,taxon,needsHumanReview:false},
  {state:'ancestor',provenance,taxon:{...taxon,score:NaN},needsHumanReview:true},
 ]) expect(decisionSchema.safeParse(input).success).toBe(false);
});
it('does not turn provider no-match labels into a verified non-organism judgment',()=>{
 for(const state of ['uncertain','not_plant','not_insect'] as const){
  const decision=fromGatewayResult({state,provider:'plantnet',modelVersion:'v1',candidates:[],needsHumanReview:true});
  expect(decision).toMatchObject({state:'abstain',reason:'provider_no_match',needsHumanReview:true});
 }
});
it('preserves names as unverified display names without inventing Korean names or taxon IDs',()=>{
 const result=fromGatewayResult({state:'candidates',provider:'plantnet',modelVersion:'v1',candidates:[{scientificName:'Acer palmatum',commonName:'Japanese maple',score:.8}],needsHumanReview:true});
 expect(result.state).toBe('candidates');
 if(result.state==='candidates')expect(result.candidates[0]).toMatchObject({koreanName:null,taxonId:null,displayName:'Japanese maple',rank:'unknown',scoreMeaning:'uncalibrated'});
});
it('keeps communication failure separate from identification abstention',()=>{
 expect(decisionSchema.safeParse({state:'unavailable',reason:'network',retryable:true,needsHumanReview:true}).success).toBe(true);
 expect(decisionSchema.safeParse({state:'unavailable',reason:'network',retryable:true,candidates:[taxon],needsHumanReview:true}).success).toBe(false);
});
it('persists an unnamed private observation without AI, consent or publication promotion',async()=>{
 const draft={...newObservation(),title:'오늘 만난 자연',photo:'data:image/jpeg;base64,YQ==',notes:'다음에 잎을 더 가까이 관찰하기'};
 try{
  await saveObservation(draft,null);
  const found=(await readLibrary()).observations.find(o=>o.id===draft.id)!;
  expect(found).toMatchObject({species:'',scientificName:'',status:'draft',consent:false,aiAssisted:false});
  expect(canPublish(found)).toBe(false);
 }finally{await deleteObservation(draft.id);}
});
