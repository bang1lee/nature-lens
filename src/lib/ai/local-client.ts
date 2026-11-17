import {z} from 'zod';
import {identificationRequestSchema} from './contract';
import {decisionSchema} from './decision-schema';
export const localEndpoint='http://127.0.0.1:8788';
export const localCapabilitySchema=z.object({mode:z.literal('local'),groups:z.array(z.enum(['plant','insect'])),externalTransmission:z.literal(false)}).strict();
export const localResponseSchema=z.object({decision:decisionSchema,metrics:z.object({elapsedMs:z.number().nonnegative(),externalRequests:z.literal(0),providerCostUsd:z.literal(0)}).strict()}).strict();
export function isLocalApp(){return typeof window!=='undefined'&&['localhost','127.0.0.1'].includes(window.location.hostname);}
export async function requestLocalIdentification(input:unknown,signal:AbortSignal){
 if(!isLocalApp())throw Error('이 Mac의 로컬 앱에서만 사용할 수 있어요.');
 const response=await fetch(`${localEndpoint}/identify`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(identificationRequestSchema.parse(input)),credentials:'omit',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(25_000)])});
 if(!response.ok)throw Error(response.status===429?'다른 사진을 분석 중이에요. 잠시 후 다시 시도해 주세요.':'이 Mac의 식별 서버를 확인해 주세요.');
 return localResponseSchema.parse(await response.json());
}
