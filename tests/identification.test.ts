import {expect,it,vi} from 'vitest';
import {identificationRequestSchema,identificationResultSchema} from '../src/lib/ai/contract';
import {candidateDraft} from '../src/lib/ai/apply';
import {newObservation} from '../src/lib/domain';
import {normalizePlant,normalizeInsect} from '../server/providers.mjs';
import {QuotaLedger} from '../server/quota.mjs';
import {sanitizePhoto} from '../server/photo.mjs';
import sharp from 'sharp';
const request={requestId:crypto.randomUUID(),observationId:'record',photo:'data:image/jpeg;base64,YQ==',taxonGroup:'insect',transmissionConsent:true,noPeople:true};
it('accepts consented insect requests but rejects extra private data and missing consent',()=>{
 expect(identificationRequestSchema.safeParse(request).success).toBe(true);
 for(const change of [{transmissionConsent:false},{noPeople:false},{latitude:37},{taxonGroup:'other'}])expect(identificationRequestSchema.safeParse({...request,...change}).success).toBe(false);
});
it('rejects inconsistent results',()=>{
 expect(identificationResultSchema.safeParse({state:'uncertain',provider:'plantnet',modelVersion:'v1',candidates:[{scientificName:'A',commonName:'',score:.9}],needsHumanReview:true}).success).toBe(false);
});
it('provider normalization does not fabricate Korean names or probabilities',()=>{
 expect(normalizePlant({version:'v1',results:[{score:.8,species:{scientificNameWithoutAuthor:'Acer palmatum',commonNames:['단풍나무']}}]}).candidates[0].scientificName).toBe('Acer palmatum');
 const insect=normalizeInsect({status:'COMPLETED',model_version:'v1',result:{classification:{suggestions:[{name:'Harmonia axyridis',probability:.8,details:{common_names:{en:['Ladybird']}}}]}}});
 expect(insect.candidates[0].commonName).toBe('');
 expect(()=>normalizeInsect({status:'PENDING'})).toThrow();
 expect(()=>normalizePlant({version:'v1',results:[{score:9,species:{scientificNameWithoutAuthor:'A'}}]})).toThrow();
});
it('candidate application invalidates review without changing location or publication consent',()=>{
 const o={...newObservation(),photo:'data:image/jpeg;base64,YQ==',status:'reviewed' as const,protection:'common' as const,consent:false};
 const next=candidateDraft(o,{scientificName:'Harmonia axyridis',commonName:'',score:.8});
 expect(next).toMatchObject({aiAssisted:true,status:'draft',protection:'unknown',consent:false,scientificName:'Harmonia axyridis'});
 expect(next.id).toBe(o.id);
});
it('durable ledger prevents duplicate requests and enforces per-user and project limits',()=>{
 const ledger=new QuotaLedger(':memory:',2,3);
 try {
  expect(ledger.reserve('u','one','2026-09-29')).toBe('ok');
  expect(ledger.reserve('u','one','2026-09-29')).toBe('duplicate');
  expect(ledger.reserve('u','two','2026-09-29')).toBe('ok');
  expect(ledger.reserve('u','three','2026-09-29')).toBe('quota');
  expect(ledger.reserve('v','one','2026-09-29')).toBe('ok');
  expect(ledger.reserve('w','one','2026-09-29')).toBe('quota');
  expect(ledger.reserve('w','one','2026-09-30')).toBe('ok');
 } finally {ledger.close();}
});
it('server decodes and reencodes photos, rejecting forged image payloads',async()=>{
 await expect(sanitizePhoto('data:image/jpeg;base64,YQ==')).rejects.toThrow();
 const bytes=await sharp({create:{width:10,height:10,channels:3,background:'#fff'}}).png().toBuffer();
 const safe=await sanitizePhoto(`data:image/png;base64,${bytes.toString('base64')}`);
 const metadata=await sharp(safe).metadata();expect(metadata.format).toBe('jpeg');expect(metadata.exif).toBeUndefined();
});
