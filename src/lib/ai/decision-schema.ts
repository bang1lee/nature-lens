import {z} from 'zod';
// App-side proposal boundary. Does not change gateway or model scoring policy.
const label=z.string().trim().min(1).max(160);
const provenanceSchema=z.object({provider:label,modelVersion:label,policyVersion:label}).strict();
const taxonSchema=z.object({
 scientificName:label,
 koreanName:label.nullable(),
 displayName:label.optional(),
 // IDs must include a namespace, e.g. inaturalist:123. Missing mappings remain null.
 taxonId:z.string().regex(/^[a-z][a-z0-9-]*:[A-Za-z0-9._-]+$/).nullable(),
 rank:z.enum(['unknown','species','genus','family','order','class','phylum','kingdom','unknown']),
 score:z.number().min(0).max(1),scoreMeaning:z.literal('uncalibrated'),
}).strict();
const shared={needsHumanReview:z.literal(true)};
export const decisionSchema=z.discriminatedUnion('state',[
 z.object({...shared,state:z.literal('candidates'),provenance:provenanceSchema,candidates:z.array(taxonSchema.extend({rank:z.enum(['species','unknown'])})).min(1).max(3)}).strict(),
 z.object({...shared,state:z.literal('ancestor'),provenance:provenanceSchema,taxon:taxonSchema.extend({rank:z.enum(['genus','family','order','class','phylum','kingdom'])})}).strict(),
 z.object({...shared,state:z.literal('abstain'),provenance:provenanceSchema,reason:z.enum(['provider_no_match','insufficient_evidence','poor_photo','multiple_subjects','out_of_scope'])}).strict(),
 z.object({...shared,state:z.literal('unavailable'),reason:z.enum(['network','timeout','not_configured','unauthorized','quota','invalid_response']),retryable:z.boolean()}).strict(),
]);
export type IdentificationDecision=z.infer<typeof decisionSchema>;

