import {candidateSchema,type IdentificationCandidate} from './contract';
import type {Observation} from '../domain';
export function candidateDraft(record:Observation,candidate:IdentificationCandidate):Observation {
 const c=candidateSchema.parse(candidate);
 return {...record,scientificName:c.scientificName,species:(c.commonName||c.scientificName).slice(0,100),aiAssisted:true,status:'draft',protection:'unknown'};
}
