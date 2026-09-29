import {it,expect} from 'vitest';
import {parseCloudConfig} from '../src/lib/cloud/config';
import {buildSubmissionPayload,aliasSchema} from '../src/lib/cloud/contract';
import {identificationRequestSchema,identificationResultSchema} from '../src/lib/ai/contract';
import {newObservation} from '../src/lib/domain';
it('rejects missing, private, arbitrary keys and insecure endpoints',()=>{
 expect(parseCloudConfig().enabled).toBe(false);
 for(const key of ['sb_secret_abcdefghijklmnop','some-arbitrary-key-123456789',`a.${btoa(JSON.stringify({role:'service_role'}))}.c`])expect(parseCloudConfig('https://example.supabase.co',key).enabled).toBe(false);
 expect(parseCloudConfig('http://example.com','sb_publishable_abcdefghijklmnop').enabled).toBe(false);
 expect(parseCloudConfig('https://example.supabase.co','sb_publishable_abcdefghijklmnop').enabled).toBe(true);
});
it('requires consent and emits allowlisted payload without coordinates',()=>{
 const o={...newObservation(),title:'관찰',species:'이름 미확정',notes:'관찰 메모',photo:'data:image/png;base64,YQ==',consent:true,noPeople:true,region:'서울' as const,protection:'common' as const};
 expect(buildSubmissionPayload(o,{uploadConsent:false,noPeople:true}).ok).toBe(false);
 const result=buildSubmissionPayload(o,{uploadConsent:true,noPeople:true});expect(result.ok).toBe(true);
 if(result.ok){expect(result.payload.region).toBeNull();expect(result.payload).not.toHaveProperty('publicGrid');expect(result.payload).not.toHaveProperty('owner_id');expect(result.payload).not.toHaveProperty('status');}
 expect(buildSubmissionPayload({...o,demo:true},{uploadConsent:true,noPeople:true}).ok).toBe(false);
 expect(aliasSchema.safeParse('admin').success).toBe(false);expect(aliasSchema.safeParse('a@b.com').success).toBe(false);
});
it('AI contract rejects unconsented/extra data and unchecked results',()=>{
 const r={observationId:'a',photo:'data:image/jpeg;base64,YQ==',taxonGroup:'plant',transmissionConsent:true};
 expect(identificationRequestSchema.safeParse(r).success).toBe(true);
 expect(identificationRequestSchema.safeParse({...r,transmissionConsent:false}).success).toBe(false);
 expect(identificationRequestSchema.safeParse({...r,latitude:37}).success).toBe(false);
 expect(identificationRequestSchema.safeParse({...r,taxonGroup:'insect'}).success).toBe(false);
 expect(identificationResultSchema.safeParse({state:'candidates',provider:'plantnet',modelVersion:'v1',candidates:[],needsHumanReview:true}).success).toBe(false);
 expect(identificationResultSchema.safeParse({state:'uncertain',provider:'plantnet',modelVersion:'v1',candidates:[],needsHumanReview:true}).success).toBe(true);
});
