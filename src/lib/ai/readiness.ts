import {capabilitySchema,parseIdentificationEndpoint} from './client';
export type ServiceReadiness = {state:'ready';groups:('plant'|'insect')[];policyUrl:string} | {state:'checking'|'unconfigured'|'disabled'|'invalid'|'unavailable'|'timeout'};
/** A photo-free probe. Never retries or calls the identification endpoint. */
export async function checkIdentificationService(endpoint:string|null,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<ServiceReadiness>{
 signal.throwIfAborted();
 const url=parseIdentificationEndpoint(endpoint??undefined);
 if(!url)return {state:'unconfigured'};
 const timeout=AbortSignal.timeout(12_000);
 try{
  const response=await fetcher(`${url}/capabilities`,{signal:AbortSignal.any([signal,timeout]),credentials:'omit',cache:'no-store'});
  if(!response.ok)return {state:'unavailable'};
  const parsed=capabilitySchema.safeParse(await response.json());
  if(!parsed.success)return {state:'invalid'};
  if(!parsed.data.groups.length)return {state:'disabled'};
  if(!parsed.data.policyUrl?.startsWith('https://'))return {state:'invalid'};
  return {state:'ready',groups:parsed.data.groups,policyUrl:parsed.data.policyUrl};
 }catch(error){
  signal.throwIfAborted();
  if(timeout.aborted||(error instanceof Error&&error.name==='TimeoutError'))return {state:'timeout'};
  return {state:error instanceof SyntaxError?'invalid':'unavailable'};
 }
}
