import {identificationResultSchema,type IdentificationResult} from './contract';
import {decisionSchema,type IdentificationDecision} from './decision-schema';
export {decisionSchema,type IdentificationDecision} from './decision-schema';

// Existing provider results contain no verified Korean-name or taxonomy mapping.
export function fromGatewayResult(input:IdentificationResult):IdentificationDecision {
 const result=identificationResultSchema.parse(input);
 const provenance={provider:result.provider,modelVersion:result.modelVersion,policyVersion:'gateway-adapter-v1'};
 if(result.state!=='candidates')return decisionSchema.parse({state:'abstain',provenance,reason:'provider_no_match',needsHumanReview:true});
 return decisionSchema.parse({state:'candidates',provenance,needsHumanReview:true,candidates:result.candidates.map(c=>({
  scientificName:c.scientificName,koreanName:null,taxonId:null,rank:'unknown',
  ...(c.commonName.trim()?{displayName:c.commonName.trim()}:{}),score:c.score,scoreMeaning:'uncalibrated',
 }))});
}
