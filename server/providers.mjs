import {z} from 'zod';
import {identificationResultSchema} from '../src/lib/ai/contract.ts';
const score=z.number().min(0).max(1);
const name=z.string().min(1).max(140);
const plantSchema=z.object({version:z.string().min(1).max(100),results:z.array(z.object({score,species:z.object({scientificNameWithoutAuthor:name,commonNames:z.array(z.string()).optional()})}))});
const insectSchema=z.object({status:z.literal('COMPLETED'),model_version:z.string().min(1).max(100),result:z.object({classification:z.object({suggestions:z.array(z.object({name,probability:score,details:z.object({common_names:z.record(z.string(),z.array(z.string())).optional()}).optional()}))})})});
function normalized(provider,version,candidates) {
 // A conservative display threshold, not a calibrated accuracy claim.
 const chosen=candidates.filter(c=>c.score>=0.2).sort((a,b)=>b.score-a.score).slice(0,3);
 return identificationResultSchema.parse({state:chosen.length?'candidates':'uncertain',provider,modelVersion:version,candidates:chosen,needsHumanReview:true});
}
export function normalizePlant(raw) {
 const p=plantSchema.parse(raw);
 return normalized('plantnet',p.version,p.results.map(c=>({scientificName:c.species.scientificNameWithoutAuthor,commonName:(c.species.commonNames?.find(n=>/[가-힣]/.test(n))||'').slice(0,100),score:c.score})));
}
export function normalizeInsect(raw) {
 const p=insectSchema.parse(raw);
 return normalized('kindwise-insect',p.model_version,p.result.classification.suggestions.map(c=>({scientificName:c.name,commonName:(c.details?.common_names?.ko?.[0]||'').slice(0,100),score:c.probability})));
}
export async function identifyWithProvider(group,jpeg,keys,fetcher=fetch) {
 const signal=AbortSignal.timeout(20_000);
 let response;
 if(group==='plant') {
  const url=new URL('https://my-api.plantnet.org/v2/identify/all');
  url.search=new URLSearchParams({'api-key':keys.plant,'nb-results':'3','no-reject':'false',lang:'ko'}).toString();
  const body=new FormData();body.append('images',new Blob([jpeg],{type:'image/jpeg'}),'observation.jpg');body.append('organs','auto');
  response=await fetcher(url,{method:'POST',body,signal});
  if(response.status===404)return {state:'not_plant',provider:'plantnet',modelVersion:'not-reported',candidates:[],needsHumanReview:true};
 } else {
  response=await fetcher('https://insect.kindwise.com/api/v1/identification?details=common_names',{method:'POST',headers:{'Content-Type':'application/json','Api-Key':keys.insect},body:JSON.stringify({images:[jpeg.toString('base64')],similar_images:false}),signal});
 }
 if(!response.ok)throw new Error('provider-unavailable');
 const raw=await response.json();
 return group==='plant'?normalizePlant(raw):normalizeInsect(raw);
}
