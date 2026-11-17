import {expect,it,vi} from 'vitest';
import {identifyWithProvider,normalizePlant} from '../server/providers.mjs';
import {createGateway} from '../server/gateway.mjs';

const plant={version:'provider-v1',results:[{score:.9,species:{scientificNameWithoutAuthor:'Taraxacum officinale',commonNames:['common dandelion']}}]};
const keys={plant:'test-provider-key',insect:''};

it('requests supported provider defaults and keeps original model settings',async()=>{
 const fetcher=vi.fn(async()=>Response.json(plant));
 const result=await identifyWithProvider('plant',Buffer.from('photo'),keys,fetcher);
 const [target,options]=fetcher.mock.calls[0] as unknown as [URL,RequestInit];
 expect(target.pathname).toBe('/v2/identify/all');
 expect(target.searchParams.has('lang')).toBe(false);
 expect(target.searchParams.get('no-reject')).toBe('false');
 expect(target.searchParams.get('nb-results')).toBe('3');
 expect(options.method).toBe('POST');
 expect(result).toMatchObject({state:'candidates',provider:'plantnet',candidates:[{scientificName:'Taraxacum officinale',commonName:'common dandelion'}]});
});

it('prefers a Korean common name when supplied and otherwise uses the provider name',()=>{
 expect(normalizePlant({version:'v1',results:[{score:.9,species:{scientificNameWithoutAuthor:'Acer',commonNames:['maple','단풍나무']}}]}).candidates[0].commonName).toBe('단풍나무');
 expect(normalizePlant({version:'v1',results:[{score:.9,species:{scientificNameWithoutAuthor:'Acer',commonNames:['maple']}}]}).candidates[0].commonName).toBe('maple');
 expect(normalizePlant({version:'v1',results:[{score:.9,species:{scientificNameWithoutAuthor:'Acer'}}]}).candidates[0].commonName).toBe('');
});

it('treats documented species-not-found as uncertainty but other 404s as provider failures',async()=>{
 const response=(message:string)=>async()=>Response.json({statusCode:404,error:'Not Found',message},{status:404});
 expect(await identifyWithProvider('plant',Buffer.from('photo'),keys,response('Species not found'))).toMatchObject({state:'uncertain',candidates:[],needsHumanReview:true});
 for(const message of ['No localization available for ko','Unknown project','Not Found']){
  await expect(identifyWithProvider('plant',Buffer.from('photo'),keys,response(message))).rejects.toThrow('provider-unavailable');
 }
 await expect(identifyWithProvider('plant',Buffer.from('photo'),keys,async()=>new Response('<html>not found</html>',{status:404}))).rejects.toThrow('provider-unavailable');
});

it('reports an unknown upstream 404 as a safe gateway error, never a biological result',async()=>{
 const fetcher=async()=>Response.json({statusCode:404,error:'Not Found',message:'No localization available for ko'},{status:404});
 const gateway=createGateway({enabled:true,origins:['https://app.test'],keys,policyUrl:'https://app.test/policy'},{
  authenticate:async()=>({id:'member',isAnonymous:false}),ledger:{reserve:()=> 'ok'},sanitize:async()=>Buffer.from('photo'),
  provider:(group:string,jpeg:Buffer,providerKeys:typeof keys)=>identifyWithProvider(group,jpeg,providerKeys,fetcher),
 } as any);
 const response=await gateway(new Request('https://gateway.test/identify',{method:'POST',headers:{Origin:'https://app.test',Authorization:'Bearer token','Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),observationId:'record',photo:'data:image/jpeg;base64,YQ==',taxonGroup:'plant',transmissionConsent:true,noPeople:true})}));
 expect(response.status).toBe(502);expect(await response.json()).toEqual({error:'provider-unavailable'});
});
