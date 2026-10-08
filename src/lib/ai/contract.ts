import {z} from 'zod';
export const candidateSchema=z.object({scientificName:z.string().min(1).max(140),commonName:z.string().max(100),score:z.number().min(0).max(1)}).strict();
export type IdentificationCandidate=z.infer<typeof candidateSchema>;
export const identificationRequestSchema=z.object({
 requestId:z.uuid(),observationId:z.string().min(1).max(100),
 photo:z.string().max(5_600_000).regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/),
 taxonGroup:z.enum(['plant','insect']),transmissionConsent:z.literal(true),noPeople:z.literal(true),
}).strict();
export const identificationResultSchema=z.object({
 state:z.enum(['candidates','uncertain','not_plant','not_insect']),provider:z.enum(['plantnet','kindwise-insect']),
 modelVersion:z.string().min(1).max(100),candidates:z.array(candidateSchema).max(3),needsHumanReview:z.literal(true),
}).strict().refine(r=>r.state==='candidates'?r.candidates.length>0:r.candidates.length===0,'Inconsistent candidates');
export type IdentificationResult=z.infer<typeof identificationResultSchema>;
