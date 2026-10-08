import {z} from 'zod';
import {identificationRequestSchema,identificationResultSchema} from './contract';
export function parseIdentificationEndpoint(raw?:string):string|null {
 if(!raw)return null;
 try{const u=new URL(raw);if((u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))||u.username||u.password||u.search||u.hash)return null;return u.href.replace(/\/$/,'');}catch{return null;}
}
export const identificationEndpoint=parseIdentificationEndpoint(process.env.NEXT_PUBLIC_IDENTIFY_URL);
export const capabilitySchema=z.object({groups:z.array(z.enum(['plant','insect'])),policyUrl:z.string().url().nullable()}).strict();
const messages:Record<number,string>={400:'사진이나 동의 내용을 확인해 주세요.',401:'설정에서 로그인한 뒤 다시 시도해 주세요.',403:'이 앱의 서버 접근이 허용되지 않았어요.',409:'이미 처리한 요청이에요. 새로 시도해 주세요.',413:'사진이 너무 커요. 다른 사진을 선택해 주세요.',429:'오늘의 이름 찾기 한도에 도달했어요. 수동 기록은 계속할 수 있어요.',503:'인식 서버가 아직 준비되지 않았어요.'};
export async function requestIdentification(endpoint:string,token:string,input:unknown,signal:AbortSignal,fetcher:typeof fetch=fetch) {
 const url=parseIdentificationEndpoint(endpoint);if(!url)throw new Error('인식 서버 주소가 올바르지 않아요.');
 const payload=identificationRequestSchema.parse(input);
 const response=await fetcher(`${url}/identify`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(payload),signal:AbortSignal.any([signal,AbortSignal.timeout(25_000)]),credentials:'omit',cache:'no-store'});
 if(!response.ok)throw new Error(messages[response.status]||'이름 후보를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.');
 return identificationResultSchema.parse(await response.json());
}
